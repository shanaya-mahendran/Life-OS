"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, Loader2, LogOut, RotateCcw, Save, ShieldCheck, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";
import { signOutUser } from "@/lib/auth-client";

const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Africa/Nairobi",
  "UTC",
];

export interface SettingsValues {
  name: string;
  email: string;
  timezone: string;
  wakeTime: string;
  sleepTime: string;
  dayStartHour: number;
  dayEndHour: number;
  minSleepHours: number;
  maxFocusHours: number;
  monthlyTokenBudget: number;
}

let toastId = 0;

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [, startTransition] = useTransition();

  function toast(text: string, tone: "success" | "error" = "success") {
    toastId += 1;
    setToasts((current) => [...current, { id: toastId, text, tone }]);
  }

  function update<K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          timezone: values.timezone,
          wakeTime: values.wakeTime,
          sleepTime: values.sleepTime,
          dayStartHour: values.dayStartHour,
          dayEndHour: values.dayEndHour,
          minSleepHours: values.minSleepHours,
          maxFocusHours: values.maxFocusHours,
          monthlyTokenBudget: values.monthlyTokenBudget,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast(data.error ?? "Could not save settings.", "error");
        return;
      }
      toast("Settings saved.");
      startTransition(() => router.refresh());
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function resetData(mode: "clear" | "reset" = "clear") {
    setResetting(true);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!response.ok) {
        toast("Could not reset the data.", "error");
        return;
      }
      setResetOpen(false);
      toast(mode === "clear" ? "Calendar wiped clean!" : "Calendar reset & example week restored.");
      setTimeout(() => {
        window.location.href = "/calendar";
      }, 600);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <section className="surface p-4">
          <h2 className="font-display text-[0.98rem] font-semibold text-white">Profile & rhythm</h2>
          <p className="mt-0.5 text-[0.72rem] text-white/35">
            These values drive the planner, the sleep guard and every conflict check.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="label">Name</span>
              <input value={values.name} onChange={(event) => update("name", event.target.value)} className="field" />
            </label>

            <label className="block space-y-1.5">
              <span className="label">Email</span>
              <input value={values.email} readOnly className="field cursor-not-allowed opacity-60" />
            </label>

            <label className="block space-y-1.5">
              <span className="label">Timezone</span>
              <select value={values.timezone} onChange={(event) => update("timezone", event.target.value)} className="field">
                {TIMEZONES.includes(values.timezone) ? null : (
                  <option value={values.timezone} className="bg-[#150f28]">
                    {values.timezone}
                  </option>
                )}
                {TIMEZONES.map((zone) => (
                  <option key={zone} value={zone} className="bg-[#150f28]">
                    {zone}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="label">Wake</span>
                <input
                  type="time"
                  value={values.wakeTime}
                  onChange={(event) => update("wakeTime", event.target.value)}
                  className="field"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="label">Bedtime</span>
                <input
                  type="time"
                  value={values.sleepTime}
                  onChange={(event) => update("sleepTime", event.target.value)}
                  className="field"
                />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="label">Day starts</span>
              <select
                value={values.dayStartHour}
                onChange={(event) => update("dayStartHour", Number(event.target.value))}
                className="field"
              >
                {Array.from({ length: 13 }, (_, hour) => hour).map((hour) => (
                  <option key={hour} value={hour} className="bg-[#150f28]">
                    {String(hour).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="label">Day ends</span>
              <select
                value={values.dayEndHour}
                onChange={(event) => update("dayEndHour", Number(event.target.value))}
                className="field"
              >
                {Array.from({ length: 12 }, (_, index) => index + 12).map((hour) => (
                  <option key={hour} value={hour} className="bg-[#150f28]">
                    {String(hour).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="label">Minimum sleep (hours)</span>
              <input
                type="number"
                min={4}
                max={12}
                step={0.5}
                value={values.minSleepHours}
                onChange={(event) => update("minSleepHours", Number(event.target.value))}
                className="field"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="label">Max focus hours / day</span>
              <input
                type="number"
                min={1}
                max={20}
                value={values.maxFocusHours}
                onChange={(event) => update("maxFocusHours", Number(event.target.value))}
                className="field"
              />
            </label>

            <label className="block space-y-1.5 sm:col-span-2">
              <span className="label">Monthly AI token budget</span>
              <input
                type="number"
                min={0}
                step={100000}
                value={values.monthlyTokenBudget}
                onChange={(event) => update("monthlyTokenBudget", Number(event.target.value))}
                className="field"
              />
              <span className="text-[0.65rem] text-white/30">
                When the budget is spent, chat keeps working with the deterministic rules engine.
              </span>
            </label>
          </div>

          <button onClick={() => void save()} disabled={saving} className="btn btn-primary mt-3.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save settings
          </button>
        </section>

        <section className="surface p-4">
          <h2 className="font-display text-[0.98rem] font-semibold text-white">Privacy & data</h2>
          <p className="mt-0.5 text-[0.72rem] text-white/35">
            Your calendar, tasks and agent notes belong to you. Export any time.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="/api/account" download className="btn btn-ghost">
              <Download className="h-3.5 w-3.5" /> Export JSON
            </a>
            <button onClick={() => setResetOpen(true)} className="btn btn-ghost text-rose-200">
              <RotateCcw className="h-3.5 w-3.5" /> Reset calendar
            </button>
          </div>
          <p className="mt-2 text-[0.65rem] leading-relaxed text-white/30">
            Reset clears events, tasks, memories and agent logs and restores the example week. Your account and
            domains stay.
          </p>
        </section>

        <section className="surface p-4">
          <h2 className="font-display text-[0.98rem] font-semibold text-white">Account & Session</h2>
          <p className="mt-0.5 text-[0.72rem] text-white/35">
            Signed in as <span className="font-medium text-white/70">{values.email}</span>
          </p>
          <button
            type="button"
            onClick={() => void signOutUser()}
            className="btn btn-ghost mt-3 text-rose-200"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </section>
      </div>

      <div className="space-y-3">
        <section className="surface p-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500/15 text-violet-200">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-[0.85rem] font-semibold text-white">Mochi (AI Companion)</h3>
              <p className="text-[0.62rem] text-white/35">Witty, intelligent male companion · Groq powered</p>
            </div>
          </div>
          <p className="mt-2.5 text-[0.72rem] leading-relaxed text-white/45">
            Mochi handles master calendar scheduling across all 18 life domains, semantic recall, or just friendly, playful banter when you want to chat.
          </p>
          <Link href="/chat" className="btn btn-ghost mt-2.5 w-full justify-center text-[0.72rem]">
            Chat with Mochi →
          </Link>
        </section>

        <section className="surface p-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-200">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <h3 className="text-[0.85rem] font-semibold text-white">Safety rules</h3>
          </div>
          <ul className="mt-2.5 space-y-1.5 text-[0.7rem] leading-relaxed text-white/45">
            <li>• Every write goes through one calendar service.</li>
            <li>• Protected domains ask for a yes before moving.</li>
            <li>• Conflicts are blocked until confirmed.</li>
            <li>• Every agent write stores its inverse for undo.</li>
            <li>• Every query is scoped to your account.</li>
          </ul>
        </section>

        <section className="surface p-4">
          <h3 className="text-[0.85rem] font-semibold text-white">About</h3>
          <p className="mt-1 text-[0.7rem] leading-relaxed text-white/40">
            LifeOS Agent · 18 domains, one calendar. Built with Next.js, Prisma and Supabase Postgres.
          </p>
        </section>
      </div>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset or Clear Calendar"
        subtitle="Choose whether to wipe all events for a fresh start, or restore the example week."
        size="md"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button onClick={() => setResetOpen(false)} className="btn btn-ghost text-[0.78rem]">
              Cancel
            </button>
            <button
              onClick={() => void resetData("reset")}
              disabled={resetting}
              className="btn btn-ghost border border-white/10 text-[0.78rem]"
            >
              {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Restore starter week
            </button>
            <button
              onClick={() => void resetData("clear")}
              disabled={resetting}
              className="btn border border-rose-400/30 bg-rose-500/15 text-[0.78rem] text-rose-100 hover:bg-rose-500/25"
            >
              {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Clear all events
            </button>
          </div>
        }
      >
        <p className="text-[0.78rem] leading-relaxed text-white/55">
          <strong className="text-white">Clear all events:</strong> Wipes all events, tasks, notifications and briefs so you have a completely fresh, empty calendar.
          <br />
          <strong className="text-white">Restore starter week:</strong> Clears custom data and loads the curated example weekly schedule.
        </p>
      </Modal>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </div>
  );
}
