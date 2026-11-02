"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

type Action = "start" | "new-cycle" | "resume" | "pause" | "complete";

const ICONS: Record<Action, typeof RotateCcw> = {
  start: RotateCcw,
  "new-cycle": RotateCcw,
  resume: Play,
  pause: Pause,
  complete: Pause,
};

export function PlanActionButton({
  action,
  planId,
  label,
  busyLabel = "Working…",
  redirectTo,
  className,
  tone = "primary",
}: {
  action: Action;
  planId?: string;
  label: string;
  busyLabel?: string;
  redirectTo?: string;
  className?: string;
  tone?: "primary" | "ghost";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const Icon = ICONS[action];

  async function run() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(planId ? { planId } : {}) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Could not update the plan.");
        return;
      }
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className={cn("btn w-full justify-center", tone === "primary" ? "btn-primary" : "btn-ghost")}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
        {busy ? busyLabel : label}
      </button>
      {error && (
        <p className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-2.5 py-1.5 text-[0.68rem] text-rose-200">
          {error}
        </p>
      )}
    </div>
  );
}
