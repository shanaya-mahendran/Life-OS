export interface RollupSubtask {
  id: string;
  title: string;
  durationMin: number;
  scheduledStart: Date | null;
  status: string;
}

export interface RollupTask {
  deadline: Date | null;
  status: string;
  subtasks: RollupSubtask[];
}

export function rollup(task: RollupTask, now = new Date()) {
  const { subtasks } = task;
  const totalMin = subtasks.reduce((total, subtask) => total + subtask.durationMin, 0);
  const doneSubtasks = subtasks.filter((subtask) => subtask.status === "done");
  const doneMin = doneSubtasks.reduce((total, subtask) => total + subtask.durationMin, 0);
  const scheduledMin = subtasks
    .filter((subtask) => subtask.scheduledStart)
    .reduce((total, subtask) => total + subtask.durationMin, 0);
  const deadlineMs = task.deadline?.getTime();
  const pastDeadline = subtasks.some(
    (subtask) =>
      subtask.scheduledStart &&
      deadlineMs !== undefined &&
      subtask.scheduledStart.getTime() + subtask.durationMin * 60_000 > deadlineMs,
  );
  const isOverdue = deadlineMs !== undefined && deadlineMs < now.getTime() && task.status !== "done";
  const unscheduledMin = totalMin - scheduledMin;
  const nextSubtask =
    subtasks
      .filter((subtask) => subtask.status !== "done" && subtask.scheduledStart)
      .sort((a, b) => a.scheduledStart!.getTime() - b.scheduledStart!.getTime())[0] ?? null;

  return {
    totalMin,
    doneMin,
    scheduledMin,
    unscheduledMin,
    progressPct: totalMin
      ? Math.round((doneMin / totalMin) * 100)
      : subtasks.length
        ? Math.round((doneSubtasks.length / subtasks.length) * 100)
        : 0,
    subtaskDone: doneSubtasks.length,
    subtaskCount: subtasks.length,
    nextSubtask,
    isOverdue,
    atRisk:
      !isOverdue &&
      (pastDeadline ||
        (deadlineMs !== undefined &&
          deadlineMs >= now.getTime() &&
          deadlineMs - now.getTime() < 48 * 60 * 60_000 &&
          unscheduledMin > 0)),
  };
}
