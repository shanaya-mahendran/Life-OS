import Link from "next/link";
import { ArrowRight, LayoutGrid, Lock } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth";
import { getWeekStats } from "@/lib/calendar/service";
import { humanizeMinutes, startOfWeekMonday } from "@/lib/time";
import { withAlpha } from "@/lib/utils";
import { PageBanner } from "@/components/shell/PageBanner";
import { DomainIcon } from "@/components/domain/DomainIcon";

export const metadata = { title: "Domains · LifeOS" };
export const dynamic = "force-dynamic";

export default async function DomainsPage() {
  const { profile, user } = await requireProfile();
  const now = new Date();

  const [domains, tasks, stats] = await Promise.all([
    prisma.domain.findMany({
      where: { userId: profile.id },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.task.groupBy({
      by: ["domainId", "status"],
      where: { userId: profile.id },
      _count: { _all: true },
    }),
    getWeekStats(user, startOfWeekMonday(now, user.timezone)),
  ]);

  const progress = new Map<string, { done: number; total: number }>();
  for (const row of tasks) {
    const entry = progress.get(row.domainId) ?? { done: 0, total: 0 };
    entry.total += row._count._all;
    if (row.status === "done") entry.done += row._count._all;
    progress.set(row.domainId, entry);
  }
  const minutesBySlug = new Map(stats.perDomain.map((row) => [row.slug, row.minutes]));

  const enabled = domains.filter((domain) => domain.isEnabled);

  return (
    <div className="space-y-4">
      <PageBanner
        icon={<LayoutGrid className="h-5 w-5" />}
        title="Domains"
        subtitle={`${enabled.length} life domains — each with its own colour, goals and agent memory.`}
        aside={
          <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">
            <p className="font-display text-[0.95rem] font-semibold text-white">{humanizeMinutes(stats.focusMinutes)}</p>
            <p className="text-[0.58rem] uppercase tracking-[0.16em] text-white/30">focus this week</p>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
        {enabled.map((domain) => {
          const entry = progress.get(domain.id) ?? { done: 0, total: 0 };
          const percent = entry.total ? Math.round((entry.done / entry.total) * 100) : 0;
          const minutes = minutesBySlug.get(domain.slug) ?? 0;

          return (
            <Link
              key={domain.id}
              href={`/domains/${domain.slug}`}
              className="group relative overflow-hidden rounded-2xl border p-3.5 transition duration-200 hover:-translate-y-0.5"
              style={{
                borderColor: withAlpha(domain.accent, 0.28),
                background: `linear-gradient(150deg, ${withAlpha(domain.accent, 0.2)} 0%, rgba(15,10,28,0.9) 62%)`,
                boxShadow: `0 18px 40px -30px ${withAlpha(domain.accent, 0.9)}`,
              }}
            >
              <div
                className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full opacity-40 blur-2xl transition group-hover:opacity-70"
                style={{ backgroundColor: withAlpha(domain.accent, 0.55) }}
              />

              <div className="relative flex items-start justify-between">
                <span
                  className="grid h-9 w-9 place-items-center rounded-xl text-white"
                  style={{
                    backgroundColor: withAlpha(domain.accent, 0.42),
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 8px 20px -14px ${withAlpha(domain.accent, 1)}`,
                  }}
                >
                  <DomainIcon name={domain.icon} size={17} />
                </span>
                {domain.isProtected && (
                  <span className="flex items-center gap-1 rounded-full border border-white/15 bg-black/25 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-wider text-white/55">
                    <Lock className="h-2.5 w-2.5" /> protected
                  </span>
                )}
              </div>

              <div className="relative mt-2.5">
                <h3 className="truncate font-display text-[0.88rem] font-semibold text-white">{domain.name}</h3>
                <p className="mt-0.5 truncate text-[0.65rem] text-white/40">{domain.tagline || "Agent-managed domain"}</p>
              </div>

              <div className="relative mt-2.5 flex items-center justify-between text-[0.62rem] text-white/45">
                <span>
                  {entry.done}/{entry.total || 0} tasks
                </span>
                <span>{humanizeMinutes(minutes)}</span>
              </div>
              <div className="relative mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.max(percent, entry.total ? 5 : 0)}%`, backgroundColor: domain.accent }}
                />
              </div>

              <span className="relative mt-2 flex items-center gap-1 text-[0.62rem] font-semibold text-white/40 transition group-hover:text-white/80">
                Open domain <ArrowRight className="h-2.5 w-2.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
