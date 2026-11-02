import { DOMAIN_MAP } from "@/lib/domains/catalog";
import type { CalendarEvent, CalendarTask, EventSource, EventStatus } from "./types";

type EventWithDomain = {
  id: string;
  userId: string;
  domainId: string;
  title: string;
  description: string;
  start: Date;
  end: Date;
  allDay: boolean;
  status: string;
  source: string;
  priority: number;
  location: string;
  recurrence: string | null;
  recurrenceUntil: Date | null;
  notes: string;
  domain: { slug: string; name: string; accent: string; isProtected: boolean };
};

export function toCalendarEvent(row: EventWithDomain): CalendarEvent {
  return {
    id: row.id,
    userId: row.userId,
    domainId: row.domainId,
    domainSlug: row.domain.slug,
    domainName: row.domain.name,
    domainAccent: row.domain.accent,
    isProtected:
      row.domain.slug !== "sleep" &&
      row.domain.slug !== "food" &&
      (row.domain.isProtected || DOMAIN_MAP[row.domain.slug]?.protectedByDefault === true),
    title: row.title,
    description: row.description,
    start: row.start,
    end: row.end,
    allDay: row.allDay,
    status: row.status as EventStatus,
    source: row.source as EventSource,
    priority: row.priority,
    location: row.location,
    recurrence: row.recurrence,
    recurrenceUntil: row.recurrenceUntil,
    notes: row.notes,
  };
}

export interface SerializedEvent {
  id: string;
  domainId: string;
  title: string;
  description: string;
  start: string;
  end: string;
  allDay: boolean;
  status: string;
  source: string;
  priority: number;
  location: string;
  recurrence: string | null;
  recurrenceUntil: string | null;
  notes: string;
}

export function serializeEvent(row: {
  id: string;
  domainId: string;
  title: string;
  description: string;
  start: Date;
  end: Date;
  allDay: boolean;
  status: string;
  source: string;
  priority: number;
  location: string;
  recurrence: string | null;
  recurrenceUntil: Date | null;
  notes: string;
}): SerializedEvent {
  return {
    id: row.id,
    domainId: row.domainId,
    title: row.title,
    description: row.description,
    start: row.start.toISOString(),
    end: row.end.toISOString(),
    allDay: row.allDay,
    status: row.status,
    source: row.source,
    priority: row.priority,
    location: row.location,
    recurrence: row.recurrence,
    recurrenceUntil: row.recurrenceUntil ? row.recurrenceUntil.toISOString() : null,
    notes: row.notes,
  };
}

type TaskWithDomain = {
  id: string;
  domainId: string;
  title: string;
  notes: string;
  dueDate: Date | null;
  estimateMinutes: number;
  status: string;
  priority: number;
  domain: { slug: string; name: string; accent: string };
};

export function toCalendarTask(row: TaskWithDomain): CalendarTask {
  return {
    id: row.id,
    domainId: row.domainId,
    domainSlug: row.domain.slug,
    domainName: row.domain.name,
    domainAccent: row.domain.accent,
    title: row.title,
    notes: row.notes,
    dueDate: row.dueDate,
    estimateMinutes: row.estimateMinutes,
    status: row.status as CalendarTask["status"],
    priority: row.priority,
  };
}
