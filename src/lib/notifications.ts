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
import { formatInZone, dayKey } from "@/lib/time";
import { expandOccurrences } from "@/lib/calendar/recurrence";

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
 * Scans events across all active users (including recurring occurrences) and generates:
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

  const nowMs = now.getTime();
  const startWindow30MinFrom = new Date(nowMs + 20 * 60 * 1000);
  const startWindow30MinTo = new Date(nowMs + 40 * 60 * 1000);

  const startWindow15MinFrom = new Date(nowMs + 5 * 60 * 1000);
  const startWindow15MinTo = new Date(nowMs + 20 * 60 * 1000);

  const endWindow15MinFrom = new Date(nowMs - 45 * 60 * 1000);
  const endWindow15MinTo = new Date(nowMs - 5 * 60 * 1000);

  // Scan window: 2 hours around now for expansion
  const scanFrom = new Date(nowMs - 2 * 60 * 60 * 1000);
  const scanTo = new Date(nowMs + 2 * 60 * 60 * 1000);

  // Fetch all active events that could either start in range or repeat
  const candidateEvents = await prisma.event.findMany({
    where: {
      status: { notIn: ["cancelled"] },
      OR: [
        { start: { gte: scanFrom, lte: scanTo } },
        { recurrence: { not: null }, start: { lte: scanTo } },
      ],
    },
    include: {
      user: { select: { timezone: true } },
      domain: { select: { name: true, accent: true, slug: true } },
    },
    take: 300,
  });

  // Flatten events and their recurring occurrences
  interface FlattenedEvent {
    id: string;
    userId: string;
    title: string;
    start: Date;
    end: Date;
    domainSlug: string;
    domainName: string;
    domainAccent: string;
    userTimezone: string;
    isRecurring: boolean;
  }

  const flattened: FlattenedEvent[] = [];
  for (const event of candidateEvents) {
    const tz = event.user?.timezone || "Asia/Kolkata";
    if (event.recurrence) {
      const occurrences = expandOccurrences(
        { start: event.start, end: event.end, recurrence: event.recurrence, recurrenceUntil: event.recurrenceUntil },
        scanFrom,
        scanTo,
        tz,
      );
      for (const occ of occurrences) {
        flattened.push({
          id: event.id,
          userId: event.userId,
          title: event.title,
          start: occ.start,
          end: occ.end,
          domainSlug: event.domain.slug,
          domainName: event.domain.name,
          domainAccent: event.domain.accent,
          userTimezone: tz,
          isRecurring: true,
        });
      }
    } else {
      flattened.push({
        id: event.id,
        userId: event.userId,
        title: event.title,
        start: event.start,
        end: event.end,
        domainSlug: event.domain.slug,
        domainName: event.domain.name,
        domainAccent: event.domain.accent,
        userTimezone: tz,
        isRecurring: false,
      });
    }
  }

  for (const item of flattened) {
    const itemStartMs = item.start.getTime();
    const itemEndMs = item.end.getTime();
    const dateKey = dayKey(item.start, item.userTimezone);

    // 1. Check 30m before
    if (itemStartMs >= startWindow30MinFrom.getTime() && itemStartMs <= startWindow30MinTo.getTime()) {
      const typeKey = item.isRecurring ? `before_30m:${dateKey}` : "before_30m";
      try {
        const existing = await dbNotification.findFirst({
          where: {
            userId: item.userId,
            eventId: item.id,
            type: typeKey,
          },
        });

        if (!existing) {
          await dbNotification.create({
            data: {
              userId: item.userId,
              eventId: item.id,
              type: typeKey,
              title: `Upcoming in 30m: ${item.title}`,
              message: `Starts at ${clock(item.start, item.userTimezone)} in ${item.domainName}.`,
              link: `/calendar`,
              metadata: {
                domainSlug: item.domainSlug,
                domainAccent: item.domainAccent,
                start: item.start.toISOString(),
              },
            },
          });
          result.before30mCount += 1;
        }
      } catch {
        // ignore unique/race errors
      }
    }

    // 2. Check 15m before
    if (itemStartMs >= startWindow15MinFrom.getTime() && itemStartMs <= startWindow15MinTo.getTime()) {
      const typeKey = item.isRecurring ? `before_15m:${dateKey}` : "before_15m";
      try {
        const existing = await dbNotification.findFirst({
          where: {
            userId: item.userId,
            eventId: item.id,
            type: typeKey,
          },
        });

        if (!existing) {
          await dbNotification.create({
            data: {
              userId: item.userId,
              eventId: item.id,
              type: typeKey,
              title: `Starting in 15m: ${item.title}`,
              message: `Starting soon at ${clock(item.start, item.userTimezone)}. Time to focus!`,
              link: `/calendar`,
              metadata: {
                domainSlug: item.domainSlug,
                domainAccent: item.domainAccent,
                start: item.start.toISOString(),
              },
            },
          });
          result.before15mCount += 1;
        }
      } catch {
        // ignore
      }
    }

    // 3. Check 15m after (confirm achievement)
    if (itemEndMs >= endWindow15MinFrom.getTime() && itemEndMs <= endWindow15MinTo.getTime()) {
      const typeKey = item.isRecurring ? `after_15m:${dateKey}` : "after_15m";
      try {
        const existing = await dbNotification.findFirst({
          where: {
            userId: item.userId,
            eventId: item.id,
            type: typeKey,
          },
        });

        if (!existing) {
          await dbNotification.create({
            data: {
              userId: item.userId,
              eventId: item.id,
              type: typeKey,
              title: `Confirm: Did you achieve “${item.title}”?`,
              message: `Finished at ${clock(item.end, item.userTimezone)}. Confirm to track your adherence.`,
              link: `/today`,
              metadata: {
                domainSlug: item.domainSlug,
                domainAccent: item.domainAccent,
                eventTitle: item.title,
                end: item.end.toISOString(),
              },
            },
          });
          result.after15mCount += 1;
        }
      } catch {
        // ignore
      }
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
