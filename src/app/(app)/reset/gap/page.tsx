import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Target } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { resetPlanEnabled } from "@/lib/reset/flags";
import { getCurrentPlan } from "@/lib/reset/service";
import type { GapReportDraft } from "@/lib/reset/calc";
import { PageBanner } from "@/components/shell/PageBanner";
import { ResetTabs } from "@/components/reset/ResetTabs";
import { GapReportEditor } from "@/components/reset/GapReportEditor";

export const metadata = { title: "Reset gap report · LifeOS" };
export const dynamic = "force-dynamic";

export default async function ResetGapPage() {
  if (!resetPlanEnabled()) notFound();

  const { profile } = await requireProfile();
  const plan = await getCurrentPlan(profile.id);
  if (!plan) redirect("/reset");
  if (plan.status === "completed") redirect("/reset/finish");
  if (plan.status === "active" || plan.status === "paused") redirect("/reset/plan");

  const answers = (step: number) => plan.answers.find((answer) => answer.step === step)?.answer ?? "";
  const complete = [1, 2, 3].every((step) => answers(step).trim().length > 0);
  if (!complete) redirect("/reset/audit");

  return (
    <div className="space-y-4">
      <PageBanner
        icon={<Target className="h-5 w-5" />}
        title="Your gap report"
        subtitle="What you said, what you want, and the pattern in the way. One screen, fully editable."
        accent="#a78bfa"
        aside={
          <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">
            <p className="font-display text-[0.85rem] font-semibold text-white">Draft</p>
            <p className="text-[0.58rem] uppercase tracking-[0.16em] text-white/30">nothing booked yet</p>
          </div>
        }
      />

      <ResetTabs />

      <GapReportEditor
        planId={plan.id}
        initial={(plan.gapReport as Partial<GapReportDraft>) ?? {}}
        quotes={{ current: answers(1), target: answers(2), pattern: answers(3) }}
      />

      <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
        <ArrowLeft className="h-3.5 w-3.5 text-white/30" />
        <Link href="/reset/audit" className="text-[0.7rem] font-medium text-violet-300/80 hover:text-violet-200">
          Back to the audit
        </Link>
        <span className="ml-auto text-[0.63rem] text-white/25">Approving the report only unlocks the builder.</span>
      </div>
    </div>
  );
}
