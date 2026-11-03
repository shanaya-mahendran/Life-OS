import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth";
import { budgetStatus } from "@/lib/agent/usage";
import { isAIConfigured } from "@/lib/agent/llm";
import { ChatWorkspace, type ChatMessage } from "@/components/chat/ChatWorkspace";
import type { ChatChange } from "@/components/chat/ChangeCard";

export const metadata = { title: "Chat · LifeOS" };
export const dynamic = "force-dynamic";

const QUICK_PROMPTS = [
  "Hey Mochi, how does my day look?",
  "Roast my schedule today",
  "Move karate to 7 PM today",
  "Block 2 hours for deep work tomorrow",
  "Find 2 hours free tomorrow for studying",
  "Tell me a joke to wake me up",
];

interface StoredResult {
  changes?: ChatChange[];
  pending?: { kind: string; title?: string; minutes?: number; blocks?: unknown[] } | null;
  state?: string;
}

export default async function ChatPage() {
  const { profile, user } = await requireProfile();

  const [logs, spend] = await Promise.all([
    prisma.agentLog.findMany({
      where: { userId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: {
        id: true,
        message: true,
        reply: true,
        engine: true,
        result: true,
        undone: true,
        createdAt: true,
      },
    }),
    budgetStatus(profile.id, user.timezone, profile.monthlyTokenBudget),
  ]);

  const ordered = logs.reverse();
  const messages: ChatMessage[] = [];

  ordered.forEach((log, index) => {
    const result = (log.result ?? {}) as StoredResult;
    const isLast = index === ordered.length - 1;

    messages.push({
      id: `${log.id}-user`,
      role: "user",
      content: log.message,
    });

    messages.push({
      id: log.id,
      role: "assistant",
      content: log.reply || "No reply recorded.",
      changes: Array.isArray(result.changes) ? result.changes : [],
      pending: isLast ? result.pending ?? null : null,
      engine: log.engine,
      undone: log.undone,
    });
  });

  return (
    <div className="min-w-0">
      <ChatWorkspace
        initialMessages={messages}
        timeZone={user.timezone}
        userName={profile.name ?? profile.email}
        engine={isAIConfigured() ? "deepseek" : "rules"}
        usage={{ used: spend.used, budget: spend.budget }}
        quickPrompts={QUICK_PROMPTS}
      />
    </div>
  );
}
