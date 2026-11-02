import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { SlidersHorizontal, Target } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth";
import { resetPlanEnabled } from "@/lib/reset/flags";
import { getCurrentPlan, getPlanStats } from "@/lib/reset/service";
import { PageBanner } from "@/components/shell/PageBanner";
import { ResetTabs } from "@/components/reset/ResetTabs";
import { PlanBuilder, type BuilderCommitment } from "@/components/reset/PlanBuilder";

export const metadata = { title: "Reset plan builder · LifeOS" };
export const dynamic = "force-dynamic";

export default async function ResetBuilderPage() {
  if (!resetPlanEnabled()) notFound();

  const { profile, user } = await requireProfile();
  const plan = await getCurrentPlan(profile.id);
  if (!plan) redirect("/reset");
  if (plan.status === "completed") redirect("/reset/finish");
  if (plan.status === "paused") redirect("/reset/plan");
  if (!plan.gapApprovedAt) redirect("/reset/gap");

  const [domains, stats] = await Promise.all([
    prisma.domain.findMany({
      where: { userId: profile.id },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true, accent: true },
    }),
    Promise.resolve(getPlanStats(plan, new Date(), user.timezone)),
  ]);

  const commitments: BuilderCommitment[] = plan.commitments.map((commitment) => ({
    id: commitment.id,
    phase: commitment.phase,
    kind: commitment.kind,
    title: commitment.title,
    notes: commitment.notes,
    domainSlug: commitment.domainSlug,
    cadence: commitment.cadence,
    weekday: commitment.weekday,
    time: commitment.time,
    durationMinutes: commitment.durationMinutes,
    calendarEnabled: commitment.calendarEnabled,
    goalArea: commitment.goalArea,
    metric: commitment.metric,
    unit: commitment.unit,
    targetValue: commitment.targetValue,
    status: commitment.status,
  }));

  return (
    <div className="space-y-4">
      <PageBanner
        icon={<SlidersHorizontal className="h-5 w-5" />}
        title="Plan builder"
        subtitle="Small enough to repeat. Every commitment has one owner domain and one clear way to check in."
        accent="#a78bfa"
        aside={
          <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">
            <p className="font-display text-[0.95rem] font-semibold text-white">
              {plan.status === "active" ? `Day ${stats.day}` : "Draft"}
            </p>
            <p className="text-[0.58rem] uppercase tracking-[0.16em] text-white/30">
              {plan.status === "active" ? "running plan" : "nothing booked"}
            </p>
          </div>
        }
      />

      <ResetTabs />

      <PlanBuilder
        planId={plan.id}
        status={plan.status}
        currentPhase={plan.currentPhase}
        unlockedPhase={plan.unlockedPhase}
        day={stats.day}
        domains={domains}
        wakeTime={user.wakeTime}
        initialCommitments={commitments}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
        <Target className="h-3.5 w-3.5 text-violet-300/70" />
        <Link href="/reset/gap" className="text-[0.7rem] font-medium text-violet-300/80 hover:text-violet-200">
          Review the gap report
        </Link>
        <span className="ml-auto text-[0.63rem] text-white/25">
          Limits: 3 cuts · 3 non-negotiables · 3 goals
        </span>
      </div>
    </div>
  );
}
