"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Clock,
  Flame,
  Ghost,
  Lightbulb,
  Loader2,
  Lock,
  LockOpen,
  MessageCircleQuestion,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { cn, withAlpha } from "@/lib/utils";
import { DIARY_ACCENT, MODE_META, PERSONAS, type DiaryMode } from "@/lib/diary/constants";
import type { DiaryEntryView, DiarySessionView } from "@/lib/diary/service";
import { decryptBody, deriveKey, encryptBody, looksEncrypted } from "@/lib/diary/crypto";
import { gradientStyle } from "@/lib/diary/text";
import { StampRow, formatDiaryDate } from "./ui";

interface Echo {
  body: string;
  entryId: string;
  entryDate: string;
}

interface EntryEditorProps {
  entry: DiaryEntryView;
  sessions: DiarySessionView[];
  kept: { id: string; body: string }[];
  encryptionSalt: string;
  aiReady: boolean;
}

const MODE_ICON: Record<DiaryMode, typeof Wand2> = {
  alter_ego: Ghost,
  devils_advocate: MessageCircleQuestion,
  collaborator: Lightbulb,
};

export function EntryEditor({ entry, sessions, kept, encryptionSalt, aiReady }: EntryEditorProps) {
  const router = useRouter();
  const [body, setBody] = useState(looksEncrypted(entry.body) ? "" : entry.body);
  // Locked is a property of the entry, not of its current contents: a locked
  // entry stays behind the passphrase even while it is still empty.
  const [locked, setLocked] = useState(entry.encrypted);
  const [passphrase, setPassphrase] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [key, setKey] = useState<CryptoKey | null>(null);

  const [tags, setTags] = useState<string[]>(entry.tags);
  const [tagDraft, setTagDraft] = useState("");
  const [colors, setColors] = useState<[string, string]>(entry.colors);
  const [stamps, setStamps] = useState<string[]>(entry.stamps);
  const [silverLining, setSilverLining] = useState(entry.silverLining);
  const [silverDeleted, setSilverDeleted] = useState(entry.silverLiningDeleted);
  const [echo, setEcho] = useState<Echo | null>(null);

  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [notice, setNotice] = useState("");
  const [ambientBusy, setAmbientBusy] = useState(false);
  const [busyMode, setBusyMode] = useState<DiaryMode | null>(null);
  const [personaOpen, setPersonaOpen] = useState(false);
  const [sessionList, setSessionList] = useState(sessions);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const savedBody = useRef(entry.body);
  const savedTags = useRef(JSON.stringify(entry.tags));
  const ambientTried = useRef(Boolean(entry.ambientAt) || entry.ambientStatus === "failed" || entry.ambientStatus === "off");
  const ambientRunning = useRef(false);

  const dirty = body !== savedBody.current || JSON.stringify(tags) !== savedTags.current;

  const save = useCallback(async () => {
    if (locked && !key) return;
    if (!dirty) return;

    setSaving("saving");
    try {
      const payloadBody = key ? await encryptBody(key, body) : body;
      const response = await fetch(`/api/diary/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: payloadBody, tags }),
      });
      if (!response.ok) throw new Error("save failed");
      savedBody.current = body;
      savedTags.current = JSON.stringify(tags);
      setSaving("saved");
      setNotice("");
      window.setTimeout(() => setSaving("idle"), 1600);
    } catch {
      setSaving("idle");
      setNotice("Could not save just now. Your writing is still here — try again.");
    }
  }, [body, dirty, entry.id, key, locked, tags]);

  // Save-as-you-go: 1.2s after the last keystroke.
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => void save(), 1200);
    return () => window.clearTimeout(timer);
  }, [dirty, save]);

  const runAmbient = useCallback(
    async (force = false) => {
      if (ambientRunning.current) return;
      if (!force && ambientTried.current) return;
      ambientRunning.current = true;
      setAmbientBusy(true);

      try {
        await save();
        const response = await fetch(`/api/diary/entries/${entry.id}/ambient${force ? "?force=1" : ""}`, {
          method: "POST",
        });
        const data = (await response.json()) as {
          entry?: DiaryEntryView;
          message?: string;
          paused?: boolean;
          echo?: Echo | null;
        };
        if (data.entry) {
          setColors(data.entry.colors);
          setStamps(data.entry.stamps);
          if (data.entry.silverLining && !silverDeleted) setSilverLining(data.entry.silverLining);
          savedBody.current = body;
        }
        if (data.echo) setEcho(data.echo);
        if (data.message) setNotice(data.message);
        ambientTried.current = true;
      } catch {
        setNotice("The ambient layer is unavailable. Your entry is saved.");
      } finally {
        ambientRunning.current = false;
        setAmbientBusy(false);
      }
    },
    [body, entry.id, save, silverDeleted],
  );

  // Ambient fires once, on its own, a few seconds after the writing settles.
  useEffect(() => {
    if (locked || !aiReady) return;
    if (ambientTried.current || ambientBusy) return;
    if (body.trim().length < 60) return;
    const timer = window.setTimeout(() => void runAmbient(), 4000);
    return () => window.clearTimeout(timer);
  }, [aiReady, ambientBusy, body, locked, runAmbient]);

  async function unlock() {
    setUnlockError("");
    try {
      const derived = await deriveKey(passphrase, encryptionSalt);
      const plain = await decryptBody(derived, entry.body);
      if (plain === null) {
        setUnlockError("That passphrase does not open this entry.");
        return;
      }
      setKey(derived);
      setBody(plain);
      savedBody.current = plain;
      setLocked(false);
      setPassphrase("");
    } catch {
      setUnlockError("Unlocking is unavailable in this browser.");
    }
  }

  function addTag() {
    const tag = tagDraft.trim().replace(/^#/, "").slice(0, 24);
    if (!tag || tags.includes(tag) || tags.length >= 8) {
      setTagDraft("");
      return;
    }
    setTags([...tags, tag]);
    setTagDraft("");
  }

  async function startMode(mode: DiaryMode, persona?: string) {
    if (!aiReady) {
      setNotice("Diary AI is off in settings, so deep modes are unavailable.");
      return;
    }
    setBusyMode(mode);
    setNotice("");
    try {
      await save();
      const response = await fetch("/api/diary/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: entry.id, mode, persona }),
      });
      const data = (await response.json()) as { session?: DiarySessionView; message?: string };
      if (!response.ok || !data.session) {
        setNotice(data.message ?? "That mode could not open. Nothing was saved.");
        return;
      }
      router.push(`/diary/session/${data.session.id}`);
    } catch {
      setNotice("That mode could not open. Nothing was saved.");
    } finally {
      setBusyMode(null);
      setPersonaOpen(false);
    }
  }

  async function removeSession(id: string) {
    setSessionList((list) => list.filter((session) => session.id !== id));
    await fetch(`/api/diary/sessions/${id}`, { method: "DELETE" });
  }

  async function dismissSilver() {
    setSilverLining("");
    setSilverDeleted(true);
    await fetch(`/api/diary/entries/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ silverLining: "", silverLiningDeleted: true }),
    });
  }

  async function deleteEntry() {
    await fetch(`/api/diary/entries/${entry.id}`, { method: "DELETE" });
    router.push("/diary");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div
        className="overflow-hidden rounded-3xl border border-white/10"
        style={{ ...gradientStyle(colors), boxShadow: `0 30px 80px -50px ${withAlpha(DIARY_ACCENT, 0.5)}` }}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-black/20 px-4 py-2.5 backdrop-blur-sm">
          <Link href="/diary" className="text-[0.7rem] font-semibold text-white/45 transition hover:text-white/80">
            ← Journal
          </Link>
          <span className="text-[0.66rem] text-white/25">{formatDiaryDate(entry.createdAt)}</span>
          <div className="ml-auto flex items-center gap-1.5">
            {stamps.length > 0 && <StampRow stamps={stamps} size="sm" />}
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[0.6rem] text-white/40">
              <Clock className="h-3 w-3" /> {entry.minutes} min
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {locked ? (
            <div className="rounded-2xl border border-amber-400/25 bg-black/40 p-4">
              <div className="flex items-center gap-2 text-amber-200">
                <Lock className="h-4 w-4" />
                <p className="text-[0.82rem] font-semibold">This entry is locked</p>
              </div>
              <p className="mt-1 text-[0.72rem] leading-relaxed text-white/45">
                It was encrypted in your browser and the server only holds ciphertext. Enter your passphrase to read it.
                The ambient AI stays off for locked entries.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="password"
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void unlock();
                  }}
                  placeholder="Diary passphrase"
                  className="input flex-1"
                  autoComplete="off"
                />
                <button type="button" onClick={() => void unlock()} className="btn btn-primary justify-center text-[0.76rem]">
                  <LockOpen className="h-3.5 w-3.5" /> Unlock
                </button>
              </div>
              {unlockError && <p className="mt-2 text-[0.68rem] text-rose-300">{unlockError}</p>}
            </div>
          ) : (
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onBlur={() => void save()}
              placeholder="Start anywhere. A sentence, a fragment, a list. Nobody else reads this."
              className="min-h-[46vh] w-full resize-y rounded-2xl border border-white/10 bg-black/25 p-3.5 font-serif text-[0.95rem] leading-[1.75] text-white/85 outline-none backdrop-blur-sm placeholder:text-white/25 focus:border-white/25"
              spellCheck
            />
          )}

          {!locked && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[0.62rem] text-white/30">
                {saving === "saving" ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> saving
                  </>
                ) : saving === "saved" ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-300" /> saved
                  </>
                ) : (
                  <>{entry.words} words · autosaved</>
                )}
              </span>

              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[0.62rem] text-white/55"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((item) => item !== tag))}
                      className="text-white/30 transition hover:text-rose-300"
                      aria-label={`Remove ${tag}`}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                <input
                  value={tagDraft}
                  onChange={(event) => setTagDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === ",") {
                      event.preventDefault();
                      addTag();
                    }
                  }}
                  onBlur={addTag}
                  placeholder="+ tag"
                  className="w-[4.5rem] rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[0.62rem] text-white/60 outline-none placeholder:text-white/25"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {notice && (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-500/[0.08] px-3.5 py-2.5 text-[0.72rem] leading-relaxed text-amber-100/80">
          {notice}
        </div>
      )}

      {!silverDeleted && (silverLining || ambientBusy) && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-200/70" />
          <div className="min-w-0 flex-1">
            <p className="text-[0.55rem] font-bold uppercase tracking-[0.14em] text-white/30">Silver lining</p>
            {ambientBusy && !silverLining ? (
              <p className="mt-1 text-[0.74rem] text-white/30">reading the entry…</p>
            ) : (
              <input
                value={silverLining}
                onChange={(event) => setSilverLining(event.target.value)}
                onBlur={() =>
                  void fetch(`/api/diary/entries/${entry.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ silverLining }),
                  })
                }
                className="mt-1 w-full bg-transparent font-serif text-[0.82rem] italic text-white/70 outline-none"
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => void dismissSilver()}
            className="rounded-lg p-1 text-white/25 transition hover:text-rose-300"
            aria-label="Delete the silver lining"
            title="Delete for this entry — it will not come back"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {echo && (
        <div className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.07] p-3.5">
          <div className="flex items-center gap-2">
            <Ghost className="h-3.5 w-3.5 text-violet-300" />
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-violet-200/80">A blind spot, maybe</p>
            <button
              type="button"
              onClick={() => setEcho(null)}
              className="ml-auto text-[0.62rem] text-white/30 hover:text-white/70"
            >
              not now
            </button>
          </div>
          <p className="mt-1.5 font-serif text-[0.8rem] italic leading-relaxed text-white/55">“{echo.body}”</p>
          <Link href={`/diary/entry/${echo.entryId}`} className="mt-1.5 inline-block text-[0.66rem] font-semibold text-violet-300">
            You wrote this on {echo.entryDate} →
          </Link>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(MODE_META) as DiaryMode[]).map((mode) => {
          const meta = MODE_META[mode];
          const Icon = MODE_ICON[mode];
          return (
            <button
              key={mode}
              type="button"
              disabled={busyMode !== null || locked}
              onClick={() => (mode === "alter_ego" ? setPersonaOpen((open) => !open) : void startMode(mode))}
              className={cn(
                "group min-h-[44px] rounded-2xl border p-3 text-left transition disabled:opacity-40",
                "border-white/[0.08] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]",
              )}
            >
              <span className="flex items-center gap-1.5 text-[0.74rem] font-semibold text-white/80">
                {busyMode === mode ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" style={{ color: meta.accent }} />}
                {meta.label}
              </span>
              <span className="mt-1 block text-[0.64rem] leading-relaxed text-white/35">{meta.blurb}</span>
            </button>
          );
        })}
      </div>

      {personaOpen && (
        <div className="rounded-2xl border border-violet-400/25 bg-violet-500/[0.06] p-3">
          <p className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-violet-200/70">
            Choose a mirror · {MODE_META.alter_ego.turns} turns
          </p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {PERSONAS.map((persona) => (
              <button
                key={persona.id}
                type="button"
                disabled={busyMode !== null}
                onClick={() => void startMode("alter_ego", persona.id)}
                className="rounded-xl border border-white/10 bg-black/25 px-2.5 py-2 text-left transition hover:border-violet-300/40 hover:bg-violet-500/10 disabled:opacity-40"
              >
                <span className="block text-[0.74rem] font-semibold text-white/85">{persona.name}</span>
                <span className="block text-[0.62rem] text-white/35">{persona.tagline}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setPersonaOpen(false)} className="mt-2 text-[0.65rem] text-white/35 hover:text-white/70">
            Cancel
          </button>
        </div>
      )}

      {kept.length > 0 && (
        <section className="surface p-4">
          <h2 className="flex items-center gap-1.5 font-display text-[0.9rem] font-semibold text-white">
            <Lightbulb className="h-3.5 w-3.5 text-emerald-300" /> Kept from this entry
          </h2>
          <ul className="mt-2 space-y-1.5">
            {kept.map((item) => (
              <li key={item.id} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[0.74rem] leading-relaxed text-white/55">
                {item.body}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sessionList.length > 0 && (
        <section className="surface p-4">
          <h2 className="font-display text-[0.9rem] font-semibold text-white">Saved sessions</h2>
          <ul className="mt-2 space-y-1.5">
            {sessionList.map((session) => (
              <li key={session.id} className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2">
                <span className="text-[0.72rem] font-semibold text-white/70">{MODE_META[session.mode].label}</span>
                <span className="text-[0.62rem] text-white/30">
                  {session.turns.length} turns · {session.status}
                </span>
                <Link href={`/diary/session/${session.id}`} className="ml-auto text-[0.65rem] font-semibold text-violet-300">
                  Open
                </Link>
                <button
                  type="button"
                  onClick={() => void removeSession(session.id)}
                  className="text-white/25 transition hover:text-rose-300"
                  aria-label="Delete transcript"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5">
        <Flame className="h-3.5 w-3.5 text-amber-200/60" />
        <p className="text-[0.66rem] text-white/35">A diary mirror, not a therapist. Nothing here diagnoses or advises.</p>
        <div className="ml-auto flex items-center gap-2">
          {confirmDelete ? (
            <>
              <button type="button" onClick={() => void deleteEntry()} className="text-[0.68rem] font-semibold text-rose-300">
                Delete for good
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="text-[0.68rem] text-white/40">
                Keep
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1 text-[0.68rem] text-white/35 transition hover:text-rose-300"
            >
              <Trash2 className="h-3 w-3" /> Delete entry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
