import { NextResponse } from "next/server";
import { cronAuthorised, cronConfigured } from "@/lib/cron-auth";
import { diaryEnabled } from "@/lib/diary/flags";
import { runDiaryTrends } from "@/lib/diary/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!diaryEnabled()) return NextResponse.json({ ok: true, disabled: true });
  if (!cronConfigured()) {
    return NextResponse.json({ error: "CRON_SECRET is not configured on this deployment." }, { status: 503 });
  }
  if (!cronAuthorised(request)) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const result = await runDiaryTrends();
  return NextResponse.json(result);
}
