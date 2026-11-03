"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Check,
  Flame,
  Loader2,
  MinusCircle,
  Plus,
  RotateCcw,
  Target,
  Trash2,
  X,
} from "lucide-react";
import type { GoalCard, HabitCard } from "@/lib/reset/habits";
import { cn, withAlpha } from "@/lib/utils";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";
import { HeatDots, ProgressBar } from "@/components/reset/ui";

interface HabitTrackerProps {
  habits: HabitCard[];
  goals: GoalCard[];
  domains: { slug: string; name: string; accent: string }[];
  planActive: boolean;
  planDay: number;
  todayKey: string;
}

type Filter = "all" | "plan" | "manual" | "goals";

const RESULTS = [
  { value: "done", label: "Done", icon: Check, color: "#34d399" },
  { value: "skipped", label: "Skip", icon: MinusCircle, color: "#fbbf24" },
  { value: "missed", label: "Miss", icon: X, color: "#fb7185" },
] as const;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
let toastId = 0;

export function HabitTracker({ habits, goals, domains, planActive, planDay, todayKey }: HabitTrackerProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState(habits);
  const [goalItems, setGoalItems] = useState(goals);
  const [results, setResults] = useState<Record<string, string | null>>(
    Object.fromEntries(habits.map((habit) => [habit.id, habit.todayResult ?? habit.weekResult])),
  );
  const [pending, setPending] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [, startTransition] = useTransition();

  const domainMap = useMemo(() => new Map(domains.map((domain) => [domain.slug, domain])), [domains]);
  const planHabits = items.filter((habit) => habit.source === "reset_plan");
  const manualHabits = items.filter((habit) => habit.source === "manual");

  function toast(text: string, tone: "success" | "error" = "success") {
    toastId += 1;
    setToasts((current) => [...current, { id: toastId, text, tone }]);
  }

  async function checkin(habit: HabitCard, result: string) {
    const previous = results[habit.id] ?? null;
    setResults((current) => ({ ...current, [habit.id]: result }));
    setPending(habit.id);
    try {
      let response: Response;
      if (habit.source === "reset_plan") {
        if (!habit.planId || !habit.commitmentId) throw new Error("This plan habit is missing its link.");
        response = await fetch("/api/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "checkin",
            planId: habit.planId,
            commitmentId: habit.commitmentId,
            result,
          }),
        });
      } else {
        response = await fetch("/api/habits/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ habitId: habit.id, result }),
        });
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setResults((current) => ({ ...current, [habit.id]: previous }));
        toast(data.error ?? "Could not save the check-in.", "error");
        return;
      }
      startTransition(() => router.refresh());
    } catch (error) {
      setResults((current) => ({ ...current, [habit.id]: previous }));
      toast(error instanceof Error ? error.message : "Network error — try again.", "error");
    } finally {
      setPending(null);
    }
  }

  async function archive(habit: HabitCard) {
    setPending(habit.id);
    try {
      const response = await fetch(`/api/habits?id=${encodeURIComponent(habit.id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error ?? "Could not archive the habit.", "error");
        return;
      }
      setItems((current) => current.filter((item) => item.id !== habit.id));
      setArchiveId(null);
      toast("Habit archived. Its history is kept.");
      startTransition(() => router.refresh());
    } finally {
      setPending(null);
    }
  }

  const visibleHabits =
    filter === "plan" ? planHabits : filter === "manual" ? manualHabits : filter === "goals" ? [] : items;

  return (
    <div className="space-y-3.5">
      <section className="surface p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {items.length + goalItems.length > 0 && <div className="no-scrollbar flex flex-1 items-center gap-1 overflow-x-auto">
            {[
              { key: "all", label: "All", count: items.length + goalItems.length },
              { key: "plan", label: "Reset plan", count: planHabits.length },
              { key: "manual", label: "Manual", count: manualHabits.length },
              { key: "goals", label: "Goals", count: goalItems.length },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key as Filter)}
                className={cn(
                  "inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[0.7rem] font-semibold transition",
                  filter === tab.key
                    ? "border-emerald-400/30 bg-emerald-500/12 text-emerald-100"
                    : "border-white/[0.07] bg-white/[0.02] text-white/40 hover:text-white/70",
                )}
              >
                {tab.label}
                <span className={cn("text-[0.6rem]", filter === tab.key ? "text-emerald-200/60" : "text-white/20")}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>}
          <button type="button" onClick={() => setShowAdd(true)} className="btn btn-primary text-[0.72rem]">
            <Plus className="h-3.5 w-3.5" /> Add habit
          </button>
        </div>

        {showAdd && (
          <ManualHabitForm
            domains={domains}
            onClose={() => setShowAdd(false)}
            onCreated={() => {
              setShowAdd(false);
              toast("Habit added. It is tagged as manual.");
              startTransition(() => router.refresh());
            }}
            onError={(message) => toast(message, "error")}
          />
        )}
      </section>

      {filter !== "goals" && (
        <div className="grid gap-2.5 md:grid-cols-2">
          {visibleHabits.map((habit) => {
            const domain = domainMap.get(habit.domainSlug);
            const accent = domain?.accent ?? "#34d399";
            const current = results[habit.id] ?? null;
            const isBusy = pending === habit.id;
            const canCheckin = habit.source === "reset_plan" ? planActive : true;
            const schedule =
              habit.cadence === "weekly"
                ? `Every ${WEEKDAYS[habit.weekday ?? 1]}`
                : "Every day";

            return (
              <section
                key={habit.id}
                className="relative overflow-hidden rounded-2xl border p-3.5"
                style={{
                  borderColor: withAlpha(accent, 0.18),
                  background: `linear-gradient(145deg, ${withAlpha(accent, 0.075)}, rgba(15,11,28,0.9) 65%)`,
                }}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border"
                    style={{
                      borderColor: withAlpha(accent, 0.28),
                      backgroundColor: withAlpha(accent, 0.14),
                      color: accent,
                    }}
                  >
                    {habit.source === "reset_plan" ? <RotateCcw className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="text-[0.84rem] font-semibold leading-snug text-white/90">{habit.title}</h3>
                      <span
                        className={cn(
                          "rounded-full border px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-[0.1em]",
                          habit.source === "reset_plan"
                            ? "border-violet-400/25 bg-violet-500/10 text-violet-200/70"
                            : "border-white/10 bg-white/[0.04] text-white/35",
                        )}
                      >
                        {habit.source === "reset_plan" ? "plan" : "manual"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[0.63rem] text-white/30">
                      {domain?.name ?? habit.domainSlug} · {schedule}
                    </p>
                  </div>
                  {habit.source === "manual" && (
                    <button
                      type="button"
                      onClick={() => setArchiveId(habit.id)}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/20 transition hover:bg-rose-500/10 hover:text-rose-300"
                      aria-label={`Archive ${habit.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold text-amber-300/80">
                    <Flame className="h-3 w-3" /> {habit.streak} day{habit.streak === 1 ? "" : "s"}
                  </span>
                  <span className="text-[0.62rem] text-white/30">{habit.adherence}% over 14 days</span>
                  <span className="ml-auto text-[0.58rem] text-white/20">{habit.done}/{habit.total || 0} done</span>
                </div>

                <div className="mt-2">
                  <HeatDots recent={habit.recent} accent={accent} />
                </div>

                <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                  {RESULTS.map((result) => {
                    const active = current === result.value;
                    const Icon = result.icon;
                    return (
                      <button
                        key={result.value}
                        type="button"
                        onClick={() => void checkin(habit, result.value)}
                        disabled={!canCheckin || isBusy}
                        className={cn(
                          "flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border text-[0.68rem] font-semibold transition disabled:opacity-40",
                          active ? "text-white" : "border-white/[0.06] bg-white/[0.02] text-white/35 hover:border-white/12 hover:text-white/70",
                        )}
                        style={
                          active
                            ? {
                                borderColor: withAlpha(result.color, 0.38),
                                backgroundColor: withAlpha(result.color, 0.14),
                              }
                            : undefined
                        }
                      >
                        {isBusy && current === result.value ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Icon className="h-3.5 w-3.5" style={{ color: active ? result.color : undefined }} />
                        )}
                        {result.label}
                      </button>
                    );
                  })}
                </div>

                {!canCheckin && (
                  <p className="mt-1.5 text-[0.6rem] text-amber-100/40">Paused with the Reset Plan — history stays visible.</p>
                )}

                {archiveId === habit.id && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] px-2.5 py-2">
                    <p className="text-[0.65rem] text-rose-100/70">Archive this manual habit?</p>
                    <div className="ml-auto flex gap-1.5">
                      <button type="button" onClick={() => setArchiveId(null)} className="btn btn-quiet px-2 py-1 text-[0.65rem]">
                        Keep
                      </button>
                      <button
                        type="button"
                        onClick={() => void archive(habit)}
                        disabled={isBusy}
                        className="btn border border-rose-400/30 bg-rose-500/12 px-2 py-1 text-[0.65rem] text-rose-100"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                )}

                {habit.notes && <p className="mt-2 line-clamp-2 text-[0.62rem] leading-relaxed text-white/25">{habit.notes}</p>}
              </section>
            );
          })}

          {!visibleHabits.length && (
            <div className="md:col-span-2">
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-9 text-center">
                <Activity className="mx-auto h-6 w-6 text-white/20" />
                <p className="mt-2 text-[0.82rem] font-medium text-white/55">
                  {filter === "plan"
                    ? "No plan habits yet."
                    : filter === "manual"
                      ? "No manual habits yet."
                      : "No habits yet."}
                </p>
                <p className="mt-1 text-[0.7rem] text-white/30">
                  {filter === "plan"
                    ? "Approve a Reset Plan and its commitments appear here automatically — no re-entry."
                    : "Start with one small daily habit. The tracker keeps the streak; you keep the choice."}
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {filter === "plan" ? (
                    <Link href="/reset" className="btn btn-ghost text-[0.72rem]">
                      Open Reset Plan
                    </Link>
                  ) : (
                    <button type="button" onClick={() => setShowAdd(true)} className="btn btn-primary text-[0.72rem]">
                      <Plus className="h-3.5 w-3.5" /> Add the first habit
                    </button>
                  )}
                  {!planActive && (
                    <Link href="/reset" className="btn btn-ghost text-[0.72rem]">
                      Start a Reset Plan
                    </Link>
                  )}
                </div>
                {planDay > 0 && planActive && (
                  <p className="mt-2 text-[0.6rem] text-white/20">Reset Plan · day {planDay}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {(filter === "all" || filter === "goals") && goalItems.length > 0 && (
        <section className="surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-emerald-400/25 bg-emerald-500/12 text-emerald-200">
              <Target className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-[0.95rem] font-semibold text-white">Goal tracks</h2>
              <p className="text-[0.65rem] text-white/35">The measurable form of a Month 3 goal. You log the number; the AI only reads it.</p>
            </div>
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {goalItems.map((goal) => (
                <Link
                  key={goal.id}
                  href={`/habits/goals/${goal.id}`}
                  className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 transition hover:border-emerald-400/25 hover:bg-emerald-500/[0.04]"
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8rem] font-semibold text-white/80">{goal.title}</span>
                      <span className="mt-0.5 block text-[0.62rem] text-white/30">
                        {goal.area} · {goal.metric || "Metric not set"} · per {goal.cadence}
                      </span>
                    </span>
                    <span className="shrink-0 font-display text-[0.95rem] font-semibold text-white">{goal.percent}%</span>
                  </div>
                  <ProgressBar value={goal.percent} accent={goal.onTrack ? "#34d399" : "#fbbf24"} className="mt-2" height="h-1.5" />
                  <div className="mt-1.5 flex items-center justify-between text-[0.6rem] text-white/25">
                    <span>
                      {goal.current} / {goal.target} {goal.unit}
                    </span>
                    <span className="inline-flex items-center gap-1 text-emerald-300/60">
                      {goal.onTrack ? "on track" : "needs a look"} <ArrowRight className="h-2.5 w-2.5" />
                    </span>
                  </div>
                </Link>
            ))}
          </div>
        </section>
      )}

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </div>
  );
}

function ManualHabitForm({
  domains,
  onClose,
  onCreated,
  onError,
}: {
  domains: { slug: string; name: string; accent: string }[];
  onClose: () => void;
  onCreated: () => void;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [domainSlug, setDomainSlug] = useState(domains.find((domain) => domain.slug === "habits")?.slug ?? domains[0]?.slug ?? "habits");
  const [cadence, setCadence] = useState<"daily" | "weekly">("daily");
  const [weekday, setWeekday] = useState(1);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) {
      onError("Give the habit a title.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          domainSlug,
          cadence,
          weekday: cadence === "weekly" ? weekday : null,
          notes,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        onError(data.error ?? "Could not add the habit.");
        return;
      }
      onCreated();
    } catch {
      onError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 animate-[rise_0.2s_ease-out] rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.04] p-3">
      <div className="flex items-center justify-between">
        <p className="text-[0.78rem] font-semibold text-white/80">New manual habit</p>
        <button type="button" onClick={onClose} className="text-[0.65rem] text-white/35 hover:text-white">
          Cancel
        </button>
      </div>
      <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
        <label className="block space-y-1 sm:col-span-2">
          <span className="label">Habit</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ten minutes of stretching after lunch"
            className="field"
            autoFocus
          />
        </label>
        <label className="block space-y-1">
          <span className="label">Domain</span>
          <select value={domainSlug} onChange={(event) => setDomainSlug(event.target.value)} className="field">
            {domains.map((domain) => (
              <option key={domain.slug} value={domain.slug} className="bg-[#150f28]">
                {domain.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="label">Cadence</span>
          <select
            value={cadence}
            onChange={(event) => setCadence(event.target.value as "daily" | "weekly")}
            className="field"
          >
            <option value="daily" className="bg-[#150f28]">Every day</option>
            <option value="weekly" className="bg-[#150f28]">Once a week</option>
          </select>
        </label>
        {cadence === "weekly" && (
          <label className="block space-y-1">
            <span className="label">Day</span>
            <select value={weekday} onChange={(event) => setWeekday(Number(event.target.value))} className="field">
              {WEEKDAYS.map((label, index) => (
                <option key={label} value={index} className="bg-[#150f28]">
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block space-y-1 sm:col-span-2">
          <span className="label">Note (optional)</span>
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Anything worth remembering"
            className="field"
          />
        </label>
      </div>
      <div className="mt-2.5 flex justify-end">
        <button type="button" onClick={() => void submit()} disabled={busy} className="btn btn-primary text-[0.74rem]">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add habit
        </button>
      </div>
    </div>
  );
}
