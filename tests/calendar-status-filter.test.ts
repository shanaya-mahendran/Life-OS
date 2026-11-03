import { describe, expect, it } from "vitest";
import { eventStatusExclusions } from "../src/lib/calendar/status-filter";

describe("event status exclusions", () => {
  it("hides cancelled and suggested events by default", () => {
    expect(eventStatusExclusions({})).toEqual(["cancelled", "suggested"]);
  });

  it("can exclude cancelled and suggested events together", () => {
    expect(eventStatusExclusions({ includeSuggested: false })).toEqual(["cancelled", "suggested"]);
  });

  it("includes both statuses only when explicitly requested", () => {
    expect(eventStatusExclusions({ includeCancelled: true, includeSuggested: true })).toEqual([]);
  });
});
