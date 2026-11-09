/**
 * The orchestrator.
 *
 * One entry point for every chat message: it picks an engine (DeepSeek with
 * typed tools, or the deterministic rules engine), runs the tool-calling loop,
 * applies the safety rules, and writes an AgentLog so every change is auditable
 * and undoable.
 */

import { prisma } from "@/lib/db";
import type { ServiceUser } from "@/lib/calendar/service";
import { AGENT_MODEL, executeWithDeepSeekPool, getDeepSeek, isDeepSeekConfigured } from "./llm";
import { autoCapturePreferences, memoryContext } from "./memory";
import { buildSystemPrompt } from "./prompts";
import { TOOL_MAP, toolSpecs, parseWhen, type AgentContext, type ChangeSummary } from "./tools";
import { runRules } from "./rules";
import { applyPendingAction, type PendingAction } from "./actions";
import { budgetStatus, monthTokens } from "./usage";
import { detectDistressText, CARE_FIRST_RESPONSE } from "@/lib/domains/rules";
import { CHAT_CONTEXT_MESSAGE_LIMIT } from "./history";

export interface AgentHistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AgentRunInput {
  userId: string;
  user: ServiceUser;
  displayName: string;
  message: string;
  history?: AgentHistoryTurn[];
  /** Monthly token budget for this account. */
  tokenBudget?: number;
  now?: Date;
}

export interface AgentRunResult {
  reply: string;
  engine: "deepseek" | "rules";
  state: "applied" | "needs_confirmation" | "info";
  changes: ChangeSummary[];
  pending: PendingAction | null;
  toolCalls: { name: string; args: Record<string, unknown>; result?: unknown }[];
  tokensIn: number;
  tokensOut: number;
  monthTokens: number;
  tokenBudget: number;
  logId: string | null;
  intent: string;
  domainSlug: string | null;
  degraded: boolean;
}

interface RawMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
}

const TOOL_INTENTS: Record<string, string> = {
  query_schedule: "query",
  create_event: "create",
  move_event: "move",
  cancel_event: "cancel",
  find_free_slots: "free_slots",
  create_main_task: "task",
  create_task: "task",
  update_task: "complete",
  plan_backwards: "plan",
  save_memory: "memory",
};

function safeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T;
}

/** Turn a tool result into a pending action the user can confirm. */
function pendingFromTool(
  name: string,
  data: Record<string, unknown>,
  ctx: AgentContext,
): PendingAction | null {
  const proposed = (data.proposed ?? {}) as {
    domain?: string;
    title?: string;
    start?: string;
    minutes?: number;
  };
  const event = (data.event ?? {}) as { id?: string; title?: string };
  const tz = ctx.user.timezone;

  if (name === "create_event" && proposed.start) {
    const start = parseWhen(proposed.start, tz);
    if (!start) return null;
    return {
      kind: "create",
      domainSlug: proposed.domain ?? "planning",
      title: proposed.title ?? "Planned block",
      startISO: start.toISOString(),
      minutes: proposed.minutes ?? 60,
    };
  }

  if (name === "move_event" && proposed.start && event.id) {
    const start = parseWhen(proposed.start, tz);
    if (!start) return null;
    return {
      kind: "move",
      eventId: event.id,
      title: event.title ?? "Event",
      startISO: start.toISOString(),
      minutes: proposed.minutes ?? 60,
    };
  }

  if (name === "cancel_event" && event.id) {
    return { kind: "cancel", eventId: event.id, title: event.title ?? "Event" };
  }

  if (name === "plan_backwards" && data.preview === true && Array.isArray(data.blocks)) {
    const blocks = (data.blocks as { start: string; end: string }[])
      .map((block) => {
        const start = parseWhen(block.start, tz);
        const end = parseWhen(block.end, tz);
        if (!start || !end) return null;
        return { startISO: start.toISOString(), endISO: end.toISOString() };
      })
      .filter((block): block is { startISO: string; endISO: string } => block !== null);
    if (!blocks.length) return null;
    return {
      kind: "plan",
      domainSlug: proposed.domain ?? "education",
      title: proposed.title ?? "Planned work",
      blocks,
    };
  }

  return null;
}

async function persist(
  input: AgentRunInput,
  payload: {
    reply: string;
    engine: "deepseek" | "rules";
    intent: string;
    domainSlug: string | null;
    toolCalls: { name: string; args: Record<string, unknown>; result?: unknown }[];
    inverse: unknown[];
    changes: ChangeSummary[];
    pending: PendingAction | null;
    state: AgentRunResult["state"];
    tokensIn: number;
    tokensOut: number;
  },
): Promise<string | null> {
  try {
    const log = await prisma.agentLog.create({
      data: {
        userId: input.userId,
        message: input.message.slice(0, 2000),
        reply: payload.reply.slice(0, 4000),
        intent: payload.intent,
        domainSlug: payload.domainSlug,
        toolCalls: safeJson(payload.toolCalls) as never,
        inverse: safeJson(payload.inverse) as never,
        result: safeJson({ state: payload.state, changes: payload.changes, pending: payload.pending }) as never,
        tokensIn: payload.tokensIn,
        tokensOut: payload.tokensOut,
        engine: payload.engine,
      },
    });
    return log.id;
  } catch {
    return null;
  }
}

async function guardedRules(
  ctx: AgentContext,
  message: string,
): Promise<{
  reply: string;
  intent: string;
  domainSlug: string | null;
  changes: ChangeSummary[];
  inverse: unknown[];
  pending: PendingAction | null;
  state: AgentRunResult["state"];
  toolCalls: { name: string; args: Record<string, unknown>; result?: unknown }[];
}> {
  const outcome = await runRules(ctx, message);
  return {
    reply: outcome.reply,
    intent: outcome.intent,
    domainSlug: outcome.domainSlug,
    changes: outcome.changes,
    inverse: outcome.inverse,
    pending: outcome.pending,
    state: outcome.state,
    toolCalls: outcome.toolCalls,
  };
}

/** Run one chat turn. */
export async function runAgent(input: AgentRunInput): Promise<AgentRunResult> {
  const now = input.now ?? new Date();
  const ctx: AgentContext = { userId: input.userId, user: input.user, now };
  const budget = input.tokenBudget ?? 2_000_000;

  // Care-first safety guard: pause prompts & never send distress or self-harm text to an AI model
  if (detectDistressText(input.message)) {
    const outcome = await guardedRules(ctx, input.message);
    const logId = await persist(input, {
      ...outcome,
      engine: "rules",
      tokensIn: 0,
      tokensOut: 0,
    });
    return {
      reply: outcome.reply,
      engine: "rules",
      state: "info",
      changes: [],
      pending: null,
      toolCalls: [],
      tokensIn: 0,
      tokensOut: 0,
      monthTokens: 0,
      tokenBudget: budget,
      logId,
      intent: "safety_distress",
      domainSlug: "mood",
      degraded: false,
    };
  }

  const before = await monthTokens(input.userId, input.user.timezone, now).catch(() => 0);
  const spend = await budgetStatus(input.userId, input.user.timezone, budget, now).catch(() => ({
    used: before,
    budget,
    remaining: Math.max(0, budget - before),
    exhausted: false,
  }));

  const useModel = isDeepSeekConfigured() && !spend.exhausted;

  if (!useModel) {
    const outcome = await guardedRules(ctx, input.message);
    const logId = await persist(input, {
      ...outcome,
      engine: "rules",
      tokensIn: 0,
      tokensOut: 0,
    });
    return {
      reply: outcome.reply,
      engine: "rules",
      state: outcome.state,
      changes: outcome.changes,
      pending: outcome.pending,
      toolCalls: outcome.toolCalls,
      tokensIn: 0,
      tokensOut: 0,
      monthTokens: spend.used,
      tokenBudget: budget,
      logId,
      intent: outcome.intent,
      domainSlug: outcome.domainSlug,
      degraded: false,
    };
  }

  // Auto-capture durable user habits and preferences (e.g. "I prefer studying at 9 AM")
  void autoCapturePreferences(input.userId, input.message).catch(() => {});

  const memories = await memoryContext(input.userId, input.message).catch(() => "No stored notes yet.");
  const system = buildSystemPrompt({
    now,
    timeZone: input.user.timezone,
    displayName: input.displayName,
    memories,
  });

  const messages: RawMessage[] = [
    { role: "system", content: system },
    ...(input.history ?? [])
      .slice(-CHAT_CONTEXT_MESSAGE_LIMIT)
      .map((turn) => ({ role: turn.role, content: turn.content }) as RawMessage),
    { role: "user", content: input.message },
  ];

  const changes: ChangeSummary[] = [];
  const inverse: unknown[] = [];
  const toolCalls: { name: string; args: Record<string, unknown>; result?: unknown }[] = [];
  let pending: PendingAction | null = null;
  let intent = "unknown";
  let domainSlug: string | null = null;
  let tokensIn = 0;
  let tokensOut = 0;
  let reply = "";

  try {
    for (let step = 0; step < 6; step += 1) {
      const completion = await executeWithDeepSeekPool((client, _idx, model) =>
        client.chat.completions.create({
          model,
          messages: messages as never,
          tools: toolSpecs() as never,
          tool_choice: "auto",
          temperature: 0.2,
          max_tokens: 900,
        }),
      );

      tokensIn += completion.usage?.prompt_tokens ?? 0;
      tokensOut += completion.usage?.completion_tokens ?? 0;

      const choice = completion.choices[0];
      const assistantMessage = choice?.message;
      if (!assistantMessage) break;

      const calls = (assistantMessage.tool_calls ?? []).filter((call) => call.type === "function");

      if (!calls.length) {
        reply = (assistantMessage.content ?? "").trim();
        break;
      }

      messages.push({
        role: "assistant",
        content: assistantMessage.content ?? "",
        tool_calls: calls.map((call) => ({
          id: call.id,
          type: "function" as const,
          function: { name: call.function.name, arguments: call.function.arguments },
        })),
      });

      for (const call of calls) {
        const tool = TOOL_MAP.get(call.function.name);
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }

        if (!tool) {
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "Unknown tool." }) });
          continue;
        }

        const outcome = await tool.handler(args, ctx);
        toolCalls.push({ name: tool.name, args, result: safeJson(outcome.data) });
        intent = TOOL_INTENTS[tool.name] ?? intent;

        if (outcome.change) changes.push(outcome.change);
        if (outcome.changes?.length) changes.push(...outcome.changes);
        if (outcome.inverse?.length) inverse.push(...outcome.inverse);

        const detected = pendingFromTool(tool.name, outcome.data, ctx);
        if (detected) {
          pending = detected;
          intent = TOOL_INTENTS[tool.name] ?? intent;
        }

        const candidateDomain =
          (outcome.change?.domainSlug as string | undefined) ??
          (typeof outcome.data.domain === "string" ? (outcome.data.domain as string) : undefined);
        if (candidateDomain) domainSlug = candidateDomain;

        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(safeJson(outcome.data)) });
      }
    }

    if (!reply) {
      reply = changes.length
        ? "Done — the calendar is updated. Undo is available on the change card."
        : "I didn't change anything. Ask me to move, cancel or block something.";
    }

    const state: AgentRunResult["state"] = pending ? "needs_confirmation" : changes.length ? "applied" : "info";
    const logId = await persist(input, {
      reply,
      engine: "deepseek",
      intent,
      domainSlug,
      toolCalls,
      inverse,
      changes,
      pending,
      state,
      tokensIn,
      tokensOut,
    });

    return {
      reply,
      engine: "deepseek",
      state,
      changes,
      pending,
      toolCalls,
      tokensIn,
      tokensOut,
      monthTokens: spend.used + tokensIn + tokensOut,
      tokenBudget: budget,
      logId,
      intent,
      domainSlug,
      degraded: false,
    };
  } catch (error) {
    // The model, the network or the provider can fail. The rules engine keeps
    // chat working; the failure is visible in the server log only.
    console.error("[lifeos] AI model call failed, using rules engine:", error);

    const fallback = await guardedRules(ctx, input.message);
    const logId = await persist(input, {
      ...fallback,
      engine: "rules",
      tokensIn,
      tokensOut,
    });

    return {
      reply: fallback.reply,
      engine: "rules",
      state: fallback.state,
      changes: fallback.changes,
      pending: fallback.pending,
      toolCalls: fallback.toolCalls,
      tokensIn,
      tokensOut,
      monthTokens: spend.used + tokensIn + tokensOut,
      tokenBudget: budget,
      logId,
      intent: fallback.intent,
      domainSlug: fallback.domainSlug,
      degraded: true,
    };
  }
}

/** Apply the action a previous turn proposed, now that the user said yes. */
export async function confirmPendingAction(
  input: AgentRunInput,
  pendingAction: PendingAction,
): Promise<AgentRunResult> {
  const now = input.now ?? new Date();
  const ctx: AgentContext = { userId: input.userId, user: input.user, now };
  const applied = await applyPendingAction(ctx, pendingAction);
  const budget = input.tokenBudget ?? 2_000_000;
  const spend = await budgetStatus(input.userId, input.user.timezone, budget, now).catch(() => ({
    used: 0,
    budget,
    remaining: budget,
    exhausted: false,
  }));

  const logId = await persist(input, {
    reply: applied.reply,
    engine: "rules",
    intent: pendingAction.kind === "plan" ? "plan" : pendingAction.kind,
    domainSlug: "domainSlug" in pendingAction ? pendingAction.domainSlug : null,
    toolCalls: [{ name: `confirm_${pendingAction.kind}`, args: safeJson(pendingAction) }],
    inverse: applied.inverse,
    changes: applied.changes,
    pending: null,
    state: applied.ok ? "applied" : "info",
    tokensIn: 0,
    tokensOut: 0,
  });

  return {
    reply: applied.reply,
    engine: "rules",
    state: applied.ok ? "applied" : "info",
    changes: applied.changes,
    pending: null,
    toolCalls: [{ name: `confirm_${pendingAction.kind}`, args: {} }],
    tokensIn: 0,
    tokensOut: 0,
    monthTokens: spend.used,
    tokenBudget: budget,
    logId,
    intent: pendingAction.kind,
    domainSlug: "domainSlug" in pendingAction ? pendingAction.domainSlug : null,
    degraded: false,
  };
}

/** Log a message that changed nothing (a declined confirmation, small talk). */
export async function recordNoop(
  input: AgentRunInput,
  reply: string,
  intent = "declined",
): Promise<AgentRunResult> {
  const budget = input.tokenBudget ?? 2_000_000;
  const logId = await persist(input, {
    reply,
    engine: "rules",
    intent,
    domainSlug: null,
    toolCalls: [],
    inverse: [],
    changes: [],
    pending: null,
    state: "info",
    tokensIn: 0,
    tokensOut: 0,
  });

  const used = await monthTokens(input.userId, input.user.timezone, input.now ?? new Date()).catch(() => 0);

  return {
    reply,
    engine: "rules",
    state: "info",
    changes: [],
    pending: null,
    toolCalls: [],
    tokensIn: 0,
    tokensOut: 0,
    monthTokens: used,
    tokenBudget: budget,
    logId,
    intent,
    domainSlug: null,
    degraded: false,
  };
}
