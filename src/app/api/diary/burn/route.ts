import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiUser } from "@/lib/api";
import { diaryEnabled } from "@/lib/diary/flags";
import { listBurnEntries, burnText } from "@/lib/diary/service";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const burnSchema = z.object({ text: z.string().min(1).max(6000) });

export async function GET() {
  if (!diaryEnabled()) return jsonError("Diary Mode is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const burns = await listBurnEntries(auth.ctx.userId);
  return NextResponse.json({ burns });
}

/**
 * The text in this request is never persisted: the only row written is the
 * takeaway, inside a single transaction.
 */
export async function POST(request: Request) {
  if (!diaryEnabled()) return jsonError("Diary Mode is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const payload = await request.json().catch(() => null);
  const parsed = burnSchema.safeParse(payload);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const result = await burnText(auth.ctx.user, parsed.data.text);
  return NextResponse.json(result);
}
