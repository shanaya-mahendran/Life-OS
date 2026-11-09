"use server";

import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface AuthState {
  error?: string;
  notice?: string;
}

async function origin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function demoSignInAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("lifeos_demo_session", "1", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  redirect("/today");
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/today");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  // Fast-path demo login
  if (email.toLowerCase() === "demo@lifeos.app" || email.toLowerCase() === "demo") {
    await demoSignInAction();
    return {};
  }

  if (!isSupabaseConfigured) {
    return { error: "Supabase is not configured. Add your project keys to .env first, or click 'Try Demo Account'." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { error: error.message };
    }
  } catch (err) {
    console.error("[lifeos] Supabase signIn error:", err);
    return {
      error:
        "The Supabase authentication service is currently unavailable or paused (503). You can resume it in your Supabase dashboard, or click 'Explore in Demo Mode' below to sign in immediately.",
    };
  }

  redirect(next.startsWith("/") ? next : "/today");
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }
  if (password.length < 8) {
    return { error: "Use at least 8 characters for your password." };
  }

  if (email.toLowerCase() === "demo@lifeos.app") {
    await demoSignInAction();
    return {};
  }

  if (!isSupabaseConfigured) {
    return { error: "Supabase is not configured. Add your project keys to .env first, or click 'Try Demo Account'." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name || email.split("@")[0] },
        emailRedirectTo: `${await origin()}/auth/callback`,
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (!data.session) {
      return {
        notice:
          "Check your inbox to confirm your email, then sign in. (Your Supabase project has email confirmation enabled.)",
      };
    }
  } catch (err) {
    console.error("[lifeos] Supabase signUp error:", err);
    return {
      error:
        "The Supabase authentication service is currently unavailable or paused (503). Resume your Supabase project in the Supabase dashboard, or use 'Explore in Demo Mode' to start right away.",
    };
  }

  redirect("/onboarding");
}

export async function signOutAction() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("lifeos_demo_session");
  } catch {
    // ignore
  }

  if (isSupabaseConfigured) {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
  }
  redirect("/login");
}
