import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api";
import { undoLastAction } from "@/lib/calendar/service";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const result = await undoLastAction(auth.ctx.userId);
  return NextResponse.json(result);
}
