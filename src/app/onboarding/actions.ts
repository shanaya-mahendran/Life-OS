"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth";
import { seedStarterWeek } from "@/lib/account";

export interface OnboardingState {
  error?: string;
}

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const { profile } = await requireProfile();

  const name = String(formData.get("name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? profile.timezone);
  const wakeTime = String(formData.get("wakeTime") ?? "07:00");
  const sleepTime = String(formData.get("sleepTime") ?? "23:00");
  const prefill = formData.get("prefill") === "on";

  await prisma.user.update({
    where: { id: profile.id },
    data: {
      name: name || profile.name,
      timezone,
      wakeTime,
      sleepTime,
      onboardedAt: new Date(),
    },
  });

  if (prefill) {
    await seedStarterWeek(profile.id);
  }

  redirect("/today");
}
