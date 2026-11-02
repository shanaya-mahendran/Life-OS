"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";
import { withAlpha } from "@/lib/utils";

let toastId = 0;

export function PhaseAdvanceCard({
  planId,
  phase,
  phaseName,
  nextPhase,
  nextPhaseName,
  day,
  nextCommitments,
  opensOn,
}: {
  planId: string;
  phase: number;
  phaseName: string;
  nextPhase: number;
  nextPhaseName: string;
  day: number;
  nextCommitments: number;
  opensOn: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [conflicts, setConflicts] = useState<{ message: string }[] | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const accent = nextPhase === 2 ? "#38bdf8" : "#34d399";

  function toast(text: string, tone: "success" | "error" = "success") {
    toastId += 1;
    setToasts((current) => [...current, { id: toastId, text, tone }]);
  }

  async function advance(force = false) {
    setBusy(true);
    try {
      const response = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advance", planId, force }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.requiresConfirmation) {
          setConflicts(data.conflicts ?? []);
          return;
        }
        toast(data.error ?? "Could not move to the next phase.", "error");
        return;
      }
      setConflicts(null);
      toast(`${nextPhaseName} is open. ${data.created} block${data.created === 1 ? "" : "s"} booked.`);
      router.refresh();
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="surface relative overflow-hidden p-4"
      style={{
        borderColor: withAlpha(accent, 0.24),
        background: `linear-gradient(140deg, ${withAlpha(accent, 0.12)}, rgba(15,11,28,0.92) 70%)`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full blur-3xl"
        style={{ backgroundColor: withAlpha(accent, 0.16) }}
      />
      <div className="relative">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.12em]"
          style={{ borderColor: withAlpha(accent, 0.3), backgroundColor: withAlpha(accent, 0.1), color: accent }}
        >
          <Sparkles className="h-3 w-3" /> Phase proposal
        </span>
        <h2 className="mt-2 font-display text-[0.98rem] font-semibold text-white">
          {day >= opensOn ? `${phaseName} is complete.` : `${nextPhaseName} opens on day ${opensOn + 1}.`}
        </h2>
        <p className="mt-1 text-[0.7rem] leading-relaxed text-white/40">
          {day >= opensOn
            ? `Move into ${nextPhaseName} when you are ready. The next phase's blocks are booked only after this yes, and the change can be undone.`
            : `You are on day ${day}. Keep the current rhythm; nothing moves early.`}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {nextCommitments > 0 ? (
            <button
              type="button"
              onClick={() => void advance()}
              disabled={busy || day < opensOn}
              className="btn btn-primary text-[0.74rem]"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
              Move to {nextPhaseName}
            </button>
          ) : (
            <Link href="/reset/builder" className="btn btn-primary text-[0.74rem]">
              Add {nextPhaseName} commitments first
            </Link>
          )}
          <span className="text-[0.62rem] text-white/25">
            {nextCommitments} commitment{nextCommitments === 1 ? "" : "s"} ready
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[0.62rem] text-white/30">
          <Check className="h-3 w-3 text-emerald-300/60" />
          Staying in {phaseName} is always allowed. Missing a phase target never locks you out.
        </div>
      </div>

      <Modal
        open={Boolean(conflicts)}
        onClose={() => setConflicts(null)}
        title="The next phase needs a yes"
        subtitle="These blocks conflict with the existing calendar."
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConflicts(null)} className="btn btn-ghost text-[0.76rem]">
              Stay here for now
            </button>
            <button
              type="button"
              onClick={() => void advance(true)}
              disabled={busy}
              className="btn btn-primary text-[0.76rem]"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Book anyway
            </button>
          </div>
        }
      >
        <ul className="space-y-2">
          {(conflicts ?? []).map((conflict, index) => (
            <li
              key={`${conflict.message}-${index}`}
              className="flex gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2"
            >
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
              <span className="text-[0.72rem] leading-relaxed text-amber-100/75">{conflict.message}</span>
            </li>
          ))}
        </ul>
      </Modal>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </section>
  );
}
