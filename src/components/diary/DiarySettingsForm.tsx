"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, Loader2, Lock, LockOpen, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { newSalt } from "@/lib/diary/crypto";
import type { DiarySettingsView } from "@/lib/diary/service";

interface Props {
  settings: DiarySettingsView;
}

function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 transition",
        disabled ? "opacity-50" : "hover:border-white/15",
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "mt-0.5 h-5 w-9 shrink-0 rounded-full border transition",
          checked ? "border-emerald-400/40 bg-emerald-500/60" : "border-white/15 bg-white/10",
        )}
      >
        <span
          className={cn(
            "block h-3.5 w-3.5 translate-y-[2px] rounded-full bg-white transition",
            checked ? "translate-x-[18px]" : "translate-x-[3px]",
          )}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-[0.78rem] font-semibold text-white/85">{label}</span>
        <span className="mt-0.5 block text-[0.66rem] leading-relaxed text-white/35">{description}</span>
      </span>
    </div>
  );
}

export function DiarySettingsForm({ settings }: Props) {
  const router = useRouter();
  const [current, setCurrent] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [hint, setHint] = useState(settings.recoveryHint);
  const [encryptError, setEncryptError] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/diary/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { settings?: DiarySettingsView; error?: string };
      if (data.settings) setCurrent(data.settings);
      else setNotice(data.error ?? "Could not save that setting.");
    } catch {
      setNotice("Could not save that setting. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function enableEncryption() {
    setEncryptError("");
    if (passphrase.length < 8) {
      setEncryptError("Use at least 8 characters. A phrase you can remember is fine.");
      return;
    }
    if (passphrase !== confirm) {
      setEncryptError("The two passphrases do not match.");
      return;
    }
    await patch({ encryptionOn: true, encryptionSalt: newSalt(), recoveryHint: hint.slice(0, 120) });
    setPassphrase("");
    setConfirm("");
  }

  async function deleteEverything() {
    if (deleteConfirm !== "delete") return;
    setDeleting(true);
    try {
      await fetch("/api/diary/settings", { method: "DELETE" });
      setDeleteConfirm("");
      setNotice("Your diary was deleted.");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      <section className="surface p-4">
        <h2 className="font-display text-[0.92rem] font-semibold text-white">Ambient layer</h2>
        <p className="mt-0.5 text-[0.66rem] leading-relaxed text-white/30">
          One small structured call per entry, cached. It never speaks; it only colours the page, adds three stamps and writes
          one silver lining.
        </p>
        <div className="mt-3 space-y-2">
          <Toggle
            checked={current.ambientOn}
            onChange={(value) => void patch({ ambientOn: value })}
            label="Colours, stamps and silver lining"
            description="Off means entries save with a neutral page and no stamps."
          />
          <Toggle
            checked={current.sparkOn}
            onChange={(value) => void patch({ sparkOn: value })}
            label="Daily spark"
            description="A single prompt instead of a blank page. Never repeats within 14 days."
          />
          <Toggle
            checked={current.trendsOn}
            onChange={(value) => void patch({ trendsOn: value })}
            label="Weekly trend cards"
            description="Reads metadata only — dates, lengths, tags, stamps. Never your words."
          />
          <Toggle
            checked={current.sendTextToAi}
            onChange={(value) => void patch({ sendTextToAi: value })}
            label="Send entry text to the model"
            description="Off makes the diary work fully offline: no colours, no stamps, no deep modes, no stories."
          />
        </div>
        {!current.aiConfigured && (
          <p className="mt-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-3 py-2 text-[0.66rem] leading-relaxed text-amber-100/70">
            No model key is configured on this deployment yet. Entries save exactly as written, the page stays neutral and deep
            modes stay closed. Set GROQ_API_KEY (or DIARY_MODEL) to switch the quiet layer on.
          </p>
        )}
        {current.pausedUntil && new Date(current.pausedUntil) > new Date() && (
          <p className="mt-2 rounded-xl border border-rose-400/25 bg-rose-500/[0.08] px-3 py-2 text-[0.66rem] leading-relaxed text-rose-100/75">
            Diary AI is paused until {new Date(current.pausedUntil).toLocaleString()}. This happens after an entry that
            mentioned serious distress. Writing still works.
          </p>
        )}
      </section>

      <section className="surface p-4">
        <h2 className="flex items-center gap-1.5 font-display text-[0.92rem] font-semibold text-white">
          {current.encryptionOn ? <Lock className="h-3.5 w-3.5 text-amber-300" /> : <LockOpen className="h-3.5 w-3.5 text-white/40" />}
          Locking entries
        </h2>
        <p className="mt-0.5 text-[0.66rem] leading-relaxed text-white/30">
          With locking on, new entries are encrypted in this browser before they are sent. The server stores ciphertext, and the
          AI layer cannot read a locked entry. Your passphrase is never stored anywhere.
        </p>

        {current.encryptionOn ? (
          <div className="mt-3 space-y-2">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] px-3 py-2">
              <p className="text-[0.72rem] font-semibold text-emerald-200/90">Locking is on</p>
              <p className="mt-0.5 text-[0.64rem] leading-relaxed text-emerald-100/60">
                {current.recoveryHint ? `Your hint: “${current.recoveryHint}”` : "You did not set a hint."} If you lose the
                passphrase, the locked entries cannot be recovered — not by you, not by support.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void patch({ encryptionOn: false })}
              className="btn btn-quiet min-h-[36px] text-[0.7rem]"
            >
              Stop locking new entries
            </button>
            <p className="text-[0.62rem] leading-relaxed text-white/25">
              Existing locked entries stay locked until you unlock and delete them.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <input
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="New passphrase (8+ characters)"
              className="input"
              autoComplete="new-password"
            />
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Repeat the passphrase"
              className="input"
              autoComplete="new-password"
            />
            <input
              value={hint}
              onChange={(event) => setHint(event.target.value)}
              placeholder="Optional hint (stored as plain text — keep it vague)"
              className="input"
            />
            {encryptError && <p className="text-[0.68rem] text-rose-300">{encryptError}</p>}
            <button
              type="button"
              disabled={busy}
              onClick={() => void enableEncryption()}
              className="btn btn-primary min-h-[38px] justify-center text-[0.74rem]"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />} Turn on locking
            </button>
          </div>
        )}
      </section>

      <section className="surface p-4">
        <h2 className="font-display text-[0.92rem] font-semibold text-white">Your data</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <a href="/api/diary/export" className="btn btn-ghost min-h-[38px] text-[0.72rem]">
            <Download className="h-3.5 w-3.5" /> Export everything
          </a>
          <span className="text-[0.63rem] text-white/25">Entries, sessions, stories and takeaways as JSON.</span>
        </div>

        <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-500/[0.05] p-3">
          <p className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-rose-200/90">
            <AlertTriangle className="h-3.5 w-3.5" /> Delete the whole diary
          </p>
          <p className="mt-1 text-[0.65rem] leading-relaxed text-white/35">
            Removes every entry, transcript, stamp, story and takeaway. There is no undo.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              placeholder='Type "delete" to confirm'
              className="input flex-1"
            />
            <button
              type="button"
              disabled={deleteConfirm !== "delete" || deleting}
              onClick={() => void deleteEverything()}
              className={cn(
                "inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border px-3 text-[0.72rem] font-semibold transition",
                deleteConfirm === "delete"
                  ? "border-rose-400/40 bg-rose-500/20 text-rose-100"
                  : "border-white/10 bg-white/[0.03] text-white/30",
              )}
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete diary
            </button>
          </div>
        </div>
      </section>

      {notice && (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-500/[0.08] px-3.5 py-2.5 text-[0.72rem] text-amber-100/80">
          {notice}
        </div>
      )}
    </div>
  );
}
