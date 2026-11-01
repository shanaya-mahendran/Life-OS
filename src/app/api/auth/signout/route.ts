import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut().catch(() => {});
  }
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut().catch(() => {});
  }
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
