import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, requireApiUser } from "@/lib/api";
import { diaryEnabled } from "@/lib/diary/flags";
import { getDiarySettings, updateDiarySettings } from "@/lib/diary/service";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  ambientOn: z.boolean().optional(),
  trendsOn: z.boolean().optional(),
  sparkOn: z.boolean().optional(),
  sendTextToAi: z.boolean().optional(),
  encryptionOn: z.boolean().optional(),
  encryptionSalt: z.string().max(64).optional(),
  recoveryHint: z.string().max(120).optional(),
});

export async function GET() {
  if (!diaryEnabled()) return jsonError("Diary Mode is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const settings = await getDiarySettings(auth.ctx.userId);
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  if (!diaryEnabled()) return jsonError("Diary Mode is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const payload = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  // Turning encryption off must not silently strand ciphertext: it stays locked
  // until the writer unlocks (or deletes) each entry.
  const settings = await updateDiarySettings(auth.ctx.userId, parsed.data);
  return NextResponse.json({ settings });
}

export async function DELETE() {
  if (!diaryEnabled()) return jsonError("Diary Mode is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  await prisma.$transaction([
    prisma.diarySession.deleteMany({ where: { userId: auth.ctx.userId } }),
    prisma.diaryArtifact.deleteMany({ where: { userId: auth.ctx.userId } }),
    prisma.diaryStamp.deleteMany({ where: { userId: auth.ctx.userId } }),
    prisma.diaryEntry.deleteMany({ where: { userId: auth.ctx.userId } }),
    prisma.burnEntry.deleteMany({ where: { userId: auth.ctx.userId } }),
    prisma.diarySettings.deleteMany({ where: { userId: auth.ctx.userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
