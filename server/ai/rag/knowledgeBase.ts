import { queryAll, execute } from "../../db/client";
import { logger } from "../../config/logger";

export interface KnowledgeChunk {
  documentSlug: string;
  title: string;
  category: string;
  content: string;
  relevanceScore?: number;
}

const SEED_DOCUMENTS = [
  {
    slug: "finovo-features-guide",
    title: "Finovo Features & Financial Tools Guide",
    category: "product",
    content: `Finovo is a modern personal finance and wealth management platform designed specifically for Indian users.
Key Features:
- Wallets: Separate personal and family expense tracking. Personal wallets track individual daily living expenses, while family wallets permit multi-member shared household accounting.
- Transaction Tracking: Record expenses, incomes, categories (Food, Groceries, Shopping, Travel, Utilities, Health, Entertainment, Education, Investments), payment modes (UPI, Credit Card, Net Banking, Cash), and payee/merchant details.
- Smart Bill & Statement Ingestion: Upload PDF bank statements or receipts to extract transactions with automated deduplication and merchant normalization.
- Recurring Subscriptions & Bills: Track recurring monthly, quarterly, or annual commitments (SIPs, Netflix, Rent, Electricity, Broadband) with upcoming bill countdowns.
- Budgets & Daily Limits: Configure daily expenditure thresholds and monthly targets. When daily expenses surpass thresholds, Finovo alerts the user.
- Mutual Fund SIP Portfolios: Monitor mutual fund folio holdings, SIP installments, asset allocation, and XIRR performance.
- AI Wealth Advisor: An autonomous AI agent capable of querying verified financial records, evaluating budgets, comparing month-over-month spending, and giving educational personal finance advice.`,
    chunks: [
      {
        title: "Finovo Wallets and Transaction Management",
        keywords: "wallet, family, personal, expense, income, categories, upi, payment mode",
        content: "Finovo supports personal and shared family wallets. Users categorize transactions (Food, Shopping, Utilities, Travel) and specify payment modes (UPI, Credit Card, Cash) with real-time daily threshold tracking.",
      },
      {
        title: "Finovo Smart Statement and Bill Ingestion",
        keywords: "statement, pdf, import, bill, receipt, extraction, upload",
        content: "Users can upload PDF bank statements or invoice receipts. Finovo automatically extracts dates, amounts, categories, and merchants with deduplication protection.",
      },
      {
        title: "Finovo Recurring Expenses and SIP Tracking",
        keywords: "recurring, subscription, sip, bill, rent, autopay, mutual funds",
        content: "Finovo tracks recurring bills like Rent, Broadband, and Mutual Fund SIPs, providing alerts for upcoming debits and portfolio growth projections.",
      },
    ],
  },
  {
    slug: "indian-taxation-section-80c",
    title: "Indian Income Tax Deductions: Section 80C and 80D Guide",
    category: "taxation",
    content: `Indian Income Tax Act provisions for individuals under the Old and New Tax Regimes:
- Section 80C Deduction: Allows tax deductions up to ₹1,50,000 per financial year for eligible investments and expenses:
  1. ELSS (Equity Linked Savings Schemes): 3-year lock-in, equity exposure, market-linked returns.
  2. PPF (Public Provident Fund): 15-year tenure, tax-exempt interest (EEE status), guaranteed government returns.
  3. EPF & VPF (Employee Provident Fund / Voluntary Provident Fund).
  4. NPS (National Pension Scheme): Eligible under 80CCD(1) within 80C, plus an additional ₹50,000 deduction under Section 80CCD(1B).
  5. Life Insurance Premiums (Term insurance and traditional policies).
  6. Sukanya Samriddhi Yojana (SSY): For the girl child.
  7. Principal repayment on home loans and Children's tuition fees.
- Section 80D Deduction (Health Insurance):
  - Up to ₹25,000 for self, spouse, and dependent children.
  - Additional ₹25,000 (or ₹50,000 if parents are senior citizens 60+) for parents' health insurance.
  - Preventive health check-up: Up to ₹5,000 within the overall limits.
- Old vs New Tax Regime:
  - New Tax Regime (default): Lower slab tax rates, higher basic rebate (up to ₹7 Lakhs taxable income under Section 87A), standard deduction of ₹75,000, but eliminates most 80C/80D/HRA deductions.
  - Old Tax Regime: Higher slab rates, but permits full deductions under 80C, 80D, HRA, and Home Loan interest (Section 24b up to ₹2 Lakhs).`,
    chunks: [
      {
        title: "Section 80C Investment Options and ₹1.5 Lakh Limit",
        keywords: "80c, tax saving, elss, ppf, epf, nps, deduction, 1.5 lakh, insurance",
        content: "Section 80C permits up to ₹1,50,000 in annual deductions across ELSS mutual funds (3-yr lock-in), PPF, EPF, life insurance premiums, and home loan principal repayments. NPS provides an additional ₹50,000 under Section 80CCD(1B).",
      },
      {
        title: "Section 80D Health Insurance Deductions",
        keywords: "80d, health insurance, mediclaim, parents, medical, senior citizen",
        content: "Section 80D offers health insurance deductions: ₹25,000 for self/family, plus an extra ₹25,000 (or ₹50,000 for senior citizens) for parents' health coverage, including ₹5,000 for preventive health checkups.",
      },
      {
        title: "Old vs New Income Tax Regime Comparison",
        keywords: "old regime, new regime, tax slab, standard deduction, 87a rebate",
        content: "Under the New Tax Regime, rates are lower with a ₹75,000 standard deduction and ₹7 Lakh rebate under 80A, but 80C/80D/HRA are largely disallowed. The Old Regime is beneficial if deductions exceed ₹3.75 - ₹4 Lakhs.",
      },
    ],
  },
  {
    slug: "budgeting-rules-emergency-fund",
    title: "Personal Finance Rules of Thumb and Budgeting Foundations",
    category: "budgeting",
    content: `Foundational rules of thumb for personal wealth building:
1. The 50/30/20 Budgeting Rule:
   - 50% for Needs: Rent, groceries, EMIs, utilities, healthcare, essential transportation.
   - 30% for Wants: Dining out, vacations, entertainment, shopping, hobby subscriptions.
   - 20% for Savings & Investments: Emergency fund building, SIPs, retirement funds, debt prepayments.
2. Emergency Fund Blueprint:
   - Build a liquid safety cushion equal to 3 to 6 months of mandatory living expenses.
   - Keep 50% in a high-yield savings account and 50% in liquid/ultra-short mutual funds or flexible fixed deposits.
   - Never invest your emergency reserve in equities, cryptos, or locked illiquid schemes.
3. Debt Management & High-Interest Traps:
   - Credit card revolving debt typically charges 36% to 48% APR. Always pay full statement balances on time.
   - Target the avalanche method (paying highest interest debt first) or snowball method for debt freedom.
4. Rupee Cost Averaging via Systematic Investment Plans (SIP):
   - Investing a fixed amount monthly averages out purchase NAVs through market volatility.
   - Long-term equity index funds (Nifty 50, Nifty Next 50) historically generate inflation-beating wealth over 7+ year horizons.`,
    chunks: [
      {
        title: "The 50/30/20 Budgeting Framework",
        keywords: "50/30/20, needs, wants, savings, budget rule, allocation",
        content: "The 50/30/20 rule allocates 50% of net income to Needs (rent, groceries, bills), 30% to Wants (dining, hobbies, leisure), and 20% to Savings, investments, and debt elimination.",
      },
      {
        title: "Emergency Fund Sizing and Liquid Reserves",
        keywords: "emergency fund, liquid fund, 3 to 6 months, savings account, safety net",
        content: "An emergency fund should cover 3 to 6 months of unavoidable monthly living expenses, preserved in high-liquidity options (savings bank account or sweep-in FDs) rather than volatile stock investments.",
      },
      {
        title: "SIP and Long-term Wealth Creation",
        keywords: "sip, mutual fund, rupee cost averaging, equity, compounding, nifty 50",
        content: "Systematic Investment Plans (SIPs) use rupee-cost averaging to navigate market volatility, providing long-term compound growth in diversified index or equity mutual funds over 5 to 10+ year time horizons.",
      },
    ],
  },
];

export const initKnowledgeBase = async (): Promise<void> => {
  try {
    const existing = await queryAll<{ count: number }>(
      "SELECT COUNT(*) as count FROM ai_knowledge_documents"
    );
    if (Number(existing[0]?.count || 0) > 0) {
      return;
    }

    logger.info("Seeding AI financial knowledge base documents and chunks...");

    for (const doc of SEED_DOCUMENTS) {
      const res = await execute(
        `INSERT INTO ai_knowledge_documents (slug, title, category, content)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content)`,
        [doc.slug, doc.title, doc.category, doc.content]
      );
      const docId = res.insertId;

      for (let i = 0; i < doc.chunks.length; i++) {
        const chunk = doc.chunks[i];
        await execute(
          `INSERT INTO ai_knowledge_chunks (document_id, chunk_index, title, content, keywords)
           VALUES (?, ?, ?, ?, ?)`,
          [docId, i, chunk.title, chunk.content, chunk.keywords]
        );
      }
    }
    logger.info("AI financial knowledge base successfully seeded.");
  } catch (err: any) {
    logger.warn("Could not seed knowledge base (tables may not exist yet):", err?.message);
  }
};

export const searchKnowledgeBase = async (
  queryText: string,
  limit: number = 3
): Promise<KnowledgeChunk[]> => {
  const cleanQuery = queryText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const terms = cleanQuery.split(/\s+/).filter((t) => t.length > 2);

  if (terms.length === 0) {
    return [];
  }

  try {
    const rows = await queryAll<{
      documentSlug: string;
      title: string;
      category: string;
      content: string;
      keywords: string | null;
    }>(
      `SELECT d.slug as documentSlug, c.title, d.category, c.content, c.keywords
       FROM ai_knowledge_chunks c
       JOIN ai_knowledge_documents d ON d.id = c.document_id`
    );

    // Compute relevance score based on keyword match & content match
    const scored = rows.map((row) => {
      let score = 0;
      const haystack = `${row.title} ${row.category} ${row.content} ${row.keywords || ""}`.toLowerCase();

      for (const term of terms) {
        if (haystack.includes(term)) score += 2;
        if (row.title.toLowerCase().includes(term)) score += 3;
        if ((row.keywords || "").toLowerCase().includes(term)) score += 4;
      }

      return {
        documentSlug: row.documentSlug,
        title: row.title,
        category: row.category,
        content: row.content,
        relevanceScore: score,
      };
    });

    return scored
      .filter((s) => (s.relevanceScore || 0) > 0)
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, limit);
  } catch (err: any) {
    logger.warn("Error searching knowledge base:", err?.message);
    // Fallback: search in-memory seed documents if database has not yet been populated
    const fallbackResults: KnowledgeChunk[] = [];
    for (const doc of SEED_DOCUMENTS) {
      for (const chunk of doc.chunks) {
        const text = `${chunk.title} ${chunk.content} ${chunk.keywords}`.toLowerCase();
        let matchCount = 0;
        for (const term of terms) {
          if (text.includes(term)) matchCount++;
        }
        if (matchCount > 0) {
          fallbackResults.push({
            documentSlug: doc.slug,
            title: chunk.title,
            category: doc.category,
            content: chunk.content,
            relevanceScore: matchCount,
          });
        }
      }
    }
    return fallbackResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)).slice(0, limit);
  }
};

export const ingestKnowledgeChunk = async (
  title: string,
  content: string,
  category: string = "custom",
  keywords: string = ""
): Promise<{ success: boolean; chunkId?: number; message: string }> => {
  try {
    const slug = `user-fed-${Date.now()}`;
    const docRes = await execute(
      `INSERT INTO ai_knowledge_documents (slug, title, category, content)
       VALUES (?, ?, ?, ?)`,
      [slug, title, category, content]
    );

    const chunkRes = await execute(
      `INSERT INTO ai_knowledge_chunks (document_id, chunk_index, title, content, keywords)
       VALUES (?, 0, ?, ?, ?)`,
      [docRes.insertId, title, content, keywords || title.toLowerCase()]
    );

    return {
      success: true,
      chunkId: chunkRes.insertId,
      message: `Successfully ingested knowledge item "${title}" into RAG memory.`,
    };
  } catch (err: any) {
    logger.error("Failed to ingest knowledge chunk:", err);
    return {
      success: false,
      message: `Could not save knowledge chunk: ${err?.message}`,
    };
  }
};

