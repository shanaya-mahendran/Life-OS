"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, Clock, Plus } from "lucide-react";
import type { UiEvent } from "@/lib/dto";
import { formatInZone, humanizeMinutes, minutesBetween, timeRangeLabel } from "@/lib/time";
import { withAlpha } from "@/lib/utils";
import { domainFamilyColor } from "@/lib/domains/presentation";

interface TodayScheduleProps {
  initialEvents: UiEvent[];
  fromISO: string;
  toISO: string;
  nowISO: string;
  timeZone: string;
}

const NON_FOCUS_DOMAINS = new Set(["sleep", "food", "rest", "habits"]);

export function TodaySchedule({
  initialEvents,
  fromISO,
  toISO,
  nowISO,
  timeZone,
}: TodayScheduleProps) {
  const [events, setEvents] = useState(initialEvents);
  const revision = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++revision.current;
    try {
      const params = new URLSearchParams({ from: fromISO, to: toISO });
      const response = await fetch(`/api/events?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load today's schedule.");
      const data = (await response.json()) as { events: UiEvent[] };
      if (request === revision.current) setEvents(data.events);
    } catch (error) {
      console.error("[lifeos] Could not sync today's schedule:", error);
    }
  }, [fromISO, toISO]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15_000);
    window.addEventListener("focus", onVisible);
    window.addEventListener("lifeos:calendar-changed", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("lifeos:calendar-changed", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const now = new Date(nowISO);
  const dayStart = new Date(fromISO);
  const nowMinutes = (now.getTime() - dayStart.getTime()) / 60_000;
  const focusMinutes = events.reduce(
    (total, event) =>
      NON_FOCUS_DOMAINS.has(event.domainSlug)
        ? total
        : total + minutesBetween(new Date(event.start), new Date(event.end)),
    0,
  );
  const resolvedEvents = events.filter((event) => event.achievementStatus !== null);
  const achievedEvents = resolvedEvents.filter((event) => event.achievementStatus === "achieved").length;
  const eventProgress = resolvedEvents.length ? Math.round((achievedEvents / resolvedEvents.length) * 100) : 0;

  return (
    <section className="surface flex flex-col p-4 lg:col-span-8">
      <header className="mb-3.5 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-violet-300" />
            <h2 className="font-display text-base font-bold text-white">Today&apos;s Schedule</h2>
          </div>
          <p className="mt-1 text-xs text-white/60">
            {events.length} {events.length === 1 ? "block" : "blocks"} · {humanizeMinutes(focusMinutes)} of planned focus
          </p>
          <div className="mt-2 flex items-center gap-2 text-[0.68rem] text-white/55">
            <span className="shrink-0">
              {resolvedEvents.length
                ? `Today's plans: ${achievedEvents}/${resolvedEvents.length} achieved`
                : "Today's plans: no check-ins yet"}
            </span>
            <div className="h-1 w-20 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-300 transition-[width]"
                style={{ width: `${eventProgress}%` }}
              />
            </div>
          </div>
        </div>
        <Link href="/calendar" className="btn btn-quiet shrink-0 text-sm text-violet-200 hover:text-white">
          <Plus className="h-4 w-4" /> Add event
        </Link>
      </header>

      {events.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl px-4 py-10 text-center">
          <Calendar className="mb-3 h-6 w-6 text-white/45" />
          <p className="text-sm font-medium text-white/75">No blocks scheduled for today</p>
          <p className="mt-1 max-w-xs text-sm text-white/60">
            Ask Mochi to add a block, or create one in the calendar.
          </p>
          <Link href="/chat" className="btn btn-ghost mt-3">
            <Plus className="h-4 w-4" /> Plan with Mochi
          </Link>
        </div>
      ) : (
        <ol className="flex-1 space-y-2.5">
          {events.map((event) => {
            const start = new Date(event.start);
            const end = new Date(event.end);
            const offset = (start.getTime() - dayStart.getTime()) / 60_000;
            const accent = domainFamilyColor(event.domainSlug, event.domainAccent);
            const isNow = offset <= nowMinutes && (end.getTime() - dayStart.getTime()) / 60_000 > nowMinutes;
            const duration = Math.round(minutesBetween(start, end));

            return (
              <li
                key={`${event.id}-${event.start}`}
                className="relative flex min-w-0 items-stretch gap-3 rounded-lg border px-3 py-2.5 transition hover:bg-white/[0.03]"
                style={{
                  borderColor: "rgba(255,255,255,0.12)",
                  borderLeft: `3px solid ${accent}`,
                  backgroundColor: withAlpha(accent, 0.14),
                }}
              >
                <div className="w-[4.2rem] shrink-0 pt-0.5 text-right">
                  <div className="text-sm font-semibold text-white/90">
                    {formatInZone(start, timeZone, { hour: "numeric", minute: "2-digit" })}
                  </div>
                  <div className="text-xs text-white/60">
                    {formatInZone(end, timeZone, { hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
                <div className="min-w-0 flex-1 py-0.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold text-white/95">{event.title}</span>
                    {isNow && <span className="shrink-0 rounded bg-rose-500/15 px-1.5 py-0.5 text-xs font-medium text-rose-200">Now</span>}
                    {event.recurrence && <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-xs text-white/70">Repeating</span>}
                    {event.achievementStatus && (
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                          event.achievementStatus === "achieved"
                            ? "bg-emerald-500/15 text-emerald-200"
                            : "bg-rose-500/15 text-rose-200"
                        }`}
                      >
                        {event.achievementStatus === "achieved" ? "Achieved" : "Not achieved"}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/65">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
                      {event.domainName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{timeRangeLabel(start, end, timeZone)}</span>
                    <span className="rounded bg-white/[0.08] px-1.5 py-0.5">{humanizeMinutes(duration)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
