import { NextResponse } from "next/server";
import { requireApiUser, jsonError } from "@/lib/api";
import { updateTask } from "@/lib/calendar/service";
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

  const result = await updateTask(auth.ctx.user, id, parsed.data);
  if (!result.ok) return jsonError(result.message, 404);

  return NextResponse.json({ ok: true, task: toUiTask(result.task) });
}
