"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  PencilLine,
  RefreshCw,
  Save,
  Sparkles,
  Target,
} from "lucide-react";
import type { GapReportDraft } from "@/lib/reset/calc";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";

interface Props {
  planId: string;
  initial: Partial<GapReportDraft>;
  quotes: { current: string; target: string; pattern: string };
}

let toastId = 0;

const EMPTY: GapReportDraft = {
  generatedAt: "",
  currentQuote: "",
  targetQuote: "",
  patternQuote: "",
  summary: "",
  patterns: [],
  topGaps: [],
  cutCandidates: [],
  anchorCandidates: [],
  recommendedFocus: "",
  notes: "",
};

export function GapReportEditor({ planId, initial, quotes }: Props) {
  const router = useRouter();
  const [report, setReport] = useState<GapReportDraft>({
    ...EMPTY,
    currentQuote: quotes.current,
    targetQuote: quotes.target,
    patternQuote: quotes.pattern,
    ...initial,
    patterns: Array.isArray(initial.patterns) ? initial.patterns : [],
    topGaps: Array.isArray(initial.topGaps) ? initial.topGaps : [],
    cutCandidates: Array.isArray(initial.cutCandidates) ? initial.cutCandidates : [],
    anchorCandidates: Array.isArray(initial.anchorCandidates) ? initial.anchorCandidates : [],
  });
  const [busy, setBusy] = useState<"save" | "regenerate" | "approve" | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const hasDraft = Boolean(report.generatedAt || report.summary);

  function toast(text: string, tone: "success" | "error" = "success") {
    toastId += 1;
    setToasts((current) => [...current, { id: toastId, text, tone }]);
  }

  async function call(action: "save-gap" | "generate-gap" | "approve-gap", body: Record<string, unknown> = {}) {
    const response = await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, planId, ...body }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "Could not update the gap report.");
    return data;
  }

  async function save(silent = false) {
    setBusy("save");
    try {
      await call("save-gap", {
        report: {
          ...report,
          patterns: report.patterns.filter(Boolean),
          topGaps: report.topGaps.filter((gap) => gap.label.trim()),
          cutCandidates: report.cutCandidates.filter(Boolean),
          anchorCandidates: report.anchorCandidates.filter(Boolean),
        },
      });
      if (!silent) toast("Gap report saved.");
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save.", "error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function regenerate() {
    setBusy("regenerate");
    try {
      const data = await call("generate-gap");
      if (data.report) {
        setReport({ ...EMPTY, ...data.report });
        toast("Gap report rebuilt from your audit.");
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not rebuild the report.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    setBusy("approve");
    try {
      const saved = await call("save-gap", {
        report: {
          ...report,
          patterns: report.patterns.filter(Boolean),
          topGaps: report.topGaps.filter((gap) => gap.label.trim()),
          cutCandidates: report.cutCandidates.filter(Boolean),
          anchorCandidates: report.anchorCandidates.filter(Boolean),
        },
      });
      if (!saved) throw new Error("Could not save the gap report.");
      await call("approve-gap");
      router.push("/reset/builder");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not approve the report.", "error");
      setBusy(null);
    }
  }

  function setField<K extends keyof GapReportDraft>(key: K, value: GapReportDraft[K]) {
    setReport((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="space-y-3.5">
      <section className="surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-violet-400/30 bg-violet-500/15 text-violet-200">
              <Target className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-[0.98rem] font-semibold text-white">The gap, on one screen</h2>
              <p className="text-[0.67rem] text-white/35">Quoted from your words. Edit anything before you approve it.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void regenerate()}
            disabled={busy !== null}
            className="btn btn-ghost text-[0.72rem]"
          >
            {busy === "regenerate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {hasDraft ? "Rebuild from audit" : "Build report"}
          </button>
        </div>

        {!hasDraft ? (
          <div className="mt-4 rounded-2xl border border-dashed border-violet-400/25 bg-violet-500/[0.05] px-4 py-8 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-violet-300/60" />
            <p className="mt-2 text-[0.88rem] font-medium text-white/70">Your audit is ready to become a gap report.</p>
            <p className="mt-1 text-[0.72rem] text-white/35">Build it from the three answers, then edit the lines that do not sound like you.</p>
            <button type="button" onClick={() => void regenerate()} disabled={busy !== null} className="btn btn-primary mt-3 text-[0.78rem]">
              {busy === "regenerate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Build my gap report
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <label className="block space-y-1.5">
              <span className="label flex items-center gap-1.5">
                <PencilLine className="h-3 w-3" /> The one-screen summary
              </span>
              <textarea
                value={report.summary}
                onChange={(event) => setField("summary", event.target.value)}
                rows={4}
                className="field resize-none text-[0.84rem] leading-relaxed"
              />
            </label>
            <p className="mt-1.5 text-[0.63rem] leading-relaxed text-white/30">
              The agent only quotes your audit. It does not diagnose, score your character or add facts.
            </p>
          </div>
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        {[
          { label: "Where I am", value: report.currentQuote || quotes.current, accent: "#f472b6" },
          { label: "Where I want to be", value: report.targetQuote || quotes.target, accent: "#38bdf8" },
          { label: "What got in the way", value: report.patternQuote || quotes.pattern, accent: "#fbbf24" },
        ].map((quote) => (
          <section key={quote.label} className="surface relative overflow-hidden p-3.5">
            <div
              className="absolute inset-x-0 top-0 h-0.5"
              style={{ background: `linear-gradient(90deg, ${quote.accent}, transparent)` }}
            />
            <p className="text-[0.58rem] font-bold uppercase tracking-[0.15em]" style={{ color: quote.accent }}>
              {quote.label}
            </p>
            <p className="mt-1.5 line-clamp-6 text-[0.74rem] leading-relaxed text-white/50">
              {quote.value ? `“${quote.value}”` : "Not answered yet."}
            </p>
          </section>
        ))}
      </div>

      {hasDraft && (
        <>
          <section className="surface p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-violet-300" />
              <h3 className="font-display text-[0.92rem] font-semibold text-white">Top gaps</h3>
              <span className="ml-auto text-[0.62rem] text-white/30">Edit the labels, keep the evidence</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {report.topGaps.map((gap, index) => (
                <div key={`${gap.label}-${index}`} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                  <input
                    value={gap.label}
                    onChange={(event) => {
                      const next = [...report.topGaps];
                      next[index] = { ...gap, label: event.target.value };
                      setField("topGaps", next);
                    }}
                    className="w-full bg-transparent font-display text-[0.82rem] font-semibold text-white outline-none"
                    aria-label={`Top gap ${index + 1}`}
                  />
                  <p className="mt-1 line-clamp-3 text-[0.68rem] leading-relaxed text-white/35">
                    {gap.evidence || "No quote yet."}
                  </p>
                </div>
              ))}
              {!report.topGaps.length && (
                <p className="text-[0.72rem] text-white/35">No focus areas found yet. Rebuild the report from the audit.</p>
              )}
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="surface p-4">
              <h3 className="font-display text-[0.9rem] font-semibold text-white">Patterns worth watching</h3>
              <p className="mt-0.5 text-[0.66rem] text-white/35">One per line. These are what the drift checks watch for.</p>
              <textarea
                value={report.patterns.join("\n")}
                onChange={(event) => setField("patterns", event.target.value.split("\n"))}
                rows={4}
                className="field mt-2 resize-none text-[0.78rem] leading-relaxed"
              />
            </section>

            <section className="surface p-4">
              <h3 className="font-display text-[0.9rem] font-semibold text-white">Cut candidates</h3>
              <p className="mt-0.5 text-[0.66rem] text-white/35">Up to three. One per line. You can change these in the plan builder.</p>
              <textarea
                value={report.cutCandidates.join("\n")}
                onChange={(event) => setField("cutCandidates", event.target.value.split("\n"))}
                rows={4}
                className="field mt-2 resize-none text-[0.78rem] leading-relaxed"
              />
            </section>
          </div>

          <section className="surface p-4">
            <h3 className="font-display text-[0.9rem] font-semibold text-white">Anchors that make the rest possible</h3>
            <p className="mt-0.5 text-[0.66rem] text-white/35">The same wake-up time and one finished task are the default pair.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {report.anchorCandidates.map((anchor, index) => (
                <span key={`${anchor}-${index}`} className="chip border-violet-400/20 bg-violet-500/[0.08] text-violet-100/80">
                  <CheckCircle2 className="h-3 w-3" /> {anchor}
                </span>
              ))}
            </div>
          </section>

          <div className="surface p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[0.72rem] font-semibold text-white/70">Recommended first focus</p>
                <p className="text-[0.65rem] text-white/35">This is where the plan builder starts. It is not a score.</p>
              </div>
              <span className="chip border-violet-400/25 bg-violet-500/10 text-violet-200">
                {report.recommendedFocus || "Consistency"}
              </span>
            </div>
            <p className="mt-2 text-[0.63rem] leading-relaxed text-white/30">{report.notes || "Keep the first month small enough to repeat."}</p>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy !== null || !hasDraft}
          className="btn btn-ghost text-[0.78rem]"
        >
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save draft
        </button>
        <button
          type="button"
          onClick={() => void approve()}
          disabled={busy !== null || !hasDraft}
          className="btn btn-primary text-[0.78rem]"
        >
          {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Approve gap report & build plan
        </button>
        <p className="w-full text-[0.63rem] leading-relaxed text-white/30 sm:ml-auto sm:w-auto">
          Nothing is written to the calendar on this screen.
        </p>
      </div>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </div>
  );
}
