import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth";
import { listEvents } from "@/lib/calendar/service";
import { AppShell } from "@/components/shell/AppShell";
import { resetFeatures } from "@/lib/reset/flags";
import { diaryEnabled } from "@/lib/diary/flags";
import { addZonedDays, startOfWeekMonday, startOfZonedDay } from "@/lib/time";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, user } = await requireProfile();

  if (!profile.onboardedAt) redirect("/onboarding");

  const tasks = await prisma.task.findMany({
    where: { userId: profile.id },
    select: { status: true, dueDate: true, completedAt: true },
  });
  const weekStart = startOfWeekMonday(new Date(), user.timezone);
  const weekEnd = addZonedDays(weekStart, 7, user.timezone);
  const weeklyEvents = await listEvents(user, { from: weekStart, to: weekEnd });

  const weeklyTasks = tasks.filter(
    (task) =>
      (task.dueDate && task.dueDate >= weekStart && task.dueDate < weekEnd) ||
      (task.completedAt && task.completedAt >= weekStart && task.completedAt < weekEnd),
  );
  const doneThisWeek = weeklyTasks.filter(
    (task) =>
      (task.completedAt && task.completedAt >= weekStart && task.completedAt < weekEnd) ||
      (task.status === "done" && !task.completedAt && task.dueDate && task.dueDate >= weekStart && task.dueDate < weekEnd),
  ).length;
  const adherence = Math.round((doneThisWeek / (weeklyTasks.length || 1)) * 100);
  const eventAchievedCount = weeklyEvents.filter((event) => event.achievementStatus === "achieved").length;
  const eventResolvedCount = weeklyEvents.filter((event) => event.achievementStatus !== null).length;

  const todayStart = startOfZonedDay(new Date(), user.timezone);
  const todayEnd = addZonedDays(todayStart, 1, user.timezone);
  const notificationCount = tasks.filter(
    (task) => task.status !== "done" && task.dueDate && task.dueDate < todayEnd && task.dueDate >= todayStart,
  ).length;

  return (
    <AppShell
      userName={profile.name ?? profile.email}
      adherence={adherence}
      taskCount={weeklyTasks.length}
      eventPlanCount={weeklyEvents.length}
      eventAchievedCount={eventAchievedCount}
      eventResolvedCount={eventResolvedCount}
      notificationCount={notificationCount}
      features={{ ...resetFeatures(), diary: diaryEnabled() }}
    >
      {children}
    </AppShell>
  );
}
