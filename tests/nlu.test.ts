import { describe, expect, it } from "vitest";
import {
  detectDomain,
  detectIntent,
  extractTitle,
  inferEventDuration,
  isAffirmative,
  isNegative,
  parseDuration,
  parseRecurrenceText,
  parseTimeRange,
  parseWhen,
  titleCase,
} from "@/lib/agent/nlu";
import { utcToZoned } from "@/lib/time";

const TZ = "Asia/Kolkata";
// Sunday 1 November 2026, 11:30 in Kolkata.
const NOW = new Date("2026-11-01T06:00:00Z");

function localParts(text: string) {
  const parsed = parseWhen(text, NOW, TZ);
  if (!parsed) throw new Error(`Could not parse: ${text}`);
  return utcToZoned(parsed.date, TZ);
}

describe("parseWhen", () => {
  it("reads a time today", () => {
    const local = localParts("Move karate to 7 PM today");
    expect(local.day).toBe(1);
    expect(local.hour).toBe(19);
    expect(local.minute).toBe(0);
  });

  it("reads tomorrow with a morning time", () => {
    const local = localParts("block 2 hours for the pitch tomorrow at 9am");
    expect(local.day).toBe(2);
    expect(local.hour).toBe(9);
  });

  it("reads 'in N days'", () => {
    const parsed = parseWhen("plan revision for my exam in 10 days", NOW, TZ);
    expect(parsed?.explicitDate).toBe(true);
    expect(utcToZoned(parsed!.date, TZ).day).toBe(11);
  });

  it("reads a day and month", () => {
    const local = localParts("hackathon submission on 12 Nov at 6pm");
    expect(local.month).toBe(11);
    expect(local.day).toBe(12);
    expect(local.hour).toBe(18);
  });

  it("rolls a past month into next year", () => {
    const local = localParts("dentist on 3 Feb");
    expect(local.year).toBe(2027);
  });

  it("reads a weekday as the next occurrence", () => {
    const local = localParts("study block Thursday at 10:00");
    expect(local.weekday).toBe(4);
    expect(local.day).toBe(5);
  });

  it("treats 'at 7' as evening and 'at 9' as morning", () => {
    expect(localParts("karate at 7").hour).toBe(19);
    expect(localParts("study at 9").hour).toBe(9);
  });

  it("returns null when there is no time at all", () => {
    expect(parseWhen("what's on my plate", NOW, TZ)).toBeNull();
  });
});

describe("parseDuration", () => {
  it("reads hours and minutes", () => {
    expect(parseDuration("block 2 hours for the pitch")).toBe(120);
    expect(parseDuration("90 minutes of revision")).toBe(90);
    expect(parseDuration("half an hour")).toBe(30);
    expect(parseDuration("an hour")).toBe(60);
    expect(parseDuration("1.5 hours")).toBe(90);
    expect(parseDuration("30-minute sync")).toBe(30);
    expect(parseDuration("1 hour 15 mins")).toBe(75);
    expect(parseDuration("no idea")).toBeNull();
  });

  it("reads time ranges as durations", () => {
    expect(parseDuration("from 2pm to 3:30pm")).toBe(90);
    expect(parseDuration("from 10am to 11am")).toBe(60);
    expect(parseDuration("3pm - 4:15pm")).toBe(75);
    expect(parseDuration("meeting from 4 to 5 pm")).toBe(60);
  });
});

describe("inferEventDuration", () => {
  it("infers tailored durations when none specified", () => {
    expect(inferEventDuration("daily standup with team")).toBe(15);
    expect(inferEventDuration("quick sync")).toBe(15);
    expect(inferEventDuration("1:1 with mentor")).toBe(30);
    expect(inferEventDuration("coffee with Sarah")).toBe(30);
    expect(inferEventDuration("lunch with Alex")).toBe(45);
    expect(inferEventDuration("dentist appointment")).toBe(45);
    expect(inferEventDuration("gym session")).toBe(60);
    expect(inferEventDuration("karate training")).toBe(60);
    expect(inferEventDuration("team meeting")).toBe(60);
    expect(inferEventDuration("study block for algorithms")).toBe(90);
    expect(inferEventDuration("midterm exam")).toBe(120);
  });

  it("respects explicit durations over inference", () => {
    expect(inferEventDuration("quick sync for 45 minutes")).toBe(45);
    expect(inferEventDuration("gym for 30 mins")).toBe(30);
  });
});

describe("parseRecurrenceText", () => {
  it("detects daily and weekly repeats", () => {
    expect(parseRecurrenceText("karate every day")).toBe("DAILY");
    expect(parseRecurrenceText("every monday and thursday")).toBe("WEEKLY:MO,TH");
    expect(parseRecurrenceText("weekdays")).toBe("WEEKLY:MO,TU,WE,TH,FR");
    expect(parseRecurrenceText("karate tomorrow")).toBeNull();
  });
});

describe("detectDomain", () => {
  it("maps everyday words to domains", () => {
    expect(detectDomain("move karate to 7 pm")).toBe("karate");
    expect(detectDomain("prepare the hackathon pitch")).toBe("competitions");
    expect(detectDomain("revise for my exam")).toBe("education");
    expect(detectDomain("lunch with the team")).toBe("food");
    expect(detectDomain("write the blog draft")).toBe("blogging");
    expect(detectDomain("pay the scholarship fee")).toBe("finance");
    expect(detectDomain("call my mentor")).toBe("social");
    expect(detectDomain("nothing relevant here")).toBeNull();
  });
});

describe("detectIntent", () => {
  it("classifies real commands", () => {
    expect(detectIntent("Move karate to 7 PM today")).toBe("move");
    expect(detectIntent("Cancel the blog draft")).toBe("cancel");
    expect(detectIntent("What's on Thursday?")).toBe("query");
    expect(detectIntent("Find free time tomorrow for studying")).toBe("free_slots");
    expect(detectIntent("Plan revision for my exam in 10 days")).toBe("plan");
    expect(detectIntent("Block 2 hours for the pitch tomorrow")).toBe("create");
    expect(detectIntent("Mark finish data structures revision as done")).toBe("complete");
    expect(detectIntent("Add a task to submit the scholarship form")).toBe("task");
    expect(detectIntent("undo that")).toBe("undo");
  });
});

describe("extractTitle", () => {
  it("removes times, durations and filler", () => {
    const title = extractTitle("Block 2 hours for the pitch tomorrow").toLowerCase();
    expect(title).toContain("pitch");
    expect(title).not.toContain("hour");
    expect(title).not.toContain("tomorrow");
  });

  it("extracts quoted title accurately", () => {
    expect(extractTitle('Create "Mentoring" for every monday and saturday at 3 pm to 5pm')).toBe("Mentoring");
    expect(extractTitle("Create 'Deep Focus' tomorrow at 2pm")).toBe("Deep Focus");
  });

  it("parses multi-day weekly recurrence", () => {
    expect(parseRecurrenceText('Create "Mentoring" for every monday and saturday at 3 pm to 5pm')).toBe("WEEKLY:MO,SA");
    expect(parseRecurrenceText("repeat on mondays and saturdays")).toBe("WEEKLY:MO,SA");
    expect(parseRecurrenceText("every weekend")).toBe("WEEKLY:SA,SU");
  });

  it("parses time range from 3 pm to 5pm as 120 minutes", () => {
    const range = parseTimeRange("at 3 pm to 5pm");
    expect(range?.startMinutes).toBe(15 * 60);
    expect(range?.endMinutes).toBe(17 * 60);
    expect(range?.durationMinutes).toBe(120);
  });
});

describe("affirmations", () => {
  it("recognises a yes", () => {
    expect(isAffirmative("yes")).toBe(true);
    expect(isAffirmative("Save anyway")).toBe(true);
    expect(isAffirmative("go ahead")).toBe(true);
  });

  it("recognises a no before a yes", () => {
    expect(isNegative("no, leave it")).toBe(true);
    expect(isAffirmative("no thanks")).toBe(false);
    expect(isAffirmative("not now")).toBe(false);
  });
});
