import { describe, expect, it } from "vitest";
import { recentChatHistory } from "@/lib/agent/history";

describe("recentChatHistory", () => {
  it("keeps the most recent ten user/assistant exchanges in order", () => {
    const messages = Array.from({ length: 24 }, (_, index) => ({
      role: index % 2 === 0 ? "user" as const : "assistant" as const,
      content: `message ${index + 1}`,
    }));

    expect(recentChatHistory(messages)).toEqual(messages.slice(-20));
  });

  it("keeps all available messages when there are fewer than ten exchanges", () => {
    const messages = [
      { role: "user" as const, content: "Remember my exam is on Friday." },
      { role: "assistant" as const, content: "Got it." },
    ];

    expect(recentChatHistory(messages)).toEqual(messages);
  });
});
