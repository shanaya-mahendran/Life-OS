import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/components/shell/AppShell";
import { resetFeatures } from "@/lib/reset/flags";
import { diaryEnabled } from "@/lib/diary/flags";
import { addZonedDays, startOfZonedDay } from "@/lib/time";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, user } = await requireProfile();

  if (!profile.onboardedAt) redirect("/onboarding");

  const tasks = await prisma.task.findMany({
      where: { userId: profile.id },
      select: { status: true, dueDate: true },
    });

  const total = tasks.length || 1;
  const done = tasks.filter((task) => task.status === "done").length;
  const adherence = Math.round((done / total) * 100);

  const todayStart = startOfZonedDay(new Date(), user.timezone);
  const todayEnd = addZonedDays(todayStart, 1, user.timezone);
  const notificationCount = tasks.filter(
    (task) => task.status !== "done" && task.dueDate && task.dueDate < todayEnd && task.dueDate >= todayStart,
  ).length;

  return (
    <AppShell
      userName={profile.name ?? profile.email}
      adherence={adherence}
      taskCount={tasks.length}
      notificationCount={notificationCount}
      features={{ ...resetFeatures(), diary: diaryEnabled() }}
    >
      {children}
    </AppShell>
  );
}
