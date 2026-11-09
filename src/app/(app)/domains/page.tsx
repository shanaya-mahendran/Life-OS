import { LayoutGrid } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth";
import { getWeekStats } from "@/lib/calendar/service";
import { startOfWeekMonday } from "@/lib/time";
import { PageBanner } from "@/components/shell/PageBanner";
import { DomainsDirectory, type DomainItem } from "@/components/domain/DomainsDirectory";

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

  const domainItems: DomainItem[] = enabled.map((domain) => {
    const entry = progress.get(domain.id) ?? { done: 0, total: 0 };
    return {
      id: domain.id,
      slug: domain.slug,
      name: domain.name,
      accent: domain.accent,
      icon: domain.icon,
      isProtected: domain.isProtected,
      tasksDone: entry.done,
      tasksTotal: entry.total,
      minutes: minutesBySlug.get(domain.slug) ?? 0,
    };
  });

  return (
    <div className="space-y-4">
      <PageBanner
        icon={<LayoutGrid className="h-5 w-5" />}
        title="22 Life Domains"
        subtitle={`${enabled.length} areas of your life, grouped into 5 clusters with search and quick favorites.`}
      />

      <DomainsDirectory domains={domainItems} />
    </div>
  );
}
