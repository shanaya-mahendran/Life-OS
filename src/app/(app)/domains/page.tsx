import Link from "next/link";
import { LayoutGrid, Lock } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth";
import { getWeekStats } from "@/lib/calendar/service";
import { humanizeMinutes, startOfWeekMonday } from "@/lib/time";
import { PageBanner } from "@/components/shell/PageBanner";
import { DomainIcon } from "@/components/domain/DomainIcon";
import { DOMAIN_FAMILIES, domainFamilyColor } from "@/lib/domains/presentation";

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
        subtitle={`${enabled.length} areas of your life, grouped by theme.`}
      />

      <div className="space-y-4">
        {DOMAIN_FAMILIES.map((family) => {
          const familySlugs: readonly string[] = family.slugs;
          const familyDomains = enabled.filter((domain) => familySlugs.includes(domain.slug));
          if (familyDomains.length === 0) return null;

          return (
            <section key={family.name} className="surface overflow-hidden p-4 sm:p-5">
              <h2 className="mb-2 text-sm font-semibold text-white/75">{family.name}</h2>
              <ul className="divide-y divide-white/[0.07]">
                {familyDomains.map((domain) => {
                  const entry = progress.get(domain.id) ?? { done: 0, total: 0 };
                  const minutes = minutesBySlug.get(domain.slug) ?? 0;

                  return (
                    <li key={domain.id}>
                      <Link
                        href={`/domains/${domain.slug}`}
                        className="group flex min-h-12 items-center gap-3 py-2.5 transition hover:bg-white/[0.025]"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: domainFamilyColor(domain.slug, domain.accent) }}
                        />
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-white/65">
                          <DomainIcon name={domain.icon} size={16} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/90">{domain.name}</span>
                        {domain.isProtected && (
                          <span title="Protected domain" aria-label="Protected domain">
                            <Lock className="h-4 w-4 text-white/55" />
                          </span>
                        )}
                        {entry.total > 0 && (
                          <span className="hidden text-xs tabular-nums text-white/60 sm:inline">
                            {entry.done}/{entry.total} tasks
                          </span>
                        )}
                        {minutes > 0 && <span className="text-xs tabular-nums text-white/50">{humanizeMinutes(minutes)}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
