import { describe, expect, it } from "vitest";
import { expandOccurrences, formatRecurrence, parseRecurrence } from "@/lib/calendar/recurrence";
import { utcToZoned } from "@/lib/time";

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

  it("stops at the recurrence end date", () => {
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

    expect(occurrences).toHaveLength(2);
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
