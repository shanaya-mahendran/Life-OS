import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Flame,
  Heart,
  Quote,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { resetPlanEnabled } from "@/lib/reset/flags";
import { getPlanForUser } from "@/lib/reset/service";
import { getReportForUser, notebookForPeriod, reportMetrics } from "@/lib/reset/reports";
import { reviewPeriod } from "@/lib/reset/calc";
import { NOTEBOOK_QUESTIONS } from "@/lib/reset/constants";
import { formatInZone } from "@/lib/time";
import { withAlpha } from "@/lib/utils";
import { PageBanner } from "@/components/shell/PageBanner";
import { ProgressRing } from "@/components/today/ProgressRing";
import { ReportActions } from "@/components/reset/ReportActions";
import { ProgressBar, StatCard, kindTone } from "@/components/reset/ui";

export const metadata = { title: "Reset report · LifeOS" };
export const dynamic = "force-dynamic";

export default async function ResetReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!resetPlanEnabled()) notFound();

  const { profile, user } = await requireProfile();
  const { id } = await params;
  const report = await getReportForUser(profile.id, id);
  if (!report) notFound();

  const plan = await getPlanForUser(profile.id, report.planId);
  if (!plan) notFound();

  const period = reviewPeriod(report.reviewDay);
  const metrics = reportMetrics(report);
  const notebook = notebookForPeriod(plan, period, user.timezone);
  const gap = (plan.gapReport as Record<string, unknown> | null) ?? {};
  const isFinal = report.kind === "final";
  const isMonthly = report.kind === "month" || isFinal;
  const accent = isFinal ? "#34d399" : isMonthly ? "#38bdf8" : "#a78bfa";
  const periodLabel =
    report.kind === "final"
      ? "Day 76–90"
      : report.kind === "month"
        ? `Days ${period.periodStartDay}–${period.periodEndDay}`
        : `Days ${period.periodStartDay}–${period.periodEndDay}`;
  const endDisplay = new Date(new Date(report.periodEnd).getTime() - 1);

  return (
    <div className="space-y-4">
      <PageBanner
        icon={<BarChart3 className="h-5 w-5" />}
        title={period.label}
        subtitle={`${periodLabel} · ${formatInZone(new Date(report.periodStart), user.timezone, {
          month: "short",
          day: "numeric",
        })} – ${formatInZone(endDisplay, user.timezone, { month: "short", day: "numeric" })} · ${
          report.status === "ready" ? "complete" : "draft"
        }`}
        accent={accent}
        aside={
          <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">
            <p className="font-display text-[0.95rem] font-semibold text-white">{metrics.adherence}%</p>
            <p className="text-[0.58rem] uppercase tracking-[0.16em] text-white/30">check-in rate</p>
          </div>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <section className="surface relative overflow-hidden p-4">
          <div
            className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full blur-3xl"
            style={{ backgroundColor: withAlpha(accent, 0.18) }}
          />
          <div className="relative flex items-center gap-4">
            <ProgressRing value={metrics.adherence} size={118} stroke={9} accent={accent} label="check-in rate" />
            <div>
              <span
                className="inline-flex rounded-full border px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.12em]"
                style={{
                  borderColor: withAlpha(accent, 0.32),
                  backgroundColor: withAlpha(accent, 0.12),
                  color: accent,
                }}
              >
                {isFinal ? "Final" : isMonthly ? "Monthly" : "15-day review"}
              </span>
              <p className="mt-1.5 font-display text-[1.05rem] font-semibold text-white">{period.shortLabel}</p>
              <p className="mt-0.5 text-[0.68rem] text-white/35">
                {metrics.daysCheckedIn} day{metrics.daysCheckedIn === 1 ? "" : "s"} with a check-in
              </p>
              {metrics.previousAdherence !== null && (
                <span
                  className="mt-1.5 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[0.58rem] font-semibold"
                  style={{
                    borderColor: (metrics.delta ?? 0) >= 0 ? "rgba(52,211,153,0.25)" : "rgba(251,113,133,0.25)",
                    color: (metrics.delta ?? 0) >= 0 ? "#6ee7b7" : "#fda4af",
                    backgroundColor: (metrics.delta ?? 0) >= 0 ? "rgba(52,211,153,0.08)" : "rgba(251,113,133,0.08)",
                  }}
                >
                  {(metrics.delta ?? 0) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {metrics.delta === null ? "first report" : `${metrics.delta > 0 ? "+" : ""}${metrics.delta} vs previous`}
                </span>
              )}
            </div>
          </div>
          <div className="relative mt-3">
            <div className="flex items-center justify-between text-[0.6rem] text-white/30">
              <span>{metrics.phaseLabel}</span>
              <span>{metrics.streak} day streak</span>
            </div>
            <ProgressBar value={metrics.adherence} accent={accent} className="mt-1.5" />
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2">
          <StatCard label="Done" value={metrics.done} caption="Check-ins marked done" accent="#34d399" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
          <StatCard label="Missed" value={metrics.missed} caption="Shown as a count, never a failure" accent="#fb7185" icon={<TrendingDown className="h-3.5 w-3.5" />} />
          <StatCard label="Skipped" value={metrics.skipped} caption="On purpose, not counted as missed" accent="#fbbf24" icon={<Heart className="h-3.5 w-3.5" />} />
          <StatCard label="Best streak" value={`${metrics.streak}d`} caption={`${metrics.total} total check-ins`} accent="#a78bfa" icon={<Flame className="h-3.5 w-3.5" />} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <section className="surface p-4">
          <p className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-emerald-300/60">Kept best</p>
          <p className="mt-1.5 text-[0.84rem] font-semibold leading-snug text-white/85">
            {metrics.best?.title ?? "No check-ins in this period yet."}
          </p>
          {metrics.best && (
            <p className="mt-1 text-[0.65rem] text-white/35">
              {metrics.best.adherence}% · {metrics.best.done} of {metrics.best.total} check-ins
            </p>
          )}
        </section>
        <section className="surface p-4">
          <p className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-rose-300/55">Most room needed</p>
          <p className="mt-1.5 text-[0.84rem] font-semibold leading-snug text-white/85">
            {metrics.mostMissed?.title ?? "Nothing to flag yet."}
          </p>
          {metrics.mostMissed && (
            <p className="mt-1 text-[0.65rem] text-white/35">
              {metrics.mostMissed.missed} miss{metrics.mostMissed.missed === 1 ? "" : "es"} · {metrics.mostMissed.adherence}% kept
            </p>
          )}
        </section>
        <section className="surface p-4">
          <p className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-sky-300/60">Wake-up consistency</p>
          <p className="mt-1.5 text-[0.84rem] font-semibold leading-snug text-white/85">
            {metrics.wake?.title ?? "No wake-up anchor in this phase."}
          </p>
          {metrics.wake && (
            <>
              <p className="mt-1 text-[0.65rem] text-white/35">
                {metrics.wake.percent}% · {metrics.wake.done} of {metrics.wake.total} days
              </p>
              <ProgressBar value={metrics.wake.percent} accent="#38bdf8" className="mt-2" height="h-1" />
            </>
          )}
        </section>
      </div>

      {metrics.cuts.length > 0 && (
        <section className="surface p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-pink-300" />
            <h2 className="font-display text-[0.95rem] font-semibold text-white">How the cuts held up</h2>
          </div>
          <div className="mt-2.5 space-y-2">
            {metrics.cuts.map((cut) => (
              <div key={cut.title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: kindTone("cut") }} />
                  <p className="min-w-0 flex-1 truncate text-[0.74rem] font-medium text-white/70">{cut.title}</p>
                  <span className="text-[0.62rem] text-white/30">{cut.percent}% held</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <ProgressBar value={cut.percent} accent={kindTone("cut")} className="flex-1" height="h-1" />
                  <span className="shrink-0 text-[0.58rem] text-white/25">{cut.done} days held · {cut.missed} slipped</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="surface p-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-fuchsia-300" />
            <h2 className="font-display text-[0.95rem] font-semibold text-white">Your notebook</h2>
            {notebook?.skipped && <span className="chip border-amber-400/20 bg-amber-400/[0.06] text-amber-100/60">skipped on purpose</span>}
          </div>
          {notebook && !notebook.skipped ? (
            <div className="mt-2.5 space-y-2">
              {NOTEBOOK_QUESTIONS.map((question, index) => {
                const answer = [notebook.q1, notebook.q2, notebook.q3][index];
                return (
                  <div key={question} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <p className="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-white/25">{question}</p>
                    <p className="mt-1 text-[0.74rem] leading-relaxed text-white/55">{answer || "Not answered."}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-[0.72rem] leading-relaxed text-white/35">
              {notebook?.skipped
                ? "You chose to skip this notebook. The report contains numbers only."
                : "No notebook was filled for this period."}
            </p>
          )}
        </section>

        <div className="space-y-3">
          <section className="surface p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-sky-300" />
              <h2 className="font-display text-[0.95rem] font-semibold text-white">Time-of-day pattern</h2>
            </div>
            <div className="mt-3 space-y-2.5">
              {metrics.timeOfDay.map((row) => {
                const total = row.done + row.missed;
                return (
                  <div key={row.bucket}>
                    <div className="flex items-center justify-between text-[0.62rem]">
                      <span className="text-white/45">{row.bucket}</span>
                      <span className="text-white/25">{row.done} done · {row.missed} missed</span>
                    </div>
                    <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full bg-emerald-400/70" style={{ width: total ? `${(row.done / total) * 100}%` : "0%" }} />
                      <div className="h-full bg-rose-400/60" style={{ width: total ? `${(row.missed / total) * 100}%` : "0%" }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[0.6rem] leading-relaxed text-white/25">A missed block is a schedule signal, not a character score.</p>
          </section>

          {metrics.goals.length > 0 && (
            <section className="surface p-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-300" />
                <h2 className="font-display text-[0.95rem] font-semibold text-white">Goal progress</h2>
              </div>
              <div className="mt-2.5 space-y-2">
                {metrics.goals.map((goal) => (
                  <div key={goal.id}>
                    <div className="flex items-center justify-between gap-2 text-[0.68rem]">
                      <span className="min-w-0 truncate text-white/65">{goal.title}</span>
                      <span className="shrink-0 text-white/30">{goal.current}/{goal.target} {goal.unit}</span>
                    </div>
                    <ProgressBar value={goal.percent} accent="#34d399" className="mt-1" height="h-1" />
                    <p className="mt-0.5 text-[0.58rem] text-white/25">{goal.area} · {goal.entries} progress entr{goal.entries === 1 ? "y" : "ies"}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {isFinal && (
        <section className="surface relative overflow-hidden p-4">
          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-500/12 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <Quote className="h-4 w-4 text-emerald-300" />
              <h2 className="font-display text-[0.98rem] font-semibold text-white">Day 0 next to day 90</h2>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
                <p className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-white/25">Where you started</p>
                <p className="mt-1.5 text-[0.76rem] leading-relaxed text-white/45">
                  {typeof gap.currentQuote === "string" && gap.currentQuote ? `“${gap.currentQuote}”` : "No audit quote saved."}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.05] p-3">
                <p className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-emerald-300/55">What stayed</p>
                <p className="mt-1.5 text-[0.76rem] leading-relaxed text-white/55">
                  {metrics.best ? `“${metrics.best.title}” held at ${metrics.best.adherence}%. ` : ""}
                  {metrics.total > 0
                    ? `${metrics.done} check-ins marked done across the final 15 days.`
                    : "No check-ins in this final period."}
                </p>
              </div>
            </div>
            <Link href="/reset/finish" className="btn btn-primary mt-3 text-[0.76rem]">
              See the closing options <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      )}

      <section className="surface p-4">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-violet-300" />
          <h2 className="font-display text-[0.95rem] font-semibold text-white">By commitment</h2>
          <span className="ml-auto text-[0.6rem] text-white/25">Every number is traceable</span>
        </div>
        <div className="mt-3 space-y-2">
          {metrics.perCommitment.map((entry) => (
            <div key={entry.title} className="rounded-xl border border-white/[0.055] bg-white/[0.02] p-2.5">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: kindTone(entry.kind) }} />
                <p className="min-w-0 flex-1 truncate text-[0.72rem] text-white/65">{entry.title}</p>
                <span className="shrink-0 text-[0.6rem] text-white/30">{entry.adherence}%</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <ProgressBar value={entry.adherence} accent={kindTone(entry.kind)} className="flex-1" height="h-1" />
                <span className="shrink-0 text-[0.56rem] text-white/20">
                  {entry.done} done · {entry.missed} missed · {entry.skipped} skipped
                </span>
              </div>
            </div>
          ))}
          {!metrics.perCommitment.length && <p className="text-[0.7rem] text-white/30">No commitments in this period.</p>}
        </div>
      </section>

      <ReportActions reportId={report.id} initialSummary={report.summary} editedByUser={report.editedByUser} />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
        <ArrowLeft className="h-3.5 w-3.5 text-white/30" />
        <Link href="/reset/reports" className="text-[0.68rem] font-semibold text-violet-300/70 hover:text-violet-200">
          All reports
        </Link>
        <span className="ml-auto text-[0.6rem] leading-relaxed text-white/25">
          No diagnosis, no character scores, no medical or financial advice.
        </span>
      </div>
    </div>
  );
}
