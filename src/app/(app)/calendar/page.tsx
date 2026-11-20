import { CalendarDays } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth";
import { listEvents } from "@/lib/calendar/service";
import { toUiEvent } from "@/lib/dto";
import { addZonedDays, startOfWeekMonday } from "@/lib/time";
import { PageBanner } from "@/components/shell/PageBanner";
import { CalendarBoard } from "@/components/calendar/CalendarBoard";

export const metadata = { title: "Calendar · LifeOS" };

export default async function CalendarPage() {
  const { profile, user } = await requireProfile();

  const now = new Date();
  const weekStart = startOfWeekMonday(now, user.timezone);
  const from = addZonedDays(weekStart, -7, user.timezone);
  const to = addZonedDays(weekStart, 21, user.timezone);

  const [events, domains] = await Promise.all([
    listEvents(user, { from, to }),
    prisma.domain.findMany({
      where: { userId: profile.id, isEnabled: true },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true, accent: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <PageBanner
        icon={<CalendarDays className="h-5 w-5" />}
        title="Calendar"
        subtitle={`Your schedule · ${user.timezone.replace("_", " ")}`}
      />

      <CalendarBoard
        initialEvents={events.map(toUiEvent)}
        domains={domains}
        timeZone={user.timezone}
        dayStartHour={Math.max(user.dayStartHour, 6)}
        dayEndHour={Math.min(user.dayEndHour, 23)}
        initialDateISO={now.toISOString()}
        initialView="week"
      />
    </div>
  );
}
