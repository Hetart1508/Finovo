import { queryAll } from "../../db/client";
import { registerTool, AgentTool } from "./registry";

// get_ai_memory
const getAiMemoryTool: AgentTool = {
  name: "get_ai_memory",
  description: "Retrieve long-term user memories such as financial goals, budgeting preferences, or assistant preferences.",
  parameters: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["preference", "financial_goal", "conversation_preference", "assistant_preference"],
        description: "Filter by memory category",
      },
    },
  },
  permission: "READ",
  execute: async (args, userId) => {
    let sql = `SELECT id, type, content, confidence, created_at FROM ai_memories WHERE user_id = ?`;
    const params: any[] = [userId];

    if (args.type) {
      sql += ` AND type = ?`;
      params.push(args.type);
    }
    sql += ` ORDER BY created_at DESC LIMIT 20`;

    const rows = await queryAll<{
      id: number;
      type: string;
      content: string;
      confidence: number;
      created_at: string;
    }>(sql, params);

    return {
      count: rows.length,
      memories: rows.map((r) => ({
        id: r.id,
        type: r.type,
        content: r.content,
        confidence: Number(r.confidence),
      })),
    };
  },
};

export const registerMemoryTools = (): void => {
  registerTool(getAiMemoryTool);
};
