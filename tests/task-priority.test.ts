import { describe, expect, it } from "vitest";
import { countActivePriorities } from "@/lib/tasks/priority";

describe("countActivePriorities", () => {
  it("counts active priority tasks from the current task collection", () => {
    const tasks = [
      { isPriority: true, status: "todo" },
      { isPriority: true, status: "doing" },
      { isPriority: false, status: "todo" },
      { isPriority: true, status: "done" },
    ];
    expect(countActivePriorities(tasks)).toBe(2);
    expect(countActivePriorities([...tasks, { isPriority: true, status: "todo" }])).toBe(3);
    expect(countActivePriorities(tasks.slice(1))).toBe(1);
  });
});
