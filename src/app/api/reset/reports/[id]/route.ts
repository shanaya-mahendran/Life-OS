import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiUser } from "@/lib/api";
import { resetPlanEnabled } from "@/lib/reset/flags";
import { deleteReport, getReportForUser, updateReportSummary } from "@/lib/reset/reports";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  summary: z.string().max(6000),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!resetPlanEnabled()) return jsonError("Reset Plan is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const report = await getReportForUser(auth.ctx.userId, id);
  if (!report) return jsonError("Report not found.", 404);

  return new NextResponse(JSON.stringify(report, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="lifeos-reset-report-day-${report.reviewDay}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!resetPlanEnabled()) return jsonError("Reset Plan is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const { id } = await params;
  const result = await updateReportSummary(auth.ctx.userId, id, parsed.data.summary);
  if (!result.ok) return jsonError(result.message ?? "Could not save the summary.", 404);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!resetPlanEnabled()) return jsonError("Reset Plan is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const deleted = await deleteReport(auth.ctx.userId, id);
  if (!deleted) return jsonError("Report not found.", 404);
  return NextResponse.json({ ok: true });
}
