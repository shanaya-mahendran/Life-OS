import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth";
import { confirmPlanAchievement, generateEventNotifications, recordEventAchievement } from "@/lib/notifications";

const dbNotification = (prisma as any).notification;

export const dynamic = "force-dynamic";

/** GET /api/notifications - List user notifications & count */
export async function GET() {
  let profileId: string;
  try {
    const { profile } = await requireProfile();
    profileId = profile.id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Generate reminders and check-ins during the app's active notification poll.
    await generateEventNotifications();
    const [notifications, unreadCount] = await Promise.all([
      dbNotification.findMany({
        where: { userId: profileId },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      dbNotification.count({
        where: { userId: profileId, status: "unread" },
      }),
    ]);

    return NextResponse.json({ ok: true, notifications, unreadCount });
  } catch (error) {
    console.error("[lifeos] Could not load notifications:", error);
    return NextResponse.json({ error: "Could not load notifications." }, { status: 500 });
  }
}

/** PATCH /api/notifications - Mark as read */
export async function PATCH(request: Request) {
  try {
    const { profile } = await requireProfile();
    const body = await request.json().catch(() => ({}));
    const { id, all } = body;

    if (all) {
      await dbNotification.updateMany({
        where: { userId: profile.id, status: "unread" },
        data: { status: "read" },
      });
      return NextResponse.json({ ok: true });
    }

    if (id) {
      await dbNotification.updateMany({
        where: { id, userId: profile.id, status: "unread" },
        data: { status: "read" },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Missing id or all flag" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/** POST /api/notifications - Confirm plan achievement (achieved: true | false) */
export async function POST(request: Request) {
  try {
    const { profile } = await requireProfile();
    const body = await request.json();
    const { notificationId, eventId, start, achieved } = body;

    if (typeof achieved !== "boolean") {
      return NextResponse.json({ error: "achieved (boolean) is required" }, { status: 400 });
    }

    if (notificationId) {
      const result = await confirmPlanAchievement(profile.id, notificationId, achieved);
      return NextResponse.json(result);
    }

    if (typeof eventId !== "string" || typeof start !== "string") {
      return NextResponse.json({ error: "notificationId or eventId and start are required" }, { status: 400 });
    }

    const result = await recordEventAchievement(profile.id, eventId, start, achieved);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to confirm plan" },
      { status: 500 },
    );
  }
}
