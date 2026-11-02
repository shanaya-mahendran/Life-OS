import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/api";
import { diaryEnabled } from "@/lib/diary/flags";
import { ambientForEntry, findEcho } from "@/lib/diary/service";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

/**
 * One structured ambient call per entry, cached. Re-running is allowed only
 * with `?force=1`, which the editor uses when the writer asks for a re-read.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!diaryEnabled()) return jsonError("Diary Mode is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const force = new URL(request.url).searchParams.get("force") === "1";

  const outcome = await ambientForEntry(auth.ctx.user, id, { force });
  if (!outcome) return jsonError("Entry not found.", 404);

  const echo = await findEcho(auth.ctx.userId, id).catch(() => null);

  return NextResponse.json({ ...outcome, echo });
}
