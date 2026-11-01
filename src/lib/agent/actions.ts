/**
 * Deferred agent writes.
 *
 * A change that touches protected time or conflicts with something already on
 * the calendar is never saved straight away. The agent stores the intent here,
 * asks one short question, and only applies it when the user says yes.
 */

import { cancelEvent, createEvent, updateEvent, type InverseOp } from "@/lib/calendar/service";
import { isoLocal, type AgentContext, type ChangeSummary } from "./tools";

export type PendingAction =
  | {
      kind: "create";
      domainSlug: string;
      title: string;
      startISO: string;
      minutes: number;
      description?: string;
      recurrence?: string | null;
    }
  | { kind: "move"; eventId: string; title: string; startISO: string; minutes: number }
  | { kind: "cancel"; eventId: string; title: string }
  | { kind: "plan"; domainSlug: string; title: string; blocks: { startISO: string; endISO: string }[] };

export interface AppliedResult {
  ok: boolean;
  reply: string;
  changes: ChangeSummary[];
  inverse: InverseOp[];
}

function changed(
  event: { title: string; domainSlug: string; domainName: string; domainAccent: string; start: Date; end: Date },
  action: ChangeSummary["action"],
): ChangeSummary {
  return {
    kind: "event",
    action,
    title: event.title,
    domainSlug: event.domainSlug,
    domainName: event.domainName,
    domainAccent: event.domainAccent,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
  };
}

/** Execute a pending action that the user has just confirmed. */
export async function applyPendingAction(
  ctx: AgentContext,
  pending: PendingAction,
): Promise<AppliedResult> {
  if (pending.kind === "create") {
    const result = await createEvent(ctx.user, {
      domainSlug: pending.domainSlug,
      title: pending.title,
      start: new Date(pending.startISO),
      minutes: pending.minutes,
      description: pending.description ?? "",
      recurrence: pending.recurrence ?? null,
      source: "agent",
      force: true,
    });
    if (!result.ok || !result.event) {
      return { ok: false, reply: result.message ?? "I could not save that block.", changes: [], inverse: [] };
    }
    return {
      ok: true,
      reply: `Saved — ${result.event.title} is on ${isoLocal(result.event.start, ctx.user.timezone)} to ${isoLocal(
        result.event.end,
        ctx.user.timezone,
      ).slice(-5)}.`,
      changes: [changed(result.event, "created")],
      inverse: result.inverse ? [result.inverse] : [],
    };
  }

  if (pending.kind === "move") {
    const result = await updateEvent(ctx.user, pending.eventId, {
      start: new Date(pending.startISO),
      minutes: pending.minutes,
      force: true,
    });
    if (!result.ok || !result.event) {
      return { ok: false, reply: result.message ?? "I could not move that event.", changes: [], inverse: [] };
    }
    return {
      ok: true,
      reply: `Moved — ${result.event.title} now runs ${isoLocal(result.event.start, ctx.user.timezone)} to ${isoLocal(
        result.event.end,
        ctx.user.timezone,
      ).slice(-5)}.`,
      changes: [changed(result.event, "moved")],
      inverse: result.inverse ? [result.inverse] : [],
    };
  }

  if (pending.kind === "cancel") {
    const result = await cancelEvent(ctx.user, pending.eventId);
    if (!result.ok || !result.event) {
      return { ok: false, reply: result.message ?? "I could not cancel that event.", changes: [], inverse: [] };
    }
    return {
      ok: true,
      reply: `Cancelled ${pending.title}. You can undo this from the change card.`,
      changes: [changed(result.event, "cancelled")],
      inverse: result.inverse ? [result.inverse] : [],
    };
  }

  const changes: ChangeSummary[] = [];
  const inverse: InverseOp[] = [];
  for (const block of pending.blocks) {
    const result = await createEvent(ctx.user, {
      domainSlug: pending.domainSlug,
      title: pending.title,
      start: new Date(block.startISO),
      end: new Date(block.endISO),
      status: "suggested",
      source: "auto",
      force: true,
    });
    if (result.ok && result.event) {
      changes.push(changed(result.event, "suggested"));
      if (result.inverse) inverse.push(result.inverse);
    }
  }

  if (!changes.length) {
    return { ok: false, reply: "Those slots filled up in the meantime. Ask me to find new ones.", changes: [], inverse: [] };
  }

  return {
    ok: true,
    reply: `Added ${changes.length} suggested ${changes.length === 1 ? "block" : "blocks"} for ${pending.title}. They show dashed on the calendar until you accept them.`,
    changes,
    inverse,
  };
}

/** Human summary of a pending action, used in the confirmation prompt. */
export function describePending(pending: PendingAction, timeZone: string): string {
  if (pending.kind === "create") {
    const start = isoLocal(new Date(pending.startISO), timeZone);
    return `${pending.title} · ${start} · ${pending.minutes} min`;
  }
  if (pending.kind === "move") {
    return `${pending.title} → ${isoLocal(new Date(pending.startISO), timeZone)}`;
  }
  if (pending.kind === "cancel") {
    return pending.title;
  }
  return `${pending.blocks.length} blocks for ${pending.title}`;
}
