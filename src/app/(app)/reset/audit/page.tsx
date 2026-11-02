import { notFound, redirect } from "next/navigation";
import { ClipboardCheck, LockKeyhole } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { resetPlanEnabled } from "@/lib/reset/flags";
import { getCurrentPlan } from "@/lib/reset/service";
import { AUDIT_STEPS } from "@/lib/reset/constants";
import { PageBanner } from "@/components/shell/PageBanner";
import { AuditWizard } from "@/components/reset/AuditWizard";
import { ResetTabs } from "@/components/reset/ResetTabs";

export const metadata = { title: "Reset audit · LifeOS" };
export const dynamic = "force-dynamic";

export default async function ResetAuditPage() {
  if (!resetPlanEnabled()) notFound();

  const { profile } = await requireProfile();
  const plan = await getCurrentPlan(profile.id);
  if (!plan) redirect("/reset");
  if (plan.status === "completed") redirect("/reset/finish");
  if (plan.status === "active" || plan.status === "paused") redirect("/reset/plan");

  const answers = Object.fromEntries(plan.answers.map((answer) => [answer.step, answer.answer]));

  return (
    <div className="space-y-4">
      <PageBanner
        icon={<ClipboardCheck className="h-5 w-5" />}
        title="The honest audit"
        subtitle="Three questions, one screen at a time. Nothing is scored and nothing is shared."
        accent="#a78bfa"
        aside={
          <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">
            <p className="font-display text-[0.85rem] font-semibold text-white">5 min</p>
            <p className="text-[0.58rem] uppercase tracking-[0.16em] text-white/30">save as you go</p>
          </div>
        }
      />

      <ResetTabs />
      <AuditWizard planId={plan.id} initialAnswers={answers} />

      <div className="grid gap-2 sm:grid-cols-3">
        {AUDIT_STEPS.map((entry) => (
          <div key={entry.step} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
            <div className="flex items-center gap-1.5 text-[0.58rem] font-bold uppercase tracking-[0.14em] text-white/30">
              {entry.step === 1 ? <ClipboardCheck className="h-3 w-3" /> : <LockKeyhole className="h-3 w-3" />}
              Step {entry.step}
            </div>
            <p className="mt-1 text-[0.74rem] font-semibold text-white/75">{entry.title}</p>
            <p className="mt-0.5 text-[0.66rem] leading-relaxed text-white/35">{entry.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
