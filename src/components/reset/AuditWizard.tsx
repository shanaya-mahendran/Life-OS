"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Cloud, Loader2, Sparkles } from "lucide-react";
import { AUDIT_STEPS } from "@/lib/reset/constants";
import { cn } from "@/lib/utils";

export function AuditWizard({
  planId,
  initialAnswers,
}: {
  planId: string;
  initialAnswers: Record<number, string>;
}) {
  const router = useRouter();
  const initialStep = AUDIT_STEPS.find((entry) => !(initialAnswers[entry.step] ?? "").trim())?.step ?? 3;
  const [step, setStep] = useState<number>(initialStep);
  const [answers, setAnswers] = useState<Record<number, string>>({
    1: initialAnswers[1] ?? "",
    2: initialAnswers[2] ?? "",
    3: initialAnswers[3] ?? "",
  });
  const [saved, setSaved] = useState<Record<number, string>>({
    1: initialAnswers[1] ?? "",
    2: initialAnswers[2] ?? "",
    3: initialAnswers[3] ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(false);

  const current = AUDIT_STEPS[step - 1];
  const value = answers[step] ?? "";
  const isSaved = (saved[step] ?? "").trim() === value.trim();

  async function save(stepToSave: number, answer: string): Promise<boolean> {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-audit", planId, step: stepToSave, answer }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Could not save that step.");
        return false;
      }
      setSaved((currentSaved) => ({ ...currentSaved, [stepToSave]: answer }));
      return true;
    } catch {
      setError("Network error — your answer is still here.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  // Save-as-you-go, debounced, once the answer is substantial enough to keep.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (value.trim().length < 10 || isSaved) return;
    const timer = setTimeout(() => {
      void save(step, value);
    }, 1400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, step]);

  async function next() {
    if (value.trim().length < 10) {
      setError("Write at least a short sentence so the gap report can quote you.");
      return;
    }
    setBusy(true);
    const ok = await save(step, value);
    if (!ok) {
      setBusy(false);
      return;
    }

    if (step < 3) {
      setStep(step + 1);
      setBusy(false);
      return;
    }

    try {
      const response = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-gap", planId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Could not build the gap report.");
        setBusy(false);
        return;
      }
      router.push("/reset/gap");
    } catch {
      setError("Could not build the gap report. Try again.");
      setBusy(false);
    }
  }

  return (
    <section className="surface relative overflow-hidden p-4 sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {AUDIT_STEPS.map((entry) => {
              const done = (saved[entry.step] ?? "").trim().length > 0;
              const active = entry.step === step;
              return (
                <button
                  key={entry.step}
                  type="button"
                  onClick={() => {
                    if (entry.step < step || done) setStep(entry.step);
                  }}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[0.65rem] font-semibold transition",
                    active
                      ? "border-violet-400/45 bg-violet-500/18 text-violet-100"
                      : done
                        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                        : "border-white/10 bg-white/[0.03] text-white/35",
                  )}
                >
                  {done && !active ? <Check className="h-3 w-3" /> : <span>{entry.step}</span>}
                  <span className="hidden sm:inline">{entry.step === 1 ? "Where I am" : entry.step === 2 ? "Target" : "Pattern"}</span>
                </button>
              );
            })}
          </div>
          <span className="flex items-center gap-1.5 text-[0.62rem] text-white/30">
            {saving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> saving…
              </>
            ) : isSaved && value.trim() ? (
              <>
                <Cloud className="h-3 w-3 text-emerald-300/70" /> saved
              </>
            ) : (
              "draft"
            )}
          </span>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400 transition-all"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <div className="mt-5 animate-[rise_0.25s_ease-out]">
          <p className="text-[0.61rem] font-bold uppercase tracking-[0.16em] text-violet-300/70">
            {current.eyebrow}
          </p>
          <h2 className="mt-1.5 font-display text-[1.3rem] font-semibold leading-tight text-white sm:text-[1.5rem]">
            {current.title}
          </h2>
          <p className="mt-1.5 max-w-2xl text-[0.8rem] leading-relaxed text-white/45">{current.prompt}</p>

          <textarea
            value={value}
            onChange={(event) => setAnswers((state) => ({ ...state, [step]: event.target.value }))}
            rows={7}
            autoFocus
            placeholder={current.placeholder}
            className="field mt-4 resize-none text-[0.85rem] leading-relaxed"
          />

          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="max-w-xl text-[0.65rem] leading-relaxed text-white/30">{current.hint}</p>
            <span className="text-[0.62rem] tabular-nums text-white/25">{value.length} chars</span>
          </div>

          {error && (
            <p className="mt-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[0.72rem] text-rose-200">
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                disabled={busy}
                className="btn btn-ghost text-[0.78rem]"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            <button
              type="button"
              onClick={() => void next()}
              disabled={busy || !value.trim()}
              className="btn btn-primary text-[0.78rem]"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : step === 3 ? (
                <Sparkles className="h-4 w-4" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {step === 3 ? "Build my gap report" : "Save & continue"}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (value.trim().length >= 10) await save(step, value);
                router.push("/today");
              }}
              disabled={busy}
              className="btn btn-quiet ml-auto text-[0.72rem] text-white/40"
            >
              Save & finish later
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
