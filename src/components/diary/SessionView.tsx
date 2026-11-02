"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Pin, Send, Square, Trash2 } from "lucide-react";
import { MODE_META, personaById } from "@/lib/diary/constants";
import type { DiarySessionView } from "@/lib/diary/service";
import { cn, withAlpha } from "@/lib/utils";

interface SessionViewProps {
  session: DiarySessionView;
  entryDate: string;
}

interface Seed {
  kind: string;
  text: string;
  kept: boolean;
}

const SEED_LABEL: Record<string, string> = {
  twist: "A twist",
  detail: "A missing detail",
  reference: "A reference",
};

export function SessionView({ session, entryDate }: SessionViewProps) {
  const router = useRouter();
  const meta = MODE_META[session.mode];
  const [turns, setTurns] = useState(session.turns);
  const [status, setStatus] = useState(session.status);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");

  const [cards, setCards] = useState<Seed[]>(() =>
    session.mode === "alter_ego"
      ? []
      : session.turns
          .filter((turn) => turn.role === "coach")
          .map((turn) => {
            try {
              const parsed = JSON.parse(turn.content) as { quote?: string; question?: string; kind?: string; text?: string };
              if (session.mode === "devils_advocate") {
                return { kind: "pattern", text: parsed.question ?? turn.content, kept: false };
              }
              return { kind: parsed.kind ?? "twist", text: parsed.text ?? turn.content, kept: false };
            } catch {
              return { kind: session.mode === "devils_advocate" ? "pattern" : "twist", text: turn.content, kept: false };
            }
          }),
  );

  const userTurns = turns.filter((turn) => turn.role === "user").length;
  const remaining = Math.max(0, session.maxTurns - userTurns);

  async function send() {
    const text = draft.trim();
    if (!text || sending || status !== "active") return;

    setSending(true);
    setNotice("");
    try {
      const response = await fetch(`/api/diary/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "turn", content: text }),
      });
      const data = (await response.json()) as { session?: DiarySessionView; ended?: boolean; message?: string };
      if (data.session) {
        setTurns(data.session.turns);
        setStatus(data.session.status);
        setDraft("");
      }
      if (data.message) setNotice(data.message);
    } catch {
      setNotice("That message could not be sent. Nothing was lost.");
    } finally {
      setSending(false);
    }
  }

  async function endSession() {
    setSending(true);
    try {
      const response = await fetch(`/api/diary/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end" }),
      });
      const data = (await response.json()) as { session?: DiarySessionView };
      if (data.session) setStatus(data.session.status);
    } finally {
      setSending(false);
    }
  }

  async function deleteSession() {
    await fetch(`/api/diary/sessions/${session.id}`, { method: "DELETE" });
    router.push(`/diary/entry/${session.entryId}`);
    router.refresh();
  }

  async function keepCard(index: number) {
    const card = cards[index];
    setCards((list) => list.map((item, itemIndex) => (itemIndex === index ? { ...item, kept: true } : item)));
    await fetch("/api/diary/artifacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId: session.entryId, text: card.text, kind: card.kind }),
    });
  }

  const persona = personaById(session.persona);

  return (
    <div className="space-y-3">
      <div
        className="rounded-3xl border p-4"
        style={{
          borderColor: withAlpha(meta.accent, 0.28),
          background: `linear-gradient(140deg, ${withAlpha(meta.accent, 0.14)}, rgba(10,7,20,0.95) 65%)`,
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/diary/entry/${session.entryId}`}
            className="inline-flex items-center gap-1 text-[0.7rem] font-semibold text-white/50 transition hover:text-white/85"
          >
            <ArrowLeft className="h-3 w-3" /> Entry
          </Link>
          <span className="text-[0.66rem] text-white/25">{entryDate}</span>
          <span
            className="ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-[0.12em]"
            style={{ borderColor: withAlpha(meta.accent, 0.35), backgroundColor: withAlpha(meta.accent, 0.12), color: meta.accent }}
          >
            {status === "ended" ? "Ended" : `${remaining} turns left`}
          </span>
        </div>

        <h1 className="mt-2 font-display text-[1.1rem] font-bold text-white">
          {meta.label}
          {session.mode === "alter_ego" && <span className="text-white/45"> · {persona.name}</span>}
        </h1>
        <p className="mt-1 text-[0.7rem] leading-relaxed text-white/40">{meta.blurb}</p>
        <p className="mt-2 text-[0.62rem] leading-relaxed text-white/25">
          A creative mirror, not a real person and not a professional. It quotes your entry back and asks more than it asserts.
        </p>
      </div>

      {session.mode === "alter_ego" ? (
        <div className="space-y-2">
          {turns.map((turn, index) => (
            <div
              key={`${turn.at}-${index}`}
              className={cn(
                "max-w-[92%] rounded-2xl border px-3.5 py-2.5 text-[0.8rem] leading-relaxed",
                turn.role === "user"
                  ? "ml-auto border-violet-400/25 bg-violet-500/15 text-white/80"
                  : "border-white/10 bg-white/[0.04] font-serif text-white/70",
              )}
            >
              {turn.content}
            </div>
          ))}

          {status === "active" ? (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-2.5">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void send();
                }}
                placeholder="Answer in a sentence or two…"
                rows={3}
                className="w-full resize-none bg-transparent px-1 text-[0.8rem] leading-relaxed text-white/80 outline-none placeholder:text-white/25"
              />
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={sending || !draft.trim()}
                  className="btn btn-primary min-h-[38px] justify-center px-3 text-[0.72rem] disabled:opacity-40"
                >
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send
                </button>
                <button
                  type="button"
                  onClick={() => void endSession()}
                  disabled={sending}
                  className="btn btn-quiet min-h-[38px] text-[0.7rem]"
                >
                  <Square className="h-3 w-3" /> End here
                </button>
                <span className="ml-auto text-[0.6rem] text-white/25">⌘↵ to send</span>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-center">
              <p className="text-[0.76rem] font-semibold text-white/70">Session ended</p>
              <p className="mt-1 text-[0.68rem] text-white/35">
                The transcript is saved until you delete it. Nothing else runs on its own.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-2">
          {cards.map((card, index) => (
            <div
              key={`${card.kind}-${index}`}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5"
              style={{ borderLeft: `3px solid ${withAlpha(meta.accent, 0.6)}` }}
            >
              <p className="text-[0.55rem] font-bold uppercase tracking-[0.14em]" style={{ color: withAlpha(meta.accent, 0.8) }}>
                {SEED_LABEL[card.kind] ?? "Offer"}
              </p>
              <p className="mt-1 font-serif text-[0.82rem] leading-relaxed text-white/70">{card.text}</p>
              <button
                type="button"
                onClick={() => void keepCard(index)}
                disabled={card.kept}
                className="mt-2 inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[0.64rem] font-semibold text-white/50 transition hover:border-emerald-300/40 hover:text-emerald-200 disabled:opacity-60"
              >
                {card.kept ? <Check className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                {card.kept ? "Kept on the entry" : "Keep on the entry"}
              </button>
            </div>
          ))}
          {cards.length === 0 && (
            <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-[0.74rem] text-white/35">
              Nothing came back this time.
            </p>
          )}
        </div>
      )}

      {notice && (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-500/[0.08] px-3.5 py-2.5 text-[0.72rem] leading-relaxed text-amber-100/80">
          {notice}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => void deleteSession()}
          className="inline-flex items-center gap-1 text-[0.68rem] text-white/35 transition hover:text-rose-300"
        >
          <Trash2 className="h-3 w-3" /> Delete transcript
        </button>
        <Link href={`/diary/entry/${session.entryId}`} className="ml-auto text-[0.68rem] font-semibold text-violet-300">
          Back to the entry →
        </Link>
      </div>
    </div>
  );
}
