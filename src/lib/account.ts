/**
 * Account bootstrap.
 *
 * Supabase owns authentication; this module mirrors the authenticated user
 * into Postgres, creates their 18 domain rows on first sign-in, and offers a
 * realistic starter week so a fresh account is never an empty dashboard.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DOMAINS, DOMAIN_MAP } from "@/lib/domains/catalog";
import { addZonedDays, startOfWeekMonday, zonedToUtc } from "@/lib/time";

export interface AccountProfile {
  id: string;
  email: string;
  name: string | null;
  timezone: string;
  wakeTime: string;
  sleepTime: string;
  dayStartHour: number;
  dayEndHour: number;
  minSleepHours: number;
  maxFocusHours: number;
  monthlyTokenBudget: number;
  onboardedAt: Date | null;
}

export interface AuthUserInput {
  id: string;
  email: string;
  name?: string | null;
}

/** Create the user row (idempotent) and make sure all 18 domains exist. */
export async function ensureAccount(input: AuthUserInput): Promise<AccountProfile> {
  const user = await prisma.user.upsert({
    where: { id: input.id },
    update: { email: input.email },
    create: {
      id: input.id,
      email: input.email,
      name: input.name ?? input.email.split("@")[0],
    },
  });

  await ensureDomains(user.id);

  return user;
}

export async function ensureDomains(userId: string): Promise<void> {
  const existing = await prisma.domain.findMany({
    where: { userId },
    select: { slug: true },
  });
  const have = new Set(existing.map((domain) => domain.slug));
  const missing = DOMAINS.filter((domain) => !have.has(domain.slug));

  if (!missing.length) return;

  // `createMany` with skipDuplicates is atomic against the (userId, slug) unique
  // key, so two requests bootstrapping the same account cannot collide.
  await prisma.domain.createMany({
    data: missing.map((domain) => ({
      userId,
      slug: domain.slug,
      name: domain.name,
      accent: domain.accent,
      icon: domain.icon,
      tagline: domain.tagline,
      goals: domain.goals,
      isProtected: domain.protectedByDefault,
      sortOrder: DOMAINS.findIndex((entry) => entry.slug === domain.slug),
      agentPrompt: domain.guidance,
    })),
    skipDuplicates: true,
  });
}

export async function getProfile(userId: string): Promise<AccountProfile | null> {
  return prisma.user.findUnique({ where: { id: userId } });
}

/** Minimal shape the calendar service needs, for cron jobs that loop users. */
export function serviceUserFromRow(row: {
  id: string;
  timezone: string;
  wakeTime: string;
  sleepTime: string;
  dayStartHour: number;
  dayEndHour: number;
  minSleepHours: number;
  maxFocusHours: number;
}) {
  return {
    id: row.id,
    timezone: row.timezone,
    wakeTime: row.wakeTime,
    sleepTime: row.sleepTime,
    dayStartHour: row.dayStartHour,
    dayEndHour: row.dayEndHour,
    minSleepHours: row.minSleepHours,
    maxFocusHours: row.maxFocusHours,
  };
}

interface SeedEvent {
  slug: string;
  title: string;
  /** 0 = Monday … 6 = Sunday */
  weekday?: number;
  /** Days from the start of the current week (used for multi-day things). */
  offsetDays?: number;
  start: string;
  minutes: number;
  description?: string;
  recurrence?: string;
  priority?: number;
  status?: "planned" | "suggested";
}

const STARTER_EVENTS: SeedEvent[] = [
  {
    slug: "sleep",
    title: "Sleep",
    start: "23:00",
    minutes: 480,
    recurrence: "DAILY",
    description: "Protected sleep window.",
  },
  {
    slug: "food",
    title: "Lunch",
    start: "13:00",
    minutes: 60,
    recurrence: "WEEKLY:MO,TU,WE,TH,FR",
    description: "Protected meal window.",
  },
  {
    slug: "habits",
    title: "Evening check-in",
    start: "22:15",
    minutes: 15,
    recurrence: "DAILY",
    description: "Mood, energy and one line of reflection.",
  },
  { slug: "education", title: "Study block", weekday: 0, start: "09:00", minutes: 120 },
  { slug: "education", title: "Study block", weekday: 1, start: "09:00", minutes: 90 },
  { slug: "education", title: "Lecture", weekday: 2, start: "10:00", minutes: 120 },
  { slug: "education", title: "Revision", weekday: 3, start: "09:00", minutes: 90 },
  {
    slug: "competitions",
    title: "Hackathon build",
    weekday: 1,
    start: "15:00",
    minutes: 120,
    description: "Team build session for the submission.",
  },
  { slug: "competitions", title: "Hackathon build", weekday: 4, start: "10:00", minutes: 120 },
  { slug: "competitions", title: "Pitch practice", weekday: 4, start: "17:00", minutes: 60 },
  { slug: "open-source", title: "Open source work", weekday: 2, start: "20:00", minutes: 120 },
  { slug: "blogging", title: "Blog draft", weekday: 0, start: "19:00", minutes: 90 },
  { slug: "admin", title: "Admin batch", weekday: 4, start: "14:00", minutes: 60 },
  { slug: "volunteering", title: "Volunteering shift", weekday: 5, start: "15:00", minutes: 180 },
  { slug: "finance", title: "Finance review", weekday: 5, start: "11:00", minutes: 45 },
  { slug: "social", title: "Family time", weekday: 6, start: "16:00", minutes: 120 },
  { slug: "portfolio", title: "Portfolio update", weekday: 6, start: "18:30", minutes: 60 },
  { slug: "planning", title: "Weekly review", weekday: 6, start: "20:00", minutes: 60 },
  { slug: "travel", title: "Commute", weekday: 0, start: "08:15", minutes: 30 },
  { slug: "learning", title: "Learning block", weekday: 1, start: "21:00", minutes: 45 },
  { slug: "rest", title: "Rest & buffer", weekday: 5, start: "13:30", minutes: 60 },
];

const STARTER_TASKS: { slug: string; title: string; dueInDays: number; minutes: number; priority?: number }[] = [
  { slug: "education", title: "Finish Data Structures revision", dueInDays: 0, minutes: 90, priority: 2 },
  { slug: "competitions", title: "Prepare hackathon pitch", dueInDays: 2, minutes: 60, priority: 2 },
  { slug: "karate", title: "Confirm next grading date", dueInDays: 3, minutes: 15 },
  { slug: "career", title: "Refresh CV for applications", dueInDays: 4, minutes: 60 },
  { slug: "admin", title: "Submit the scholarship form", dueInDays: 5, minutes: 30, priority: 2 },
  { slug: "finance", title: "Check prize payout status", dueInDays: 6, minutes: 20 },
  { slug: "blogging", title: "Outline next blog post", dueInDays: 6, minutes: 45 },
  { slug: "social", title: "Message mentor for a catch-up", dueInDays: 2, minutes: 10 },
];

/** Seed a realistic week for a brand-new account (idempotent per user). */
export async function seedStarterWeek(userId: string): Promise<void> {
  const existing = await prisma.event.count({ where: { userId } });
  if (existing > 0) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const domains = await prisma.domain.findMany({ where: { userId } });
  const bySlug = new Map(domains.map((domain) => [domain.slug, domain]));
  const tz = user.timezone;
  const monday = startOfWeekMonday(new Date(), tz);
  const local = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    const [year, month, day] = parts.split("-").map(Number);
    return { year, month, day };
  };

  const rows = STARTER_EVENTS.map((event) => {
    const domain = bySlug.get(event.slug);
    if (!domain) return null;
    const dayBase =
      event.weekday === undefined ? monday : addZonedDays(monday, event.weekday, tz);
    const { year, month, day } = local(dayBase);
    const [hours, minutes] = event.start.split(":").map(Number);
    const start = zonedToUtc({ year, month, day, hour: hours, minute: minutes }, tz);
    return {
      userId,
      domainId: domain.id,
      title: event.title,
      description: event.description ?? "",
      start,
      end: new Date(start.getTime() + event.minutes * 60_000),
      status: event.status ?? "planned",
      source: "auto",
      priority: event.priority ?? 1,
      recurrence: event.recurrence ?? null,
      recurrenceUntil: event.recurrence ? addZonedDays(start, 84, tz) : null,
    };
  }).filter((row): row is NonNullable<typeof row> => row !== null);

  const taskRows = STARTER_TASKS.flatMap((task) => {
    const domain = bySlug.get(task.slug);
    if (!domain) return [];
    const due = addZonedDays(new Date(), task.dueInDays, tz);
    return [
      {
        userId,
        domainId: domain.id,
        title: task.title,
        dueDate: due,
        estimateMinutes: task.minutes,
        priority: task.priority ?? 1,
      },
    ];
  });

  // Two bulk inserts instead of one statement per row: the seeding round trip
  // used to take ten-plus seconds over the pooled connection, which made the
  // onboarding action fragile on slower links.
  await prisma.$transaction([
    prisma.event.createMany({ data: rows }),
    prisma.task.createMany({ data: taskRows }),
    prisma.user.update({ where: { id: userId }, data: { onboardedAt: new Date() } }),
  ]);
}

/** Clear all calendar, task, notification, memory, and brief data (completely clean slate). */
export async function clearCalendarData(userId: string): Promise<void> {
  await prisma.$transaction([
    (prisma as any).notification.deleteMany({ where: { userId } }),
    prisma.event.deleteMany({ where: { userId } }),
    prisma.task.deleteMany({ where: { userId } }),
    prisma.memory.deleteMany({ where: { userId } }),
    prisma.agentLog.deleteMany({ where: { userId } }),
    prisma.brief.deleteMany({ where: { userId } }),
  ]);
}

/** Clear calendar/task/memory data and re-seed the starter week. */
export async function resetDemoData(userId: string): Promise<void> {
  await clearCalendarData(userId);
  await seedStarterWeek(userId);
}

/** Domain row for a slug, creating it if this account predates the catalogue. */
export async function requireDomain(userId: string, slug: string) {
  const domain = await prisma.domain.findFirst({ where: { userId, slug } });
  if (domain) return domain;

  const config = DOMAIN_MAP[slug];
  if (!config) return null;

  try {
    return await prisma.domain.create({
      data: {
        userId,
        slug: config.slug,
        name: config.name,
        accent: config.accent,
        icon: config.icon,
        tagline: config.tagline,
        goals: config.goals,
        isProtected: config.protectedByDefault,
        agentPrompt: config.guidance,
      },
    });
  } catch (error) {
    // A parallel request created it first — return that row instead of failing.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.domain.findFirst({ where: { userId, slug } });
    }
    throw error;
  }
}
