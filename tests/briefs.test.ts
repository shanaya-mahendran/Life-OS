import { describe, expect, it } from "vitest";
import { greetingFor } from "@/lib/briefs";
import { zonedToUtc } from "@/lib/time";

describe("greetingFor", () => {
  it("uses the user's timezone and switches to a late-night greeting at 10 PM", () => {
    const lateNight = zonedToUtc(
      { year: 2026, month: 11, day: 4, hour: 23, minute: 55 },
      "Asia/Kolkata",
    );
    const evening = zonedToUtc(
      { year: 2026, month: 11, day: 4, hour: 21, minute: 59 },
      "Asia/Kolkata",
    );

    expect(greetingFor(lateNight, "Asia/Kolkata")).toBe("Good night");
    expect(greetingFor(evening, "Asia/Kolkata")).toBe("Good evening");
  });
});
