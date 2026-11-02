/**
 * Reset reports.
 *
 * Every number in a report is derived from Reset check-ins, notebook answers
 * and goal entries. Reports are built lazily when a review day is due, so the
 * section still works on deployments without sub-daily cron jobs.
 */

import type { ResetPeriodReport } from "@prisma/client";
import { prisma } from "@/lib/db";
import { dayKey } from "@/lib/time";
import type { ServiceUser } from "@/lib/calendar/service";
import {
  buildAgentSummary,
  calculateAdherence,
  dueReviewPeriods,
  latestDueReviewPeriod,
  longestStreak,
  planDayDate,
  planDayNumber,
  planStreak,
  type CheckinLike,
  type ReviewPeriod,
} from "./calc";
import { GOAL_AREA_LABEL, phaseForNumber } from "./constants";
import { getPlanForUser, type ResetPlanBundle } from "./service";
import { notifyReportReady } from "./notifications";

export interface ReportMetrics {
  reviewDay: number;
  kind: "review15" | "month" | "final";
  label: string;
  phaseLabel: string;
  periodStart: string;
  periodEnd: string;
  adherence: number;
  done: number;
  missed: number;
  skipped: number;
  total: number;
  streak: number;
  daysCheckedIn: number;
  previousAdherence: number | null;
  delta: number | null;
  best: { title: string; adherence: number; done: number; total: number } | null;
  mostMissed: { title: string; missed: number; adherence: number } | null;
  cuts: { title: string; done: number; missed: number; percent: number }[];
  wake: { title: string; done: number; total: number; percent: number } | null;
  timeOfDay: { bucket: string; done: number; missed: number }[];
  goals: {
    id: string;
    title: string;
    area: string;
    metric: string;
    unit: string;
    target: number;
    current: number;
    percent: number;
    entries: number;
  }[];
  perCommitment: { title: string; kind: string; done: number; missed: number; skipped: number; adherence: number }[];
}

function periodDates(plan: ResetPlanBundle, period: ReviewPeriod, timeZone: string) {
  if (!plan.startedAt) {
    const now = new Date();
    return { start: now, end: now };
  }
  const start = planDayDate(plan.startedAt, period.periodStartDay, timeZone);
  const end = planDayDate(plan.startedAt, period.periodEndDay + 1, timeZone);
  return { start, end };
}


export function reportForDay(plan: ResetPlanBundle, day: number): ResetPeriodReport | null {
  return plan.reports.find((report) => report.reviewDay === day) ?? null;
}

export function notebookForPeriod(plan: ResetPlanBundle, period: ReviewPeriod, _timeZone?: string) {
  return plan.notebooks.find((notebook) => notebook.reviewDay === period.day) ?? null;
}

export function dueNotebookPeriod(
  plan: ResetPlanBundle,
  now: Date,
  timeZone: string,
): ReviewPeriod | null {
  if (!plan.startedAt) return null;
  const day = planDayNumber(plan.startedAt, now, timeZone);
  const due = dueReviewPeriods(day).reverse();
  for (const period of due) {
    const notebook = notebookForPeriod(plan, period, timeZone);
    if (!notebook || (!notebook.skipped && !notebook.q1 && !notebook.q2 && !notebook.q3)) {
      return period;
    }
  }
  return null;
}

export function latestNotebookPeriod(
  plan: ResetPlanBundle,
  now: Date,
  timeZone: string,
): ReviewPeriod | null {
  if (!plan.startedAt) return null;
  return latestDueReviewPeriod(planDayNumber(plan.startedAt, now, timeZone));
}

/* -------------------------------------------------------------------------- */
/* Metrics                                                                     */
/* -------------------------------------------------------------------------- */

async function buildMetrics(
  plan: ResetPlanBundle,
  period: ReviewPeriod,
  timeZone: string,
): Promise<ReportMetrics> {
  const { start, end } = periodDates(plan, period, timeZone);
  const phase = phaseForNumber(period.kind === "final" ? 3 : period.day <= 30 ? 1 : period.day <= 60 ? 2 : 3);
  const commitments = plan.commitments.filter((commitment) => commitment.phase <= phase.phase);
  const ids = new Set(commitments.map((commitment) => commitment.id));
  const records: CheckinLike[] = plan.checkins
    .filter((checkin) => ids.has(checkin.commitmentId) && checkin.date >= start && checkin.date < end)
    .map((checkin) => ({
      commitmentId: checkin.commitmentId,
      dateKey: dayKey(checkin.date, timeZone),
      result: checkin.result,
    }));
  const totals = calculateAdherence(records);
  const checkedInDays = new Set(records.map((record) => record.dateKey));

  const perCommitment = commitments.map((commitment) => {
    const own = records.filter((record) => record.commitmentId === commitment.id);
    const stats = calculateAdherence(own);
    return {
      title: commitment.title,
      kind: commitment.kind,
      done: stats.done,
      missed: stats.missed,
      skipped: stats.skipped,
      adherence: stats.adherence,
    };
  });

  const rated = perCommitment.filter((entry) => entry.done + entry.missed + entry.skipped > 0);
  const best = [...rated].sort((a, b) => b.adherence - a.adherence || b.done - a.done)[0] ?? null;
  const mostMissed = [...rated].sort((a, b) => b.missed - a.missed || a.adherence - b.adherence)[0] ?? null;

  const cuts = commitments
    .filter((commitment) => commitment.kind === "cut" && period.day <= 30)
    .map((commitment) => {
      const own = records.filter((record) => record.commitmentId === commitment.id);
      const stats = calculateAdherence(own);
      return {
        title: commitment.title,
        done: stats.done,
        missed: stats.missed,
        percent: stats.adherence,
      };
    });

  const wakeCommitment = commitments.find(
    (commitment) => commitment.kind === "anchor" && /wake|morning/i.test(commitment.title),
  );
  const wakeRecords = wakeCommitment
    ? records.filter((record) => record.commitmentId === wakeCommitment.id)
    : [];
  const wakeStats = calculateAdherence(wakeRecords);

  const buckets = new Map<string, { done: number; missed: number }>();
  for (const commitment of commitments) {
    const own = records.filter((record) => record.commitmentId === commitment.id);
    const hour = Number(commitment.time.split(":")[0] ?? 9);
    const bucket = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
    const entry = buckets.get(bucket) ?? { done: 0, missed: 0 };
    entry.done += own.filter((record) => record.result === "done").length;
    entry.missed += own.filter((record) => record.result === "missed").length;
    buckets.set(bucket, entry);
  }

  const goalTracks = await prisma.goalTrack.findMany({
    where: { planId: plan.id, userId: plan.userId, status: "active" },
    include: {
      progress: { where: { date: { lt: end } }, orderBy: { date: "desc" }, take: 1 },
    },
  });

  const goals = goalTracks.map((track) => {
    const latest = track.progress[0]?.value ?? 0;
    return {
      id: track.id,
      title: track.title,
      area: GOAL_AREA_LABEL[track.goalArea] ?? track.goalArea,
      metric: track.metric,
      unit: track.unit,
      target: track.targetValue,
      current: latest,
      percent: track.targetValue > 0 ? Math.min(100, Math.round((latest / track.targetValue) * 100)) : 0,
      entries: track.progress.length,
    };
  });

  const previous = plan.reports
    .filter((report) => report.reviewDay < period.day)
    .sort((a, b) => b.reviewDay - a.reviewDay)[0];
  const previousMetrics = (previous?.metrics as Record<string, unknown> | null) ?? null;
  const previousAdherence =
    previousMetrics && typeof previousMetrics.adherence === "number" ? previousMetrics.adherence : null;

  const doneKeys = records.filter((record) => record.result === "done").map((record) => record.dateKey);
  const streak = Math.max(
    longestStreak(doneKeys),
    planStreak(records, dayKey(end, timeZone)),
  );

  return {
    reviewDay: period.day,
    kind: period.kind,
    label: period.label,
    phaseLabel: `${phase.name} · ${phase.days}`,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    adherence: totals.adherence,
    done: totals.done,
    missed: totals.missed,
    skipped: totals.skipped,
    total: totals.total,
    streak,
    daysCheckedIn: checkedInDays.size,
    previousAdherence,
    delta: previousAdherence === null ? null : totals.adherence - previousAdherence,
    best: best ? { title: best.title, adherence: best.adherence, done: best.done, total: best.done + best.missed + best.skipped } : null,
    mostMissed: mostMissed ? { title: mostMissed.title, missed: mostMissed.missed, adherence: mostMissed.adherence } : null,
    cuts,
    wake: wakeCommitment
      ? {
          title: wakeCommitment.title,
          done: wakeStats.done,
          total: wakeStats.total,
          percent: wakeStats.adherence,
        }
      : null,
    timeOfDay: ["Morning", "Afternoon", "Evening"].map((bucket) => ({
      bucket,
      ...(buckets.get(bucket) ?? { done: 0, missed: 0 }),
    })),
    goals,
    perCommitment,
  };
}

function summaryFor(
  metrics: ReportMetrics,
  notebook: ResetPlanBundle["notebooks"][number] | null,
  sendAnswersToAi: boolean,
): string {
  if (!notebook) {
    return `A numbers-only draft. ${metrics.done} done and ${metrics.missed} missed across ${metrics.total} check-ins. Add your notebook answers to complete it.`;
  }
  if (!sendAnswersToAi) {
    return `Answers are not sent to the agent on this plan. The report contains numbers only: ${metrics.done} done, ${metrics.missed} missed, ${metrics.adherence}% check-in rate. Write the summary yourself.`;
  }
  if (notebook.skipped) {
    return `You chose to skip the notebook for this review. The numbers are still here: ${metrics.done} done, ${metrics.missed} missed, ${metrics.adherence}% check-in rate.`;
  }

  const base = buildAgentSummary({
    noteQuote: notebook.q1,
    changeQuote: notebook.q3,
    adherence: metrics.adherence,
    done: metrics.done,
    missed: metrics.missed,
    best: metrics.best?.title,
    mostMissed: metrics.mostMissed?.title,
    goals: metrics.goals.map((goal) => ({
      title: goal.title,
      current: goal.current,
      target: goal.target,
      unit: goal.unit,
    })),
    kind: metrics.kind,
  });

  if (metrics.kind === "month" && metrics.previousAdherence !== null) {
    const change = metrics.adherence - metrics.previousAdherence;
    const direction = change === 0 ? "the same as the previous period" : change > 0 ? `${change} points above the previous period` : `${Math.abs(change)} points below the previous period`;
    return `${base} This month's check-in rate is ${direction}.`;
  }

  return base;
}

/* -------------------------------------------------------------------------- */
/* Build and persist                                                           */
/* -------------------------------------------------------------------------- */

async function upsertReport(
  plan: ResetPlanBundle,
  period: ReviewPeriod,
  timeZone: string,
  now: Date,
): Promise<ResetPeriodReport> {
  const metrics = await buildMetrics(plan, period, timeZone);
  const notebook = notebookForPeriod(plan, period, timeZone);
  const { start, end } = periodDates(plan, period, timeZone);
  const summary = summaryFor(metrics, notebook, plan.sendAnswersToAi);
  const ready = Boolean(notebook && (notebook.skipped || notebook.q1 || notebook.q2 || notebook.q3));

  const existing = plan.reports.find((report) => report.reviewDay === period.day);
  if (existing) {
    return prisma.resetPeriodReport.update({
      where: { id: existing.id },
      data: {
        metrics: metrics as unknown as object,
        status: ready ? "ready" : "draft",
        periodStart: start,
        periodEnd: end,
        ...(existing.editedByUser ? {} : { summary }),
      },
    });
  }

  return prisma.resetPeriodReport.create({
    data: {
      planId: plan.id,
      userId: plan.userId,
      kind: period.kind,
      reviewDay: period.day,
      periodStart: start,
      periodEnd: end,
      metrics: metrics as unknown as object,
      summary,
      status: ready ? "ready" : "draft",
    },
  });
}

export async function ensurePlanReports(
  plan: ResetPlanBundle,
  now: Date,
  timeZone: string,
): Promise<number> {
  if (!plan.startedAt) return 0;
  const day = planDayNumber(plan.startedAt, now, timeZone);
  if (day < 15) return 0;

  let built = 0;
  for (const period of dueReviewPeriods(day)) {
    const existing = plan.reports.find((report) => report.reviewDay === period.day);
    const notebook = notebookForPeriod(plan, period, timeZone);
    if (existing && (existing.status === "ready" || !notebook)) continue;
    await upsertReport(plan, period, timeZone, now);
    built += 1;
  }
  return built;
}

export async function saveResetNotebook(
  user: ServiceUser,
  planId: string,
  reviewDay: number,
  answers: { q1: string; q2: string; q3: string },
  skipped: boolean,
): Promise<{ ok: true; reportId: string; reviewDay: number } | { ok: false; message: string }> {
  const plan = await getPlanForUser(user.id, planId);
  if (!plan) return { ok: false, message: "Plan not found." };
  if (!plan.startedAt) return { ok: false, message: "The plan has not started yet." };

  const period = dueReviewPeriods(planDayNumber(plan.startedAt, new Date(), user.timezone)).find(
    (entry) => entry.day === reviewDay,
  );
  if (!period) return { ok: false, message: "That review day has not arrived yet." };

  const { start, end } = periodDates(plan, period, user.timezone);
  const q1 = skipped ? "" : answers.q1.trim().slice(0, 4000);
  const q2 = skipped ? "" : answers.q2.trim().slice(0, 4000);
  const q3 = skipped ? "" : answers.q3.trim().slice(0, 4000);    await prisma.resetNotebook.upsert({
    where: { planId_reviewDay: { planId: plan.id, reviewDay: period.day } },
    update: { q1, q2, q3, skipped, periodStart: start, periodEnd: end, kind: period.kind },
    create: {
      planId: plan.id,
      userId: plan.userId,
      kind: period.kind,
      reviewDay: period.day,
      periodStart: start,
      periodEnd: end,
      q1,
      q2,
      q3,
      skipped,
    },
  });

  const refreshed = (await getPlanForUser(user.id, plan.id)) as ResetPlanBundle;
  const report = await upsertReport(refreshed, period, user.timezone, new Date());
  await notifyReportReady(refreshed, report.id, report.createdAt);

  return { ok: true, reportId: report.id, reviewDay: period.day };
}

export async function updateReportSummary(
  userId: string,
  reportId: string,
  summary: string,
): Promise<{ ok: boolean; message?: string }> {
  const report = await prisma.resetPeriodReport.findFirst({ where: { id: reportId, userId } });
  if (!report) return { ok: false, message: "Report not found." };
  await prisma.resetPeriodReport.update({
    where: { id: report.id },
    data: { summary: summary.trim().slice(0, 6000), editedByUser: true },
  });
  return { ok: true };
}

export async function deleteReport(userId: string, reportId: string): Promise<boolean> {
  const report = await prisma.resetPeriodReport.findFirst({ where: { id: reportId, userId } });
  if (!report) return false;
  await prisma.resetPeriodReport.delete({ where: { id: report.id } });
  await prisma.resetNotebook.deleteMany({
    where: { planId: report.planId, userId, reviewDay: report.reviewDay },
  });
  return true;
}

export async function getReportForUser(userId: string, reportId: string) {
  return prisma.resetPeriodReport.findFirst({ where: { id: reportId, userId }, include: { plan: true } });
}

export function reportMetrics(report: ResetPeriodReport): ReportMetrics {
  return report.metrics as unknown as ReportMetrics;
}
