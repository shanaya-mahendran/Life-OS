import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  FileText,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { resetPlanEnabled } from "@/lib/reset/flags";
import { getCurrentPlan, getLatestPlan } from "@/lib/reset/service";
import { ensurePlanReports, notebookForPeriod, reportForDay } from "@/lib/reset/reports";
import { dueReviewPeriods, planDayDate, planDayNumber, reviewPeriod } from "@/lib/reset/calc";
import { formatInZone } from "@/lib/time";
import { withAlpha } from "@/lib/utils";
import { PageBanner } from "@/components/shell/PageBanner";
import { ResetTabs } from "@/components/reset/ResetTabs";
import { EmptyState, ProgressBar, StatCard } from "@/components/reset/ui";

export const metadata = { title: "Reset reports · LifeOS" };
export const dynamic = "force-dynamic";

export default async function ResetReportsPage() {
  if (!resetPlanEnabled()) notFound();

  const { profile, user } = await requireProfile();
  const current = await getCurrentPlan(profile.id);
  const plan = current ?? (await getLatestPlan(profile.id));
  if (!plan) redirect("/reset");
  if (current?.status === "draft") redirect("/reset/builder");

  const now = new Date();
  if (plan.startedAt) {
    await ensurePlanReports(plan, now, user.timezone);
  }
  const fresh = (await getCurrentPlan(profile.id)) ?? (await getLatestPlan(profile.id)) ?? plan;
  const day = fresh.startedAt ? planDayNumber(fresh.startedAt, now, user.timezone) : 0;
  const due = dueReviewPeriods(day);
  const next = [15, 30, 45, 60, 75, 90].find((entry) => entry > day);
  const ready = fresh.reports.filter((report) => report.status === "ready").length;
  const drafts = fresh.reports.filter((report) => report.status === "draft").length;
  const isComplete = fresh.status === "completed";

  return (
    <div className="space-y-4">
      <PageBanner
        icon={<BarChart3 className="h-5 w-5" />}
        title="Reset reports"
        subtitle="A review every 15 days, a monthly report on days 30, 60 and 90. Every number traces back to a check-in."
        accent="#38bdf8"
        aside={
          <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">
            <p className="font-display text-[0.95rem] font-semibold text-white">{ready} ready</p>
            <p className="text-[0.58rem] uppercase tracking-[0.16em] text-white/30">of six checkpoints</p>
          </div>
        }
      />

      <ResetTabs />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard
          label="Day"
          value={`${day} / 90`}
          caption={isComplete ? "program closed" : "still running"}
          icon={<CalendarClock className="h-3.5 w-3.5" />}
          accent="#8b5cf6"
        />
        <StatCard
          label="Reports ready"
          value={ready}
          caption={`${drafts} draft${drafts === 1 ? "" : "s"} waiting on a notebook`}
          icon={<FileText className="h-3.5 w-3.5" />}
          accent="#38bdf8"
        />
        <StatCard
          label="Next review"
          value={next ? `Day ${next}` : "Day 90"}
          caption={
            next && fresh.startedAt
              ? formatInZone(planDayDate(fresh.startedAt, next, user.timezone), user.timezone, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })
              : "The closing report"
          }
          icon={<CalendarClock className="h-3.5 w-3.5" />}
          accent="#d946ef"
        />
        <StatCard
          label="Progress"
          value={`${Math.min(100, Math.round((day / 90) * 100))}%`}
          caption="Six report checkpoints across the 90 days"
          icon={<Sparkles className="h-3.5 w-3.5" />}
          accent="#34d399"
        />
      </div>

      {!day ? (
        <section className="surface p-4">
          <EmptyState
            icon={<LockKeyhole className="h-5 w-5" />}
            title="The reports start on day 15"
            body="Approve the plan first. The first review opens after two weeks of check-ins, not before."
            action={
              <Link href="/reset/builder" className="btn btn-primary text-[0.76rem]">
                Open the plan builder
              </Link>
            }
          />
        </section>
      ) : (
        <section className="surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-[0.98rem] font-semibold text-white">The six checkpoints</h2>
              <p className="mt-0.5 text-[0.67rem] text-white/35">
                Monthly reports replace the 15-day review on days 30, 60 and 90.
              </p>
            </div>
            <span className="chip border-white/10 bg-white/[0.03] text-white/40">
              {fresh.checkins.length} check-ins
            </span>
          </div>

          <div className="mt-3.5 space-y-2">
            {dueReviewPeriods(90).map((period) => {
              const report = reportForDay(fresh, period.day);
              const notebook = notebookForPeriod(fresh, period, user.timezone);
              const isDue = period.day <= day;
              const isMonthly = period.kind === "month" || period.kind === "final";
              const reportReady = report?.status === "ready";
              const accepted = Boolean(notebook && (notebook.skipped || notebook.q1));
              const accent = isMonthly ? "#38bdf8" : "#a78bfa";
              const date = fresh.startedAt
                ? planDayDate(fresh.startedAt, period.day, user.timezone)
                : null;
              const locked = !isDue;

              return (
                <div
                  key={period.day}
                  className="relative overflow-hidden rounded-2xl border p-3"
                  style={{
                    borderColor: reportReady
                      ? withAlpha(accent, 0.28)
                      : locked
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(255,255,255,0.09)",
                    background: reportReady
                      ? `linear-gradient(120deg, ${withAlpha(accent, 0.1)}, rgba(15,10,28,0.7))`
                      : "rgba(255,255,255,0.018)",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border font-display text-[0.85rem] font-bold"
                      style={{
                        borderColor: locked ? "rgba(255,255,255,0.08)" : withAlpha(accent, 0.3),
                        backgroundColor: locked ? "rgba(255,255,255,0.02)" : withAlpha(accent, 0.1),
                        color: locked ? "rgba(255,255,255,0.2)" : accent,
                      }}
                    >
                      {reportReady ? <CheckCircle2 className="h-4 w-4" /> : locked ? <LockKeyhole className="h-3.5 w-3.5" /> : period.day}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className={`text-[0.82rem] font-semibold ${locked ? "text-white/30" : "text-white/85"}`}>
                          {period.label}
                        </p>
                        <span
                          className="rounded-full border px-1.5 py-0.5 text-[0.52rem] font-bold uppercase tracking-[0.1em]"
                          style={{
                            borderColor: withAlpha(accent, locked ? 0.08 : 0.22),
                            color: locked ? "rgba(255,255,255,0.2)" : withAlpha(accent, 0.85),
                          }}
                        >
                          {isMonthly ? "monthly" : "review"}
                        </span>
                        {report?.editedByUser && (
                          <span className="text-[0.55rem] text-white/25">edited by you</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[0.65rem] text-white/30">
                        {date
                          ? formatInZone(date, user.timezone, { weekday: "long", month: "short", day: "numeric" })
                          : "Scheduled"}
                        {reportReady
                          ? ` · ${(report.metrics as Record<string, unknown>).adherence ?? 0}% check-in rate`
                          : accepted
                            ? " · notebook saved, report draft"
                            : isDue
                              ? " · notebook still open"
                              : ` · opens on day ${period.day}`}
                      </p>

                      {report && (
                        <p className="mt-1.5 line-clamp-2 text-[0.68rem] leading-relaxed text-white/35">{report.summary}</p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {report ? (
                          <Link
                            href={`/reset/reports/${report.id}`}
                            className="btn btn-ghost min-h-[34px] px-2.5 text-[0.68rem]"
                          >
                            <FileText className="h-3 w-3" /> {reportReady ? "Open report" : "Open draft"}
                          </Link>
                        ) : isDue ? (
                          <Link
                            href={`/reset/notebook?day=${period.day}`}
                            className="btn btn-primary min-h-[34px] px-2.5 text-[0.68rem]"
                          >
                            <BookOpen className="h-3 w-3" /> Answer the notebook
                          </Link>
                        ) : (
                          <span className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[0.65rem] text-white/25">
                            Locked until day {period.day}
                          </span>
                        )}
                        {isDue && !report && (
                          <span className="text-[0.6rem] text-white/25">or skip it on purpose</span>
                        )}
                        {reportReady && (
                          <Link
                            href={`/reset/reports/${report.id}`}
                            className="ml-auto inline-flex items-center gap-1 text-[0.64rem] font-semibold text-sky-300/70 hover:text-sky-200"
                          >
                            Read <ArrowRight className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-[0.58rem] text-white/25">
              <span>Day 1</span>
              <span>{day} of 90</span>
              <span>Day 90</span>
            </div>
            <ProgressBar value={(day / 90) * 100} accent="#38bdf8" className="mt-1.5" />
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
        <FileText className="h-3.5 w-3.5 text-white/30" />
        <p className="text-[0.66rem] leading-relaxed text-white/35">
          Reports are only built from Reset check-ins, notebook answers and goal entries. The rest of your calendar is
          not read.
        </p>
        <Link href="/reset/plan" className="ml-auto text-[0.66rem] font-semibold text-violet-300/70 hover:text-violet-200">
          Plan home →
        </Link>
      </div>
    </div>
  );
}
