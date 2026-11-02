import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiUser } from "@/lib/api";
import { diaryEnabled } from "@/lib/diary/flags";
import { deleteArtifact, setArtifactStatus } from "@/lib/diary/service";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const patchSchema = z.object({ status: z.enum(["active", "dismissed"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!diaryEnabled()) return jsonError("Diary Mode is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const payload = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const { id } = await params;
  const ok = await setArtifactStatus(auth.ctx.userId, id, parsed.data.status);
  if (!ok) return jsonError("Artifact not found.", 404);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!diaryEnabled()) return jsonError("Diary Mode is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const ok = await deleteArtifact(auth.ctx.userId, id);
  if (!ok) return jsonError("Artifact not found.", 404);
  return NextResponse.json({ ok: true });
}
