import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Flag,
  Quote,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { resetPlanEnabled } from "@/lib/reset/flags";
import { getCurrentPlan, getLatestPlan, getPlanForUser, getPlanStats } from "@/lib/reset/service";
import { ensurePlanReports, reportForDay, reportMetrics } from "@/lib/reset/reports";
import { planDayNumber } from "@/lib/reset/calc";
import { formatInZone } from "@/lib/time";
import { PageBanner } from "@/components/shell/PageBanner";
import { ProgressRing } from "@/components/today/ProgressRing";
import { ResetTabs } from "@/components/reset/ResetTabs";
import { FinishActions } from "@/components/reset/FinishActions";
import { ProgressBar, StatCard } from "@/components/reset/ui";
import { RESET_PHASES } from "@/lib/reset/constants";

export const metadata = { title: "Reset finish · LifeOS" };
export const dynamic = "force-dynamic";

export default async function ResetFinishPage() {
  if (!resetPlanEnabled()) notFound();

  const { profile, user } = await requireProfile();
  const current = await getCurrentPlan(profile.id);
  const plan = current ?? (await getLatestPlan(profile.id));
  if (!plan) redirect("/reset");
  if (plan.status === "draft") redirect("/reset/builder");

  const now = new Date();
  if (plan.startedAt) {
    await ensurePlanReports(plan, now, user.timezone);
  }
  const fresh = (await getPlanForUser(profile.id, plan.id)) ?? plan;
  const day = fresh.startedAt ? planDayNumber(fresh.startedAt, now, user.timezone) : 0;
  const finished = fresh.status === "completed" || day >= 90;
  const stats = getPlanStats(fresh, now, user.timezone);
  const finalReport = reportForDay(fresh, 90);
  const metrics = finalReport ? reportMetrics(finalReport) : null;
  const totalReports = fresh.reports.filter((report) => report.status === "ready").length;
  const gap = (fresh.gapReport as Record<string, unknown> | null) ?? {};
  const accent = finished ? "#34d399" : "#8b5cf6";

  if (!finished) {
    return (
      <div className="space-y-4">
        <PageBanner
          icon={<Flag className="h-5 w-5" />}
          title="The finish line"
          subtitle={`Day ${day} of 90. The closing report opens on day 90; the plan is still yours until then.`}
          accent={accent}
          aside={
            <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">
              <p className="font-display text-[0.95rem] font-semibold text-white">{stats.progress}%</p>
              <p className="text-[0.58rem] uppercase tracking-[0.16em] text-white/30">through the program</p>
            </div>
          }
        />
        <ResetTabs />

        <section className="surface relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-violet-500/15 blur-3xl" />
          <div className="relative grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <ProgressRing value={stats.progress} size={124} accent="#8b5cf6" label="complete" />
            <div>
              <p className="font-display text-[1.2rem] font-semibold text-white">Not day 90 yet.</p>
              <p className="mt-1 max-w-xl text-[0.78rem] leading-relaxed text-white/40">
                You are on day {day}. The final report compares the week you started with the week you finish. Keep
                checking in — the last period needs the same honest data as the first.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/reset/plan" className="btn btn-primary text-[0.76rem]">
                  Back to today&apos;s check-in
                </Link>
                <Link href="/reset/reports" className="btn btn-ghost text-[0.76rem]">
                  See the report schedule
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <StatCard label="Day" value={`${day} / 90`} caption={`${90 - day} days to the closing report`} accent="#8b5cf6" icon={<CalendarCheck className="h-3.5 w-3.5" />} />
          <StatCard label="Check-ins" value={stats.done} caption={`${stats.missed} missed · ${stats.skipped} skipped`} accent="#34d399" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
          <StatCard label="Streak" value={`${stats.streak}d`} caption="Consecutive clean days" accent="#fbbf24" icon={<Sparkles className="h-3.5 w-3.5" />} />
          <StatCard label="Reports" value={totalReports} caption="Ready to revisit" accent="#38bdf8" icon={<Trophy className="h-3.5 w-3.5" />} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageBanner
        icon={<Flag className="h-5 w-5" />}
        title="Ninety days, finished"
        subtitle={
          fresh.status === "completed"
            ? "The cycle is closed. The record stays yours."
            : "The final report is ready. Close the cycle when you are."
        }
        accent="#34d399"
        aside={
          <div className="hidden rounded-xl border border-emerald-400/20 bg-emerald-500/[0.08] px-3 py-2 text-right sm:block">
            <p className="font-display text-[0.95rem] font-semibold text-white">{metrics?.adherence ?? stats.adherence}%</p>
            <p className="text-[0.58rem] uppercase tracking-[0.16em] text-white/30">final 15-day rate</p>
          </div>
        }
      />

      <ResetTabs />

      <section className="relative overflow-hidden rounded-3xl border border-emerald-400/25 bg-[linear-gradient(130deg,rgba(13,58,45,0.65),rgba(16,13,35,0.95)_55%,rgba(10,7,22,0.98))] p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <span className="chip border-emerald-400/25 bg-emerald-500/10 text-emerald-200">
              <CheckCircle2 className="h-3 w-3" /> {activeLabel(fresh.startedAt, user.timezone)} → {fresh.completedAt ? formatInZone(fresh.completedAt, user.timezone, { month: "short", day: "numeric" }) : "day 90"}
            </span>
            <h2 className="mt-3 font-display text-[1.6rem] font-bold leading-tight text-white sm:text-[2rem]">
              You finished what you started.
            </h2>
            <p className="mt-2 max-w-xl text-[0.8rem] leading-relaxed text-white/45">
              {metrics
                ? `${metrics.done} done, ${metrics.missed} missed and ${metrics.skipped} consciously skipped in the final period. ${metrics.best ? `“${metrics.best.title}” was your steadiest commitment.` : ""}`
                : "The final report will appear here as soon as the closing period has data."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {finalReport && (
                <Link href={`/reset/reports/${finalReport.id}`} className="btn btn-primary text-[0.76rem]">
                  Open the final report <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
              <Link href="/reset/reports" className="btn btn-ghost text-[0.76rem]">
                All reports
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 lg:w-[24rem]">
            {[
              { label: "Final rate", value: `${metrics?.adherence ?? stats.adherence}%`, accent: "#34d399" },
              { label: "Done", value: metrics?.done ?? stats.done, accent: "#a78bfa" },
              { label: "Best", value: `${metrics?.best?.adherence ?? 0}%`, accent: "#fbbf24" },
            ].map((entry) => (
              <div key={entry.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3 text-center">
                <p className="font-display text-[1.2rem] font-bold text-white">{entry.value}</p>
                <p className="mt-1 text-[0.55rem] uppercase tracking-[0.12em] text-white/30">{entry.label}</p>
                <span className="mx-auto mt-1.5 block h-0.5 w-8 rounded-full" style={{ backgroundColor: entry.accent }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="surface p-4">
          <div className="flex items-center gap-2">
            <Quote className="h-4 w-4 text-emerald-300" />
            <h2 className="font-display text-[0.95rem] font-semibold text-white">Before and after, in your words</h2>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
              <p className="text-[0.56rem] font-bold uppercase tracking-[0.14em] text-white/25">Day 0</p>
              <p className="mt-1.5 text-[0.75rem] leading-relaxed text-white/45">
                {typeof gap.currentQuote === "string" && gap.currentQuote ? `“${gap.currentQuote}”` : "No audit quote saved."}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/18 bg-emerald-500/[0.05] p-3">
              <p className="text-[0.56rem] font-bold uppercase tracking-[0.14em] text-emerald-300/50">What stayed</p>
              <p className="mt-1.5 text-[0.75rem] leading-relaxed text-white/55">
                {metrics?.best ? `“${metrics.best.title}” held at ${metrics.best.adherence}%. ` : ""}
                {typeof gap.recommendedFocus === "string" && gap.recommendedFocus
                  ? `The focus you named was ${gap.recommendedFocus.toLowerCase()}.`
                  : "The record is here for you to read."}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[0.6rem] text-white/25">
              <span>Day 1</span>
              <span>Final report</span>
              <span>Day 90</span>
            </div>
            <ProgressBar value={100} accent="#34d399" className="mt-1.5" />
          </div>
        </section>

        <section className="surface p-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-violet-300" />
            <h2 className="font-display text-[0.95rem] font-semibold text-white">The three phases</h2>
          </div>
          <div className="mt-2.5 space-y-1.5">
            {RESET_PHASES.map((phase) => (
              <div key={phase.phase} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                <span
                  className="grid h-6 w-6 place-items-center rounded-full border text-[0.55rem]"
                  style={{ borderColor: `${phase.accent}55`, color: phase.accent, backgroundColor: `${phase.accent}12` }}
                >
                  <CheckCircle2 className="h-3 w-3" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.7rem] font-medium text-white/65">{phase.name}</p>
                  <p className="truncate text-[0.58rem] text-white/25">{phase.days}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[0.62rem] leading-relaxed text-white/25">
            {totalReports} report{totalReports === 1 ? "" : "s"} ready · all check-ins remain available in the habit
            tracker.
          </p>
        </section>
      </div>

      {metrics && (
        <section className="surface p-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-300" />
            <h2 className="font-display text-[0.95rem] font-semibold text-white">Final numbers</h2>
            <span className="ml-auto text-[0.6rem] text-white/25">All traceable to check-ins</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
              <p className="text-[0.55rem] uppercase tracking-[0.12em] text-white/25">Done</p>
              <p className="mt-1 font-display text-[1.05rem] font-semibold text-white">{metrics.done}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
              <p className="text-[0.55rem] uppercase tracking-[0.12em] text-white/25">Missed</p>
              <p className="mt-1 font-display text-[1.05rem] font-semibold text-white">{metrics.missed}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
              <p className="text-[0.55rem] uppercase tracking-[0.12em] text-white/25">Skipped</p>
              <p className="mt-1 font-display text-[1.05rem] font-semibold text-white">{metrics.skipped}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
              <p className="text-[0.55rem] uppercase tracking-[0.12em] text-white/25">Streak</p>
              <p className="mt-1 font-display text-[1.05rem] font-semibold text-white">{metrics.streak}d</p>
            </div>
          </div>
        </section>
      )}

      <FinishActions planId={fresh.id} completed={fresh.status === "completed"} />

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-[0.65rem] leading-relaxed text-white/30">
        Closing the plan does not delete its check-ins, reports or habits. You can export or delete the whole program
        from Reset settings. This app is not medical, therapy or financial advice.
      </div>
    </div>
  );
}

function activeLabel(startedAt: Date | null, timeZone: string): string {
  if (!startedAt) return "Day 1";
  return formatInZone(startedAt, timeZone, { month: "short", day: "numeric" });
}
