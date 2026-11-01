/** Helpers shared by every JSON route handler. */

import { NextResponse } from "next/server";
import { ensureAccount, type AccountProfile } from "@/lib/account";
import { toServiceUser } from "@/lib/auth";
import { getSessionUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { ServiceUser } from "@/lib/calendar/service";

export interface ApiContext {
  userId: string;
  email: string;
  user: ServiceUser;
  profile: AccountProfile;
}

/** Resolve the signed-in account, or return a ready-to-send error response. */
export async function requireApiUser(): Promise<{ ctx: ApiContext } | { response: NextResponse }> {
  if (!isSupabaseConfigured) {
    return {
      response: NextResponse.json({ error: "Supabase is not configured." }, { status: 503 }),
    };
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser?.email) {
    return { response: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  }

  const profile = await ensureAccount({
    id: sessionUser.id,
    email: sessionUser.email,
    name: (sessionUser.user_metadata?.full_name as string | undefined) ?? null,
  });

  return {
    ctx: { userId: profile.id, email: profile.email, user: toServiceUser(profile), profile },
  };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
