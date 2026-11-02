"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Flame, Loader2, MinusCircle, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { cn, withAlpha } from "@/lib/utils";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";
import { KindChip, KindIcon, ProgressBar, kindTone } from "./ui";

export interface CheckinItem {
  id: string;
  title: string;
  kind: string;
  domainName: string;
  accent: string;
  time: string;
  durationMinutes: number;
  cadence: string;
  streak: number;
  todayResult: string | null;
  weekResult: string | null;
}

const RESULTS = [
  { value: "done", label: "Done", icon: Check, color: "#34d399" },
  { value: "skipped", label: "Skip", icon: MinusCircle, color: "#fbbf24" },
  { value: "missed", label: "Miss", icon: X, color: "#fb7185" },
] as const;

let toastId = 0;

export function TodayCheckin({
  planId,
  items,
  canCheckin,
  checkinTime,
}: {
  planId: string;
  items: CheckinItem[];
  canCheckin: boolean;
  checkinTime: string;
}) {
  const router = useRouter();
  const [results, setResults] = useState<Record<string, string | null>>(
    Object.fromEntries(items.map((item) => [item.id, item.todayResult ?? (item.cadence === "weekly" ? item.weekResult : null)])),
  );
  const [pending, setPending] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [, startTransition] = useTransition();

  const doneCount = Object.values(results).filter((result) => result === "done").length;

  function toast(text: string, tone: "success" | "error" = "success") {
    toastId += 1;
    setToasts((current) => [...current, { id: toastId, text, tone }]);
  }

  async function checkin(item: CheckinItem, result: string) {
    if (!canCheckin) return;
    const previous = results[item.id] ?? null;
    setResults((current) => ({ ...current, [item.id]: result }));
    setPending(item.id);
    try {
      const response = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkin", planId, commitmentId: item.id, result }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setResults((current) => ({ ...current, [item.id]: previous }));
        toast(data.error ?? "Could not save the check-in.", "error");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setResults((current) => ({ ...current, [item.id]: previous }));
      toast("Network error — check-in not saved.", "error");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-violet-400/25 bg-violet-500/12 text-violet-200">
              <RotateCcw className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-[0.98rem] font-semibold text-white">Today&apos;s check-in</h2>
              <p className="text-[0.66rem] text-white/35">
                {canCheckin
                  ? `About one minute. Your reminder is set for ${checkinTime}.`
                  : "The plan is paused. Resume it when you are ready to check in again."}
              </p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className="font-display text-[0.95rem] font-semibold text-white">
            {doneCount}/{items.length}
          </span>
          <p className="text-[0.56rem] uppercase tracking-[0.14em] text-white/30">done today</p>
        </div>
      </div>

      <ProgressBar value={items.length ? (doneCount / items.length) * 100 : 0} accent="#8b5cf6" className="mt-3" />

      {!items.length ? (
        <div className="mt-3 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center">
          <p className="text-[0.82rem] font-medium text-white/60">No commitments for today yet.</p>
          <p className="mt-1 text-[0.7rem] text-white/30">Add one or two in the builder — enough to repeat, not enough to dread.</p>
          <Link href="/reset/builder" className="btn btn-ghost mt-3 text-[0.74rem]">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Open plan builder
          </Link>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => {
            const current = results[item.id] ?? null;
            const tone = kindTone(item.kind);
            const selected = RESULTS.find((result) => result.value === current);
            return (
              <li
                key={item.id}
                className="rounded-2xl border p-3 transition"
                style={{
                  borderColor: current ? withAlpha(selected?.color ?? tone, 0.28) : "rgba(255,255,255,0.07)",
                  background: current ? withAlpha(selected?.color ?? tone, 0.05) : "rgba(255,255,255,0.018)",
                }}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border"
                    style={{
                      borderColor: withAlpha(item.accent, 0.3),
                      backgroundColor: withAlpha(item.accent, 0.14),
                      color: item.accent,
                    }}
                  >
                    <KindIcon kind={item.kind} size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className={cn("text-[0.84rem] font-semibold", current === "done" ? "text-white/55 line-through" : "text-white/90")}>
                        {item.title}
                      </p>
                      <KindChip kind={item.kind} />
                      {item.cadence === "weekly" && (
                        <span className="rounded-full border border-sky-400/25 bg-sky-500/10 px-1.5 py-0.5 text-[0.52rem] font-bold uppercase tracking-wider text-sky-200/80">
                          weekly
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.65rem] text-white/35">
                      <span className="text-white/55">{item.domainName}</span>
                      <span>·</span>
                      <span>{item.time}</span>
                      <span>·</span>
                      <span>{item.durationMinutes}m</span>
                      {item.streak > 0 && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-amber-300/80">
                            <Flame className="h-3 w-3" /> {item.streak} day{item.streak === 1 ? "" : "s"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {pending === item.id && <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin text-violet-300" />}
                </div>

                <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                  {RESULTS.map((result) => {
                    const active = current === result.value;
                    const Icon = result.icon;
                    return (
                      <button
                        key={result.value}
                        type="button"
                        onClick={() => void checkin(item, result.value)}
                        disabled={!canCheckin || pending !== null}
                        className={cn(
                          "flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border text-[0.7rem] font-semibold transition active:scale-[0.98]",
                          active
                            ? "text-white"
                            : "border-white/[0.07] bg-white/[0.025] text-white/40 hover:border-white/15 hover:text-white/75",
                        )}
                        style={
                          active
                            ? {
                                borderColor: withAlpha(result.color, 0.4),
                                backgroundColor: withAlpha(result.color, 0.16),
                                boxShadow: `0 0 18px -10px ${withAlpha(result.color, 0.9)}`,
                              }
                            : undefined
                        }
                      >
                        <Icon className="h-3.5 w-3.5" style={{ color: active ? result.color : undefined }} />
                        {result.label}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.055] bg-white/[0.02] px-2.5 py-2">
        <p className="text-[0.63rem] leading-relaxed text-white/35">
          Skipped on purpose is not a miss. The weekly review carries the same check-ins into one Reset card.
        </p>
        <Link href="/reset/builder" className="ml-auto text-[0.65rem] font-semibold text-violet-300/70 hover:text-violet-200">
          Edit plan
        </Link>
      </div>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </section>
  );
}
