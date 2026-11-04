export function findTaskMatches<T extends { id: string; title: string }>(
  tasks: T[],
  taskId: unknown,
  title: unknown,
): T[] {
  const id = typeof taskId === "string" ? taskId.trim() : "";
  if (id) return tasks.filter((task) => task.id === id);

  const needle = typeof title === "string" ? title.trim().toLowerCase() : "";
  if (!needle) return [];
  return tasks.filter((task) => task.title.toLowerCase().includes(needle));
}
