import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tasks = await prisma.task.findMany({
    include: {
      subtasks: { select: { id: true } },
    },
  });
  let migrated = 0;
  for (const task of tasks) {
    await prisma.task.update({
      where: { id: task.id },
      data: {
        deadline: task.deadline ?? task.dueDate,
        isPriority: task.isPriority || task.priority >= 2,
      },
    });
    if (task.subtasks.length || task.estimateMinutes <= 0) continue;

    const linkedEventRow = task.linkedEventId
      ? await prisma.event.findFirst({
          where: { id: task.linkedEventId, userId: task.userId, status: { not: "cancelled" } },
          select: { id: true, start: true, end: true },
        })
      : null;
    const linkedEvent = linkedEventRow;
    const alreadyLinked = linkedEvent
      ? await prisma.subtask.findUnique({ where: { calendarEventId: linkedEvent.id }, select: { id: true } })
      : null;
    await prisma.subtask.create({
      data: {
        taskId: task.id,
        userId: task.userId,
        title: task.title,
        durationMin: linkedEvent
          ? Math.max(5, Math.round((linkedEvent.end.getTime() - linkedEvent.start.getTime()) / 60_000))
          : task.estimateMinutes,
        scheduledStart: linkedEvent && !alreadyLinked ? linkedEvent.start : null,
        calendarEventId: linkedEvent && !alreadyLinked ? linkedEvent.id : null,
        status: task.status,
        completedAt: task.completedAt,
      },
    });
    migrated += 1;
  }
  console.log(`Backfilled ${migrated} legacy tasks into subtasks.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
