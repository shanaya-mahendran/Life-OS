"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
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
}

interface TaskChecklistProps {
  tasks: ChecklistTask[];
  emptyText?: string;
  showDomain?: boolean;
  className?: string;
}

export function TaskChecklist({
  tasks,
  emptyText = "Nothing due — enjoy the breathing room.",
  showDomain = true,
  className,
}: TaskChecklistProps) {
  const router = useRouter();
  const [items, setItems] = useState(tasks);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function toggle(task: ChecklistTask) {
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

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-[0.8rem] text-white/40">
        {emptyText}
      </div>
    );
  }

  return (
    <ul className={cn("space-y-2.5", className)}>
      {items.map((task) => {
        const done = task.status === "done";
        return (
          <li
            key={task.id}
            className={cn(
              "group relative flex items-center gap-3.5 rounded-2xl border p-3 transition-all duration-200",
              "hover:border-white/20 hover:shadow-lg"
            )}
            style={{
              borderColor: withAlpha(task.accent, done ? 0.15 : 0.35),
              background: `linear-gradient(135deg, ${withAlpha(task.accent, done ? 0.05 : 0.18)}, rgba(15, 10, 28, 0.92))`,
            }}
          >
            {/* Domain Icon Squircle Badge */}
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl shadow-md transition-transform group-hover:scale-105"
              style={{
                backgroundColor: withAlpha(task.accent, 0.25),
                color: task.accent,
                border: `1px solid ${withAlpha(task.accent, 0.45)}`,
              }}
            >
              <DomainIcon name={task.domainIcon ?? "sparkles"} size={20} />
            </div>

            {/* Task Info */}
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "truncate text-[0.88rem] font-semibold tracking-tight transition-colors",
                  done ? "text-white/35 line-through" : "text-white/95"
                )}
              >
                {task.title}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[0.72rem] text-white/50">
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

            {/* Circular Checkbox (on the right, matching user's design) */}
            <button
              onClick={() => void toggle(task)}
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
  );
}
