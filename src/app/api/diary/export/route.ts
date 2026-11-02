import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/api";
import { diaryEnabled } from "@/lib/diary/flags";
import { exportDiary } from "@/lib/diary/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  if (!diaryEnabled()) return jsonError("Diary Mode is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const payload = await exportDiary(auth.ctx.userId);

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="lifeos-diary-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
