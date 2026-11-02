import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveBrief } from "@/lib/calendar/service";
import { briefDateKey, buildMorningBrief } from "@/lib/briefs";
import { serviceUserFromRow } from "@/lib/account";
import { createSystemNotification } from "@/lib/notifications";
import { runResetCron } from "@/lib/reset/cron";
import { runDiaryMonthly, runDiaryTrends } from "@/lib/diary/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) return true;

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : header;
  return bearer === secret;
}

/** Vercel Cron → GET /api/cron/brief (Bearer CRON_SECRET). */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not configured on this deployment." }, { status: 503 });
  }
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const now = new Date();
  const users = await prisma.user.findMany({
    where: { onboardedAt: { not: null } },
    select: {
      id: true,
      timezone: true,
      wakeTime: true,
      sleepTime: true,
      dayStartHour: true,
      dayEndHour: true,
      minSleepHours: true,
      maxFocusHours: true,
    },
    take: 500,
  });

  const results: { userId: string; headline: string }[] = [];
  for (const row of users) {
    try {
      const user = serviceUserFromRow(row);
      const brief = await buildMorningBrief(user, now);
      const dateKey = briefDateKey(now, user.timezone);
      await saveBrief(row.id, "morning", dateKey, brief.headline, brief);

      // Create notification so user sees it in their notification feed upon waking up
      await createSystemNotification({
        userId: row.id,
        type: "morning_brief",
        title: "Morning Brief is Ready ☀️",
        message: brief.headline,
        link: "/today",
        metadata: { forDate: dateKey },
      });

      results.push({ userId: row.id, headline: brief.headline });
    } catch (error) {
      console.error("[lifeos] morning brief failed for", row.id, error);
    }
  }

  // Vercel's free plan allows two cron jobs, so this daily job also drives the
  // Reset Plan and Diary schedules. Each block is isolated: a failing module
  // must never stop the morning briefs.
  const extra: Record<string, unknown> = {};
  const isMonday = now.getUTCDay() === 1;
  const isFirstOfMonth = now.getUTCDate() === 1;

  // Stop starting new sweeps well before the platform timeout so a large
  // account base never kills the job mid-run; the next day picks it up.
  const startedAt = Date.now();
  const budgetLeft = (reserveMs: number) => Date.now() - startedAt < maxDuration * 1000 - reserveMs;

  if (budgetLeft(22_000)) {
    try {
      extra.resetDaily = await runResetCron("daily");
      extra.resetReview = await runResetCron("review");
      if (isFirstOfMonth) extra.resetMonth = await runResetCron("month");
    } catch (error) {
      console.error("[lifeos] reset cron inside brief failed", error);
      extra.resetFailed = true;
    }
  } else {
    extra.resetSkipped = "out of time";
  }

  if (budgetLeft(14_000)) {
    try {
      if (isMonday) extra.diaryTrends = await runDiaryTrends(now);
      if (isFirstOfMonth) extra.diaryMonth = await runDiaryMonthly(now);
    } catch (error) {
      console.error("[lifeos] diary cron inside brief failed", error);
      extra.diaryFailed = true;
    }
  } else {
    extra.diarySkipped = "out of time";
  }

  return NextResponse.json({ ok: true, briefed: results.length, results, ...extra });
}
