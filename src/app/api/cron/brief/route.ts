import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveBrief } from "@/lib/calendar/service";
import { briefDateKey, buildMorningBrief } from "@/lib/briefs";
import { serviceUserFromRow } from "@/lib/account";

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
      await prisma.notification.create({
        data: {
          userId: row.id,
          type: "morning_brief",
          title: "Morning Brief is Ready ☀️",
          message: brief.headline,
          link: "/today",
          metadata: { forDate: dateKey },
        },
      }).catch(() => {});

      results.push({ userId: row.id, headline: brief.headline });
    } catch (error) {
      console.error("[lifeos] morning brief failed for", row.id, error);
    }
  }

  return NextResponse.json({ ok: true, briefed: results.length, results });
}
