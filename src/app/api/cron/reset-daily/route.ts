import { NextResponse } from "next/server";
import { cronAuthorised, cronConfigured } from "@/lib/cron-auth";
import { runResetCron } from "@/lib/reset/cron";
import { resetPlanEnabled } from "@/lib/reset/flags";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!resetPlanEnabled()) return NextResponse.json({ ok: true, disabled: true });
  if (!cronConfigured()) {
    return NextResponse.json({ error: "CRON_SECRET is not configured on this deployment." }, { status: 503 });
  }
  if (!cronAuthorised(request)) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const result = await runResetCron("daily");
  return NextResponse.json(result);
}
