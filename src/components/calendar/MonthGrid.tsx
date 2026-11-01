"use client";

import type { UiEvent } from "@/lib/dto";
import { cn, withAlpha } from "@/lib/utils";
import { utcToZoned } from "@/lib/time";
import type { DayCell } from "./calendar-utils";
import { timeLabel } from "./calendar-utils";

interface MonthGridProps {
  days: DayCell[];
  events: UiEvent[];
  timeZone: string;
  selectedId: string | null;
  onSelectEvent: (event: UiEvent) => void;
  onOpenDay: (dayISO: string) => void;
}

function keyOf(iso: string, timeZone: string): string {
  const local = utcToZoned(new Date(iso), timeZone);
  return `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
}

export function MonthGrid({ days, events, timeZone, selectedId, onSelectEvent, onOpenDay }: MonthGridProps) {
  const weeks: DayCell[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-7 border-b border-white/[0.06]">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
            <div
              key={label}
              className="px-2 py-2 text-center text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-white/30"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {weeks.flat().map((day) => {
            const items = events
              .filter((event) => keyOf(event.start, timeZone) === day.key)
              .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
            const visible = items.slice(0, 3);
            const overflow = items.length - visible.length;

            return (
              <div
                key={day.key}
                onClick={() => onOpenDay(day.startISO)}
                className={cn(
                  "group relative min-h-[104px] cursor-pointer border-b border-l border-white/[0.045] p-1.5 transition hover:bg-white/[0.03]",
                  !day.inMonth && "opacity-40",
                  day.isToday && "bg-violet-500/[0.07]",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[0.68rem] font-semibold",
                      day.isToday
                        ? "bg-violet-500 text-white shadow-[0_0_14px_-2px_rgba(139,92,246,0.9)]"
                        : "text-white/55",
                    )}
                  >
                    {day.dayNumber}
                  </span>
                  {items.length > 0 && (
                    <span className="text-[0.55rem] text-white/25">{items.length}</span>
                  )}
                </div>

                <div className="space-y-1">
                  {visible.map((event) => {
                    const duration = Math.max(
                      15,
                      Math.round((new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000),
                    );
                    const durLabel =
                      duration < 60
                        ? `${duration}m`
                        : duration % 60 === 0
                          ? `${duration / 60}h`
                          : `${Math.floor(duration / 60)}h ${duration % 60}m`;

                    return (
                      <button
                        key={`${event.id}-${event.start}`}
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          onSelectEvent(event);
                        }}
                        className={cn(
                          "flex w-full items-center gap-1 rounded-md border px-1.5 py-[0.18rem] text-left transition hover:brightness-110",
                          selectedId === event.id && "ring-1 ring-white/60",
                        )}
                        style={{
                          borderColor: withAlpha(event.domainAccent, 0.35),
                          backgroundColor: withAlpha(event.domainAccent, 0.16),
                        }}
                        title={`${event.title} (${durLabel}) · ${timeLabel(event.start, timeZone)} – ${timeLabel(
                          event.end,
                          timeZone,
                        )} · ${event.domainName}`}
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: event.domainAccent }}
                        />
                        <span className="truncate text-[0.63rem] font-medium text-white/85">{event.title}</span>
                        <span className="ml-auto shrink-0 text-[0.55rem] font-medium text-white/45">
                          {durLabel}
                        </span>
                      </button>
                    );
                  })}

                  {overflow > 0 && (
                    <div className="pl-1 text-[0.6rem] font-medium text-violet-300/80">+{overflow} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
