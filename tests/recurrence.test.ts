import { describe, expect, it } from "vitest";
import { expandOccurrences, formatRecurrence, parseRecurrence } from "@/lib/calendar/recurrence";
import { dayKey, utcToZoned } from "@/lib/time";

const TZ = "UTC";

describe("parseRecurrence", () => {
  it("parses daily rules", () => {
    expect(parseRecurrence("DAILY")).toEqual({ freq: "DAILY" });
  });

  it("parses weekday lists", () => {
    expect(parseRecurrence("WEEKLY:MO,WE,FR")).toEqual({ freq: "WEEKLY", byWeekday: [1, 3, 5] });
  });

  it("ignores nonsense", () => {
    expect(parseRecurrence("sometimes")).toBeNull();
    expect(parseRecurrence(null)).toBeNull();
  });
});

describe("formatRecurrence", () => {
  it("labels weekly rules", () => {
    expect(formatRecurrence("WEEKLY:MO,WE,FR")).toBe("Every Mon, Wed, Fri");
    expect(formatRecurrence("DAILY")).toBe("Every day");
    expect(formatRecurrence(null)).toBe("Does not repeat");
    expect(formatRecurrence("DAILY", new Date("2026-11-15T00:00:00Z"), TZ)).toBe("Every day through Nov 15, 2026");
  });
});

describe("expandOccurrences", () => {
  it("returns the single occurrence of a non-recurring event", () => {
    const occurrences = expandOccurrences(
      {
        start: new Date("2026-11-03T09:00:00Z"),
        end: new Date("2026-11-03T10:00:00Z"),
        recurrence: null,
        recurrenceUntil: null,
      },
      new Date("2026-11-02T00:00:00Z"),
      new Date("2026-11-09T00:00:00Z"),
      TZ,
    );

    expect(occurrences).toHaveLength(1);
  });

  it("drops a non-recurring event outside the range", () => {
    const occurrences = expandOccurrences(
      {
        start: new Date("2026-10-01T09:00:00Z"),
        end: new Date("2026-10-01T10:00:00Z"),
        recurrence: null,
        recurrenceUntil: null,
      },
      new Date("2026-11-02T00:00:00Z"),
      new Date("2026-11-09T00:00:00Z"),
      TZ,
    );

    expect(occurrences).toHaveLength(0);
  });

  it("expands a Mon/Wed/Fri series", () => {
    // 2 Nov 2026 is a Monday.
    const occurrences = expandOccurrences(
      {
        start: new Date("2026-11-02T19:00:00Z"),
        end: new Date("2026-11-02T20:00:00Z"),
        recurrence: "WEEKLY:MO,WE,FR",
        recurrenceUntil: null,
      },
      new Date("2026-11-02T00:00:00Z"),
      new Date("2026-11-09T00:00:00Z"),
      TZ,
    );

    expect(occurrences.map((occurrence) => utcToZoned(occurrence.start, TZ).day)).toEqual([2, 4, 6]);
    expect(occurrences.every((occurrence) => utcToZoned(occurrence.start, TZ).hour === 19)).toBe(true);
  });

  it("includes the full recurrence end date and stops before the next day", () => {
    const occurrences = expandOccurrences(
      {
        start: new Date("2026-11-02T07:00:00Z"),
        end: new Date("2026-11-02T07:30:00Z"),
        recurrence: "DAILY",
        recurrenceUntil: new Date("2026-11-04T00:00:00Z"),
      },
      new Date("2026-11-02T00:00:00Z"),
      new Date("2026-11-09T00:00:00Z"),
      TZ,
    );

    expect(occurrences).toHaveLength(3);
    expect(occurrences.map((occurrence) => dayKey(occurrence.start, TZ))).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
    ]);
  });

  it("includes a daily 7–9 PM ICT FINAL PROJECT through November 15, not November 16", () => {
    const timeZone = "Asia/Kolkata";
    const occurrences = expandOccurrences(
      {
        start: new Date("2026-11-04T13:30:00Z"),
        end: new Date("2026-11-04T15:30:00Z"),
        recurrence: "DAILY",
        recurrenceUntil: new Date("2026-11-14T18:30:00Z"),
      },
      new Date("2026-11-03T18:30:00Z"),
      new Date("2026-11-17T18:30:00Z"),
      timeZone,
    );

    expect(occurrences).toHaveLength(12);
    expect(dayKey(occurrences[0].start, timeZone)).toBe("2026-11-04");
    expect(dayKey(occurrences.at(-1)!.start, timeZone)).toBe("2026-11-15");
    expect(occurrences.every((occurrence) => utcToZoned(occurrence.start, timeZone).hour === 19)).toBe(true);
    expect(occurrences.every((occurrence) => utcToZoned(occurrence.end, timeZone).hour === 21)).toBe(true);
    expect(formatRecurrence("DAILY", new Date("2026-11-14T18:30:00Z"), timeZone)).toBe(
      "Every day through Nov 15, 2026",
    );
  });

  it("uses the local calendar date as the cutoff across a DST transition", () => {
    const timeZone = "America/New_York";
    const occurrences = expandOccurrences(
      {
        start: new Date("2026-10-31T13:00:00Z"),
        end: new Date("2026-10-31T14:00:00Z"),
        recurrence: "DAILY",
        recurrenceUntil: new Date("2026-11-01T04:00:00Z"),
      },
      new Date("2026-10-31T04:00:00Z"),
      new Date("2026-11-03T05:00:00Z"),
      timeZone,
    );

    expect(occurrences.map((occurrence) => dayKey(occurrence.start, timeZone))).toEqual(["2026-10-31", "2026-11-01"]);
    expect(occurrences.map((occurrence) => utcToZoned(occurrence.start, timeZone).hour)).toEqual([9, 9]);
  });

  it("keeps the wall clock time across a DST change", () => {
    const occurrences = expandOccurrences(
      {
        start: new Date("2026-03-07T14:00:00Z"), // 09:00 New York
        end: new Date("2026-03-07T15:00:00Z"),
        recurrence: "DAILY",
        recurrenceUntil: null,
      },
      new Date("2026-03-07T00:00:00Z"),
      new Date("2026-03-10T00:00:00Z"),
      "America/New_York",
    );

    expect(occurrences.every((occurrence) => utcToZoned(occurrence.start, "America/New_York").hour === 9)).toBe(true);
  });
});
