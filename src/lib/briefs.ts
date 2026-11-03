/**
 * Morning brief and weekly review.
 *
 * Both are generated from the calendar service — never invented — so the text
 * on Today and Review always matches the schedule. The cron jobs store the
 * result in `Brief`; the pages can also build one on the fly when a job has not
 * run yet (for example on a fresh account).
 */

import { prisma } from "@/lib/db";
import { listEvents, listTasks, getDayOverview, getWeekStats, findSlots, type ServiceUser } from "@/lib/calendar/service";
import { addZonedDays, formatInZone, minutesBetween, startOfWeekMonday, utcToZoned } from "@/lib/time";
import { domainFamilyColor } from "@/lib/domains/presentation";

export interface BriefItem {
  id: string;
  title: string;
  domainSlug: string;
  domainName: string;
  accent: string;
  timeLabel: string;
  protected: boolean;
}

export interface MorningBrief {
  dateLabel: string;
  headline: string;
  greeting: string;
  items: BriefItem[];
  topTasks: { id: string; title: string; domainName: string; accent: string; dueLabel: string | null }[];
  warnings: string[];
  stats: {
    eventCount: number;
    focusMinutes: number;
    sleepHours: number;
    firstBlock: string | null;
    nextUp: string | null;
  };
}

function clock(date: Date, timeZone: string): string {
  return formatInZone(date, timeZone, { hour: "numeric", minute: "2-digit" });
}

function dayLabel(date: Date, timeZone: string): string {
  return formatInZone(date, timeZone, { weekday: "long", day: "numeric", month: "long" });
}

export function greetingFor(date: Date, timeZone: string): string {
  const hour = utcToZoned(date, timeZone).hour;
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Build the brief that greets the user on Today. */
export async function buildMorningBrief(user: ServiceUser, now: Date): Promise<MorningBrief> {
  const overview = await getDayOverview(user, now);
  const tz = user.timezone;

  const items: BriefItem[] = overview.events
    .filter((event) => event.domainSlug !== "sleep")
    .map((event) => ({
      id: event.id,
      title: event.title,
      domainSlug: event.domainSlug,
      domainName: event.domainName,
      accent: domainFamilyColor(event.domainSlug, event.domainAccent),
      timeLabel: `${clock(event.start, tz)} – ${clock(event.end, tz)}`,
      protected: event.isProtected,
    }));

  const focusMinutes = overview.focusMinutes;
  const sleepHours = Math.round(
    (overview.events
      .filter((event) => event.domainSlug === "sleep")
      .reduce((total, event) => total + minutesBetween(event.start, event.end), 0) /
      60) *
      10,
  ) / 10;

  const topTasks = overview.dueToday
    .slice(0, 3)
    .map((task) => ({
      id: task.id,
      title: task.title,
      domainName: task.domainName,
      accent: domainFamilyColor(task.domainSlug, task.domainAccent),
      dueLabel: task.dueDate ? formatInZone(task.dueDate, tz, { day: "numeric", month: "short" }) : null,
    }));

  const warnings: string[] = [];
  if (focusMinutes > user.maxFocusHours * 60) {
    warnings.push(
      `${Math.round((focusMinutes / 60) * 10) / 10}h of focus work planned — over your ${user.maxFocusHours}h limit.`,
    );
  }
  if (sleepHours > 0 && sleepHours < user.minSleepHours) {
    warnings.push(`Only ${sleepHours}h of sleep scheduled tonight. Protect the rest of the evening.`);
  }
  if (!items.length) {
    warnings.push("Nothing on the calendar yet today. Ask the agent to block the important work.");
  }
  const overlapping = overview.events.filter((event, index, all) =>
    all.some(
      (other) =>
        other.id !== event.id &&
        other.domainSlug !== "sleep" &&
        event.start < other.end &&
        other.start < event.end,
    ),
  );
  if (overlapping.length) {
    warnings.push(`${overlapping.length} blocks overlap today — worth a quick fix.`);
  }

  const nextUp = overview.nextEvent
    ? `${overview.nextEvent.title} at ${clock(overview.nextEvent.start, tz)}`
    : null;

  const headline = items.length
    ? `${items.length} ${items.length === 1 ? "block" : "blocks"} today, starting ${items[0].timeLabel.split(" –")[0]}.${
        nextUp ? ` Next up: ${nextUp}.` : ""
      }`
    : "A clear day. Choose the one thing that matters most and block it.";

  return {
    dateLabel: dayLabel(now, tz),
    headline,
    greeting: greetingFor(now, tz),
    items,
    topTasks,
    warnings,
    stats: {
      eventCount: items.length,
      focusMinutes,
      sleepHours,
      firstBlock: items[0]?.timeLabel.split(" –")[0] ?? null,
      nextUp,
    },
  };
}

export interface ReviewDomainRow {
  slug: string;
  name: string;
  accent: string;
  plannedMinutes: number;
  done: number;
  total: number;
  adherence: number;
}

export interface WeeklyReview {
  weekStartISO: string;
  rangeLabel: string;
  adherence: number;
  done: number;
  slipped: number;
  eventAchieved: number;
  eventResolved: number;
  plannedCount: number;
  focusMinutes: number;
  previousFocusMinutes: number;
  perDomain: ReviewDomainRow[];
  slippedTasks: { id: string; title: string; domainName: string; accent: string; dueLabel: string }[];
  deadlineTasks: { id: string; title: string; domainName: string; accent: string; dueLabel: string }[];
  insights: string[];
  headline: string;
}

/** Everything the Sunday review shows for a given week. */
export async function buildWeeklyReview(
  user: ServiceUser,
  weekStart: Date,
  includeCurrentPlanning = true,
): Promise<WeeklyReview> {
  const stats = await getWeekStats(user, weekStart);
  const tz = user.timezone;
  const weekEnd = addZonedDays(weekStart, 7, tz);
  const inFourteen = addZonedDays(weekStart, 14, tz);

  const taskRows = await prisma.task.findMany({
    where: {
      userId: user.id,
      OR: [
        { dueDate: { gte: weekStart, lt: weekEnd } },
        { completedAt: { gte: weekStart, lt: weekEnd } },
      ],
    },
    include: { domain: { select: { slug: true, name: true, accent: true } } },
    orderBy: { dueDate: "asc" },
  });
  const completedInWeek = (task: (typeof taskRows)[number]) =>
    task.completedAt !== null && task.completedAt >= weekStart && task.completedAt < weekEnd;
  const dueInWeek = (task: (typeof taskRows)[number]) =>
    task.dueDate !== null && task.dueDate >= weekStart && task.dueDate < weekEnd;
  const tasks = taskRows.filter(
    (task) => completedInWeek(task) || (dueInWeek(task) && (!task.completedAt || task.completedAt >= weekEnd)),
  );
  const done = tasks.filter(completedInWeek).length;
  const now = new Date();
  const isSlipped = (task: (typeof taskRows)[number]) =>
    dueInWeek(task) &&
    !completedInWeek(task) &&
    (!includeCurrentPlanning || (task.dueDate !== null && task.dueDate < now));
  const slippedCount = taskRows.filter(isSlipped).length;
  const slippedTasks = taskRows
    .filter(isSlipped)
    .slice(0, 6)
    .map((task) => ({
      id: task.id,
      title: task.title,
      domainName: task.domain.name,
      accent: domainFamilyColor(task.domain.slug, task.domain.accent),
      dueLabel: task.dueDate ? formatInZone(task.dueDate, tz, { day: "numeric", month: "short" }) : "",
    }));

  const currentTasks = includeCurrentPlanning ? await listTasks(user, { limit: 400 }) : [];
  const doneByDomain = new Map<string, number>();
  const totalByDomain = new Map<string, number>();
  for (const task of tasks) {
    const slug = task.domain.slug;
    totalByDomain.set(slug, (totalByDomain.get(slug) ?? 0) + 1);
    if (completedInWeek(task)) doneByDomain.set(slug, (doneByDomain.get(slug) ?? 0) + 1);
  }

  const perDomain: ReviewDomainRow[] = stats.perDomain.slice(0, 8).map((row) => {
    const done = doneByDomain.get(row.slug) ?? 0;
    const total = totalByDomain.get(row.slug) ?? 0;
    return {
      slug: row.slug,
      name: row.name,
      accent: domainFamilyColor(row.slug, row.accent),
      plannedMinutes: row.minutes,
      done,
      total,
      adherence: total ? Math.round((done / total) * 100) : row.count ? 100 : 0,
    };
  });

  const deadlineTasks = currentTasks
    .filter((task) => task.status !== "done" && task.dueDate && task.dueDate >= weekEnd && task.dueDate <= inFourteen)
    .slice(0, 6)
    .map((task) => ({
      id: task.id,
      title: task.title,
      domainName: task.domainName,
      accent: domainFamilyColor(task.domainSlug, task.domainAccent),
      dueLabel: task.dueDate ? formatInZone(task.dueDate, tz, { day: "numeric", month: "short" }) : "",
    }));

  const insights: string[] = [];
  const focusDelta = stats.focusMinutes - stats.prevFocusMinutes;
  if (focusDelta > 0) insights.push(`${Math.round((focusDelta / 60) * 10) / 10}h more focus time than last week.`);
  if (focusDelta < 0) insights.push(`${Math.round((-focusDelta / 60) * 10) / 10}h less focus time than last week.`);
  if (stats.sleepNights >= 5) insights.push(`Sleep protected on ${stats.sleepNights} nights.`);
  if (stats.karateSessions >= 2) insights.push(`Karate kept on the calendar ${stats.karateSessions} times.`);
  if (slippedCount) {
    insights.push(
      includeCurrentPlanning
        ? `${slippedCount} tasks slipped — carry them into next week.`
        : `${slippedCount} tasks missed their due date this week.`,
    );
  }
  if (stats.perDomain.length && stats.perDomain[0]) {
    insights.push(`Most time went to ${stats.perDomain[0].name} (${Math.round(stats.perDomain[0].minutes / 60)}h).`);
  }
  const adherence = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const eventAchieved = stats.events.filter((event) => event.achievementStatus === "achieved").length;
  const eventResolved = stats.events.filter((event) => event.achievementStatus !== null).length;

  return {
    weekStartISO: weekStart.toISOString(),
    rangeLabel: `${formatInZone(weekStart, tz, { day: "numeric", month: "short" })} – ${formatInZone(
      new Date(weekEnd.getTime() - 1),
      tz,
      { day: "numeric", month: "short" },
    )}`,
    adherence,
    done,
    slipped: slippedCount,
    eventAchieved,
    eventResolved,
    plannedCount: stats.plannedCount,
    focusMinutes: stats.focusMinutes,
    previousFocusMinutes: stats.prevFocusMinutes,
    perDomain,
    slippedTasks,
    deadlineTasks,
    insights,
    headline:
      !tasks.length
        ? "No tasks were due or completed this week."
        : adherence >= 80
        ? "Strong week — the important blocks survived."
        : adherence >= 50
          ? "Solid progress with room to tighten next week."
          : "A heavy week. Let's plan fewer, better blocks next week.",
  };
}

export interface ProposedBlock {
  taskId: string | null;
  domainSlug: string;
  title: string;
  startISO: string;
  endISO: string;
  minutes: number;
}

/**
 * Place the next week's open tasks into real free slots, respecting sleep,
 * meals and protected time. Used by the review page and the Sunday cron job.
 */
export async function proposeNextWeek(user: ServiceUser, weekStart: Date): Promise<ProposedBlock[]> {
  const tz = user.timezone;
  const from = addZonedDays(weekStart, 0, tz);
  const to = addZonedDays(weekStart, 7, tz);

  const tasks = await listTasks(user, { limit: 200 });
  const candidates = tasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => {
      const priorityDelta = b.priority - a.priority;
      if (priorityDelta !== 0) return priorityDelta;
      const aDue = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    })
    .slice(0, 5);

  if (!candidates.length) return [];

  const proposals: ProposedBlock[] = [];
  const cursor = new Date(Math.max(from.getTime(), Date.now()));

  for (const task of candidates) {
    const minutes = Math.min(Math.max(task.estimateMinutes || 45, 25), 120);
    const slots = await findSlots(user, { from: cursor, to, durationMinutes: minutes, maxSlots: 1 });
    const slot = slots[0];
    if (!slot) continue;
    proposals.push({
      taskId: task.id,
      domainSlug: task.domainSlug,
      title: task.title,
      startISO: slot.start.toISOString(),
      endISO: slot.end.toISOString(),
      minutes,
    });
    cursor.setTime(Math.max(cursor.getTime(), slot.end.getTime() + 10 * 60_000));
  }

  return proposals;
}

/** Users a cron job should brief (everyone who finished onboarding). */
export async function briefableUsers(): Promise<
  { id: string; timezone: string; name: string | null; email: string }[]
> {
  return prisma.user.findMany({
    where: { onboardedAt: { not: null } },
    select: { id: true, timezone: true, name: true, email: true },
    take: 500,
  });
}

export function currentWeekStart(timeZone: string, now = new Date()): Date {
  return startOfWeekMonday(now, timeZone);
}

/**
 * A stable date key for a brief: the user's local calendar day, expressed as
 * UTC midnight so `Brief.forDate` never drifts across timezones.
 */
export function briefDateKey(now: Date, timeZone: string): Date {
  const local = utcToZoned(now, timeZone);
  return new Date(Date.UTC(local.year, local.month - 1, local.day));
}
