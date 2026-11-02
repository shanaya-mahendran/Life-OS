import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Flame,
  LockKeyhole,
  RotateCcw,
  Settings2,
  Sparkles,
  Target,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth";
import { formatInZone } from "@/lib/time";
import { resetPlanEnabled } from "@/lib/reset/flags";
import { getCurrentPlan, getPlanStats } from "@/lib/reset/service";
import { dueNotebookPeriod, ensurePlanReports } from "@/lib/reset/reports";
import { syncResetNotifications } from "@/lib/reset/notifications";
import { planDayDate, phaseForPlanDay } from "@/lib/reset/calc";
import { RESET_PHASES, phaseForNumber } from "@/lib/reset/constants";
import { withAlpha } from "@/lib/utils";
import { PageBanner } from "@/components/shell/PageBanner";
import { ProgressRing } from "@/components/today/ProgressRing";
import { ResetTabs } from "@/components/reset/ResetTabs";
import { TodayCheckin } from "@/components/reset/TodayCheckin";
import { DriftCard } from "@/components/reset/DriftCard";
import { PlanActionButton } from "@/components/reset/PlanActionButton";
import { PhaseAdvanceCard } from "@/components/reset/PhaseAdvanceCard";
import { ProgressBar, SectionHeading, StatCard, kindTone } from "@/components/reset/ui";

export const metadata = { title: "Reset plan · LifeOS" };
export const dynamic = "force-dynamic";

export default async function ResetPlanHomePage() {
  if (!resetPlanEnabled()) notFound();

  const { profile, user } = await requireProfile();
  let plan = await getCurrentPlan(profile.id);
  if (!plan) redirect("/reset");
  if (plan.status === "completed") redirect("/reset/finish");
  if (plan.status === "draft") {
    if (![1, 2, 3].every((step) => plan!.answers.find((answer) => answer.step === step)?.answer)) {
      redirect("/reset/audit");
    }
    if (!plan.gapApprovedAt) redirect("/reset/gap");
    redirect("/reset/builder");
  }

  const now = new Date();
  if (plan.status === "active") {
    await ensurePlanReports(plan, now, user.timezone);
    const refreshed = await getCurrentPlan(profile.id);
    if (refreshed) plan = refreshed;
    await syncResetNotifications(plan, now, user.timezone);
  }

  const stats = getPlanStats(plan, now, user.timezone);
  const notebookDue = dueNotebookPeriod(plan, now, user.timezone);
  const nextReviewDate =
    stats.nextReview && plan.startedAt ? planDayDate(plan.startedAt, stats.nextReview.day, user.timezone) : null;
  const latestReport = [...plan.reports].sort((a, b) => b.reviewDay - a.reviewDay)[0] ?? null;
  const domains = await prisma.domain.findMany({
    where: { userId: profile.id },
    select: { slug: true, name: true, accent: true, icon: true },
  });
  const domainMap = new Map(domains.map((domain) => [domain.slug, domain]));
  const currentPhase = phaseForNumber(stats.phase.phase);
  const nextPhase = stats.phase.phase < 3 ? phaseForNumber(stats.phase.phase + 1) : null;
  const nextPhaseCommitments = nextPhase
    ? plan.commitments.filter(
        (commitment) => commitment.phase === nextPhase.phase && commitment.status !== "dropped",
      ).length
    : 0;

  const items = stats.today.map((entry) => {
    const domain = domainMap.get(entry.commitment.domainSlug);
    return {
      id: entry.commitment.id,
      title: entry.commitment.title,
      kind: entry.commitment.kind,
      domainName: domain?.name ?? entry.commitment.domainSlug,
      accent: domain?.accent ?? kindTone(entry.commitment.kind),
      time: entry.commitment.time,
      durationMinutes: entry.commitment.durationMinutes,
      cadence: entry.commitment.cadence,
      streak: entry.streak,
      todayResult: entry.todayResult,
      weekResult: entry.weekResult,
    };
  });

  return (
    <div className="space-y-4">
      <PageBanner
        icon={<RotateCcw className="h-5 w-5" />}
        title="Reset plan"
        subtitle={`Day ${stats.day} of 90 · ${currentPhase.name} — ${currentPhase.goal}.`}
        accent={currentPhase.accent}
        aside={
          <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">
            <p className="font-display text-[0.95rem] font-semibold text-white">{stats.progress}%</p>
            <p className="text-[0.58rem] uppercase tracking-[0.16em] text-white/30">through the 90 days</p>
          </div>
        }
      />

      <ResetTabs />

      {plan.status === "paused" && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-amber-400/25 bg-amber-400/[0.08] px-3.5 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-400/15 text-amber-300">
            <LockKeyhole className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.78rem] font-semibold text-amber-100/90">The plan is paused.</p>
            <p className="text-[0.66rem] text-amber-100/45">
              Notifications are off and check-ins are locked. Everything you recorded is still here.
            </p>
          </div>
          <PlanActionButton
            action="resume"
            planId={plan.id}
            label="Resume plan"
            busyLabel="Resuming…"
            tone="ghost"
            className="w-full sm:w-auto"
          />
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="surface relative overflow-hidden p-4">
          <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-violet-500/15 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <ProgressRing value={stats.adherence} size={116} stroke={9} accent={currentPhase.accent} label="15-day rate" />
            <div className="min-w-0">
              <span
                className="inline-flex rounded-full border px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.12em]"
                style={{
                  borderColor: withAlpha(currentPhase.accent, 0.35),
                  backgroundColor: withAlpha(currentPhase.accent, 0.12),
                  color: currentPhase.accent,
                }}
              >
                Day {stats.day} · {currentPhase.shortName}
              </span>
              <p className="mt-1.5 font-display text-[1.08rem] font-semibold text-white">{currentPhase.name}</p>
              <p className="mt-0.5 text-[0.68rem] leading-relaxed text-white/35">{currentPhase.dailyRule}</p>
              <div className="mt-2">
                <ProgressBar value={stats.progress} accent={currentPhase.accent} />
                <div className="mt-1 flex justify-between text-[0.58rem] text-white/25">
                  <span>Day 1</span>
                  <span>Day 90</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative mt-3 grid grid-cols-2 gap-1.5">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
              <p className="text-[0.55rem] uppercase tracking-[0.12em] text-white/25">Next review</p>
              <p className="mt-0.5 text-[0.72rem] font-semibold text-white/75">
                {nextReviewDate
                  ? formatInZone(nextReviewDate, user.timezone, { weekday: "short", month: "short", day: "numeric" })
                  : "Final report ready"}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
              <p className="text-[0.55rem] uppercase tracking-[0.12em] text-white/25">Check-in time</p>
              <p className="mt-0.5 text-[0.72rem] font-semibold text-white/75">{plan.checkinTime}</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2.5">
          <StatCard
            label="Day"
            value={`${stats.day} / 90`}
            caption={`${currentPhase.days} · ${currentPhase.name}`}
            icon={<CalendarCheck className="h-3.5 w-3.5" />}
            accent={currentPhase.accent}
          />
          <StatCard
            label="Streak"
            value={`${stats.streak} day${stats.streak === 1 ? "" : "s"}`}
            caption="Consecutive days with a done check-in and no miss."
            icon={<Flame className="h-3.5 w-3.5" />}
            accent="#fbbf24"
          />
          <StatCard
            label="Last 15 days"
            value={`${stats.done} done`}
            caption={`${stats.missed} missed · ${stats.skipped} skipped on purpose`}
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            accent="#34d399"
          />
          <StatCard
            label="Next review"
            value={stats.nextReview ? `Day ${stats.nextReview.day}` : "Day 90"}
            caption={
              nextReviewDate
                ? `${formatInZone(nextReviewDate, user.timezone, { weekday: "long" })} · six reviews across the program`
                : "The final report is the closing picture."
            }
            icon={<BarChart3 className="h-3.5 w-3.5" />}
            accent="#38bdf8"
          />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <TodayCheckin
          planId={plan.id}
          items={items}
          canCheckin={plan.status === "active"}
          checkinTime={plan.checkinTime}
        />

        <div className="space-y-3">
          {notebookDue ? (
            <section className="surface relative overflow-hidden p-4">
              <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-fuchsia-500/15 blur-3xl" />
              <div className="relative">
                <span className="chip border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-200">
                  <BookOpen className="h-3 w-3" /> Review open
                </span>
                <h2 className="mt-2 font-display text-[0.95rem] font-semibold text-white">
                  {notebookDue.label}
                </h2>
                <p className="mt-1 text-[0.7rem] leading-relaxed text-white/40">
                  Three questions in your own words. The report is built from them and from the check-ins you already
                  recorded.
                </p>
                <Link
                  href={`/reset/notebook?day=${notebookDue.day}`}
                  className="btn btn-primary mt-3 w-full justify-center text-[0.76rem]"
                >
                  Open the notebook <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <p className="mt-1.5 text-center text-[0.6rem] text-white/25">
                  Skipping on purpose counts as skipped, not missed.
                </p>
              </div>
            </section>
          ) : latestReport ? (
            <section className="surface p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-sky-300" />
                <h2 className="font-display text-[0.92rem] font-semibold text-white">Latest report</h2>
                <span className="ml-auto text-[0.6rem] text-white/30">Day {latestReport.reviewDay}</span>
              </div>
              <p className="mt-2 line-clamp-3 text-[0.7rem] leading-relaxed text-white/40">{latestReport.summary}</p>
              <Link href={`/reset/reports/${latestReport.id}`} className="btn btn-ghost mt-3 w-full justify-center text-[0.73rem]">
                Read the report <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </section>
          ) : (
            <section className="surface p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-sky-300" />
                <h2 className="font-display text-[0.92rem] font-semibold text-white">Reports</h2>
              </div>
              <p className="mt-2 text-[0.7rem] leading-relaxed text-white/40">
                The first 15-day review opens on day 15. Monthly reports arrive on days 30, 60 and 90, each with a
                notification.
              </p>
              <Link href="/reset/reports" className="btn btn-ghost mt-3 w-full justify-center text-[0.73rem]">
                See the schedule <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </section>
          )}

          {plan.status === "active" && nextPhase && (
            <PhaseAdvanceCard
              planId={plan.id}
              phase={stats.phase.phase}
              phaseName={currentPhase.name}
              nextPhase={nextPhase.phase}
              nextPhaseName={nextPhase.name}
              day={stats.day}
              nextCommitments={nextPhaseCommitments}
              opensOn={stats.phase.dayEnd}
            />
          )}

          <section className="surface p-4">
            <SectionHeading icon={<Target className="h-4 w-4" />} title="Three phases" subtitle="The program moves in order, not all at once." />
            <div className="mt-3 space-y-2">
              {RESET_PHASES.map((phase) => {
                const complete = stats.day > phase.dayEnd;
                const current = stats.day >= phase.dayStart && stats.day <= phase.dayEnd;
                const locked = stats.day < phase.dayStart;
                return (
                  <div
                    key={phase.phase}
                    className="rounded-xl border p-2.5"
                    style={{
                      borderColor: current ? withAlpha(phase.accent, 0.32) : "rgba(255,255,255,0.06)",
                      background: current ? withAlpha(phase.accent, 0.07) : "rgba(255,255,255,0.018)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[0.6rem] font-bold"
                        style={{
                          borderColor: withAlpha(phase.accent, complete || current ? 0.4 : 0.12),
                          color: complete || current ? phase.accent : "rgba(255,255,255,0.2)",
                        }}
                      >
                        {complete ? <CheckCircle2 className="h-3 w-3" /> : locked ? <LockKeyhole className="h-3 w-3" /> : phase.phase}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-[0.72rem] font-semibold ${complete || current ? "text-white/80" : "text-white/35"}`}>
                          {phase.name}
                        </p>
                        <p className="truncate text-[0.6rem] text-white/25">{phase.days} · {phase.goal}</p>
                      </div>
                      {current && (
                        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-wider text-white/60">
                          now
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="surface p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/reset/settings" className="btn btn-ghost min-h-[38px] flex-1 justify-center text-[0.7rem]">
                <Settings2 className="h-3.5 w-3.5" /> Plan settings
              </Link>
              <Link href="/reset/notebook" className="btn btn-ghost min-h-[38px] flex-1 justify-center text-[0.7rem]">
                <BookOpen className="h-3.5 w-3.5" /> Notebook
              </Link>
            </div>
            <p className="mt-2 text-center text-[0.6rem] leading-relaxed text-white/25">
              The agent proposes. You decide. Every calendar change can be undone.
            </p>
          </section>
        </div>
      </div>

      {stats.drift.length > 0 && (
        <DriftCard planId={plan.id} suggestions={stats.drift} autonomy={plan.autonomy} />
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
        <Sparkles className="h-4 w-4 text-violet-300/70" />
        <p className="text-[0.7rem] leading-relaxed text-white/40">
          {stats.best
            ? `Steadiest recently: “${stats.best.title}”.`
            : "Once you check in, the agent starts comparing planned with done."}
          {stats.mostMissed && stats.mostMissed.missed > 0
            ? ` Most room needed: “${stats.mostMissed.title}”.`
            : ""}
        </p>
        <Link href="/reset/reports" className="ml-auto text-[0.68rem] font-semibold text-violet-300/70 hover:text-violet-200">
          Reports →
        </Link>
      </div>
    </div>
  );
}
