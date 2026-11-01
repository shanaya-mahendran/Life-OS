"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2, Lock } from "lucide-react";
import { cn, withAlpha } from "@/lib/utils";

export interface ChecklistTask {
  id: string;
  title: string;
  domainSlug: string;
  domainName: string;
  accent: string;
  dueLabel: string | null;
  status: string;
  estimateMinutes?: number;
}

interface TaskChecklistProps {
  tasks: ChecklistTask[];
  emptyText?: string;
  showDomain?: boolean;
  className?: string;
}

export function TaskChecklist({ tasks, emptyText = "Nothing due — enjoy the breathing room.", showDomain = true, className }: TaskChecklistProps) {
  const router = useRouter();
  const [items, setItems] = useState(tasks);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function toggle(task: ChecklistTask) {
    const nextStatus = task.status === "done" ? "todo" : "done";
    setPendingId(task.id);
    setItems((current) => current.map((item) => (item.id === task.id ? { ...item, status: nextStatus } : item)));

    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error("failed");
      startTransition(() => router.refresh());
    } catch {
      setItems((current) => current.map((item) => (item.id === task.id ? { ...item, status: task.status } : item)));
    } finally {
      setPendingId(null);
    }
  }

  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-[0.78rem] text-white/35">
        {emptyText}
      </div>
    );
  }

  return (
    <ul className={cn("space-y-1.5", className)}>
      {items.map((task) => {
        const done = task.status === "done";
        return (
          <li
            key={task.id}
            className="group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition"
            style={{
              borderColor: withAlpha(task.accent, done ? 0.12 : 0.24),
              backgroundColor: withAlpha(task.accent, done ? 0.04 : 0.09),
            }}
          >
            <button
              onClick={() => void toggle(task)}
              aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
              className={cn(
                "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition",
                done ? "text-white" : "border-white/25 text-transparent hover:border-white/60",
              )}
              style={done ? { backgroundColor: task.accent, borderColor: task.accent } : undefined}
            >
              {pendingId === task.id ? (
                <Loader2 className="h-3 w-3 animate-spin text-white" />
              ) : (
                <Check className="h-3 w-3" strokeWidth={3} />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div className={cn("truncate text-[0.82rem] font-medium", done ? "text-white/35 line-through" : "text-white/90")}>
                {task.title}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[0.65rem] text-white/40">
                {showDomain && (
                  <Link href={`/domains/${task.domainSlug}`} className="transition hover:text-white/70">
                    {task.domainName}
                  </Link>
                )}
                {task.dueLabel && <span>· due {task.dueLabel}</span>}
                {task.estimateMinutes ? <span>· {task.estimateMinutes}m</span> : null}
              </div>
            </div>

            <Lock className="hidden h-3 w-3 text-white/20 group-hover:block" aria-hidden />
          </li>
        );
      })}
    </ul>
  );
}
