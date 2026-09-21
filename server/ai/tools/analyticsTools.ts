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

// get_budget_status
const getBudgetStatusTool: AgentTool = {
  name: "get_budget_status",
  description: "Check user budget utilization, monthly targets, daily thresholds, and projected spending.",
  parameters: {
    type: "object",
    properties: {
      month: { type: "string", description: "Target month YYYY-MM (default: current month)" },
    },
  },
  permission: "READ",
  execute: async (args, userId) => {
    const now = new Date();
    const targetMonth = String(args.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    const [yearStr, monthStr] = targetMonth.split("-");
    const year = Number(yearStr) || now.getFullYear();
    const month = Number(monthStr) || now.getMonth() + 1;

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const [user] = await queryAll<{ daily_threshold: number }>(
      "SELECT daily_threshold FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    const [profile] = await queryAll<{ monthly_expense_target: number }>(
      "SELECT monthly_expense_target FROM user_profiles WHERE user_id = ? LIMIT 1",
      [userId]
    );

    const expenseRow = await queryAll<{ total: number; count: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM transactions
       WHERE user_id = ? AND type = 'expense' AND date BETWEEN ? AND ?`,
      [userId, startDate, endDate]
    );

    const currentSpent = Number(expenseRow[0]?.total || 0);
    const transactionCount = Number(expenseRow[0]?.count || 0);

    const monthlyTarget = profile?.monthly_expense_target ? Number(profile.monthly_expense_target) : 0;
    const dailyThreshold = user?.daily_threshold ? Number(user.daily_threshold) : 1000;
    const effectiveBudget = monthlyTarget > 0 ? monthlyTarget : dailyThreshold * lastDay;

    const daysInMonth = lastDay;
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
    const elapsedDays = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth;
    const remainingDays = Math.max(0, daysInMonth - elapsedDays);

    const dailyAverage = Math.round((currentSpent / elapsedDays) * 100) / 100;
    const projectedTotal = Math.round(dailyAverage * daysInMonth * 100) / 100;
    const remainingBudget = Math.max(0, effectiveBudget - currentSpent);
    const percentUsed = effectiveBudget > 0 ? Math.round((currentSpent / effectiveBudget) * 10000) / 100 : 0;
    const isOverBudget = currentSpent > effectiveBudget;

    return {
      month: targetMonth,
      effectiveBudget,
      budgetType: monthlyTarget > 0 ? "monthly_target" : "daily_threshold_derived",
      dailyThreshold,
      currentSpent,
      remainingBudget: isOverBudget ? 0 : remainingBudget,
      overspendAmount: isOverBudget ? currentSpent - effectiveBudget : 0,
      percentUsed,
      isOverBudget,
      elapsedDays,
      remainingDays,
      dailyAverage,
      projectedTotal,
      transactionCount,
    };
  },
};

// compare_spending_periods
const compareSpendingPeriodsTool: AgentTool = {
  name: "compare_spending_periods",
  description: "Compare spending between two months or date ranges, calculating category-wise changes deterministically.",
  parameters: {
    type: "object",
    properties: {
      currentStartDate: { type: "string", description: "Current period start YYYY-MM-DD" },
      currentEndDate: { type: "string", description: "Current period end YYYY-MM-DD" },
      previousStartDate: { type: "string", description: "Previous period start YYYY-MM-DD" },
      previousEndDate: { type: "string", description: "Previous period end YYYY-MM-DD" },
    },
  },
  permission: "READ",
  execute: async (args, userId) => {
    const now = new Date();
    // Default: current month vs previous month
    const curYear = now.getFullYear();
    const curMonth = now.getMonth(); // 0-indexed

    const curStart = args.currentStartDate as string || `${curYear}-${String(curMonth + 1).padStart(2, "0")}-01`;
    const curEnd = args.currentEndDate as string || now.toISOString().split("T")[0];

    const prevMonthDate = new Date(curYear, curMonth - 1, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonthNum = prevMonthDate.getMonth() + 1;
    const prevLastDay = new Date(prevYear, prevMonthNum, 0).getDate();

    const prevStart = args.previousStartDate as string || `${prevYear}-${String(prevMonthNum).padStart(2, "0")}-01`;
    const prevEnd = args.previousEndDate as string || `${prevYear}-${String(prevMonthNum).padStart(2, "0")}-${String(prevLastDay).padStart(2, "0")}`;

    const currentRows = await queryAll<{ category: string; total: number }>(
      `SELECT category, COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE user_id = ? AND type = 'expense' AND date BETWEEN ? AND ?
       GROUP BY category`,
      [userId, curStart, curEnd]
    );

    const previousRows = await queryAll<{ category: string; total: number }>(
      `SELECT category, COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE user_id = ? AND type = 'expense' AND date BETWEEN ? AND ?
       GROUP BY category`,
      [userId, prevStart, prevEnd]
    );

    const currentMap = new Map<string, number>();
    let currentTotal = 0;
    for (const r of currentRows) {
      const amt = Number(r.total);
      currentMap.set(r.category, amt);
      currentTotal += amt;
    }

    const previousMap = new Map<string, number>();
    let previousTotal = 0;
    for (const r of previousRows) {
      const amt = Number(r.total);
      previousMap.set(r.category, amt);
      previousTotal += amt;
    }

    const allCategories = Array.from(new Set([...currentMap.keys(), ...previousMap.keys()]));
    const categoryComparisons = allCategories.map((cat) => {
      const cur = currentMap.get(cat) || 0;
      const prev = previousMap.get(cat) || 0;
      const diff = cur - prev;
      const pct = prev > 0 ? Math.round((diff / prev) * 10000) / 100 : cur > 0 ? 100 : 0;
      return {
        category: cat,
        currentAmount: cur,
        previousAmount: prev,
        difference: diff,
        percentageChange: pct,
        direction: diff > 0 ? "increased" : diff < 0 ? "decreased" : "unchanged",
      };
    }).sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

    const totalDiff = currentTotal - previousTotal;
    const totalPct = previousTotal > 0 ? Math.round((totalDiff / previousTotal) * 10000) / 100 : 0;

    return {
      currentPeriod: { startDate: curStart, endDate: curEnd, total: currentTotal },
      previousPeriod: { startDate: prevStart, endDate: prevEnd, total: previousTotal },
      totalDifference: totalDiff,
      totalPercentageChange: totalPct,
      direction: totalDiff > 0 ? "increased" : totalDiff < 0 ? "decreased" : "unchanged",
      categoryComparisons,
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
  registerTool(getBudgetStatusTool);
  registerTool(compareSpendingPeriodsTool);
};
