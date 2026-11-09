"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Clock3, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { formatInZone, humanizeMinutes, zonedToUtc } from "@/lib/time";
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
  const [deadlineInput, setDeadlineInput] = useState(() => {
    const deadline = asDate(task.deadline);
    return deadline ? localInput(deadline, timeZone) : "";
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [affected, setAffected] = useState<{ id: string; title: string }[]>([]);
  const router = useRouter();

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

  async function deleteTask() {
    if (!window.confirm(`Delete “${task.title}” and its subtasks?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not delete task.");
      onRemove(task.id, data.undoAvailable === true);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not delete task.");
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
        <button onClick={() => void deleteTask()} disabled={busy} className="rounded-lg p-1.5 text-white/30 hover:text-rose-300" aria-label="Delete task">
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
                  <button onClick={() => { if (window.confirm(`Delete subtask “${subtask.title}”?`)) void fetch(`/api/subtasks/${subtask.id}`, { method: "DELETE" }).then(refresh); }} className="text-white/30 hover:text-rose-300" aria-label={`Delete ${subtask.title}`}><Trash2 className="h-3.5 w-3.5" /></button>
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
    </article>
  );
}

export function MainTaskBoard({ tasks: initialTasks, domainSlug, domainName, timeZone, priorityView, compact, domains = [] }: MainTaskBoardProps) {
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

  const overdueTasks = useMemo(() => {
    return tasks.filter((t) => t.rollup.isOverdue && t.status !== "done");
  }, [tasks]);

  function setDateShortcut(daysOffset: number, defaultHour = 18) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    d.setHours(defaultHour, 0, 0, 0);
    setDeadline(localInput(d, timeZone));
  }

  async function triageOverdue(action: "tomorrow" | "next_week" | "drop") {
    if (!overdueTasks.length) return;
    setError("");
    try {
      if (action === "drop") {
        for (const t of overdueTasks) {
          await fetch(`/api/tasks/${t.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "slipped" }),
          });
        }
      } else {
        const offset = action === "tomorrow" ? 1 : 7;
        for (const t of overdueTasks) {
          const newDate = new Date();
          newDate.setDate(newDate.getDate() + offset);
          newDate.setHours(18, 0, 0, 0);
          await fetch(`/api/tasks/${t.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deadline: newDate.toISOString() }),
          });
        }
      }
      refresh();
    } catch {
      setError("Failed to triage overdue tasks.");
    }
  }

  return (
    <section className="space-y-3">
      {/* Overdue Triage Banner (Fix #10) */}
      {overdueTasks.length > 0 && !compact && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
          <div>
            <span className="font-semibold">{overdueTasks.length} overdue task(s)</span>
            <p className="text-[0.72rem] text-amber-300/70">Clear the backlog with one tap so late tasks don't turn into guilt.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => void triageOverdue("tomorrow")}
              className="rounded-lg bg-amber-400/20 px-2.5 py-1 text-xs font-medium hover:bg-amber-400/30"
            >
              Move to tomorrow
            </button>
            <button
              type="button"
              onClick={() => void triageOverdue("next_week")}
              className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-white/80 hover:bg-white/15"
            >
              Move to next week
            </button>
            <button
              type="button"
              onClick={() => void triageOverdue("drop")}
              className="rounded-lg bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-300 hover:bg-rose-500/25"
            >
              Drop late tasks
            </button>
          </div>
        </div>
      )}
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
        <div className="space-y-1.5">
          <form onSubmit={createTask} className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)_auto_auto]">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`New ${domainName ?? "main"} task`} className="field" required />
            <input aria-label="Main task deadline" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="field" />
            <button type="button" onClick={() => setPriority((value) => !value)} className={cn("btn btn-ghost", priority && "text-amber-200")}><Star className={cn("h-4 w-4", priority && "fill-amber-300")} /> Priority</button>
            <button disabled={creating || !title.trim()} className="btn btn-primary">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add task</button>
          </form>
          <div className="flex items-center gap-1.5 px-1 text-[0.72rem] text-white/40">
            <span>Quick due date:</span>
            <button type="button" onClick={() => setDateShortcut(0)} className="rounded-md bg-white/[0.05] px-2 py-0.5 hover:bg-white/10 hover:text-white">Today</button>
            <button type="button" onClick={() => setDateShortcut(1)} className="rounded-md bg-white/[0.05] px-2 py-0.5 hover:bg-white/10 hover:text-white">Tomorrow</button>
            <button type="button" onClick={() => setDateShortcut(3)} className="rounded-md bg-white/[0.05] px-2 py-0.5 hover:bg-white/10 hover:text-white">In 3 days</button>
            <button type="button" onClick={() => setDateShortcut(7)} className="rounded-md bg-white/[0.05] px-2 py-0.5 hover:bg-white/10 hover:text-white">Next week</button>
          </div>
        </div>
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
      {visible.length ? visible.map((task, index) => (
        <TaskCard key={task.id} task={task} timeZone={timeZone} refresh={refresh} onRemove={(id, canUndo) => { setTasks((current) => current.filter((item) => item.id !== id)); setUndoAvailable(canUndo); }}
          rankControl={priorityView && !compact ? {
            index,
            count: visible.length,
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
    </section>
  );
}
