import { prisma } from "@/lib/db";
import { resetPlanEnabled } from "./flags";
import { resetPlanInclude, type ResetPlanBundle } from "./service";
import { ensurePlanReports } from "./reports";
import { syncResetNotifications } from "./notifications";
import type { Prisma } from "@prisma/client";

type PlanWithUser = Prisma.ResetPlanGetPayload<{
  include: typeof resetPlanInclude & { user: { select: { timezone: true } } };
}>;

export async function runResetCron(kind: "daily" | "review" | "month", now = new Date()) {
  if (!resetPlanEnabled()) return { ok: true, plans: 0, reports: 0, delivered: 0, disabled: true };

  const plans = (await prisma.resetPlan.findMany({
    where: { status: "active" },
    include: { ...resetPlanInclude, user: { select: { timezone: true } } },
    take: 500,
  })) as PlanWithUser[];

  let reports = 0;
  let delivered = 0;

  for (const plan of plans) {
    try {
      if (kind !== "daily") {
        reports += await ensurePlanReports(plan as unknown as ResetPlanBundle, now, plan.user.timezone);
      }
      const result = await syncResetNotifications(plan as unknown as ResetPlanBundle, now, plan.user.timezone);
      delivered += result.delivered;
    } catch (error) {
      console.error(`[lifeos] reset ${kind} cron failed for`, plan.id, error);
    }
  }

  return { ok: true, plans: plans.length, reports, delivered };
}
