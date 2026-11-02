import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Target } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { habitTrackerEnabled } from "@/lib/reset/flags";
import { getGoalDetail } from "@/lib/reset/habits";
import { GOAL_AREA_LABEL } from "@/lib/reset/constants";
import { dayKey } from "@/lib/time";
import { PageBanner } from "@/components/shell/PageBanner";
import { GoalDetailPanel } from "@/components/habits/GoalDetailPanel";

export const metadata = { title: "Goal progress · LifeOS" };
export const dynamic = "force-dynamic";

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!habitTrackerEnabled()) notFound();

  const { profile, user } = await requireProfile();
  const { id } = await params;
  const goal = await getGoalDetail(profile.id, id);
  if (!goal) notFound();

  const area = GOAL_AREA_LABEL[goal.goalArea] ?? goal.goalArea;
  const entries = goal.progress.map((entry) => ({
    id: entry.id,
    dateKey: dayKey(entry.date, user.timezone),
    value: entry.value,
    note: entry.note,
  }));

  return (
    <div className="space-y-4">
      <PageBanner
        icon={<Target className="h-5 w-5" />}
        title={goal.title}
        subtitle={`${area} · ${goal.metric || "Metric not set"} · target ${goal.targetValue} ${goal.unit} per ${goal.cadence}`}
        accent="#34d399"
        aside={
          <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">
            <p className="font-display text-[0.95rem] font-semibold text-white">{goal.progress.length}</p>
            <p className="text-[0.58rem] uppercase tracking-[0.16em] text-white/30">progress entries</p>
          </div>
        }
      />

      <GoalDetailPanel
        goalId={goal.id}
        title={goal.title}
        area={area}
        metric={goal.metric}
        unit={goal.unit}
        target={goal.targetValue}
        cadence={goal.cadence}
        todayKey={dayKey(new Date(), user.timezone)}
        planId={goal.planId}
        entries={entries}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
        <ArrowLeft className="h-3.5 w-3.5 text-white/30" />
        <Link href="/habits" className="text-[0.68rem] font-semibold text-emerald-300/70 hover:text-emerald-200">
          Back to Habit Tracker
        </Link>
        <span className="ml-auto text-[0.6rem] text-white/25">
          Goal tracking records the numbers you enter. It gives no financial or medical advice.
        </span>
      </div>
    </div>
  );
}
