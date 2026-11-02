"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  Loader2,
  LockKeyhole,
  PencilLine,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";
import { RESET_LIMITS, RESET_PHASES, KIND_META, GOAL_AREAS, type ResetKind } from "@/lib/reset/constants";
import { cn, withAlpha } from "@/lib/utils";
import { KindChip, KindIcon, LimitMeter, SectionHeading } from "./ui";

export interface BuilderDomain {
  slug: string;
  name: string;
  accent: string;
}

export interface BuilderCommitment {
  id: string;
  phase: number;
  kind: string;
  title: string;
  notes: string;
  domainSlug: string;
  cadence: string;
  weekday: number | null;
  time: string;
  durationMinutes: number;
  calendarEnabled: boolean;
  goalArea: string | null;
  metric: string;
  unit: string;
  targetValue: number | null;
  status: string;
}

const LIMITS: Record<string, number> = {
  cut: RESET_LIMITS.cuts,
  anchor: RESET_LIMITS.anchors,
  routine: RESET_LIMITS.routines,
  nonnegotiable: RESET_LIMITS.nonnegotiables,
  goal: RESET_LIMITS.goals,
  challenge: RESET_LIMITS.challenges,
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface FormState {
  id: string | null;
  kind: ResetKind;
  title: string;
  notes: string;
  domainSlug: string;
  cadence: "daily" | "weekly";
  weekday: number;
  time: string;
  durationMinutes: number;
  calendarEnabled: boolean;
  goalArea: string;
  metric: string;
  unit: string;
  targetValue: string;
}

function blankForm(phase: number, domains: BuilderDomain[], wakeTime: string): FormState {
  const kind = (RESET_PHASES[phase - 1]?.kinds[0] ?? "anchor") as ResetKind;
  return {
    id: null,
    kind,
    title: "",
    notes: "",
    domainSlug: kind === "anchor" ? "sleep" : domains[0]?.slug ?? "planning",
    cadence: kind === "goal" || kind === "challenge" ? "weekly" : "daily",
    weekday: 1,
    time: kind === "anchor" ? wakeTime : kind === "routine" ? "07:30" : "09:00",
    durationMinutes: kind === "goal" ? 60 : 30,
    calendarEnabled: kind !== "cut",
    goalArea: kind === "goal" ? "productivity" : "",
    metric: "",
    unit: "",
    targetValue: "",
  };
}

interface ConflictMessage {
  message: string;
}

export function PlanBuilder({
  planId,
  status,
  currentPhase,
  unlockedPhase,
  day,
  domains,
  wakeTime,
  initialCommitments,
}: {
  planId: string;
  status: string;
  currentPhase: number;
  unlockedPhase: number;
  day: number;
  domains: BuilderDomain[];
  wakeTime: string;
  initialCommitments: BuilderCommitment[];
}) {
  const router = useRouter();
  const [commitments, setCommitments] = useState(initialCommitments);
  const [phase, setPhase] = useState(Math.min(3, Math.max(1, currentPhase)));
  const [unlocked, setUnlocked] = useState(unlockedPhase);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [needsSync, setNeedsSync] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictMessage[] | null>(null);
  const [pendingForce, setPendingForce] = useState<"approve" | "sync" | null>(null);

  let toastId = 0;
  function toast(text: string, tone: "success" | "error" = "success") {
    toastId += 1;
    setToasts((current) => [...current, { id: Date.now() + toastId, text, tone }]);
  }

  const phaseConfig = RESET_PHASES[phase - 1];
  const phaseCommitments = commitments.filter((commitment) => commitment.phase === phase && commitment.status === "active");
  const locked = phase > unlocked;
  const isActive = status === "active";
  const phaseOne = commitments.filter((commitment) => commitment.phase === 1 && commitment.status === "active");
  const calendarBlocks = commitments.filter(
    (commitment) => commitment.status === "active" && commitment.calendarEnabled && commitment.phase <= currentPhase,
  ).length;

  function countKind(kind: ResetKind) {
    return commitments.filter((commitment) => commitment.kind === kind && commitment.status === "active").length;
  }

  function openNew(kind?: ResetKind, title?: string) {
    const base = blankForm(phase, domains, wakeTime);
    const nextKind = kind ?? base.kind;
    if (countKind(nextKind) >= LIMITS[nextKind]) {
      toast(`${KIND_META[nextKind].plural} are at the limit for this plan.`, "error");
      return;
    }
    setForm({
      ...base,
      kind: nextKind,
      title: title ?? "",
      calendarEnabled: nextKind !== "cut",
      cadence: nextKind === "goal" || nextKind === "challenge" ? "weekly" : "daily",
    });
  }

  function openEdit(commitment: BuilderCommitment) {
    setForm({
      id: commitment.id,
      kind: commitment.kind as ResetKind,
      title: commitment.title,
      notes: commitment.notes,
      domainSlug: commitment.domainSlug,
      cadence: commitment.cadence === "weekly" ? "weekly" : "daily",
      weekday: commitment.weekday ?? 1,
      time: commitment.time,
      durationMinutes: commitment.durationMinutes,
      calendarEnabled: commitment.calendarEnabled,
      goalArea: commitment.goalArea ?? "personal",
      metric: commitment.metric,
      unit: commitment.unit,
      targetValue: commitment.targetValue === null ? "" : String(commitment.targetValue),
    });
  }

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, ...body }),
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  }

  async function saveCommitment() {
    if (!form) return;
    if (!form.title.trim()) {
      toast("Give the commitment a title.", "error");
      return;
    }
    if (form.kind === "goal" && (!form.metric.trim() || !form.unit.trim() || !form.targetValue)) {
      toast("A goal needs a metric, a unit and a target to be trackable.", "error");
      return;
    }

    setBusy("save-commitment");
    try {
      const payload = {
        kind: form.kind,
        title: form.title,
        notes: form.notes,
        domainSlug: form.domainSlug,
        cadence: form.cadence,
        weekday: form.cadence === "weekly" ? form.weekday : null,
        time: form.time,
        durationMinutes: form.durationMinutes,
        calendarEnabled: form.calendarEnabled,
        goalArea: form.kind === "goal" ? form.goalArea : null,
        metric: form.metric,
        unit: form.unit,
        targetValue: form.targetValue ? Number(form.targetValue) : null,
      };

      const { response, data } = form.id
        ? await post({ action: "commitment-update", commitmentId: form.id, patch: payload })
        : await post({ action: "commitment-create", phase, commitment: payload });

      if (!response.ok) {
        toast(data.error ?? "Could not save the commitment.", "error");
        return;
      }

      const saved = data.commitment as BuilderCommitment;
      setCommitments((current) =>
        form.id ? current.map((item) => (item.id === saved.id ? saved : item)) : [...current, saved],
      );
      if (data.needsSync) setNeedsSync(true);
      setForm(null);
      toast(form.id ? "Commitment updated." : "Commitment added.");
      router.refresh();
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function removeCommitment(id: string) {
    setBusy(`delete-${id}`);
    try {
      const { response, data } = await post({ action: "commitment-delete", commitmentId: id });
      if (!response.ok) {
        toast(data.error ?? "Could not remove the commitment.", "error");
        return;
      }
      setCommitments((current) => current.filter((commitment) => commitment.id !== id));
      setConfirmDelete(null);
      setNeedsSync(true);
      toast("Commitment removed. Sync the calendar to update its blocks.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function unlock() {
    setBusy("unlock");
    try {
      const { response, data } = await post({ action: "unlock-phase", phase });
      if (!response.ok) {
        toast(data.error ?? "Could not unlock that phase.", "error");
        return;
      }
      setUnlocked(Math.max(unlocked, phase));
      toast(`${phaseConfig.name} unlocked early. Keep the load light.`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function calendarAction(kind: "approve" | "sync", force = false) {
    setBusy(kind);
    try {
      const { response, data } = await post({ action: kind, force });
      if (!response.ok) {
        if (data.requiresConfirmation) {
          setConflicts(data.conflicts ?? []);
          setPendingForce(kind);
          return;
        }
        toast(data.error ?? "Could not update the calendar.", "error");
        return;
      }
      setConflicts(null);
      setPendingForce(null);
      setNeedsSync(false);
      toast(
        kind === "approve"
          ? `Plan approved. ${data.created} calendar block${data.created === 1 ? "" : "s"} booked.`
          : `Calendar synced. ${data.created} block${data.created === 1 ? "" : "s"} booked.`,
      );
      if (kind === "approve") {
        setTimeout(() => router.push("/reset/plan"), 650);
      } else {
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3.5">
      <section className="surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionHeading
            icon={<Sparkles className="h-4 w-4" />}
            title="Build the plan, not a wish list"
            subtitle={
              isActive
                ? `Day ${day} · edit what is already running. Calendar changes are only applied when you sync.`
                : "At most three cuts, three non-negotiables and three goals. Month 2 and 3 unlock in order."
            }
          />
          <div className="flex items-center gap-1.5">
            {RESET_PHASES.map((entry) => (
              <button
                key={entry.phase}
                type="button"
                onClick={() => setPhase(entry.phase)}
                className={cn(
                  "relative min-h-[36px] rounded-xl border px-2.5 text-[0.68rem] font-semibold transition",
                  phase === entry.phase
                    ? "border-white/20 bg-white/[0.08] text-white"
                    : "border-white/[0.06] bg-white/[0.02] text-white/35 hover:text-white/70",
                )}
              >
                {entry.shortName}
                {entry.phase > unlocked && <LockKeyhole className="ml-1 inline h-2.5 w-2.5" />}
              </button>
            ))}
          </div>
        </div>

        <div
          className="mt-3.5 overflow-hidden rounded-2xl border p-3.5"
          style={{
            borderColor: withAlpha(phaseConfig.accent, 0.24),
            background: `linear-gradient(120deg, ${withAlpha(phaseConfig.accent, 0.13)}, rgba(14,10,27,0.72))`,
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full border px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-[0.12em]"
              style={{
                borderColor: withAlpha(phaseConfig.accent, 0.35),
                color: phaseConfig.accent,
                backgroundColor: withAlpha(phaseConfig.accent, 0.12),
              }}
            >
              {phaseConfig.days}
            </span>
            <h3 className="font-display text-[0.92rem] font-semibold text-white">{phaseConfig.name}</h3>
            <span className="text-[0.65rem] text-white/35">{phaseConfig.goal}</span>
          </div>
          <p className="mt-1.5 text-[0.68rem] text-white/40">{phaseConfig.dailyRule}</p>

          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {phaseConfig.kinds.map((kind) => (
              <LimitMeter
                key={kind}
                label={KIND_META[kind].plural}
                used={countKind(kind)}
                limit={LIMITS[kind]}
                accent={phaseConfig.accent}
              />
            ))}
          </div>
        </div>

        {locked ? (
          <div className="mt-3 flex flex-col items-center rounded-2xl border border-dashed border-white/12 px-4 py-8 text-center">
            <LockKeyhole className="h-6 w-6 text-white/25" />
            <p className="mt-2 text-[0.88rem] font-medium text-white/65">
              {phaseConfig.name} unlocks after day {phaseConfig.phase === 2 ? 30 : 60}
            </p>
            <p className="mt-1 max-w-sm text-[0.72rem] leading-relaxed text-white/35">
              You can start it early if you want the extra structure. The plan never locks you out.
            </p>
            <button
              type="button"
              onClick={() => void unlock()}
              disabled={busy !== null}
              className="btn btn-ghost mt-3 text-[0.74rem]"
            >
              {busy === "unlock" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LockKeyhole className="h-3.5 w-3.5" />}
              Unlock this phase early
            </button>
          </div>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {KIND_META[phaseConfig.kinds[0]].plural && (
                <button type="button" onClick={() => openNew()} className="btn btn-primary text-[0.72rem]">
                  <Plus className="h-3.5 w-3.5" /> Add {KIND_META[phaseConfig.kinds[0]].label.toLowerCase()}
                </button>
              )}
              {phaseConfig.kinds.slice(1).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => openNew(kind)}
                  disabled={countKind(kind) >= LIMITS[kind]}
                  className="btn btn-ghost text-[0.72rem]"
                >
                  <Plus className="h-3.5 w-3.5" /> {KIND_META[kind].label}
                </button>
              ))}
            </div>

            {form && (
              <div className="mt-3 animate-[rise_0.2s_ease-out] rounded-2xl border border-violet-400/25 bg-[linear-gradient(140deg,rgba(45,25,85,0.55),rgba(16,11,30,0.9))] p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-500/20 text-violet-200">
                      <PencilLine className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-[0.8rem] font-semibold text-white">
                      {form.id ? "Edit commitment" : `New ${KIND_META[form.kind].label.toLowerCase()}`}
                    </p>
                  </div>
                  <button type="button" onClick={() => setForm(null)} className="text-[0.68rem] text-white/40 hover:text-white">
                    Cancel
                  </button>
                </div>

                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  <label className="block space-y-1 sm:col-span-2">
                    <span className="label">What is the commitment?</span>
                    <input
                      value={form.title}
                      onChange={(event) => setForm({ ...form, title: event.target.value })}
                      placeholder={`e.g. ${KIND_META[form.kind].plural === "Cuts" ? "No scrolling after 22:00" : "One deep-work block"}`}
                      className="field"
                      autoFocus
                    />
                  </label>

                  {!form.id && (
                    <label className="block space-y-1">
                      <span className="label">Kind</span>
                      <select
                        value={form.kind}
                        onChange={(event) => {
                          const nextKind = event.target.value as ResetKind;
                          setForm({
                            ...form,
                            kind: nextKind,
                            goalArea: nextKind === "goal" ? form.goalArea || "productivity" : "",
                            cadence: nextKind === "goal" || nextKind === "challenge" ? "weekly" : "daily",
                            calendarEnabled: nextKind === "cut" ? false : form.calendarEnabled,
                            durationMinutes: nextKind === "goal" ? 60 : form.durationMinutes,
                          });
                        }}
                        className="field"
                      >
                        {phaseConfig.kinds.map((kind) => (
                          <option key={kind} value={kind} className="bg-[#150f28]" disabled={countKind(kind) >= LIMITS[kind]}>
                            {KIND_META[kind].label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label className="block space-y-1">
                    <span className="label">Owner domain</span>
                    <select
                      value={form.domainSlug}
                      onChange={(event) => setForm({ ...form, domainSlug: event.target.value })}
                      className="field"
                    >
                      {domains.map((domain) => (
                        <option key={domain.slug} value={domain.slug} className="bg-[#150f28]">
                          {domain.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1">
                    <span className="label">Cadence</span>
                    <select
                      value={form.cadence}
                      onChange={(event) => setForm({ ...form, cadence: event.target.value as "daily" | "weekly" })}
                      className="field"
                    >
                      <option value="daily" className="bg-[#150f28]">Every day</option>
                      <option value="weekly" className="bg-[#150f28]">Once a week</option>
                    </select>
                  </label>

                  {form.cadence === "weekly" && (
                    <label className="block space-y-1">
                      <span className="label">Day</span>
                      <select
                        value={form.weekday}
                        onChange={(event) => setForm({ ...form, weekday: Number(event.target.value) })}
                        className="field"
                      >
                        {WEEKDAYS.map((label, index) => (
                          <option key={label} value={index} className="bg-[#150f28]">
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label className="block space-y-1">
                    <span className="label">Time</span>
                    <input
                      type="time"
                      value={form.time}
                      onChange={(event) => setForm({ ...form, time: event.target.value })}
                      className="field"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="label">Block length</span>
                    <select
                      value={form.durationMinutes}
                      onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })}
                      className="field"
                    >
                      {[10, 15, 20, 30, 45, 60, 90, 120].map((minutes) => (
                        <option key={minutes} value={minutes} className="bg-[#150f28]">
                          {minutes} min
                        </option>
                      ))}
                    </select>
                  </label>

                  {form.kind === "goal" && (
                    <>
                      <label className="block space-y-1">
                        <span className="label">Goal area</span>
                        <select
                          value={form.goalArea}
                          onChange={(event) => setForm({ ...form, goalArea: event.target.value })}
                          className="field"
                        >
                          {GOAL_AREAS.map((area) => (
                            <option key={area.value} value={area.value} className="bg-[#150f28]">
                              {area.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-1">
                        <span className="label">Metric</span>
                        <input
                          value={form.metric}
                          onChange={(event) => setForm({ ...form, metric: event.target.value })}
                          placeholder="Deep-work hours"
                          className="field"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block space-y-1">
                          <span className="label">Unit</span>
                          <input
                            value={form.unit}
                            onChange={(event) => setForm({ ...form, unit: event.target.value })}
                            placeholder="hours / week"
                            className="field"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="label">Target</span>
                          <input
                            type="number"
                            min={0}
                            step="0.5"
                            value={form.targetValue}
                            onChange={(event) => setForm({ ...form, targetValue: event.target.value })}
                            placeholder="10"
                            className="field"
                          />
                        </label>
                      </div>
                    </>
                  )}

                  <label className="block space-y-1 sm:col-span-2">
                    <span className="label">Note for the agent (optional)</span>
                    <input
                      value={form.notes}
                      onChange={(event) => setForm({ ...form, notes: event.target.value })}
                      placeholder="Any constraint worth remembering"
                      className="field"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, calendarEnabled: !form.calendarEnabled })}
                    className={cn(
                      "flex min-h-[44px] items-center gap-2 rounded-xl border px-3 text-left text-[0.72rem] transition sm:col-span-2",
                      form.calendarEnabled
                        ? "border-violet-400/35 bg-violet-500/10 text-violet-100"
                        : "border-white/10 bg-white/[0.03] text-white/45",
                    )}
                  >
                    <CalendarClock className="h-4 w-4 shrink-0" />
                    <span className="flex-1">
                      {form.calendarEnabled ? "Book recurring blocks on the calendar" : "Track only — nothing on the calendar"}
                    </span>
                    <span className={cn("h-4 w-8 rounded-full p-0.5 transition", form.calendarEnabled ? "bg-violet-500" : "bg-white/15")}>
                      <span className={cn("block h-3 w-3 rounded-full bg-white transition", form.calendarEnabled ? "translate-x-4" : "")} />
                    </span>
                  </button>
                </div>

                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={() => setForm(null)} className="btn btn-ghost text-[0.74rem]">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveCommitment()}
                    disabled={busy !== null}
                    className="btn btn-primary text-[0.74rem]"
                  >
                    {busy === "save-commitment" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    {form.id ? "Save changes" : "Add to plan"}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 space-y-2">
              {phaseCommitments.map((commitment) => {
                const domain = domains.find((entry) => entry.slug === commitment.domainSlug);
                const accent = kindToneFor(commitment.kind);
                const deleting = confirmDelete === commitment.id;
                return (
                  <div
                    key={commitment.id}
                    className="rounded-2xl border p-3"
                    style={{ borderColor: withAlpha(accent, 0.2), background: withAlpha(accent, 0.045) }}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border"
                        style={{
                          borderColor: withAlpha(accent, 0.32),
                          backgroundColor: withAlpha(accent, 0.14),
                          color: accent,
                        }}
                      >
                        <KindIcon kind={commitment.kind} size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-[0.83rem] font-semibold text-white/90">{commitment.title}</p>
                          <KindChip kind={commitment.kind} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.65rem] text-white/40">
                          <span className="text-white/55">{domain?.name ?? commitment.domainSlug}</span>
                          <span>·</span>
                          <span>{commitment.cadence === "weekly" ? `${WEEKDAYS[commitment.weekday ?? 1]}s` : "Daily"}</span>
                          <span>·</span>
                          <span>{commitment.time}</span>
                          <span>·</span>
                          <span>{commitment.durationMinutes}m</span>
                          {!commitment.calendarEnabled && (
                            <>
                              <span>·</span>
                              <span>track only</span>
                            </>
                          )}
                        </div>
                        {commitment.kind === "goal" && (
                          <p className="mt-1 text-[0.64rem] text-white/35">
                            {commitment.metric || "Metric missing"} · target {commitment.targetValue ?? "—"} {commitment.unit}
                            {commitment.goalArea ? ` · ${commitment.goalArea}` : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => openEdit(commitment)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-white/35 transition hover:bg-white/[0.06] hover:text-white"
                          aria-label={`Edit ${commitment.title}`}
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(commitment.id)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-white/25 transition hover:bg-rose-500/10 hover:text-rose-300"
                          aria-label={`Remove ${commitment.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {deleting && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] px-2.5 py-2">
                        <p className="text-[0.68rem] text-rose-100/80">Remove this commitment from the plan?</p>
                        <div className="ml-auto flex gap-1.5">
                          <button type="button" onClick={() => setConfirmDelete(null)} className="btn btn-quiet px-2 py-1 text-[0.68rem]">
                            Keep
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeCommitment(commitment.id)}
                            disabled={busy !== null}
                            className="btn border border-rose-400/30 bg-rose-500/15 px-2.5 py-1 text-[0.68rem] text-rose-100"
                          >
                            {busy === `delete-${commitment.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {!phaseCommitments.length && (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-7 text-center">
                  <p className="text-[0.8rem] font-medium text-white/55">No commitments in this phase yet.</p>
                  <p className="mt-1 text-[0.68rem] text-white/30">Start with one, not five. You can add more after a week.</p>
                  <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
                    {suggestionsFor(phaseConfig.kinds[0]).slice(0, 3).map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => openNew(phaseConfig.kinds[0], suggestion)}
                        className="chip border-white/10 bg-white/[0.03] text-white/55 transition hover:border-violet-400/30 hover:text-white"
                      >
                        <Plus className="h-3 w-3" /> {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {phaseConfig.kinds.map((kind) => (
                <div key={kind} className="rounded-xl border border-white/[0.055] bg-white/[0.015] px-2.5 py-2">
                  <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-white/30">{KIND_META[kind].plural} suggestions</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {suggestionsFor(kind).slice(0, 2).map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => openNew(kind, suggestion)}
                        disabled={countKind(kind) >= LIMITS[kind]}
                        className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5 text-[0.62rem] text-white/45 transition hover:border-violet-400/25 hover:text-white disabled:opacity-40"
                      >
                        + {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {needsSync && isActive && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.08] px-3.5 py-2.5">
          <TriangleAlert className="h-4 w-4 text-amber-300" />
          <p className="text-[0.72rem] text-amber-100/80">
            The plan changed. Sync the calendar when you are ready — old Reset blocks for this phase are replaced.
          </p>
          <button
            type="button"
            onClick={() => void calendarAction("sync")}
            disabled={busy !== null}
            className="btn btn-ghost ml-auto border-amber-400/25 text-[0.7rem] text-amber-100"
          >
            {busy === "sync" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sync calendar
          </button>
        </div>
      )}

      <section className="surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[0.8rem] font-semibold text-white">
              {isActive ? "Calendar sync" : "Approve before anything is booked"}
            </p>
            <p className="mt-0.5 text-[0.68rem] leading-relaxed text-white/35">
              {isActive
                ? `${calendarBlocks} active block${calendarBlocks === 1 ? "" : "s"} on the calendar. Sync replaces this phase's Reset blocks only.`
                : `${phaseOne.filter((commitment) => commitment.calendarEnabled).length} block${phaseOne.filter((commitment) => commitment.calendarEnabled).length === 1 ? "" : "s"} will be booked for Month 1. Conflicts ask for a yes first.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isActive ? (
              <button
                type="button"
                onClick={() => void calendarAction("sync")}
                disabled={busy !== null}
                className="btn btn-primary text-[0.78rem]"
              >
                {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sync calendar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void calendarAction("approve")}
                disabled={busy !== null || !phaseOne.length}
                className="btn btn-primary text-[0.78rem]"
              >
                {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Approve plan & book Month 1
              </button>
            )}
          </div>
        </div>

        {!isActive && (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              ["1", "Approve the plan", "This starts Day 1 and books Month 1 blocks."],
              ["2", "Check in each evening", "Done, skipped or missed. Move one if it slips."],
              ["3", "Review on day 15", "The report builds from these exact check-ins."],
            ].map(([number, title, body]) => (
              <div key={number} className="flex gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-violet-500/15 text-[0.65rem] font-bold text-violet-200">
                  {number}
                </span>
                <div>
                  <p className="text-[0.7rem] font-semibold text-white/70">{title}</p>
                  <p className="mt-0.5 text-[0.63rem] leading-relaxed text-white/30">{body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={Boolean(conflicts)}
        onClose={() => {
          setConflicts(null);
          setPendingForce(null);
        }}
        title="These blocks need a yes"
        subtitle="The same conflict and protected-time checks as the calendar and chat."
        size="md"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setConflicts(null);
                setPendingForce(null);
              }}
              className="btn btn-ghost text-[0.78rem]"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={() => pendingForce && void calendarAction(pendingForce, true)}
              disabled={busy !== null}
              className="btn btn-primary text-[0.78rem]"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Book anyway
            </button>
          </div>
        }
      >
        <ul className="space-y-2">
          {(conflicts ?? []).map((conflict, index) => (
            <li key={`${conflict.message}-${index}`} className="flex gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
              <span className="text-[0.74rem] leading-relaxed text-amber-100/80">{conflict.message}</span>
            </li>
          ))}
          {!conflicts?.length && <li className="text-[0.74rem] text-white/40">No details were returned.</li>}
        </ul>
        <p className="mt-3 text-[0.65rem] leading-relaxed text-white/30">
          Booking anyway keeps the plan block in place. You can undo the batch later from plan settings.
        </p>
        <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[0.65rem] leading-relaxed text-white/35">
          This is a warning, not a failure. Nothing is booked until you choose.
        </div>
      </Modal>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </div>
  );
}

function kindToneFor(kind: string): string {
  const tones: Record<string, string> = {
    cut: "#f472b6",
    anchor: "#a78bfa",
    routine: "#38bdf8",
    nonnegotiable: "#2dd4bf",
    goal: "#34d399",
    challenge: "#fbbf24",
  };
  return tones[kind] ?? "#a78bfa";
}

function suggestionsFor(kind: ResetKind): string[] {
  const suggestions: Record<ResetKind, string[]> = {
    cut: ["No scrolling after 22:00", "No takeaway on weekdays", "No starting the day in bed with my phone"],
    anchor: ["Same wake-up time every day", "Finish one task before noon", "Evening check-in at the same time"],
    routine: ["Morning routine: water, light, ten minutes of movement", "Evening routine: close the day and set tomorrow's first task"],
    nonnegotiable: ["One deep-work block", "Thirty minutes of movement", "Ten minutes of planning tomorrow"],
    goal: ["Deep-work hours per week", "Money saved per week", "Practice sessions per week"],
    challenge: ["One hard conversation per week", "One finished task before checking messages", "One thing that scares me, every week"],
  };
  return suggestions[kind];
}
