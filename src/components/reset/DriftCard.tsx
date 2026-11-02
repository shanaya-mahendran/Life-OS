"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Sparkles, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";

interface Suggestion {
  commitmentId: string;
  title: string;
  reason: string;
  message: string;
  detail: string;
}

let toastId = 0;

export function DriftCard({
  planId,
  suggestions,
  autonomy,
}: {
  planId: string;
  suggestions: Suggestion[];
  autonomy: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [confirmDrop, setConfirmDrop] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [, startTransition] = useTransition();

  const visible = suggestions.filter((suggestion) => !hidden.has(suggestion.commitmentId));

  function toast(text: string, tone: "success" | "error" = "success") {
    toastId += 1;
    setToasts((current) => [...current, { id: toastId, text, tone }]);
  }

  async function act(suggestion: Suggestion, driftAction: "move" | "drop" | "lighter" | "dismiss") {
    setBusy(suggestion.commitmentId);
    try {
      const response = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "drift",
          planId,
          commitmentId: suggestion.commitmentId,
          driftAction,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error ?? "Could not apply that choice.", "error");
        return;
      }
      if (driftAction === "dismiss") {
        setHidden((current) => new Set(current).add(suggestion.commitmentId));
      }
      setConfirmDrop(null);
      toast(data.message ?? "Suggestion updated.");
      startTransition(() => router.refresh());
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  if (!visible.length) {
    return (
      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))}
      />
    );
  }

  return (
    <section className="surface relative overflow-hidden p-4">
      <div className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="relative flex flex-wrap items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl border border-amber-400/25 bg-amber-400/10 text-amber-300">
          <TriangleAlert className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-[0.95rem] font-semibold text-white">A smaller next step</h2>
          <p className="text-[0.65rem] text-white/35">
            Drift is information, not a verdict. Nothing changes until you choose.
          </p>
        </div>
        <span className="ml-auto chip border-amber-400/20 bg-amber-400/[0.07] text-amber-100/60">
          {autonomy === "auto_small" ? "auto-adjust on" : "suggest only"}
        </span>
      </div>

      <div className="relative mt-3 space-y-2">
        {visible.map((suggestion) => {
          const isBusy = busy === suggestion.commitmentId;
          const dropping = confirmDrop === suggestion.commitmentId;
          return (
            <div key={suggestion.commitmentId} className="rounded-2xl border border-amber-400/18 bg-amber-400/[0.045] p-3">
              <p className="text-[0.78rem] font-semibold leading-relaxed text-amber-50/85">{suggestion.message}</p>
              <p className="mt-1 text-[0.68rem] leading-relaxed text-amber-100/45">{suggestion.detail}</p>

              {dropping ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] px-2.5 py-2">
                  <p className="text-[0.68rem] text-rose-100/80">Drop this commitment for the rest of the plan?</p>
                  <div className="ml-auto flex gap-1.5">
                    <button type="button" onClick={() => setConfirmDrop(null)} className="btn btn-quiet px-2 py-1 text-[0.68rem]">
                      Keep it
                    </button>
                    <button
                      type="button"
                      onClick={() => void act(suggestion, "drop")}
                      disabled={isBusy}
                      className="btn border border-rose-400/30 bg-rose-500/15 px-2.5 py-1 text-[0.68rem] text-rose-100"
                    >
                      {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                      Drop it
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => void act(suggestion, "move")}
                    disabled={isBusy}
                    className="btn btn-primary min-h-[36px] px-2.5 text-[0.68rem]"
                  >
                    {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
                    Move to tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => void act(suggestion, "lighter")}
                    disabled={isBusy}
                    className="btn btn-ghost min-h-[36px] px-2.5 text-[0.68rem]"
                  >
                    <Sparkles className="h-3 w-3" /> Lighter pace
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDrop(suggestion.commitmentId)}
                    disabled={isBusy}
                    className="btn btn-ghost min-h-[36px] px-2.5 text-[0.68rem] text-rose-200/70 hover:text-rose-200"
                  >
                    Drop it
                  </button>
                  <button
                    type="button"
                    onClick={() => void act(suggestion, "dismiss")}
                    disabled={isBusy}
                    className={cn("btn btn-quiet ml-auto min-h-[36px] px-2 text-[0.66rem] text-white/35")}
                  >
                    Not now
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </section>
  );
}
