import { describe, expect, it } from "vitest";
import { recentChatHistory } from "@/lib/agent/history";

describe("recentChatHistory", () => {
  it("keeps the most recent five user/assistant exchanges in order", () => {
    const messages = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 === 0 ? "user" as const : "assistant" as const,
      content: `message ${index + 1}`,
    }));

    expect(recentChatHistory(messages)).toEqual(messages.slice(-10));
  });

  it("keeps all available messages when there are fewer than five exchanges", () => {
    const messages = [
      { role: "user" as const, content: "Remember my exam is on Friday." },
      { role: "assistant" as const, content: "Got it." },
    ];

    expect(recentChatHistory(messages)).toEqual(messages);
  });
});
