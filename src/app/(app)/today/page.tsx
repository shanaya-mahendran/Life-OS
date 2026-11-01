import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  LayoutGrid,
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
import { ProgressRing } from "@/components/today/ProgressRing";
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

  const domainTasks = await prisma.task.groupBy({
    by: ["domainId", "status"],
    where: { userId: profile.id },
    _count: { _all: true },
  });
  const byDomainId = new Map(domains.map((row) => [row.id, row.slug]));
  const domainIconBySlug = new Map(domains.map((row) => [row.slug, row.icon]));

  const progressBySlug = new Map<string, { done: number; total: number }>();
  for (const row of domainTasks) {
    const slug = byDomainId.get(row.domainId);
    if (!slug) continue;
    const entry = progressBySlug.get(slug) ?? { done: 0, total: 0 };
    entry.total += row._count._all;
    if (row.status === "done") entry.done += row._count._all;
    progressBySlug.set(slug, entry);
  }

  const minutesBySlug = new Map(stats.perDomain.map((row) => [row.slug, row.minutes]));

  const priorityTasks: ChecklistTask[] = overview.tasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => {
      const priority = b.priority - a.priority;
      if (priority !== 0) return priority;
      const aDue = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    })
    .slice(0, 4)
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
    }));

  const upcoming = weekEvents
    .filter((event) => event.start.getTime() > now.getTime())
    .slice(0, 5);

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

  return (
    <div className="space-y-4">
      {/* Hero Greeting Card (Mobile-first design matching reference) */}
      <section className="relative overflow-hidden rounded-3xl border border-violet-400/25 bg-[linear-gradient(135deg,rgba(40,20,85,0.78),rgba(18,12,38,0.94)_48%,rgba(10,7,22,0.98))] p-4 sm:p-5 shadow-[0_16px_50px_-15px_rgba(124,92,255,0.35)]">
        {/* Ambient neon backlights */}
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/4 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl" />

        <div className="relative">
          {/* Top greeting row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                <h1 className="font-display text-[1.35rem] font-bold leading-tight text-white sm:text-[1.65rem]">
                  {brief.greeting}, <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">{firstName}!</span>
                </h1>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[0.78rem] text-white/55">
                <Calendar className="h-3.5 w-3.5 text-violet-300/70" />
                <span>Here&apos;s your plan for today</span>
              </div>
            </div>

            <Link
              href="/chat"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 transition hover:bg-white/15 hover:text-white"
              aria-label="Open chat"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {/* 3 Metric Pills (Mobile Highlight Cards) */}
          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            {/* Events */}
            <div className="flex items-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-500/[0.08] p-2.5 sm:px-3.5 sm:py-3 shadow-inner">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-sky-500/20 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.3)]">
                <Calendar className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="font-display text-[1.05rem] font-bold leading-none text-white sm:text-[1.2rem]">
                  {overview.events.length}
                </div>
                <div className="mt-0.5 text-[0.62rem] font-medium tracking-tight text-white/50">Events</div>
              </div>
            </div>

            {/* Tasks */}
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.08] p-2.5 sm:px-3.5 sm:py-3 shadow-inner">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.3)]">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="font-display text-[1.05rem] font-bold leading-none text-white sm:text-[1.2rem]">
                  {overview.tasks.filter((t) => t.status !== "done").length}
                </div>
                <div className="mt-0.5 text-[0.62rem] font-medium tracking-tight text-white/50">Tasks</div>
              </div>
            </div>

            {/* Focus Score */}
            <div className="flex items-center justify-between gap-1.5 rounded-2xl border border-amber-400/20 bg-amber-500/[0.08] p-2.5 sm:px-3.5 sm:py-3 shadow-inner">
              <div className="flex items-center gap-2 min-w-0">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.3)]">
                  <Star className="h-4 w-4 fill-amber-300/40" />
                </span>
                <div className="min-w-0">
                  <div className="font-display text-[1.05rem] font-bold leading-none text-white sm:text-[1.2rem]">
                    {stats.adherence}%
                  </div>
                  <div className="mt-0.5 truncate text-[0.62rem] font-medium tracking-tight text-white/50">Focus Score</div>
                </div>
              </div>
              <ChevronRight className="hidden sm:block h-3.5 w-3.5 text-amber-300/60" />
            </div>
          </div>
        </div>
      </section>

      {brief.warnings.length > 0 && (
        <div className="space-y-1.5">
          {brief.warnings.map((warning) => (
            <div
              key={warning}
              className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[0.76rem] text-amber-100"
            >
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Top Priorities Section */}
      <section className="surface p-4">
        <header className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400 fill-amber-400" />
            <h2 className="font-display text-[0.98rem] font-bold text-white">Top Priorities</h2>
          </div>
          <Link href="/domains" className="text-[0.72rem] font-semibold text-violet-300 hover:text-violet-200">
            View All →
          </Link>
        </header>
        <TaskChecklist tasks={priorityTasks} emptyText="No open tasks for today. Add one or ask LifeOS!" />
      </section>

      {/* Upcoming This Week - Horizontal Day Scrubber */}
      <section className="surface p-4">
        <header className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-violet-400" />
            <h2 className="font-display text-[0.98rem] font-bold text-white">Upcoming This Week</h2>
          </div>
          <Link href="/calendar" className="text-[0.72rem] font-semibold text-violet-300 hover:text-violet-200">
            Calendar →
          </Link>
        </header>

        {/* Day Scrubber Pills */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1 pt-1 -mx-1 px-1">
          {weekDays.map((day) => (
            <Link
              key={day.dayNumber}
              href="/calendar"
              className={`flex flex-col items-center justify-between rounded-2xl border px-3 py-2.5 min-w-[3.6rem] transition-all duration-200 ${
                day.isToday
                  ? "border-violet-400/40 bg-violet-600/25 shadow-[0_0_15px_rgba(139,92,246,0.35)]"
                  : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
              }`}
            >
              <span className="text-[0.62rem] font-medium text-white/50 uppercase tracking-wider">{day.weekday}</span>
              <span className="text-[0.6rem] text-white/35">{day.month} {day.dayNumber}</span>
              <div
                className={`mt-1.5 grid h-7 w-7 place-items-center rounded-full text-[0.8rem] font-bold ${
                  day.isToday
                    ? "bg-violet-500 text-white shadow-[0_0_10px_#a78bfa]"
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

      {/* Domain Quick Launchers Grid (3 Columns with Icons & Chevrons) */}
      <section className="surface p-4">
        <header className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-violet-400" />
            <h2 className="font-display text-[0.98rem] font-bold text-white">Life Domains</h2>
          </div>
          <Link href="/domains" className="text-[0.72rem] font-semibold text-violet-300 hover:text-violet-200">
            View all 18 →
          </Link>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {domains
            .filter((d) => d.isEnabled)
            .slice(0, 9)
            .map((domain) => (
              <Link
                key={domain.slug}
                href={`/domains/${domain.slug}`}
                className="group flex items-center justify-between rounded-2xl border p-3 transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  borderColor: withAlpha(domain.accent, 0.3),
                  background: `linear-gradient(135deg, ${withAlpha(domain.accent, 0.16)}, rgba(15, 10, 28, 0.88))`,
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-xl shadow-sm"
                    style={{
                      backgroundColor: withAlpha(domain.accent, 0.25),
                      color: domain.accent,
                    }}
                  >
                    <DomainIcon name={domain.icon} size={16} />
                  </div>
                  <span className="truncate text-[0.8rem] font-semibold text-white/90 group-hover:text-white">
                    {domain.name}
                  </span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-white/30 group-hover:text-white/70 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
        </div>
      </section>

      {/* Today's Timeline */}
      <section className="surface p-4">
        <header className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-display text-[0.98rem] font-semibold text-white">Today&apos;s timeline</h2>
            <p className="text-[0.68rem] text-white/35">
              {overview.events.length} blocks · {humanizeMinutes(overview.focusMinutes)} of focus
            </p>
          </div>
          <Link href="/calendar" className="text-[0.7rem] font-semibold text-violet-300 hover:text-violet-200">
            Open calendar →
          </Link>
        </header>

        {overview.events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center">
            <p className="text-[0.82rem] text-white/55">Nothing scheduled yet.</p>
            <p className="mt-1 text-[0.72rem] text-white/35">Ask the agent to block the work that matters.</p>
            <Link href="/chat" className="btn btn-ghost mt-3">
              <Plus className="h-3.5 w-3.5" /> Plan my day
            </Link>
          </div>
        ) : (
          <ol className="relative space-y-2">
            {overview.events.map((event) => {
              const offset = (event.start.getTime() - overview.dayStart.getTime()) / 60_000;
              const isNow =
                offset <= nowMinutes &&
                (event.end.getTime() - overview.dayStart.getTime()) / 60_000 > nowMinutes;
              return (
                <li
                  key={`${event.id}-${event.start.toISOString()}`}
                  className="group flex items-stretch gap-3 rounded-2xl border px-3 py-2.5 transition hover:bg-white/[0.03]"
                  style={{
                    borderColor: withAlpha(event.domainAccent, isNow ? 0.5 : 0.18),
                    backgroundColor: withAlpha(event.domainAccent, isNow ? 0.16 : 0.06),
                  }}
                >
                  <div className="w-[4.4rem] shrink-0 pt-0.5 text-right">
                    <div className="font-display text-[0.72rem] font-semibold text-white/80">
                      {formatInZone(event.start, tz, { hour: "numeric", minute: "2-digit" })}
                    </div>
                    <div className="text-[0.62rem] text-white/35">
                      {formatInZone(event.end, tz, { hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                  <span className="w-[3px] shrink-0 rounded-full" style={{ backgroundColor: event.domainAccent }} />
                  <div className="min-w-0 flex-1 py-0.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[0.85rem] font-medium text-white/95">{event.title}</span>
                      {isNow && (
                        <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider">
                          now
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[0.68rem] text-white/45">
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: event.domainAccent }} />
                      <span>{event.domainName}</span>
                      <span>·</span>
                      <span>{timeRangeLabel(event.start, event.end, tz)}</span>
                      <span className="rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[0.62rem] font-medium text-white/70">
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

      {/* Week Adherence & Agent Prompt */}
      <section className="surface flex flex-wrap items-center gap-3 p-3.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500/15 text-violet-200">
          <Clock className="h-4 w-4" />
        </span>
        <p className="min-w-0 flex-1 text-[0.76rem] text-white/45">
          <span className="text-white/75">Try the agent:</span> “Move karate to 7 PM today”, “Find two hours for the pitch
          tomorrow”, “What&apos;s on Thursday?”
        </p>
        <Link href="/chat" className="btn btn-primary">
          <Sparkles className="h-3.5 w-3.5" /> Open chat
        </Link>
      </section>
    </div>
  );
}
