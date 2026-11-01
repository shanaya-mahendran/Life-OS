"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Bot,
  CircleAlert,
  Loader2,
  RotateCcw,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";
import { withAlpha } from "@/lib/utils";
import { ChangeCard, PendingCard, type ChatChange } from "./ChangeCard";

interface PendingLike {
  kind: string;
  title?: string;
  minutes?: number;
  blocks?: unknown[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  changes?: ChatChange[];
  pending?: PendingLike | null;
  engine?: string;
  undone?: boolean;
  tone?: "normal" | "error";
}

interface ChatWorkspaceProps {
  initialMessages: ChatMessage[];
  timeZone: string;
  userName: string;
  engine: "deepseek" | "rules";
  model: string;
  usage: { used: number; budget: number };
  quickPrompts: string[];
}

function pendingSummary(pending: PendingLike): string {
  if (pending.kind === "plan") return `${pending.blocks?.length ?? 0} suggested blocks`;
  if (pending.title) return pending.title;
  return "This change";
}

function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return String(value);
}

function timeLabel(iso: string | undefined, timeZone: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));
}

export function ChatWorkspace({
  initialMessages,
  timeZone,
  userName,
  engine,
  model,
  usage,
  quickPrompts,
}: ChatWorkspaceProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [spend, setSpend] = useState(usage);
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const counter = useRef(0);

  const nextId = useCallback(() => {
    counter.current += 1;
    return `local-${counter.current}`;
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, sending]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(timer);
  }, [toast]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || sending) return;

      setMessages((current) => [...current, { id: nextId(), role: "user", content: text }]);
      setInput("");
      setSending(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
        const data = await response.json();

        if (!response.ok) {
          setMessages((current) => [
            ...current,
            {
              id: nextId(),
              role: "assistant",
              content: data.error ?? "I couldn't reach the calendar just now.",
              tone: "error",
            },
          ]);
          return;
        }

        setMessages((current) => [
          ...current,
          {
            id: data.logId ?? nextId(),
            role: "assistant",
            content: data.reply,
            changes: data.changes ?? [],
            pending: data.pending ?? null,
            engine: data.engine,
          },
        ]);
        setSpend({ used: data.monthTokens ?? spend.used, budget: data.tokenBudget ?? spend.budget });
        router.refresh();
      } catch {
        setMessages((current) => [
          ...current,
          {
            id: nextId(),
            role: "assistant",
            content: "The connection dropped mid-request. Nothing was saved — try again.",
            tone: "error",
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [nextId, router, sending, spend.budget, spend.used],
  );

  async function undoLast() {
    setUndoing(true);
    try {
      const response = await fetch("/api/undo", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setToast({ text: data.message ?? data.error ?? "Nothing to undo.", tone: "error" });
        return;
      }
      setMessages((current) => {
        const next = [...current];
        for (let index = next.length - 1; index >= 0; index -= 1) {
          if (next[index].changes?.length) {
            next[index] = { ...next[index], undone: true };
            break;
          }
        }
        return next;
      });
      setToast({ text: "Reverted your last change.", tone: "ok" });
      router.refresh();
    } catch {
      setToast({ text: "Could not undo just now.", tone: "error" });
    } finally {
      setUndoing(false);
    }
  }

  const allChanges = messages.flatMap((message) => message.changes ?? []);
  const usagePercent = spend.budget > 0 ? Math.min(100, Math.round((spend.used / spend.budget) * 100)) : 0;
  const empty = messages.length === 0;

  return (
    <div className="relative">
      {toast && (
        <div
          className={`fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 rounded-xl border px-3.5 py-2 text-[0.78rem] shadow-2xl backdrop-blur-xl lg:bottom-8 ${
            toast.tone === "ok"
              ? "border-emerald-400/25 bg-emerald-950/80 text-emerald-100"
              : "border-rose-400/30 bg-rose-950/80 text-rose-100"
          }`}
        >
          {toast.text}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="surface flex h-[calc(100dvh-11.5rem)] min-h-[32rem] flex-col overflow-hidden">
          <header className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
            <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
              <Bot className="h-4.5 w-4.5" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0d0920] bg-emerald-400" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-[0.95rem] font-semibold text-white">
                Mochi <span className="text-[0.7rem] font-medium text-violet-300 ml-1">· AI Wingman</span>
              </h2>
              <p className="text-[0.66rem] text-white/40">
                {engine === "deepseek" ? `Online · ${model}` : "Online · rules engine (no API key needed)"}
              </p>
            </div>
            <button
              onClick={() => void undoLast()}
              disabled={undoing}
              className="btn btn-ghost ml-auto px-2.5 py-1.5 text-[0.7rem]"
              title="Undo the last agent change"
            >
              {undoing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Undo last
            </button>
          </header>

          <div ref={scrollRef} className="scroll-thin flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-4">
            {empty && (
              <div className="mx-auto max-w-md py-8 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-violet-400/25 bg-violet-500/15 text-violet-200">
                  <Sparkles className="h-5 w-5 text-violet-300" />
                </span>
                <h3 className="mt-3 font-display text-[1.05rem] font-semibold text-white">
                  Hey {userName.split(" ")[0]}, I&apos;m Mochi! 👋
                </h3>
                <p className="mt-1 text-[0.78rem] leading-relaxed text-white/55">
                  Plan your day, reschedule the chaos, or just chat, vent, and joke around. I&apos;ve got your back across all 18 life domains.
                </p>
              </div>
            )}

            {messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div key={message.id} className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
                  {!isUser && (
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-500/85 to-indigo-600/85 text-white">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                  )}

                  <div className={`max-w-[86%] sm:max-w-[76%] ${isUser ? "items-end" : ""}`}>
                    <div
                      className={
                        isUser
                          ? "rounded-2xl rounded-br-md bg-gradient-to-br from-violet-600 to-indigo-600 px-3.5 py-2.5 text-[0.84rem] leading-relaxed text-white shadow-[0_12px_30px_-18px_rgba(124,92,255,0.95)]"
                          : message.tone === "error"
                            ? "rounded-2xl rounded-bl-md border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-[0.84rem] leading-relaxed text-rose-100"
                            : "rounded-2xl rounded-bl-md border border-white/[0.07] bg-white/[0.045] px-3.5 py-2.5 text-[0.84rem] leading-relaxed text-white/85"
                      }
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      {message.tone === "error" && (
                        <p className="mt-1 flex items-center gap-1 text-[0.68rem] text-rose-200/70">
                          <CircleAlert className="h-3 w-3" /> nothing was written
                        </p>
                      )}
                    </div>

                    {message.changes?.map((change, index) => (
                      <ChangeCard
                        key={`${message.id}-${index}`}
                        change={change}
                        timeZone={timeZone}
                        undone={message.undone}
                        busy={undoing}
                        onUndo={() => void undoLast()}
                      />
                    ))}

                    {message.pending && (
                      <PendingCard
                        summary={`${pendingSummary(message.pending)}${
                          message.pending.kind === "plan" ? "" : " would be saved"
                        }`}
                        detail="Protected time or an existing event is in the way."
                        busy={sending}
                        onConfirm={() => void send("Yes, save it")}
                        onDecline={() => void send("No, leave it as it was")}
                      />
                    )}

                    {!isUser && message.engine && (
                      <div className="mt-1 text-[0.58rem] uppercase tracking-[0.14em] text-white/30">
                        Mochi · {message.engine === "deepseek" ? "deepseek-chat" : "rules engine"}
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 text-[0.6rem] font-bold uppercase text-white/70">
                      {userName.slice(0, 2)}
                    </span>
                  )}
                </div>
              );
            })}

            {sending && (
              <div className="flex gap-2.5">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-500/85 to-indigo-600/85 text-white">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-white/[0.07] bg-white/[0.045] px-3.5 py-2.5">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-300/70"
                      style={{ animationDelay: `${dot * 120}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/[0.06] px-3 pb-3 pt-2.5 sm:px-4">
            <div className="scroll-thin mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => void send(prompt)}
                  disabled={sending}
                  className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.68rem] text-white/55 transition hover:border-violet-400/40 hover:text-white"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send(input);
              }}
              className="flex items-end gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] p-1.5 focus-within:border-violet-400/45"
            >
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send(input);
                  }
                }}
                rows={1}
                placeholder="Talk to Mochi — plan your day, reschedule, or just chat…"
                className="max-h-28 min-h-[2.1rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-[16px] sm:text-[0.84rem] text-white outline-none placeholder:text-white/30"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white transition disabled:opacity-40"
                aria-label="Send message"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </form>
            <p className="mt-1.5 px-1 text-[0.6rem] text-white/25">
              Enter sends · Shift+Enter adds a line · protected time always asks first
            </p>
          </div>
        </section>

        <aside className="hidden space-y-3 xl:block">
          <section className="surface p-3.5">
            <div className="label mb-2">Mochi engine</div>
            <div className="flex items-center gap-2">
              <span
                className="grid h-8 w-8 place-items-center rounded-lg"
                style={{
                  backgroundColor: engine === "deepseek" ? withAlpha("#8b5cf6", 0.2) : withAlpha("#22c55e", 0.16),
                  color: engine === "deepseek" ? "#c4b5fd" : "#86efac",
                }}
              >
                <Zap className="h-4 w-4" />
              </span>
              <div>
                <div className="text-[0.78rem] font-semibold text-white/85">
                  {engine === "deepseek" ? "DeepSeek online" : "Rules engine"}
                </div>
                <div className="text-[0.62rem] text-white/35">
                  {engine === "deepseek" ? model : "Deterministic, no API key"}
                </div>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-[0.62rem] text-white/35">
                <span>Monthly tokens</span>
                <span>
                  {compactNumber(spend.used)} / {compactNumber(spend.budget)}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400"
                  style={{ width: `${Math.max(2, usagePercent)}%` }}
                />
              </div>
              {usagePercent >= 100 && (
                <p className="mt-1.5 text-[0.62rem] text-amber-200/80">
                  Budget spent — chat keeps working in rules mode.
                </p>
              )}
            </div>
          </section>

          <section className="surface p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="label">Activity</span>
              <span className="text-[0.6rem] text-white/25">{allChanges.length} changes</span>
            </div>
            {allChanges.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/10 px-2.5 py-4 text-center text-[0.7rem] text-white/30">
                No changes yet in this session.
              </p>
            ) : (
              <ul className="scroll-thin max-h-[18rem] space-y-1 overflow-y-auto pr-0.5">
                {allChanges
                  .slice()
                  .reverse()
                  .slice(0, 12)
                  .map((change, index) => (
                    <li key={`${change.title}-${index}`} className="flex items-center gap-2 rounded-lg px-1.5 py-1">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: change.domainAccent }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[0.72rem] text-white/70">{change.title}</span>
                      <span className="shrink-0 text-[0.6rem] text-white/30">{change.action}</span>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          <section className="surface p-3.5">
            <div className="label mb-2">Try asking</div>
            <div className="space-y-1.5">
              {quickPrompts.slice(0, 4).map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => void send(prompt)}
                  disabled={sending}
                  className="w-full rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-2 text-left text-[0.72rem] text-white/60 transition hover:border-violet-400/35 hover:text-white"
                >
                  “{prompt}”
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] p-3">
            <div className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-emerald-100">
              <RotateCcw className="h-3.5 w-3.5" /> Everything is undoable
            </div>
            <p className="mt-1 text-[0.66rem] leading-relaxed text-emerald-100/60">
              Each write stores its inverse. “Undo last” restores the previous state exactly — including recurring blocks.
            </p>
          </section>

          <p className="px-1 text-[0.6rem] text-white/20">
            Current time in {timeZone.replace("_", " ")}: {timeLabel(new Date().toISOString(), timeZone)}
          </p>
        </aside>
      </div>
    </div>
  );
}
