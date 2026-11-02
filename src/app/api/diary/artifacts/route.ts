import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiUser } from "@/lib/api";
import { diaryEnabled } from "@/lib/diary/flags";
import { listArtifacts, pinSeed } from "@/lib/diary/service";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const pinSchema = z.object({
  entryId: z.string().min(1),
  text: z.string().min(1).max(400),
  kind: z.string().max(24).default("seed"),
});

export async function GET(request: Request) {
  if (!diaryEnabled()) return jsonError("Diary Mode is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;

  const artifacts = await listArtifacts(auth.ctx.userId, { kind, status });
  return NextResponse.json({ artifacts });
}

export async function POST(request: Request) {
  if (!diaryEnabled()) return jsonError("Diary Mode is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const payload = await request.json().catch(() => null);
  const parsed = pinSchema.safeParse(payload);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const artifact = await pinSeed(auth.ctx.userId, parsed.data);
  return NextResponse.json({ artifact }, { status: 201 });
}
