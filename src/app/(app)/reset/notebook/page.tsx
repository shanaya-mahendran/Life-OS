import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookOpen, CalendarClock, ChevronRight, LockKeyhole } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { resetPlanEnabled } from "@/lib/reset/flags";
import { getCurrentPlan } from "@/lib/reset/service";
import {
  dueNotebookPeriod,
  notebookForPeriod,
  reportForDay,
} from "@/lib/reset/reports";
import { dueReviewPeriods, planDayNumber, planDayDate } from "@/lib/reset/calc";
import { formatInZone } from "@/lib/time";
import { PageBanner } from "@/components/shell/PageBanner";
import { ResetTabs } from "@/components/reset/ResetTabs";
import { NotebookForm } from "@/components/reset/NotebookForm";
import { EmptyState } from "@/components/reset/ui";

export const metadata = { title: "Reset notebook · LifeOS" };
export const dynamic = "force-dynamic";

export default async function ResetNotebookPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  if (!resetPlanEnabled()) notFound();

  const { profile, user } = await requireProfile();
  const plan = await getCurrentPlan(profile.id);
  if (!plan) redirect("/reset");
  if (plan.status === "completed") redirect("/reset/finish");
  if (plan.status === "draft") redirect("/reset/builder");

  const now = new Date();
  const day = plan.startedAt ? planDayNumber(plan.startedAt, now, user.timezone) : 0;
  const due = dueReviewPeriods(day).reverse();
  const query = await searchParams;
  const requested = Number(query.day);
  const period =
    due.find((entry) => entry.day === requested) ??
    dueNotebookPeriod(plan, now, user.timezone) ??
    due[0] ??
    null;

  const next = [15, 30, 45, 60, 75, 90].find((entry) => entry > day);
  const nextDate = next && plan.startedAt ? planDayDate(plan.startedAt, next, user.timezone) : null;

  return (
    <div className="space-y-4">
      <PageBanner
        icon={<BookOpen className="h-5 w-5" />}
        title="Reset notebook"
        subtitle={
          period
            ? `${period.label} · in your own words, before the report is written.`
            : "The first notebook opens on day 15. Nothing to answer yet."
        }
        accent="#d946ef"
        aside={
          <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">
            <p className="font-display text-[0.95rem] font-semibold text-white">Day {day}</p>
            <p className="text-[0.58rem] uppercase tracking-[0.16em] text-white/30">of 90</p>
          </div>
        }
      />

      <ResetTabs />

      {period ? (
        (() => {
          const notebook = notebookForPeriod(plan, period, user.timezone);
          const report = reportForDay(plan, period.day);
          return (
            <NotebookForm
              planId={plan.id}
              reviewDay={period.day}
              periodLabel={period.label}
              initial={{
                q1: notebook?.q1 ?? "",
                q2: notebook?.q2 ?? "",
                q3: notebook?.q3 ?? "",
              }}
              skipped={Boolean(notebook?.skipped)}
              reportId={report?.id ?? null}
              summary={report?.summary ?? ""}
            />
          );
        })()
      ) : (
        <section className="surface p-4">
          <EmptyState
            icon={<CalendarClock className="h-5 w-5" />}
            title="No review is due yet"
            body={
              nextDate
                ? `The next notebook opens on ${formatInZone(nextDate, user.timezone, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })} (day ${next}). Keep checking in — the report needs those entries.`
                : "The program has not reached its first review day."
            }
            action={
              <Link href="/reset/plan" className="btn btn-primary text-[0.76rem]">
                Back to the plan
              </Link>
            }
          />
        </section>
      )}

      <section className="surface p-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-fuchsia-300" />
          <h2 className="font-display text-[0.92rem] font-semibold text-white">Review schedule</h2>
          <span className="ml-auto text-[0.62rem] text-white/30">One notification per review</span>
        </div>
        <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
          {dueReviewPeriods(90).map((entry) => {
            const opened = due.some((dueEntry) => dueEntry.day === entry.day);
            const done = plan.notebooks.some((notebook) => notebook.reviewDay === entry.day && (notebook.skipped || notebook.q1));
            const isNext = next === entry.day;
            return (
              <div
                key={entry.day}
                className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[0.55rem] font-bold ${
                    done
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                      : opened
                        ? "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200"
                        : "border-white/10 text-white/25"
                  }`}
                >
                  {done ? "✓" : opened ? entry.day : <LockKeyhole className="h-2.5 w-2.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[0.7rem] font-medium ${opened ? "text-white/70" : "text-white/30"}`}>
                    {entry.label}
                  </p>
                  <p className="text-[0.6rem] text-white/25">
                    {entry.kind === "month" || entry.kind === "final" ? "Monthly report" : "15-day review"}
                  </p>
                </div>
                {opened && (
                  <Link
                    href={`/reset/notebook?day=${entry.day}`}
                    className="shrink-0 text-[0.62rem] font-semibold text-fuchsia-300/70 hover:text-fuchsia-200"
                  >
                    Open <ChevronRight className="inline h-2.5 w-2.5" />
                  </Link>
                )}
                {isNext && !opened && (
                  <span className="shrink-0 text-[0.58rem] text-white/25">next</span>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[0.62rem] leading-relaxed text-white/25">
          Monthly reports fold in the 15-day review for days 30, 60 and 90. You get one screen, not two.
        </p>
      </section>
    </div>
  );
}
