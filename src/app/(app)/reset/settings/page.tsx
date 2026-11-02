import { notFound, redirect } from "next/navigation";
import { Settings2 } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { resetPlanEnabled } from "@/lib/reset/flags";
import { getCurrentPlan, getLatestPlan } from "@/lib/reset/service";
import { PageBanner } from "@/components/shell/PageBanner";
import { ResetTabs } from "@/components/reset/ResetTabs";
import { ResetSettings } from "@/components/reset/ResetSettings";

export const metadata = { title: "Reset settings · LifeOS" };
export const dynamic = "force-dynamic";

export default async function ResetSettingsPage() {
  if (!resetPlanEnabled()) notFound();

  const { profile } = await requireProfile();
  const plan = (await getCurrentPlan(profile.id)) ?? (await getLatestPlan(profile.id));
  if (!plan) redirect("/reset");

  const sortedLinks = [...plan.calendarEvents].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const lastBatchId = sortedLinks[0]?.batchId ?? null;
  const lastBatchCount = lastBatchId
    ? plan.calendarEvents.filter((link) => link.batchId === lastBatchId).length
    : 0;

  return (
    <div className="space-y-4">
      <PageBanner
        icon={<Settings2 className="h-5 w-5" />}
        title="Reset settings"
        subtitle="Check-in time, notifications, autopilot, privacy and the calendar. Yours to change."
        accent="#8b5cf6"
        aside={
          <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">
            <p className="font-display text-[0.9rem] font-semibold capitalize text-white">{plan.status}</p>
            <p className="text-[0.58rem] uppercase tracking-[0.16em] text-white/30">plan state</p>
          </div>
        }
      />

      <ResetTabs />

      <ResetSettings
        planId={plan.id}
        status={plan.status}
        checkinTime={plan.checkinTime}
        autonomy={plan.autonomy}
        sendAnswersToAi={plan.sendAnswersToAi}
        notifyCheckin={plan.notifyCheckin}
        notifyReviews={plan.notifyReviews}
        notifyReports={plan.notifyReports}
        notifyDrift={plan.notifyDrift}
        lastBatchId={lastBatchId}
        lastBatchCount={lastBatchCount}
      />
    </div>
  );
}
