import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiUser } from "@/lib/api";
import { diaryEnabled } from "@/lib/diary/flags";
import { addSessionTurn, deleteSession, endSession, getSession } from "@/lib/diary/service";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("turn"), content: z.string().min(1).max(4000) }),
  z.object({ action: z.literal("end") }),
]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!diaryEnabled()) return jsonError("Diary Mode is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const session = await getSession(auth.ctx.userId, id);
  if (!session) return jsonError("Session not found.", 404);
  return NextResponse.json({ session });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!diaryEnabled()) return jsonError("Diary Mode is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const payload = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const { id } = await params;

  if (parsed.data.action === "end") {
    const session = await endSession(auth.ctx.userId, id);
    if (!session) return jsonError("Session not found.", 404);
    return NextResponse.json({ session });
  }

  const result = await addSessionTurn(auth.ctx.user, id, parsed.data.content);
  if (!result) return jsonError("Session not found.", 404);
  return NextResponse.json(result);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!diaryEnabled()) return jsonError("Diary Mode is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const deleted = await deleteSession(auth.ctx.userId, id);
  if (!deleted) return jsonError("Session not found.", 404);
  return NextResponse.json({ ok: true });
}
