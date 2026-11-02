import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiUser } from "@/lib/api";
import { diaryEnabled } from "@/lib/diary/flags";
import { MAX_ENTRY_CHARS, MAX_TAGS } from "@/lib/diary/constants";
import { deleteEntry, getEntry, updateEntry } from "@/lib/diary/service";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    body: z.string().max(MAX_ENTRY_CHARS).optional(),
    tags: z.array(z.string().max(24)).max(MAX_TAGS).optional(),
    silverLining: z.string().max(200).optional(),
    silverLiningDeleted: z.boolean().optional(),
    spark: z.string().max(200).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update." });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!diaryEnabled()) return jsonError("Diary Mode is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const entry = await getEntry(auth.ctx.userId, id);
  if (!entry) return jsonError("Entry not found.", 404);
  return NextResponse.json({ entry });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!diaryEnabled()) return jsonError("Diary Mode is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const payload = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const { id } = await params;
  const entry = await updateEntry(auth.ctx.userId, id, parsed.data);
  if (!entry) return jsonError("Entry not found.", 404);
  return NextResponse.json({ entry });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!diaryEnabled()) return jsonError("Diary Mode is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const deleted = await deleteEntry(auth.ctx.userId, id);
  if (!deleted) return jsonError("Entry not found.", 404);
  return NextResponse.json({ ok: true });
}
