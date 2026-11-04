"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Clock3, Loader2, Plus, Star, Trash2, X } from "lucide-react";
import { formatInZone, humanizeMinutes, zonedToUtc } from "@/lib/time";
import { countActivePriorities } from "@/lib/tasks/priority";
import { cn } from "@/lib/utils";

export interface BoardSubtask {
  id: string;
  title: string;
  notes: string;
  durationMin: number;
  scheduledStart: string | Date | null;
  status: string;
}

export interface BoardTask {
  id: string;
  title: string;
  notes: string;
  status: string;
  deadline: string | Date | null;
  isPriority: boolean;
  priorityRank: number | null;
  domainSlug: string;
  domainName: string;
  domainAccent: string;
  subtasks: BoardSubtask[];
  rollup: {
    totalMin: number;
    doneMin: number;
    scheduledMin: number;
    unscheduledMin: number;
    progressPct: number;
    subtaskDone: number;
    subtaskCount: number;
    isOverdue: boolean;
    atRisk: boolean;
  };
}

interface MainTaskBoardProps {
  tasks: BoardTask[];
  domainSlug?: string;
  domainName?: string;
  timeZone: string;
  priorityView?: boolean;
  compact?: boolean;
  maxVisible?: number;
  domains?: { slug: string; name: string }[];
}

function asDate(value: string | Date | null) {
  return value === null ? null : value instanceof Date ? value : new Date(value);
}

function localInput(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

function parseLocalInput(value: string, timeZone: string) {
  if (!value) return null;
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return zonedToUtc({ year, month, day, hour, minute }, timeZone).toISOString();
}

function TaskCard({
  task,
  timeZone,
  refresh,
  onRemove,
  rankControl,
}: {
  task: BoardTask;
  timeZone: string;
  refresh: () => void;
  onRemove: (id: string, undoAvailable: boolean) => void;
  rankControl?: {
    index: number;
    count: number;
    move: (direction: -1 | 1) => void;
    dragStart: (event: React.DragEvent<HTMLElement>) => void;
    dragOver: (event: React.DragEvent<HTMLElement>) => void;
    drop: (event: React.DragEvent<HTMLElement>) => void;
    dragEnd: () => void;
    isDragging: boolean;
  };
}) {
  const [expanded, setExpanded] = useState(false);
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [durationMin, setDurationMin] = useState(30);
  const [scheduledStart, setScheduledStart] = useState("");
  const [dailyCapOverride, setDailyCapOverride] = useState(false);
  const [deadlineEdit, setDeadlineEdit] = useState(false);
  const [scheduleProposal, setScheduleProposal] = useState<{
    subtaskId: string;
    title: string;
    start: string;
    end: string;
    durationMin: number;
  }[] | null>(null);
  const [proposalRemainder, setProposalRemainder] = useState(0);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: "task" | "subtask";
    id: string;
    title: string;
  } | null>(null);
  const [deadlineInput, setDeadlineInput] = useState(() => {
    const deadline = asDate(task.deadline);
    return deadline ? localInput(deadline, timeZone) : "";
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [affected, setAffected] = useState<{ id: string; title: string }[]>([]);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!deleteTarget) {
      deleteTriggerRef.current?.focus();
      return;
    }

    cancelDeleteRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDeleteTarget(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteTarget]);

  async function patchTask(body: Record<string, unknown>) {
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      setAffected(data.affected ?? []);
      throw new Error(data.error ?? data.message ?? "Could not update task.");
    }
    return data;
  }

  async function togglePriority() {
    setBusy(true);
    setError("");
    try {
      const data = await patchTask({ isPriority: !task.isPriority });
      setError(data.warning ?? "");
      refresh();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not update priority.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleDone() {
    const open = task.subtasks.filter((subtask) => subtask.status !== "done");
    if (task.status !== "done" && open.length && !window.confirm(`Mark all ${open.length} subtasks done?`)) return;
    setBusy(true);
    try {
      await patchTask({ status: task.status === "done" ? "todo" : "done" });
      refresh();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not update task.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSubtask(force = false) {
    if (!subtaskTitle.trim()) return;
    setBusy(true);
    setError("");
    setDailyCapOverride(false);
    try {
      const response = await fetch(
        editingSubtaskId ? `/api/subtasks/${editingSubtaskId}` : `/api/tasks/${task.id}/subtasks`,
        {
          method: editingSubtaskId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: subtaskTitle.trim(),
            durationMin,
            scheduledStart: parseLocalInput(scheduledStart, timeZone),
            force,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "DAILY_CAP") setDailyCapOverride(true);
        throw new Error(data.message ?? data.error ?? "Could not save subtask.");
      }
      setSubtaskTitle("");
      setScheduledStart("");
      setEditingSubtaskId(null);
      setShowSubtaskForm(false);
      refresh();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not add subtask.");
    } finally {
      setBusy(false);
    }
  }

  async function updateSubtask(id: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/subtasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? data.error ?? "Could not update subtask.");
      refresh();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not update subtask.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        deleteTarget.kind === "task" ? `/api/tasks/${deleteTarget.id}` : `/api/subtasks/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? data.message ?? `Could not delete ${deleteTarget.kind}.`);
      if (deleteTarget.kind === "task") onRemove(task.id, data.undoAvailable === true);
      else refresh();
      setDeleteTarget(null);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : `Could not delete ${deleteTarget.kind}.`);
    } finally {
      setBusy(false);
    }
  }

  async function saveDeadline() {
    setBusy(true);
    setError("");
    try {
      await patchTask({ deadline: parseLocalInput(deadlineInput, timeZone) });
      setAffected([]);
      setDeadlineEdit(false);
      refresh();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not update deadline.");
    } finally {
      setBusy(false);
    }
  }

  async function proposeSchedule() {
    setScheduleBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/tasks/${task.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "propose" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not propose a schedule.");
      setScheduleProposal(data.proposals);
      setProposalRemainder(data.unscheduledCount);
      if (!data.proposals.length) setError("No free time was found before the deadline.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not propose a schedule.");
    } finally {
      setScheduleBusy(false);
    }
  }

  async function acceptSchedule() {
    if (!scheduleProposal?.length) return;
    setScheduleBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/tasks/${task.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept",
          assignments: scheduleProposal.map(({ subtaskId, start }) => ({ subtaskId, start })),
        }),
      });
      const data = await response.json();
      setScheduleProposal(null);
      refresh();
      if (!response.ok) {
        const partial = data.scheduledCount > 0 ? ` Scheduled ${data.scheduledCount} before the rest was blocked.` : "";
        throw new Error(`${data.error ?? "Could not accept the schedule."}${partial}`);
      }
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not accept the schedule.");
    } finally {
      setScheduleBusy(false);
    }
  }

  async function resolveDeadline(action: "move" | "unschedule") {
    setBusy(true);
    setError("");
    try {
      for (const item of affected) {
        const subtask = task.subtasks.find((candidate) => candidate.id === item.id);
        if (!subtask) continue;
        const scheduled = asDate(subtask.scheduledStart);
        const newDeadline = parseLocalInput(deadlineInput, timeZone);
        if (action === "unschedule") {
          await updateSubtask(item.id, { scheduledStart: null });
        } else if (scheduled && newDeadline) {
          const end = new Date(newDeadline).getTime() - subtask.durationMin * 60_000;
          await updateSubtask(item.id, { scheduledStart: new Date(end).toISOString() });
        }
      }
      await patchTask({ deadline: parseLocalInput(deadlineInput, timeZone) });
      setAffected([]);
      setDeadlineEdit(false);
      refresh();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not apply the deadline change.");
    } finally {
      setBusy(false);
    }
  }

  const deadline = asDate(task.deadline);
  const ends = task.subtasks.map((subtask) => {
    const start = asDate(subtask.scheduledStart);
    return { ...subtask, start, end: start ? new Date(start.getTime() + subtask.durationMin * 60_000) : null };
  });

  return (
    <article
      draggable={Boolean(rankControl)}
      onDragStart={rankControl?.dragStart}
      onDragOver={rankControl?.dragOver}
      onDrop={rankControl?.drop}
      onDragEnd={rankControl?.dragEnd}
      className={cn("rounded-2xl border border-white/10 bg-white/[0.025]", rankControl && "cursor-grab active:cursor-grabbing", rankControl?.isDragging && "opacity-50")}
    >
      <header className="flex items-start gap-2.5 p-3">
        <button onClick={() => void togglePriority()} disabled={busy} aria-label={task.isPriority ? "Remove priority" : "Make priority"} className="mt-0.5 text-amber-300">
          <Star className={cn("h-4 w-4", task.isPriority && "fill-amber-400")} />
        </button>
        {rankControl && <div className="flex flex-col">
          <button disabled={rankControl.index === 0} onClick={() => rankControl.move(-1)} aria-label="Move priority up" className="text-white/35 disabled:opacity-20"><ArrowUp className="h-3 w-3" /></button>
          <button disabled={rankControl.index === rankControl.count - 1} onClick={() => rankControl.move(1)} aria-label="Move priority down" className="text-white/35 disabled:opacity-20"><ArrowDown className="h-3 w-3" /></button>
        </div>}
        <button onClick={() => setExpanded((value) => !value)} className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-1.5">
            {expanded ? <ChevronDown className="h-3.5 w-3.5 text-white/40" /> : <ChevronRight className="h-3.5 w-3.5 text-white/40" />}
            <span className={cn("truncate text-sm font-semibold text-white", task.status === "done" && "line-through opacity-50")}>{task.title}</span>
          </span>
          <span className="ml-5 mt-1 flex flex-wrap items-center gap-x-2 text-[0.68rem] text-white/50">
            <span className={task.rollup.isOverdue ? "text-rose-300" : task.rollup.atRisk ? "text-amber-300" : ""}>
              {deadline ? `Due ${formatInZone(deadline, timeZone, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : "No deadline"}
            </span>
            <span>·</span><span>{humanizeMinutes(task.rollup.totalMin)} total</span>
            <span>·</span><span>{task.rollup.subtaskDone}/{task.rollup.subtaskCount}</span>
            {task.rollup.isOverdue && <span className="text-rose-300">Overdue</span>}
            {!task.rollup.isOverdue && task.rollup.atRisk && <span className="text-amber-300">At risk</span>}
          </span>
          <span className="ml-5 mt-2 block h-1.5 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full rounded-full bg-violet-400" style={{ width: `${task.rollup.progressPct}%` }} />
          </span>
        </button>
        <button onClick={() => void toggleDone()} disabled={busy} className="rounded-lg border border-white/10 p-1.5 text-white/55 hover:text-emerald-300" aria-label={task.status === "done" ? "Reopen main task" : "Complete main task"}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className={cn("h-4 w-4", task.status === "done" && "text-emerald-300")} />}
        </button>
        <button ref={deleteTriggerRef} onClick={() => setDeleteTarget({ kind: "task", id: task.id, title: task.title })} disabled={busy} className="rounded-lg p-1.5 text-white/30 transition-colors hover:bg-rose-400/10 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/70" aria-label="Delete task">
          <Trash2 className="h-4 w-4" />
        </button>
      </header>

      {expanded && (
        <div className="border-t border-white/[0.07] px-3 pb-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[0.68rem] text-white/45">
            <span>Total {humanizeMinutes(task.rollup.totalMin)}</span>
            <span>Scheduled {humanizeMinutes(task.rollup.scheduledMin)}</span>
            <span>Unscheduled {humanizeMinutes(task.rollup.unscheduledMin)}</span>
            <button onClick={() => setDeadlineEdit((value) => !value)} className="text-violet-300 hover:text-violet-200">
              {deadlineEdit ? "Cancel deadline edit" : "Edit deadline"}
            </button>
          </div>
          {deadlineEdit && (
            <div className="mb-2 flex flex-wrap gap-2">
              <input aria-label="Main task deadline" type="datetime-local" value={deadlineInput} onChange={(event) => setDeadlineInput(event.target.value)} className="field flex-1" />
              <button onClick={() => void saveDeadline()} disabled={busy} className="btn btn-primary">Save deadline</button>
            </div>
          )}
          {affected.length > 0 && (
            <div className="mb-2 rounded-xl border border-amber-400/25 bg-amber-400/10 p-2.5 text-xs text-amber-100">
              <p>This deadline affects: {affected.map((item) => item.title).join(", ")}.</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => void resolveDeadline("move")} className="btn btn-ghost">Move earlier</button>
                <button onClick={() => void resolveDeadline("unschedule")} className="btn btn-ghost">Unschedule</button>
              </div>
            </div>
          )}
          {deadline && task.subtasks.some((subtask) => subtask.status !== "done" && !subtask.scheduledStart) && (
            <div className="mb-2 rounded-xl border border-sky-300/15 bg-sky-300/[0.04] p-2.5">
              <button onClick={() => void proposeSchedule()} disabled={scheduleBusy} className="btn btn-ghost text-sky-200">
                {scheduleBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
                Propose schedule
              </button>
              {scheduleProposal && (
                <div className="mt-2">
                  <ul className="space-y-1 text-xs text-white/70">
                    {scheduleProposal.map((proposal) => (
                      <li key={proposal.subtaskId}>
                        {proposal.title} · {formatInZone(new Date(proposal.start), timeZone, { weekday: "short", day: "numeric", month: "short" })} · {formatInZone(new Date(proposal.start), timeZone, { hour: "numeric", minute: "2-digit" })}–{formatInZone(new Date(proposal.end), timeZone, { hour: "numeric", minute: "2-digit" })}
                      </li>
                    ))}
                  </ul>
                  {proposalRemainder > 0 && <p className="mt-1 text-[0.68rem] text-amber-200">{proposalRemainder} subtask(s) had no free slot before the deadline.</p>}
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => void acceptSchedule()} disabled={scheduleBusy} className="btn btn-primary">Accept schedule</button>
                    <button onClick={() => setScheduleProposal(null)} disabled={scheduleBusy} className="btn btn-ghost">Dismiss</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {ends.length > 0 ? (
            <ul className="divide-y divide-white/[0.06]">
              {ends.map((subtask) => (
                <li key={subtask.id} className="flex flex-wrap items-center gap-2 py-2">
                  <button
                    onClick={() => void updateSubtask(subtask.id, { status: subtask.status === "done" ? "todo" : "done" })}
                    className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border", subtask.status === "done" ? "border-emerald-300 bg-emerald-300 text-black" : "border-white/25 text-transparent")}
                    aria-label={subtask.status === "done" ? `Reopen ${subtask.title}` : `Complete ${subtask.title}`}
                  ><Check className="h-3 w-3" /></button>
                  <span className={cn("min-w-0 flex-1 text-xs text-white/80", subtask.status === "done" && "line-through opacity-50")}>{subtask.title}</span>
                  <span className="flex items-center gap-1 text-[0.68rem] text-white/45">
                    <Clock3 className="h-3 w-3" />
                    {subtask.start
                      ? `${formatInZone(subtask.start, timeZone, { weekday: "short", day: "numeric", month: "short" })} · ${formatInZone(subtask.start, timeZone, { hour: "numeric", minute: "2-digit" })}–${formatInZone(subtask.end!, timeZone, { hour: "numeric", minute: "2-digit" })}`
                      : "Not scheduled"}
                    {" · "}{humanizeMinutes(subtask.durationMin)}
                  </span>
                  <button
                    onClick={() => {
                      setEditingSubtaskId(subtask.id);
                      setSubtaskTitle(subtask.title);
                      setDurationMin(subtask.durationMin);
                      setScheduledStart(subtask.start ? localInput(subtask.start, timeZone) : "");
                      setShowSubtaskForm(true);
                    }}
                    className="text-[0.65rem] text-white/35 hover:text-violet-200"
                  >
                    Edit
                  </button>
                  {subtask.start && <button onClick={() => void updateSubtask(subtask.id, { scheduledStart: null })} className="text-[0.65rem] text-white/35 hover:text-amber-200">Unschedule</button>}
                  <button onClick={(event) => { deleteTriggerRef.current = event.currentTarget; setDeleteTarget({ kind: "subtask", id: subtask.id, title: subtask.title }); }} disabled={busy} className="rounded-md p-1 text-white/30 transition-colors hover:bg-rose-400/10 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/70" aria-label={`Delete ${subtask.title}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          ) : <p className="py-2 text-xs text-white/40">No time allocated yet. Add a subtask to plan time.</p>}

          {showSubtaskForm ? (
            <form onSubmit={(event) => { event.preventDefault(); void saveSubtask(); }} className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_minmax(11rem,auto)_auto]">
              <input value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} placeholder="Subtask title" className="field" required />
              <select value={durationMin} onChange={(event) => setDurationMin(Number(event.target.value))} className="field">
                {[15, 30, 45, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}
              </select>
              <input aria-label="Subtask start" type="datetime-local" value={scheduledStart} onChange={(event) => setScheduledStart(event.target.value)} className="field" />
              <button disabled={busy} className="btn btn-primary"><Plus className="h-3.5 w-3.5" /> {editingSubtaskId ? "Save" : "Add"}</button>
              {dailyCapOverride && <button type="button" onClick={() => void saveSubtask(true)} className="btn btn-ghost text-amber-200">Override daily cap</button>}
            </form>
          ) : (
            <button onClick={() => { setEditingSubtaskId(null); setSubtaskTitle(""); setDurationMin(30); setScheduledStart(""); setShowSubtaskForm(true); }} className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-white/15 py-2 text-xs text-white/50 hover:text-white/80"><Plus className="h-3.5 w-3.5" /> Add subtask</button>
          )}
          {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
        </div>
      )}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setDeleteTarget(null);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`delete-title-${task.id}`}
            aria-describedby={`delete-description-${task.id}`}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#15171c] shadow-2xl shadow-black/50"
          >
            <header className="flex items-start gap-3 border-b border-white/[0.07] px-5 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-400/10 text-rose-300">
                <Trash2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id={`delete-title-${task.id}`} className="text-sm font-semibold text-white">
                  Delete {deleteTarget.kind === "task" ? "main task" : "subtask"}?
                </h2>
                <p id={`delete-description-${task.id}`} className="mt-1 break-words text-sm leading-6 text-white/55">
                  “{deleteTarget.title}”
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={busy}
                aria-label="Close delete confirmation"
                className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="px-5 py-4">
              <p className="text-sm leading-6 text-white/65">
                {deleteTarget.kind === "task"
                  ? `This also removes ${task.subtasks.length} ${task.subtasks.length === 1 ? "subtask" : "subtasks"} and cancels any linked calendar blocks.`
                  : "This removes the subtask and cancels its linked calendar block, if it has one."}
                {deleteTarget.kind === "task" && " You can undo this deletion afterward."}
              </p>
              {error && <p role="alert" className="mt-3 rounded-lg border border-rose-300/15 bg-rose-300/[0.06] px-3 py-2 text-sm text-rose-200">{error}</p>}
            </div>
            <footer className="flex justify-end gap-2 border-t border-white/[0.07] bg-white/[0.02] px-5 py-3">
              <button
                ref={cancelDeleteRef}
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={busy}
                className="rounded-lg px-3 py-2 text-sm text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={busy}
                className="inline-flex min-w-28 items-center justify-center gap-2 rounded-lg bg-rose-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200/80 disabled:cursor-wait disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {busy ? "Deleting…" : "Delete"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </article>
  );
}

export function MainTaskBoard({ tasks: initialTasks, domainSlug, domainName, timeZone, priorityView, compact, maxVisible, domains = [] }: MainTaskBoardProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState(Boolean(priorityView));
  const [selectedDomain, setSelectedDomain] = useState(domainSlug ?? (priorityView ? "" : domains[0]?.slug ?? ""));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"active" | "risk" | "done">("active");
  const [domainFilter, setDomainFilter] = useState<"all" | "priority" | "risk" | "done">("all");
  const [sort, setSort] = useState<"deadline" | "priority" | "manual">(priorityView ? "manual" : "deadline");
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [undoBusy, setUndoBusy] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  useEffect(() => setTasks(initialTasks), [initialTasks]);

  const visible = useMemo(() => {
    let rows = tasks;
    if (priorityView && tab === "active") rows = rows.filter((task) => task.isPriority && task.status !== "done");
    if (priorityView && tab === "risk") rows = rows.filter((task) => task.isPriority && task.status !== "done" && (task.rollup.isOverdue || task.rollup.atRisk));
    if (priorityView && tab === "done") rows = rows.filter((task) => task.isPriority && task.status === "done");
    if (priorityView && selectedDomain) rows = rows.filter((task) => task.domainSlug === selectedDomain);
    if (!priorityView && domainFilter === "priority") rows = rows.filter((task) => task.isPriority);
    if (!priorityView && domainFilter === "risk") rows = rows.filter((task) => task.rollup.isOverdue || task.rollup.atRisk);
    if (!priorityView && domainFilter === "done") rows = rows.filter((task) => task.status === "done");
    return [...rows].sort((a, b) => {
      if (sort === "manual") {
        const rankDifference = (a.priorityRank ?? Number.MAX_SAFE_INTEGER) - (b.priorityRank ?? Number.MAX_SAFE_INTEGER);
        if (rankDifference) return rankDifference;
        return (asDate(a.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER) -
          (asDate(b.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER);
      }
      if (sort === "priority" && (a.isPriority !== b.isPriority)) return a.isPriority ? -1 : 1;
      if (a.rollup.isOverdue !== b.rollup.isOverdue) return a.rollup.isOverdue ? -1 : 1;
      const aDeadline = asDate(a.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDeadline = asDate(b.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aDeadline - bDeadline || (a.priorityRank ?? Number.MAX_SAFE_INTEGER) - (b.priorityRank ?? Number.MAX_SAFE_INTEGER);
    });
  }, [tasks, priorityView, tab, domainFilter, sort, selectedDomain]);
  const activePriorityCount = countActivePriorities(tasks);
  const displayedTasks = maxVisible ? visible.slice(0, maxVisible) : visible;

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    const targetDomain = domainSlug ?? (selectedDomain || domains[0]?.slug);
    if (!title.trim() || !targetDomain) return;
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domainSlug: targetDomain,
          title: title.trim(),
          deadline: parseLocalInput(deadline, timeZone),
          isPriority: priority,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? data.message ?? "Could not create task.");
      setTitle("");
      setDeadline("");
      setError(data.warning ?? "");
      router.refresh();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not create task.");
    } finally {
      setCreating(false);
    }
  }

  function refresh() {
    setTasks(initialTasks);
    router.refresh();
  }

  async function undoDelete() {
    setUndoBusy(true);
    setError("");
    try {
      const response = await fetch("/api/undo", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message ?? "Could not undo deletion.");
      setUndoAvailable(false);
      router.refresh();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not undo deletion.");
    } finally {
      setUndoBusy(false);
    }
  }

  async function movePriority(taskId: string, targetIndex: number) {
    const currentOrder = visible.map((task) => task.id);
    const sourceIndex = currentOrder.indexOf(taskId);
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= currentOrder.length || sourceIndex === targetIndex) return;
    const [moved] = currentOrder.splice(sourceIndex, 1);
    currentOrder.splice(targetIndex, 0, moved);
    setError("");
    try {
      const response = await fetch("/api/tasks/priorities/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: currentOrder }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not reorder priorities.");
      router.refresh();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not reorder priorities.");
    }
  }

  return (
    <section className="space-y-3">
      {priorityView && !compact && (
        <nav className="flex gap-2" aria-label="Priority task filters">
          {(["active", "risk", "done"] as const).map((value) => (
            <button key={value} onClick={() => setTab(value)} className={cn("rounded-lg px-3 py-1.5 text-xs capitalize", tab === value ? "bg-violet-500/20 text-violet-200" : "bg-white/5 text-white/45")}>{value === "risk" ? "At risk" : value}</button>
          ))}
        </nav>
      )}
      {!priorityView && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav className="flex gap-1.5" aria-label="Task filters">
            {(["all", "priority", "risk", "done"] as const).map((value) => (
              <button key={value} onClick={() => setDomainFilter(value)} className={cn("rounded-lg px-2.5 py-1.5 text-xs capitalize", domainFilter === value ? "bg-violet-500/20 text-violet-200" : "bg-white/5 text-white/45")}>{value === "risk" ? "Overdue / at risk" : value}</button>
            ))}
          </nav>
          <label className="flex items-center gap-2 text-xs text-white/45">Sort
            <select value={sort} onChange={(event) => setSort(event.target.value as "deadline" | "priority" | "manual")} className="field w-auto py-1">
              <option value="deadline">Deadline</option>
              <option value="priority">Priority</option>
              <option value="manual">Manual order</option>
            </select>
          </label>
        </div>
      )}
      {!priorityView && (
        <form onSubmit={createTask} className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)_auto_auto]">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`New ${domainName ?? "main"} task`} className="field" required />
          <input aria-label="Main task deadline" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="field" />
          <button type="button" onClick={() => setPriority((value) => !value)} className={cn("btn btn-ghost", priority && "text-amber-200")}><Star className={cn("h-4 w-4", priority && "fill-amber-300")} /> Priority</button>
          <button disabled={creating || !title.trim()} className="btn btn-primary">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add task</button>
        </form>
      )}
      {priorityView && !compact && (
        <form onSubmit={createTask} className="grid gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,auto)_minmax(12rem,auto)_auto]">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="New priority task" className="field" required />
          <select value={selectedDomain || domains[0]?.slug || ""} onChange={(event) => setSelectedDomain(event.target.value)} className="field" required>
            {domains.map((domain) => <option key={domain.slug} value={domain.slug}>{domain.name}</option>)}
          </select>
          <input aria-label="Main task deadline" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="field" />
          <button disabled={creating || !title.trim()} className="btn btn-primary">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add</button>
        </form>
      )}
      {priorityView && domains.length > 1 && (
        <label className="flex items-center gap-2 text-xs text-white/45">Domain
          <select value={selectedDomain} onChange={(event) => setSelectedDomain(event.target.value)} className="field w-auto py-1">
            <option value="">All domains</option>
            {domains.map((domain) => <option key={domain.slug} value={domain.slug}>{domain.name}</option>)}
          </select>
        </label>
      )}
      {error && <p className="rounded-lg bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
      {undoAvailable && <button onClick={() => void undoDelete()} disabled={undoBusy} className="rounded-lg border border-violet-300/25 bg-violet-400/10 px-3 py-2 text-xs text-violet-200">{undoBusy ? "Undoing…" : "Task deleted · Undo"}</button>}
      {priorityView && (
        <p className="text-xs text-white/45">
          <span className="font-semibold tabular-nums text-amber-200">{activePriorityCount}</span>
          {" "}active {activePriorityCount === 1 ? "priority" : "priorities"}
          {!compact && <span> · Starred tasks only; other tasks stay in their domain lists.</span>}
        </p>
      )}
      {displayedTasks.length ? displayedTasks.map((task, index) => (
        <TaskCard key={task.id} task={task} timeZone={timeZone} refresh={refresh} onRemove={(id, canUndo) => {
          setTasks((current) => current.filter((item) => item.id !== id));
          setUndoAvailable(canUndo);
          router.refresh();
        }}
          rankControl={priorityView && !compact ? {
            index,
            count: displayedTasks.length,
            move: (direction) => { void movePriority(task.id, index + direction); },
            dragStart: (event) => {
              setDraggingTaskId(task.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", task.id);
            },
            dragOver: (event) => event.preventDefault(),
            drop: (event) => {
              event.preventDefault();
              const draggedId = event.dataTransfer.getData("text/plain") || draggingTaskId;
              if (draggedId) void movePriority(draggedId, index);
            },
            dragEnd: () => setDraggingTaskId(null),
            isDragging: draggingTaskId === task.id,
          } : undefined}
        />
      )) : <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">{priorityView ? "No priority tasks in this view." : "No main tasks yet."}</p>}
      {maxVisible !== undefined && visible.length > maxVisible && (
        <p className="text-center text-xs text-white/40">Showing {maxVisible} of {visible.length} active priorities.</p>
      )}
    </section>
  );
}
