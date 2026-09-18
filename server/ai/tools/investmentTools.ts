import { queryAll } from "../../db/client";
import { registerTool, AgentTool } from "./registry";

// get_investments
const getInvestmentsTool: AgentTool = {
  name: "get_investments",
  description: "Retrieve user's mutual fund / SIP investments with current portfolio values and expected CAGR.",
  parameters: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max investments to return (default: 20)" },
    },
  },
  permission: "READ",
  execute: async (args, userId) => {
    const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));

    const rows = await queryAll<{
      id: number;
      sip_name: string;
      fund_name: string;
      monthly_sip_amount: number;
      total_invested_amount: number;
      current_value: number;
      expected_cagr: number;
      start_date: string;
      end_date: string;
    }>(
      `SELECT id, sip_name, fund_name, monthly_sip_amount, total_invested_amount,
              current_value, expected_cagr, start_date, end_date
       FROM mutual_fund_sip_investments
       WHERE user_id = ?
       ORDER BY current_value DESC
       LIMIT ?`,
      [userId, limit]
    );

    return {
      count: rows.length,
      investments: rows.map((r) => ({
        id: r.id,
        sipName: r.sip_name,
        fundName: r.fund_name,
        monthlySipAmount: Number(r.monthly_sip_amount),
        totalInvested: Number(r.total_invested_amount),
        currentValue: Number(r.current_value),
        gainLoss: Number(r.current_value) - Number(r.total_invested_amount),
        gainLossPercent:
          Number(r.total_invested_amount) > 0
            ? Math.round(((Number(r.current_value) - Number(r.total_invested_amount)) / Number(r.total_invested_amount)) * 10000) / 100
            : 0,
        expectedCagr: Number(r.expected_cagr),
      })),
    };
  },
};

// get_investment_summary
const getInvestmentSummaryTool: AgentTool = {
  name: "get_investment_summary",
  description: "Get portfolio-wide aggregated investment metrics: total invested, total current value, unrealized gain/loss, and total monthly SIP commit.",
  parameters: {
    type: "object",
    properties: {},
  },
  permission: "READ",
  execute: async (_args, userId) => {
    const rows = await queryAll<{
      total_sip_amount: number;
      total_invested: number;
      total_current: number;
      fund_count: number;
    }>(
      `SELECT
         COALESCE(SUM(monthly_sip_amount), 0) as total_sip_amount,
         COALESCE(SUM(total_invested_amount), 0) as total_invested,
         COALESCE(SUM(current_value), 0) as total_current,
         COUNT(*) as fund_count
       FROM mutual_fund_sip_investments
       WHERE user_id = ?`,
      [userId]
    );

    const summary = rows[0] || { total_sip_amount: 0, total_invested: 0, total_current: 0, fund_count: 0 };
    const totalInvested = Number(summary.total_invested);
    const totalCurrent = Number(summary.total_current);
    const gainLoss = totalCurrent - totalInvested;
    const gainLossPercent = totalInvested > 0 ? Math.round((gainLoss / totalInvested) * 10000) / 100 : 0;

    return {
      fundCount: Number(summary.fund_count),
      totalMonthlySipCommitment: Number(summary.total_sip_amount),
      totalInvestedAmount: totalInvested,
      totalCurrentValue: totalCurrent,
      overallGainLoss: gainLoss,
      overallGainLossPercent: gainLossPercent,
    };
  },
};

export const registerInvestmentTools = (): void => {
  registerTool(getInvestmentsTool);
  registerTool(getInvestmentSummaryTool);
};
