import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiUser } from "@/lib/api";
import { formatZodError } from "@/lib/validation";
import { resetPlanEnabled } from "@/lib/reset/flags";
import {
  approveGapReport,
  approveResetPlan,
  advanceResetPhase,
  createCommitment,
  createResetPlan,
  deleteCommitment,
  deleteResetPlan,
  generateGapReport,
  recordResetCheckin,
  resolveDrift,
  saveAuditAnswer,
  saveGapReport,
  setPlanStatus,
  startNewCycle,
  syncResetCalendar,
  undoResetBatch,
  unlockResetPhase,
  updateCommitment,
  updatePlanSettings,
} from "@/lib/reset/service";
import { saveResetNotebook } from "@/lib/reset/reports";
import { ensurePlanReports } from "@/lib/reset/reports";
import { syncResetNotifications } from "@/lib/reset/notifications";

export const dynamic = "force-dynamic";

const kindSchema = z.enum(["cut", "anchor", "routine", "nonnegotiable", "goal", "challenge"]);

const commitmentBase = z.object({
  phase: z.number().int().min(1).max(3),
  kind: kindSchema,
  title: z.string().trim().min(1).max(160),
  notes: z.string().max(2000).optional(),
  domainSlug: z.string().max(60).optional(),
  cadence: z.enum(["daily", "weekly"]).optional(),
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  durationMinutes: z.number().int().min(5).max(240).optional(),
  calendarEnabled: z.boolean().optional(),
  goalArea: z.enum(["finances", "productivity", "personal"]).nullable().optional(),
  metric: z.string().max(80).optional(),
  unit: z.string().max(40).optional(),
  targetValue: z.number().positive().max(1_000_000).nullable().optional(),
});

const commitmentPatch = commitmentBase.omit({ phase: true, kind: true }).partial();

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("new-cycle"), lighter: z.boolean().optional() }),
  z.object({ action: z.literal("pause"), planId: z.string().min(1) }),
  z.object({ action: z.literal("resume"), planId: z.string().min(1) }),
  z.object({ action: z.literal("complete"), planId: z.string().min(1) }),
  z.object({ action: z.literal("unlock-phase"), planId: z.string().min(1), phase: z.number().int().min(1).max(3) }),
  z.object({
    action: z.literal("checkin"),
    planId: z.string().min(1),
    commitmentId: z.string().min(1),
    result: z.enum(["done", "skipped", "missed"]),
    dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  z.object({
    action: z.literal("drift"),
    planId: z.string().min(1),
    commitmentId: z.string().min(1),
    driftAction: z.enum(["move", "drop", "lighter", "dismiss"]),
  }),
  z.object({ action: z.literal("approve"), planId: z.string().min(1), force: z.boolean().optional() }),
  z.object({ action: z.literal("sync"), planId: z.string().min(1), force: z.boolean().optional() }),
  z.object({ action: z.literal("advance"), planId: z.string().min(1), force: z.boolean().optional() }),
  z.object({ action: z.literal("undo-batch"), planId: z.string().min(1), batchId: z.string().min(1) }),
  z.object({ action: z.literal("delete"), planId: z.string().min(1) }),
  z.object({
    action: z.literal("save-audit"),
    planId: z.string().min(1),
    step: z.number().int().min(1).max(3),
    answer: z.string().max(6000),
  }),
  z.object({ action: z.literal("generate-gap"), planId: z.string().min(1) }),
  z.object({
    action: z.literal("save-gap"),
    planId: z.string().min(1),
    report: z.record(z.string(), z.unknown()),
  }),
  z.object({ action: z.literal("approve-gap"), planId: z.string().min(1) }),
  z.object({
    action: z.literal("settings"),
    planId: z.string().min(1),
    checkinTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    autonomy: z.enum(["suggest", "auto_small"]).optional(),
    sendAnswersToAi: z.boolean().optional(),
    notifyCheckin: z.boolean().optional(),
    notifyReviews: z.boolean().optional(),
    notifyReports: z.boolean().optional(),
    notifyDrift: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("commitment-create"),
    planId: z.string().min(1),
    commitment: commitmentBase,
  }),
  z.object({
    action: z.literal("commitment-update"),
    commitmentId: z.string().min(1),
    patch: commitmentPatch,
  }),
  z.object({ action: z.literal("commitment-delete"), commitmentId: z.string().min(1) }),
  z.object({
    action: z.literal("notebook"),
    planId: z.string().min(1),
    reviewDay: z.number().int().min(15).max(90),
    q1: z.string().max(4000).default(""),
    q2: z.string().max(4000).default(""),
    q3: z.string().max(4000).default(""),
    skipped: z.boolean().default(false),
  }),
]);

export async function GET() {
  if (!resetPlanEnabled()) return jsonError("Reset Plan is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  if (!resetPlanEnabled()) return jsonError("Reset Plan is disabled.", 404);

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const user = auth.ctx.user;

  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const input = parsed.data;

  switch (input.action) {
    case "start": {
      const plan = await createResetPlan(user.id);
      return NextResponse.json({ ok: true, planId: plan.id });
    }

    case "new-cycle": {
      const result = await startNewCycle(user.id, { lighter: input.lighter });
      if (!result.ok) return jsonError(result.message);
      return NextResponse.json(result);
    }

    case "pause":
    case "resume":
    case "complete": {
      const status = input.action === "pause" ? "paused" : input.action === "resume" ? "active" : "completed";
      const result = await setPlanStatus(user.id, input.planId, status);
      if (!result.ok) return jsonError(result.message);
      return NextResponse.json({ ok: true, status });
    }

    case "unlock-phase": {
      const result = await unlockResetPhase(user.id, input.planId, input.phase);
      if (!result.ok) return jsonError(result.message);
      return NextResponse.json(result);
    }

    case "checkin": {
      const result = await recordResetCheckin(
        user,
        input.planId,
        input.commitmentId,
        input.result,
        input.dateKey,
      );
      if (!result.ok) return jsonError(result.message);
      return NextResponse.json(result);
    }

    case "drift": {
      const result = await resolveDrift(user, input.planId, input.commitmentId, input.driftAction);
      if (!result.ok) return jsonError(result.message);
      return NextResponse.json(result);
    }

    case "approve": {
      const result = await approveResetPlan(user, input.planId, { force: input.force });
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, requiresConfirmation: result.requiresConfirmation, conflicts: result.conflicts, error: result.message },
          { status: result.requiresConfirmation ? 409 : 400 },
        );
      }
      return NextResponse.json(result);
    }

    case "sync": {
      const result = await syncResetCalendar(user, input.planId, { force: input.force });
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, requiresConfirmation: result.requiresConfirmation, conflicts: result.conflicts, error: result.message },
          { status: result.requiresConfirmation ? 409 : 400 },
        );
      }
      return NextResponse.json(result);
    }

    case "advance": {
      const result = await advanceResetPhase(user, input.planId, { force: input.force });
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, requiresConfirmation: result.requiresConfirmation, conflicts: result.conflicts, error: result.message },
          { status: result.requiresConfirmation ? 409 : 400 },
        );
      }
      return NextResponse.json(result);
    }

    case "undo-batch": {
      const result = await undoResetBatch(user.id, input.planId, input.batchId);
      if (!result.ok) return jsonError(result.message);
      return NextResponse.json(result);
    }

    case "delete": {
      const result = await deleteResetPlan(user.id, input.planId);
      if (!result.ok) return jsonError(result.message);
      return NextResponse.json(result);
    }

    case "save-audit": {
      const result = await saveAuditAnswer(user.id, input.planId, input.step, input.answer);
      if (!result.ok) return jsonError(result.message);
      return NextResponse.json(result);
    }

    case "generate-gap": {
      const result = await generateGapReport(user.id, input.planId);
      if (!result.ok) return jsonError(result.message);
      return NextResponse.json(result);
    }

    case "save-gap": {
      const result = await saveGapReport(user.id, input.planId, input.report);
      if (!result.ok) return jsonError(result.message);
      return NextResponse.json(result);
    }

    case "approve-gap": {
      const result = await approveGapReport(user.id, input.planId, user);
      if (!result.ok) return jsonError(result.message);
      return NextResponse.json(result);
    }

    case "settings": {
      const result = await updatePlanSettings(user.id, input.planId, {
        checkinTime: input.checkinTime,
        autonomy: input.autonomy,
        sendAnswersToAi: input.sendAnswersToAi,
        notifyCheckin: input.notifyCheckin,
        notifyReviews: input.notifyReviews,
        notifyReports: input.notifyReports,
        notifyDrift: input.notifyDrift,
      });
      if (!result.ok) return jsonError(result.message);
      return NextResponse.json(result);
    }

    case "commitment-create": {
      const result = await createCommitment(user.id, input.planId, input.commitment, user);
      if (!result.ok) return jsonError(result.message);
      return NextResponse.json(result);
    }

    case "commitment-update": {
      const result = await updateCommitment(user.id, input.commitmentId, input.patch);
      if (!result.ok) return jsonError(result.message);
      return NextResponse.json(result);
    }

    case "commitment-delete": {
      const result = await deleteCommitment(user.id, input.commitmentId);
      if (!result.ok) return jsonError(result.message);
      return NextResponse.json(result);
    }

    case "notebook": {
      const result = await saveResetNotebook(
        user,
        input.planId,
        input.reviewDay,
        { q1: input.q1, q2: input.q2, q3: input.q3 },
        input.skipped,
      );
      if (!result.ok) return jsonError(result.message);
      return NextResponse.json(result);
    }

    default:
      return jsonError("Unknown action.");
  }
}

/** Convenience endpoint used by the plan page to make sure due reports exist. */
export async function PATCH() {
  if (!resetPlanEnabled()) return jsonError("Reset Plan is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { getCurrentPlan } = await import("@/lib/reset/service");
  const plan = await getCurrentPlan(auth.ctx.userId);
  if (!plan) return NextResponse.json({ ok: true, built: 0 });
  const built = await ensurePlanReports(plan, new Date(), auth.ctx.user.timezone);
  await syncResetNotifications(plan, new Date(), auth.ctx.user.timezone);
  return NextResponse.json({ ok: true, built });
}
