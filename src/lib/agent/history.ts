export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export const CHAT_CONTEXT_MESSAGE_LIMIT = 20;

export function recentChatHistory(messages: ChatHistoryMessage[]): ChatHistoryMessage[] {
  return messages.slice(-CHAT_CONTEXT_MESSAGE_LIMIT);
}
