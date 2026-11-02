"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarClock,
  Download,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";
import { PlanActionButton } from "./PlanActionButton";
import { cn } from "@/lib/utils";

interface SettingsProps {
  planId: string;
  status: string;
  checkinTime: string;
  autonomy: string;
  sendAnswersToAi: boolean;
  notifyCheckin: boolean;
  notifyReviews: boolean;
  notifyReports: boolean;
  notifyDrift: boolean;
  lastBatchId: string | null;
  lastBatchCount: number;
}

let toastId = 0;

export function ResetSettings(initial: SettingsProps) {
  const router = useRouter();
  const [values, setValues] = useState({
    checkinTime: initial.checkinTime,
    autonomy: initial.autonomy,
    sendAnswersToAi: initial.sendAnswersToAi,
    notifyCheckin: initial.notifyCheckin,
    notifyReviews: initial.notifyReviews,
    notifyReports: initial.notifyReports,
    notifyDrift: initial.notifyDrift,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<{ message: string }[] | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  function toast(text: string, tone: "success" | "error" = "success") {
    toastId += 1;
    setToasts((current) => [...current, { id: toastId, text, tone }]);
  }

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: initial.planId, ...body }),
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  }

  async function save() {
    setBusy("save");
    try {
      const { response, data } = await post({ action: "settings", ...values });
      if (!response.ok) {
        toast(data.error ?? "Could not save settings.", "error");
        return;
      }
      toast("Reset settings saved.");
      router.refresh();
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function syncCalendar(force = false) {
    setBusy("sync");
    try {
      const { response, data } = await post({ action: "sync", force });
      if (!response.ok) {
        if (data.requiresConfirmation) {
          setConflicts(data.conflicts ?? []);
          return;
        }
        toast(data.error ?? "Could not sync the calendar.", "error");
        return;
      }
      setConflicts(null);
      toast(`Calendar synced. ${data.created} block${data.created === 1 ? "" : "s"} booked.`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function undoBatch() {
    if (!initial.lastBatchId) return;
    setBusy("undo");
    try {
      const { response, data } = await post({ action: "undo-batch", batchId: initial.lastBatchId });
      if (!response.ok) {
        toast(data.error ?? "Could not undo that batch.", "error");
        return;
      }
      toast(`${data.removed} Reset block${data.removed === 1 ? "" : "s"} removed.`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function deletePlan() {
    if (deleteText !== "DELETE") return;
    setBusy("delete");
    try {
      const { response, data } = await post({ action: "delete" });
      if (!response.ok) {
        toast(data.error ?? "Could not delete the plan.", "error");
        return;
      }
      router.push("/reset");
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3.5">
      <section className="surface p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl border border-violet-400/25 bg-violet-500/12 text-violet-200">
            <CalendarClock className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-[0.95rem] font-semibold text-white">Check-in &amp; notifications</h2>
            <p className="text-[0.65rem] text-white/35">One evening reminder, at most one nudge a day.</p>
          </div>
        </div>

        <label className="mt-3 block max-w-[13rem] space-y-1.5">
          <span className="label">Check-in time</span>
          <input
            type="time"
            value={values.checkinTime}
            onChange={(event) => setValues({ ...values, checkinTime: event.target.value })}
            className="field"
          />
        </label>

        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          <NotifToggle
            label="Evening check-in"
            description="Daily at your chosen time."
            checked={values.notifyCheckin}
            onChange={(checked) => setValues({ ...values, notifyCheckin: checked })}
            icon={<Bell className="h-3.5 w-3.5" />}
          />
          <NotifToggle
            label="Review due"
            description="Morning of days 15, 30, 45, 60, 75 and 90."
            checked={values.notifyReviews}
            onChange={(checked) => setValues({ ...values, notifyReviews: checked })}
            icon={<CalendarClock className="h-3.5 w-3.5" />}
          />
          <NotifToggle
            label="Report ready"
            description="When a report is built — no commitment names."
            checked={values.notifyReports}
            onChange={(checked) => setValues({ ...values, notifyReports: checked })}
            icon={<Sparkles className="h-3.5 w-3.5" />}
          />
          <NotifToggle
            label="Drift suggestion"
            description="At most one a day when a pattern slips."
            checked={values.notifyDrift}
            onChange={(checked) => setValues({ ...values, notifyDrift: checked })}
            icon={<TriangleAlert className="h-3.5 w-3.5" />}
          />
        </div>

        <p className="mt-2 text-[0.62rem] leading-relaxed text-white/25">
          Notifications never name a commitment or a notebook answer. Pausing the plan mutes every Reset reminder.
        </p>
      </section>

      <section className="surface p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-300" />
          <div>
            <h2 className="font-display text-[0.95rem] font-semibold text-white">Autopilot</h2>
            <p className="text-[0.65rem] text-white/35">The agent proposes; the app decides. This is the only setting that changes that.</p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            {
              value: "suggest",
              title: "Suggest only",
              body: "Every adjustment is a proposal. The agent never moves a block or changes a commitment on its own.",
              icon: ShieldCheck,
              accent: "#34d399",
            },
            {
              value: "auto_small",
              title: "Auto-adjust small things",
              body: "The agent may move one of your own Reset blocks into the same week's next free slot, never into protected time. Undo stays available.",
              icon: RefreshCw,
              accent: "#fbbf24",
            },
          ].map((option) => {
            const active = values.autonomy === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setValues({ ...values, autonomy: option.value })}
                className={cn(
                  "flex min-h-[88px] items-start gap-2.5 rounded-2xl border p-3 text-left transition",
                  active ? "border-white/20 bg-white/[0.06]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/12",
                )}
              >
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border"
                  style={{ borderColor: `${option.accent}44`, backgroundColor: `${option.accent}18`, color: option.accent }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-[0.76rem] font-semibold text-white/80">{option.title}</p>
                  <p className="mt-0.5 text-[0.63rem] leading-relaxed text-white/35">{option.body}</p>
                </div>
                <span
                  className={cn(
                    "ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2",
                    active ? "border-violet-400 bg-violet-500" : "border-white/20",
                  )}
                />
              </button>
            );
          })}
        </div>
      </section>

      <section className="surface p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          <div>
            <h2 className="font-display text-[0.95rem] font-semibold text-white">Privacy</h2>
            <p className="text-[0.65rem] text-white/35">Your answers, reports and goals are scoped to your account.</p>
          </div>
        </div>
        <div className="mt-3">
          <NotifToggle
            label="Send my notebook answers to the agent"
            description="When off, reports contain numbers only and you write the summary yourself."
            checked={values.sendAnswersToAi}
            onChange={(checked) => setValues({ ...values, sendAnswersToAi: checked })}
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
          />
        </div>
        <p className="mt-2 text-[0.62rem] leading-relaxed text-white/25">
          The app stores your plan, check-ins and notebook locally in your account. Notifications carry generic text
          such as “Your Reset check-in is ready”.
        </p>
      </section>

      <section className="surface p-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-sky-300" />
          <div>
            <h2 className="font-display text-[0.95rem] font-semibold text-white">Calendar</h2>
            <p className="text-[0.65rem] text-white/35">
              {initial.lastBatchCount} block{initial.lastBatchCount === 1 ? "" : "s"} in the latest Reset batch.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void syncCalendar()}
            disabled={busy !== null || initial.status !== "active"}
            className="btn btn-ghost text-[0.72rem]"
          >
            {busy === "sync" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sync this phase
          </button>
          <button
            type="button"
            onClick={() => void undoBatch()}
            disabled={busy !== null || !initial.lastBatchId}
            className="btn btn-ghost text-[0.72rem]"
          >
            {busy === "undo" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
            Undo last batch
          </button>
          <a href="/api/reset/export" download className="btn btn-ghost text-[0.72rem]">
            <Download className="h-3.5 w-3.5" /> Export Reset data
          </a>
        </div>
        <p className="mt-2 text-[0.62rem] leading-relaxed text-white/25">
          Syncing replaces only this phase&apos;s Reset blocks. Events that are not part of the plan are never touched.
        </p>
      </section>

      <section className="surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-[0.95rem] font-semibold text-white">Plan state</h2>
            <p className="mt-0.5 text-[0.65rem] capitalize text-white/35">{initial.status} · your data stays until you delete it.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {initial.status === "active" ? (
              <PlanActionButton action="pause" planId={initial.planId} label="Pause plan" busyLabel="Pausing…" tone="ghost" />
            ) : initial.status === "paused" ? (
              <PlanActionButton action="resume" planId={initial.planId} label="Resume plan" busyLabel="Resuming…" />
            ) : null}
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={() => void save()}
        disabled={busy !== null}
        className="btn btn-primary w-full justify-center py-2.5"
      >
        {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save Reset settings
      </button>

      <section className="rounded-2xl border border-rose-400/20 bg-rose-500/[0.04] p-4">
        <div className="flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-rose-300" />
          <h2 className="font-display text-[0.92rem] font-semibold text-rose-100/80">Delete this Reset Plan</h2>
        </div>
        <p className="mt-1.5 text-[0.68rem] leading-relaxed text-white/35">
          Removes the plan, answers, reports, notebook, check-ins, goal tracks and plan-created habits. Only calendar
          events the plan created are deleted.
        </p>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="btn mt-2.5 border border-rose-400/30 bg-rose-500/10 text-[0.72rem] text-rose-100 hover:bg-rose-500/20"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete plan
        </button>
      </section>

      <Modal
        open={Boolean(conflicts)}
        onClose={() => setConflicts(null)}
        title="Calendar conflicts"
        subtitle="The same checks as the calendar. Book anyway only if you mean it."
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConflicts(null)} className="btn btn-ghost text-[0.76rem]">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void syncCalendar(true)}
              disabled={busy !== null}
              className="btn btn-primary text-[0.76rem]"
            >
              {busy === "sync" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sync anyway
            </button>
          </div>
        }
      >
        <ul className="space-y-2">
          {(conflicts ?? []).map((conflict, index) => (
            <li key={`${conflict.message}-${index}`} className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-[0.72rem] text-amber-100/75">
              {conflict.message}
            </li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteText("");
        }}
        title="Delete this plan?"
        subtitle="This cannot be undone. The previous cycle's reports are deleted with it."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDeleteOpen(false);
                setDeleteText("");
              }}
              className="btn btn-ghost text-[0.76rem]"
            >
              Keep plan
            </button>
            <button
              type="button"
              onClick={() => void deletePlan()}
              disabled={deleteText !== "DELETE" || busy !== null}
              className="btn border border-rose-400/30 bg-rose-500/15 text-[0.76rem] text-rose-100 hover:bg-rose-500/25"
            >
              {busy === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete permanently
            </button>
          </div>
        }
      >
        <p className="text-[0.78rem] leading-relaxed text-white/55">
          Type <span className="font-mono text-rose-200">DELETE</span> to confirm.
        </p>
        <input
          value={deleteText}
          onChange={(event) => setDeleteText(event.target.value)}
          className="field mt-2"
          placeholder="DELETE"
          autoComplete="off"
        />
      </Modal>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </div>
  );
}

function NotifToggle({
  label,
  description,
  checked,
  onChange,
  icon,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex min-h-[52px] w-full items-start gap-2 rounded-xl border p-2.5 text-left transition",
        checked ? "border-violet-400/22 bg-violet-500/[0.07]" : "border-white/[0.06] bg-white/[0.02] opacity-70",
      )}
    >
      <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg", checked ? "bg-violet-500/15 text-violet-200" : "bg-white/[0.04] text-white/30")}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[0.71rem] font-medium", checked ? "text-white/80" : "text-white/45")}>{label}</span>
        <span className="mt-0.5 block text-[0.6rem] leading-relaxed text-white/30">{description}</span>
      </span>
      <span className={cn("mt-0.5 h-4 w-7 shrink-0 rounded-full p-0.5 transition", checked ? "bg-violet-500" : "bg-white/15")}>
        <span className={cn("block h-3 w-3 rounded-full bg-white transition", checked ? "translate-x-3" : "")} />
      </span>
    </button>
  );
}
