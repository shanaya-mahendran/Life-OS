"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, CheckCircle2, Clock, Lock, Pencil, Repeat2, ShieldCheck, Sparkles, Trash2, X, XCircle } from "lucide-react";
import type { UiConflict, UiEvent } from "@/lib/dto";
import { withAlpha } from "@/lib/utils";
import { domainFamilyColor } from "@/lib/domains/presentation";
import { formatRecurrence } from "@/lib/calendar/recurrence";
import { dayLabel, rangeLabel } from "./calendar-utils";

interface EventDrawerProps {
  event: UiEvent | null;
  timeZone: string;
  onClose: () => void;
  onEdit: (event: UiEvent) => void;
  onNudge: (event: UiEvent, minutes: number) => void;
  onDelete: (event: UiEvent) => void;
  onMarkAchievement: (event: UiEvent, achieved: boolean) => void;
  busy?: boolean;
}

export function EventDrawer({
  event,
  timeZone,
  onClose,
  onEdit,
  onNudge,
  onDelete,
  onMarkAchievement,
  busy,
}: EventDrawerProps) {
  const [conflicts, setConflicts] = useState<UiConflict[] | null>(null);

  useEffect(() => {
    setConflicts(null);
    if (!event) return;
    let cancelled = false;
    fetch(`/api/events/${event.id}/conflicts`)
      .then((response) => (response.ok ? response.json() : { conflicts: [] }))
      .then((data) => {
        if (!cancelled) setConflicts(data.conflicts ?? []);
      })
      .catch(() => {
        if (!cancelled) setConflicts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [event?.id, event]);

  if (!event) return null;
  const accent = domainFamilyColor(event.domainSlug, event.domainAccent);

  return (
    <aside className="surface fixed inset-x-3 bottom-[calc(max(env(safe-area-inset-bottom,0px),12px)+5.5rem)] z-40 max-h-[68vh] overflow-y-auto p-4 shadow-2xl lg:sticky lg:inset-auto lg:bottom-auto lg:top-[5.2rem] lg:z-10 lg:max-h-[calc(100dvh-7rem)] lg:w-[21rem] lg:shrink-0">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div
          className="flex items-center gap-2.5 rounded-xl border px-2.5 py-2"
          style={{ borderColor: withAlpha(accent, 0.35), backgroundColor: withAlpha(accent, 0.14) }}
        >
          <span
            className="grid h-8 w-8 place-items-center rounded-lg text-[0.7rem] font-bold"
            style={{ backgroundColor: withAlpha(accent, 0.16), color: accent }}
          >
            {event.domainName.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <div className="text-[0.68rem] uppercase tracking-wider text-white/45">{event.domainName}</div>
            <div className="text-[0.82rem] font-semibold text-white">{event.title}</div>
          </div>
        </div>
        <button onClick={onClose} className="btn btn-quiet p-1.5" aria-label="Close details">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1.5 text-[0.78rem] text-white/60">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-white/30" />
          {dayLabel(event.start, timeZone)} · {rangeLabel(event.start, event.end, timeZone)}
        </div>
        {event.recurrence && (
          <div className="flex items-center gap-2">
            <Repeat2 className="h-3.5 w-3.5 text-white/30" />
            {formatRecurrence(
              event.recurrence,
              event.recurrenceUntil ? new Date(event.recurrenceUntil) : null,
              timeZone,
            )}
          </div>
        )}
        {event.location && (
          <div className="flex items-center gap-2">
            <CalendarPlus className="h-3.5 w-3.5 text-white/30" />
            {event.location}
          </div>
        )}
        {event.isProtected && (
          <div className="flex items-center gap-2 text-amber-200/90">
            <Lock className="h-3.5 w-3.5" />
            Protected time — changes need confirmation
          </div>
        )}
      </div>

      {event.description && (
        <p className="mt-3 rounded-xl border border-white/5 bg-white/[0.03] p-2.5 text-[0.76rem] leading-relaxed text-white/55">
          {event.description}
        </p>
      )}

      <div className="mt-4">
        <div className="label mb-1.5">Conflicts</div>
        {conflicts === null ? (
          <div className="h-8 animate-pulse rounded-lg bg-white/5" />
        ) : conflicts.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1.5 text-[0.72rem] text-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            No conflicts — this slot is clean.
          </div>
        ) : (
          <ul className="space-y-1">
            {conflicts.slice(0, 3).map((conflict, index) => (
              <li
                key={index}
                className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 py-1.5 text-[0.7rem] text-amber-100"
              >
                {conflict.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      {new Date(event.end) <= new Date() && (
        <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
          <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/45">
            Plan outcome
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onMarkAchievement(event, true)}
              disabled={busy}
              aria-pressed={event.achievementStatus === "achieved"}
              className={`btn px-2.5 py-1 text-[0.7rem] ${
                event.achievementStatus === "achieved"
                  ? "border border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                  : "btn-ghost"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Achieved
            </button>
            <button
              type="button"
              onClick={() => onMarkAchievement(event, false)}
              disabled={busy}
              aria-pressed={event.achievementStatus === "missed"}
              className={`btn px-2.5 py-1 text-[0.7rem] ${
                event.achievementStatus === "missed"
                  ? "border border-rose-400/40 bg-rose-500/15 text-rose-100"
                  : "btn-ghost"
              }`}
            >
              <XCircle className="h-3.5 w-3.5" /> Not achieved
            </button>
          </div>
          <p className="mt-2 text-[0.65rem] text-white/40">
            {event.achievementStatus
              ? `Marked ${event.achievementStatus === "achieved" ? "achieved" : "not achieved"} for this occurrence.`
              : "Record this occurrence for your daily and weekly progress."}
          </p>
        </div>
      )}

      <div className="mt-4 space-y-1.5">
        <button onClick={() => onEdit(event)} className="btn btn-ghost w-full justify-start">
          <Pencil className="h-3.5 w-3.5" /> Edit details
        </button>
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => onNudge(event, -30)} disabled={busy} className="btn btn-ghost">
            <Clock className="h-3.5 w-3.5" /> 30m earlier
          </button>
          <button onClick={() => onNudge(event, 30)} disabled={busy} className="btn btn-ghost">
            <Clock className="h-3.5 w-3.5" /> 30m later
          </button>
        </div>
        <button
          onClick={() => onDelete(event)}
          disabled={busy}
          className="btn w-full justify-start border border-rose-500/25 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
        >
          <Trash2 className="h-3.5 w-3.5" /> Cancel event
        </button>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-violet-400/15 bg-violet-500/[0.07] p-2.5">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" />
        <p className="text-[0.68rem] leading-relaxed text-white/45">
          Ask the agent to move this: <span className="text-white/70">“move {event.title.toLowerCase()} to 7pm”</span>
        </p>
      </div>
    </aside>
  );
}
