"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Layers, Loader2, Plus, TriangleAlert } from "lucide-react";
import type { UiConflict, UiEvent } from "@/lib/dto";
import { addZonedDays, utcToZoned, zonedToUtc } from "@/lib/time";
import { cn, withAlpha } from "@/lib/utils";
import { domainFamilyColor } from "@/lib/domains/presentation";
import { Modal } from "@/components/ui/Modal";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";
import { WeekGrid } from "./WeekGrid";
import { MonthGrid } from "./MonthGrid";
import { EventDrawer } from "./EventDrawer";
import { EventForm, type EventFormPayload } from "./EventForm";
import { buildDayCells, monthCells, monthYearLabel, weekCells, weekRangeLabel } from "./calendar-utils";

type View = "month" | "week" | "day";

interface CalendarBoardProps {
  initialEvents: UiEvent[];
  domains: { slug: string; name: string; accent: string }[];
  timeZone: string;
  dayStartHour: number;
  dayEndHour: number;
  initialDateISO: string;
  initialView?: View;
}

type PendingWrite =
  | { kind: "create"; payload: EventFormPayload; conflicts: UiConflict[] }
  | { kind: "update"; eventId: string; patch: Record<string, unknown>; conflicts: UiConflict[] }
  | { kind: "delete"; eventId: string; conflicts: UiConflict[] };

export function CalendarBoard({
  initialEvents,
  domains,
  timeZone,
  dayStartHour,
  dayEndHour,
  initialDateISO,
  initialView = "week",
}: CalendarBoardProps) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [anchor, setAnchor] = useState(() => new Date(initialDateISO));
  const [events, setEvents] = useState<UiEvent[]>(initialEvents);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<UiEvent | null>(null);
  const [hiddenDomains, setHiddenDomains] = useState<Set<string>>(new Set());
  const [layersOpen, setLayersOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formEvent, setFormEvent] = useState<UiEvent | null>(null);
  const [formDefaults, setFormDefaults] = useState<{ startISO: string; domainSlug?: string }>({
    startISO: initialDateISO,
  });
  const [formConflicts, setFormConflicts] = useState<UiConflict[]>([]);
  const [pendingWrite, setPendingWrite] = useState<PendingWrite | null>(null);
  const [busy, setBusy] = useState(false);
  const initialised = useRef(false);
  const loadRevision = useRef(0);

  const pushToast = useCallback((text: string, tone: "success" | "error" = "success") => {
    setToasts((current) => [...current, { id: Date.now() + Math.random(), text, tone }]);
  }, []);

  const { days, fromISO, toISO } = useMemo(() => {
    if (view === "month") {
      const cells = monthCells(anchor, timeZone);
      const last = cells[cells.length - 1];
      const end = addZonedDays(new Date(last.startISO), 1, timeZone);
      return { days: cells, fromISO: cells[0].startISO, toISO: end.toISOString() };
    }
    if (view === "week") {
      const cells = weekCells(anchor, timeZone);
      const end = addZonedDays(new Date(cells[6].startISO), 1, timeZone);
      return { days: cells, fromISO: cells[0].startISO, toISO: end.toISOString() };
    }
    const cells = buildDayCells(anchor, 1, timeZone);
    const end = addZonedDays(new Date(cells[0].startISO), 1, timeZone);
    return { days: cells, fromISO: cells[0].startISO, toISO: end.toISOString() };
  }, [view, anchor, timeZone]);

  const load = useCallback(async () => {
    const request = ++loadRevision.current;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/events?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Could not load events");
      const data = (await response.json()) as { events: UiEvent[] };
      if (request === loadRevision.current) setEvents(data.events);
    } catch {
      if (request === loadRevision.current) pushToast("Could not refresh the calendar.", "error");
    } finally {
      if (request === loadRevision.current) setLoading(false);
    }
  }, [fromISO, toISO, pushToast]);

  useEffect(() => {
    if (!initialised.current) {
      initialised.current = true;
      return;
    }
    void load();
  }, [fromISO, toISO, load]);

  useEffect(() => {
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    const interval = window.setInterval(syncWhenVisible, 15_000);
    window.addEventListener("focus", syncWhenVisible);
    window.addEventListener("lifeos:calendar-changed", syncWhenVisible);
    document.addEventListener("visibilitychange", syncWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", syncWhenVisible);
      window.removeEventListener("lifeos:calendar-changed", syncWhenVisible);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [load]);

  const visibleEvents = useMemo(
    () => events.filter((event) => !hiddenDomains.has(event.domainSlug)),
    [events, hiddenDomains],
  );

  function shift(direction: -1 | 1) {
    const local = utcToZoned(anchor, timeZone);
    if (view === "day") {
      setAnchor(addZonedDays(anchor, direction, timeZone));
      return;
    }
    if (view === "week") {
      setAnchor(addZonedDays(anchor, direction * 7, timeZone));
      return;
    }
    const nextMonth = new Date(Date.UTC(local.year, local.month - 1 + direction, 1));
    setAnchor(
      zonedToUtc(
        { year: nextMonth.getUTCFullYear(), month: nextMonth.getUTCMonth() + 1, day: 1 },
        timeZone,
      ),
    );
  }

  async function createEvent(payload: EventFormPayload) {
    setBusy(true);
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Could not create the event.", "error");
        return;
      }
      if (data.requiresConfirmation) {
        setFormConflicts(data.conflicts ?? []);
        setPendingWrite({ kind: "create", payload, conflicts: data.conflicts ?? [] });
        return;
      }
      setFormOpen(false);
      setFormConflicts([]);
      pushToast(`Added “${payload.title}”.`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function updateEvent(eventId: string, patch: Record<string, unknown>, force = false) {
    setBusy(true);
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, force }),
      });
      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Could not update the event.", "error");
        return;
      }
      if (data.requiresConfirmation && !force) {
        setPendingWrite({ kind: "update", eventId, patch, conflicts: data.conflicts ?? [] });
        return;
      }
      if (data.event) {
        setSelected((current) => (current && current.id === eventId ? data.event : current));
      }
      setFormOpen(false);
      setFormConflicts([]);
      setPendingWrite(null);
      pushToast("Calendar updated.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function cancelEvent(eventId: string) {
    setPendingWrite({
      kind: "delete",
      eventId,
      conflicts: [{ severity: "protected", code: "delete", message: "This event will be cancelled and can be restored with undo." }],
    });
  }

  async function markAchievement(event: UiEvent, achieved: boolean) {
    setBusy(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, start: event.start, achieved }),
      });
      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Could not save this plan outcome.", "error");
        return;
      }

      const achievementStatus: UiEvent["achievementStatus"] = achieved ? "achieved" : "missed";
      const updateOccurrence = (current: UiEvent) =>
        current.id === event.id && current.start === event.start ? { ...current, achievementStatus } : current;
      setEvents((current) => current.map(updateOccurrence));
      setSelected((current) => (current ? updateOccurrence(current) : current));
      pushToast(achieved ? "Plan marked achieved." : "Plan marked not achieved.");
      window.dispatchEvent(new Event("lifeos:calendar-changed"));
      router.refresh();
    } catch {
      pushToast("Could not save this plan outcome. Try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPending() {
    if (!pendingWrite) return;
    if (pendingWrite.kind === "create") {
      await createEvent({ ...pendingWrite.payload, force: true });
    } else if (pendingWrite.kind === "update") {
      await updateEvent(pendingWrite.eventId, pendingWrite.patch, true);
    } else {
      setBusy(true);
      try {
        const response = await fetch(`/api/events/${pendingWrite.eventId}`, { method: "DELETE" });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          pushToast(data.error ?? "Could not cancel the event.", "error");
          return;
        }
        setEvents((current) => current.filter((event) => event.id !== pendingWrite.eventId));
        setSelected(null);
        pushToast("Event cancelled — undo is available in chat.");
        setPendingWrite(null);
        await load();
      } finally {
        setBusy(false);
      }
    }
  }

  function moveEvent(eventId: string, startISO: string) {
    const event = events.find((item) => item.id === eventId);
    if (!event) return;
    const duration = new Date(event.end).getTime() - new Date(event.start).getTime();
    void updateEvent(eventId, {
      start: startISO,
      end: new Date(new Date(startISO).getTime() + duration).toISOString(),
    });
  }

  function openCreate(startISO = initialDateISO, domainSlug?: string) {
    setFormMode("create");
    setFormEvent(null);
    setFormDefaults({ startISO, domainSlug });
    setFormConflicts([]);
    setFormOpen(true);
  }

  function openEdit(event: UiEvent) {
    setFormMode("edit");
    setFormEvent(event);
    setFormConflicts([]);
    setFormOpen(true);
  }

  function openSlot(dayISO: string, minutes: number) {
    const local = utcToZoned(new Date(dayISO), timeZone);
    const start = zonedToUtc(
      {
        year: local.year,
        month: local.month,
        day: local.day,
        hour: Math.floor(minutes / 60),
        minute: minutes % 60,
      },
      timeZone,
    );
    openCreate(start.toISOString());
  }

  const label = view === "month" ? monthYearLabel(anchor.toISOString(), timeZone) : weekRangeLabel(days, timeZone);
  const enabledDomains = domains.filter((domain) => !hiddenDomains.has(domain.slug));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-xl border border-white/[0.07] bg-white/[0.04] p-0.5">
          {(["month", "week", "day"] as View[]).map((option) => (
            <button
              key={option}
              onClick={() => setView(option)}
              className={cn(
                "rounded-[0.6rem] px-3 py-1.5 text-[0.74rem] font-semibold capitalize transition",
                view === option
                  ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-[0_6px_18px_-8px_rgba(124,92,255,0.9)]"
                  : "text-white/45 hover:text-white/75",
              )}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="btn btn-ghost px-2 py-1.5" aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => shift(1)} className="btn btn-ghost px-2 py-1.5" aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setAnchor(new Date())}
            className="btn btn-ghost px-2.5 py-1.5 text-[0.72rem] text-white/70"
          >
            Today
          </button>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-display text-[0.92rem] font-semibold text-white/85">{label}</span>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-300" />}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setLayersOpen((open) => !open)} className="btn btn-ghost">
              <Layers className="h-3.5 w-3.5" /> Layers
            </button>
            {layersOpen && (
              <>
                <button className="fixed inset-0 z-30" onClick={() => setLayersOpen(false)} aria-label="Close layers" />
                <div className="surface absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[16rem] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="label">Domain layers</span>
                    <button
                      onClick={() => setHiddenDomains(new Set())}
                      className="text-[0.62rem] font-semibold text-violet-300 hover:text-violet-200"
                    >
                      Show all
                    </button>
                  </div>
                  <div className="scroll-thin max-h-[16rem] space-y-0.5 overflow-y-auto">
                    {domains.map((domain) => {
                      const visible = !hiddenDomains.has(domain.slug);
                      const accent = domainFamilyColor(domain.slug, domain.accent);
                      return (
                        <button
                          key={domain.slug}
                          onClick={() =>
                            setHiddenDomains((current) => {
                              const next = new Set(current);
                              if (next.has(domain.slug)) next.delete(domain.slug);
                              else next.add(domain.slug);
                              return next;
                            })
                          }
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[0.75rem] text-white/65 transition hover:bg-white/5"
                        >
                          <span
                            className="h-2 w-2 rounded-full transition"
                            style={{
                              backgroundColor: visible ? accent : "transparent",
                              border: `1px solid ${accent}`,
                            }}
                          />
                          <span className={visible ? "" : "text-white/30"}>{domain.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          <button onClick={() => openCreate()} className="btn btn-primary">
            <Plus className="h-3.5 w-3.5" /> New event
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="surface relative min-w-0 flex-1 overflow-hidden p-2 sm:p-3">
          {view === "month" ? (
            <MonthGrid
              days={days}
              events={visibleEvents}
              timeZone={timeZone}
              selectedId={selected?.id ?? null}
              onSelectEvent={(event) => setSelected(event)}
              onOpenDay={(dayISO) => {
                setAnchor(new Date(dayISO));
                setView("day");
              }}
            />
          ) : (
            <WeekGrid
              days={days}
              events={visibleEvents}
              timeZone={timeZone}
              dayStartHour={dayStartHour}
              dayEndHour={dayEndHour}
              selectedId={selected?.id ?? null}
              onSelectEvent={(event) => setSelected(event)}
              onMoveEvent={moveEvent}
              onCreateAt={openSlot}
            />
          )}

          <div className="mt-2 flex items-center justify-end border-t border-white/[0.05] pt-2">
            <span className="ml-auto hidden text-[0.6rem] text-white/25 sm:block">
              Drag a block to move it · click empty space to create
            </span>
          </div>
        </div>

        {selected && (
          <EventDrawer
            event={selected}
            timeZone={timeZone}
            busy={busy}
            onClose={() => setSelected(null)}
            onEdit={openEdit}
            onNudge={(event, minutes) => {
              const start = new Date(new Date(event.start).getTime() + minutes * 60_000).toISOString();
              const end = new Date(new Date(event.end).getTime() + minutes * 60_000).toISOString();
              void updateEvent(event.id, { start, end });
            }}
            onDelete={(event) => void cancelEvent(event.id)}
            onMarkAchievement={(event, achieved) => void markAchievement(event, achieved)}
          />
        )}
      </div>

      <EventForm
        open={formOpen}
        mode={formMode}
        event={formEvent}
        defaults={formDefaults}
        domains={domains}
        timeZone={timeZone}
        conflicts={formConflicts}
        pending={busy}
        onClose={() => {
          setFormOpen(false);
          setFormConflicts([]);
          setPendingWrite(null);
        }}
        onSubmit={(payload) => {
          if (formMode === "edit" && formEvent) {
            void updateEvent(formEvent.id, {
              title: payload.title,
              domainSlug: payload.domainSlug,
              start: payload.start,
              end: payload.end,
              description: payload.description,
              location: payload.location,
              recurrence: payload.recurrence,
              force: payload.force,
            });
          } else {
            void createEvent(payload);
          }
        }}
      />

      <Modal
        open={Boolean(pendingWrite)}
        onClose={() => setPendingWrite(null)}
        title={pendingWrite?.kind === "delete" ? "Cancel this event?" : "Confirm this change"}
        subtitle="Protected time and conflicts need an explicit yes."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setPendingWrite(null)} className="btn btn-ghost">
              Keep as is
            </button>
            <button onClick={() => void confirmPending()} disabled={busy} className="btn btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {pendingWrite?.kind === "delete" ? "Cancel event" : "Save anyway"}
            </button>
          </div>
        }
      >
        <div className="space-y-2">
          {pendingWrite?.conflicts.map((conflict, index) => (
            <div
              key={index}
              className="flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2.5 py-2 text-[0.74rem] text-amber-100"
            >
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {conflict.message}
            </div>
          ))}
        </div>
      </Modal>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
    </div>
  );
}
