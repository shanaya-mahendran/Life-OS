"use client";

import { CalendarClock, Check, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { withAlpha } from "@/lib/utils";
import { domainFamilyColor } from "@/lib/domains/presentation";

export interface ChatChange {
  kind: "event" | "task";
  action: string;
  title: string;
  domainSlug: string;
  domainName: string;
  domainAccent: string;
  start?: string;
  end?: string;
}

const ACTION_LABEL: Record<string, string> = {
  created: "Added",
  moved: "Moved",
  cancelled: "Cancelled",
  completed: "Completed",
  suggested: "Suggested",
};

function formatRange(change: ChatChange, timeZone: string): string | null {
  if (!change.start) return null;
  const start = new Date(change.start);
  const label = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  }).format(start);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(start);
  if (!change.end) return `${label} · ${time}`;
  const end = new Date(change.end);
  const endTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(end);
  const duration = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  const durLabel =
    duration < 60
      ? `${duration}m`
      : duration % 60 === 0
        ? `${duration / 60}h`
        : `${Math.floor(duration / 60)}h ${duration % 60}m`;
  return `${label} · ${time} – ${endTime} (${durLabel})`;
}

interface ChangeCardProps {
  change: ChatChange;
  timeZone: string;
  undone?: boolean;
  busy?: boolean;
  onUndo?: () => void;
}

export function ChangeCard({ change, timeZone, undone, busy, onUndo }: ChangeCardProps) {
  const range = formatRange(change, timeZone);
  const accent = domainFamilyColor(change.domainSlug, change.domainAccent);

  return (
    <div
      className="mt-2 overflow-hidden rounded-xl border"
      style={{
        borderColor: withAlpha(accent, 0.32),
        background: `linear-gradient(150deg, ${withAlpha(accent, 0.16)}, rgba(13,9,25,0.9))`,
      }}
    >
      <div className="flex items-start gap-2.5 p-2.5">
        <span
          className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[0.6rem] font-bold uppercase text-white"
          style={{ backgroundColor: withAlpha(accent, 0.65) }}
        >
          {change.kind === "task" ? <Check className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em]" style={{ color: accent }}>
              {ACTION_LABEL[change.action] ?? change.action}
            </span>
            <span className="text-[0.6rem] text-white/30">· {change.domainName}</span>
          </div>
          <div className={`truncate text-[0.82rem] font-medium ${undone ? "text-white/35 line-through" : "text-white/90"}`}>
            {change.title}
          </div>
          {range && <div className="mt-0.5 text-[0.68rem] text-white/45">{range}</div>}
        </div>

        {onUndo && (
          <button
            onClick={onUndo}
            disabled={busy || undone}
            className="btn btn-ghost shrink-0 px-2 py-1 text-[0.66rem]"
            title="Undo this change"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            {undone ? "Undone" : "Undo"}
          </button>
        )}
      </div>
    </div>
  );
}

export function PendingCard({
  summary,
  detail,
  busy,
  onConfirm,
  onDecline,
}: {
  summary: string;
  detail?: string | null;
  busy: boolean;
  onConfirm: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="mt-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
      <div className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-amber-100">
        <Sparkles className="h-3.5 w-3.5" /> Needs your yes
      </div>
      <p className="mt-1 text-[0.76rem] text-amber-50/85">{summary}</p>
      {detail && <p className="mt-0.5 text-[0.7rem] text-amber-100/60">{detail}</p>}
      <div className="mt-2.5 flex gap-2">
        <button onClick={onConfirm} disabled={busy} className="btn btn-primary px-3 py-1.5 text-[0.72rem]">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Save anyway
        </button>
        <button onClick={onDecline} disabled={busy} className="btn btn-ghost px-3 py-1.5 text-[0.72rem]">
          Not now
        </button>
      </div>
    </div>
  );
}
