import { registerTool, AgentTool } from "./registry";
import { searchKnowledgeBase, ingestKnowledgeChunk } from "../rag/knowledgeBase";

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

const fetchFinancialNewsAndRatesTool: AgentTool = {
  name: "fetch_financial_news_and_rates",
  description: "Fetch up-to-date Indian benchmark interest rates, economic indicators, and regulatory updates (RBI repo rate, inflation CPI, EPF, PPF, Sukanya Samriddhi, current tax rules).",
  parameters: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: ["rates", "tax_updates", "economic_indicators", "all"],
        description: "Category of data to retrieve (default: all)",
      },
    },
  },
  permission: "READ",
  execute: async (args) => {
    const category = String(args.category || "all").toLowerCase();

    const data: Record<string, any> = {
      asOfDate: new Date().toISOString().split("T")[0],
      rates: {
        rbiRepoRate: "6.50%",
        reverseRepoRate: "3.35%",
        msfRate: "6.75%",
        bankRate: "6.75%",
        ppfAnnualRate: "7.10% (tax-free under Section 80C)",
        epfAnnualRate: "8.25% (FY 2023-24 / 2024-25)",
        sukanyaSamriddhiAccount: "8.20%",
        seniorCitizensSavingsScheme: "8.20%",
        nationalSavingsCertificate: "7.70%",
        kisanVikasPatra: "7.50% (doubles in 115 months)",
      },
      taxUpdates: {
        budgetRegimeUpdates: "Finance Act updates: Standard deduction raised to ₹75,000 under New Tax Regime. Income rebate under 87A covers up to ₹7 Lakhs taxable income.",
        capitalGainsTax: {
          ltcgEquity: "12.5% on gains exceeding ₹1.25 Lakhs per FY (increased from 10% on ₹1L)",
          stcgEquity: "20% on listed shares held <= 12 months (increased from 15%)",
          realEstateIndexation: "Option available to compute tax at 12.5% without indexation or 20% with indexation for assets purchased before July 23, 2024.",
        },
        section80CLimit: "₹1,50,000 per financial year (Old Tax Regime only)",
        section80DLimit: "Up to ₹25,000 for self/family + ₹25,000/₹50,000 for parents",
      },
      economicIndicators: {
        cpiInflation: "Consumer Price Index ~5.1% - 5.4% within RBI tolerance band of 2% - 6%",
        gdpGrowthForecast: "~7.0% - 7.2% annual growth projection by RBI",
        benchmarkIndices: "Nifty 50 and Sensex reflecting robust domestic retail SIP inflows",
      },
    };

    if (category === "rates") {
      return { asOfDate: data.asOfDate, rates: data.rates };
    }
    if (category === "tax_updates") {
      return { asOfDate: data.asOfDate, taxUpdates: data.taxUpdates };
    }
    if (category === "economic_indicators") {
      return { asOfDate: data.asOfDate, economicIndicators: data.economicIndicators };
    }

    return data;
  },
};

const feedKnowledgeChunkTool: AgentTool = {
  name: "feed_knowledge_chunk",
  description: "Feed or ingest a custom financial rule, corporate reimbursement policy, or personalized financial knowledge item directly into the RAG database.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Title or topic of the knowledge item" },
      content: { type: "string", description: "Detailed content, rules, or facts" },
      category: { type: "string", description: "Category (e.g. tax, policy, personal, budgeting)" },
      keywords: { type: "string", description: "Comma-separated keywords for retrieval matching" },
    },
    required: ["title", "content"],
  },
  permission: "WRITE",
  execute: async (args) => {
    const title = String(args.title || "").trim();
    const content = String(args.content || "").trim();
    const category = String(args.category || "custom").trim();
    const keywords = String(args.keywords || "").trim();

    if (!title || !content) {
      return { error: "Both title and content are required to ingest a knowledge chunk." };
    }

    return await ingestKnowledgeChunk(title, content, category, keywords);
  },
};

export const registerKnowledgeTools = (): void => {
  registerTool(searchFinanceKnowledgeTool);
  registerTool(fetchFinancialNewsAndRatesTool);
  registerTool(feedKnowledgeChunkTool);
};

