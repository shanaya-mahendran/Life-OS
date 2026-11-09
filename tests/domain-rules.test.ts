import { describe, expect, it } from "vitest";
import {
  planBackwardsSpaced,
  calculateSpacedRevisionGaps,
  rankSlots,
  calculateSleepDebt,
  calculateGradeNeeded,
  buildReverseSprint,
  evaluateSkillTree,
  scoreIssueFit,
  harvestPostIdeas,
  classifyDayLoad,
  planPrepOnceMeals,
  buildBeltPath,
  checkKarateRecovery,
  calculateRefillCountdown,
  calculateRecoveryForecast,
  getHeatmapShade,
  calculatePrayerStreak,
  predictCycleRange,
  detectDistressText,
  calculateStreakWithGrace,
  detectCommitmentDrift,
  buildLifeCompass,
  checkVolunteeringCrowding,
  buildDoorToDoorBlocks,
  getSeasonProfileOverrides,
} from "@/lib/domains/rules";

describe("Domain Rules Engine", () => {
  describe("Backward planning & Spaced revision", () => {
    it("places backward planned blocks before deadline minus stop days", () => {
      const deadline = new Date("2026-11-20T18:00:00Z");
      const availableSlots = [
        { start: new Date("2026-11-15T09:00:00Z"), end: new Date("2026-11-15T11:00:00Z"), score: 60 },
        { start: new Date("2026-11-16T14:00:00Z"), end: new Date("2026-11-16T16:00:00Z"), score: 70 },
        { start: new Date("2026-11-20T10:00:00Z"), end: new Date("2026-11-20T12:00:00Z"), score: 80 }, // day of deadline, should be excluded
      ];

      const planned = planBackwardsSpaced({
        deadline,
        totalHours: 3,
        availableSlots,
        stopDaysBefore: 1,
      });

      expect(planned.length).toBeGreaterThan(0);
      for (const block of planned) {
        expect(block.end.getTime()).toBeLessThanOrEqual(new Date("2026-11-19T18:00:00Z").getTime());
      }
    });

    it("squeezes spaced revision gaps if window is shorter than 14 days", () => {
      const target = new Date("2026-11-10T00:00:00Z");
      const from = new Date("2026-11-04T00:00:00Z"); // 6-day window
      const gaps = calculateSpacedRevisionGaps(target, from);

      expect(gaps.length).toBeGreaterThan(0);
      expect(Math.max(...gaps)).toBeLessThan(6);
    });

    it("ranks focus slots higher and eliminates Tier 1 anchors", () => {
      const slots = [
        { start: new Date("2026-11-15T10:00:00Z"), end: new Date("2026-11-15T11:30:00Z") },
        { start: new Date("2026-11-15T23:30:00Z"), end: new Date("2026-11-16T01:00:00Z") },
      ];
      const protectedAnchors = [
        {
          start: new Date("2026-11-15T23:00:00Z"),
          end: new Date("2026-11-16T07:00:00Z"),
          tier: 1 as const,
        },
      ];

      const ranked = rankSlots(
        slots,
        { startHour: 9, endHour: 12 },
        { "2026-11-15": 120 },
        protectedAnchors,
      );

      expect(ranked).toHaveLength(1);
      expect(ranked[0].start.getUTCHours()).toBe(10);
    });
  });

  describe("Sleep Debt Bank", () => {
    it("computes 7-day debt and offers repayment plan without adding load", () => {
      const logs = [
        { date: "2026-11-01", hours: 6 },
        { date: "2026-11-02", hours: 6.5 },
        { date: "2026-11-03", hours: 6 },
        { date: "2026-11-04", hours: 8 },
        { date: "2026-11-05", hours: 7.5 },
        { date: "2026-11-06", hours: 7.5 },
        { date: "2026-11-07", hours: 7.5 },
      ];

      const res = calculateSleepDebt(logs, 7.5);
      expect(res.debtHours).toBe(4);
      expect(res.shortfallDays).toBe(3);
      expect(res.repayProposal).not.toBeNull();
      expect(res.repayProposal?.bedtimeShiftMinutes).toBeGreaterThan(0);
    });
  });

  describe("Education & Competitions", () => {
    it("calculates required exam score accurately", () => {
      // Need 85 total, earned 50 so far, remaining weight is 40%
      const res = calculateGradeNeeded(85, 50, 40);
      expect(res.requiredScore).toBe(87.5);
      expect(res.isAchievable).toBe(true);
    });

    it("builds reverse sprint milestones in correct chronological order", () => {
      const subTime = new Date("2026-11-20T18:00:00Z");
      const milestones = buildReverseSprint(subTime);

      expect(milestones.length).toBe(5);
      expect(milestones[0].type).toBe("rehearsal");
      expect(milestones[milestones.length - 1].type).toBe("submission");
    });
  });

  describe("Skill Tree & Issue Fit", () => {
    it("unlocks nodes whose prerequisites are done", () => {
      const tree = [
        { id: "s1", name: "Git basics", prerequisites: [], done: true, importance: 8, effortHours: 2 },
        { id: "s2", name: "PR workflows", prerequisites: ["s1"], done: false, importance: 9, effortHours: 3 },
        { id: "s3", name: "Compiler design", prerequisites: ["s2"], done: false, importance: 10, effortHours: 20 },
      ];

      const res = evaluateSkillTree(tree);
      expect(res.unlocked.map((n) => n.id)).toEqual(["s2"]);
      expect(res.recommended?.id).toBe("s2");
    });

    it("scores issue fit with skill matching and maintainer responsiveness", () => {
      const issue = {
        id: "i1",
        title: "Add TypeScript types",
        labels: ["typescript", "good first issue"],
        estimatedHours: 2,
        maintainerResponseHours: 12,
      };

      const score = scoreIssueFit(issue, ["typescript"], 2);
      expect(score).toBeGreaterThan(5);
    });
  });

  describe("Food, Karate & Medicine", () => {
    it("assigns zero-cook meals on heavy days and batch cooking on light days", () => {
      const days = [
        { date: "2026-11-10", plannedMinutes: 420 }, // heavy
        { date: "2026-11-11", plannedMinutes: 120 }, // light
      ];
      const plan = planPrepOnceMeals(days);
      expect(plan[0].mealType).toBe("zero-cook");
      expect(plan[1].mealType).toBe("batch-cook-prep");
    });

    it("splits unsolid karate syllabus items across weeks", () => {
      const items = [
        { name: "Bassai Dai", isSolid: false, type: "kata" as const },
        { name: "Kanku Dai", isSolid: false, type: "kata" as const },
        { name: "Mawashi Geri", isSolid: true, type: "technique" as const },
      ];
      const grading = new Date("2026-12-15T00:00:00Z");
      const now = new Date("2026-11-10T00:00:00Z");

      const path = buildBeltPath(items, grading, now);
      expect(path.weeklyDrills.length).toBeGreaterThan(0);
      expect(path.finalReviewWeek).toBe(true);
    });

    it("triggers medicine refill alert when days remaining is under lead time", () => {
      const med = {
        name: "Inhaler",
        doseTime: "08:00",
        stockRemaining: 6,
        dosesPerDay: 2,
        refillLeadDays: 5,
      };
      const res = calculateRefillCountdown(med);
      expect(res.daysRemaining).toBe(3);
      expect(res.needsRefillAlert).toBe(true);
    });
  });

  describe("Prayer, Period & Mood Safety", () => {
    it("evaluates prayer heatmap shades and streaks", () => {
      expect(getHeatmapShade(0)).toBe(0);
      expect(getHeatmapShade(2)).toBe(1);
      expect(getHeatmapShade(5)).toBe(4);
      expect(getHeatmapShade(0, true)).toBe(-1); // excused

      const streak = calculatePrayerStreak([
        { date: "2026-11-01", completedCount: 5 },
        { date: "2026-11-02", completedCount: 5 },
        { date: "2026-11-03", completedCount: 0, isExcused: true }, // excused doesn't break
        { date: "2026-11-04", completedCount: 5 },
      ]);
      expect(streak.currentStreak).toBe(4);
    });

    it("predicts cycle range as shortest to longest of recent cycles", () => {
      const cycles = [
        { startDate: "2026-08-01" },
        { startDate: "2026-08-29" }, // 28
        { startDate: "2026-09-25" }, // 27
        { startDate: "2026-10-25" }, // 30
      ];
      const pred = predictCycleRange(cycles);
      expect(pred.status).toBe("ready");
      expect(pred.predictedStartDaysMin).toBe(27);
      expect(pred.predictedStartDaysMax).toBe(30);
    });

    it("detects serious distress and pauses planning with care-first response", () => {
      expect(detectDistressText("I want to die")).toBe(true);
      expect(detectDistressText("Planning my week")).toBe(false);
    });
  });

  describe("Habits, Forward Planning, Travel & Seasons", () => {
    it("maintains habit streak within grace skips", () => {
      const history = [
        { date: "2026-11-01", result: "done" as const },
        { date: "2026-11-02", result: "skipped" as const }, // 1 skip
        { date: "2026-11-03", result: "done" as const },
      ];
      const res = calculateStreakWithGrace(history, 2);
      expect(res.broken).toBe(false);
      expect(res.streak).toBe(2);
    });

    it("builds Life Compass balance wheel and identifies top deficit domains", () => {
      const intents = { education: 20, career: 10, karate: 5 };
      const actuals = { education: 12, career: 9, karate: 6 };
      const compass = buildLifeCompass(intents, actuals);

      expect(compass.topDeficitDomains).toContain("education");
    });

    it("inserts door-to-door commute and buffer around location events", () => {
      const start = new Date("2026-11-10T14:00:00Z");
      const end = new Date("2026-11-10T15:00:00Z");
      const blocks = buildDoorToDoorBlocks(start, end, 30, 15);

      expect(blocks.travelBefore.end.getTime()).toBe(start.getTime());
      expect(blocks.travelBefore.start.getTime()).toBe(start.getTime() - 45 * 60 * 1000);
      expect(blocks.travelAfter.start.getTime()).toBe(end.getTime());
    });

    it("applies exam season profile overrides", () => {
      const overrides = getSeasonProfileOverrides("exam_season");
      expect(overrides.karateIntensity).toBe("light");
      expect(overrides.maxFocusHours).toBe(5);
    });

    it("triggers high risk recovery forecast when load and sleep debt are severe", () => {
      const forecast = calculateRecoveryForecast(45, 5, 2.0);
      expect(forecast.risk).toBe("high");
      expect(forecast.proposeExtraBuffer).toBe(true);
    });

    it("detects commitment drift after 3 consecutive missed check-ins", () => {
      expect(detectCommitmentDrift(["missed", "missed", "missed"])).toBe(true);
      expect(detectCommitmentDrift(["done", "skipped", "done"])).toBe(false);
    });

    it("warns about volunteering crowding during an exam week", () => {
      expect(checkVolunteeringCrowding(6, true, false)).toBe(true);
      expect(checkVolunteeringCrowding(2, true, false)).toBe(false);
      expect(checkVolunteeringCrowding(6, false, false)).toBe(false);
    });

    it("labels cycle prediction as needs_more_data when fewer than 3 cycles exist", () => {
      const pred = predictCycleRange([{ startDate: "2026-09-01" }, { startDate: "2026-09-29" }]);
      expect(pred.status).toBe("needs_more_data");
    });
  });
});
