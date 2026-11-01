/**
 * Fuzzy lookup helpers for the chat agent.
 *
 * People say "karate" or "the pitch", not event ids. These helpers score the
 * words of a message against event and task titles so the rules engine and the
 * tools can find the same target the user has in mind.
 */

import { listEvents, listTasks } from "@/lib/calendar/service";
import type { CalendarEvent, CalendarTask } from "@/lib/calendar/types";
import { addZonedDays } from "@/lib/time";
import type { AgentContext } from "./tools";

const IGNORE = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "then",
  "them",
  "they",
  "have",
  "will",
  "would",
  "should",
  "could",
  "about",
  "move",
  "shift",
  "push",
  "cancel",
  "delete",
  "remove",
  "reschedule",
  "change",
  "block",
  "add",
  "create",
  "schedule",
  "book",
  "task",
  "todo",
  "mark",
  "done",
  "complete",
  "today",
  "tomorrow",
  "tonight",
  "next",
  "week",
  "morning",
  "afternoon",
  "evening",
  "night",
  "please",
  "make",
  "put",
  "earlier",
  "later",
  "session",
  "hours",
  "hour",
  "minutes",
  "minute",
  "mins",
]);

/** Meaningful lowercase words from a sentence. */
export function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !IGNORE.has(word));
}

export function titleScore(title: string, words: string[]): number {
  const haystack = title.toLowerCase();
  let score = 0;
  for (const word of words) {
    if (haystack.includes(word)) score += word.length;
  }
  return score;
}

/** Best-matching event within a sensible window around now. */
export async function findEventByText(
  ctx: AgentContext,
  text: string,
  options: { fromDays?: number; toDays?: number; includeSuggested?: boolean } = {},
): Promise<CalendarEvent | null> {
  const words = keywords(text);
  if (!words.length) return null;

  const events = await listEvents(ctx.user, {
    from: addZonedDays(ctx.now, options.fromDays ?? -3, ctx.user.timezone),
    to: addZonedDays(ctx.now, options.toDays ?? 60, ctx.user.timezone),
    includeSuggested: options.includeSuggested ?? true,
  });

  const scored = events
    .map((event) => ({ event, score: titleScore(`${event.title} ${event.domainName}`, words) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.event.start.getTime() - b.event.start.getTime());

  return scored[0]?.event ?? null;
}

/** Best-matching open task. */
export async function findTaskByText(ctx: AgentContext, text: string): Promise<CalendarTask | null> {
  const words = keywords(text);
  if (!words.length) return null;

  const tasks = await listTasks(ctx.user, { limit: 200 });
  const scored = tasks
    .map((task) => ({ task, score: titleScore(`${task.title} ${task.domainName}`, words) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.task ?? null;
}
