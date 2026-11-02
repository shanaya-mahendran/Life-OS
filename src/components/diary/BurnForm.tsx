"use client";

import { useState } from "react";
import { CheckCircle2, Flame, Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface BurnFormProps {
  burns: { id: string; takeaway: string; createdAt: string }[];
}

export function BurnForm({ burns }: BurnFormProps) {
  const [text, setText] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [takeaway, setTakeaway] = useState<{ text: string; paused: boolean } | null>(null);
  const [history, setHistory] = useState(burns);
  const [error, setError] = useState("");

  async function burn() {
    if (!text.trim() || !understood || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/diary/burn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await response.json()) as { takeaway?: string; paused?: boolean; error?: string };
      if (!response.ok || !data.takeaway) {
        setError(data.error ?? "That did not go through. Your text is still in the box.");
        return;
      }
      setTakeaway({ text: data.takeaway, paused: Boolean(data.paused) });
      setHistory([
        { id: crypto.randomUUID(), takeaway: data.takeaway, createdAt: new Date().toISOString() },
        ...history,
      ]);
      setText("");
      setUnderstood(false);
    } catch {
      setError("That did not go through. Your text is still in the box.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-3xl border border-rose-400/20 bg-[linear-gradient(150deg,rgba(60,16,30,0.65),rgba(10,6,14,0.96))] p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl border border-rose-400/30 bg-rose-500/15 text-rose-200">
            <Flame className="h-4 w-4" />
          </span>
          <div>
            <h1 className="font-display text-[1.05rem] font-bold text-white">Burn Diary</h1>
            <p className="text-[0.66rem] text-white/40">Write it, send it, lose it. Only the takeaway remains.</p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-rose-400/20 bg-black/30 p-3">
          <p className="flex items-start gap-1.5 text-[0.68rem] leading-relaxed text-rose-100/70">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Nothing you type here is saved. It is sent in one request, turned into a single takeaway, and the original text is
            never written to the database. There is no undo and no copy.
          </p>
        </div>

        {takeaway ? (
          <div className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-400/[0.08] p-4">
            <p className="text-[0.55rem] font-bold uppercase tracking-[0.16em] text-amber-200/70">What you keep</p>
            <p className="mt-1.5 font-serif text-[0.92rem] leading-relaxed text-white/80">{takeaway.text}</p>
            {takeaway.paused && (
              <p className="mt-2 text-[0.66rem] leading-relaxed text-rose-200/70">
                The diary AI is paused for today after what you wrote. Nothing else will be analysed today.
              </p>
            )}
            <button
              type="button"
              onClick={() => setTakeaway(null)}
              className="btn btn-ghost mt-3 min-h-[36px] text-[0.7rem]"
            >
              Burn another
            </button>
          </div>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Whatever it is. Say it plainly — it will not survive this screen."
              rows={8}
              className="mt-3 w-full resize-y rounded-2xl border border-white/10 bg-black/40 p-3.5 font-serif text-[0.9rem] leading-[1.7] text-white/85 outline-none placeholder:text-white/20 focus:border-rose-300/30"
            />

            <label className="mt-2.5 flex cursor-pointer items-start gap-2 text-[0.68rem] leading-relaxed text-white/45">
              <input
                type="checkbox"
                checked={understood}
                onChange={(event) => setUnderstood(event.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-rose-400"
              />
              I understand the original text is deleted immediately and only the takeaway is kept.
            </label>

            {error && <p className="mt-2 text-[0.68rem] text-rose-300">{error}</p>}

            <button
              type="button"
              onClick={() => void burn()}
              disabled={!text.trim() || !understood || busy}
              className={cn(
                "mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border text-[0.78rem] font-semibold transition sm:w-auto sm:px-5",
                text.trim() && understood
                  ? "border-rose-400/40 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
                  : "border-white/10 bg-white/[0.03] text-white/30",
              )}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
              {busy ? "Burning…" : "Burn it"}
            </button>
          </>
        )}
      </div>

      <section className="surface p-4">
        <h2 className="font-display text-[0.92rem] font-semibold text-white">Takeaways kept</h2>
        <p className="mt-0.5 text-[0.66rem] text-white/30">Only these lines ever existed in the database.</p>
        {history.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-[0.72rem] text-white/30">
            Nothing burned yet. This list stays empty until you need it.
          </p>
        ) : (
          <ul className="mt-2.5 space-y-1.5">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-start gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-amber-200/60" />
                <div>
                  <p className="font-serif text-[0.78rem] leading-relaxed text-white/65">{entry.takeaway}</p>
                  <p className="mt-0.5 text-[0.58rem] text-white/25">
                    {new Date(entry.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
