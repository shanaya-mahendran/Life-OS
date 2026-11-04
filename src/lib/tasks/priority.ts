export function countActivePriorities<T extends { isPriority: boolean; status: string }>(tasks: T[]) {
  return tasks.reduce(
    (count, task) => count + (task.isPriority && task.status !== "done" ? 1 : 0),
    0,
  );
}
