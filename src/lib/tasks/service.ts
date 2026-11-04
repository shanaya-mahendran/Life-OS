import { prisma } from "@/lib/db";
import { createEvent, cancelEvent, findSlots, updateEvent, type ServiceUser } from "@/lib/calendar/service";
import { rollup } from "./rollup";

const taskInclude = {
  domain: { select: { slug: true, name: true, accent: true, icon: true } },
  subtasks: { orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }] },
};

export async function listMainTasks(
  user: ServiceUser,
  options: { domainSlug?: string; priority?: boolean; status?: string; includeDone?: boolean; now?: Date } = {},
) {
  const rows = await prisma.task.findMany({
    where: {
      userId: user.id,
      ...(options.domainSlug ? { domain: { slug: options.domainSlug } } : {}),
      ...(options.status ? { status: options.status } : options.includeDone ? {} : { status: { not: "done" } }),
      ...(options.priority ? { OR: [{ isPriority: true }, { priority: { gte: 2 } }] } : {}),
    },
    include: taskInclude,
    orderBy: [{ isPriority: "desc" }, { priority: "desc" }, { deadline: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
    take: 500,
  });
  const now = options.now ?? new Date();
  return rows.map((row) => {
    const deadline = row.deadline ?? row.dueDate;
    const task = { ...row, deadline, isPriority: row.isPriority || row.priority >= 2 };
    return { ...task, rollup: rollup({ ...task, subtasks: row.subtasks }, now) };
  });
}

export async function getMainTask(userId: string, taskId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, userId },
    include: taskInclude,
  });
}

export async function proposeMainTaskSchedule(user: ServiceUser, taskId: string, now = new Date()) {
  const task = await getMainTask(user.id, taskId);
  if (!task) return { ok: false as const, message: "Task not found." };
  const deadline = task.deadline ?? task.dueDate;
  if (!deadline) return { ok: false as const, message: "Add a deadline before auto-scheduling this task." };
  if (deadline <= now) return { ok: false as const, message: "This task's deadline has passed." };

  const unscheduled = task.subtasks.filter(
    (subtask) => subtask.status !== "done" && !subtask.scheduledStart && !subtask.calendarEventId,
  );
  if (!unscheduled.length) return { ok: false as const, message: "There are no unscheduled subtasks to place." };

  const proposals: { subtaskId: string; title: string; start: Date; end: Date; durationMin: number }[] = [];
  let cursor = now;
  for (const subtask of unscheduled) {
    const slots = await findSlots(user, {
      from: cursor,
      to: deadline,
      durationMinutes: subtask.durationMin,
      maxSlots: 1,
    });
    const slot = slots[0];
    if (!slot) break;
    proposals.push({
      subtaskId: subtask.id,
      title: subtask.title,
      start: slot.start,
      end: slot.end,
      durationMin: subtask.durationMin,
    });
    cursor = slot.end;
  }
  return {
    ok: true as const,
    proposals,
    unscheduledCount: unscheduled.length - proposals.length,
  };
}

export async function acceptMainTaskSchedule(
  user: ServiceUser,
  taskId: string,
  assignments: { subtaskId: string; start: Date }[],
  now = new Date(),
) {
  const task = await getMainTask(user.id, taskId);
  if (!task) return { ok: false as const, message: "Task not found.", scheduledCount: 0 };
  if (new Set(assignments.map((assignment) => assignment.subtaskId)).size !== assignments.length) {
    return { ok: false as const, message: "A subtask appears more than once.", scheduledCount: 0 };
  }
  const changes = [];
  for (const assignment of assignments) {
    if (assignment.start <= now) {
      return {
        ok: false as const,
        message: "A proposed slot has already passed. Refresh and propose a new schedule.",
        scheduledCount: changes.length,
      };
    }
    const subtask = task.subtasks.find((candidate) => candidate.id === assignment.subtaskId);
    if (!subtask || subtask.status === "done" || subtask.scheduledStart || subtask.calendarEventId) {
      return {
        ok: false as const,
        message: "The task changed after the proposal. Refresh and propose a new schedule.",
        scheduledCount: changes.length,
      };
    }
    const result = await saveSubtask(user, taskId, {
      title: subtask.title,
      notes: subtask.notes,
      durationMin: subtask.durationMin,
      scheduledStart: assignment.start,
      status: subtask.status,
    }, subtask.id);
    if (!result.ok) {
      return {
        ok: false as const,
        message: result.message,
        code: result.code,
        scheduledCount: changes.length,
      };
    }
    changes.push(result.subtask.id);
  }
  return { ok: true as const, scheduledCount: changes.length };
}

export async function createMainTask(
  user: ServiceUser,
  input: { domainSlug: string; title: string; notes?: string; deadline?: Date | null; isPriority?: boolean; subtasks?: { title: string; notes?: string; durationMin: number; scheduledStart?: Date | null }[] },
) {
  const domain = await prisma.domain.findFirst({ where: { userId: user.id, slug: input.domainSlug } });
  if (!domain) return { ok: false as const, message: `Unknown domain "${input.domainSlug}".` };
  const data = await prisma.task.create({
    data: {
      userId: user.id,
      domainId: domain.id,
      title: input.title,
      notes: input.notes ?? "",
      deadline: input.deadline ?? null,
      dueDate: input.deadline ?? null,
      isPriority: input.isPriority ?? false,
      priority: input.isPriority ? 3 : 1,
    },
    include: taskInclude,
  });
  for (const subtask of input.subtasks ?? []) {
    const result = await saveSubtask(user, data.id, subtask);
    if (!result.ok) {
      await deleteMainTask(user, data.id);
      return result;
    }
  }
  return { ok: true as const, task: (await getMainTask(user.id, data.id)) ?? data };
}

export async function updateMainTask(
  user: ServiceUser,
  taskId: string,
  patch: { title?: string; domainSlug?: string; deadline?: Date | null; isPriority?: boolean; priorityRank?: number | null; status?: string; notes?: string },
) {
  const existing = await getMainTask(user.id, taskId);
  if (!existing) return { ok: false as const, message: "Task not found." };

  const nextDeadline = patch.deadline !== undefined ? patch.deadline : existing.deadline ?? existing.dueDate;
  const lateSubtasks = nextDeadline
    ? existing.subtasks.filter(
        (subtask) =>
          subtask.scheduledStart &&
          subtask.scheduledStart.getTime() + subtask.durationMin * 60_000 > nextDeadline.getTime(),
      )
    : [];
  if (lateSubtasks.length) {
    return {
      ok: false as const,
      code: "DEADLINE_CONFLICT",
      message: "The new deadline is before the end of scheduled subtasks.",
      affected: lateSubtasks.map((subtask) => ({ id: subtask.id, title: subtask.title })),
    };
  }

  const domain = patch.domainSlug
    ? await prisma.domain.findFirst({ where: { userId: user.id, slug: patch.domainSlug } })
    : null;
  if (patch.domainSlug && !domain) return { ok: false as const, message: "Unknown domain." };
  const row = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.deadline !== undefined ? { deadline: patch.deadline, dueDate: patch.deadline } : {}),
      ...(patch.isPriority !== undefined ? { isPriority: patch.isPriority, priority: patch.isPriority ? 3 : 1 } : {}),
      ...(patch.priorityRank !== undefined ? { priorityRank: patch.priorityRank } : {}),
      ...(patch.status !== undefined ? { status: patch.status, completedAt: patch.status === "done" ? new Date() : null } : {}),
      ...(domain ? { domainId: domain.id } : {}),
    },
    include: taskInclude,
  });
  if (patch.status === "done" && row.subtasks.some((subtask) => subtask.status !== "done")) {
    await prisma.subtask.updateMany({
      where: { taskId, userId: user.id },
      data: { status: "done", completedAt: new Date() },
    });
  }
  const updated = patch.status === "done" ? await getMainTask(user.id, taskId) : row;
  return { ok: true as const, task: updated };
}

export async function deleteMainTask(user: ServiceUser, taskId: string) {
  const task = await getMainTask(user.id, taskId);
  if (!task) return { ok: false as const, message: "Task not found." };
  const inverse: import("@/lib/calendar/service").InverseOp[] = [];
  for (const subtask of task.subtasks) {
    if (subtask.calendarEventId) {
      const result = await cancelEvent(user, subtask.calendarEventId);
      if (result.inverse) inverse.push(result.inverse);
    }
  }
  inverse.push({
    type: "restore_task_tree",
    task: {
      id: task.id,
      userId: task.userId,
      domainId: task.domainId,
      title: task.title,
      notes: task.notes,
      dueDate: task.dueDate?.toISOString() ?? null,
      estimateMinutes: task.estimateMinutes,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline?.toISOString() ?? null,
      isPriority: task.isPriority,
      priorityRank: task.priorityRank,
      linkedEventId: task.linkedEventId,
      completedAt: task.completedAt?.toISOString() ?? null,
    },
    subtasks: task.subtasks.map((subtask) => ({
      id: subtask.id,
      taskId: subtask.taskId,
      userId: subtask.userId,
      title: subtask.title,
      notes: subtask.notes,
      durationMin: subtask.durationMin,
      scheduledStart: subtask.scheduledStart?.toISOString() ?? null,
      status: subtask.status,
      sortOrder: subtask.sortOrder,
      calendarEventId: subtask.calendarEventId,
      completedAt: subtask.completedAt?.toISOString() ?? null,
    })),
  });
  await prisma.task.delete({ where: { id: taskId } });
  return { ok: true as const, inverse };
}

export async function saveSubtask(
  user: ServiceUser,
  taskId: string,
  input: { title: string; notes?: string; durationMin: number; scheduledStart?: Date | null; status?: string; force?: boolean },
  subtaskId?: string,
) {
  const task = await getMainTask(user.id, taskId);
  if (!task) return { ok: false as const, code: "NOT_FOUND", message: "Task not found." };
  const existing = subtaskId ? task.subtasks.find((subtask) => subtask.id === subtaskId) : null;
  if (subtaskId && !existing) return { ok: false as const, code: "NOT_FOUND", message: "Subtask not found." };

  const deadline = task.deadline ?? task.dueDate;
  const end = input.scheduledStart
    ? new Date(input.scheduledStart.getTime() + input.durationMin * 60_000)
    : null;
  if (end && deadline && end > deadline) {
    return { ok: false as const, code: "AFTER_DEADLINE", message: "This ends after the main task deadline." };
  }

  let eventId = existing?.calendarEventId ?? null;
  if (input.scheduledStart) {
    const eventInput = {
      domainSlug: task.domain.slug,
      title: `${task.title} › ${input.title}`,
      start: input.scheduledStart,
      end: end!,
      description: input.notes ?? "",
      source: "manual" as const,
    };
    const result = existing?.calendarEventId
      ? await updateEvent(user, existing.calendarEventId, {
          title: eventInput.title,
          start: eventInput.start,
          end: eventInput.end,
          description: eventInput.description,
          status: input.status === "done" ? "done" : "planned",
          force: input.force,
        })
      : await createEvent(user, { ...eventInput, force: input.force });
    const unsafeOverride =
      input.force &&
      result.conflicts.some((conflict) => conflict.severity === "blocking" || conflict.severity === "protected");
    if (!result.ok || !result.event || unsafeOverride) {
      const code = result.conflicts.some((conflict) => conflict.code === "overlap")
        ? "OVERLAP"
        : result.conflicts.some((conflict) => conflict.severity === "protected")
          ? "PROTECTED"
          : result.conflicts.some((conflict) => conflict.severity === "overload")
            ? "DAILY_CAP"
            : "CONFLICT";
      return {
        ok: false as const,
        code,
        message: result.message ?? result.conflicts.map((conflict) => conflict.message).join(" "),
        conflicts: result.conflicts.map((conflict) => ({ code: conflict.code, message: conflict.message })),
      };
    }
    eventId = result.event.id;
  } else if (existing?.calendarEventId) {
    await cancelEvent(user, existing.calendarEventId);
    eventId = null;
  }

  const nextStatus =
    input.status ?? existing?.status ?? "todo";
  const row = existing
    ? await prisma.subtask.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          notes: input.notes ?? "",
          durationMin: input.durationMin,
          scheduledStart: input.scheduledStart ?? null,
          calendarEventId: eventId,
          status: nextStatus,
          completedAt: nextStatus === "done" ? existing.completedAt ?? new Date() : null,
        },
      })
    : await prisma.subtask.create({
        data: {
          taskId,
          userId: user.id,
          title: input.title,
          notes: input.notes ?? "",
          durationMin: input.durationMin,
          scheduledStart: input.scheduledStart ?? null,
          calendarEventId: eventId,
          status: nextStatus,
          sortOrder: task.subtasks.length,
        },
      });

  await synchronizeParentStatus(taskId);
  return { ok: true as const, subtask: row };
}

export async function setSubtaskStatus(userId: string, subtaskId: string, status: string) {
  const subtask = await prisma.subtask.findFirst({ where: { id: subtaskId, userId } });
  if (!subtask) return { ok: false as const, message: "Subtask not found." };
  if (subtask.calendarEventId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        timezone: true,
        wakeTime: true,
        sleepTime: true,
        dayStartHour: true,
        dayEndHour: true,
        minSleepHours: true,
        maxFocusHours: true,
      },
    });
    if (user) {
      await updateEvent(user, subtask.calendarEventId, {
        status: status === "done" ? "done" : "planned",
        force: true,
      });
    }
  }
  const row = await prisma.subtask.update({
    where: { id: subtaskId },
    data: { status, completedAt: status === "done" ? new Date() : null },
  });
  await synchronizeParentStatus(subtask.taskId);
  return { ok: true as const, subtask: row };
}

export async function deleteSubtask(user: ServiceUser, subtaskId: string) {
  const subtask = await prisma.subtask.findFirst({ where: { id: subtaskId, userId: user.id } });
  if (!subtask) return { ok: false as const, message: "Subtask not found." };
  if (subtask.calendarEventId) await cancelEvent(user, subtask.calendarEventId);
  await prisma.subtask.delete({ where: { id: subtask.id } });
  await synchronizeParentStatus(subtask.taskId);
  return { ok: true as const };
}

async function synchronizeParentStatus(taskId: string) {
  const subtasks = await prisma.subtask.findMany({ where: { taskId }, select: { status: true } });
  const status =
    subtasks.length > 0 && subtasks.every((subtask) => subtask.status === "done")
      ? "done"
      : subtasks.some((subtask) => subtask.status === "done")
        ? "doing"
        : "todo";
  await prisma.task.update({
    where: { id: taskId },
    data: { status, completedAt: status === "done" ? new Date() : null },
  });
}

export async function reorderSubtasks(userId: string, taskId: string, ids: string[]) {
  const task = await prisma.task.findFirst({ where: { id: taskId, userId }, select: { id: true } });
  if (!task) return { ok: false as const, message: "Task not found." };
  const current = await prisma.subtask.findMany({ where: { taskId }, select: { id: true } });
  if (current.length !== ids.length || new Set(ids).size !== ids.length || ids.some((id) => !current.some((item) => item.id === id))) {
    return { ok: false as const, message: "Subtask order must include each subtask exactly once." };
  }
  await prisma.$transaction(ids.map((id, sortOrder) => prisma.subtask.update({ where: { id }, data: { sortOrder } })));
  return { ok: true as const };
}

export async function reorderPriorityTasks(userId: string, ids: string[]) {
  const priorities = await prisma.task.findMany({
    where: { userId, OR: [{ isPriority: true }, { priority: { gte: 2 } }] },
    select: { id: true, priorityRank: true, deadline: true, dueDate: true, createdAt: true },
    orderBy: [{ priorityRank: "asc" }, { deadline: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
  });
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => !priorities.some((task) => task.id === id))
  ) {
    return { ok: false as const, message: "Priority order contains an invalid task." };
  }
  const reorderIds = new Set(ids);
  const positions = priorities
    .map((task, index) => (reorderIds.has(task.id) ? index : -1))
    .filter((index) => index >= 0);
  const reordered = [...priorities];
  positions.forEach((position, index) => {
    reordered[position] = priorities.find((task) => task.id === ids[index])!;
  });
  await prisma.$transaction(
    reordered.map((task, priorityRank) => prisma.task.update({ where: { id: task.id }, data: { priorityRank } })),
  );
  return { ok: true as const };
}
