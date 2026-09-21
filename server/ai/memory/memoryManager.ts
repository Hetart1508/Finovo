import { queryAll, execute } from "../../db/client";
import { logger } from "../../config/logger";

export interface UserMemory {
  id: number;
  type: string;
  content: string;
  confidence: number;
}

export const getUserMemories = async (userId: number): Promise<UserMemory[]> => {
  try {
    const rows = await queryAll<{
      id: number;
      type: string;
      content: string;
      confidence: number;
    }>(
      `SELECT id, type, content, confidence
       FROM ai_memories
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      content: r.content,
      confidence: Number(r.confidence),
    }));
  } catch (err: any) {
    logger.warn("Failed to load user memories:", err?.message);
    return [];
  }
};

export const saveUserMemory = async (
  userId: number,
  type: "preference" | "financial_goal" | "conversation_preference" | "assistant_preference",
  content: string,
  confidence: number = 1.0
): Promise<void> => {
  try {
    // Deduplicate against existing memories
    const existing = await queryAll<{ id: number }>(
      `SELECT id FROM ai_memories WHERE user_id = ? AND type = ? AND content = ? LIMIT 1`,
      [userId, type, content]
    );
    if (existing.length > 0) {
      return;
    }

    await execute(
      `INSERT INTO ai_memories (user_id, type, content, confidence)
       VALUES (?, ?, ?, ?)`,
      [userId, type, content, confidence]
    );
  } catch (err: any) {
    logger.warn("Failed to save user memory:", err?.message);
  }
};

export const summarizeConversationHistory = (
  messages: Array<{ role: string; content: string }>
): { recentMessages: Array<{ role: string; content: string }>; summary: string | null } => {
  if (messages.length <= 8) {
    return { recentMessages: messages, summary: null };
  }

  const olderMessages = messages.slice(0, messages.length - 8);
  const recentMessages = messages.slice(messages.length - 8);

  // Compact summary of earlier turns
  const summaryBullets: string[] = [];
  for (let i = 0; i < olderMessages.length; i += 2) {
    const userMsg = olderMessages[i];
    const asstMsg = olderMessages[i + 1];
    if (userMsg && userMsg.role === "user") {
      const questionSnippet = userMsg.content.slice(0, 100).replace(/\n/g, " ");
      const answerSnippet = asstMsg?.content ? asstMsg.content.slice(0, 120).replace(/\n/g, " ") : "";
      summaryBullets.push(`- User asked: "${questionSnippet}" -> AI answered regarding: ${answerSnippet}...`);
    }
  }

  const summary = `Prior Conversation Context Summary (${olderMessages.length} earlier messages):\n${summaryBullets.join("\n")}`;

  return { recentMessages, summary };
};
