import { registerTool, AgentTool } from "./registry";
import { searchKnowledgeBase } from "../rag/knowledgeBase";

const searchFinanceKnowledgeTool: AgentTool = {
  name: "search_finance_knowledge",
  description: "Search verified knowledge regarding Indian taxation (80C, 80D, Old vs New Regime), personal finance rules (50/30/20, emergency funds, debt management), and Finovo features.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search terms (e.g. '80C tax limits', '50 30 20 budget', 'emergency fund sizing')" },
      limit: { type: "number", description: "Maximum articles to retrieve (default: 3)" },
    },
    required: ["query"],
  },
  permission: "READ",
  execute: async (args) => {
    const query = String(args.query || "").trim();
    if (!query) {
      return { found: 0, results: [] };
    }

    const limit = Math.min(5, Math.max(1, Number(args.limit) || 3));
    const results = await searchKnowledgeBase(query, limit);

    return {
      query,
      found: results.length,
      articles: results.map((r) => ({
        title: r.title,
        category: r.category,
        content: r.content,
      })),
    };
  },
};

export const registerKnowledgeTools = (): void => {
  registerTool(searchFinanceKnowledgeTool);
};
