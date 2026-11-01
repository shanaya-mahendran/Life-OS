/**
 * Free-slot search.
 *
 * Walks day by day inside the user's working window, subtracts busy blocks
 * (padded by a buffer), and returns usable slots in order. Pure functions.
 */

import { addZonedDays, startOfZonedDay, utcToZoned, zonedToUtc, MS_MINUTE } from "@/lib/time";
import type { TimeBlock } from "@/lib/calendar/types";

export interface FreeSlotOptions {
  rangeStart: Date;
  rangeEnd: Date;
  timeZone: string;
  /** Hour of day the user is willing to work, 0-23. */
  dayStartHour?: number;
  dayEndHour?: number;
  busy: TimeBlock[];
  durationMinutes: number;
  granularityMinutes?: number;
  bufferMinutes?: number;
  /** 0 = Sunday … 6 = Saturday */
  skipWeekdays?: number[];
  maxSlots?: number;
}

export interface FreeSlot {
  start: Date;
  end: Date;
  dateKey: string;
}

/** Breathing room kept between two suggested slots on the same day. */
const SLOT_SPACING_MINUTES = 15;

function mergeBusy(blocks: TimeBlock[], bufferMinutes: number): TimeBlock[] {
  const padded = blocks
    .map((block) => ({
      start: new Date(block.start.getTime() - bufferMinutes * MS_MINUTE),
      end: new Date(block.end.getTime() + bufferMinutes * MS_MINUTE),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: TimeBlock[] = [];
  for (const block of padded) {
    const last = merged[merged.length - 1];
    if (last && block.start.getTime() <= last.end.getTime()) {
      if (block.end.getTime() > last.end.getTime()) last.end = block.end;
    } else {
      merged.push({ ...block });
    }
  }
  return merged;
}

function alignUp(value: number, base: number, step: number): number {
  const offset = (value - base) % step;
  return offset === 0 ? value : value + (step - offset);
}

export function findFreeSlots(options: FreeSlotOptions): FreeSlot[] {
  const {
    rangeStart,
    rangeEnd,
    timeZone,
    dayStartHour = 7,
    dayEndHour = 22,
    durationMinutes,
    granularityMinutes = 30,
    bufferMinutes = 10,
    skipWeekdays = [],
    maxSlots = 12,
  } = options;

  if (durationMinutes <= 0) return [];

  const busy = mergeBusy(options.busy, bufferMinutes);
  const durationMs = durationMinutes * MS_MINUTE;
  const granularityMs = granularityMinutes * MS_MINUTE;
  const spacingMs = SLOT_SPACING_MINUTES * MS_MINUTE;

  const slots: FreeSlot[] = [];
  let cursor = startOfZonedDay(rangeStart, timeZone);
  let guard = 0;

  while (cursor < rangeEnd && guard < 60 && slots.length < maxSlots) {
    guard += 1;
    const local = utcToZoned(cursor, timeZone);

    if (!skipWeekdays.includes(local.weekday)) {
      const windowStart = zonedToUtc(
        { year: local.year, month: local.month, day: local.day, hour: dayStartHour },
        timeZone,
      ).getTime();
      const windowEnd = zonedToUtc(
        { year: local.year, month: local.month, day: local.day, hour: dayEndHour },
        timeZone,
      ).getTime();
      const hardEnd = Math.min(windowEnd, rangeEnd.getTime());
      const dateKey = `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;

      const dayBusy = busy.filter(
        (block) => block.end.getTime() > windowStart && block.start.getTime() < windowEnd,
      );

      let slotCursor = alignUp(Math.max(windowStart, rangeStart.getTime()), windowStart, granularityMs);
      let safety = 0;

      while (slotCursor + durationMs <= hardEnd && slots.length < maxSlots && safety < 24) {
        safety += 1;

        const clash = dayBusy.find(
          (block) => block.start.getTime() < slotCursor + durationMs && block.end.getTime() > slotCursor,
        );

        if (!clash) {
          slots.push({
            start: new Date(slotCursor),
            end: new Date(slotCursor + durationMs),
            dateKey,
          });
          slotCursor = alignUp(slotCursor + durationMs + spacingMs, windowStart, granularityMs);
        } else {
          // Move past the blocking event, always making forward progress.
          slotCursor = alignUp(
            Math.max(clash.end.getTime(), slotCursor + MS_MINUTE),
            windowStart,
            granularityMs,
          );
        }
      }
    }

    cursor = addZonedDays(cursor, 1, timeZone);
  }

  return slots.slice(0, maxSlots);
}

/** Convenience: the next single free slot of a given length. */
export function nextFreeSlot(options: FreeSlotOptions): FreeSlot | null {
  const [slot] = findFreeSlots({ ...options, maxSlots: 1 });
  return slot ?? null;
}
