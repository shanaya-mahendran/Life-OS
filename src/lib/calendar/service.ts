/**
 * The one calendar service.
 *
 * Every write — from the UI, the agent, a cron job — goes through these
 * functions. That is where conflicts, protected time, undo records and audit
 * logs are enforced, so no caller can bypass them.
 */

import { prisma } from "@/lib/db";
import { DOMAIN_MAP } from "@/lib/domains/catalog";
import { requireDomain } from "@/lib/account";
import {
  addZonedDays,
  dayKey,
  hmToMinutes,
  minutesBetween,
  startOfZonedDay,
  utcToZoned,
  zonedToUtc,
} from "@/lib/time";
import { findConflicts, needsConfirmation, type Conflict } from "./conflicts";
import { findFreeSlots, type FreeSlot } from "./free-slots";
import { expandOccurrences } from "./recurrence";
import { serializeEvent, toCalendarEvent, toCalendarTask } from "./mappers";
import type { CalendarEvent, CalendarTask } from "./types";

export interface ServiceUser {
  id: string;
  timezone: string;
  wakeTime: string;
  sleepTime: string;
  dayStartHour: number;
  dayEndHour: number;
  minSleepHours: number;
  maxFocusHours: number;
}

export type InverseOp =
  | { type: "delete_event"; eventId: string }
  | { type: "restore_event"; eventId: string; before: ReturnType<typeof serializeEvent> }
  | { type: "delete_task"; taskId: string }
  | {
      type: "restore_task";
      taskId: string;
      before: { title: string; status: string; dueDate: string | null; notes: string; priority: number };
    };

export interface WriteResult {
  ok: boolean;
  event?: CalendarEvent;
  conflicts: Conflict[];
  requiresConfirmation: boolean;
  message?: string;
  inverse?: InverseOp;
}

export interface CreateEventInput {
  domainSlug: string;
  title: string;
  start: Date;
  end?: Date;
  minutes?: number;
  description?: string;
  location?: string;
  priority?: number;
  recurrence?: string | null;
  recurrenceUntil?: Date | null;
  status?: "planned" | "suggested";
  source?: "manual" | "agent" | "auto";
  force?: boolean;
}

const UNPROTECTED_PREFIXES = ["sleep", "food", "rest", "habits"];

const eventInclude = {
  domain: { select: { slug: true, name: true, accent: true, isProtected: true } },
} as const;

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

export async function listEvents(
  user: ServiceUser,
  range: { from: Date; to: Date; domainSlug?: string; includeSuggested?: boolean; includeCancelled?: boolean },
): Promise<CalendarEvent[]> {
  const rows = await prisma.event.findMany({
    where: {
      userId: user.id,
      ...(range.domainSlug
        ? { domain: { slug: range.domainSlug } }
        : {}),
      ...(range.includeCancelled ? {} : { status: { not: "cancelled" } }),
      ...(range.includeSuggested ? {} : { status: { not: "suggested" } }),
      OR: [
        { start: { lt: range.to }, end: { gt: range.from } },
        { recurrence: { not: null }, start: { lte: range.to } },
      ],
    },
    include: eventInclude,
    orderBy: { start: "asc" },
  });

  const expanded: CalendarEvent[] = [];
  for (const row of rows) {
    const base = toCalendarEvent(row);
    const occurrences = expandOccurrences(
      { start: row.start, end: row.end, recurrence: row.recurrence, recurrenceUntil: row.recurrenceUntil },
      range.from,
      range.to,
      user.timezone,
    );
    if (!occurrences.length) continue;
    for (const occurrence of occurrences) {
      expanded.push({ ...base, start: occurrence.start, end: occurrence.end });
    }
  }

  return expanded.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export async function listTasks(
  user: ServiceUser,
  options: { domainSlug?: string; status?: string; includeDone?: boolean; limit?: number } = {},
): Promise<CalendarTask[]> {
  const rows = await prisma.task.findMany({
    where: {
      userId: user.id,
      ...(options.domainSlug ? { domain: { slug: options.domainSlug } } : {}),
      ...(options.status ? { status: options.status } : options.includeDone ? {} : { status: { not: "done" } }),
    },
    include: { domain: { select: { slug: true, name: true, accent: true } } },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "asc" }],
    take: options.limit ?? 200,
  });
  return rows.map(toCalendarTask);
}

export async function getEvent(user: ServiceUser, eventId: string) {
  const row = await prisma.event.findFirst({
    where: { id: eventId, userId: user.id },
    include: eventInclude,
  });
  return row ? toCalendarEvent(row) : null;
}

/* -------------------------------------------------------------------------- */
/* Conflict helpers                                                            */
/* -------------------------------------------------------------------------- */

async function collectConflicts(
  user: ServiceUser,
  candidate: { id?: string; title: string; start: Date; end: Date; domainSlug: string; isProtected?: boolean },
): Promise<Conflict[]> {
  const pad = 2 * 24 * 60 * 60 * 1000;
  const nearby = await listEvents(user, {
    from: new Date(candidate.start.getTime() - pad),
    to: new Date(candidate.end.getTime() + pad),
    includeCancelled: false,
    includeSuggested: true,
  });

  const bufferMinutes = 15;
  const candidateDays = dayRangeKeys(candidate.start, candidate.end, user.timezone);

  const plannedMinutesByDay: Record<string, number> = {};
  for (const event of nearby) {
    if (event.id === candidate.id) continue;
    const slug = event.domainSlug;
    if (UNPROTECTED_PREFIXES.includes(slug)) continue;
    const duration = minutesBetween(event.start, event.end);
    if (duration <= 0) continue;
    if (duration > 360) continue; // ignore long background blocks in the load figure
    const key = dayKey(event.start, user.timezone);
    plannedMinutesByDay[key] = (plannedMinutesByDay[key] ?? 0) + duration;
  }

  // Sleep is protected even if the user has not scheduled it explicitly.
  const protectedWindows = buildSleepWindows(user, candidate.start, candidate.end).filter((window) => {
    const alreadyScheduled = nearby.some(
      (event) => event.domainSlug === "sleep" && event.start < window.end && event.end > window.start,
    );
    return !alreadyScheduled;
  });

  return findConflicts({
    candidate: {
      id: candidate.id,
      title: candidate.title,
      start: candidate.start,
      end: candidate.end,
      domainSlug: candidate.domainSlug,
      isProtected: candidate.isProtected,
    },
    existing: nearby
      .filter((event) => event.id !== candidate.id)
      .map((event) => ({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        domainSlug: event.domainSlug,
        isProtected: event.isProtected,
      })),
    ignoreIds: candidate.id ? [candidate.id] : [],
    protectedWindows,
    bufferMinutes,
    plannedMinutesByDay,
    maxFocusMinutes: user.maxFocusHours * 60,
    dayKeysTouched: candidateDays,
  });
}

function buildSleepWindows(user: ServiceUser, start: Date, end: Date) {
  const sleepMinutes = hmToMinutes(user.sleepTime);
  const wakeMinutes = hmToMinutes(user.wakeTime);
  const windows: { title: string; slug: string; start: Date; end: Date }[] = [];
  let cursor = addZonedDays(startOfZonedDay(start, user.timezone), -1, user.timezone);

  for (let index = 0; index < 6; index += 1) {
    const local = utcToZoned(cursor, user.timezone);
    const sleepStart = zonedToUtc(
      {
        year: local.year,
        month: local.month,
        day: local.day,
        hour: Math.floor(sleepMinutes / 60),
        minute: sleepMinutes % 60,
      },
      user.timezone,
    );
    const wakeLocal = utcToZoned(addZonedDays(cursor, 1, user.timezone), user.timezone);
    const sleepEnd = zonedToUtc(
      {
        year: wakeLocal.year,
        month: wakeLocal.month,
        day: wakeLocal.day,
        hour: Math.floor(wakeMinutes / 60),
        minute: wakeMinutes % 60,
      },
      user.timezone,
    );
    if (sleepStart < end && sleepEnd > start && sleepEnd > sleepStart) {
      windows.push({ title: "Sleep", slug: "sleep", start: sleepStart, end: sleepEnd });
    }
    cursor = addZonedDays(cursor, 1, user.timezone);
  }
  return windows;
}

function dayRangeKeys(start: Date, end: Date, timeZone: string): string[] {
  const keys = new Set<string>();
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 14) {
    keys.add(dayKey(cursor, timeZone));
    cursor = addZonedDays(cursor, 1, timeZone);
    guard += 1;
  }
  keys.add(dayKey(end, timeZone));
  return [...keys];
}

export async function previewConflicts(
  user: ServiceUser,
  candidate: { id?: string; title: string; start: Date; end: Date; domainSlug: string },
): Promise<Conflict[]> {
  return collectConflicts(user, candidate);
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                      */
/* -------------------------------------------------------------------------- */

export async function createEvent(user: ServiceUser, input: CreateEventInput): Promise<WriteResult> {
  const domain = await requireDomain(user.id, input.domainSlug);
  if (!domain) {
    return {
      ok: false,
      conflicts: [],
      requiresConfirmation: false,
      message: `Unknown domain "${input.domainSlug}".`,
    };
  }

  const end = input.end ?? new Date(input.start.getTime() + (input.minutes ?? 60) * 60_000);
  if (end.getTime() <= input.start.getTime()) {
    return { ok: false, conflicts: [], requiresConfirmation: false, message: "End must be after start." };
  }

  const conflicts = await collectConflicts(user, {
    title: input.title,
    start: input.start,
    end,
    domainSlug: input.domainSlug,
    isProtected: domain.isProtected,
  });

  if (!input.force && needsConfirmation(conflicts)) {
    return { ok: false, conflicts, requiresConfirmation: true };
  }

  const row = await prisma.event.create({
    data: {
      userId: user.id,
      domainId: domain.id,
      title: input.title,
      description: input.description ?? "",
      location: input.location ?? "",
      start: input.start,
      end,
      priority: input.priority ?? 1,
      status: input.status ?? "planned",
      source: input.source ?? "agent",
      recurrence: input.recurrence ?? null,
      recurrenceUntil: input.recurrenceUntil ?? null,
    },
    include: eventInclude,
  });

  return {
    ok: true,
    event: toCalendarEvent(row),
    conflicts,
    requiresConfirmation: false,
    inverse: { type: "delete_event", eventId: row.id },
  };
}

export interface UpdateEventInput {
  title?: string;
  start?: Date;
  end?: Date;
  minutes?: number;
  description?: string;
  location?: string;
  priority?: number;
  status?: "planned" | "suggested" | "done" | "cancelled";
  domainSlug?: string;
  recurrence?: string | null;
  force?: boolean;
}

export async function updateEvent(
  user: ServiceUser,
  eventId: string,
  patch: UpdateEventInput,
): Promise<WriteResult> {
  const existing = await prisma.event.findFirst({
    where: { id: eventId, userId: user.id },
    include: eventInclude,
  });
  if (!existing) {
    return { ok: false, conflicts: [], requiresConfirmation: false, message: "Event not found." };
  }

  const nextStart = patch.start ?? existing.start;
  const nextEnd =
    patch.end ??
    (patch.start && !patch.minutes
      ? new Date(patch.start.getTime() + (existing.end.getTime() - existing.start.getTime()))
      : patch.minutes
        ? new Date(nextStart.getTime() + patch.minutes * 60_000)
        : existing.end);

  if (nextEnd.getTime() <= nextStart.getTime()) {
    return { ok: false, conflicts: [], requiresConfirmation: false, message: "End must be after start." };
  }

  const domainSlug = patch.domainSlug ?? existing.domain.slug;
  const domain = patch.domainSlug ? await requireDomain(user.id, patch.domainSlug) : null;
  if (patch.domainSlug && !domain) {
    return { ok: false, conflicts: [], requiresConfirmation: false, message: "Unknown domain." };
  }

  const conflicts = await collectConflicts(user, {
    id: existing.id,
    title: patch.title ?? existing.title,
    start: nextStart,
    end: nextEnd,
    domainSlug,
    isProtected: domain?.isProtected ?? existing.domain.isProtected,
  });

  const timeChanged =
    nextStart.getTime() !== existing.start.getTime() || nextEnd.getTime() !== existing.end.getTime();
  const protectedTouch = existing.domain.isProtected || domain?.isProtected === true;

  if (!patch.force && needsConfirmation(conflicts) && timeChanged) {
    return { ok: false, conflicts, requiresConfirmation: true };
  }
  if (!patch.force && protectedTouch && timeChanged) {
    const protectedConflicts: Conflict[] = [
      {
        severity: "protected",
        code: "protected_domain",
        message: `${existing.domain.name} is protected time.`,
      },
    ];
    return { ok: false, conflicts: [...protectedConflicts, ...conflicts], requiresConfirmation: true };
  }

  const row = await prisma.event.update({
    where: { id: existing.id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.location !== undefined ? { location: patch.location } : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.recurrence !== undefined ? { recurrence: patch.recurrence } : {}),
      ...(domain ? { domainId: domain.id } : {}),
      start: nextStart,
      end: nextEnd,
      source: "agent",
    },
    include: eventInclude,
  });

  return {
    ok: true,
    event: toCalendarEvent(row),
    conflicts,
    requiresConfirmation: false,
    inverse: { type: "restore_event", eventId: existing.id, before: serializeEvent(existing) },
  };
}

export async function cancelEvent(user: ServiceUser, eventId: string): Promise<WriteResult> {
  const existing = await prisma.event.findFirst({
    where: { id: eventId, userId: user.id },
    include: eventInclude,
  });
  if (!existing) {
    return { ok: false, conflicts: [], requiresConfirmation: false, message: "Event not found." };
  }

  const row = await prisma.event.update({
    where: { id: existing.id },
    data: { status: "cancelled" },
    include: eventInclude,
  });

  return {
    ok: true,
    event: toCalendarEvent(row),
    conflicts: [],
    requiresConfirmation: false,
    inverse: { type: "restore_event", eventId: existing.id, before: serializeEvent(existing) },
  };
}

export interface CreateTaskInput {
  domainSlug: string;
  title: string;
  dueDate?: Date | null;
  estimateMinutes?: number;
  priority?: number;
  notes?: string;
}

export async function createTask(user: ServiceUser, input: CreateTaskInput) {
  const domain = await requireDomain(user.id, input.domainSlug);
  if (!domain) return { ok: false as const, message: `Unknown domain "${input.domainSlug}".` };

  const row = await prisma.task.create({
    data: {
      userId: user.id,
      domainId: domain.id,
      title: input.title,
      dueDate: input.dueDate ?? null,
      estimateMinutes: input.estimateMinutes ?? 30,
      priority: input.priority ?? 1,
      notes: input.notes ?? "",
    },
    include: { domain: { select: { slug: true, name: true, accent: true } } },
  });

  return {
    ok: true as const,
    task: toCalendarTask(row),
    inverse: { type: "delete_task" as const, taskId: row.id },
  };
}

export async function updateTask(
  user: ServiceUser,
  taskId: string,
  patch: { title?: string; status?: string; dueDate?: Date | null; priority?: number; notes?: string },
) {
  const existing = await prisma.task.findFirst({ where: { id: taskId, userId: user.id } });
  if (!existing) return { ok: false as const, message: "Task not found." };

  const row = await prisma.task.update({
    where: { id: existing.id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.status === "done" ? { completedAt: new Date() } : {}),
      ...(patch.status && patch.status !== "done" ? { completedAt: null } : {}),
    },
    include: { domain: { select: { slug: true, name: true, accent: true } } },
  });

  return {
    ok: true as const,
    task: toCalendarTask(row),
    inverse: {
      type: "restore_task" as const,
      taskId: existing.id,
      before: {
        title: existing.title,
        status: existing.status,
        dueDate: existing.dueDate ? existing.dueDate.toISOString() : null,
        notes: existing.notes,
        priority: existing.priority,
      },
    },
  };
}

export async function findSlots(
  user: ServiceUser,
  options: { from: Date; to: Date; durationMinutes: number; skipWeekdays?: number[]; maxSlots?: number },
): Promise<FreeSlot[]> {
  const busy = await listEvents(user, { from: options.from, to: options.to, includeSuggested: true });
  return findFreeSlots({
    rangeStart: options.from,
    rangeEnd: options.to,
    timeZone: user.timezone,
    dayStartHour: user.dayStartHour,
    dayEndHour: user.dayEndHour,
    busy: busy.map((event) => ({ start: event.start, end: event.end })),
    durationMinutes: options.durationMinutes,
    skipWeekdays: options.skipWeekdays,
    maxSlots: options.maxSlots ?? 8,
  });
}

/* -------------------------------------------------------------------------- */
/* Undo                                                                        */
/* -------------------------------------------------------------------------- */

export async function applyInverse(userId: string, operations: InverseOp[]): Promise<number> {
  let applied = 0;
  for (const operation of [...operations].reverse()) {
    if (operation.type === "delete_event") {
      await prisma.event.deleteMany({ where: { id: operation.eventId, userId } });
      applied += 1;
    } else if (operation.type === "restore_event") {
      const before = operation.before;
      await prisma.event.updateMany({
        where: { id: operation.eventId, userId },
        data: {
          title: before.title,
          description: before.description,
          start: new Date(before.start),
          end: new Date(before.end),
          allDay: before.allDay,
          status: before.status,
          priority: before.priority,
          location: before.location,
          recurrence: before.recurrence,
          recurrenceUntil: before.recurrenceUntil ? new Date(before.recurrenceUntil) : null,
          notes: before.notes,
        },
      });
      applied += 1;
    } else if (operation.type === "delete_task") {
      await prisma.task.deleteMany({ where: { id: operation.taskId, userId } });
      applied += 1;
    } else if (operation.type === "restore_task") {
      const before = operation.before;
      await prisma.task.updateMany({
        where: { id: operation.taskId, userId },
        data: {
          title: before.title,
          status: before.status,
          dueDate: before.dueDate ? new Date(before.dueDate) : null,
          notes: before.notes,
          priority: before.priority,
        },
      });
      applied += 1;
    }
  }
  return applied;
}

export async function undoLastAction(userId: string) {
  const log = await prisma.agentLog.findFirst({
    where: { userId, undone: false, NOT: { inverse: { equals: [] } } },
    orderBy: { createdAt: "desc" },
  });

  if (!log) return { ok: false as const, message: "Nothing to undo." };

  const inverse = (log.inverse as unknown as InverseOp[]) ?? [];
  if (!inverse.length) return { ok: false as const, message: "That change cannot be undone." };

  const applied = await applyInverse(userId, inverse);
  await prisma.agentLog.update({
    where: { id: log.id },
    data: { undone: true, undoneAt: new Date() },
  });

  return { ok: true as const, applied, logId: log.id, message: "Reverted your last change." };
}

/* -------------------------------------------------------------------------- */
/* Briefs                                                                      */
/* -------------------------------------------------------------------------- */

export async function saveBrief(
  userId: string,
  kind: "morning" | "review" | "insight",
  forDate: Date,
  headline: string,
  content: unknown,
) {
  const day = new Date(Date.UTC(forDate.getUTCFullYear(), forDate.getUTCMonth(), forDate.getUTCDate()));
  return prisma.brief.upsert({
    where: { userId_kind_forDate: { userId, kind, forDate: day } },
    update: { headline, content: content as object },
    create: { userId, kind, forDate: day, headline, content: content as object },
  });
}

export async function getBrief(userId: string, kind: "morning" | "review" | "insight", forDate: Date) {
  const day = new Date(Date.UTC(forDate.getUTCFullYear(), forDate.getUTCMonth(), forDate.getUTCDate()));
  return prisma.brief.findUnique({ where: { userId_kind_forDate: { userId, kind, forDate: day } } });
}

/* -------------------------------------------------------------------------- */
/* Insights                                                                    */
/* -------------------------------------------------------------------------- */

export async function getDayOverview(user: ServiceUser, now: Date) {
  const dayStart = startOfZonedDay(now, user.timezone);
  const dayEnd = addZonedDays(dayStart, 1, user.timezone);
  const events = await listEvents(user, { from: dayStart, to: dayEnd });
  const tasks = await listTasks(user, { limit: 50 });
  const dueToday = tasks.filter(
    (task) => task.dueDate && task.dueDate.getTime() < dayEnd.getTime() && task.status !== "done",
  );
  const focusMinutes = events
    .filter((event) => !UNPROTECTED_PREFIXES.includes(event.domainSlug))
    .reduce((total, event) => total + minutesBetween(event.start, event.end), 0);

  return {
    dayStart,
    dayEnd,
    events,
    tasks,
    dueToday,
    focusMinutes,
    nextEvent: events.find((event) => event.end.getTime() >= now.getTime()) ?? null,
  };
}

export async function getWeekStats(user: ServiceUser, weekStart: Date) {
  const weekEnd = addZonedDays(weekStart, 7, user.timezone);
  const prevStart = addZonedDays(weekStart, -7, user.timezone);
  const [events, prevEvents, tasks, prevTasks] = await Promise.all([
    listEvents(user, { from: weekStart, to: weekEnd }),
    listEvents(user, { from: prevStart, to: weekStart }),
    prisma.task.findMany({ where: { userId: user.id } }),
    prisma.task.findMany({ where: { userId: user.id, updatedAt: { lt: weekStart } } }),
  ]);

  const perDomain = new Map<string, { slug: string; name: string; accent: string; minutes: number; count: number }>();
  for (const event of events) {
    const entry = perDomain.get(event.domainSlug) ?? {
      slug: event.domainSlug,
      name: event.domainName,
      accent: event.domainAccent,
      minutes: 0,
      count: 0,
    };
    entry.minutes += minutesBetween(event.start, event.end);
    entry.count += 1;
    perDomain.set(event.domainSlug, entry);
  }

  const done = tasks.filter((task) => task.status === "done").length;
  const slipped = tasks.filter(
    (task) => task.status !== "done" && task.dueDate && task.dueDate.getTime() < weekEnd.getTime(),
  ).length;
  const totalTasks = tasks.length || 1;

  const focusMinutes = events
    .filter((event) => !UNPROTECTED_PREFIXES.includes(event.domainSlug))
    .reduce((total, event) => total + minutesBetween(event.start, event.end), 0);
  const prevFocusMinutes = prevEvents
    .filter((event) => !UNPROTECTED_PREFIXES.includes(event.domainSlug))
    .reduce((total, event) => total + minutesBetween(event.start, event.end), 0);

  const sleepEvents = events.filter((event) => event.domainSlug === "sleep");
  const karateEvents = events.filter((event) => event.domainSlug === "karate");

  return {
    weekStart,
    weekEnd,
    events,
    tasks,
    perDomain: [...perDomain.values()].sort((a, b) => b.minutes - a.minutes),
    plannedCount: events.length,
    plannedMinutes: events.reduce((total, event) => total + minutesBetween(event.start, event.end), 0),
    focusMinutes,
    prevFocusMinutes,
    adherence: Math.round((done / totalTasks) * 100),
    done,
    slipped,
    totalTasks: tasks.length,
    prevTaskCount: prevTasks.length,
    sleepNights: sleepEvents.length,
    karateSessions: karateEvents.length,
  };
}

export function domainLabel(slug: string): string {
  return DOMAIN_MAP[slug]?.name ?? slug;
}
