/**
 * Timezone helpers.
 *
 * Events are stored in UTC; people think in their own timezone. These helpers
 * convert between the two without pulling in a date library, and are careful
 * about DST boundaries because the planner reasons about "days" and "hours".
 */

export const MS_MINUTE = 60_000;
export const MS_HOUR = 3_600_000;
export const MS_DAY = 86_400_000;

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Offset of `timeZone` at `date`, in milliseconds (local minus UTC). */
export function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const grab = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const asUtc = Date.UTC(
    Number(grab("year")),
    Number(grab("month")) - 1,
    Number(grab("day")),
    Number(grab("hour")) % 24,
    Number(grab("minute")),
    Number(grab("second")),
  );
  return asUtc - date.getTime();
}

/** Read a UTC instant as wall-clock parts in `timeZone`. */
export function utcToZoned(date: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const grab = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const weekdayName = grab("weekday");
  return {
    year: Number(grab("year")),
    month: Number(grab("month")),
    day: Number(grab("day")),
    hour: Number(grab("hour")) % 24,
    minute: Number(grab("minute")),
    second: Number(grab("second")),
    weekday: Math.max(0, WEEKDAYS.indexOf(weekdayName)),
  };
}

/** Build a UTC instant from wall-clock parts in `timeZone`. */
export function zonedToUtc(
  parts: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
  timeZone: string,
): Date {
  const guess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
  const firstOffset = tzOffsetMs(new Date(guess), timeZone);
  let timestamp = guess - firstOffset;
  // Refine once so DST transitions land on the right side of the boundary.
  const secondOffset = tzOffsetMs(new Date(timestamp), timeZone);
  if (secondOffset !== firstOffset) {
    timestamp = guess - secondOffset;
  }
  return new Date(timestamp);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MS_MINUTE);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_DAY);
}

export function minutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_MINUTE);
}

export function differenceInMinutes(start: Date, end: Date): number {
  return minutesBetween(start, end);
}

/** yyyy-mm-dd key for a UTC instant in a given timezone. */
export function dayKey(date: Date, timeZone: string): string {
  const z = utcToZoned(date, timeZone);
  return `${z.year}-${String(z.month).padStart(2, "0")}-${String(z.day).padStart(2, "0")}`;
}

export function parseDayKey(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

/** Midnight at the start of the day containing `date`, in `timeZone`. */
export function startOfZonedDay(date: Date, timeZone: string): Date {
  const z = utcToZoned(date, timeZone);
  return zonedToUtc({ year: z.year, month: z.month, day: z.day }, timeZone);
}

/** Midnight at the start of the day after the one containing `date`. */
export function startOfNextZonedDay(date: Date, timeZone: string): Date {
  const z = utcToZoned(date, timeZone);
  const next = new Date(Date.UTC(z.year, z.month - 1, z.day + 1));
  return zonedToUtc(
    { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() },
    timeZone,
  );
}

export function addZonedDays(date: Date, days: number, timeZone: string): Date {
  const z = utcToZoned(date, timeZone);
  const shifted = new Date(Date.UTC(z.year, z.month - 1, z.day + days));
  return zonedToUtc(
    {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: z.hour,
      minute: z.minute,
    },
    timeZone,
  );
}

/** Monday-based week start (ISO). */
export function startOfWeekMonday(date: Date, timeZone: string): Date {
  const z = utcToZoned(date, timeZone);
  const mondayIndex = (z.weekday + 6) % 7;
  const shifted = new Date(Date.UTC(z.year, z.month - 1, z.day - mondayIndex));
  return zonedToUtc(
    { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() },
    timeZone,
  );
}

/** 0 = Monday … 6 = Sunday */
export function mondayIndex(date: Date, timeZone: string): number {
  return (utcToZoned(date, timeZone).weekday + 6) % 7;
}

export function startOfMonth(date: Date, timeZone: string): Date {
  const z = utcToZoned(date, timeZone);
  return zonedToUtc({ year: z.year, month: z.month, day: 1 }, timeZone);
}

export function endOfMonth(date: Date, timeZone: string): Date {
  const z = utcToZoned(date, timeZone);
  const next = new Date(Date.UTC(z.year, z.month, 1));
  return new Date(
    zonedToUtc(
      { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() },
      timeZone,
    ).getTime() - 1,
  );
}

/** "07:30" → 450 */
export function hmToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/** 450 → "07:30" */
export function minutesToHm(total: number): string {
  const safe = ((total % 1440) + 1440) % 1440;
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatInZone(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" },
): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, ...options }).format(date);
}

export function timeRangeLabel(start: Date, end: Date, timeZone: string): string {
  return `${formatInZone(start, timeZone, { hour: "numeric", minute: "2-digit" })} – ${formatInZone(
    end,
    timeZone,
    { hour: "numeric", minute: "2-digit" },
  )}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function humanizeMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
