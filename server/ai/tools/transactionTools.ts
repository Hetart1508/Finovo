import crypto from "crypto";
import { queryAll, queryOne, execute } from "../../db/client";
import { registerTool, AgentTool } from "./registry";

// get_transactions
const getTransactionsTool: AgentTool = {
  name: "get_transactions",
  description: "Retrieve transactions for the authenticated user with optional date range, category, merchant, or type filters.",
  parameters: {
    type: "object",
    properties: {
      startDate: { type: "string", description: "Start date YYYY-MM-DD" },
      endDate: { type: "string", description: "End date YYYY-MM-DD" },
      category: { type: "string", description: "Category filter" },
      merchant: { type: "string", description: "Merchant/Payee filter" },
      type: { type: "string", enum: ["expense", "income"], description: "Type filter" },
      limit: { type: "number", description: "Max results (default: 20, max: 100)" },
    },
  },
  permission: "READ",
  execute: async (args, userId) => {
    const limit = Math.min(100, Math.max(1, Number(args.limit) || 20));
    const conditions: string[] = ["t.user_id = ?"];
    const params: any[] = [userId];

    if (args.startDate) {
      conditions.push("t.date >= ?");
      params.push(args.startDate);
    }
    if (args.endDate) {
      conditions.push("t.date <= ?");
      params.push(args.endDate);
    }
    if (args.type) {
      conditions.push("t.type = ?");
      params.push(args.type);
    }
    if (args.category) {
      conditions.push("LOWER(t.category) = LOWER(?)");
      params.push(args.category);
    }
    if (args.merchant) {
      conditions.push("(LOWER(t.merchant_name) LIKE LOWER(?) OR LOWER(t.description) LIKE LOWER(?))");
      params.push(`%${args.merchant}%`, `%${args.merchant}%`);
    }

    params.push(limit);

    const rows = await queryAll<{
      id: number;
      amount: number;
      type: string;
      category: string;
      date: string;
      payment_mode: string;
      description: string | null;
      merchant_name: string | null;
    }>(
      `SELECT t.id, t.amount, t.type, t.category, t.date, t.payment_mode, t.description, t.merchant_name
       FROM transactions t
       WHERE ${conditions.join(" AND ")}
       ORDER BY t.date DESC, t.id DESC
       LIMIT ?`,
      params
    );

    return {
      count: rows.length,
      transactions: rows.map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        type: r.type,
        category: r.category,
        date: r.date,
        merchant: r.merchant_name || r.description || "Unspecified",
        description: r.description,
        paymentMode: r.payment_mode,
      })),
    };
  },
};

// get_transaction
const getTransactionTool: AgentTool = {
  name: "get_transaction",
  description: "Retrieve a single transaction by ID. Enforces ownership check.",
  parameters: {
    type: "object",
    properties: {
      transactionId: { type: "number", description: "The transaction ID" },
    },
    required: ["transactionId"],
  },
  permission: "READ",
  execute: async (args, userId) => {
    const transactionId = Number(args.transactionId);
    if (!transactionId) {
      return { error: "Invalid transaction ID" };
    }

    const row = await queryOne<{
      id: number;
      amount: number;
      type: string;
      category: string;
      date: string;
      payment_mode: string;
      description: string | null;
      merchant_name: string | null;
    }>(
      `SELECT t.id, t.amount, t.type, t.category, t.date, t.payment_mode, t.description, t.merchant_name
       FROM transactions t
       WHERE t.id = ? AND t.user_id = ?`,
      [transactionId, userId]
    );

    if (!row) {
      return { found: false, message: "Transaction not found or unauthorized" };
    }

    return {
      found: true,
      transaction: {
        id: row.id,
        amount: Number(row.amount),
        type: row.type,
        category: row.category,
        date: row.date,
        merchant: row.merchant_name || row.description || "Unspecified",
        description: row.description,
        paymentMode: row.payment_mode,
      },
    };
  },
};

// search_transactions
const searchTransactionsTool: AgentTool = {
  name: "search_transactions",
  description: "Search transactions by keyword matching description or merchant name.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search keyword" },
      limit: { type: "number", description: "Max results (default: 15, max: 50)" },
    },
    required: ["query"],
  },
  permission: "READ",
  execute: async (args, userId) => {
    const query = String(args.query || "").trim();
    const limit = Math.min(50, Math.max(1, Number(args.limit) || 15));

    if (!query) {
      return { count: 0, transactions: [] };
    }

    const rows = await queryAll<{
      id: number;
      amount: number;
      type: string;
      category: string;
      date: string;
      payment_mode: string;
      description: string | null;
      merchant_name: string | null;
    }>(
      `SELECT t.id, t.amount, t.type, t.category, t.date, t.payment_mode, t.description, t.merchant_name
       FROM transactions t
       WHERE t.user_id = ? AND (
         LOWER(t.description) LIKE LOWER(?) OR
         LOWER(t.merchant_name) LIKE LOWER(?) OR
         LOWER(t.category) LIKE LOWER(?)
       )
       ORDER BY t.date DESC
       LIMIT ?`,
      [userId, `%${query}%`, `%${query}%`, `%${query}%`, limit]
    );

    return {
      query,
      count: rows.length,
      transactions: rows.map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        type: r.type,
        category: r.category,
        date: r.date,
        merchant: r.merchant_name || r.description || "Unspecified",
        description: r.description,
      })),
    };
  },
};

// create_expense (WRITE - requires confirmation via ai_pending_actions)
const createExpenseTool: AgentTool = {
  name: "create_expense",
  description: "Stage an expense creation for user confirmation. Returns a pending action card that the user must confirm.",
  parameters: {
    type: "object",
    properties: {
      amount: { type: "number", description: "Expense amount" },
      category: { type: "string", description: "Category (e.g. Food, Shopping, Transport)" },
      merchant: { type: "string", description: "Merchant or payee name" },
      date: { type: "string", description: "Date in YYYY-MM-DD format (defaults to today)" },
      description: { type: "string", description: "Optional description" },
    },
    required: ["amount", "category"],
  },
  permission: "WRITE",
  execute: async (args, userId, sessionId) => {
    const amount = Number(args.amount);
    if (!amount || amount <= 0) {
      return { error: "Amount must be a positive number." };
    }

    const category = String(args.category || "General").trim();
    const merchant = String(args.merchant || "").trim();
    const date = (args.date as string) || new Date().toISOString().split("T")[0];
    const description = String(args.description || merchant || category).trim();

    const actionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    const payload = {
      amount,
      category,
      merchant,
      date,
      description,
      type: "expense",
      payment_mode: "Cash",
    };

    await execute(
      `INSERT INTO ai_pending_actions (id, user_id, session_id, tool_name, arguments, status, expires_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [actionId, userId, sessionId, "create_expense", JSON.stringify(payload), expiresAt]
    );

    return {
      status: "pending_confirmation",
      actionId,
      toolName: "create_expense",
      summary: `Create expense: ₹${amount.toLocaleString("en-IN")} for ${category}${merchant ? ` at ${merchant}` : ""} on ${date}`,
      details: payload,
      message: `I have prepared to record this expense of ₹${amount.toLocaleString("en-IN")} under ${category}. Please confirm if you want me to proceed.`,
    };
  },
};

// delete_expense (DESTRUCTIVE - ALWAYS requires explicit confirmation)
const deleteExpenseTool: AgentTool = {
  name: "delete_expense",
  description: "Stage an expense deletion for user confirmation. Verifies transaction ownership first.",
  parameters: {
    type: "object",
    properties: {
      transactionId: { type: "number", description: "ID of the transaction to delete" },
    },
    required: ["transactionId"],
  },
  permission: "DESTRUCTIVE",
  execute: async (args, userId, sessionId) => {
    const transactionId = Number(args.transactionId);
    if (!transactionId) {
      return { error: "A valid transactionId is required." };
    }

    const tx = await queryOne<{ id: number; amount: number; category: string; date: string; description: string | null; merchant_name: string | null }>(
      `SELECT id, amount, category, date, description, merchant_name
       FROM transactions
       WHERE id = ? AND user_id = ?`,
      [transactionId, userId]
    );

    if (!tx) {
      return { error: "Transaction not found or you do not have permission to delete it." };
    }

    const actionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const payload = {
      transactionId: tx.id,
      amount: Number(tx.amount),
      category: tx.category,
      date: tx.date,
      merchant: tx.merchant_name || tx.description || "Unspecified",
    };

    await execute(
      `INSERT INTO ai_pending_actions (id, user_id, session_id, tool_name, arguments, status, expires_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [actionId, userId, sessionId, "delete_expense", JSON.stringify(payload), expiresAt]
    );

    return {
      status: "pending_confirmation",
      actionId,
      toolName: "delete_expense",
      summary: `Delete transaction #${tx.id}: ₹${Number(tx.amount).toLocaleString("en-IN")} (${tx.category}) on ${tx.date}`,
      details: payload,
      message: `Found transaction #${tx.id}: ₹${Number(tx.amount).toLocaleString("en-IN")} (${tx.category}, ${tx.date}). Are you sure you want to delete it?`,
    };
  },
};

export const registerTransactionTools = (): void => {
  registerTool(getTransactionsTool);
  registerTool(getTransactionTool);
  registerTool(searchTransactionsTool);
  registerTool(createExpenseTool);
  registerTool(deleteExpenseTool);
};
