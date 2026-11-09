import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Brain, Clock, Lock } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth";
import { listEvents } from "@/lib/calendar/service";
import { listMainTasks } from "@/lib/tasks/service";
import { getDomain } from "@/lib/domains/catalog";
import { domainFamilyColor } from "@/lib/domains/presentation";
import { addZonedDays, formatInZone, humanizeMinutes, minutesBetween, startOfWeekMonday } from "@/lib/time";
import { withAlpha } from "@/lib/utils";
import { DomainIcon } from "@/components/domain/DomainIcon";
import { DomainWorkspace } from "@/components/domain/DomainWorkspace";
import { SignatureWidget } from "@/components/domain/SignatureWidget";
import { ProgressRing } from "@/components/today/ProgressRing";
import type { BoardTask } from "@/components/tasks/MainTaskBoard";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = getDomain(slug);
  return { title: `${config?.name ?? "Domain"} · LifeOS` };
}

export default async function DomainPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { profile, user } = await requireProfile();
  const tz = user.timezone;
  const now = new Date();

  const domain = await prisma.domain.findFirst({ where: { userId: profile.id, slug } });
  if (!domain) notFound();

  const accent = domainFamilyColor(domain.slug, domain.accent);
  const config = getDomain(slug);
  const [events, tasks, memories] = await Promise.all([
    listEvents(user, { from: addZonedDays(now, -1, tz), to: addZonedDays(now, 14, tz), domainSlug: slug }),
    listMainTasks(user, { domainSlug: slug, includeDone: true }),
    prisma.memory.findMany({
      where: { userId: profile.id, domainId: domain.id },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);

  const weekStart = startOfWeekMonday(now, tz);
  const weekEnd = addZonedDays(weekStart, 7, tz);
  const weekMinutes = events
    .filter((event) => event.start >= weekStart && event.start < weekEnd)
    .reduce((total, event) => total + minutesBetween(event.start, event.end), 0);

  const done = tasks.filter((task) => task.status === "done").length;
  const adherence = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const nextSession = events.find((event) => event.start >= now) ?? null;
  const upcoming = events.filter((event) => event.start >= now).slice(0, 6);

  const checklistTasks: BoardTask[] = tasks.map((task) => ({
    rollup: task.rollup,
    id: task.id,
    title: task.title,
    domainSlug: task.domain.slug,
    domainName: task.domain.name,
    domainAccent: task.domain.accent,
    notes: task.notes,
    deadline: task.deadline,
    isPriority: task.isPriority,
    priorityRank: task.priorityRank,
    status: task.status,
    subtasks: task.subtasks,
  }));

  const goals = Array.isArray(domain.goals) ? (domain.goals as string[]) : [];

  return (
    <div className="space-y-4">
      <Link
        href="/domains"
        className="inline-flex items-center gap-1.5 text-[0.72rem] font-medium text-white/40 transition hover:text-white/80"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All domains
      </Link>

      <section
        className="relative overflow-hidden rounded-2xl border p-4 sm:p-5"
        style={{
          borderColor: withAlpha(accent, 0.32),
          background: `linear-gradient(120deg, ${withAlpha(accent, 0.3)} 0%, rgba(18,12,34,0.94) 52%, rgba(10,7,20,0.98) 100%)`,
        }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full blur-3xl"
          style={{ backgroundColor: withAlpha(accent, 0.4) }}
        />

        <div className="relative flex flex-wrap items-start gap-4">
          <span
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white"
            style={{
              backgroundColor: withAlpha(accent, 0.45),
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 18px 40px -22px ${withAlpha(accent, 1)}`,
            }}
          >
            <DomainIcon name={domain.icon} size={26} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-[1.5rem] font-semibold leading-none text-white">{domain.name}</h1>
              {domain.isProtected && (
                <span className="flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-400/15 px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wider text-amber-100">
                  <Lock className="h-2.5 w-2.5" /> protected time
                </span>
              )}
            </div>
            <p className="mt-1.5 max-w-lg text-[0.8rem] leading-relaxed text-white/50">
              {domain.tagline || config?.tagline || "A domain in your LifeOS."}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Stat label="Tasks done" value={`${done}/${tasks.length}`} />
              <Stat label="Planned this week" value={humanizeMinutes(weekMinutes)} />
              <Stat
                label="Next session"
                value={
                  nextSession
                    ? `${formatInZone(nextSession.start, tz, { weekday: "short", hour: "numeric", minute: "2-digit" })}`
                    : "Nothing booked"
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ProgressRing value={adherence} label="tasks" accent={accent} size={92} />
          </div>
        </div>
      </section>

      {/* Domain Signature System Widget */}
      <SignatureWidget slug={domain.slug} accent={accent} timeZone={tz} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <DomainWorkspace
          domain={{
            slug: domain.slug,
            name: domain.name,
            accent,
            goals,
            notes: domain.notes,
            isProtected: domain.isProtected,
          }}
          tasks={checklistTasks}
          timeZone={tz}
          eventTypes={(config?.eventTypes ?? []).slice(0, 4)}
        />

        <div className="space-y-3">
          <section className="surface p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="label">Upcoming sessions</span>
              <Link href="/calendar" className="text-[0.64rem] font-semibold text-white/40 hover:text-white/80">
                Calendar →
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/10 px-2.5 py-5 text-center text-[0.72rem] text-white/30">
                Nothing scheduled in the next two weeks.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {upcoming.map((event) => (
                  <li key={`${event.id}-${event.start.toISOString()}`} className="flex items-center gap-2.5">
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                      style={{ backgroundColor: withAlpha(accent, 0.2), color: withAlpha(accent, 1) }}
                    >
                      <Clock className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[0.76rem] text-white/80">{event.title}</div>
                      <div className="text-[0.62rem] text-white/35">
                        {formatInZone(event.start, tz, { weekday: "short", day: "numeric", month: "short" })} ·{" "}
                        {formatInZone(event.start, tz, { hour: "numeric", minute: "2-digit" })} –{" "}
                        {formatInZone(event.end, tz, { hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                    {event.status === "suggested" && (
                      <span className="rounded-full border border-dashed border-white/20 px-1.5 py-0.5 text-[0.52rem] uppercase tracking-wider text-white/40">
                        suggested
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="surface p-3.5">
            <div className="mb-2 flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5 text-violet-300" />
              <span className="label">Agent memory</span>
            </div>
            {memories.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/10 px-2.5 py-4 text-center text-[0.7rem] text-white/30">
                Tell the agent a preference in chat and it will remember it here.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {memories.map((memory) => (
                  <li
                    key={memory.id}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[0.72rem] leading-relaxed text-white/60"
                  >
                    {memory.note}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/chat" className="btn btn-ghost mt-2 w-full justify-center text-[0.7rem]">
              Ask the agent about {domain.name.toLowerCase()} →
            </Link>
          </section>

          <section
            className="rounded-xl border p-3"
            style={{
              borderColor: withAlpha(accent, 0.24),
              backgroundColor: withAlpha(accent, 0.08),
            }}
          >
            <p className="text-[0.7rem] leading-relaxed text-white/55">
              <span className="font-semibold text-white/80">Agent guidance:</span>{" "}
              {config?.guidance ?? "Everything in this domain flows through the same calendar service."}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-1.5">
      <div className="font-display text-[0.78rem] font-semibold leading-none text-white">{value}</div>
      <div className="mt-0.5 text-[0.55rem] uppercase tracking-[0.12em] text-white/35">{label}</div>
    </div>
  );
}
