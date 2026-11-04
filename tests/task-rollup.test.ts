import { describe, expect, it } from "vitest";
import { rollup, type RollupTask } from "@/lib/tasks/rollup";

const NOW = new Date("2026-11-04T12:00:00Z");

function task(overrides: Partial<RollupTask> = {}): RollupTask {
  return {
    deadline: new Date("2026-11-10T12:00:00Z"),
    status: "todo",
    subtasks: [
      { id: "1", title: "Done", durationMin: 60, scheduledStart: new Date("2026-11-05T09:00:00Z"), status: "done" },
      { id: "2", title: "Scheduled", durationMin: 90, scheduledStart: new Date("2026-11-06T09:00:00Z"), status: "todo" },
      { id: "3", title: "Backlog", durationMin: 30, scheduledStart: null, status: "todo" },
    ],
    ...overrides,
  };
}

describe("rollup", () => {
  it("calculates totals, weighted progress, counts, and next scheduled open subtask", () => {
    expect(rollup(task(), NOW)).toMatchObject({
      totalMin: 180,
      doneMin: 60,
      scheduledMin: 150,
      unscheduledMin: 30,
      progressPct: 33,
      subtaskDone: 1,
      subtaskCount: 3,
      nextSubtask: { id: "2" },
      isOverdue: false,
      atRisk: false,
    });
  });

  it("marks scheduled work beyond deadline as at risk and incomplete expired tasks overdue", () => {
    const lateTask = task({
      deadline: new Date("2026-11-05T10:00:00Z"),
      subtasks: [{ id: "1", title: "Late", durationMin: 90, scheduledStart: new Date("2026-11-05T09:00:00Z"), status: "todo" }],
    });
    expect(rollup(lateTask, NOW).atRisk).toBe(true);
    expect(rollup(lateTask, new Date("2026-11-06T00:00:00Z")).isOverdue).toBe(true);
  });

  it("uses subtask count when no time has been allocated and flags unscheduled work near deadline", () => {
    const emptyTime = task({
      deadline: new Date("2026-11-05T00:00:00Z"),
      subtasks: [
        { id: "1", title: "Done", durationMin: 0, scheduledStart: null, status: "done" },
        { id: "2", title: "Open", durationMin: 0, scheduledStart: null, status: "todo" },
      ],
    });
    expect(rollup(emptyTime, NOW)).toMatchObject({ totalMin: 0, progressPct: 50, atRisk: false });

    const unscheduled = task({ deadline: new Date("2026-11-05T12:00:00Z") });
    expect(rollup(unscheduled, NOW).atRisk).toBe(true);
  });
});
