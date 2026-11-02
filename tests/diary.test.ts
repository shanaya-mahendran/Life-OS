import { describe, expect, it } from "vitest";
import {
  bestEcho,
  buildTrendDigest,
  detectDistress,
  gradientStyle,
  lexicalSimilarity,
  parsePalette,
  pickSpark,
  readingMinutes,
  tokenize,
} from "@/lib/diary/text";
import { SPARK_BANK, SUPPORT_MESSAGE } from "@/lib/diary/constants";

describe("diary safety", () => {
  it("flags explicit crisis language", () => {
    expect(detectDistress("I want to die tonight")).toBe(true);
    expect(detectDistress("thinking about self-harm again")).toBe(true);
    expect(detectDistress("I could kill myself")).toBe(true);
  });

  it("leaves ordinary hard days alone", () => {
    expect(detectDistress("Today was heavy and I cried a bit.")).toBe(false);
    expect(detectDistress("I am exhausted by this project.")).toBe(false);
    expect(detectDistress("")).toBe(false);
  });

  it("never puts advice in the support message", () => {
    expect(SUPPORT_MESSAGE.toLowerCase()).not.toContain("you should");
  });
});

describe("spark rotation", () => {
  it("is deterministic for a day", () => {
    expect(pickSpark(120)).toBe(pickSpark(120));
  });

  it("skips prompts used in the last 14 days", () => {
    const recent = SPARK_BANK.slice(0, 10);
    const spark = pickSpark(3, [...recent]);
    expect(spark).not.toBeNull();
    expect(recent).not.toContain(spark);
  });

  it("returns null when every prompt is on cooldown", () => {
    expect(pickSpark(1, [...SPARK_BANK])).toBeNull();
  });
});

describe("echoes", () => {
  it("tokenizes without stopwords or short words", () => {
    expect(tokenize("The fear of being ordinary again")).toEqual(["fear", "ordinary", "again"]);
  });

  it("scores related entries above unrelated ones", () => {
    const related = lexicalSimilarity(
      "I keep freezing when the deadline approaches",
      "The deadline approaches and I freeze again",
    );
    const unrelated = lexicalSimilarity(
      "I keep freezing when the deadline approaches",
      "Bought tomatoes and fixed the bike chain",
    );
    expect(related).toBeGreaterThan(unrelated);
    expect(related).toBeGreaterThanOrEqual(0.3);
  });

  it("picks the strongest older entry above the threshold", () => {
    const best = bestEcho("the deadline keeps making me freeze", [
      { id: "a", body: "bought tomatoes and fixed the bike chain" },
      { id: "b", body: "deadline again and I freeze at the desk" },
    ]);
    expect(best?.entry.id).toBe("b");
  });

  it("returns null when nothing is close enough", () => {
    expect(bestEcho("quiet morning walk", [{ id: "a", body: "invoice spreadsheet numbers" }])).toBeNull();
  });
});

describe("palette safety", () => {
  it("accepts two hex colours", () => {
    expect(parsePalette(["#112233", "#ff00aa"], ["#000000", "#111111"])).toEqual(["#112233", "#ff00aa"]);
  });

  it("rejects anything that is not a hex colour", () => {
    expect(parsePalette(["red;background:url(x)", "#12345"], ["#0a0a0a", "#0b0b0b"])).toEqual(["#0a0a0a", "#0b0b0b"]);
    expect(parsePalette("nope", ["#0a0a0a", "#0b0b0b"])).toEqual(["#0a0a0a", "#0b0b0b"]);
  });

  it("builds a gradient from the pair", () => {
    const style = gradientStyle(["#112233", "#445566"]);
    expect(style.background).toContain("#112233");
    expect(style.background).toContain("#445566");
  });
});

describe("trend digest", () => {
  const rows = [
    {
      entryDate: "2026-09-02",
      createdAt: new Date("2026-09-02T20:10:00Z"),
      bodyLength: 900,
      tags: ["work"],
      stamps: ["☕"],
      colors: ["#111111"],
    },
    {
      entryDate: "2026-09-18",
      createdAt: new Date("2026-09-18T21:00:00Z"),
      bodyLength: 300,
      tags: ["work", "rest"],
      stamps: ["🌧️"],
      colors: ["#222222"],
    },
  ];

  it("summarises metadata only", () => {
    const digest = buildTrendDigest(rows, "Asia/Kolkata");
    expect(digest).toContain("Metadata only");
    expect(digest).toContain("2026-09: 2 entries");
    expect(digest).toContain("average 600 chars");
    expect(digest).toContain("work(2)");
  });

  it("returns an empty string with no rows", () => {
    expect(buildTrendDigest([], "UTC")).toBe("");
  });
});

describe("reading estimate", () => {
  it("never reports zero minutes", () => {
    expect(readingMinutes(0)).toBe(1);
    expect(readingMinutes(2000)).toBe(2);
  });
});
