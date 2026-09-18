import { queryAll } from "../../db/client";
import { registerTool, AgentTool } from "./registry";

// get_recurring_expenses
const getRecurringExpensesTool: AgentTool = {
  name: "get_recurring_expenses",
  description: "Retrieve active recurring subscriptions and scheduled bills for the authenticated user.",
  parameters: {
    type: "object",
    properties: {},
  },
  permission: "READ",
  execute: async (_args, userId) => {
    const rows = await queryAll<{
      id: number;
      name: string;
      amount: number;
      day_of_month: number;
      category: string;
      frequency: string;
      payment_mode: string;
      autopay_enabled: number;
    }>(
      `SELECT id, name, amount, day_of_month, category, frequency, payment_mode, autopay_enabled
       FROM recurring_events
       WHERE user_id = ?
       ORDER BY day_of_month ASC`,
      [userId]
    );

    const totalMonthlyCommitment = rows.reduce((sum, r) => sum + Number(r.amount), 0);

    return {
      count: rows.length,
      totalMonthlyCommitment,
      recurringExpenses: rows.map((r) => ({
        id: r.id,
        name: r.name,
        amount: Number(r.amount),
        dueDay: r.day_of_month,
        category: r.category,
        frequency: r.frequency,
        paymentMode: r.payment_mode,
        autopay: Boolean(r.autopay_enabled),
      })),
    };
  },
};

export const registerRecurringTools = (): void => {
  registerTool(getRecurringExpensesTool);
};
