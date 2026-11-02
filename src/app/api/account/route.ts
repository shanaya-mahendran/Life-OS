import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, requireApiUser } from "@/lib/api";
import { clearCalendarData, resetDemoData, seedStarterWeek } from "@/lib/account";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const prefsSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  timezone: z.string().min(1).max(80).optional(),
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  sleepTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  dayStartHour: z.number().int().min(0).max(12).optional(),
  dayEndHour: z.number().int().min(12).max(23).optional(),
  minSleepHours: z.number().min(4).max(12).optional(),
  maxFocusHours: z.number().int().min(1).max(20).optional(),
  monthlyTokenBudget: z.number().int().min(0).max(50_000_000).optional(),
});

/** Full JSON export of everything LifeOS stores for this account. */
export async function GET() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const userId = auth.ctx.userId;
  const [user, domains, events, tasks, memories, agentLogs, briefs] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.domain.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } }),
    prisma.event.findMany({ where: { userId }, orderBy: { start: "asc" } }),
    prisma.task.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.memory.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, domainId: true, note: true, createdAt: true } }),
    prisma.agentLog.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 1000 }),
    prisma.brief.findMany({ where: { userId }, orderBy: { forDate: "desc" }, take: 120 }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    user,
    domains,
    events,
    tasks,
    memories,
    agentLogs,
    briefs,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="lifeos-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = prefsSchema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const user = await prisma.user.update({
    where: { id: auth.ctx.userId },
    data: parsed.data,
  });

  const start = parsed.data.dayStartHour ?? user.dayStartHour;
  const end = parsed.data.dayEndHour ?? user.dayEndHour;
  if (end <= start) return jsonError("The day must end after it starts.");

  return NextResponse.json({ ok: true });
}

/** `{ mode: "clear" | "reset" | "seed" }` clears calendar data or re-seeds the example week. */
export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => ({}));
  const rawMode = (body as { mode?: string }).mode;
  const mode = rawMode === "seed" ? "seed" : rawMode === "clear" ? "clear" : "reset";

  if (mode === "seed") {
    await seedStarterWeek(auth.ctx.userId);
  } else if (mode === "clear") {
    await clearCalendarData(auth.ctx.userId);
  } else {
    await resetDemoData(auth.ctx.userId);
  }

  return NextResponse.json({ ok: true, mode });
}
