"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CalendarDays, Loader2, Plus, Target, TrendingUp } from "lucide-react";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";
import { ProgressBar } from "@/components/reset/ui";
import { goalPercent } from "@/lib/reset/calc";

export interface GoalEntry {
  id: string;
  dateKey: string;
  value: number;
  note: string;
}

let toastId = 0;

export function GoalDetailPanel({
  goalId,
  title,
  area,
  metric,
  unit,
  target,
  cadence,
  todayKey,
  planId,
  entries,
}: {
  goalId: string;
  title: string;
  area: string;
  metric: string;
  unit: string;
  target: number;
  cadence: string;
  todayKey: string;
  planId: string | null;
  entries: GoalEntry[];
}) {
  const router = useRouter();
  const [history, setHistory] = useState(entries);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [dateKey, setDateKey] = useState(todayKey);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const latest = [...history].sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0] ?? null;
  const percent = goalPercent(latest?.value ?? 0, target);
  const onTrack = percent >= 70;
  const maxValue = Math.max(target, ...history.map((entry) => entry.value), 1);
  const chart = [...history].sort((a, b) => a.dateKey.localeCompare(b.dateKey)).slice(-12);

  function toast(text: string, tone: "success" | "error" = "success") {
    toastId += 1;
    setToasts((current) => [...current, { id: toastId, text, tone }]);
  }

  async function log() {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      toast("Enter a number of zero or more.", "error");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/habits/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId, value: numeric, note, dateKey }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error ?? "Could not save progress.", "error");
        return;
      }
      setHistory((current) => {
        const next = current.filter((entry) => entry.dateKey !== data.dateKey);
        return [...next, { id: `local-${data.dateKey}`, dateKey: data.dateKey, value: numeric, note }];
      });
      setValue("");
      setNote("");
      toast("Progress logged.");
      router.refresh();
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3.5">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="surface p-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-emerald-400/25 bg-emerald-500/12 text-emerald-200">
              <Target className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[0.56rem] font-bold uppercase tracking-[0.14em] text-white/30">Goal track</p>
              <h2 className="font-display text-[0.95rem] font-semibold text-white">{title}</h2>
            </div>
          </div>

          <div className="mt-4 flex items-end gap-3">
            <div>
              <p className="font-display text-[2.1rem] font-bold leading-none text-white">{latest?.value ?? 0}</p>
              <p className="mt-1 text-[0.65rem] text-white/35">
                of {target} {unit}
              </p>
            </div>
            <span
              className="mb-1 rounded-full border px-2 py-0.5 text-[0.62rem] font-bold"
              style={
                onTrack
                  ? { borderColor: "rgba(52,211,153,0.3)", backgroundColor: "rgba(52,211,153,0.1)", color: "#6ee7b7" }
                  : { borderColor: "rgba(251,191,36,0.3)", backgroundColor: "rgba(251,191,36,0.08)", color: "#fcd34d" }
              }
            >
              {percent}%
            </span>
            <span className="mb-1 ml-auto text-[0.6rem] text-white/25">{onTrack ? "on track" : "needs a look"}</span>
          </div>

          <ProgressBar value={percent} accent={onTrack ? "#34d399" : "#fbbf24"} className="mt-3" height="h-2" />

          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {[
              ["Metric", metric || "Not set"],
              ["Cadence", `Per ${cadence}`],
              ["Area", area],
              ["Entries", String(history.length)],
            ].map(([label, valueText]) => (
              <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                <p className="text-[0.55rem] uppercase tracking-[0.12em] text-white/25">{label}</p>
                <p className="mt-0.5 truncate text-[0.7rem] font-medium text-white/65">{valueText}</p>
              </div>
            ))}
          </div>

          {planId && (
            <Link href="/reset/builder" className="btn btn-ghost mt-3 w-full justify-center text-[0.7rem]">
              Edit the goal in the plan builder <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </section>

        <section className="surface p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-300" />
            <h2 className="font-display text-[0.95rem] font-semibold text-white">Progress</h2>
            <span className="ml-auto text-[0.6rem] text-white/25">Last 12 entries</span>
          </div>

          {chart.length ? (
            <div className="mt-4 flex h-[9.5rem] items-end gap-1.5">
              {chart.map((entry) => {
                const height = Math.max(4, Math.round((entry.value / maxValue) * 100));
                return (
                  <div key={entry.dateKey} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[0.52rem] font-medium text-white/30 opacity-0 transition group-hover:opacity-100">
                      {entry.value}
                    </span>
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-emerald-500/45 to-emerald-300/80 transition group-hover:from-emerald-400/60 group-hover:to-emerald-200"
                      style={{ height: `${height}%` }}
                      title={`${entry.dateKey} · ${entry.value} ${unit}`}
                    />
                    <span className="w-full truncate text-center text-[0.48rem] text-white/20">
                      {entry.dateKey.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 flex h-[9.5rem] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 text-center">
              <TrendingUp className="h-5 w-5 text-white/20" />
              <p className="mt-1.5 text-[0.74rem] text-white/40">No progress entries yet.</p>
              <p className="text-[0.64rem] text-white/25">Log the first number when the week closes.</p>
            </div>
          )}

          <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-white/30">Log a number</p>
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input
                type="number"
                min={0}
                step="0.5"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={`${metric || "Value"} (${unit || "unit"})`}
                className="field"
              />
              <input
                type="date"
                value={dateKey}
                max={todayKey}
                onChange={(event) => setDateKey(event.target.value)}
                className="field w-[9.5rem]"
                aria-label="Progress date"
              />
            </div>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note"
              className="field mt-2"
            />
            <button
              type="button"
              onClick={() => void log()}
              disabled={busy || !value.trim()}
              className="btn btn-primary mt-2 w-full justify-center text-[0.74rem]"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Save progress
            </button>
          </div>
        </section>
      </div>

      <section className="surface p-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-white/35" />
          <h2 className="font-display text-[0.92rem] font-semibold text-white">History</h2>
          <span className="ml-auto text-[0.6rem] text-white/25">Numbers you entered</span>
        </div>
        {history.length ? (
          <ul className="mt-2.5 divide-y divide-white/[0.05]">
            {[...history]
              .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
              .map((entry) => (
                <li key={`${entry.dateKey}-${entry.id}`} className="flex items-center gap-3 py-2">
                  <span className="w-[5.5rem] shrink-0 text-[0.62rem] text-white/30">{entry.dateKey}</span>
                  <span className="min-w-0 flex-1 truncate text-[0.7rem] text-white/55">{entry.note || "—"}</span>
                  <span className="shrink-0 font-display text-[0.78rem] font-semibold text-white/80">
                    {entry.value} <span className="text-[0.6rem] font-normal text-white/30">{unit}</span>
                  </span>
                </li>
              ))}
          </ul>
        ) : (
          <p className="mt-2 text-[0.7rem] text-white/30">Nothing logged yet. The chart starts with one number.</p>
        )}
      </section>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </div>
  );
}
