import { describe, expect, it } from "vitest";
import { findTaskMatches } from "@/lib/agent/task-matching";

const tasks = [
  { id: "1", title: "Final project", domain: "Learning" },
  { id: "2", title: "Final project presentation", domain: "Learning" },
  { id: "3", title: "Strength training", domain: "Fitness" },
];

describe("findTaskMatches", () => {
  it("uses an exact ID when one is provided", () => {
    expect(findTaskMatches(tasks, "2", "Final project")).toEqual([tasks[1]]);
  });

  it("returns all partial-title matches so callers can ask for clarification", () => {
    expect(findTaskMatches(tasks, undefined, "final project")).toEqual(tasks.slice(0, 2));
  });

  it("returns no match for an unknown title or ID", () => {
    expect(findTaskMatches(tasks, undefined, "missing")).toEqual([]);
    expect(findTaskMatches(tasks, "unknown", "Final project")).toEqual([]);
  });
});
