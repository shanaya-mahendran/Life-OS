/** Shared calendar types used by the service, agent tools and UI. */

export type EventStatus = "planned" | "suggested" | "done" | "cancelled";
export type AchievementStatus = "achieved" | "missed" | null;
export type EventSource = "manual" | "agent" | "auto" | "import";

export interface CalendarEvent {
  id: string;
  userId: string;
  domainId: string;
  domainSlug: string;
  domainName: string;
  domainAccent: string;
  isProtected: boolean;
  title: string;
  description: string;
  start: Date;
  end: Date;
  allDay: boolean;
  status: EventStatus;
  achievementStatus: AchievementStatus;
  source: EventSource;
  priority: number;
  location: string;
  recurrence: string | null;
  recurrenceUntil: Date | null;
  notes: string;
}

export interface CalendarTask {
  id: string;
  domainId: string;
  domainSlug: string;
  domainName: string;
  domainAccent: string;
  title: string;
  notes: string;
  dueDate: Date | null;
  estimateMinutes: number;
  status: "todo" | "doing" | "done" | "slipped";
  priority: number;
}

export interface TimeBlock {
  start: Date;
  end: Date;
}

export interface DomainSummary {
  id: string;
  slug: string;
  name: string;
  accent: string;
  icon: string;
  isProtected: boolean;
  isEnabled: boolean;
  goals: string[];
  notes: string;
  sortOrder: number;
}
