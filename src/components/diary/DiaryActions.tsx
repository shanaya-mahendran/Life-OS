"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PenLine, X } from "lucide-react";

/** Creates a fresh entry and opens the editor. */
export function NewEntryButton({ label = "Write today", className }: { label?: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function create() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/diary/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "" }),
      });
      const data = (await response.json()) as { entry?: { id: string }; error?: string };
      if (data.entry) {
        router.push(`/diary/entry/${data.entry.id}`);
        return;
      }
      setBusy(false);
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void create()}
      disabled={busy}
      className={className ?? "btn btn-primary min-h-[40px] justify-center text-[0.76rem]"}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

/** Dismisses a trend card or blind-spot suggestion. */
export function DismissArtifact({ id }: { id: string }) {
  const router = useRouter();
  const [gone, setGone] = useState(false);
  if (gone) return null;

  return (
    <button
      type="button"
      onClick={() => {
        setGone(true);
        void fetch(`/api/diary/artifacts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "dismissed" }),
        }).then(() => router.refresh());
      }}
      className="rounded-lg p-1 text-white/25 transition hover:text-white/70"
      aria-label="Dismiss"
      title="Dismiss"
    >
      <X className="h-3 w-3" />
    </button>
  );
}

export function DeleteArtifact({ id, redirectTo }: { id: string; redirectTo?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/diary/artifacts/${id}`, { method: "DELETE" });
        if (redirectTo) router.push(redirectTo);
        router.refresh();
        setBusy(false);
      }}
      className="text-[0.65rem] text-white/30 transition hover:text-rose-300"
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
