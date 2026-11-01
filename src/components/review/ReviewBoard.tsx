"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2, Lightbulb, TriangleAlert } from "lucide-react";
import { withAlpha } from "@/lib/utils";
import { ProgressRing } from "@/components/today/ProgressRing";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";

interface ReviewDomainRow {
  slug: string;
  name: string;
  accent: string;
  plannedMinutes: number;
  done: number;
  total: number;
  adherence: number;
}

interface Proposal {
  taskId: string | null;
  domainSlug: string;
  title: string;
  startISO: string;
  endISO: string;
  minutes: number;
}

interface ReviewBoardProps {
  timeZone: string;
  rangeLabel: string;
  headline: string;
  adherence: number;
  done: number;
  slipped: number;
  plannedCount: number;
  focusMinutes: number;
  previousFocusMinutes: number;
  perDomain: ReviewDomainRow[];
  slippedTasks: { id: string; title: string; domainName: string; accent: string; dueLabel: string }[];
  deadlineTasks: { id: string; title: string; domainName: string; accent: string; dueLabel: string }[];
  insights: string[];
  proposals: Proposal[];
}

let toastId = 0;

function hours(minutes: number): string {
  const value = Math.round((minutes / 60) * 10) / 10;
  return `${value}h`;
}

export function ReviewBoard(props: ReviewBoardProps) {
  const router = useRouter();
  const [proposals, setProposals] = useState(props.proposals);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(props.proposals.map((proposal) => `${proposal.title}-${proposal.startISO}`)),
  );
  const [accepting, setAccepting] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [, startTransition] = useTransition();

  const key = (proposal: Proposal) => `${proposal.title}-${proposal.startISO}`;

  function toast(text: string, tone: "success" | "error" = "success") {
    toastId += 1;
    setToasts((current) => [...current, { id: toastId, text, tone }]);
  }

  async function accept() {
    const chosen = proposals.filter((proposal) => selected.has(key(proposal)));
    if (!chosen.length) return;
    setAccepting(true);
    try {
      const response = await fetch("/api/review/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: chosen.map((proposal) => ({
            domainSlug: proposal.domainSlug,
            title: proposal.title,
            startISO: proposal.startISO,
            endISO: proposal.endISO,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast(data.error ?? "Could not add the blocks.", "error");
        return;
      }
      toast(`${data.created?.length ?? 0} suggested blocks added to next week.`);
      setProposals((current) => current.filter((proposal) => !selected.has(key(proposal))));
      startTransition(() => router.refresh());
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setAccepting(false);
    }
  }

  const focusDelta = props.focusMinutes - props.previousFocusMinutes;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="surface col-span-1 flex items-center gap-3 p-3.5 sm:col-span-1">
          <ProgressRing value={props.adherence} accent="#8b5cf6" size={96} label="adherence" />
          <div className="min-w-0">
            <div className="text-[0.62rem] uppercase tracking-[0.14em] text-white/35">Plan completed</div>
            <p className="mt-1 text-[0.78rem] leading-relaxed text-white/70">{props.headline}</p>
          </div>
        </div>

        <div className="surface grid grid-cols-2 gap-2 p-3.5 sm:col-span-2 sm:grid-cols-4">
          <Metric label="Tasks done" value={`${props.done}`} hint={`of ${props.done + props.slipped}`} />
          <Metric label="Slipped" value={`${props.slipped}`} hint="carried over" tone="amber" />
          <Metric label="Blocks planned" value={`${props.plannedCount}`} hint={props.rangeLabel} />
          <Metric
            label="Focus time"
            value={hours(props.focusMinutes)}
            hint={`${focusDelta >= 0 ? "+" : ""}${hours(focusDelta)} vs last`}
            tone={focusDelta >= 0 ? "mint" : "amber"}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-[0.98rem] font-semibold text-white">By domain</h2>
            <span className="text-[0.62rem] text-white/30">planned time this week</span>
          </div>

          {props.perDomain.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-[0.75rem] text-white/35">
              Nothing planned this week — that&apos;s the first thing to fix.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {props.perDomain.map((row) => {
                const max = Math.max(...props.perDomain.map((entry) => entry.plannedMinutes), 1);
                return (
                  <li key={row.slug}>
                    <div className="mb-1 flex items-center justify-between text-[0.72rem]">
                      <span className="flex items-center gap-1.5 text-white/70">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: row.accent }} />
                        {row.name}
                      </span>
                      <span className="text-white/40">
                        {hours(row.plannedMinutes)}
                        <span className="ml-1.5 text-white/25">
                          {row.total ? `${row.done}/${row.total} done` : ""}
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(3, Math.round((row.plannedMinutes / max) * 100))}%`,
                          backgroundColor: row.accent,
                          boxShadow: `0 0 12px ${withAlpha(row.accent, 0.6)}`,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {props.insights.length > 0 && (
            <div className="mt-4 rounded-xl border border-violet-400/20 bg-violet-500/[0.07] p-3">
              <div className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-violet-100">
                <Lightbulb className="h-3.5 w-3.5" /> Key insights
              </div>
              <ul className="mt-1.5 space-y-1">
                {props.insights.map((insight) => (
                  <li key={insight} className="text-[0.72rem] leading-relaxed text-violet-100/65">
                    • {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <div className="space-y-3">
          <section className="surface p-4">
            <h2 className="mb-2 font-display text-[0.95rem] font-semibold text-white">Next week</h2>
            <p className="text-[0.72rem] leading-relaxed text-white/40">
              These blocks come from your open tasks and the free slots the planner found. They land as dashed
              suggestions — accept them and they become real.
            </p>

            {proposals.length === 0 ? (
              <p className="mt-2.5 rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-[0.72rem] text-white/35">
                No proposals yet. Add tasks with estimates so next week can be planned.
              </p>
            ) : (
              <>
                <ul className="mt-2.5 space-y-1.5">
                  {proposals.map((proposal) => {
                    const checked = selected.has(key(proposal));
                    return (
                      <li key={key(proposal)}>
                        <button
                          onClick={() =>
                            setSelected((current) => {
                              const next = new Set(current);
                              if (next.has(key(proposal))) next.delete(key(proposal));
                              else next.add(key(proposal));
                              return next;
                            })
                          }
                          className="flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition"
                          style={{
                            borderColor: checked ? withAlpha("#8b5cf6", 0.45) : "rgba(255,255,255,0.07)",
                            backgroundColor: checked ? withAlpha("#8b5cf6", 0.12) : "rgba(255,255,255,0.02)",
                          }}
                        >
                          <span
                            className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[0.55rem] ${
                              checked ? "border-violet-400 bg-violet-500 text-white" : "border-white/25 text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[0.76rem] text-white/85">{proposal.title}</span>
                            <span className="block text-[0.62rem] text-white/35">
                              {new Intl.DateTimeFormat("en-US", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                timeZone: props.timeZone,
                              }).format(new Date(proposal.startISO))}{" "}
                              ·{" "}
                              {new Intl.DateTimeFormat("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                                timeZone: props.timeZone,
                              }).format(new Date(proposal.startISO))}{" "}
                              · {proposal.minutes}m
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <button
                  onClick={() => void accept()}
                  disabled={accepting || selected.size === 0}
                  className="btn btn-primary mt-2.5 w-full"
                >
                  {accepting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
                  Add {selected.size} block{selected.size === 1 ? "" : "s"}
                </button>
              </>
            )}
          </section>

          <section className="surface p-4">
            <h2 className="mb-2 flex items-center gap-1.5 font-display text-[0.95rem] font-semibold text-white">
              <TriangleAlert className="h-3.5 w-3.5 text-amber-300" /> Carried over
            </h2>
            {props.slippedTasks.length === 0 ? (
              <p className="text-[0.72rem] text-white/35">Nothing slipped this week.</p>
            ) : (
              <ul className="space-y-1.5">
                {props.slippedTasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-2 text-[0.74rem]">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: task.accent }} />
                    <span className="min-w-0 flex-1 truncate text-white/70">{task.title}</span>
                    <span className="text-[0.62rem] text-white/30">due {task.dueLabel}</span>
                  </li>
                ))}
              </ul>
            )}

            {props.deadlineTasks.length > 0 && (
              <>
                <div className="mt-3 mb-1.5 text-[0.62rem] uppercase tracking-[0.14em] text-white/30">
                  Deadlines next 14 days
                </div>
                <ul className="space-y-1.5">
                  {props.deadlineTasks.map((task) => (
                    <li key={task.id} className="flex items-center gap-2 text-[0.74rem]">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: task.accent }} />
                      <span className="min-w-0 flex-1 truncate text-white/70">{task.title}</span>
                      <span className="text-[0.62rem] text-white/30">{task.dueLabel}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      </div>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "violet",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "violet" | "amber" | "mint";
}) {
  const color = tone === "amber" ? "text-amber-200" : tone === "mint" ? "text-emerald-200" : "text-white";
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-2.5 py-2">
      <div className={`font-display text-[1.05rem] font-semibold leading-none ${color}`}>{value}</div>
      <div className="mt-1 text-[0.55rem] uppercase tracking-[0.12em] text-white/35">{label}</div>
      {hint && <div className="mt-0.5 truncate text-[0.6rem] text-white/30">{hint}</div>}
    </div>
  );
}
