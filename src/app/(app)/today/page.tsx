import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  LayoutGrid,
  MessageSquare,
  Plus,
  Sparkles,
  Star,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth";
import { buildMorningBrief } from "@/lib/briefs";
import { getDayOverview, getWeekStats, listEvents } from "@/lib/calendar/service";
import { addZonedDays, formatInZone, humanizeMinutes, minutesBetween, startOfWeekMonday, timeRangeLabel } from "@/lib/time";
import { withAlpha } from "@/lib/utils";
import { DomainIcon } from "@/components/domain/DomainIcon";
import { TaskChecklist, type ChecklistTask } from "@/components/today/TaskChecklist";

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
      accent: task.domainAccent,
      dueLabel: task.dueDate ? formatInZone(task.dueDate, tz, { day: "numeric", month: "short" }) : null,
      status: task.status,
      estimateMinutes: task.estimateMinutes,
      priority: task.priority,
    }));

  const firstName = (profile.name ?? profile.email).split(" ")[0];
  const nowMinutes = (now.getTime() - overview.dayStart.getTime()) / 60_000;

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
      accent: dayEvents[0]?.domainAccent ?? "#a855f7",
    };
  });

  const domainOptions = domains.map((d) => ({
    slug: d.slug,
    name: d.name,
    accent: d.accent,
    icon: d.icon,
  }));

  return (
    <div className="space-y-4">
      {/* Hero Greeting Card */}
      <section className="relative overflow-hidden rounded-3xl border border-violet-400/25 bg-[linear-gradient(135deg,rgba(40,20,85,0.8),rgba(18,12,38,0.95)_48%,rgba(10,7,22,0.98))] p-4 sm:p-5 shadow-[0_16px_50px_-15px_rgba(124,92,255,0.35)]">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/4 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl" />

        <div className="relative">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                <h1 className="font-display text-[1.35rem] font-bold leading-tight text-white sm:text-[1.65rem]">
                  {brief.greeting}, <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">{firstName}!</span>
                </h1>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[0.78rem] text-white/55">
                <Calendar className="h-3.5 w-3.5 text-violet-300/70" />
                <span>Here is your organized command center for today</span>
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

          {/* 3 Metric Pills */}
          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="flex items-center gap-2.5 rounded-2xl border border-sky-400/20 bg-sky-500/[0.08] p-2.5 sm:px-3.5 sm:py-3 shadow-inner">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-sky-500/20 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.3)]">
                <Calendar className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="font-display text-[1.1rem] font-bold leading-none text-white sm:text-[1.25rem]">
                  {overview.events.length}
                </div>
                <div className="mt-0.5 text-[0.62rem] font-medium tracking-tight text-white/50">Scheduled</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.08] p-2.5 sm:px-3.5 sm:py-3 shadow-inner">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.3)]">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="font-display text-[1.1rem] font-bold leading-none text-white sm:text-[1.25rem]">
                  {overview.tasks.filter((t) => t.status !== "done").length}
                </div>
                <div className="mt-0.5 text-[0.62rem] font-medium tracking-tight text-white/50">Open Tasks</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-2xl border border-amber-400/20 bg-amber-500/[0.08] p-2.5 sm:px-3.5 sm:py-3 shadow-inner">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.3)]">
                <Star className="h-4 w-4 fill-amber-300/40" />
              </span>
              <div className="min-w-0">
                <div className="font-display text-[1.1rem] font-bold leading-none text-white sm:text-[1.25rem]">
                  {stats.adherence}%
                </div>
                <div className="mt-0.5 truncate text-[0.62rem] font-medium tracking-tight text-white/50">Focus Score</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Warnings & Suggestions */}
      {brief.warnings.length > 0 && (
        <div className="space-y-1.5">
          {brief.warnings.map((warning) => (
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Today's Timeline (7 cols) */}
        <section className="lg:col-span-7 surface p-4 flex flex-col">
          <header className="mb-3.5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-violet-400" />
                <h2 className="font-display text-[0.98rem] font-bold text-white">Today&apos;s Schedule</h2>
              </div>
              <p className="text-[0.68rem] text-white/40 mt-0.5">
                {overview.events.length} blocks · {humanizeMinutes(overview.focusMinutes)} of planned focus
              </p>
            </div>
            <Link href="/calendar" className="btn btn-quiet text-[0.72rem] text-violet-300 hover:text-white">
              <Plus className="h-3 w-3" /> Add Event
            </Link>
          </header>

          {overview.events.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.04] text-white/30 mb-2">
                <Calendar className="h-5 w-5" />
              </div>
              <p className="text-[0.84rem] font-medium text-white/60">No blocks scheduled for today</p>
              <p className="mt-1 text-[0.72rem] text-white/35 max-w-xs">
                Ask Mochi: &quot;Schedule study block at 3pm&quot; or &quot;Add mentoring every Mon &amp; Sat at 3pm to 5pm&quot;
              </p>
              <Link href="/chat" className="btn btn-ghost mt-3 text-[0.75rem]">
                <Plus className="h-3.5 w-3.5" /> Plan with Mochi
              </Link>
            </div>
          ) : (
            <ol className="space-y-2.5 flex-1">
              {overview.events.map((event) => {
                const offset = (event.start.getTime() - overview.dayStart.getTime()) / 60_000;
                const isNow =
                  offset <= nowMinutes &&
                  (event.end.getTime() - overview.dayStart.getTime()) / 60_000 > nowMinutes;

                return (
                  <li
                    key={`${event.id}-${event.start.toISOString()}`}
                    className="group relative flex items-stretch gap-3 rounded-2xl border px-3.5 py-2.5 transition hover:bg-white/[0.03]"
                    style={{
                      borderColor: withAlpha(event.domainAccent, isNow ? 0.6 : 0.22),
                      backgroundColor: withAlpha(event.domainAccent, isNow ? 0.16 : 0.06),
                    }}
                  >
                    <div className="w-[4.2rem] shrink-0 pt-0.5 text-right">
                      <div className="font-display text-[0.76rem] font-bold text-white/90">
                        {formatInZone(event.start, tz, { hour: "numeric", minute: "2-digit" })}
                      </div>
                      <div className="text-[0.62rem] text-white/40">
                        {formatInZone(event.end, tz, { hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>

                    <span
                      className="w-[3px] shrink-0 rounded-full"
                      style={{
                        backgroundColor: event.domainAccent,
                        boxShadow: isNow ? `0 0 10px ${event.domainAccent}` : undefined,
                      }}
                    />

                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[0.88rem] font-semibold text-white/95">{event.title}</span>
                        {isNow && (
                          <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.2 text-[0.55rem] font-bold uppercase tracking-wider shadow-[0_0_8px_rgba(52,211,153,0.4)]">
                            Now
                          </span>
                        )}
                        {event.recurrence && (
                          <span className="rounded-md bg-white/[0.06] text-white/50 px-1.5 py-0.2 text-[0.55rem]">
                            repeating
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[0.68rem] text-white/50">
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: event.domainAccent }} />
                        <span>{event.domainName}</span>
                        <span>·</span>
                        <span>{timeRangeLabel(event.start, event.end, tz)}</span>
                        <span className="rounded-md bg-white/[0.08] px-1.5 py-0.2 text-[0.62rem] font-medium text-white/70">
                          {humanizeMinutes(Math.round(minutesBetween(event.start, event.end)))}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Right Column: Top Priorities & Clean Domains Launcher (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Top Priorities Section */}
          <section className="surface p-4">
            <header className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400 fill-amber-400" />
                <h2 className="font-display text-[0.98rem] font-bold text-white">Top Priorities</h2>
              </div>
              <span className="text-[0.68rem] font-semibold text-amber-300/80 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                {priorityTasks.length} active
              </span>
            </header>

            <TaskChecklist
              tasks={priorityTasks}
              availableDomains={domainOptions}
              allowQuickAdd={true}
              emptyText="No priority tasks yet. Star a task or use '+ Add Top Priority Task' above!"
            />
          </section>

          {/* Life Domains Quick Launcher (Compact 3x3 Grid) */}
          <section className="surface p-4">
            <header className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-violet-400" />
                <h2 className="font-display text-[0.95rem] font-bold text-white">Life Domains</h2>
              </div>
              <Link href="/domains" className="text-[0.7rem] font-semibold text-violet-300 hover:text-violet-200">
                All 18 →
              </Link>
            </header>

            <div className="grid grid-cols-3 gap-2">
              {domains
                .filter((d) => d.isEnabled)
                .slice(0, 9)
                .map((domain) => (
                  <Link
                    key={domain.slug}
                    href={`/domains/${domain.slug}`}
                    className="group flex flex-col items-center justify-center rounded-xl border p-2 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                    style={{
                      borderColor: withAlpha(domain.accent, 0.25),
                      background: `linear-gradient(135deg, ${withAlpha(domain.accent, 0.12)}, rgba(15, 10, 26, 0.9))`,
                    }}
                  >
                    <div
                      className="grid h-7 w-7 place-items-center rounded-lg shadow-sm mb-1"
                      style={{
                        backgroundColor: withAlpha(domain.accent, 0.25),
                        color: domain.accent,
                      }}
                    >
                      <DomainIcon name={domain.icon} size={15} />
                    </div>
                    <span className="truncate w-full text-[0.72rem] font-semibold text-white/85 group-hover:text-white">
                      {domain.name}
                    </span>
                  </Link>
                ))}
            </div>
          </section>

          {/* Quick Chat Assistant Card */}
          <section className="surface p-3.5 border-violet-500/25 bg-[linear-gradient(135deg,rgba(35,18,70,0.6),rgba(15,10,25,0.9))]">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.3)]">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[0.78rem] font-bold text-white">Ask Mochi Orchestrator</div>
                <p className="text-[0.66rem] text-white/45 truncate">
                  &quot;Schedule Mentoring for every Mon &amp; Sat at 3pm to 5pm&quot;
                </p>
              </div>
              <Link href="/chat" className="btn btn-primary py-1 px-2.5 text-[0.7rem] shrink-0">
                Chat
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
