/**
 * LifeOS Notification & Check-in Engine.
 *
 * Handles:
 * - 30 minutes before event alert
 * - 15 minutes before event alert
 * - 15 minutes after event completion check-in ("Did you achieve this plan?")
 * - Morning brief & Weekly review notifications
 * - Marking events/tasks done upon confirmation
 */

import { prisma } from "@/lib/db";
import { formatInZone } from "@/lib/time";

const dbNotification = (prisma as any).notification;

export interface EventNotificationResult {
  before30mCount: number;
  before15mCount: number;
  after15mCount: number;
}

/**
 * Safely creates a notification without throwing or breaking if table/client is rebuilding.
 */
export async function createSystemNotification(data: {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  eventId?: string;
}): Promise<void> {
  try {
    await dbNotification.create({
      data,
    });
  } catch (error) {
    console.warn("[lifeos] createSystemNotification suppressed:", error);
  }
}

function clock(date: Date, timeZone: string): string {
  return formatInZone(date, timeZone, { hour: "numeric", minute: "2-digit" });
}

/**
 * Scans events across all active users and generates:
 * 1. 30 minutes before: "Upcoming in 30 minutes"
 * 2. 15 minutes before: "Starting in 15 minutes"
 * 3. 15 minutes after: "Did you achieve [Title]?"
 */
export async function generateEventNotifications(now: Date = new Date()): Promise<EventNotificationResult> {
  const result: EventNotificationResult = {
    before30mCount: 0,
    before15mCount: 0,
    after15mCount: 0,
  };

  // Time boundaries
  const nowMs = now.getTime();
  const startWindow30MinFrom = new Date(nowMs + 22 * 60 * 1000);
  const startWindow30MinTo = new Date(nowMs + 38 * 60 * 1000);

  const startWindow15MinFrom = new Date(nowMs + 7 * 60 * 1000);
  const startWindow15MinTo = new Date(nowMs + 22 * 60 * 1000);

  const endWindow15MinFrom = new Date(nowMs - 35 * 60 * 1000);
  const endWindow15MinTo = new Date(nowMs - 7 * 60 * 1000);

  // 1. Check for events starting in ~30 minutes
  const events30m = await prisma.event.findMany({
    where: {
      start: { gte: startWindow30MinFrom, lte: startWindow30MinTo },
      status: { notIn: ["cancelled"] },
    },
    include: {
      user: { select: { timezone: true } },
      domain: { select: { name: true, accent: true, slug: true } },
    },
    take: 200,
  });

  for (const event of events30m) {
    try {
      await dbNotification.upsert({
        where: {
          userId_eventId_type: {
            userId: event.userId,
            eventId: event.id,
            type: "before_30m",
          },
        },
        create: {
          userId: event.userId,
          eventId: event.id,
          type: "before_30m",
          title: `Upcoming in 30m: ${event.title}`,
          message: `Starts at ${clock(event.start, event.user.timezone)} in ${event.domain.name}.`,
          link: `/calendar`,
          metadata: {
            domainSlug: event.domain.slug,
            domainAccent: event.domain.accent,
            start: event.start.toISOString(),
          },
        },
        update: {},
      });
      result.before30mCount += 1;
    } catch {
      // already exists, unique constraint honored
    }
  }

  // 2. Check for events starting in ~15 minutes
  const events15m = await prisma.event.findMany({
    where: {
      start: { gte: startWindow15MinFrom, lte: startWindow15MinTo },
      status: { notIn: ["cancelled"] },
    },
    include: {
      user: { select: { timezone: true } },
      domain: { select: { name: true, accent: true, slug: true } },
    },
    take: 200,
  });

  for (const event of events15m) {
    try {
      await dbNotification.upsert({
        where: {
          userId_eventId_type: {
            userId: event.userId,
            eventId: event.id,
            type: "before_15m",
          },
        },
        create: {
          userId: event.userId,
          eventId: event.id,
          type: "before_15m",
          title: `Starting in 15m: ${event.title}`,
          message: `Starting soon at ${clock(event.start, event.user.timezone)}. Time to focus!`,
          link: `/calendar`,
          metadata: {
            domainSlug: event.domain.slug,
            domainAccent: event.domain.accent,
            start: event.start.toISOString(),
          },
        },
        update: {},
      });
      result.before15mCount += 1;
    } catch {
      // already exists
    }
  }

  // 3. Check for events that ended ~15 minutes ago to confirm achievement
  const eventsFinished = await prisma.event.findMany({
    where: {
      end: { gte: endWindow15MinFrom, lte: endWindow15MinTo },
      status: { notIn: ["cancelled"] },
      domain: { slug: { notIn: ["sleep"] } },
    },
    include: {
      user: { select: { timezone: true } },
      domain: { select: { name: true, accent: true, slug: true } },
    },
    take: 200,
  });

  for (const event of eventsFinished) {
    try {
      await dbNotification.upsert({
        where: {
          userId_eventId_type: {
            userId: event.userId,
            eventId: event.id,
            type: "after_15m",
          },
        },
        create: {
          userId: event.userId,
          eventId: event.id,
          type: "after_15m",
          title: `Confirm: Did you achieve “${event.title}”?`,
          message: `Scheduled time finished at ${clock(event.end, event.user.timezone)}. Confirm to track your adherence.`,
          link: `/today`,
          metadata: {
            domainSlug: event.domain.slug,
            domainAccent: event.domain.accent,
            eventTitle: event.title,
            currentStatus: event.status,
          },
        },
        update: {},
      });
      result.after15mCount += 1;
    } catch {
      // already exists
    }
  }

  return result;
}

/**
 * Confirms whether an event's plan was achieved or missed.
 * When achieved, updates event status to 'done' and marks any matching task as completed.
 */
export async function confirmPlanAchievement(
  userId: string,
  notificationId: string,
  achieved: boolean,
): Promise<{ ok: boolean; status: string; message: string }> {
  const notification = await dbNotification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    throw new Error("Notification not found.");
  }

  const newStatus = achieved ? "confirmed_achieved" : "confirmed_missed";

  await dbNotification.update({
    where: { id: notificationId },
    data: { status: newStatus },
  });

  if (notification.eventId && achieved) {
    // Mark event as done
    await prisma.event.updateMany({
      where: { id: notification.eventId, userId },
      data: { status: "done" },
    });

    // Mark any matching tasks as completed
    const event = await prisma.event.findUnique({
      where: { id: notification.eventId },
      select: { title: true, domainId: true },
    });

    if (event) {
      await prisma.task.updateMany({
        where: {
          userId,
          domainId: event.domainId,
          title: { contains: event.title, mode: "insensitive" },
          status: { not: "done" },
        },
        data: { status: "done", completedAt: new Date() },
      });
    }
  }

  return {
    ok: true,
    status: newStatus,
    message: achieved
      ? "Awesome! Plan recorded as achieved."
      : "Noted. Plan recorded as missed / rescheduled.",
  };
}
