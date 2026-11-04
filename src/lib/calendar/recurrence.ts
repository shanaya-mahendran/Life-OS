/**
 * Lightweight recurrence support.
 *
 * Stored form: "DAILY" or "WEEKLY:MO,WE,FR". That covers training sessions,
 * lectures and habits without dragging in a full RRULE implementation.
 */

import { addZonedDays, dayKey, startOfZonedDay, tzOffsetMs, utcToZoned, zonedToUtc } from "@/lib/time";

export interface RecurrenceRule {
  freq: "DAILY" | "WEEKLY";
  /** 0 = Sunday … 6 = Saturday (only for WEEKLY) */
  byWeekday?: number[];
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function parseRecurrence(rule: string | null | undefined): RecurrenceRule | null {
  if (!rule) return null;
  const [freqRaw, daysRaw] = rule.split(":");
  const freq = freqRaw?.toUpperCase();
  if (freq === "DAILY") return { freq: "DAILY" };
  if (freq === "WEEKLY") {
    const days = (daysRaw ?? "")
      .split(",")
      .map((code) => DAY_CODES.indexOf(code.trim().toUpperCase() as (typeof DAY_CODES)[number]))
      .filter((index) => index >= 0);
    return { freq: "WEEKLY", byWeekday: days.length ? days : undefined };
  }
  return null;
}

export function formatRecurrence(
  rule: string | null | undefined,
  recurrenceUntil?: Date | null,
  timeZone = "UTC",
): string {
  const parsed = parseRecurrence(rule);
  if (!parsed) return "Does not repeat";
  const label =
    parsed.freq === "DAILY"
      ? "Every day"
      : !parsed.byWeekday?.length
        ? "Every week"
        : `Every ${parsed.byWeekday.map((day) => DAY_LABELS[day]).join(", ")}`;
  if (!recurrenceUntil) return label;
  const through = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(recurrenceUntil);
  return `${label} through ${through}`;
}

export function ruleFromWeekdays(weekdays: number[]): string {
  if (!weekdays.length) return "WEEKLY";
  return `WEEKLY:${weekdays.map((day) => DAY_CODES[day]).join(",")}`;
}

export interface RecurrenceSource {
  start: Date;
  end: Date;
  recurrence: string | null;
  recurrenceUntil: Date | null;
}

/**
 * Expand an event into concrete occurrences that intersect the range.
 * The first occurrence is always the event's own start time.
 */
export function expandOccurrences(
  source: RecurrenceSource,
  rangeStart: Date,
  rangeEnd: Date,
  timeZone: string,
): { start: Date; end: Date }[] {
  const durationMs = source.end.getTime() - source.start.getTime();
  const rule = parseRecurrence(source.recurrence);

  if (!rule) {
    return source.start < rangeEnd && source.end > rangeStart
      ? [{ start: source.start, end: source.end }]
      : [];
  }

  const baseLocal = utcToZoned(source.start, timeZone);
  const lastDay = source.recurrenceUntil ? dayKey(source.recurrenceUntil, timeZone) : null;

  const occurrences: { start: Date; end: Date }[] = [];
  let cursor = startOfZonedDay(rangeStart, timeZone);
  let guard = 0;

  while (cursor <= rangeEnd && guard < 800) {
    guard += 1;
    const local = utcToZoned(cursor, timeZone);
    const matches =
      rule.freq === "DAILY"
        ? true
        : (rule.byWeekday?.length ? rule.byWeekday.includes(local.weekday) : local.weekday === baseLocal.weekday);

    if (matches) {
      const start = zonedToUtc(
        {
          year: local.year,
          month: local.month,
          day: local.day,
          hour: baseLocal.hour,
          minute: baseLocal.minute,
        },
        timeZone,
      );
      const end = new Date(start.getTime() + durationMs);
      const notBeforeSeries = start.getTime() >= startOfZonedDay(source.start, timeZone).getTime();
      const withinSeries = !lastDay || dayKey(start, timeZone) <= lastDay;
      if (notBeforeSeries && withinSeries && start < rangeEnd && end > rangeStart) {
        occurrences.push({ start, end });
      }
    }

    cursor = addZonedDays(cursor, 1, timeZone);
  }

  return occurrences;
}

export function recurrenceDayKey(start: Date, timeZone: string): string {
  return dayKey(start, timeZone);
}

/** True when a wall-clock time in `timeZone` is inside DST-shifted hours. */
export function isDstShift(date: Date, timeZone: string): boolean {
  const offset = tzOffsetMs(date, timeZone);
  const later = tzOffsetMs(new Date(date.getTime() + 24 * 3600 * 1000), timeZone);
  return offset !== later;
}
