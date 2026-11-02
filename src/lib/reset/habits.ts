/**
 * Habit Tracker engine.
 *
 * Plan habits are never duplicated: they read the same ResetCheckin rows the
 * Reset Plan writes. Manual habits use HabitEntry. Goal tracks come from the
 * measurable Month 3 goals and their progress points.
 */

import { prisma } from "@/lib/db";
import type { ServiceUser } from "@/lib/calendar/service";
import { dayKey, zonedToUtc } from "@/lib/time";
import {
  calculateAdherence,
  currentStreak,
  goalPercent,
  longestStreak,
  planDayNumber,
  recentDayKeys,
} from "./calc";
import { GOAL_AREA_LABEL } from "./constants";
import { getCurrentPlan, getLatestPlan } from "./service";

export interface HabitCard {
  id: string;
  title: string;
  notes: string;
  source: string;
  domainSlug: string;
  cadence: string;
  weekday: number | null;
  status: string;
  commitmentId: string | null;
  planId: string | null;
  streak: number;
  longest: number;
  adherence: number;
  done: number;
  missed: number;
  skipped: number;
  total: number;
  todayResult: string | null;
  weekResult: string | null;
  recent: { dateKey: string; result: string | null }[];
  canCheckin: boolean;
}

export interface GoalCard {
  id: string;
  title: string;
  area: string;
  metric: string;
  unit: string;
  target: number;
  current: number;
  percent: number;
  cadence: string;
  entries: number;
  onTrack: boolean;
}

export interface HabitOverview {
  habits: HabitCard[];
  goals: GoalCard[];
  planActive: boolean;
  planDay: number;
  todayKey: string;
  summary: {
    todayDone: number;
    todayTotal: number;
    bestStreak: number;
    adherence: number;
    goalsOnTrack: number;
    goalsTotal: number;
  };
}

function dateFromKey(key: string, timeZone: string): Date {
  return zonedToUtc(
    {
      year: Number(key.slice(0, 4)),
      month: Number(key.slice(5, 7)),
      day: Number(key.slice(8, 10)),
    },
    timeZone,
  );
}

export async function getHabitOverview(
  user: ServiceUser,
  now: Date = new Date(),
): Promise<HabitOverview> {
  const todayKey = dayKey(now, user.timezone);
  const window = recentDayKeys(todayKey, 14);
  const weekKeys = new Set(recentDayKeys(todayKey, 7));
  const monthStartKey = recentDayKeys(todayKey, 30)[0] ?? todayKey;

  const currentPlan = await getCurrentPlan(user.id);
  const plan = currentPlan ?? (await getLatestPlan(user.id));

  const [habits, goalTracks] = await Promise.all([
    prisma.habit.findMany({
      where: { userId: user.id, status: "active" },
      orderBy: [{ source: "asc" }, { createdAt: "asc" }],
    }),
    prisma.goalTrack.findMany({
      where: { userId: user.id, status: "active" },
      orderBy: { createdAt: "asc" },
      include: { progress: { orderBy: { date: "desc" } } },
    }),
  ]);

  const planActive = plan?.status === "active";
  const planDay = plan?.startedAt ? planDayNumber(plan.startedAt, now, user.timezone) : 0;

  const [planCheckins, manualEntries] = await Promise.all([
    plan
      ? prisma.resetCheckin.findMany({ where: { planId: plan.id, userId: user.id } })
      : Promise.resolve([]),
    prisma.habitEntry.findMany({
      where: { userId: user.id, date: { gte: dateFromKey(monthStartKey, user.timezone) } },
    }),
  ]);

  const cards: HabitCard[] = habits.map((habit) => {
    const isPlanHabit = habit.source === "reset_plan" && habit.commitmentId;
    const records = isPlanHabit
      ? planCheckins
          .filter((checkin) => checkin.commitmentId === habit.commitmentId)
          .map((checkin) => ({
            dateKey: dayKey(checkin.date, user.timezone),
            result: checkin.result,
          }))
      : manualEntries
          .filter((entry) => entry.habitId === habit.id)
          .map((entry) => ({ dateKey: dayKey(entry.date, user.timezone), result: entry.result }));

    const inWindow = records.filter((record) => window.includes(record.dateKey));
    const stats = calculateAdherence(inWindow);
    const doneKeys = records.filter((record) => record.result === "done").map((record) => record.dateKey);
    const todayResult = records.find((record) => record.dateKey === todayKey)?.result ?? null;
    const weekResult =
      records
        .filter((record) => weekKeys.has(record.dateKey))
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0]?.result ?? null;

    return {
      id: habit.id,
      title: habit.title,
      notes: habit.notes,
      source: habit.source,
      domainSlug: habit.domainSlug,
      cadence: habit.cadence,
      weekday: habit.weekday,
      status: habit.status,
      commitmentId: habit.commitmentId,
      planId: habit.planId,
      streak: currentStreak(doneKeys, todayKey),
      longest: longestStreak(doneKeys),
      adherence: stats.adherence,
      done: stats.done,
      missed: stats.missed,
      skipped: stats.skipped,
      total: stats.total,
      todayResult,
      weekResult,
      recent: window.map((dateKey) => ({
        dateKey,
        result: records.find((record) => record.dateKey === dateKey)?.result ?? null,
      })),
      canCheckin: isPlanHabit ? planActive : true,
    };
  });

  const goals: GoalCard[] = goalTracks.map((track) => {
    const latest = track.progress[0];
    const current = latest?.value ?? 0;
    const percent = goalPercent(current, track.targetValue);
    return {
      id: track.id,
      title: track.title,
      area: GOAL_AREA_LABEL[track.goalArea] ?? track.goalArea,
      metric: track.metric,
      unit: track.unit,
      target: track.targetValue,
      current,
      percent,
      cadence: track.cadence,
      entries: track.progress.length,
      onTrack: percent >= 70,
    };
  });

  const todayHabits = cards.filter((habit) => habit.cadence === "daily");
  const todayDone = todayHabits.filter((habit) => habit.todayResult === "done").length;
  const scored = cards.filter((habit) => habit.total > 0);
  const adherence = scored.length
    ? Math.round(scored.reduce((sum, habit) => sum + habit.adherence, 0) / scored.length)
    : 0;

  return {
    habits: cards,
    goals,
    planActive,
    planDay,
    todayKey,
    summary: {
      todayDone,
      todayTotal: todayHabits.length,
      bestStreak: cards.reduce((best, habit) => Math.max(best, habit.streak), 0),
      adherence,
      goalsOnTrack: goals.filter((goal) => goal.onTrack).length,
      goalsTotal: goals.length,
    },
  };
}

export async function createManualHabit(
  user: ServiceUser,
  input: {
    title: string;
    notes?: string;
    domainSlug?: string;
    cadence?: "daily" | "weekly";
    weekday?: number | null;
  },
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const title = input.title.trim();
  if (!title) return { ok: false, message: "Give the habit a title." };
  if (title.length > 160) return { ok: false, message: "Keep the title under 160 characters." };

  const domain = await prisma.domain.findFirst({
    where: { userId: user.id, slug: input.domainSlug || "habits" },
    select: { slug: true },
  });

  const count = await prisma.habit.count({ where: { userId: user.id, source: "manual", status: "active" } });
  if (count >= 20) return { ok: false, message: "Twenty manual habits is the limit for this version." };

  const habit = await prisma.habit.create({
    data: {
      userId: user.id,
      title,
      notes: input.notes?.slice(0, 1000) ?? "",
      source: "manual",
      domainSlug: domain?.slug ?? "habits",
      cadence: input.cadence === "weekly" ? "weekly" : "daily",
      weekday:
        input.weekday !== undefined && input.weekday !== null && input.weekday >= 0 && input.weekday <= 6
          ? input.weekday
          : null,
    },
  });

  return { ok: true, id: habit.id };
}

export async function archiveHabit(
  userId: string,
  habitId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const habit = await prisma.habit.findFirst({ where: { id: habitId, userId } });
  if (!habit) return { ok: false, message: "Habit not found." };
  if (habit.source === "reset_plan") {
    return { ok: false, message: "Plan habits are managed from the Reset Plan." };
  }
  await prisma.habit.update({ where: { id: habit.id }, data: { status: "archived" } });
  return { ok: true };
}

export async function setHabitEntry(
  user: ServiceUser,
  habitId: string,
  result: string,
  requestedDateKey?: string,
): Promise<{ ok: true; dateKey: string } | { ok: false; message: string }> {
  if (!["done", "skipped", "missed"].includes(result)) {
    return { ok: false, message: "Unknown habit result." };
  }

  const habit = await prisma.habit.findFirst({ where: { id: habitId, userId: user.id, status: "active" } });
  if (!habit) return { ok: false, message: "Habit not found." };
  if (habit.source === "reset_plan") {
    return { ok: false, message: "Check in to this habit from the Reset Plan." };
  }

  const today = dayKey(new Date(), user.timezone);
  let targetKey = requestedDateKey && /^\d{4}-\d{2}-\d{2}$/.test(requestedDateKey) ? requestedDateKey : today;
  if (targetKey > today) targetKey = today;

  const date = dateFromKey(targetKey, user.timezone);
  await prisma.habitEntry.upsert({
    where: { habitId_date: { habitId: habit.id, date } },
    update: { result },
    create: { habitId: habit.id, userId: user.id, date, result },
  });

  return { ok: true, dateKey: targetKey };
}

export async function getGoalDetail(userId: string, goalId: string) {
  return prisma.goalTrack.findFirst({
    where: { id: goalId, userId },
    include: {
      progress: { orderBy: { date: "asc" } },
      commitment: true,
      plan: true,
    },
  });
}

export async function logGoalProgress(
  user: ServiceUser,
  goalId: string,
  value: number,
  note: string,
  requestedDateKey?: string,
): Promise<{ ok: true; dateKey: string } | { ok: false; message: string }> {
  if (!Number.isFinite(value) || value < 0) return { ok: false, message: "Enter a number of zero or more." };
  if (value > 1_000_000) return { ok: false, message: "That number is too large." };

  const goal = await prisma.goalTrack.findFirst({ where: { id: goalId, userId: user.id } });
  if (!goal) return { ok: false, message: "Goal not found." };

  const today = dayKey(new Date(), user.timezone);
  const targetKey =
    requestedDateKey && /^\d{4}-\d{2}-\d{2}$/.test(requestedDateKey) ? requestedDateKey : today;
  const date = dateFromKey(targetKey, user.timezone);

  await prisma.goalProgress.upsert({
    where: { goalTrackId_date: { goalTrackId: goal.id, date } },
    update: { value, note: note.trim().slice(0, 500) },
    create: { goalTrackId: goal.id, userId: user.id, date, value, note: note.trim().slice(0, 500) },
  });

  return { ok: true, dateKey: targetKey };
}
