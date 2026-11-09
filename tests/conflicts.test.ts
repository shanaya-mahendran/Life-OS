import { describe, expect, it } from "vitest";
import { findConflicts, hasBlockingConflict, needsConfirmation, overlapMinutes, overlaps } from "@/lib/calendar/conflicts";

const at = (iso: string) => new Date(iso);

function makeEvent(id: string, title: string, start: string, end: string, domainSlug = "education") {
  return { id, title, domainSlug, start: at(start), end: at(end) };
}

describe("overlaps", () => {
  it("detects a plain overlap", () => {
    expect(overlaps({ start: at("2026-11-03T09:00:00Z"), end: at("2026-11-03T10:00:00Z") }, { start: at("2026-11-03T09:30:00Z"), end: at("2026-11-03T10:30:00Z") })).toBe(true);
  });

  it("treats touching blocks as not overlapping", () => {
    expect(overlaps({ start: at("2026-11-03T09:00:00Z"), end: at("2026-11-03T10:00:00Z") }, { start: at("2026-11-03T10:00:00Z"), end: at("2026-11-03T11:00:00Z") })).toBe(false);
  });

  it("counts overlap minutes", () => {
    expect(overlapMinutes({ start: at("2026-11-03T09:00:00Z"), end: at("2026-11-03T10:00:00Z") }, { start: at("2026-11-03T09:45:00Z"), end: at("2026-11-03T11:00:00Z") })).toBe(15);
  });

  it("handles a block that crosses midnight", () => {
    const sleep = { start: at("2026-11-03T23:00:00Z"), end: at("2026-11-04T07:00:00Z") };
    const late = { start: at("2026-11-04T06:00:00Z"), end: at("2026-11-04T07:30:00Z") };
    expect(overlaps(sleep, late)).toBe(true);
  });
});

describe("findConflicts", () => {
  it("blocks a direct double-booking", () => {
    const conflicts = findConflicts({
      candidate: { title: "Study", domainSlug: "education", start: at("2026-11-03T09:30:00Z"), end: at("2026-11-03T10:30:00Z") },
      existing: [makeEvent("e1", "Lecture", "2026-11-03T09:00:00Z", "2026-11-03T10:00:00Z")],
    });

    expect(conflicts.some((conflict) => conflict.code === "overlap")).toBe(true);
    expect(hasBlockingConflict(conflicts)).toBe(true);
    expect(needsConfirmation(conflicts)).toBe(true);
  });

  it("accepts a clean slot", () => {
    const conflicts = findConflicts({
      candidate: { title: "Study", domainSlug: "education", start: at("2026-11-03T14:00:00Z"), end: at("2026-11-03T15:00:00Z") },
      existing: [makeEvent("e1", "Lecture", "2026-11-03T09:00:00Z", "2026-11-03T10:00:00Z")],
      bufferMinutes: 15,
    });

    expect(conflicts).toHaveLength(0);
    expect(needsConfirmation(conflicts)).toBe(false);
  });

  it("flags protected sleep time", () => {
    const conflicts = findConflicts({
      candidate: { title: "Late build", domainSlug: "competitions", start: at("2026-11-03T23:30:00Z"), end: at("2026-11-04T01:00:00Z") },
      existing: [],
      protectedWindows: [
        { title: "Sleep", slug: "sleep", start: at("2026-11-03T23:00:00Z"), end: at("2026-11-04T07:00:00Z") },
      ],
    });

    expect(conflicts.some((conflict) => conflict.severity === "protected")).toBe(true);
    expect(needsConfirmation(conflicts)).toBe(true);
  });

  it("advises a buffer for back-to-back blocks without demanding confirmation", () => {
    const conflicts = findConflicts({
      candidate: { title: "Study", domainSlug: "education", start: at("2026-11-03T10:05:00Z"), end: at("2026-11-03T11:00:00Z") },
      existing: [makeEvent("e1", "Lecture", "2026-11-03T09:00:00Z", "2026-11-03T10:00:00Z")],
      bufferMinutes: 15,
    });

    expect(conflicts.some((conflict) => conflict.code === "back_to_back")).toBe(true);
    expect(needsConfirmation(conflicts)).toBe(false);
  });

  it("flags an overloaded day", () => {
    const conflicts = findConflicts({
      candidate: { title: "Study", domainSlug: "education", start: at("2026-11-03T18:00:00Z"), end: at("2026-11-03T20:00:00Z") },
      existing: [],
      plannedMinutesByDay: { "2026-11-03": 300 },
      maxFocusMinutes: 360,
      dayKeysTouched: ["2026-11-03"],
    });

    expect(conflicts.some((conflict) => conflict.code === "daily_overload")).toBe(true);
    expect(needsConfirmation(conflicts)).toBe(true);
  });

  it("ignores the event being edited", () => {
    const existing = makeEvent("e1", "Karate", "2026-11-03T19:00:00Z", "2026-11-03T20:00:00Z");
    const conflicts = findConflicts({
      candidate: { ...existing, start: at("2026-11-03T19:30:00Z"), end: at("2026-11-03T20:30:00Z") },
      existing: [existing],
      ignoreIds: ["e1"],
    });

    expect(conflicts.some((conflict) => conflict.severity === "blocking")).toBe(false);
  });

  it("rejects an inverted range", () => {
    const conflicts = findConflicts({
      candidate: { title: "Broken", domainSlug: "education", start: at("2026-11-03T10:00:00Z"), end: at("2026-11-03T09:00:00Z") },
      existing: [],
    });

    expect(conflicts[0].code).toBe("invalid_range");
  });

  it("defends Tier 1 anchors (medicine/prayer/sleep) against lower tier overlaps", () => {
    const doseAnchor = makeEvent("m1", "Morning Dose", "2026-11-03T08:00:00Z", "2026-11-03T08:15:00Z", "medicine");
    const conflicts = findConflicts({
      candidate: { title: "Study session", domainSlug: "education", start: at("2026-11-03T07:45:00Z"), end: at("2026-11-03T08:30:00Z") },
      existing: [doseAnchor],
    });

    expect(conflicts.some((c) => c.code === "tier_1_protected")).toBe(true);
    expect(needsConfirmation(conflicts)).toBe(true);
  });

  it("proposes moving lower-tier blocks when a Tier 1 anchor is scheduled", () => {
    const errand = makeEvent("a1", "Errand", "2026-11-03T12:00:00Z", "2026-11-03T13:00:00Z", "admin");
    const conflicts = findConflicts({
      candidate: { title: "Dhuhr Prayer", domainSlug: "prayer", start: at("2026-11-03T12:15:00Z"), end: at("2026-11-03T12:35:00Z") },
      existing: [errand],
    });

    expect(conflicts.some((c) => c.code === "propose_move_lower_tier")).toBe(true);
  });
});
