import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, requireApiUser } from "@/lib/api";
import { chatSchema, formatZodError } from "@/lib/validation";
import { checkRateLimit } from "@/lib/agent/usage";
import { confirmPendingAction, recordNoop, runAgent } from "@/lib/agent/orchestrator";
import { isAffirmative, isNegative } from "@/lib/agent/nlu";
import type { PendingAction } from "@/lib/agent/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface StoredResult {
  pending?: PendingAction | null;
}

async function lastPending(userId: string): Promise<PendingAction | null> {
  const log = await prisma.agentLog.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { result: true },
  });
  if (!log) return null;
  const result = log.result as StoredResult | null;
  return result?.pending ?? null;
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { ctx } = auth;

  const limit = checkRateLimit(ctx.userId);
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Slow down a moment — try again in ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const input = {
    userId: ctx.userId,
    user: ctx.user,
    displayName: ctx.profile.name ?? ctx.email,
    message: parsed.data.message,
    history: parsed.data.history,
    tokenBudget: ctx.profile.monthlyTokenBudget,
  };

  // A confirmation is applied before the model runs so "yes" is never
  // re-interpreted as a brand-new request.
  const pending = await lastPending(ctx.userId);
  if (pending) {
    if (isAffirmative(parsed.data.message)) {
      const result = await confirmPendingAction(input, pending);
      return NextResponse.json({ ...result, undoable: result.changes.length > 0 });
    }
    if (isNegative(parsed.data.message)) {
      const result = await recordNoop(input, "Okay — left the calendar as it was.");
      return NextResponse.json({ ...result, undoable: false });
    }
  }

  const result = await runAgent(input);
  return NextResponse.json({ ...result, undoable: result.changes.length > 0 });
}

/** Recent conversation, used when the chat panel remounts. */
export async function GET() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const logs = await prisma.agentLog.findMany({
    where: { userId: auth.ctx.userId },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: {
      id: true,
      message: true,
      reply: true,
      engine: true,
      intent: true,
      domainSlug: true,
      result: true,
      undone: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    messages: logs.reverse().map((log) => {
      const result = (log.result ?? {}) as { changes?: unknown; state?: string; pending?: unknown };
      return {
        id: log.id,
        message: log.message,
        reply: log.reply,
        engine: log.engine,
        intent: log.intent,
        domainSlug: log.domainSlug,
        changes: result.changes ?? [],
        pending: result.pending ?? null,
        undone: log.undone,
        createdAt: log.createdAt.toISOString(),
      };
    }),
  });
}
