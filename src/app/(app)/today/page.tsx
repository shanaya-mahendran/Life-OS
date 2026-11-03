import Link from "next/link";
import {
  Calendar,
  CalendarDays,
  ChevronRight,
  MessageSquare,
  Sparkles,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth";
import { buildMorningBrief } from "@/lib/briefs";
import { getDayOverview, getWeekStats, listEvents } from "@/lib/calendar/service";
import { addZonedDays, formatInZone, startOfWeekMonday } from "@/lib/time";
import { withAlpha } from "@/lib/utils";
import { domainFamilyColor } from "@/lib/domains/presentation";
import { TaskChecklist, type ChecklistTask } from "@/components/today/TaskChecklist";
import { TodaySchedule } from "@/components/today/TodaySchedule";
import { toUiEvent } from "@/lib/dto";

export const metadata = { title: "Today · LifeOS" };
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const { profile, user } = await requireProfile();
  const now = new Date();
  const tz = user.timezone;

  const weekStart = startOfWeekMonday(now, tz);
  const [brief, overview, stats, domains, weekEvents] = await Promise.all([
    buildMorningBrief(user, now),
    getDayOverview(user, now),
    getWeekStats(user, weekStart),
    prisma.domain.findMany({
      where: { userId: profile.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, name: true, accent: true, icon: true, isEnabled: true },
    }),
    listEvents(user, { from: now, to: addZonedDays(now, 7, tz) }),
  ]);

  const domainIconBySlug = new Map(domains.map((row) => [row.slug, row.icon]));

  const priorityTasks: ChecklistTask[] = overview.tasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => {
      const priority = b.priority - a.priority;
      if (priority !== 0) return priority;
      const aDue = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    })
    .slice(0, 6)
    .map((task) => ({
      id: task.id,
      title: task.title,
      domainSlug: task.domainSlug,
      domainName: task.domainName,
      domainIcon: domainIconBySlug.get(task.domainSlug) ?? "sparkles",
      accent: domainFamilyColor(task.domainSlug, task.domainAccent),
      dueLabel: task.dueDate ? formatInZone(task.dueDate, tz, { day: "numeric", month: "short" }) : null,
      status: task.status,
      estimateMinutes: task.estimateMinutes,
      priority: task.priority,
    }));

  const firstName = (profile.name ?? profile.email).split(" ")[0];
  const nowMinutes = (now.getTime() - overview.dayStart.getTime()) / 60_000;
  const openTaskCount = overview.tasks.filter((task) => task.status !== "done").length;
  const statusLine = `${openTaskCount} open task${openTaskCount === 1 ? "" : "s"} today`;
  const actionableWarnings = brief.warnings.filter(
    (warning) => !warning.startsWith("Nothing on the calendar yet today."),
  );

  // 7-day horizontal scrubber
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const dayDate = addZonedDays(weekStart, i, tz);
    const dayDateStr = formatInZone(dayDate, tz, { day: "numeric", month: "numeric" });
    const todayStr = formatInZone(now, tz, { day: "numeric", month: "numeric" });
    const isToday = dayDateStr === todayStr;
    const dayEvents = weekEvents.filter((e) => {
      return formatInZone(e.start, tz, { day: "numeric", month: "numeric" }) === dayDateStr;
    });
    return {
      date: dayDate,
      weekday: formatInZone(dayDate, tz, { weekday: "short" }),
      dayNumber: formatInZone(dayDate, tz, { day: "numeric" }),
      month: formatInZone(dayDate, tz, { month: "short" }),
      isToday,
      hasEvents: dayEvents.length > 0,
      eventCount: dayEvents.length,
      accent: dayEvents[0] ? domainFamilyColor(dayEvents[0].domainSlug, dayEvents[0].domainAccent) : "#a78bfa",
    };
  });

  const domainOptions = domains.map((d) => ({
    slug: d.slug,
    name: d.name,
    accent: domainFamilyColor(d.slug, d.accent),
    icon: d.icon,
  }));

  return (
    <div className="space-y-4">
      {/* Hero Greeting Card */}
      <section className="relative overflow-hidden rounded-2xl border border-violet-400/20 bg-[linear-gradient(120deg,rgba(42,31,77,0.75),var(--bg-surface)_65%)] p-4 sm:p-5">
        <div className="relative">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-300" />
                <h1 className="font-display text-[1.5rem] font-bold leading-tight text-white sm:text-[1.75rem]">
                  {brief.greeting}, <span className="text-violet-200">{firstName}.</span>
                </h1>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/65">
                <Calendar className="h-4 w-4 text-violet-300/80" />
                <span>{statusLine}</span>
                {stats.adherence > 0 && <span className="text-white/45">· {stats.adherence}% tasks complete this week</span>}
              </div>
            </div>

            <Link
              href="/chat"
              className="inline-flex items-center gap-2 self-start sm:self-auto rounded-xl border border-violet-400/30 bg-violet-500/15 px-3 py-1.5 text-[0.78rem] font-semibold text-violet-200 transition hover:bg-violet-500/25 active:scale-95 shadow-sm"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Talk with Mochi</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

        </div>
      </section>

      {/* Warnings & Suggestions */}
      {actionableWarnings.length > 0 && (
        <div className="space-y-1.5">
          {actionableWarnings.map((warning) => (
            <div
              key={warning}
              className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3.5 py-2 text-[0.76rem] text-amber-100"
            >
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Week Scrubber (Compact & Clean) */}
      <section className="surface p-3.5 sm:p-4">
        <header className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-violet-400" />
            <h2 className="font-display text-[0.92rem] font-bold text-white">This Week at a Glance</h2>
          </div>
          <Link href="/calendar" className="text-[0.7rem] font-semibold text-violet-300 hover:text-violet-200">
            Open Full Calendar →
          </Link>
        </header>

        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1 pt-1">
          {weekDays.map((day) => (
            <Link
              key={day.dayNumber}
              href="/calendar"
              className={`flex flex-col items-center justify-between rounded-2xl border px-3 py-2 min-w-[3.4rem] transition-all duration-200 ${
                day.isToday
                  ? "border-violet-400/50 bg-violet-600/25 shadow-[0_0_15px_rgba(139,92,246,0.35)]"
                  : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
              }`}
            >
              <span className="text-[0.58rem] font-medium text-white/50 uppercase tracking-wider">{day.weekday}</span>
              <div
                className={`mt-1 grid h-6 w-6 place-items-center rounded-full text-[0.78rem] font-bold ${
                  day.isToday
                    ? "bg-violet-500 text-white shadow-[0_0_8px_#a78bfa]"
                    : "text-white/80"
                }`}
              >
                {day.dayNumber}
              </div>
              <div className="mt-1 flex h-1.5 items-center justify-center">
                {day.hasEvents && (
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: day.accent }}
                  />
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Main 2-Column Dashboard Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <TodaySchedule
          initialEvents={overview.events.map(toUiEvent)}
          fromISO={overview.dayStart.toISOString()}
          toISO={overview.dayEnd.toISOString()}
          nowISO={now.toISOString()}
          timeZone={tz}
        />

        {/* Right Column: Top Priorities */}
        <div className="space-y-4 lg:col-span-4">
          <section className="surface p-4">
            <header className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400 fill-amber-400" />
                <h2 className="font-display text-[0.98rem] font-bold text-white">Top Priorities</h2>
              </div>
              {priorityTasks.length > 0 && (
                <span className="text-[0.68rem] font-semibold text-amber-300/80 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                  {priorityTasks.length} active
                </span>
              )}
            </header>

            <TaskChecklist
              tasks={priorityTasks}
              availableDomains={domainOptions}
              allowQuickAdd={true}
              emptyText="No priority tasks yet. Star a task or use '+ Add Top Priority Task' above!"
            />
          </section>

        </div>
      </div>
    </div>
  );
}
