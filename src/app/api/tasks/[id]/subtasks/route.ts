import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/api";
import { subtaskSchema, formatZodError } from "@/lib/validation";
import { saveSubtask } from "@/lib/tasks/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = subtaskSchema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));
  const result = await saveSubtask(auth.ctx.user, id, parsed.data);
  if (!result.ok) {
    return NextResponse.json(result, { status: result.code === "NOT_FOUND" ? 404 : 409 });
  }
  return NextResponse.json({ ok: true, subtask: result.subtask }, { status: 201 });
}
