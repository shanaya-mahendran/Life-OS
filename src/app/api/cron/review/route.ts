import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveBrief } from "@/lib/calendar/service";
import { briefDateKey, buildWeeklyReview, currentWeekStart, proposeNextWeek } from "@/lib/briefs";
import { serviceUserFromRow } from "@/lib/account";
import { utcToZoned } from "@/lib/time";

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

/**
 * Vercel Cron → GET /api/cron/review (Bearer CRON_SECRET).
 * Runs Sunday evening in each user's own timezone; `?force=1` builds it anyway.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not configured on this deployment." }, { status: 503 });
  }
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const force = new URL(request.url).searchParams.get("force") === "1";
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

  let written = 0;
  const skipped: string[] = [];

  for (const row of users) {
    try {
      const user = serviceUserFromRow(row);
      const local = utcToZoned(now, user.timezone);
      const isSundayEvening = local.weekday === 0 && local.hour >= 17;
      if (!force && !isSundayEvening) {
        skipped.push(row.id);
        continue;
      }

      const weekStart = currentWeekStart(user.timezone, now);
      const review = await buildWeeklyReview(user, weekStart);
      const proposals = await proposeNextWeek(user, weekStart);
      const dateKey = briefDateKey(now, user.timezone);
      await saveBrief(row.id, "review", dateKey, review.headline, { review, proposals });

      // Create notification so user gets notified on Sunday evening
      await prisma.notification.create({
        data: {
          userId: row.id,
          type: "review",
          title: "Sunday Review is Ready 🌟",
          message: review.headline,
          link: "/review",
          metadata: { forDate: dateKey },
        },
      }).catch(() => {});

      written += 1;
    } catch (error) {
      console.error("[lifeos] weekly review failed for", row.id, error);
    }
  }

  return NextResponse.json({ ok: true, written, skipped: skipped.length });
}
