"use client";

import { createSupabaseBrowserClient } from "./supabase/client";

/**
 * Signs out the current user across both client-side Supabase state and server cookies,
 * then redirects to the login screen.
 */
export async function signOutUser(): Promise<void> {
  try {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut().catch(() => {});
  } catch {
    // ignore client error
  }

  try {
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
  } catch {
    // ignore fetch error
  }

  // Hard reload to /login ensures all layout caches and profile states are wiped
  window.location.href = "/login";
}
