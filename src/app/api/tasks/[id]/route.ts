import { NextResponse } from "next/server";
import { requireApiUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { updateTask } from "@/lib/calendar/service";
import { deleteMainTask, updateMainTask } from "@/lib/tasks/service";
import { toUiTask } from "@/lib/dto";
import { formatZodError, updateTaskSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  if (parsed.data.priority === undefined) {
    let priorityWarning: string | undefined;
    if (parsed.data.isPriority === true) {
      const existing = await prisma.task.findFirst({
        where: { id, userId: auth.ctx.userId },
        select: { isPriority: true, priority: true },
      });
      if (existing && !(existing.isPriority || existing.priority >= 2)) {
        const activePriorities = await prisma.task.count({
          where: {
            userId: auth.ctx.userId,
            status: { not: "done" },
            OR: [{ isPriority: true }, { priority: { gte: 2 } }],
          },
        });
        if (activePriorities >= 5) priorityWarning = "You have 5 priorities already.";
      }
    }
    const result = await updateMainTask(auth.ctx.user, id, {
      title: parsed.data.title,
      notes: parsed.data.notes,
      status: parsed.data.status,
      deadline: parsed.data.deadline !== undefined ? parsed.data.deadline : parsed.data.dueDate,
      domainSlug: parsed.data.domainSlug,
      isPriority: parsed.data.isPriority,
      priorityRank: parsed.data.priorityRank,
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: result.code === "DEADLINE_CONFLICT" ? 409 : 404 });
    }
    return NextResponse.json({ ok: true, task: result.task, ...(priorityWarning ? { warning: priorityWarning } : {}) });
  }
  const result = await updateTask(auth.ctx.user, id, parsed.data);
  if (!result.ok) return jsonError(result.message, 404);

  return NextResponse.json({ ok: true, task: toUiTask(result.task) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const result = await deleteMainTask(auth.ctx.user, id);
  if (!result.ok) return jsonError(result.message, 404);
  if (result.inverse.length) {
    await prisma.agentLog.create({
      data: {
        userId: auth.ctx.userId,
        message: `Delete main task ${id}`,
        reply: "Deleted the main task and its subtasks.",
        intent: "delete_task",
        inverse: result.inverse as never,
        toolCalls: [{ name: "delete_task", args: { taskId: id } }],
        result: { state: "applied" },
      },
    });
  }
  return NextResponse.json({ ok: true, undoAvailable: result.inverse.length > 0 });
}
