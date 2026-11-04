import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/api";
import { reorderSubtasks } from "@/lib/tasks/service";
import { formatZodError, subtaskReorderSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => null);
  const parsed = subtaskReorderSchema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));
  const result = await reorderSubtasks(auth.ctx.userId, parsed.data.taskId, parsed.data.ids);
  if (!result.ok) return jsonError(result.message, 400);
  return NextResponse.json({ ok: true });
}
