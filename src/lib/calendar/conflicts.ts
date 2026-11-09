/**
 * Conflict detection.
 *
 * Pure functions so the agent, the UI and the tests all reason about time in
 * exactly the same way. Nothing here touches the database.
 */

import { minutesBetween } from "@/lib/time";
import type { TimeBlock } from "@/lib/calendar/types";
import { domainTier, type ProtectedTier } from "@/lib/domains/catalog";

export type ConflictSeverity = "blocking" | "protected" | "buffer" | "overload";

export interface ConflictSubject extends TimeBlock {
  id?: string;
  title: string;
  domainSlug: string;
  isProtected?: boolean;
  tier?: ProtectedTier;
}

export interface Conflict {
  severity: ConflictSeverity;
  code: string;
  message: string;
  conflictsWith?: { id?: string; title: string; domainSlug: string; start: Date; end: Date };
}

export interface ConflictCheckInput {
  candidate: ConflictSubject;
  /** Every event on the affected day(s), including the candidate's old version. */
  existing: ConflictSubject[];
  ignoreIds?: string[];
  /** Virtual protected windows such as sleep and meals. */
  protectedWindows?: { title: string; slug: string; start: Date; end: Date }[];
  bufferMinutes?: number;
  /** Total focus minutes already planned on each affected day. */
  plannedMinutesByDay?: Record<string, number>;
  maxFocusMinutes?: number;
  dayKeysTouched?: string[];
}

const DEFAULT_BUFFER = 15;

export function overlaps(a: TimeBlock, b: TimeBlock): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

export function overlapMinutes(a: TimeBlock, b: TimeBlock): number {
  const start = Math.max(a.start.getTime(), b.start.getTime());
  const end = Math.min(a.end.getTime(), b.end.getTime());
  return Math.max(0, Math.round((end - start) / 60_000));
}

/**
 * Check a candidate event against the schedule.
 * Returns an empty array when the slot is clean.
 */
export function findConflicts(input: ConflictCheckInput): Conflict[] {
  const conflicts: Conflict[] = [];
  const ignore = new Set(input.ignoreIds ?? []);
  const bufferMinutes = input.bufferMinutes ?? DEFAULT_BUFFER;
  const { candidate } = input;

  if (candidate.end.getTime() <= candidate.start.getTime()) {
    conflicts.push({
      severity: "blocking",
      code: "invalid_range",
      message: "The end time must be after the start time.",
    });
    return conflicts;
  }

  const others = input.existing.filter((event) => {
    if (event.id && ignore.has(event.id)) return false;
    if (event.id && event.id === candidate.id) return false;
    return true;
  });

  // 1. Hard double-booking & Tier checks.
  for (const event of others) {
    if (overlaps(candidate, event)) {
      const candTier = candidate.tier ?? domainTier(candidate.domainSlug);
      const eventTier = event.tier ?? domainTier(event.domainSlug);
      const mins = overlapMinutes(candidate, event);

      if (eventTier === 1 && candTier !== 1) {
        conflicts.push({
          severity: "protected",
          code: "tier_1_protected",
          message: `Overlaps protected Tier 1 anchor "${event.title}" (${mins} min). Fixed anchors cannot be overlapped without explicit confirmation.`,
          conflictsWith: {
            id: event.id,
            title: event.title,
            domainSlug: event.domainSlug,
            start: event.start,
            end: event.end,
          },
        });
      } else if (candTier === 1 && eventTier > 1) {
        conflicts.push({
          severity: "protected",
          code: "propose_move_lower_tier",
          message: `Overlaps lower-tier block "${event.title}" (Tier ${eventTier}). Propose moving "${event.title}" to protect Tier 1 anchor.`,
          conflictsWith: {
            id: event.id,
            title: event.title,
            domainSlug: event.domainSlug,
            start: event.start,
            end: event.end,
          },
        });
      } else {
        conflicts.push({
          severity: "blocking",
          code: "overlap",
          message: `Overlaps "${event.title}" (${mins} min).`,
          conflictsWith: {
            id: event.id,
            title: event.title,
            domainSlug: event.domainSlug,
            start: event.start,
            end: event.end,
          },
        });
      }
    }
  }

  // 2. Protected time (sleep, meals, karate, rest).
  for (const window of input.protectedWindows ?? []) {
    if (overlaps(candidate, window)) {
      conflicts.push({
        severity: "protected",
        code: "protected_time",
        message: `Cuts into protected ${window.title.toLowerCase()} time.`,
        conflictsWith: {
          title: window.title,
          domainSlug: window.slug,
          start: window.start,
          end: window.end,
        },
      });
    }
  }

  // 3. Missing buffer between back-to-back blocks.
  const blockingIds = new Set(
    conflicts.map((conflict) => conflict.conflictsWith?.id).filter(Boolean) as string[],
  );
  if (!conflicts.some((conflict) => conflict.severity === "blocking")) {
    for (const event of others) {
      if (blockingIds.has(event.id ?? "")) continue;
      const gapBefore = minutesBetween(event.end, candidate.start);
      const gapAfter = minutesBetween(candidate.end, event.start);
      const isAdjacent =
        (gapBefore >= 0 && gapBefore < bufferMinutes) || (gapAfter >= 0 && gapAfter < bufferMinutes);
      if (isAdjacent && bufferMinutes > 0) {
        conflicts.push({
          severity: "buffer",
          code: "back_to_back",
          message: `Back-to-back with "${event.title}" — less than ${bufferMinutes} min to reset.`,
          conflictsWith: {
            id: event.id,
            title: event.title,
            domainSlug: event.domainSlug,
            start: event.start,
            end: event.end,
          },
        });
        break;
      }
    }
  }

  // 4. Daily load.
  if (input.maxFocusMinutes && input.plannedMinutesByDay) {
    const candidateMinutes = minutesBetween(candidate.start, candidate.end);
    for (const key of input.dayKeysTouched ?? []) {
      const planned = input.plannedMinutesByDay[key] ?? 0;
      if (planned + candidateMinutes > input.maxFocusMinutes) {
        conflicts.push({
          severity: "overload",
          code: "daily_overload",
          message: `This day would hold ${Math.round((planned + candidateMinutes) / 60)}h of planned work (limit ${Math.round(
            input.maxFocusMinutes / 60,
          )}h).`,
        });
        break;
      }
    }
  }

  return conflicts;
}

export function hasBlockingConflict(conflicts: Conflict[]): boolean {
  return conflicts.some((conflict) => conflict.severity === "blocking");
}

export function needsConfirmation(conflicts: Conflict[]): boolean {
  return conflicts.some(
    (conflict) =>
      conflict.severity === "blocking" ||
      conflict.severity === "protected" ||
      conflict.severity === "overload",
  );
}

export function describeConflicts(conflicts: Conflict[]): string {
  return conflicts.map((conflict) => conflict.message).join(" ");
}
