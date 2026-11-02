"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2, Plus, Sparkles, Star, Zap } from "lucide-react";
import { DomainIcon } from "@/components/domain/DomainIcon";
import { cn, withAlpha } from "@/lib/utils";

export interface ChecklistTask {
  id: string;
  title: string;
  domainSlug: string;
  domainName: string;
  domainIcon?: string;
  accent: string;
  dueLabel: string | null;
  status: string;
  estimateMinutes?: number;
  priority?: number;
}

export interface DomainOption {
  slug: string;
  name: string;
  accent: string;
  icon?: string;
}

interface TaskChecklistProps {
  tasks: ChecklistTask[];
  emptyText?: string;
  showDomain?: boolean;
  className?: string;
  availableDomains?: DomainOption[];
  allowQuickAdd?: boolean;
}

export function TaskChecklist({
  tasks,
  emptyText = "No open priority tasks today. Add one below or ask LifeOS!",
  showDomain = true,
  className,
  availableDomains = [],
  allowQuickAdd = true,
}: TaskChecklistProps) {
  const router = useRouter();
  const [items, setItems] = useState<ChecklistTask[]>(tasks);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [starPendingId, setStarPendingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDomain, setNewDomain] = useState(availableDomains[0]?.slug ?? "career");
  const [newMinutes, setNewMinutes] = useState(45);
  const [newIsTopPriority, setNewIsTopPriority] = useState(true);
  const [creating, setCreating] = useState(false);
  const [, startTransition] = useTransition();

  // Sync props if changed
  if (tasks !== items && items.length === 0 && tasks.length > 0) {
    setItems(tasks);
  }

  async function toggleStatus(task: ChecklistTask) {
    const nextStatus = task.status === "done" ? "todo" : "done";
    setPendingId(task.id);
    setItems((current) =>
      current.map((item) => (item.id === task.id ? { ...item, status: nextStatus } : item))
    );

    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error("failed");
      startTransition(() => router.refresh());
    } catch {
      setItems((current) =>
        current.map((item) => (item.id === task.id ? { ...item, status: task.status } : item))
      );
    } finally {
      setPendingId(null);
    }
  }

  async function togglePriority(task: ChecklistTask) {
    const currentPriority = task.priority ?? 1;
    const nextPriority = currentPriority >= 2 ? 1 : 3;
    setStarPendingId(task.id);
    setItems((current) =>
      current.map((item) => (item.id === task.id ? { ...item, priority: nextPriority } : item))
    );

    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: nextPriority }),
      });
      if (!response.ok) throw new Error("failed");
      startTransition(() => router.refresh());
    } catch {
      setItems((current) =>
        current.map((item) => (item.id === task.id ? { ...item, priority: currentPriority } : item))
      );
    } finally {
      setStarPendingId(null);
    }
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    setCreating(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domainSlug: newDomain,
          title,
          estimateMinutes: newMinutes,
          priority: newIsTopPriority ? 3 : 1,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to create task");

      const created = data.task;
      const domainObj = availableDomains.find((d) => d.slug === newDomain);
      const newTaskItem: ChecklistTask = {
        id: created.id,
        title: created.title,
        domainSlug: created.domainSlug,
        domainName: created.domainName,
        domainIcon: domainObj?.icon ?? "sparkles",
        accent: created.domainAccent,
        dueLabel: "Today",
        status: created.status,
        estimateMinutes: created.estimateMinutes,
        priority: created.priority,
      };

      setItems((current) => [newTaskItem, ...current]);
      setNewTitle("");
      setShowAddForm(false);
      startTransition(() => router.refresh());
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Quick Add Button / Form */}
      {allowQuickAdd && (
        <div className="mb-2">
          {!showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-400/25 bg-amber-500/[0.08] py-2.5 px-3 text-[0.8rem] font-semibold text-amber-200 transition hover:bg-amber-500/15 hover:border-amber-400/40"
            >
              <Zap className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
              <span>+ Add Top Priority Task</span>
            </button>
          ) : (
            <form
              onSubmit={handleCreateTask}
              className="rounded-2xl border border-amber-400/35 bg-[linear-gradient(135deg,rgba(45,25,15,0.7),rgba(20,12,30,0.9))] p-3.5 shadow-xl animate-[rise_0.18s_ease-out]"
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.08] mb-3">
                <div className="flex items-center gap-1.5 text-[0.78rem] font-bold text-amber-300">
                  <Star className="h-3.5 w-3.5 fill-amber-300" />
                  <span>Create Priority Task</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-[0.7rem] text-white/40 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-2.5">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="What is your top focus priority today?"
                  className="field text-[0.85rem]"
                  autoFocus
                  required
                />

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {availableDomains.length > 0 && (
                    <div className="col-span-2 sm:col-span-1">
                      <select
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        className="field text-[0.75rem] py-1.5"
                      >
                        {availableDomains.map((d) => (
                          <option key={d.slug} value={d.slug} className="bg-[#120b22]">
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <select
                      value={newMinutes}
                      onChange={(e) => setNewMinutes(Number(e.target.value))}
                      className="field text-[0.75rem] py-1.5"
                    >
                      <option value={15} className="bg-[#120b22]">15 min</option>
                      <option value={30} className="bg-[#120b22]">30 min</option>
                      <option value={45} className="bg-[#120b22]">45 min</option>
                      <option value={60} className="bg-[#120b22]">1 hour</option>
                      <option value={90} className="bg-[#120b22]">1.5 hours</option>
                      <option value={120} className="bg-[#120b22]">2 hours</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => setNewIsTopPriority(!newIsTopPriority)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[0.72rem] font-medium transition",
                      newIsTopPriority
                        ? "border-amber-400/50 bg-amber-500/20 text-amber-200"
                        : "border-white/10 bg-white/5 text-white/50"
                    )}
                  >
                    <Star className={cn("h-3 w-3", newIsTopPriority ? "fill-amber-400 text-amber-400" : "")} />
                    <span>{newIsTopPriority ? "Top Priority" : "Normal"}</span>
                  </button>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={creating || !newTitle.trim()}
                    className="btn btn-primary py-1.5 px-4 text-[0.78rem]"
                  >
                    {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    <span>Save Task</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Task List */}
      {!items.length ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-[0.8rem] text-white/40">
          <p>{emptyText}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((task) => {
            const done = task.status === "done";
            const isTopPriority = (task.priority ?? 1) >= 2;

            return (
              <li
                key={task.id}
                className={cn(
                  "group relative flex items-center gap-3 rounded-2xl border p-2.5 sm:p-3 transition-all duration-200",
                  "hover:border-white/20 hover:shadow-lg",
                  isTopPriority && !done && "ring-1 ring-amber-400/30"
                )}
                style={{
                  borderColor: withAlpha(
                    isTopPriority ? "#f59e0b" : task.accent,
                    done ? 0.15 : isTopPriority ? 0.5 : 0.3
                  ),
                  background: isTopPriority && !done
                    ? `linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(18, 12, 34, 0.95))`
                    : `linear-gradient(135deg, ${withAlpha(task.accent, done ? 0.05 : 0.15)}, rgba(15, 10, 28, 0.92))`,
                }}
              >
                {/* Priority Star Toggle Button */}
                <button
                  type="button"
                  onClick={() => void togglePriority(task)}
                  disabled={starPendingId === task.id}
                  title={isTopPriority ? "Mark as Normal Priority" : "Mark as Top Priority"}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg transition hover:scale-110 active:scale-95"
                >
                  {starPendingId === task.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-300" />
                  ) : (
                    <Star
                      className={cn(
                        "h-4 w-4 transition-all",
                        isTopPriority
                          ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                          : "text-white/25 group-hover:text-amber-300/60"
                      )}
                    />
                  )}
                </button>

                {/* Domain Icon Squircle Badge */}
                <div
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl shadow-md transition-transform group-hover:scale-105"
                  style={{
                    backgroundColor: withAlpha(task.accent, 0.25),
                    color: task.accent,
                    border: `1px solid ${withAlpha(task.accent, 0.45)}`,
                  }}
                >
                  <DomainIcon name={task.domainIcon ?? "sparkles"} size={18} />
                </div>

                {/* Task Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "truncate text-[0.88rem] font-semibold tracking-tight transition-colors",
                        done ? "text-white/35 line-through" : "text-white/95"
                      )}
                    >
                      {task.title}
                    </span>
                    {isTopPriority && !done && (
                      <span className="shrink-0 rounded-full border border-amber-400/40 bg-amber-400/15 px-1.5 py-0.2 text-[0.55rem] font-bold text-amber-200 uppercase tracking-wider">
                        Top
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[0.7rem] text-white/50">
                    {task.dueLabel && (
                      <span className={task.dueLabel.toLowerCase().includes("today") ? "text-violet-300 font-medium" : ""}>
                        {task.dueLabel}
                      </span>
                    )}
                    {task.dueLabel && showDomain && <span>•</span>}
                    {showDomain && (
                      <Link
                        href={`/domains/${task.domainSlug}`}
                        className="transition hover:text-violet-200 hover:underline"
                      >
                        {task.domainName}
                      </Link>
                    )}
                    {task.estimateMinutes ? (
                      <>
                        <span>•</span>
                        <span>{task.estimateMinutes}m</span>
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Circular Checkbox */}
                <button
                  onClick={() => void toggleStatus(task)}
                  aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
                  className={cn(
                    "relative grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-all duration-200 active:scale-90",
                    done
                      ? "text-white shadow-[0_0_12px_rgba(139,92,246,0.6)]"
                      : "border-white/25 text-transparent hover:border-violet-400 hover:bg-white/5"
                  )}
                  style={
                    done
                      ? { backgroundColor: task.accent, borderColor: task.accent }
                      : undefined
                  }
                >
                  {pendingId === task.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                  ) : done ? (
                    <Check className="h-4 w-4 stroke-[2.8]" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
