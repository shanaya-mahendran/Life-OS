import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
} from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { resetPlanEnabled } from "@/lib/reset/flags";
import { getCurrentPlan, getLatestPlan } from "@/lib/reset/service";
import { RESET_PHASES, RESET_ACCENT } from "@/lib/reset/constants";
import { withAlpha } from "@/lib/utils";
import { PageBanner } from "@/components/shell/PageBanner";
import { PlanActionButton } from "@/components/reset/PlanActionButton";

export const metadata = { title: "Reset Plan · LifeOS" };
export const dynamic = "force-dynamic";

export default async function ResetIntroPage() {
  if (!resetPlanEnabled()) notFound();

  const { profile } = await requireProfile();
  const current = await getCurrentPlan(profile.id);

  if (current) {
    if (current.status === "active" || current.status === "paused") redirect("/reset/plan");
    if (![1, 2, 3].every((step) => current.answers.find((answer) => answer.step === step)?.answer)) {
      redirect("/reset/audit");
    }
    if (!current.gapApprovedAt) redirect("/reset/gap");
    redirect("/reset/builder");
  }

  const latest = await getLatestPlan(profile.id);
  const completed = latest?.status === "completed" ? latest : null;

  return (
    <div className="space-y-4">
      <PageBanner
        icon={<RotateCcw className="h-5 w-5" />}
        title="Reset Plan"
        subtitle="A 90-day program the agent runs with you. One minute a day, your call on every change."
        accent={RESET_ACCENT}
        aside={
          <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">
            <p className="font-display text-[0.95rem] font-semibold text-white">90 days</p>
            <p className="text-[0.58rem] uppercase tracking-[0.16em] text-white/30">one honest program</p>
          </div>
        }
      />

      <section className="relative overflow-hidden rounded-3xl border border-violet-400/25 bg-[linear-gradient(135deg,rgba(44,22,85,0.8),rgba(18,12,38,0.96)_52%,rgba(10,7,22,0.98))] p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/4 h-64 w-64 rounded-full bg-fuchsia-500/15 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center">
          <div>
            <span className="chip border-violet-400/30 bg-violet-500/15 text-violet-200">
              <Sparkles className="h-3 w-3" /> Built to be finished
            </span>
            <h2 className="mt-3 font-display text-[1.65rem] font-bold leading-[1.1] tracking-tight text-white sm:text-[2.1rem]">
              Three months. Three phases.
              <span className="block bg-gradient-to-r from-violet-300 via-fuchsia-300 to-violet-200 bg-clip-text text-transparent">
                One plan that checks back in.
              </span>
            </h2>
            <p className="mt-3 max-w-xl text-[0.82rem] leading-relaxed text-white/50">
              Most 90-day plans die because nobody follows up. This one is run by the agent: it prompts, records,
              measures and proposes. You approve every change, and the plan stays yours.
            </p>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <PlanActionButton
                action={completed ? "new-cycle" : "start"}
                label={completed ? "Start a new cycle" : "Start the 90-day reset"}
                busyLabel="Opening your plan…"
                redirectTo="/reset/audit"
                className="sm:max-w-[16rem]"
              />
              {completed && (
                <Link href="/reset/finish" className="btn btn-ghost justify-center text-[0.78rem]">
                  See the final result <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>

            <p className="mt-2 text-[0.63rem] leading-relaxed text-white/30">
              Not medical, therapy or financial advice. Skip, pause or delete the program at any time.
            </p>
          </div>

          <div className="relative rounded-2xl border border-white/10 bg-white/[0.035] p-3.5 backdrop-blur-sm">
            <div className="flex items-center justify-between px-1">
              <span className="label">The 90 days</span>
              <span className="text-[0.6rem] text-white/30">Day 1 is approval day</span>
            </div>
            <div className="mt-2.5 space-y-2">
              {RESET_PHASES.map((phase, index) => (
                <div
                  key={phase.phase}
                  className="relative flex items-center gap-3 rounded-xl border p-2.5"
                  style={{
                    borderColor: withAlpha(phase.accent, 0.24),
                    background: `linear-gradient(120deg, ${withAlpha(phase.accent, 0.12)}, rgba(14,10,27,0.6))`,
                  }}
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border font-display text-[0.8rem] font-bold text-white"
                    style={{ borderColor: withAlpha(phase.accent, 0.4), backgroundColor: withAlpha(phase.accent, 0.22) }}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.78rem] font-semibold text-white/90">{phase.name}</p>
                    <p className="truncate text-[0.63rem] text-white/35">{phase.days} · {phase.dailyRule}</p>
                  </div>
                  {phase.phase === 1 ? (
                    <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[0.52rem] font-bold uppercase tracking-wider text-white/60">
                      first
                    </span>
                  ) : (
                    <LockKeyhole className="h-3 w-3 text-white/25" />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/20 p-2.5">
              <p className="text-[0.62rem] leading-relaxed text-white/35">
                Phase 2 and 3 stay hidden until the phase before ends — or until you choose to start early.
              </p>
            </div>
          </div>
        </div>
      </section>

      <details className="surface group rounded-xl p-4 sm:p-5">
        <summary className="cursor-pointer list-none text-sm font-semibold text-white marker:hidden">
          <span className="flex items-center justify-between gap-3">
            How it works
            <span className="text-xs font-medium text-white/55 transition group-open:rotate-180">⌄</span>
          </span>
        </summary>
        <div className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: ClipboardCheck,
            title: "1 · Audit & gap report",
            body: "Three guided questions, one per screen. The agent quotes you back and drafts a one-screen gap report. You edit it before anything is built.",
            accent: "#a78bfa",
          },
          {
            icon: Timer,
            title: "2 · Run the months",
            body: "One-minute evening check-ins. Drift is flagged, never acted on silently. Every calendar block is approved first and can be undone in one step.",
            accent: "#38bdf8",
          },
          {
            icon: BarChart3,
            title: "3 · Review & report",
            body: "A review every 15 days and a monthly report on days 30, 60 and 90. Every number traces back to your check-ins, habits and notebook.",
            accent: "#34d399",
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <section key={card.title} className="surface p-4">
              <span
                className="grid h-9 w-9 place-items-center rounded-xl border text-white"
                style={{
                  borderColor: withAlpha(card.accent, 0.3),
                  backgroundColor: withAlpha(card.accent, 0.16),
                  color: card.accent,
                }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <h3 className="mt-2.5 font-display text-[0.9rem] font-semibold text-white">{card.title}</h3>
              <p className="mt-1 text-[0.72rem] leading-relaxed text-white/40">{card.body}</p>
            </section>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <section className="surface p-4">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-violet-300" />
            <h2 className="font-display text-[0.96rem] font-semibold text-white">What the agent runs</h2>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              ["Every evening", "Check-in reminder, done / skipped / missed, and a move-or-drop choice on misses."],
              ["Every Sunday", "One Reset card in the weekly review: adherence and missed blocks to reschedule."],
              ["Every 15 days", "Review report and notification. Monthly reports replace it on days 30, 60 and 90."],
              ["On drift", "Three misses in a row or under 50% over seven days becomes a suggestion, not a change."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-violet-200/75">{title}</p>
                <p className="mt-1 text-[0.72rem] leading-relaxed text-white/40">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="surface p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            <h2 className="font-display text-[0.96rem] font-semibold text-white">Your controls</h2>
          </div>
          <ul className="mt-3 space-y-2 text-[0.72rem] leading-relaxed text-white/45">
            {[
              "Suggest-only by default. Auto-adjust is limited to your own Reset blocks.",
              "Notifications use generic text only — never a commitment or an answer.",
              "Every report can be edited, exported or deleted.",
              "Answers, reports and goals stay scoped to your account.",
              "Pause, skip or delete the plan at any time.",
            ].map((line) => (
              <li key={line} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300/70" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] p-2.5">
            <p className="text-[0.65rem] leading-relaxed text-amber-100/65">
              If an answer points at serious distress, the program pauses and points you toward a trusted person or a
              local support line. This app is not a substitute for care.
            </p>
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
        <Target className="h-4 w-4 text-violet-300" />
        <p className="text-[0.72rem] text-white/45">
          Ready when you are. The audit takes about five minutes and you can close the tab and continue later.
        </p>
        <Link href="/reset/audit" className="btn btn-ghost ml-auto text-[0.72rem]">
          <BookOpen className="h-3.5 w-3.5" /> See the audit
        </Link>
      </div>
        </div>
      </details>
    </div>
  );
}
