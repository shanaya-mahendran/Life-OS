import { describe, expect, it } from "vitest";
import { findFreeSlots } from "@/lib/calendar/free-slots";
import { utcToZoned } from "@/lib/time";

const at = (iso: string) => new Date(iso);
const TZ = "UTC";

function hourOf(iso: string) {
  return utcToZoned(new Date(iso), TZ).hour;
}

const monday = at("2026-11-02T00:00:00Z");
const tuesday = at("2026-11-03T00:00:00Z");

describe("findFreeSlots", () => {
  it("finds the gap between two busy blocks", () => {
    const slots = findFreeSlots({
      rangeStart: monday,
      rangeEnd: tuesday,
      timeZone: TZ,
      dayStartHour: 8,
      dayEndHour: 18,
      durationMinutes: 60,
      bufferMinutes: 0,
      busy: [
        { start: at("2026-11-02T09:00:00Z"), end: at("2026-11-02T10:00:00Z") },
        { start: at("2026-11-02T11:00:00Z"), end: at("2026-11-02T12:00:00Z") },
      ],
      maxSlots: 3,
    });

    expect(slots.length).toBeGreaterThanOrEqual(2);
    expect(hourOf(slots[0].start.toISOString())).toBe(8);
    expect(hourOf(slots[0].end.toISOString())).toBe(9);
    expect(hourOf(slots[1].start.toISOString())).toBe(10);
  });

  it("respects the working window", () => {
    const slots = findFreeSlots({
      rangeStart: monday,
      rangeEnd: tuesday,
      timeZone: TZ,
      dayStartHour: 9,
      dayEndHour: 12,
      durationMinutes: 60,
      bufferMinutes: 0,
      busy: [],
      maxSlots: 5,
    });

    expect(slots[0].start.toISOString()).toBe("2026-11-02T09:00:00.000Z");
    expect(slots.length).toBeGreaterThanOrEqual(2);
    for (const slot of slots) {
      expect(slot.start.getTime()).toBeGreaterThanOrEqual(new Date("2026-11-02T09:00:00Z").getTime());
      expect(slot.end.getTime()).toBeLessThanOrEqual(new Date("2026-11-02T12:00:00Z").getTime());
      expect(slot.end.getTime() - slot.start.getTime()).toBe(60 * 60_000);
    }
  });

  it("returns nothing when the day is full", () => {
    const slots = findFreeSlots({
      rangeStart: monday,
      rangeEnd: tuesday,
      timeZone: TZ,
      dayStartHour: 9,
      dayEndHour: 17,
      durationMinutes: 60,
      bufferMinutes: 0,
      busy: [{ start: at("2026-11-02T08:00:00Z"), end: at("2026-11-02T18:00:00Z") }],
      maxSlots: 2,
    });

    expect(slots).toHaveLength(0);
  });

  it("skips days the user is unavailable", () => {
    const slots = findFreeSlots({
      rangeStart: monday,
      rangeEnd: at("2026-11-09T00:00:00Z"),
      timeZone: TZ,
      dayStartHour: 9,
      dayEndHour: 17,
      durationMinutes: 60,
      bufferMinutes: 0,
      busy: [],
      skipWeekdays: [1, 2, 3, 4, 5, 6],
      maxSlots: 3,
    });

    expect(slots.length).toBeGreaterThanOrEqual(1);
    expect(slots.every((slot) => utcToZoned(slot.start, TZ).weekday === 0)).toBe(true);
    expect(slots[0].start.toISOString()).toBe("2026-11-08T09:00:00.000Z");
  });

  it("never returns a slot shorter than the requested duration", () => {
    const slots = findFreeSlots({
      rangeStart: monday,
      rangeEnd: tuesday,
      timeZone: TZ,
      dayStartHour: 9,
      dayEndHour: 17,
      durationMinutes: 120,
      bufferMinutes: 0,
      busy: [
        { start: at("2026-11-02T09:00:00Z"), end: at("2026-11-02T12:00:00Z") },
        { start: at("2026-11-02T14:00:00Z"), end: at("2026-11-02T17:00:00Z") },
      ],
      maxSlots: 3,
    });

    expect(slots).toHaveLength(1);
    expect(slots[0].start.toISOString()).toBe("2026-11-02T12:00:00.000Z");
    expect(slots[0].end.toISOString()).toBe("2026-11-02T14:00:00.000Z");
  });

  it("applies the buffer around busy blocks", () => {
    const slots = findFreeSlots({
      rangeStart: monday,
      rangeEnd: tuesday,
      timeZone: TZ,
      dayStartHour: 9,
      dayEndHour: 12,
      durationMinutes: 60,
      bufferMinutes: 15,
      busy: [{ start: at("2026-11-02T09:00:00Z"), end: at("2026-11-02T10:00:00Z") }],
      maxSlots: 2,
    });

    expect(slots).toHaveLength(1);
    expect(slots[0].start.toISOString()).toBe("2026-11-02T10:30:00.000Z");
  });

  it("caps the number of returned suggestions", () => {
    const slots = findFreeSlots({
      rangeStart: monday,
      rangeEnd: at("2026-11-09T00:00:00Z"),
      timeZone: TZ,
      dayStartHour: 8,
      dayEndHour: 20,
      durationMinutes: 60,
      bufferMinutes: 0,
      busy: [],
      maxSlots: 3,
    });

    expect(slots).toHaveLength(3);
  });
});
