/**
 * Cost and abuse guards for the chat endpoint.
 *
 * - A per-user sliding window stops a stuck client from hammering the AI model.
 * - A monthly token budget (per account, editable in Settings) keeps spend
 *   predictable. When the budget is spent the agent keeps answering with the
 *   rules engine instead of failing.
 */

import { prisma } from "@/lib/db";
import { utcToZoned, zonedToUtc } from "@/lib/time";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;

const hits = new Map<string, number[]>();

export function checkRateLimit(userId: string): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((stamp) => now - stamp < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = recent[0];
    hits.set(userId, recent);
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000)) };
  }

  recent.push(now);
  hits.set(userId, recent);
  return { ok: true, retryAfterSeconds: 0 };
}

function startOfMonthInZone(timeZone: string, now: Date): Date {
  const local = utcToZoned(now, timeZone);
  return zonedToUtc({ year: local.year, month: local.month, day: 1 }, timeZone);
}

export async function monthTokens(userId: string, timeZone: string, now = new Date()): Promise<number> {
  const aggregate = await prisma.agentLog.aggregate({
    where: { userId, createdAt: { gte: startOfMonthInZone(timeZone, now) } },
    _sum: { tokensIn: true, tokensOut: true },
  });

  return (aggregate._sum.tokensIn ?? 0) + (aggregate._sum.tokensOut ?? 0);
}

export interface BudgetStatus {
  used: number;
  budget: number;
  remaining: number;
  exhausted: boolean;
}

export async function budgetStatus(
  userId: string,
  timeZone: string,
  budget: number,
  now = new Date(),
): Promise<BudgetStatus> {
  const used = await monthTokens(userId, timeZone, now);
  return {
    used,
    budget,
    remaining: Math.max(0, budget - used),
    exhausted: used >= budget,
  };
}
