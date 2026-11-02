import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, requireApiUser } from "@/lib/api";
import { resetPlanEnabled } from "@/lib/reset/flags";
import { getCurrentPlan, getLatestPlan } from "@/lib/reset/service";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!resetPlanEnabled()) return jsonError("Reset Plan is disabled.", 404);

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const userId = auth.ctx.userId;

  const [plan, habits, goalTracks] = await Promise.all([
    getCurrentPlan(userId).then((current) => current ?? getLatestPlan(userId)),
    prisma.habit.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.goalTrack.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: { progress: { orderBy: { date: "asc" } } },
    }),
  ]);

  if (!plan) {
    return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), plan: null }, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="lifeos-reset-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    plan: {
      ...plan,
      checkins: plan.checkins,
      calendarEvents: plan.calendarEvents,
    },
    habits,
    goalTracks,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="lifeos-reset-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
