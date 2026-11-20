import { cache } from "react";
import { redirect } from "next/navigation";
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

/** Returns the raw Supabase user, or null when signed out / not configured. */
export const getSessionUser = cache(async () => {
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
  if (!isSupabaseConfigured) redirect("/setup");

  const user = await getSessionUser();
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
