import { queryAll } from "../../db/client";
import { registerTool, AgentTool } from "./registry";

// get_spending_summary
const getSpendingSummaryTool: AgentTool = {
  name: "get_spending_summary",
  description: "Get total income, total expenses, and net balance for a specified date range.",
  parameters: {
    type: "object",
    properties: {
      startDate: { type: "string", description: "Start date in YYYY-MM-DD format" },
      endDate: { type: "string", description: "End date in YYYY-MM-DD format" },
    },
  },
  permission: "READ",
  execute: async (args, userId) => {
    const startDate = (args.startDate as string) || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
    const endDate = (args.endDate as string) || new Date().toISOString().split("T")[0];

    const rows = await queryAll<{ type: string; total: number; count: number }>(
      `SELECT t.type, COALESCE(SUM(t.amount), 0) as total, COUNT(*) as count
       FROM transactions t
       WHERE t.user_id = ? AND t.date BETWEEN ? AND ?
       GROUP BY t.type`,
      [userId, startDate, endDate]
    );

    let totalIncome = 0;
    let totalExpenses = 0;
    let transactionCount = 0;

    for (const r of rows) {
      if (r.type === "income") totalIncome = Number(r.total);
      if (r.type === "expense") totalExpenses = Number(r.total);
      transactionCount += Number(r.count);
    }

    return {
      period: { startDate, endDate },
      totalIncome,
      totalExpenses,
      netSavings: totalIncome - totalExpenses,
      transactionCount,
      savingsRatePercent: totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 10000) / 100 : 0,
    };
  },
};

// get_category_spending
const getCategorySpendingTool: AgentTool = {
  name: "get_category_spending",
  description: "Get category-wise breakdown of expenses or income for a specified date range.",
  parameters: {
    type: "object",
    properties: {
      startDate: { type: "string", description: "Start date in YYYY-MM-DD format" },
      endDate: { type: "string", description: "End date in YYYY-MM-DD format" },
      type: { type: "string", enum: ["expense", "income"], description: "Transaction type (default: expense)" },
      category: { type: "string", description: "Optional specific category filter" },
    },
  },
  permission: "READ",
  execute: async (args, userId) => {
    const startDate = (args.startDate as string) || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
    const endDate = (args.endDate as string) || new Date().toISOString().split("T")[0];
    const type = (args.type as string) || "expense";
    const category = args.category as string | undefined;

    const sqlParams: any[] = [userId, type, startDate, endDate];
    let categoryCondition = "";
    if (category) {
      categoryCondition = "AND LOWER(t.category) = LOWER(?)";
      sqlParams.push(category);
    }

    const rows = await queryAll<{ category: string; total: number; count: number }>(
      `SELECT t.category, COALESCE(SUM(t.amount), 0) as total, COUNT(*) as count
       FROM transactions t
       WHERE t.user_id = ? AND t.type = ? AND t.date BETWEEN ? AND ? ${categoryCondition}
       GROUP BY t.category
       ORDER BY total DESC`,
      sqlParams
    );

    const total = rows.reduce((sum, r) => sum + Number(r.total), 0);

    return {
      period: { startDate, endDate },
      type,
      totalAmount: total,
      categories: rows.map((r) => ({
        category: r.category,
        amount: Number(r.total),
        count: Number(r.count),
        percentOfTotal: total > 0 ? Math.round((Number(r.total) / total) * 10000) / 100 : 0,
      })),
    };
  },
};

// get_top_merchants
const getTopMerchantsTool: AgentTool = {
  name: "get_top_merchants",
  description: "Get top merchants/payees ranked by total expense amount.",
  parameters: {
    type: "object",
    properties: {
      startDate: { type: "string", description: "Start date in YYYY-MM-DD format" },
      endDate: { type: "string", description: "End date in YYYY-MM-DD format" },
      limit: { type: "number", description: "Max merchants to return (default: 5, max: 20)" },
    },
  },
  permission: "READ",
  execute: async (args, userId) => {
    const startDate = (args.startDate as string) || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
    const endDate = (args.endDate as string) || new Date().toISOString().split("T")[0];
    const limit = Math.min(20, Math.max(1, Number(args.limit) || 5));

    const rows = await queryAll<{ merchant: string; total: number; count: number }>(
      `SELECT COALESCE(NULLIF(t.merchant_name, ''), NULLIF(t.description, ''), 'Unspecified') as merchant,
              COALESCE(SUM(t.amount), 0) as total, COUNT(*) as count
       FROM transactions t
       WHERE t.user_id = ? AND t.type = 'expense' AND t.date BETWEEN ? AND ?
       GROUP BY merchant
       ORDER BY total DESC
       LIMIT ?`,
      [userId, startDate, endDate, limit]
    );

    return {
      period: { startDate, endDate },
      topMerchants: rows.map((r) => ({
        merchant: r.merchant,
        totalAmount: Number(r.total),
        transactionCount: Number(r.count),
      })),
    };
  },
};

// get_monthly_spending
const getMonthlySpendingTool: AgentTool = {
  name: "get_monthly_spending",
  description: "Get month-by-month total spending for a given year.",
  parameters: {
    type: "object",
    properties: {
      year: { type: "number", description: "Year (e.g. 2026)" },
    },
  },
  permission: "READ",
  execute: async (args, userId) => {
    const year = Number(args.year) || new Date().getFullYear();

    const rows = await queryAll<{ month: number; total: number; count: number }>(
      `SELECT MONTH(t.date) as month, COALESCE(SUM(t.amount), 0) as total, COUNT(*) as count
       FROM transactions t
       WHERE t.user_id = ? AND t.type = 'expense' AND YEAR(t.date) = ?
       GROUP BY MONTH(t.date)
       ORDER BY month ASC`,
      [userId, year]
    );

    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    return {
      year,
      monthlyBreakdown: rows.map((r) => ({
        monthNumber: Number(r.month),
        monthName: months[Number(r.month) - 1],
        amount: Number(r.total),
        transactionCount: Number(r.count),
      })),
    };
  },
};

// calculate_change
const calculateChangeTool: AgentTool = {
  name: "calculate_change",
  description: "Calculate deterministic difference, percentage change, and direction between two numbers.",
  parameters: {
    type: "object",
    properties: {
      current: { type: "number", description: "Current period value" },
      previous: { type: "number", description: "Previous period value" },
    },
    required: ["current", "previous"],
  },
  permission: "READ",
  execute: async (args) => {
    const current = Number(args.current) || 0;
    const previous = Number(args.previous) || 0;
    const difference = current - previous;
    const percentageChange = previous !== 0 ? Math.round((difference / Math.abs(previous)) * 10000) / 100 : 0;
    const direction = difference > 0 ? "increase" : difference < 0 ? "decrease" : "unchanged";

    return {
      current,
      previous,
      difference,
      percentageChange,
      direction,
    };
  },
};

// get_current_date
const getCurrentDateTool: AgentTool = {
  name: "get_current_date",
  description: "Get the server's current trusted date and time in ISO and human-readable formats.",
  parameters: {
    type: "object",
    properties: {},
  },
  permission: "READ",
  execute: async () => {
    const now = new Date();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    return {
      isoDate: now.toISOString().split("T")[0],
      isoDateTime: now.toISOString(),
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      monthName: months[now.getMonth()],
      dayOfMonth: now.getDate(),
      dayOfWeek: days[now.getDay()],
    };
  },
};

export const registerAnalyticsTools = (): void => {
  registerTool(getSpendingSummaryTool);
  registerTool(getCategorySpendingTool);
  registerTool(getTopMerchantsTool);
  registerTool(getMonthlySpendingTool);
  registerTool(calculateChangeTool);
  registerTool(getCurrentDateTool);
};
