"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Feather, Loader2, RotateCcw, Save } from "lucide-react";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";

let toastId = 0;

export function FinishActions({ planId, completed }: { planId: string; completed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"cycle" | "lighter" | "keep" | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  function toast(text: string, tone: "success" | "error" = "success") {
    toastId += 1;
    setToasts((current) => [...current, { id: toastId, text, tone }]);
  }

  async function newCycle(lighter: boolean) {
    setBusy(lighter ? "lighter" : "cycle");
    try {
      const response = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "new-cycle", lighter }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error ?? "Could not start a new cycle.", "error");
        return;
      }
      router.push("/reset/audit");
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function keepResult() {
    if (!completed) {
      setBusy("keep");
      try {
        const response = await fetch("/api/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "complete", planId }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          toast(data.error ?? "Could not close the cycle.", "error");
          return;
        }
        router.refresh();
      } catch {
        toast("Network error — try again.", "error");
      } finally {
        setBusy(null);
      }
      return;
    }
    router.push("/reset/reports");
  }

  return (
    <section className="surface p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl border border-emerald-400/25 bg-emerald-500/10 text-emerald-200">
          <Feather className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-[0.96rem] font-semibold text-white">What comes next</h2>
          <p className="text-[0.66rem] text-white/35">Nothing is restarted automatically. These are your choices.</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => void newCycle(false)}
          disabled={busy !== null}
          className="group flex min-h-[92px] flex-col items-start rounded-2xl border border-violet-400/25 bg-violet-500/[0.07] p-3 text-left transition hover:border-violet-400/45 hover:bg-violet-500/[0.12] disabled:opacity-50"
        >
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-500/20 text-violet-200">
            {busy === "cycle" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          </span>
          <p className="mt-1.5 text-[0.78rem] font-semibold text-white/85">Start a new cycle</p>
          <p className="mt-0.5 text-[0.63rem] leading-relaxed text-white/35">Another 90 days, beginning with a fresh audit.</p>
          <ArrowRight className="mt-auto h-3.5 w-3.5 self-end text-violet-300/50 transition group-hover:text-violet-200" />
        </button>

        <button
          type="button"
          onClick={() => void newCycle(true)}
          disabled={busy !== null}
          className="group flex min-h-[92px] flex-col items-start rounded-2xl border border-sky-400/20 bg-sky-500/[0.05] p-3 text-left transition hover:border-sky-400/35 hover:bg-sky-500/[0.09] disabled:opacity-50"
        >
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-500/15 text-sky-200">
            {busy === "lighter" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Feather className="h-3.5 w-3.5" />}
          </span>
          <p className="mt-1.5 text-[0.78rem] font-semibold text-white/85">Keep a lighter pace</p>
          <p className="mt-0.5 text-[0.63rem] leading-relaxed text-white/35">A new plan marked lighter, with fewer moving parts.</p>
          <ArrowRight className="mt-auto h-3.5 w-3.5 self-end text-sky-300/50 transition group-hover:text-sky-200" />
        </button>

        <button
          type="button"
          onClick={() => void keepResult()}
          disabled={busy !== null}
          className="group flex min-h-[92px] flex-col items-start rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 text-left transition hover:border-white/15 hover:bg-white/[0.05] disabled:opacity-50"
        >
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.06] text-white/55">
            {busy === "keep" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          </span>
          <p className="mt-1.5 text-[0.78rem] font-semibold text-white/85">{completed ? "Keep the result" : "Close this cycle"}</p>
          <p className="mt-0.5 text-[0.63rem] leading-relaxed text-white/35">
            {completed ? "Leave the plan closed and revisit the reports." : "Stop here without starting another 90 days."}
          </p>
          <ArrowRight className="mt-auto h-3.5 w-3.5 self-end text-white/25 transition group-hover:text-white/60" />
        </button>
      </div>

      <p className="mt-2.5 text-[0.62rem] leading-relaxed text-white/25">
        A lighter cycle still requires a short audit. It is not a reset of your data — the previous reports stay
        available.
      </p>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </section>
  );
}
