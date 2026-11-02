import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiUser } from "@/lib/api";
import { diaryEnabled } from "@/lib/diary/flags";
import { MAX_ENTRY_CHARS, MAX_TAGS } from "@/lib/diary/constants";
import { createEntry, listEntries } from "@/lib/diary/service";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  body: z.string().max(MAX_ENTRY_CHARS),
  tags: z.array(z.string().max(24)).max(MAX_TAGS).optional(),
  encrypted: z.boolean().optional(),
});

export async function GET() {
  if (!diaryEnabled()) return jsonError("Diary Mode is disabled.", 404);

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const entries = await listEntries(auth.ctx.userId);
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  if (!diaryEnabled()) return jsonError("Diary Mode is disabled.", 404);

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const payload = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const entry = await createEntry(auth.ctx.user, parsed.data);
  return NextResponse.json({ entry }, { status: 201 });
}
