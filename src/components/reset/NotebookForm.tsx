"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Save, SkipForward, Sparkles } from "lucide-react";
import { NOTEBOOK_QUESTIONS } from "@/lib/reset/constants";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

let toastId = 0;

export function NotebookForm({
  planId,
  reviewDay,
  periodLabel,
  initial,
  skipped,
  reportId,
  summary,
}: {
  planId: string;
  reviewDay: number;
  periodLabel: string;
  initial: { q1: string; q2: string; q3: string };
  skipped: boolean;
  reportId: string | null;
  summary: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState(initial);
  const [skippedState, setSkippedState] = useState(skipped);
  const [busy, setBusy] = useState<"draft" | "build" | "skip" | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  function toast(text: string, tone: "success" | "error" = "success") {
    toastId += 1;
    setToasts((current) => [...current, { id: toastId, text, tone }]);
  }

  async function submit(mode: "draft" | "build" | "skip") {
    if (mode === "build" && !skippedState && Object.values(answers).some((value) => !value.trim())) {
      toast("Answer all three questions, or skip the notebook on purpose.", "error");
      return;
    }
    setBusy(mode);
    try {
      const response = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "notebook",
          planId,
          reviewDay,
          q1: skippedState ? "" : answers.q1,
          q2: skippedState ? "" : answers.q2,
          q3: skippedState ? "" : answers.q3,
          skipped: mode === "skip" || skippedState,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error ?? "Could not save the notebook.", "error");
        return;
      }

      if (mode === "draft") {
        toast("Notebook saved. The report stays a draft until you build it.");
        router.refresh();
        return;
      }

      router.push(`/reset/reports/${data.reportId}`);
    } catch {
      toast("Network error — your answers are still here.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3.5">
      <section className="surface relative overflow-hidden p-4 sm:p-5">
        <div className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full bg-fuchsia-500/12 blur-3xl" />
        <div className="relative">
          <span className="chip border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-200">
            <Sparkles className="h-3 w-3" /> {periodLabel}
          </span>
          <h2 className="mt-2 font-display text-[1.15rem] font-semibold text-white">The black notebook</h2>
          <p className="mt-1 max-w-2xl text-[0.76rem] leading-relaxed text-white/40">
            Three questions in your own words. The agent quotes you; it does not invent facts about your life.
            Skipping on purpose counts as skipped, not missed.
          </p>

          <div className="mt-4 space-y-3">
            {NOTEBOOK_QUESTIONS.map((question, index) => {
              const key = (["q1", "q2", "q3"] as const)[index];
              return (
                <label key={key} className="block space-y-1.5">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[0.78rem] font-semibold text-white/75">
                      <span className="mr-1.5 text-white/25">{String(index + 1).padStart(2, "0")}</span>
                      {question}
                    </span>
                    <span className="shrink-0 text-[0.6rem] tabular-nums text-white/25">{answers[key].length}</span>
                  </span>
                  <textarea
                    value={answers[key]}
                    onChange={(event) => setAnswers((current) => ({ ...current, [key]: event.target.value }))}
                    rows={3}
                    disabled={skippedState}
                    placeholder="In your own words…"
                    className={cn("field resize-none text-[0.82rem] leading-relaxed", skippedState && "opacity-45")}
                  />
                </label>
              );
            })}
          </div>

          {skippedState && (
            <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2">
              <p className="text-[0.7rem] text-amber-100/70">
                This review will be recorded as skipped on purpose. The report will contain numbers only and you can
                write the summary yourself.
              </p>
            </div>
          )}

          {summary && (
            <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <p className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-white/30">Current agent summary</p>
              <p className="mt-1.5 text-[0.74rem] leading-relaxed text-white/50">{summary}</p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void submit("build")}
              disabled={busy !== null}
              className="btn btn-primary text-[0.78rem]"
            >
              {busy === "build" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Build my report
            </button>
            <button
              type="button"
              onClick={() => void submit("draft")}
              disabled={busy !== null}
              className="btn btn-ghost text-[0.76rem]"
            >
              {busy === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save draft
            </button>
            <button
              type="button"
              onClick={() => {
                setSkippedState(true);
                void submit("skip");
              }}
              disabled={busy !== null}
              className="btn btn-quiet ml-auto text-[0.72rem] text-white/35 hover:text-white/70"
            >
              {busy === "skip" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SkipForward className="h-3.5 w-3.5" />}
              Skip on purpose
            </button>
          </div>

          {reportId && (
            <button
              type="button"
              onClick={() => router.push(`/reset/reports/${reportId}`)}
              className="mt-2 text-[0.68rem] font-semibold text-violet-300/70 hover:text-violet-200"
            >
              The report already exists — open it →
            </button>
          )}
        </div>
      </section>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </div>
  );
}
