import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { deleteSubtask, saveSubtask, setSubtaskStatus } from "@/lib/tasks/service";
import { formatZodError, subtaskSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = subtaskSchema.partial().safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));
  const existing = await prisma.subtask.findFirst({
    where: { id, userId: auth.ctx.userId },
    include: { task: true },
  });
  if (!existing) return jsonError("Subtask not found.", 404);
  if (parsed.data.status !== undefined && parsed.data.title === undefined && parsed.data.durationMin === undefined && parsed.data.scheduledStart === undefined && parsed.data.notes === undefined) {
    const result = await setSubtaskStatus(auth.ctx.userId, id, parsed.data.status);
    if (!result.ok) return jsonError(result.message, 404);
    return NextResponse.json({ ok: true, subtask: result.subtask });
  }
  const result = await saveSubtask(
    auth.ctx.user,
    existing.taskId,
    {
      title: parsed.data.title ?? existing.title,
      notes: parsed.data.notes ?? existing.notes,
      durationMin: parsed.data.durationMin ?? existing.durationMin,
      scheduledStart: parsed.data.scheduledStart !== undefined ? parsed.data.scheduledStart : existing.scheduledStart,
      status: parsed.data.status ?? existing.status,
      force: parsed.data.force,
    },
    id,
  );
  if (!result.ok) return NextResponse.json(result, { status: result.code === "NOT_FOUND" ? 404 : 409 });
  return NextResponse.json({ ok: true, subtask: result.subtask });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const result = await deleteSubtask(auth.ctx.user, id);
  if (!result.ok) return jsonError(result.message, 404);
  return NextResponse.json({ ok: true });
}
