"use client";

import { useEffect, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { DOMAINS } from "@/lib/domains/catalog";
import type { UiConflict, UiEvent } from "@/lib/dto";
import { withAlpha } from "@/lib/utils";
import { zonedToUtc } from "@/lib/time";
import { dayLabel } from "./calendar-utils";

export interface EventFormPayload {
  title: string;
  domainSlug: string;
  start: string;
  end: string;
  description: string;
  location: string;
  recurrence: string | null;
  force?: boolean;
}

interface EventFormProps {
  open: boolean;
  mode: "create" | "edit";
  event?: UiEvent | null;
  defaults?: { startISO: string; domainSlug?: string };
  domains: { slug: string; name: string; accent: string }[];
  timeZone: string;
  conflicts: UiConflict[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: EventFormPayload) => void;
}

function toLocalInput(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const grab = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return {
    date: `${grab("year")}-${grab("month")}-${grab("day")}`,
    time: `${grab("hour")}:${grab("minute")}`,
  };
}

export function EventForm({
  open,
  mode,
  event,
  defaults,
  domains,
  timeZone,
  conflicts,
  pending,
  onClose,
  onSubmit,
}: EventFormProps) {
  const [title, setTitle] = useState("");
  const [domainSlug, setDomainSlug] = useState(domains[0]?.slug ?? "education");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [recurrence, setRecurrence] = useState<string>("");

  const defaultStart = defaults?.startISO;
  const defaultDomain = defaults?.domainSlug;

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && event) {
      const start = toLocalInput(event.start, timeZone);
      const end = toLocalInput(event.end, timeZone);
      setTitle(event.title);
      setDomainSlug(event.domainSlug);
      setDate(start.date);
      setStartTime(start.time);
      setEndTime(end.time);
      setDescription(event.description);
      setLocation(event.location);
      setRecurrence(event.recurrence ?? "");
    } else {
      const source = defaultStart ?? new Date().toISOString();
      const start = toLocalInput(source, timeZone);
      const end = toLocalInput(new Date(new Date(source).getTime() + 60 * 60_000).toISOString(), timeZone);
      setTitle("");
      setDomainSlug(defaultDomain ?? domains[0]?.slug ?? "education");
      setDate(start.date);
      setStartTime(start.time);
      setEndTime(end.time);
      setDescription("");
      setLocation("");
      setRecurrence("");
    }
  }, [open, mode, event, defaultStart, defaultDomain, domains, timeZone]);

  function submit(force = false) {
    const [year, month, day] = date.split("-").map(Number);
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);
    const startISO = zonedToUtc(
      { year, month, day, hour: startHour, minute: startMinute },
      timeZone,
    ).toISOString();
    const endIsNextDay = endHour * 60 + endMinute <= startHour * 60 + startMinute;
    const endISO = zonedToUtc(
      {
        year,
        month,
        day: endIsNextDay ? day + 1 : day,
        hour: endHour,
        minute: endMinute,
      },
      timeZone,
    ).toISOString();
    onSubmit({
      title: title.trim(),
      domainSlug,
      start: startISO,
      end: endISO,
      description,
      location,
      recurrence: recurrence || null,
      force,
    });
  }

  const accent = domains.find((domain) => domain.slug === domainSlug)?.accent ?? "#7c5cff";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "New event" : "Edit event"}
      subtitle={
        mode === "create"
          ? "The agent checks conflicts before saving, exactly like the chat does."
          : `${event?.domainName} · ${event ? dayLabel(event.start, timeZone) : ""}`
      }
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          {conflicts.length > 0 ? (
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={pending || !title.trim()}
              className="btn border border-amber-400/30 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save anyway
            </button>
          ) : (
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={pending || !title.trim()}
              className="btn btn-primary"
              style={{ boxShadow: `0 10px 26px -12px ${withAlpha(accent, 0.9)}` }}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === "create" ? "Create event" : "Save changes"}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-3.5">
        <label className="block space-y-1.5">
          <span className="label">Title</span>
          <input
            value={title}
            onChange={(inputEvent) => setTitle(inputEvent.target.value)}
            placeholder="Karate training"
            className="field"
          />
        </label>

        <div className="space-y-1.5">
          <span className="label">Domain</span>
          <div className="flex flex-wrap gap-1.5">
            {domains.map((domain) => (
              <button
                key={domain.slug}
                type="button"
                onClick={() => setDomainSlug(domain.slug)}
                className="rounded-full border px-2.5 py-1 text-[0.68rem] font-medium transition"
                style={{
                  borderColor: withAlpha(domain.accent, domainSlug === domain.slug ? 0.9 : 0.25),
                  backgroundColor: withAlpha(domain.accent, domainSlug === domain.slug ? 0.25 : 0.08),
                  color: domainSlug === domain.slug ? "#fff" : withAlpha(domain.accent, 0.9),
                }}
              >
                {domain.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="block space-y-1.5">
            <span className="label">Date</span>
            <input type="date" value={date} onChange={(event_) => setDate(event_.target.value)} className="field" />
          </label>
          <label className="block space-y-1.5">
            <span className="label">Start</span>
            <input
              type="time"
              value={startTime}
              onChange={(event_) => setStartTime(event_.target.value)}
              className="field"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="label">End</span>
            <input
              type="time"
              value={endTime}
              onChange={(event_) => setEndTime(event_.target.value)}
              className="field"
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="label">Repeat</span>
          <select value={recurrence} onChange={(event_) => setRecurrence(event_.target.value)} className="field">
            <option value="" className="bg-[#150f28]">
              Does not repeat
            </option>
            <option value="DAILY" className="bg-[#150f28]">
              Every day
            </option>
            <option value="WEEKLY" className="bg-[#150f28]">
              Every week
            </option>
            <option value="WEEKLY:MO,WE,FR" className="bg-[#150f28]">
              Mon, Wed, Fri
            </option>
            <option value="WEEKLY:TU,TH" className="bg-[#150f28]">
              Tue, Thu
            </option>
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="label">Notes</span>
          <textarea
            value={description}
            onChange={(event_) => setDescription(event_.target.value)}
            rows={2}
            placeholder="Anything the agent should remember about this block…"
            className="field resize-none"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="label">Location</span>
          <input
            value={location}
            onChange={(event_) => setLocation(event_.target.value)}
            placeholder="Dojo"
            className="field"
          />
        </label>

        {conflicts.length > 0 && (
          <div className="space-y-1.5 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3">
            <div className="flex items-center gap-2 text-[0.75rem] font-semibold text-amber-100">
              <TriangleAlert className="h-3.5 w-3.5" />
              {conflicts.length === 1 ? "One conflict found" : `${conflicts.length} conflicts found`}
            </div>
            <ul className="space-y-1">
              {conflicts.map((conflict, index) => (
                <li key={index} className="text-[0.72rem] text-amber-100/80">
                  • {conflict.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
