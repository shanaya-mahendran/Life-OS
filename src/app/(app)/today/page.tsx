import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flame,
  ListChecks,
  Moon,
  Plus,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth";
import { buildMorningBrief } from "@/lib/briefs";
import { getDayOverview, getWeekStats, listEvents } from "@/lib/calendar/service";
import { addZonedDays, formatInZone, humanizeMinutes, startOfWeekMonday, timeRangeLabel } from "@/lib/time";
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

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-2xl border border-violet-400/20 bg-[linear-gradient(118deg,rgba(64,40,132,0.75),rgba(19,13,38,0.92)_46%,rgba(11,8,22,0.98))] p-5">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-fuchsia-500/15 blur-3xl" />

        <div className="relative flex flex-wrap items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-violet-300/30 bg-violet-500/20 text-violet-100 shadow-[0_14px_34px_-18px_rgba(139,92,246,0.9)]">
            <Sparkles className="h-5 w-5" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[0.62rem] uppercase tracking-[0.2em] text-violet-200/55">{brief.dateLabel}</p>
            <h1 className="mt-1 font-display text-[1.5rem] font-semibold leading-tight text-white sm:text-[1.75rem]">
              {brief.greeting}, {firstName}!
            </h1>
            <p className="mt-1 max-w-xl text-[0.82rem] leading-relaxed text-white/50">{brief.headline}</p>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Link href="/chat" className="btn btn-primary">
              <Sparkles className="h-3.5 w-3.5" /> Talk to LifeOS
            </Link>
            <Link href="/calendar" className="btn btn-ghost">
              <CalendarDays className="h-3.5 w-3.5" /> Calendar
            </Link>
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatPill icon={<ListChecks className="h-3.5 w-3.5" />} label="Top tasks" value={String(overview.dueToday.length || priorityTasks.length)} />
          <StatPill icon={<Flame className="h-3.5 w-3.5" />} label="Focus planned" value={humanizeMinutes(overview.focusMinutes)} />
          <StatPill
            icon={<Moon className="h-3.5 w-3.5" />}
            label="Sleep target"
            value={brief.stats.sleepHours ? `${brief.stats.sleepHours}h` : `${profile.minSleepHours}h`}
          />
          <StatPill icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Week adherence" value={`${stats.adherence}%`} />
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

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
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
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center">
              <p className="text-[0.85rem] text-white/55">Nothing scheduled yet.</p>
              <p className="mt-1 text-[0.74rem] text-white/35">Ask the agent to block the work that matters.</p>
              <Link href="/chat" className="btn btn-ghost mt-3">
                <Plus className="h-3.5 w-3.5" /> Plan my day
              </Link>
            </div>
          ) : (
            <ol className="relative space-y-1.5">
              {overview.events.map((event) => {
                const offset = (event.start.getTime() - overview.dayStart.getTime()) / 60_000;
                const isNow = offset <= nowMinutes && (event.end.getTime() - overview.dayStart.getTime()) / 60_000 > nowMinutes;
                return (
                  <li
                    key={`${event.id}-${event.start.toISOString()}`}
                    className="group flex items-stretch gap-3 rounded-xl border px-2.5 py-2 transition hover:bg-white/[0.03]"
                    style={{
                      borderColor: withAlpha(event.domainAccent, isNow ? 0.5 : 0.16),
                      backgroundColor: withAlpha(event.domainAccent, isNow ? 0.14 : 0.05),
                    }}
                  >
                    <div className="w-[4.6rem] shrink-0 pt-0.5 text-right">
                      <div className="font-display text-[0.7rem] font-semibold text-white/70">
                        {formatInZone(event.start, tz, { hour: "numeric", minute: "2-digit" })}
                      </div>
                      <div className="text-[0.6rem] text-white/30">
                        {formatInZone(event.end, tz, { hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                    <span className="w-[3px] shrink-0 rounded-full" style={{ backgroundColor: event.domainAccent }} />
                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[0.84rem] font-medium text-white/90">{event.title}</span>
                        {isNow && (
                          <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider text-white">
                            now
                          </span>
                        )}
                        {event.status === "suggested" && (
                          <span className="rounded-full border border-dashed border-white/25 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-wider text-white/45">
                            suggested
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[0.65rem] text-white/40">
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: event.domainAccent }} />
                        {event.domainName}
                        <span className="text-white/20">·</span>
                        {timeRangeLabel(event.start, event.end, tz)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div className="space-y-4">
          <section className="surface p-4">
            <header className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[0.98rem] font-semibold text-white">Top priorities</h2>
              <Link href="/domains" className="text-[0.7rem] font-semibold text-violet-300 hover:text-violet-200">
                All tasks →
              </Link>
            </header>
            <TaskChecklist tasks={priorityTasks} emptyText="No open tasks. Add one from a domain page." />
          </section>

          <section className="surface p-4">
            <h2 className="font-display text-[0.98rem] font-semibold text-white">This week</h2>
            <div className="mt-3 flex items-center gap-4">
              <ProgressRing value={stats.adherence} label="adherence" accent="#8b5cf6" size={104} />
              <div className="min-w-0 flex-1 space-y-1.5 text-[0.74rem]">
                <MetricRow label="Focus time" value={humanizeMinutes(stats.focusMinutes)} />
                <MetricRow label="Tasks done" value={`${stats.done}/${stats.totalTasks}`} />
                <MetricRow label="Sleep nights" value={String(stats.sleepNights)} />
                <MetricRow label="Karate" value={String(stats.karateSessions)} />
              </div>
            </div>
            <Link href="/review" className="btn btn-ghost mt-3 w-full justify-between">
              Weekly review <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
        <section className="surface p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-[0.98rem] font-semibold text-white">Upcoming</h2>
            <Link href="/calendar" className="text-[0.7rem] font-semibold text-violet-300 hover:text-violet-200">
              Next 7 days →
            </Link>
          </header>
          {upcoming.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-[0.76rem] text-white/35">
              Nothing in the next seven days yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {upcoming.map((event) => (
                <li key={`${event.id}-${event.start.toISOString()}`} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: event.domainAccent }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[0.8rem] text-white/85">{event.title}</div>
                    <div className="text-[0.62rem] text-white/35">
                      {formatInZone(event.start, tz, { weekday: "short", day: "numeric", month: "short" })}
                    </div>
                  </div>
                  <span className="shrink-0 text-[0.68rem] text-white/45">
                    {formatInZone(event.start, tz, { hour: "numeric", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-[0.98rem] font-semibold text-white">Domain overview</h2>
            <Link href="/domains" className="text-[0.7rem] font-semibold text-violet-300 hover:text-violet-200">
              View all 18 →
            </Link>
          </header>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {domains.filter((domain) => domain.isEnabled).slice(0, 6).map((domain) => {
              const progress = progressBySlug.get(domain.slug) ?? { done: 0, total: 0 };
              const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
              const minutes = minutesBySlug.get(domain.slug) ?? 0;
              return (
                <Link
                  key={domain.slug}
                  href={`/domains/${domain.slug}`}
                  className="group relative overflow-hidden rounded-xl border p-2.5 transition hover:-translate-y-0.5"
                  style={{
                    borderColor: withAlpha(domain.accent, 0.28),
                    background: `linear-gradient(150deg, ${withAlpha(domain.accent, 0.18)}, rgba(14,10,26,0.85))`,
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <DomainIcon name={domain.icon} size={14} className="shrink-0" />
                    <span className="truncate text-[0.72rem] font-medium text-white/85">{domain.name}</span>
                  </div>
                  <div className="mt-1.5 text-[0.62rem] text-white/40">{humanizeMinutes(minutes)} planned</div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.max(percent, progress.total ? 4 : 0)}%`, backgroundColor: domain.accent }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-2.5 flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
            <span className="text-[0.68rem] text-white/40">
              {domains.filter((domain) => domain.isEnabled).length} domains · {humanizeMinutes(stats.focusMinutes)} focus this week
            </span>
            <Link href="/domains" className="text-[0.68rem] font-semibold text-violet-300 hover:text-violet-200">
              Manage
            </Link>
          </div>
        </section>
      </div>

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

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.05] px-3 py-2">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-violet-200">{icon}</span>
      <div className="min-w-0">
        <div className="font-display text-[0.9rem] font-semibold leading-none text-white">{value}</div>
        <div className="mt-0.5 truncate text-[0.58rem] uppercase tracking-[0.12em] text-white/35">{label}</div>
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.05] pb-1 last:border-0">
      <span className="text-white/40">{label}</span>
      <span className="font-medium text-white/80">{value}</span>
    </div>
  );
}
