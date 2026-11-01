import type { Conflict } from "@/lib/calendar/conflicts";
import type { CalendarEvent, CalendarTask } from "@/lib/calendar/types";

export interface UiEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  domainSlug: string;
  domainName: string;
  domainAccent: string;
  isProtected: boolean;
  status: string;
  source: string;
  priority: number;
  location: string;
  recurrence: string | null;
}

export interface UiTask {
  id: string;
  title: string;
  notes: string;
  dueDate: string | null;
  estimateMinutes: number;
  status: string;
  priority: number;
  domainSlug: string;
  domainName: string;
  domainAccent: string;
}

export interface UiConflict {
  severity: Conflict["severity"];
  code: string;
  message: string;
}

export function toUiEvent(event: CalendarEvent): UiEvent {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
    domainSlug: event.domainSlug,
    domainName: event.domainName,
    domainAccent: event.domainAccent,
    isProtected: event.isProtected,
    status: event.status,
    source: event.source,
    priority: event.priority,
    location: event.location,
    recurrence: event.recurrence,
  };
}

export function toUiTask(task: CalendarTask): UiTask {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    estimateMinutes: task.estimateMinutes,
    status: task.status,
    priority: task.priority,
    domainSlug: task.domainSlug,
    domainName: task.domainName,
    domainAccent: task.domainAccent,
  };
}

export function toUiConflicts(conflicts: Conflict[]): UiConflict[] {
  return conflicts.map((conflict) => ({
    severity: conflict.severity,
    code: conflict.code,
    message: conflict.message,
  }));
}
