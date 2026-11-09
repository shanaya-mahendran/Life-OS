import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ensureAccount, type AccountProfile } from "@/lib/account";
import type { ServiceUser } from "@/lib/calendar/service";

export interface SessionContext {
  authId: string;
  email: string;
  profile: AccountProfile;
  user: ServiceUser;
}

const DEMO_PROFILE: AccountProfile = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "demo@lifeos.app",
  name: "Shanaya Mahendran",
  timezone: "Asia/Kolkata",
  wakeTime: "07:00",
  sleepTime: "23:00",
  dayStartHour: 6,
  dayEndHour: 23,
  minSleepHours: 7.5,
  maxFocusHours: 6,
  monthlyTokenBudget: 2000000,
  onboardedAt: new Date(),
};

export function toServiceUser(profile: AccountProfile): ServiceUser {
  return {
    id: profile.id,
    timezone: profile.timezone,
    wakeTime: profile.wakeTime,
    sleepTime: profile.sleepTime,
    dayStartHour: profile.dayStartHour,
    dayEndHour: profile.dayEndHour,
    minSleepHours: profile.minSleepHours,
    maxFocusHours: profile.maxFocusHours,
  };
}

/** Returns the raw Supabase user or demo user, or null when signed out / not configured. */
export const getSessionUser = cache(async () => {
  try {
    const cookieStore = await cookies();
    if (cookieStore.get("lifeos_demo_session")?.value === "1") {
      return {
        id: DEMO_PROFILE.id,
        email: DEMO_PROFILE.email,
        user_metadata: { full_name: DEMO_PROFILE.name },
      };
    }
  } catch {
    // cookies() unavailable in some contexts
  }

  if (!isSupabaseConfigured) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
});

/** Server-side guard: redirects to /login or /setup and returns the profile. */
export const requireProfile = cache(async (): Promise<SessionContext> => {
  const user = await getSessionUser();

  if (user?.id === DEMO_PROFILE.id) {
    try {
      const profile = await ensureAccount({
        id: DEMO_PROFILE.id,
        email: DEMO_PROFILE.email,
        name: DEMO_PROFILE.name,
      });
      return {
        authId: DEMO_PROFILE.id,
        email: DEMO_PROFILE.email,
        profile,
        user: toServiceUser(profile),
      };
    } catch {
      return {
        authId: DEMO_PROFILE.id,
        email: DEMO_PROFILE.email,
        profile: DEMO_PROFILE,
        user: toServiceUser(DEMO_PROFILE),
      };
    }
  }

  if (!isSupabaseConfigured) redirect("/setup");
  if (!user?.email) redirect("/login");

  const profile = await ensureAccount({
    id: user.id,
    email: user.email,
    name: (user.user_metadata?.full_name as string | undefined) ?? null,
  });

  return {
    authId: user.id,
    email: user.email,
    profile,
    user: toServiceUser(profile),
  };
});
