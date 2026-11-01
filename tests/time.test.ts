import { describe, expect, it } from "vitest";
import {
  addZonedDays,
  dayKey,
  humanizeMinutes,
  minutesBetween,
  startOfWeekMonday,
  startOfZonedDay,
  utcToZoned,
  zonedToUtc,
} from "@/lib/time";

describe("zonedToUtc / utcToZoned", () => {
  it("round-trips a wall clock time in Asia/Kolkata", () => {
    const utc = zonedToUtc({ year: 2026, month: 11, day: 3, hour: 19, minute: 30 }, "Asia/Kolkata");
    const local = utcToZoned(utc, "Asia/Kolkata");

    expect(local.year).toBe(2026);
    expect(local.month).toBe(11);
    expect(local.day).toBe(3);
    expect(local.hour).toBe(19);
    expect(local.minute).toBe(30);
  });

  it("maps 7 PM IST to 13:30 UTC", () => {
    const utc = zonedToUtc({ year: 2026, month: 11, day: 3, hour: 19, minute: 0 }, "Asia/Kolkata");
    expect(utc.toISOString()).toBe("2026-11-03T13:30:00.000Z");
  });

  it("keeps the local hour when adding days across a DST boundary", () => {
    // US DST starts on 8 March 2026.
    const before = zonedToUtc({ year: 2026, month: 3, day: 7, hour: 19, minute: 0 }, "America/New_York");
    const after = addZonedDays(before, 2, "America/New_York");
    const local = utcToZoned(after, "America/New_York");

    expect(local.day).toBe(9);
    expect(local.hour).toBe(19);
  });
});

describe("day boundaries", () => {
  it("starts the week on Monday", () => {
    const wednesday = zonedToUtc({ year: 2026, month: 11, day: 4, hour: 15 }, "Asia/Kolkata");
    const monday = startOfWeekMonday(wednesday, "Asia/Kolkata");
    const local = utcToZoned(monday, "Asia/Kolkata");

    expect(local.weekday).toBe(1);
    expect(local.day).toBe(2);
    expect(local.hour).toBe(0);
  });

  it("starts the week on the same Monday for a Sunday", () => {
    const sunday = zonedToUtc({ year: 2026, month: 11, day: 8, hour: 22 }, "Asia/Kolkata");
    const local = utcToZoned(startOfWeekMonday(sunday, "Asia/Kolkata"), "Asia/Kolkata");
    expect(local.day).toBe(2);
  });

  it("produces stable day keys", () => {
    const instant = zonedToUtc({ year: 2026, month: 11, day: 3, hour: 0, minute: 30 }, "Asia/Kolkata");
    expect(dayKey(instant, "Asia/Kolkata")).toBe("2026-11-03");
  });

  it("measures minutes between instants", () => {
    const start = new Date("2026-11-03T09:00:00Z");
    const end = new Date("2026-11-03T10:30:00Z");
    expect(minutesBetween(start, end)).toBe(90);
  });

  it("handles a day that begins at midnight", () => {
    const instant = new Date("2026-11-03T18:45:00Z");
    const start = startOfZonedDay(instant, "Asia/Kolkata");
    const local = utcToZoned(start, "Asia/Kolkata");
    expect(local.hour).toBe(0);
    expect(local.minute).toBe(0);
    expect(local.day).toBe(4);
  });
});

describe("humanizeMinutes", () => {
  it("formats minutes and hours", () => {
    expect(humanizeMinutes(30)).toBe("30m");
    expect(humanizeMinutes(60)).toBe("1h");
    expect(humanizeMinutes(95)).toBe("1h 35m");
  });
});
