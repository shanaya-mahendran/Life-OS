import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

/**
 * Refreshes the auth cookie on every request and reports whether the visitor
 * is signed in. Route protection itself lives in `middleware.ts`.
 */
export async function updateSession(request: NextRequest) {
  // Check for local demo session cookie first
  if (request.cookies.get("lifeos_demo_session")?.value === "1") {
    return { response: NextResponse.next({ request }), userId: DEMO_USER_ID };
  }

  if (!isSupabaseConfigured) {
    return { response: NextResponse.next({ request }), userId: null as string | null };
  }

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    return { response, userId: user?.id ?? null };
  } catch (error) {
    console.warn("[lifeos] Supabase auth check failed (paused or unreachable):", error);
    return { response, userId: null };
  }
}
