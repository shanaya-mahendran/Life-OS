import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiUser } from "@/lib/api";
import { diaryEnabled } from "@/lib/diary/flags";
import { startSession } from "@/lib/diary/service";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const startSchema = z.object({
  entryId: z.string().min(1),
  mode: z.enum(["alter_ego", "devils_advocate", "collaborator"]),
  persona: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  if (!diaryEnabled()) return jsonError("Diary Mode is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const payload = await request.json().catch(() => null);
  const parsed = startSchema.safeParse(payload);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const result = await startSession(auth.ctx.user, parsed.data);
  if (!result) return jsonError("Entry not found.", 404);
  if (!result.session) return NextResponse.json({ session: null, paused: result.paused, message: result.message }, { status: 409 });

  return NextResponse.json({ session: result.session }, { status: 201 });
}
