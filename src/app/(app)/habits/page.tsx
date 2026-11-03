import { notFound } from "next/navigation";
import { Activity, CheckCircle2, Flame, Sparkles, Target } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth";
import { habitTrackerEnabled } from "@/lib/reset/flags";
import { HABITS_ACCENT } from "@/lib/reset/constants";
import { getHabitOverview } from "@/lib/reset/habits";
import { PageBanner } from "@/components/shell/PageBanner";
import { StatCard } from "@/components/reset/ui";
import { HabitTracker } from "@/components/habits/HabitTracker";

export const metadata = { title: "Habit Tracker · LifeOS" };
export const dynamic = "force-dynamic";

export default async function HabitsPage() {
  if (!habitTrackerEnabled()) notFound();

  const { profile, user } = await requireProfile();
  const [overview, domains] = await Promise.all([
    getHabitOverview(user),
    prisma.domain.findMany({
      where: { userId: profile.id },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true, accent: true },
    }),
  ]);

  const { summary } = overview;

  return (
    <div className="space-y-4">
      <PageBanner
        icon={<Activity className="h-5 w-5" />}
        title="Habit Tracker"
        subtitle="Plan in, tracking out. Every Reset commitment appears here with no re-entry — manual habits live alongside it."
        accent={HABITS_ACCENT}
        aside={
          <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">
            <p className="font-display text-[0.95rem] font-semibold text-white">
              {overview.planActive ? `Day ${overview.planDay}` : "Standalone"}
            </p>
            <p className="text-[0.58rem] uppercase tracking-[0.16em] text-white/30">
              {overview.planActive ? "Reset plan running" : "no active plan"}
            </p>
          </div>
        }
      />

      {overview.habits.length + overview.goals.length > 0 && <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard
          label="Today"
          value={`${summary.todayDone} / ${summary.todayTotal}`}
          caption="Daily habits checked in"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          accent="#34d399"
        />
        <StatCard
          label="Best streak"
          value={`${summary.bestStreak}d`}
          caption="Across every active habit"
          icon={<Flame className="h-3.5 w-3.5" />}
          accent="#fbbf24"
        />
        <StatCard
          label="14-day rate"
          value={`${summary.adherence}%`}
          caption="Average of all tracked habits"
          icon={<Sparkles className="h-3.5 w-3.5" />}
          accent="#a78bfa"
        />
        <StatCard
          label="Goals on track"
          value={`${summary.goalsOnTrack} / ${summary.goalsTotal}`}
          caption="Progress against the target"
          icon={<Target className="h-3.5 w-3.5" />}
          accent="#38bdf8"
        />
      </div>}

      <HabitTracker
        habits={overview.habits}
        goals={overview.goals}
        domains={domains}
        planActive={overview.planActive}
        planDay={overview.planDay}
        todayKey={overview.todayKey}
      />

    </div>
  );
}
