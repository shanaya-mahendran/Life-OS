/**
 * Reset notifications.
 *
 * Reminders are deliberately generic: no commitment name and no notebook answer
 * ever appears in a notification. Every type can be switched off, pausing the
 * plan mutes all of them, and the agent sends at most one nudge a day beyond
 * the evening check-in.
 */

import { prisma } from "@/lib/db";
import { createSystemNotification } from "@/lib/notifications";
import { addZonedDays, dayKey, startOfZonedDay, utcToZoned, zonedToUtc } from "@/lib/time";
import {
  detectDrift,
  dueReviewPeriods,
  planDayNumber,
  planDayDate,
  type CheckinLike,
} from "./calc";
import type { ResetPlanBundle } from "./service";

interface ResetNotificationInput {
  plan: ResetPlanBundle;
  kind: "checkin" | "review" | "report" | "drift";
  dueAt: Date;
  title: string;
  message: string;
  link: string;
}

function sameDay(date: Date, todayKey: string, timeZone: string): boolean {
  return dayKey(date, timeZone) === todayKey;
}

async function recordNotification(input: ResetNotificationInput): Promise<boolean> {
  const { plan, kind, dueAt, title, message, link } = input;

  if (plan.status !== "active") return false;
  if (kind === "checkin" && !plan.notifyCheckin) return false;
  if (kind === "review" && !plan.notifyReviews) return false;
  if (kind === "report" && !plan.notifyReports) return false;
  if (kind === "drift" && !plan.notifyDrift) return false;

  const existing = await prisma.resetNotification.findUnique({
    where: { planId_kind_dueAt: { planId: plan.id, kind, dueAt } },
    select: { id: true },
  });
  if (existing) return false;

  try {
    await prisma.resetNotification.create({
      data: { planId: plan.id, userId: plan.userId, kind, dueAt, status: "sent", sentAt: new Date() },
    });
  } catch {
    // Unique race — another request delivered it first.
    return false;
  }

  await createSystemNotification({
    userId: plan.userId,
    type: `reset_${kind}`,
    title,
    message,
    link,
    metadata: { planId: plan.id, kind },
  });

  return true;
}

function timeOnDay(date: Date, value: string, timeZone: string): Date {
  const local = utcToZoned(date, timeZone);
  const [hour, minute] = value.split(":").map(Number);
  return zonedToUtc(
    {
      year: local.year,
      month: local.month,
      day: local.day,
      hour: Number.isFinite(hour) ? hour : 20,
      minute: Number.isFinite(minute) ? minute : 0,
    },
    timeZone,
  );
}

/**
 * Lazy reminder sync. Called on the plan home and by the cron endpoints, so the
 * section works even on deployments that cannot run sub-daily cron jobs.
 */
export async function syncResetNotifications(
  plan: ResetPlanBundle,
  now: Date,
  timeZone: string,
): Promise<{ delivered: number }> {
  if (plan.status !== "active" || !plan.startedAt) return { delivered: 0 };
  const startedAt = plan.startedAt;

  const day = planDayNumber(startedAt, now, timeZone);
  if (!day) return { delivered: 0 };

  const todayKey = dayKey(now, timeZone);
  let delivered = 0;

  // 1. Evening check-in, once per day.
  const checkinDue = timeOnDay(now, plan.checkinTime, timeZone);
  if (plan.notifyCheckin && now.getTime() >= checkinDue.getTime()) {
    const created = await recordNotification({
      plan,
      kind: "checkin",
      dueAt: checkinDue,
      title: "Your Reset check-in is ready",
      message: "One minute: mark today's commitments and close the loop.",
      link: "/reset/plan",
    });
    if (created) delivered += 1;
  }

  // 2. Review due on the morning of days 15, 30, 45, 60, 75 and 90.
  const duePeriods = dueReviewPeriods(day);
  const exact = duePeriods.find((period) => period.day === day);
  if (exact && plan.notifyReviews) {
    const dueAt = timeOnDay(now, "09:00", timeZone);
    if (now.getTime() >= dueAt.getTime()) {
      const created = await recordNotification({
        plan,
        kind: "review",
        dueAt,
        title: `Your day-${exact.day} review is ready`,
        message: "Three questions, then the report writes itself.",
        link: `/reset/notebook?day=${exact.day}`,
      });
      if (created) delivered += 1;
    }
  }

  // 3. One follow-up if a review notebook is still open 24 hours later.
  if (plan.notifyReviews) {
    for (const period of duePeriods) {
      if (period.day >= day) continue;
      const notebook = plan.notebooks.find((entry) => entry.reviewDay === period.day);
      if (notebook && (notebook.q1 || notebook.skipped)) continue;
      const reviewDate = planDayDate(startedAt, period.day, timeZone);
      const dueAt = addZonedDays(reviewDate, 1, timeZone);
      if (now.getTime() < dueAt.getTime()) continue;
      const created = await recordNotification({
        plan,
        kind: "review",
        dueAt,
        title: "Your Reset review is still open",
        message: "Answer the three questions when you have a minute — or skip it on purpose.",
        link: `/reset/notebook?day=${period.day}`,
      });
      if (created) delivered += 1;
      break;
    }
  }

  // 4. Report ready — only after the notebook is done, exactly once per report.
  if (plan.notifyReports) {
    for (const report of plan.reports) {
      if (report.status !== "ready") continue;
      const notebook = plan.notebooks.find((entry) => entry.reviewDay === report.reviewDay);
      if (!notebook) continue;
      const created = await recordNotification({
        plan,
        kind: "report",
        dueAt: report.createdAt,
        title: "Your report is ready",
        message: "Numbers, your notebook answers and one proposed focus.",
        link: `/reset/reports/${report.id}`,
      });
      if (created) delivered += 1;
    }
  }

  // 5. One drift nudge a day, at most.
  if (plan.notifyDrift) {
    const snoozed = plan.notifications.find(
      (entry) => entry.kind === "drift" && sameDay(entry.dueAt, todayKey, timeZone) && entry.status === "snoozed",
    );
    if (!snoozed) {
      const records: CheckinLike[] = plan.checkins.map((checkin) => ({
        commitmentId: checkin.commitmentId,
        dateKey: dayKey(checkin.date, timeZone),
        result: checkin.result,
      }));
      const active = plan.commitments.filter((commitment) => {
        if (commitment.status !== "active") return false;
        if (commitment.phase > plan.currentPhase) return false;
        if (commitment.kind === "cut" && plan.currentPhase > 1) return false;
        return true;
      });
      const drift = detectDrift(
        active.map((commitment) => ({
          id: commitment.id,
          title: commitment.title,
          kind: commitment.kind,
          phase: commitment.phase,
          status: commitment.status,
          cadence: commitment.cadence,
        })),
        records,
        todayKey,
      );
      if (drift.length) {
        const dueAt = timeOnDay(now, "10:00", timeZone);
        const created = await recordNotification({
          plan,
          kind: "drift",
          dueAt,
          title: "A suggestion for your plan",
          message: "One commitment needs a smaller next step. Nothing changes until you choose.",
          link: "/reset/plan",
        });
        if (created) delivered += 1;
      }
    }
  }

  return { delivered };
}

/** Called by the report builder after a notebook is saved. */
export async function notifyReportReady(
  plan: ResetPlanBundle,
  reportId: string,
  createdAt: Date,
): Promise<void> {
  if (plan.status !== "active" || !plan.notifyReports) return;
  await recordNotification({
    plan,
    kind: "report",
    dueAt: createdAt,
    title: "Your report is ready",
    message: "Numbers, your notebook answers and one proposed focus.",
    link: `/reset/reports/${reportId}`,
  });
}

export async function resetNotificationDueToday(
  planId: string,
  kind: "checkin" | "review" | "report" | "drift",
  now: Date,
  timeZone: string,
): Promise<boolean> {
  const notifications = await prisma.resetNotification.findMany({
    where: { planId, kind },
    select: { dueAt: true },
  });
  const todayKey = dayKey(now, timeZone);
  return notifications.some((entry) => sameDay(entry.dueAt, todayKey, timeZone));
}

export function resetNotificationStartOfDay(date: Date, timeZone: string): Date {
  return startOfZonedDay(date, timeZone);
}
