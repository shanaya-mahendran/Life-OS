import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth";
import { confirmPlanAchievement } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/** GET /api/notifications - List user notifications & count */
export async function GET() {
  try {
    const { profile } = await requireProfile();

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: profile.id },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.notification.count({
        where: { userId: profile.id, status: "unread" },
      }),
    ]);

    return NextResponse.json({ ok: true, notifications, unreadCount });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/** PATCH /api/notifications - Mark as read */
export async function PATCH(request: Request) {
  try {
    const { profile } = await requireProfile();
    const body = await request.json().catch(() => ({}));
    const { id, all } = body;

    if (all) {
      await prisma.notification.updateMany({
        where: { userId: profile.id, status: "unread" },
        data: { status: "read" },
      });
      return NextResponse.json({ ok: true });
    }

    if (id) {
      await prisma.notification.updateMany({
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
    const { notificationId, achieved } = body;

    if (!notificationId || typeof achieved !== "boolean") {
      return NextResponse.json({ error: "notificationId and achieved (boolean) required" }, { status: 400 });
    }

    const result = await confirmPlanAchievement(profile.id, notificationId, achieved);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to confirm plan" },
      { status: 500 },
    );
  }
}
