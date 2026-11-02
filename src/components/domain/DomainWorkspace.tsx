"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Save, Star, Target, Trash2, Zap } from "lucide-react";
import { withAlpha } from "@/lib/utils";
import { TaskChecklist, type ChecklistTask } from "@/components/today/TaskChecklist";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";

interface DomainWorkspaceProps {
  domain: {
    slug: string;
    name: string;
    accent: string;
    goals: string[];
    notes: string;
    isProtected: boolean;
  };
  tasks: ChecklistTask[];
  eventTypes: { title: string; minutes: number }[];
}

type Tab = "goals" | "tasks" | "notes";

let toastId = 0;

export function DomainWorkspace({ domain, tasks, eventTypes }: DomainWorkspaceProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("goals");
  const [goals, setGoals] = useState(domain.goals);
  const [newGoal, setNewGoal] = useState("");
  const [notes, setNotes] = useState(domain.notes);
  const [notesSaved, setNotesSaved] = useState(true);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskMinutes, setTaskMinutes] = useState(45);
  const [taskIsPriority, setTaskIsPriority] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyBlock, setBusyBlock] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [, startTransition] = useTransition();

  function pushToast(text: string, tone: "success" | "error" = "success") {
    toastId += 1;
    setToasts((current) => [...current, { id: toastId, text, tone }]);
  }

  async function patchDomain(body: Record<string, unknown>, message: string) {
    setSaving(true);
    try {
      const response = await fetch(`/api/domains/${domain.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        pushToast(data.error ?? "Could not save.", "error");
        return false;
      }
      pushToast(message);
      startTransition(() => router.refresh());
      return true;
    } catch {
      pushToast("Network error — try again.", "error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addGoal() {
    const value = newGoal.trim();
    if (!value) return;
    const next = [...goals, value];
    setGoals(next);
    setNewGoal("");
    const ok = await patchDomain({ goals: next }, "Goal added.");
    if (!ok) setGoals(goals);
  }

  async function removeGoal(index: number) {
    const next = goals.filter((_, position) => position !== index);
    setGoals(next);
    const ok = await patchDomain({ goals: next }, "Goal removed.");
    if (!ok) setGoals(goals);
  }

  async function saveNotes() {
    setSaving(true);
    try {
      const response = await fetch(`/api/domains/${domain.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!response.ok) {
        pushToast("Could not save notes.", "error");
        return;
      }
      setNotesSaved(true);
      pushToast("Notes saved.");
    } finally {
      setSaving(false);
    }
  }

  async function addTask() {
    const title = taskTitle.trim();
    if (!title) return;
    setSaving(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domainSlug: domain.slug,
          title,
          estimateMinutes: taskMinutes,
          priority: taskIsPriority ? 3 : 1,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        pushToast(data.error ?? "Could not add the task.", "error");
        return;
      }
      setTaskTitle("");
      pushToast(taskIsPriority ? "Top Priority task added." : "Task added.");
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  async function quickAdd(title: string, minutes: number) {
    setBusyBlock(title);
    try {
      const response = await fetch(`/api/domains/${domain.slug}/quick-add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, minutes }),
      });
      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Could not add the block.", "error");
        return;
      }
      pushToast(`${title} → ${data.label}`);
      startTransition(() => router.refresh());
    } finally {
      setBusyBlock(null);
    }
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "goals", label: "Goals", count: goals.length },
    { key: "tasks", label: "Tasks", count: tasks.filter((task) => task.status !== "done").length },
    { key: "notes", label: "Notes" },
  ];

  return (
    <section className="surface p-3.5">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            onClick={() => setTab(entry.key)}
            className="rounded-lg px-2.5 py-1.5 text-[0.74rem] font-semibold transition"
            style={
              tab === entry.key
                ? {
                    backgroundColor: withAlpha(domain.accent, 0.22),
                    color: "#fff",
                    boxShadow: `inset 0 0 0 1px ${withAlpha(domain.accent, 0.45)}`,
                  }
                : { color: "rgba(255,255,255,0.45)" }
            }
          >
            {entry.label}
            {entry.count !== undefined && (
              <span className="ml-1.5 text-[0.62rem] text-white/35">{entry.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "goals" && (
        <div className="space-y-2">
          {goals.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-[0.75rem] text-white/35">
              No goals yet. What does {domain.name} look like when it&apos;s going well?
            </p>
          )}

          <ul className="space-y-1.5">
            {goals.map((goal, index) => (
              <li
                key={`${goal}-${index}`}
                className="group flex items-center gap-2.5 rounded-xl border px-3 py-2"
                style={{
                  borderColor: withAlpha(domain.accent, 0.22),
                  backgroundColor: withAlpha(domain.accent, 0.07),
                }}
              >
                <span
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-white"
                  style={{ backgroundColor: withAlpha(domain.accent, 0.55) }}
                >
                  <Target className="h-3 w-3" />
                </span>
                <span className="min-w-0 flex-1 text-[0.8rem] text-white/85">{goal}</span>
                <button
                  onClick={() => void removeGoal(index)}
                  className="text-white/20 transition hover:text-rose-300"
                  aria-label={`Remove goal ${goal}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void addGoal();
            }}
            className="flex gap-2"
          >
            <input
              value={newGoal}
              onChange={(event) => setNewGoal(event.target.value)}
              placeholder="Add a goal for this domain…"
              className="field flex-1"
            />
            <button type="submit" disabled={saving || !newGoal.trim()} className="btn btn-ghost">
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </form>
        </div>
      )}

      {tab === "tasks" && (
        <div className="space-y-2.5">
          <TaskChecklist
            tasks={tasks}
            showDomain={false}
            emptyText="No tasks in this domain yet."
          />

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void addTask();
            }}
            className="flex flex-wrap gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2"
          >
            <input
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              placeholder="Next concrete step…"
              className="field min-w-[10rem] flex-1"
            />
            <select
              value={taskMinutes}
              onChange={(event) => setTaskMinutes(Number(event.target.value))}
              className="field w-[6.5rem]"
            >
              {[15, 30, 45, 60, 90, 120].map((minutes) => (
                <option key={minutes} value={minutes} className="bg-[#150f28]">
                  {minutes} min
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setTaskIsPriority(!taskIsPriority)}
              title={taskIsPriority ? "Top Priority (Click to make Normal)" : "Normal Priority (Click to make Top Priority)"}
              className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[0.72rem] transition ${
                taskIsPriority
                  ? "border-amber-400/50 bg-amber-400/20 text-amber-300"
                  : "border-white/10 bg-white/5 text-white/50 hover:text-white"
              }`}
            >
              <Star className={`h-3.5 w-3.5 ${taskIsPriority ? "fill-amber-400 text-amber-400" : ""}`} />
              <span className="hidden sm:inline">{taskIsPriority ? "Top Priority" : "Priority"}</span>
            </button>
            <button type="submit" disabled={saving || !taskTitle.trim()} className="btn btn-primary">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add task
            </button>
          </form>
        </div>
      )}

      {tab === "notes" && (
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setNotesSaved(false);
            }}
            rows={7}
            placeholder={`Anything worth remembering about ${domain.name} — decisions, constraints, people…`}
            className="field resize-none leading-relaxed"
          />
          <div className="flex items-center justify-between">
            <span className="text-[0.65rem] text-white/30">
              {notesSaved ? "Saved" : "Unsaved changes"} · the agent sees these notes
            </span>
            <button onClick={() => void saveNotes()} disabled={saving || notesSaved} className="btn btn-primary">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save notes
            </button>
          </div>
        </div>
      )}

      <div className="mt-3.5 border-t border-white/[0.06] pt-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-[0.62rem] uppercase tracking-[0.14em] text-white/30">
          <Zap className="h-3 w-3" /> Quick add — books the next free slot
        </div>
        <div className="flex flex-wrap gap-1.5">
          {eventTypes.map((type) => (
            <button
              key={type.title}
              onClick={() => void quickAdd(type.title, type.minutes)}
              disabled={busyBlock !== null}
              className="rounded-full border px-2.5 py-1 text-[0.68rem] font-medium transition hover:brightness-125 disabled:opacity-50"
              style={{
                borderColor: withAlpha(domain.accent, 0.35),
                backgroundColor: withAlpha(domain.accent, 0.12),
                color: withAlpha(domain.accent, 0.95),
              }}
            >
              {busyBlock === type.title ? (
                <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
              ) : (
                <Check className="mr-1 inline h-3 w-3" />
              )}
              {type.title} · {type.minutes}m
            </button>
          ))}
        </div>
      </div>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
    </section>
  );
}
