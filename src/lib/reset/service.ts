/**
 * Reset Plan engine.
 *
 * All writes for the 90-day program go through this module. The agent-facing
 * rule from the proposal is enforced here: nothing is written to the calendar
 * implicitly — approval, phase advance and an explicit calendar sync are the
 * only paths, and each one goes through the existing calendar service.
 */

import { randomUUID } from "node:crypto";
import { Prisma, type ResetCommitment } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ServiceUser } from "@/lib/calendar/service";
import { createEvent, createTask, previewConflicts } from "@/lib/calendar/service";
import { needsConfirmation, type Conflict } from "@/lib/calendar/conflicts";
import { addZonedDays, dayKey, startOfZonedDay, utcToZoned, zonedToUtc } from "@/lib/time";
import {
  RESET_DAYS,
  RESET_LIMITS,
  RESET_PHASES,
  phaseForNumber,
  type ResetKind,
} from "./constants";
import {
  bestAndMostMissed,
  buildGapDraft,
  calculateAdherence,
  commitmentStats,
  detectDrift,
  latestDueReviewPeriod,
  nextReviewPeriod,
  phaseForPlanDay,
  planDayNumber,
  planEndDate,
  planStreak,
  progressPercent,
  recentDayKeys,
  notebookComplete,
  type CheckinLike,
  type CommitmentLike,
  type DriftSuggestion,
  type GapReportDraft,
} from "./calc";

export const resetPlanInclude = Prisma.validator<Prisma.ResetPlanInclude>()({
  answers: { orderBy: { step: "asc" } },
  commitments: { orderBy: [{ phase: "asc" }, { sortOrder: "asc" }] },
  checkins: { orderBy: { date: "asc" } },
  notebooks: { orderBy: { periodStart: "asc" } },
  reports: { orderBy: { reviewDay: "asc" } },
  notifications: { orderBy: { dueAt: "asc" } },
  calendarEvents: { orderBy: { createdAt: "asc" } },
});

export type ResetPlanBundle = Prisma.ResetPlanGetPayload<{ include: typeof resetPlanInclude }>;

export interface CommitmentInput {
  phase: number;
  kind: ResetKind;
  title: string;
  notes?: string;
  domainSlug?: string;
  cadence?: "daily" | "weekly";
  weekday?: number | null;
  time?: string;
  durationMinutes?: number;
  calendarEnabled?: boolean;
  goalArea?: string | null;
  metric?: string;
  unit?: string;
  targetValue?: number | null;
}

export interface PlanSettingsInput {
  checkinTime?: string;
  autonomy?: "suggest" | "auto_small";
  sendAnswersToAi?: boolean;
  notifyCheckin?: boolean;
  notifyReviews?: boolean;
  notifyReports?: boolean;
  notifyDrift?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

export async function getPlanForUser(userId: string, planId: string): Promise<ResetPlanBundle | null> {
  return prisma.resetPlan.findFirst({
    where: { id: planId, userId },
    include: resetPlanInclude,
  });
}

export async function getCurrentPlan(userId: string): Promise<ResetPlanBundle | null> {
  return prisma.resetPlan.findFirst({
    where: { userId, status: { in: ["draft", "active", "paused"] } },
    orderBy: { createdAt: "desc" },
    include: resetPlanInclude,
  });
}

export async function getLatestPlan(userId: string): Promise<ResetPlanBundle | null> {
  return prisma.resetPlan.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: resetPlanInclude,
  });
}

export async function createResetPlan(userId: string): Promise<ResetPlanBundle> {
  const existing = await getCurrentPlan(userId);
  if (existing) return existing;

  const plan = await prisma.resetPlan.create({ data: { userId } });
  return getPlanForUser(userId, plan.id) as Promise<ResetPlanBundle>;
}

export function resetDay(plan: ResetPlanBundle, now: Date, timeZone: string): number {
  return planDayNumber(plan.startedAt, now, timeZone);
}

export function activeCommitmentsForDay(plan: ResetPlanBundle, day: number): ResetPlanBundle["commitments"] {
  // Phase changes are explicit: reaching day 31 does not move the plan on its
  // own. Until the user accepts the next phase (or the plan is completed), the
  // current phase remains authoritative.
  const phase = plan.status === "completed" ? phaseForPlanDay(day).phase : Math.max(1, Math.min(3, plan.currentPhase));
  return plan.commitments.filter((commitment) => {
    if (commitment.status !== "active") return false;
    if (commitment.phase > phase) return false;
    // Cuts belong to Month 1. Later months keep anchors, routines and goals.
    if (commitment.kind === "cut" && phase > 1) return false;
    return true;
  });
}

export function commitmentsForPhase(plan: ResetPlanBundle, phase: number): ResetPlanBundle["commitments"] {
  return plan.commitments.filter((commitment) => commitment.phase === phase && commitment.status === "active");
}

export function checkinRecords(plan: ResetPlanBundle, timeZone: string): CheckinLike[] {
  return plan.checkins.map((checkin) => ({
    commitmentId: checkin.commitmentId,
    dateKey: dayKey(checkin.date, timeZone),
    result: checkin.result,
  }));
}

export function answersComplete(plan: ResetPlanBundle): boolean {
  return [1, 2, 3].every((step) => {
    const answer = plan.answers.find((entry) => entry.step === step)?.answer ?? "";
    return answer.trim().length > 0;
  });
}

export interface PlanStats {
  day: number;
  phase: ReturnType<typeof phaseForPlanDay>;
  progress: number;
  todayKey: string;
  nextReview: ReturnType<typeof nextReviewPeriod>;
  latestReview: ReturnType<typeof latestDueReviewPeriod>;
  adherence: number;
  done: number;
  missed: number;
  skipped: number;
  total: number;
  streak: number;
  commitments: ReturnType<typeof commitmentStats>;
  today: {
    commitment: ResetCommitment;
    todayResult: string | null;
    weekResult: string | null;
    streak: number;
    adherence: number;
  }[];
  drift: DriftSuggestion[];
  best: ReturnType<typeof bestAndMostMissed>["best"];
  mostMissed: ReturnType<typeof bestAndMostMissed>["mostMissed"];
}

export function getPlanStats(plan: ResetPlanBundle, now: Date, timeZone: string): PlanStats {
  const day = resetDay(plan, now, timeZone);
  const todayKey = dayKey(now, timeZone);
  const active = activeCommitmentsForDay(plan, day || 1);
  const records = checkinRecords(plan, timeZone);
  const windowKeys = new Set(recentDayKeys(todayKey, 15));
  const activeIds = new Set(active.map((commitment) => commitment.id));
  const windowRecords = records.filter((record) => activeIds.has(record.commitmentId) && windowKeys.has(record.dateKey));
  const adherence = calculateAdherence(windowRecords);
  const stats = commitmentStats(
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
    15,
  );
  const { best, mostMissed } = bestAndMostMissed(stats);
  const weekKeys = new Set(recentDayKeys(todayKey, 7));

  return {
    day,
    phase: plan.status === "completed" ? phaseForPlanDay(day || 1) : phaseForNumber(Math.max(1, Math.min(3, plan.currentPhase))),
    progress: progressPercent(day),
    todayKey,
    nextReview: nextReviewPeriod(day),
    latestReview: latestDueReviewPeriod(day),
    adherence: adherence.adherence,
    done: adherence.done,
    missed: adherence.missed,
    skipped: adherence.skipped,
    total: adherence.total,
    streak: planStreak(records, todayKey),
    commitments: stats,
    today: active.map((commitment) => {
      const own = records.filter((record) => record.commitmentId === commitment.id);
      const todayResult = own.find((record) => record.dateKey === todayKey)?.result ?? null;
      const weekResult =
        own
          .filter((record) => weekKeys.has(record.dateKey))
          .sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0]?.result ?? null;
      const stat = stats.find((entry) => entry.commitmentId === commitment.id);
      return {
        commitment,
        todayResult,
        weekResult,
        streak: stat?.streak ?? 0,
        adherence: stat?.adherence ?? 0,
      };
    }),
    drift: detectDrift(
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
    ),
    best,
    mostMissed,
  };
}

/* -------------------------------------------------------------------------- */
/* Audit, gap report and starter plan                                          */
/* -------------------------------------------------------------------------- */

export async function saveAuditAnswer(
  userId: string,
  planId: string,
  step: number,
  answer: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const plan = await getPlanForUser(userId, planId);
  if (!plan) return { ok: false, message: "Plan not found." };
  if (plan.status === "completed") return { ok: false, message: "This plan is closed." };
  if (step < 1 || step > 3) return { ok: false, message: "Unknown audit step." };

  const prompt = ["", "Where am I right now?", "Where should I be in 90 days?", "What happened when I tried before?"][step];
  await prisma.resetAnswer.upsert({
    where: { planId_step: { planId, step } },
    update: { answer, prompt },
    create: { planId, userId, step, prompt, answer },
  });

  return { ok: true };
}

export async function generateGapReport(
  userId: string,
  planId: string,
): Promise<{ ok: true; report: GapReportDraft } | { ok: false; message: string }> {
  const plan = await getPlanForUser(userId, planId);
  if (!plan) return { ok: false, message: "Plan not found." };

  const report = buildGapDraft(
    plan.answers.map((answer) => ({ step: answer.step, answer: answer.answer })),
    { checkinTime: plan.checkinTime },
  );

  await prisma.resetPlan.update({
    where: { id: plan.id },
    data: { gapReport: report as unknown as Prisma.InputJsonValue },
  });

  return { ok: true, report };
}

export async function saveGapReport(
  userId: string,
  planId: string,
  patch: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const plan = await getPlanForUser(userId, planId);
  if (!plan) return { ok: false, message: "Plan not found." };
  if (plan.status === "completed") return { ok: false, message: "This plan is closed." };

  const existing = (plan.gapReport as Record<string, unknown> | null) ?? {};
  const allowed = [
    "generatedAt",
    "currentQuote",
    "targetQuote",
    "patternQuote",
    "summary",
    "patterns",
    "topGaps",
    "cutCandidates",
    "anchorCandidates",
    "recommendedFocus",
    "notes",
  ];
  const safe: Record<string, unknown> = { ...existing };
  for (const key of allowed) {
    if (patch[key] !== undefined) safe[key] = patch[key];
  }

  await prisma.resetPlan.update({
    where: { id: plan.id },
    data: { gapReport: safe as Prisma.InputJsonValue },
  });

  return { ok: true };
}

export async function approveGapReport(
  userId: string,
  planId: string,
  user: ServiceUser,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const plan = await getPlanForUser(userId, planId);
  if (!plan) return { ok: false, message: "Plan not found." };
  if (!answersComplete(plan)) return { ok: false, message: "Finish all three audit steps first." };

  await prisma.resetPlan.update({
    where: { id: plan.id },
    data: { gapApprovedAt: new Date() },
  });
  await ensureStarterCommitments(plan, user);
  return { ok: true };
}

export async function ensureStarterCommitments(plan: ResetPlanBundle, user: ServiceUser): Promise<void> {
  const count = plan.commitments.length;
  if (count > 0) return;

  await prisma.resetCommitment.createMany({
    data: [
      {
        planId: plan.id,
        userId: plan.userId,
        phase: 1,
        kind: "anchor",
        title: "Same wake-up time every day",
        notes: `Target wake-up: ${user.wakeTime}. The point is the same time, not an earlier time.`,
        domainSlug: "sleep",
        cadence: "daily",
        time: user.wakeTime,
        durationMinutes: 15,
        sortOrder: 0,
      },
      {
        planId: plan.id,
        userId: plan.userId,
        phase: 1,
        kind: "anchor",
        title: "Finish one task before noon",
        notes: "One small, real task. Not the whole list.",
        domainSlug: "planning",
        cadence: "daily",
        time: "11:00",
        durationMinutes: 30,
        sortOrder: 1,
      },
    ],
  });
}

/* -------------------------------------------------------------------------- */
/* Commitments                                                                 */
/* -------------------------------------------------------------------------- */

function limitForKind(kind: ResetKind): number {
  if (kind === "cut") return RESET_LIMITS.cuts;
  if (kind === "nonnegotiable") return RESET_LIMITS.nonnegotiables;
  if (kind === "goal") return RESET_LIMITS.goals;
  if (kind === "challenge") return RESET_LIMITS.challenges;
  if (kind === "routine") return RESET_LIMITS.routines;
  return RESET_LIMITS.anchors;
}

function normaliseTime(value: string | undefined, fallback = "09:00"): string {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return fallback;
  const [hour, minute] = value.split(":").map(Number);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
  return value;
}

function normaliseWeekday(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number.isInteger(value) && value >= 0 && value <= 6 ? value : null;
}

export async function createCommitment(
  userId: string,
  planId: string,
  input: CommitmentInput,
  user: ServiceUser,
): Promise<{ ok: true; commitment: ResetCommitment; needsSync: boolean } | { ok: false; message: string }> {
  const plan = await getPlanForUser(userId, planId);
  if (!plan) return { ok: false, message: "Plan not found." };
  if (plan.status === "completed") return { ok: false, message: "This plan is closed." };

  const phase = phaseForNumber(input.phase);
  if (!phase.kinds.includes(input.kind)) {
    return { ok: false, message: `${input.kind} does not belong to ${phase.name}.` };
  }
  if (phase.phase > plan.unlockedPhase) {
    return { ok: false, message: `${phase.name} is still locked. Unlock it first.` };
  }

  const title = input.title.trim();
  if (!title) return { ok: false, message: "Give the commitment a title." };
  if (title.length > 160) return { ok: false, message: "Keep the title under 160 characters." };

  const sameKind = plan.commitments.filter((commitment) => commitment.status === "active" && commitment.kind === input.kind);
  if (sameKind.length >= limitForKind(input.kind)) {
    return { ok: false, message: `You can keep at most ${limitForKind(input.kind)} ${input.kind}s at a time.` };
  }

  const goalArea = input.kind === "goal" ? input.goalArea || null : null;
  if (input.kind === "goal") {
    if (!goalArea) return { ok: false, message: "Choose finances, productivity or personal growth." };
    const duplicate = plan.commitments.find(
      (commitment) => commitment.status === "active" && commitment.kind === "goal" && commitment.goalArea === goalArea,
    );
    if (duplicate) return { ok: false, message: `You already have a ${goalArea} goal.` };
  }

  const domain = await prisma.domain.findFirst({
    where: { userId, slug: input.domainSlug || "planning" },
    select: { slug: true },
  });

  const commitment = await prisma.resetCommitment.create({
    data: {
      planId: plan.id,
      userId,
      phase: phase.phase,
      kind: input.kind,
      title,
      notes: input.notes?.slice(0, 2000) ?? "",
      domainSlug: domain?.slug ?? "planning",
      cadence: input.cadence === "weekly" ? "weekly" : "daily",
      weekday: normaliseWeekday(input.weekday),
      time: normaliseTime(input.time),
      durationMinutes: Math.max(5, Math.min(240, Math.round(input.durationMinutes ?? 30))),
      calendarEnabled: input.calendarEnabled !== false,
      goalArea,
      metric: input.metric?.trim().slice(0, 80) ?? "",
      unit: input.unit?.trim().slice(0, 40) ?? "",
      targetValue:
        typeof input.targetValue === "number" && Number.isFinite(input.targetValue) && input.targetValue > 0
          ? input.targetValue
          : null,
      sortOrder: plan.commitments.length,
    },
  });

  if (plan.status === "active" && commitment.phase <= plan.currentPhase) {
    await ensureHabitForCommitment(plan, commitment);
    await ensureGoalTrackForCommitment(plan, commitment);
  }

  return {
    ok: true,
    commitment,
    needsSync: plan.status === "active" && commitment.phase <= plan.currentPhase && commitment.calendarEnabled,
  };
}

export async function updateCommitment(
  userId: string,
  commitmentId: string,
  patch: Partial<CommitmentInput>,
): Promise<{ ok: true; commitment: ResetCommitment } | { ok: false; message: string }> {
  const existing = await prisma.resetCommitment.findFirst({
    where: { id: commitmentId, userId },
    include: { plan: true },
  });
  if (!existing) return { ok: false, message: "Commitment not found." };
  if (existing.plan.status === "completed") return { ok: false, message: "This plan is closed." };

  const title = patch.title !== undefined ? patch.title.trim() : existing.title;
  if (!title) return { ok: false, message: "Give the commitment a title." };

  let goalArea = existing.goalArea;
  if (existing.kind === "goal" && patch.goalArea !== undefined) {
    const nextArea = patch.goalArea || null;
    if (!nextArea) return { ok: false, message: "Choose finances, productivity or personal growth." };
    const duplicate = await prisma.resetCommitment.findFirst({
      where: {
        userId,
        planId: existing.planId,
        kind: "goal",
        status: "active",
        goalArea: nextArea,
        NOT: { id: existing.id },
      },
    });
    if (duplicate) return { ok: false, message: `You already have a ${nextArea} goal.` };
    goalArea = nextArea;
  }

  const domain = patch.domainSlug
    ? await prisma.domain.findFirst({ where: { userId, slug: patch.domainSlug }, select: { slug: true } })
    : null;

  const commitment = await prisma.resetCommitment.update({
    where: { id: existing.id },
    data: {
      title,
      ...(patch.notes !== undefined ? { notes: patch.notes.slice(0, 2000) } : {}),
      ...(domain ? { domainSlug: domain.slug } : {}),
      ...(patch.cadence ? { cadence: patch.cadence === "weekly" ? "weekly" : "daily" } : {}),
      ...(patch.weekday !== undefined ? { weekday: normaliseWeekday(patch.weekday) } : {}),
      ...(patch.time !== undefined ? { time: normaliseTime(patch.time, existing.time) } : {}),
      ...(patch.durationMinutes !== undefined
        ? { durationMinutes: Math.max(5, Math.min(240, Math.round(patch.durationMinutes))) }
        : {}),
      ...(patch.calendarEnabled !== undefined ? { calendarEnabled: patch.calendarEnabled } : {}),
      ...(existing.kind === "goal" ? { goalArea } : {}),
      ...(patch.metric !== undefined ? { metric: patch.metric.trim().slice(0, 80) } : {}),
      ...(patch.unit !== undefined ? { unit: patch.unit.trim().slice(0, 40) } : {}),
      ...(patch.targetValue !== undefined
        ? {
            targetValue:
              typeof patch.targetValue === "number" && patch.targetValue > 0 ? patch.targetValue : null,
          }
        : {}),
    },
  });

  if (existing.plan.status === "active" && commitment.phase <= existing.plan.currentPhase) {
    await ensureHabitForCommitment(existing.plan as ResetPlanBundle, commitment);
    await ensureGoalTrackForCommitment(existing.plan as ResetPlanBundle, commitment);
  }

  return { ok: true, commitment };
}

export async function deleteCommitment(
  userId: string,
  commitmentId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const commitment = await prisma.resetCommitment.findFirst({
    where: { id: commitmentId, userId },
    include: { plan: true },
  });
  if (!commitment) return { ok: false, message: "Commitment not found." };
  if (commitment.plan.status === "completed") return { ok: false, message: "This plan is closed." };

  const links = await prisma.resetPlanEvent.findMany({
    where: { planId: commitment.planId, commitmentId: commitment.id, userId },
    select: { eventId: true },
  });
  if (links.length) {
    await prisma.event.deleteMany({ where: { userId, id: { in: links.map((link) => link.eventId) } } });
  }

  await prisma.resetCommitment.delete({ where: { id: commitment.id } });
  return { ok: true };
}

async function ensureHabitForCommitment(plan: ResetPlanBundle, commitment: ResetCommitment): Promise<void> {
  await prisma.habit.upsert({
    where: { commitmentId: commitment.id },
    update: {
      title: commitment.title,
      notes: commitment.notes,
      source: "reset_plan",
      domainSlug: commitment.domainSlug,
      cadence: commitment.cadence,
      weekday: commitment.weekday,
      status: commitment.status === "active" ? "active" : "archived",
    },
    create: {
      userId: plan.userId,
      planId: plan.id,
      commitmentId: commitment.id,
      title: commitment.title,
      notes: commitment.notes,
      source: "reset_plan",
      domainSlug: commitment.domainSlug,
      cadence: commitment.cadence,
      weekday: commitment.weekday,
      status: commitment.status === "active" ? "active" : "archived",
    },
  });
}

async function ensureGoalTrackForCommitment(plan: ResetPlanBundle, commitment: ResetCommitment): Promise<void> {
  if (commitment.kind !== "goal") return;
  if (!commitment.metric || !commitment.unit || !commitment.targetValue) {
    await prisma.goalTrack.updateMany({
      where: { commitmentId: commitment.id },
      data: { status: "archived" },
    });
    return;
  }

  await prisma.goalTrack.upsert({
    where: { commitmentId: commitment.id },
    update: {
      title: commitment.title,
      goalArea: commitment.goalArea ?? "personal",
      metric: commitment.metric,
      unit: commitment.unit,
      targetValue: commitment.targetValue,
      cadence: commitment.cadence === "daily" ? "day" : "week",
      status: "active",
    },
    create: {
      userId: plan.userId,
      planId: plan.id,
      commitmentId: commitment.id,
      title: commitment.title,
      goalArea: commitment.goalArea ?? "personal",
      metric: commitment.metric,
      unit: commitment.unit,
      targetValue: commitment.targetValue,
      cadence: commitment.cadence === "daily" ? "day" : "week",
      status: "active",
    },
  });
}

export async function unlockResetPhase(
  userId: string,
  planId: string,
  phase: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const plan = await getPlanForUser(userId, planId);
  if (!plan) return { ok: false, message: "Plan not found." };
  const next = Math.max(plan.unlockedPhase, Math.min(3, Math.max(1, phase)));
  await prisma.resetPlan.update({ where: { id: plan.id }, data: { unlockedPhase: next } });
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Calendar approval                                                           */
/* -------------------------------------------------------------------------- */

const WEEKDAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function recurrenceFor(commitment: ResetCommitment): string {
  if (commitment.cadence === "weekly") {
    return `WEEKLY:${WEEKDAY_CODES[commitment.weekday ?? 1]}`;
  }
  return "DAILY";
}

function firstEventStart(commitment: ResetCommitment, now: Date, timeZone: string): Date {
  const local = utcToZoned(now, timeZone);
  const [hour, minute] = commitment.time.split(":").map(Number);
  let candidate = zonedToUtc(
    {
      year: local.year,
      month: local.month,
      day: local.day,
      hour: Number.isFinite(hour) ? hour : 9,
      minute: Number.isFinite(minute) ? minute : 0,
    },
    timeZone,
  );

  if (commitment.cadence === "weekly") {
    const target = commitment.weekday ?? 1;
    let delta = (target - local.weekday + 7) % 7;
    if (delta === 0 && candidate.getTime() <= now.getTime()) delta = 7;
    candidate = addZonedDays(candidate, delta, timeZone);
  } else if (candidate.getTime() <= now.getTime()) {
    candidate = addZonedDays(candidate, 1, timeZone);
  }

  return candidate;
}

interface CalendarBatchResult {
  ok: boolean;
  requiresConfirmation?: boolean;
  conflicts: Conflict[];
  batchId?: string;
  created: number;
  message?: string;
}

async function previewCommitments(
  user: ServiceUser,
  plan: ResetPlanBundle,
  commitments: ResetCommitment[],
): Promise<Conflict[]> {
  const now = new Date();
  const conflicts: Conflict[] = [];
  for (const commitment of commitments) {
    if (!commitment.calendarEnabled) continue;
    const start = firstEventStart(commitment, now, user.timezone);
    const end = new Date(start.getTime() + commitment.durationMinutes * 60_000);
    const found = await previewConflicts(user, {
      title: commitment.title,
      start,
      end,
      domainSlug: commitment.domainSlug,
    });
    for (const conflict of found) {
      if (!conflicts.some((entry) => entry.message === conflict.message)) conflicts.push(conflict);
    }
  }
  return conflicts;
}

async function createBatch(
  user: ServiceUser,
  plan: ResetPlanBundle,
  commitments: ResetCommitment[],
  force: boolean,
): Promise<CalendarBatchResult> {
  if (!commitments.length) {
    return { ok: false, conflicts: [], created: 0, message: "Add at least one commitment for this phase first." };
  }

  if (!force) {
    const conflicts = await previewCommitments(user, plan, commitments);
    if (needsConfirmation(conflicts)) {
      return {
        ok: false,
        requiresConfirmation: true,
        conflicts,
        created: 0,
        message: "These blocks need a yes before they are booked.",
      };
    }
  }

  const batchId = randomUUID();
  const now = new Date();
  const until = planEndDate(plan.startedAt ?? now, user.timezone);
  const created: { eventId: string; commitmentId: string }[] = [];

  try {
    for (const commitment of commitments) {
      if (!commitment.calendarEnabled) continue;
      const start = firstEventStart(commitment, now, user.timezone);
      const end = new Date(start.getTime() + commitment.durationMinutes * 60_000);
      const phase = phaseForNumber(commitment.phase);
      const result = await createEvent(user, {
        domainSlug: commitment.domainSlug,
        title: commitment.title,
        start,
        end,
        description: `Reset Plan · ${phase.name} · ${phase.days}`,
        recurrence: recurrenceFor(commitment),
        recurrenceUntil: until,
        source: "agent",
        force: true,
        priority: 2,
      });

      if (!result.ok || !result.event) {
        throw new Error(result.message ?? `Could not book “${commitment.title}”.`);
      }

      await prisma.resetPlanEvent.create({
        data: {
          planId: plan.id,
          userId: user.id,
          commitmentId: commitment.id,
          eventId: result.event.id,
          batchId,
        },
      });
      created.push({ eventId: result.event.id, commitmentId: commitment.id });
    }
  } catch (error) {
    if (created.length) {
      await prisma.event.deleteMany({ where: { userId: user.id, id: { in: created.map((entry) => entry.eventId) } } });
      await prisma.resetPlanEvent.deleteMany({
        where: { userId: user.id, batchId, eventId: { in: created.map((entry) => entry.eventId) } },
      });
    }
    return {
      ok: false,
      conflicts: [],
      created: 0,
      message: error instanceof Error ? error.message : "Could not book the plan blocks.",
    };
  }

  return { ok: true, conflicts: [], batchId, created: created.length };
}

export async function approveResetPlan(
  user: ServiceUser,
  planId: string,
  options: { force?: boolean } = {},
): Promise<CalendarBatchResult & { startedAt?: Date }> {
  const plan = await getPlanForUser(user.id, planId);
  if (!plan) return { ok: false, conflicts: [], created: 0, message: "Plan not found." };
  if (plan.status === "active") {
    return { ok: false, conflicts: [], created: 0, message: "This plan is already running." };
  }
  if (!plan.gapApprovedAt) {
    return { ok: false, conflicts: [], created: 0, message: "Approve the gap report before starting the plan." };
  }

  const commitments = commitmentsForPhase(plan, 1);
  const result = await createBatch(user, plan, commitments, Boolean(options.force));
  if (!result.ok) return result;

  const startedAt = startOfZonedDay(new Date(), user.timezone);
  await prisma.resetPlan.update({
    where: { id: plan.id },
    data: {
      status: "active",
      startedAt,
      currentPhase: 1,
      unlockedPhase: Math.max(1, plan.unlockedPhase),
    },
  });

  const refreshed = (await getPlanForUser(user.id, plan.id)) as ResetPlanBundle;
  for (const commitment of commitments) {
    await ensureHabitForCommitment(refreshed, commitment);
    await ensureGoalTrackForCommitment(refreshed, commitment);
  }

  return { ...result, startedAt };
}

export async function undoResetBatch(
  userId: string,
  planId: string,
  batchId: string,
): Promise<{ ok: true; removed: number } | { ok: false; message: string }> {
  const links = await prisma.resetPlanEvent.findMany({
    where: { planId, batchId, userId },
    select: { eventId: true },
  });
  if (!links.length) return { ok: false, message: "Nothing to undo for that batch." };

  await prisma.event.deleteMany({ where: { userId, id: { in: links.map((link) => link.eventId) } } });
  await prisma.resetPlanEvent.deleteMany({ where: { planId, batchId, userId } });
  return { ok: true, removed: links.length };
}

export async function syncResetCalendar(
  user: ServiceUser,
  planId: string,
  options: { force?: boolean } = {},
): Promise<CalendarBatchResult> {
  const plan = await getPlanForUser(user.id, planId);
  if (!plan) return { ok: false, conflicts: [], created: 0, message: "Plan not found." };
  if (plan.status !== "active") {
    return { ok: false, conflicts: [], created: 0, message: "Approve the plan before syncing the calendar." };
  }

  const commitments = commitmentsForPhase(plan, plan.currentPhase);
  if (!commitments.length) {
    return { ok: false, conflicts: [], created: 0, message: "This phase has no commitments yet." };
  }

  const commitmentIds = commitments.map((commitment) => commitment.id);
  const oldLinks = await prisma.resetPlanEvent.findMany({
    where: { planId: plan.id, userId: user.id, commitmentId: { in: commitmentIds } },
    select: { eventId: true },
  });
  if (oldLinks.length) {
    await prisma.event.deleteMany({ where: { userId: user.id, id: { in: oldLinks.map((link) => link.eventId) } } });
    await prisma.resetPlanEvent.deleteMany({
      where: { planId: plan.id, userId: user.id, commitmentId: { in: commitmentIds } },
    });
  }

  return createBatch(user, plan, commitments, true);
}

export async function advanceResetPhase(
  user: ServiceUser,
  planId: string,
  options: { force?: boolean } = {},
): Promise<CalendarBatchResult & { phase?: number }> {
  const plan = await getPlanForUser(user.id, planId);
  if (!plan) return { ok: false, conflicts: [], created: 0, message: "Plan not found." };
  if (plan.status !== "active") return { ok: false, conflicts: [], created: 0, message: "This plan is not running." };
  if (plan.currentPhase >= 3) return { ok: false, conflicts: [], created: 0, message: "You are in the final phase." };

  const day = resetDay(plan, new Date(), user.timezone);
  const requiredDay = plan.currentPhase === 1 ? 30 : 60;
  if (day < requiredDay) {
    return {
      ok: false,
      conflicts: [],
      created: 0,
      message: `The next phase opens on day ${requiredDay + 1}. You are on day ${day}.`,
    };
  }

  const nextPhase = plan.currentPhase + 1;
  const commitments = commitmentsForPhase(plan, nextPhase);
  const result = await createBatch(user, plan, commitments, Boolean(options.force));
  if (!result.ok) return result;

  await prisma.resetPlan.update({
    where: { id: plan.id },
    data: { currentPhase: nextPhase, unlockedPhase: Math.max(plan.unlockedPhase, nextPhase) },
  });

  const refreshed = (await getPlanForUser(user.id, plan.id)) as ResetPlanBundle;
  for (const commitment of commitments) {
    await ensureHabitForCommitment(refreshed, commitment);
    await ensureGoalTrackForCommitment(refreshed, commitment);
  }

  return { ...result, phase: nextPhase };
}

/* -------------------------------------------------------------------------- */
/* Check-ins                                                                   */
/* -------------------------------------------------------------------------- */

export async function recordResetCheckin(
  user: ServiceUser,
  planId: string,
  commitmentId: string,
  result: string,
  requestedDateKey?: string,
): Promise<{ ok: true; dateKey: string; result: string } | { ok: false; message: string }> {
  if (!["done", "skipped", "missed"].includes(result)) {
    return { ok: false, message: "Unknown check-in result." };
  }

  const plan = await getPlanForUser(user.id, planId);
  if (!plan) return { ok: false, message: "Plan not found." };
  if (plan.status !== "active") return { ok: false, message: "Start the plan before checking in." };

  const commitment = plan.commitments.find((entry) => entry.id === commitmentId && entry.status === "active");
  if (!commitment) return { ok: false, message: "That commitment is not active." };

  const today = dayKey(new Date(), user.timezone);
  let targetKey = requestedDateKey && /^\d{4}-\d{2}-\d{2}$/.test(requestedDateKey) ? requestedDateKey : today;
  if (targetKey > today) targetKey = today;
  if (plan.startedAt) {
    const startKey = dayKey(plan.startedAt, user.timezone);
    if (targetKey < startKey) targetKey = today;
  }

  let date = zonedToUtc(
    {
      year: Number(targetKey.slice(0, 4)),
      month: Number(targetKey.slice(5, 7)),
      day: Number(targetKey.slice(8, 10)),
    },
    user.timezone,
  );

  // A weekly commitment has one check-in per week: update the existing entry
  // instead of accumulating a second one on another day.
  if (commitment.cadence === "weekly") {
    const recent = await prisma.resetCheckin.findFirst({
      where: {
        commitmentId: commitment.id,
        userId: user.id,
        date: { gte: addZonedDays(startOfZonedDay(new Date(), user.timezone), -6, user.timezone) },
      },
      orderBy: { date: "desc" },
    });
    if (recent) date = recent.date;
  }

  await prisma.resetCheckin.upsert({
    where: { commitmentId_date: { commitmentId: commitment.id, date } },
    update: { result },
    create: { planId: plan.id, userId: user.id, commitmentId: commitment.id, date, result },
  });

  return { ok: true, dateKey: targetKey, result };
}

export async function clearResetCheckin(
  userId: string,
  planId: string,
  commitmentId: string,
  dateKeyValue: string,
): Promise<void> {
  const plan = await getPlanForUser(userId, planId);
  if (!plan) return;
  const date = zonedToUtc(
    {
      year: Number(dateKeyValue.slice(0, 4)),
      month: Number(dateKeyValue.slice(5, 7)),
      day: Number(dateKeyValue.slice(8, 10)),
    },
    "UTC",
  );
  await prisma.resetCheckin.deleteMany({ where: { planId, userId, commitmentId, date } });
}

/* -------------------------------------------------------------------------- */
/* Settings, pause and close                                                    */
/* -------------------------------------------------------------------------- */

export async function updatePlanSettings(
  userId: string,
  planId: string,
  input: PlanSettingsInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const plan = await getPlanForUser(userId, planId);
  if (!plan) return { ok: false, message: "Plan not found." };

  if (input.checkinTime && !/^\d{2}:\d{2}$/.test(input.checkinTime)) {
    return { ok: false, message: "Use a valid check-in time." };
  }

  await prisma.resetPlan.update({
    where: { id: plan.id },
    data: {
      ...(input.checkinTime ? { checkinTime: input.checkinTime } : {}),
      ...(input.autonomy ? { autonomy: input.autonomy === "auto_small" ? "auto_small" : "suggest" } : {}),
      ...(input.sendAnswersToAi !== undefined ? { sendAnswersToAi: input.sendAnswersToAi } : {}),
      ...(input.notifyCheckin !== undefined ? { notifyCheckin: input.notifyCheckin } : {}),
      ...(input.notifyReviews !== undefined ? { notifyReviews: input.notifyReviews } : {}),
      ...(input.notifyReports !== undefined ? { notifyReports: input.notifyReports } : {}),
      ...(input.notifyDrift !== undefined ? { notifyDrift: input.notifyDrift } : {}),
    },
  });
  return { ok: true };
}

export async function setPlanStatus(
  userId: string,
  planId: string,
  status: "active" | "paused" | "completed",
): Promise<{ ok: true } | { ok: false; message: string }> {
  const plan = await getPlanForUser(userId, planId);
  if (!plan) return { ok: false, message: "Plan not found." };
  if (status === "active" && !plan.startedAt) {
    return { ok: false, message: "Approve the plan before starting it." };
  }

  if (status === "completed") {
    await prisma.$transaction([
      prisma.resetPlan.update({
        where: { id: plan.id },
        data: { status: "completed", completedAt: new Date() },
      }),
      prisma.habit.updateMany({ where: { planId: plan.id }, data: { status: "archived" } }),
      prisma.goalTrack.updateMany({ where: { planId: plan.id }, data: { status: "archived" } }),
    ]);
    return { ok: true };
  }

  await prisma.resetPlan.update({ where: { id: plan.id }, data: { status } });
  return { ok: true };
}

export async function startNewCycle(
  userId: string,
  options: { lighter?: boolean } = {},
): Promise<{ ok: true; planId: string } | { ok: false; message: string }> {
  const current = await getCurrentPlan(userId);
  if (current) {
    return { ok: false, message: "Finish or pause the current plan before starting a new cycle." };
  }
  const plan = await prisma.resetPlan.create({
    data: { userId, pace: options.lighter ? "lighter" : "standard" },
  });
  return { ok: true, planId: plan.id };
}

export async function deleteResetPlan(
  userId: string,
  planId: string,
): Promise<{ ok: true; removedEvents: number } | { ok: false; message: string }> {
  const plan = await getPlanForUser(userId, planId);
  if (!plan) return { ok: false, message: "Plan not found." };

  const links = plan.calendarEvents.map((link) => link.eventId);
  if (links.length) {
    await prisma.event.deleteMany({ where: { userId, id: { in: links } } });
  }
  await prisma.resetPlan.delete({ where: { id: plan.id } });

  return { ok: true, removedEvents: links.length };
}

/* -------------------------------------------------------------------------- */
/* Drift actions                                                               */
/* -------------------------------------------------------------------------- */

export async function resolveDrift(
  user: ServiceUser,
  planId: string,
  commitmentId: string,
  action: "move" | "drop" | "lighter" | "dismiss",
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const plan = await getPlanForUser(user.id, planId);
  if (!plan) return { ok: false, message: "Plan not found." };
  const commitment = plan.commitments.find((entry) => entry.id === commitmentId);
  if (!commitment) return { ok: false, message: "Commitment not found." };

  if (action === "dismiss") {
    const dueAt = startOfZonedDay(new Date(), user.timezone);
    await prisma.resetNotification.upsert({
      where: { planId_kind_dueAt: { planId: plan.id, kind: "drift", dueAt } },
      update: { status: "snoozed" },
      create: { planId: plan.id, userId: user.id, kind: "drift", dueAt, status: "snoozed" },
    });
    return { ok: true, message: "Suggestion hidden for today." };
  }

  if (action === "lighter") {
    await prisma.resetPlan.update({ where: { id: plan.id }, data: { pace: "lighter" } });
    return { ok: true, message: "Lighter pace saved. The plan keeps the same commitments." };
  }

  if (action === "drop") {
    const links = await prisma.resetPlanEvent.findMany({
      where: { planId: plan.id, commitmentId: commitment.id },
      select: { eventId: true },
    });
    if (links.length) {
      await prisma.event.deleteMany({ where: { userId: user.id, id: { in: links.map((link) => link.eventId) } } });
    }
    await prisma.resetCommitment.update({ where: { id: commitment.id }, data: { status: "dropped" } });
    await prisma.habit.updateMany({ where: { commitmentId: commitment.id }, data: { status: "archived" } });
    await prisma.goalTrack.updateMany({ where: { commitmentId: commitment.id }, data: { status: "archived" } });
    return { ok: true, message: "Dropped for the rest of this plan." };
  }

  const tomorrow = addZonedDays(startOfZonedDay(new Date(), user.timezone), 1, user.timezone);
  const task = await createTask(user, {
    domainSlug: commitment.domainSlug,
    title: `Reset Plan: ${commitment.title}`,
    dueDate: tomorrow,
    estimateMinutes: commitment.durationMinutes,
    priority: 2,
    notes: "Moved from a drift suggestion. One block, tomorrow.",
  });
  if (!task.ok) return { ok: false, message: task.message };
  return { ok: true, message: "Moved to tomorrow as a task." };
}

// Re-exported for pages that need the same phase metadata.
export { RESET_PHASES };
