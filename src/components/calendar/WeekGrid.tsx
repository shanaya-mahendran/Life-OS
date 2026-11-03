"use client";

import { useRef } from "react";
import type { UiEvent } from "@/lib/dto";
import { cn, withAlpha } from "@/lib/utils";
import { domainFamilyColor } from "@/lib/domains/presentation";
import type { DayCell } from "./calendar-utils";
import { minutesOfDay, timeLabel } from "./calendar-utils";
import { utcToZoned, zonedToUtc } from "@/lib/time";

const ROW_HEIGHT = 56;

interface WeekGridProps {
  days: DayCell[];
  events: UiEvent[];
  timeZone: string;
  dayStartHour: number;
  dayEndHour: number;
  selectedId: string | null;
  onSelectEvent: (event: UiEvent) => void;
  onMoveEvent: (eventId: string, startISO: string) => void;
  onCreateAt: (dayStartISO: string, minutesFromMidnight: number) => void;
}

export function WeekGrid({
  days,
  events,
  timeZone,
  dayStartHour,
  dayEndHour,
  selectedId,
  onSelectEvent,
  onMoveEvent,
  onCreateAt,
}: WeekGridProps) {
  const hours = Array.from({ length: dayEndHour - dayStartHour + 1 }, (_, index) => dayStartHour + index);
  const gridHeight = (dayEndHour - dayStartHour) * ROW_HEIGHT;
  const draggedRef = useRef<string | null>(null);
  const now = new Date();
  const nowMinutes = minutesOfDay(now.toISOString(), timeZone);

  const dayEvents = (key: string) => events.filter((event) => dayKeyOf(event.start) === key);

  function dayKeyOf(iso: string) {
    const local = utcToZoned(new Date(iso), timeZone);
    return `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
  }

  function handleDrop(event: React.DragEvent, day: DayCell) {
    event.preventDefault();
    const id = draggedRef.current ?? event.dataTransfer.getData("text/plain");
    if (!id) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const rawMinutes = dayStartHour * 60 + (offsetY / ROW_HEIGHT) * 60;
    const snapped = Math.max(dayStartHour * 60, Math.min(dayEndHour * 60 - 15, Math.round(rawMinutes / 15) * 15));
    const local = utcToZoned(new Date(day.startISO), timeZone);
    const startISO = zonedToUtc(
      {
        year: local.year,
        month: local.month,
        day: local.day,
        hour: Math.floor(snapped / 60),
        minute: snapped % 60,
      },
      timeZone,
    ).toISOString();
    onMoveEvent(id, startISO);
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid" style={{ gridTemplateColumns: `3.4rem repeat(${days.length}, minmax(0, 1fr))` }}>
          <div />
          {days.map((day) => (
            <div
              key={day.key}
              className={cn(
                "border-b border-white/[0.06] px-2 pb-2 pt-1 text-center",
                day.isToday && "bg-violet-500/[0.07]",
              )}
            >
              <div className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-white/35">
                {day.weekdayShort}
              </div>
              <div
                className={cn(
                  "mx-auto mt-1 grid h-7 w-7 place-items-center rounded-full text-[0.82rem] font-semibold",
                  day.isToday ? "bg-violet-500 text-white shadow-[0_0_18px_-2px_rgba(139,92,246,0.9)]" : "text-white/75",
                )}
              >
                {day.dayNumber}
              </div>
            </div>
          ))}
        </div>

        <div className="grid" style={{ gridTemplateColumns: `3.4rem repeat(${days.length}, minmax(0, 1fr))` }}>
          <div className="relative" style={{ height: gridHeight }}>
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[0.62rem] font-medium text-white/25"
                style={{ top: (hour - dayStartHour) * ROW_HEIGHT }}
              >
                {formatHour(hour)}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const items = dayEvents(day.key);
            return (
              <div
                key={day.key}
                className="relative border-l border-white/[0.045]"
                style={{
                  height: gridHeight,
                  backgroundImage: `repeating-linear-gradient(to bottom, rgba(255,255,255,0.045) 0px, rgba(255,255,255,0.045) 1px, transparent 1px, transparent ${ROW_HEIGHT}px)`,
                  backgroundColor: day.isToday ? "rgba(124,92,255,0.045)" : undefined,
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, day)}
                onClick={(event) => {
                  if (event.target !== event.currentTarget) return;
                  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                  const minutes = dayStartHour * 60 + Math.floor(((event.clientY - rect.top) / ROW_HEIGHT) * 60 / 30) * 30;
                  onCreateAt(day.startISO, minutes);
                }}
              >
                {day.isToday &&
                  nowMinutes >= dayStartHour * 60 &&
                  nowMinutes <= dayEndHour * 60 && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-20"
                      style={{ top: ((nowMinutes - dayStartHour * 60) / 60) * ROW_HEIGHT }}
                    >
                      <div className="relative h-px w-full bg-rose-400/80">
                        <span className="absolute -left-1 -top-[3px] h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_2px_rgba(251,113,133,0.7)]" />
                      </div>
                    </div>
                  )}

                {items.map((event) => {
                  const startMinutes = minutesOfDay(event.start, timeZone);
                  const duration = Math.max(
                    15,
                    Math.round((new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000),
                  );
                  const clampedStart = Math.max(startMinutes, dayStartHour * 60);
                  const clampedEnd = Math.min(startMinutes + duration, dayEndHour * 60);
                  const top = ((clampedStart - dayStartHour * 60) / 60) * ROW_HEIGHT;
                  const height = Math.max(26, ((clampedEnd - clampedStart) / 60) * ROW_HEIGHT - 2);
                  const selected = event.id === selectedId;
                  const short = height < 44;
                  const accent = domainFamilyColor(event.domainSlug, event.domainAccent);

                  return (
                    <button
                      key={`${event.id}-${event.start}`}
                      draggable
                      onDragStart={(dragEvent) => {
                        draggedRef.current = event.id;
                        dragEvent.dataTransfer.setData("text/plain", event.id);
                        dragEvent.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        draggedRef.current = null;
                      }}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onSelectEvent(event);
                      }}
                      className={cn(
                        "group absolute inset-x-1 z-10 overflow-hidden rounded-lg border px-1.5 py-1 text-left transition",
                        "cursor-grab active:cursor-grabbing hover:z-30 hover:brightness-110",
                        selected && "z-30 ring-2 ring-white/60",
                      )}
                      style={{
                        top,
                        height,
                        borderColor: withAlpha(accent, selected ? 0.7 : 0.3),
                        backgroundColor: withAlpha(accent, 0.14),
                        boxShadow: `inset 3px 0 0 0 ${accent}`,
                      }}
                      title={`${event.title} (${duration}m) · ${timeLabel(event.start, timeZone)} – ${timeLabel(
                        event.end,
                        timeZone,
                      )} · ${event.domainName}`}
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: accent }}
                        />
                        <span className="truncate text-[0.7rem] font-semibold leading-tight text-white/95">
                          {event.title}
                        </span>
                        {short && (
                          <span className="ml-auto shrink-0 text-[0.58rem] font-medium text-white/50">
                            {duration}m
                          </span>
                        )}
                      </div>
                      {!short && (
                        <div className="mt-0.5 truncate text-[0.6rem] leading-tight text-white/60">
                          {timeLabel(event.start, timeZone)} – {timeLabel(event.end, timeZone)} ({duration}m)
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatHour(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}
