import {
  addZonedDays,
  dayKey,
  startOfMonth,
  startOfWeekMonday,
  utcToZoned,
  zonedToUtc,
  endOfMonth,
} from "@/lib/time";

export interface DayCell {
  key: string;
  startISO: string;
  dayNumber: number;
  weekdayShort: string;
  isToday: boolean;
  inMonth: boolean;
}

const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function buildDayCells(from: Date, count: number, timeZone: string, monthOf?: number): DayCell[] {
  const todayKey = dayKey(new Date(), timeZone);
  return Array.from({ length: count }, (_, index) => {
    const day = addZonedDays(from, index, timeZone);
    const local = utcToZoned(day, timeZone);
    const start = zonedToUtc({ year: local.year, month: local.month, day: local.day }, timeZone);
    return {
      key: `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`,
      startISO: start.toISOString(),
      dayNumber: local.day,
      weekdayShort: SHORT[local.weekday],
      isToday: dayKey(start, timeZone) === todayKey,
      inMonth: monthOf === undefined ? true : local.month === monthOf,
    };
  });
}

export function weekCells(anchor: Date, timeZone: string): DayCell[] {
  const monday = startOfWeekMonday(anchor, timeZone);
  return buildDayCells(monday, 7, timeZone);
}

export function monthCells(anchor: Date, timeZone: string): DayCell[] {
  const monthStart = startOfMonth(anchor, timeZone);
  const monthLocal = utcToZoned(monthStart, timeZone);
  const gridStart = startOfWeekMonday(monthStart, timeZone);
  const lastDay = endOfMonth(anchor, timeZone);
  const lastLocal = utcToZoned(lastDay, timeZone);
  const endGrid = startOfWeekMonday(addZonedDays(lastDay, 7, timeZone), timeZone);
  const total = Math.round((endGrid.getTime() - gridStart.getTime()) / (24 * 3600 * 1000));
  const cells = buildDayCells(gridStart, Math.max(35, Math.min(42, total)), timeZone, monthLocal.month);
  void lastLocal;
  return cells;
}

/** Minutes from midnight for an instant, in the viewer's timezone. */
export function minutesOfDay(iso: string, timeZone: string): number {
  const local = utcToZoned(new Date(iso), timeZone);
  return local.hour * 60 + local.minute;
}

export function timeLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function rangeLabel(startISO: string, endISO: string, timeZone: string): string {
  return `${timeLabel(startISO, timeZone)} – ${timeLabel(endISO, timeZone)}`;
}

export function dayLabel(iso: string, timeZone: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    ...options,
  }).format(new Date(iso));
}

export function monthYearLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "long", year: "numeric" }).format(new Date(iso));
}

export function weekRangeLabel(days: DayCell[], timeZone: string): string {
  if (!days.length) return "";
  const first = days[0];
  const last = days[days.length - 1];
  const firstLabel = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  }).format(new Date(first.startISO));
  const lastLabel = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(last.startISO));
  return `${firstLabel} – ${lastLabel}`;
}

export { startOfWeekMonday, addZonedDays, dayKey, utcToZoned, zonedToUtc };
