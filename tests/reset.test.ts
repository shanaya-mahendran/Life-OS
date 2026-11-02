import { describe, expect, it } from "vitest";
import {
  calculateAdherence,
  currentStreak,
  detectDrift,
  dueReviewPeriods,
  longestStreak,
  buildGapDraft,
  goalPercent,
  nextReviewPeriod,
  phaseForPlanDay,
  planDayNumber,
  progressPercent,
  reviewPeriod,
  shortQuote,
} from "@/lib/reset/calc";

const day = (key: string, result: string, commitmentId = "c1") => ({ dateKey: key, result, commitmentId });

describe("plan day and phases", () => {
  const start = new Date("2026-01-01T12:00:00Z");

  it("counts day 1 as the approval day", () => {
    expect(planDayNumber(start, new Date("2026-01-01T20:00:00Z"), "UTC")).toBe(1);
    expect(planDayNumber(start, new Date("2026-01-02T08:00:00Z"), "UTC")).toBe(2);
    expect(planDayNumber(start, new Date("2026-03-31T08:00:00Z"), "UTC")).toBe(90);
  });

  it("caps the program at 90 days", () => {
    expect(planDayNumber(start, new Date("2026-06-01T00:00:00Z"), "UTC")).toBe(90);
    expect(progressPercent(90)).toBe(100);
    expect(progressPercent(120)).toBe(100);
  });

  it("maps days to the three phases", () => {
    expect(phaseForPlanDay(1).phase).toBe(1);
    expect(phaseForPlanDay(30).phase).toBe(1);
    expect(phaseForPlanDay(31).phase).toBe(2);
    expect(phaseForPlanDay(60).phase).toBe(2);
    expect(phaseForPlanDay(61).phase).toBe(3);
    expect(phaseForPlanDay(90).phase).toBe(3);
  });
});

describe("review schedule", () => {
  it("has three 15-day reviews and three monthly/final reports", () => {
    const periods = dueReviewPeriods(90);
    expect(periods).toHaveLength(6);
    expect(periods.map((entry) => entry.kind)).toEqual([
      "review15",
      "month",
      "review15",
      "month",
      "review15",
      "final",
    ]);
    expect(periods[1].periodStartDay).toBe(1);
    expect(periods[1].periodEndDay).toBe(30);
    expect(periods[5].periodStartDay).toBe(61);
  });

  it("does not expose future reviews", () => {
    expect(dueReviewPeriods(14)).toHaveLength(0);
    expect(dueReviewPeriods(15).map((entry) => entry.day)).toEqual([15]);
    expect(dueReviewPeriods(31).map((entry) => entry.day)).toEqual([15, 30]);
    expect(nextReviewPeriod(31)?.day).toBe(45);
    expect(nextReviewPeriod(90)).toBeNull();
  });

  it("labels monthly and final periods", () => {
    expect(reviewPeriod(30).label).toContain("Month 1");
    expect(reviewPeriod(60).label).toContain("Month 2");
    expect(reviewPeriod(90).label).toContain("Final");
  });
});

describe("adherence and streaks", () => {
  it("computes done / skipped / missed", () => {
    const stats = calculateAdherence([day("2026-01-01", "done"), day("2026-01-02", "missed"), day("2026-01-03", "skipped")]);
    expect(stats).toEqual({ done: 1, missed: 1, skipped: 1, total: 3, adherence: 33 });
    expect(calculateAdherence([])).toEqual({ done: 0, missed: 0, skipped: 0, total: 0, adherence: 0 });
  });

  it("counts a streak ending today or yesterday", () => {
    const keys = ["2026-01-01", "2026-01-02", "2026-01-03"];
    expect(currentStreak(keys, "2026-01-03")).toBe(3);
    expect(currentStreak(keys, "2026-01-04")).toBe(3);
    expect(currentStreak(keys, "2026-01-05")).toBe(0);
    expect(currentStreak([], "2026-01-05")).toBe(0);
  });

  it("finds the longest streak", () => {
    expect(longestStreak(["2026-01-01", "2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07"])).toBe(3);
  });
});

describe("drift", () => {
  const commitments = [
    { id: "c1", title: "Morning routine", kind: "routine", phase: 2, status: "active", cadence: "daily" },
    { id: "c2", title: "Deep work", kind: "nonnegotiable", phase: 2, status: "active", cadence: "daily" },
  ];

  it("flags three misses in a row", () => {
    const records = [
      day("2026-01-01", "missed"),
      day("2026-01-02", "missed"),
      day("2026-01-03", "missed"),
    ];
    const drift = detectDrift(commitments, records, "2026-01-03");
    expect(drift).toHaveLength(1);
    expect(drift[0].reason).toBe("three_misses");
  });

  it("flags under 50% over seven days", () => {
    const records = [
      day("2026-01-01", "done", "c2"),
      day("2026-01-02", "missed", "c2"),
      day("2026-01-04", "missed", "c2"),
      day("2026-01-05", "missed", "c2"),
      day("2026-01-07", "done", "c2"),
    ];
    const drift = detectDrift(commitments, records, "2026-01-07");
    expect(drift.some((entry) => entry.commitmentId === "c2" && entry.reason === "low_adherence")).toBe(true);
  });

  it("stays quiet when the pattern is healthy", () => {
    const records = [
      day("2026-01-01", "done"),
      day("2026-01-02", "done"),
      day("2026-01-03", "done"),
    ];
    expect(detectDrift(commitments, records, "2026-01-03")).toEqual([]);
  });
});

describe("goals", () => {
  it("clamps percentage between 0 and 100", () => {
    expect(goalPercent(5, 10)).toBe(50);
    expect(goalPercent(10, 10)).toBe(100);
    expect(goalPercent(20, 10)).toBe(100);
    expect(goalPercent(-3, 10)).toBe(0);
    expect(goalPercent(4, 0)).toBe(0);
  });
});

describe("gap report", () => {
  it("quotes the audit and finds focus areas", () => {
    const report = buildGapDraft(
      [
        {
          step: 1,
          answer:
            "I wake up late and start the day on my phone. My money disappears before the end of the month. I have not trained in weeks.",
        },
        {
          step: 2,
          answer:
            "Up at 6:30 without snoozing. Two deep-work blocks before lunch. One finance review a week and karate twice a week.",
        },
        { step: 3, answer: "A late night breaks the morning and the whole plan collapses. I quit quietly." },
      ],
      { checkinTime: "20:30" },
    );

    expect(report.summary).toContain("I wake up late");
    expect(report.cutCandidates.length).toBeGreaterThan(0);
    expect(report.anchorCandidates).toContain("Evening check-in at 20:30");
    expect(report.topGaps.length).toBeGreaterThan(0);
    expect(report.patterns.length).toBeGreaterThan(0);
  });

  it("shortens long quotes without cutting mid-word", () => {
    const quote = shortQuote("one two three four five six seven eight nine ten", 20);
    expect(quote.endsWith("…")).toBe(true);
    expect(quote.length).toBeLessThanOrEqual(21);
  });
});
