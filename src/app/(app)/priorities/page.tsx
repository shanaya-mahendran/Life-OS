import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MainTaskBoard, type BoardTask } from "@/components/tasks/MainTaskBoard";
import { listMainTasks } from "@/lib/tasks/service";

export const metadata = { title: "All priorities · LifeOS" };
export const dynamic = "force-dynamic";

export default async function PrioritiesPage() {
  const { profile, user } = await requireProfile();
  const [tasks, domains] = await Promise.all([
    listMainTasks(user, { priority: true, includeDone: true }),
    prisma.domain.findMany({
      where: { userId: profile.id, isEnabled: true },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true },
    }),
  ]);
  const boardTasks: BoardTask[] = tasks.map((task) => ({
    rollup: task.rollup,
    id: task.id,
    title: task.title,
    notes: task.notes,
    status: task.status,
    deadline: task.deadline,
    isPriority: task.isPriority,
    priorityRank: task.priorityRank,
    domainSlug: task.domain.slug,
    domainName: task.domain.name,
    domainAccent: task.domain.accent,
    subtasks: task.subtasks,
  }));
  const activeCount = boardTasks.filter((task) => task.status !== "done").length;

  return (
    <div className="space-y-4">
      <Link href="/today" className="inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white/80">
        <ArrowLeft className="h-3.5 w-3.5" /> Today
      </Link>
      <header className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            <h1 className="font-display text-xl font-bold text-white">All priorities</h1>
          </div>
          <p className="mt-1 text-sm text-white/45">{activeCount} active · ordered by deadline and risk</p>
        </div>
      </header>
      <MainTaskBoard
        tasks={boardTasks}
        timeZone={user.timezone}
        priorityView
        domains={domains}
      />
    </div>
  );
}
