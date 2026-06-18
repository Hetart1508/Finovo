import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";

import { createServer as createViteServer } from "vite";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mysql, { PoolOptions, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import multer from "multer";
import fs from "fs";
import nodemailer from "nodemailer";
import crypto from "crypto";
import winston from "winston";

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
      return `${timestamp} ${level}: ${stack || message}${extra}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

const getDbConfig = (): PoolOptions => {
  const baseConfig: PoolOptions = process.env.MYSQL_URL
    ? { uri: process.env.MYSQL_URL }
    : {
        host: process.env.DB_HOST || process.env.MYSQLHOST || "localhost",
        port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
        user: process.env.DB_USER || process.env.MYSQLUSER || "root",
        password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || "",
        database: process.env.DB_NAME || process.env.MYSQLDATABASE || "expense_tracker",
      };

  if (process.env.DB_SSL === "true") {
    baseConfig.ssl = process.env.DB_CA_CERT
      ? { ca: process.env.DB_CA_CERT.replace(/\\n/g, "\n") }
      : { rejectUnauthorized: true };
  }

  return baseConfig;
};

const db = mysql.createPool({
  ...getDbConfig(),
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
  dateStrings: true,
});

const queryAll = async <T extends RowDataPacket = RowDataPacket>(sql: string, params: any[] = []) => {
  const [rows] = await db.execute<T[]>(sql, params);
  return rows;
};

const queryOne = async <T extends RowDataPacket = RowDataPacket>(sql: string, params: any[] = []) => {
  const rows = await queryAll<T>(sql, params);
  return rows[0];
};

const execute = async (sql: string, params: any[] = []) => {
  const [result] = await db.execute<ResultSetHeader>(sql, params);
  return result;
};

const tableColumnExists = async (tableName: string, columnName: string) =>
  Boolean(await queryOne(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
      LIMIT 1
    `,
    [tableName, columnName]
  ));

const ensureColumn = async (tableName: string, columnName: string, definition: string) => {
  if (!(await tableColumnExists(tableName, columnName))) {
    await db.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
};

const ensureIndex = async (tableName: string, indexName: string, columns: string) => {
  const existing = await queryOne(
    `
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND index_name = ?
      LIMIT 1
    `,
    [tableName, indexName]
  );

  if (!existing) {
    await db.query(`CREATE INDEX ${indexName} ON ${tableName}(${columns})`);
  }
};

const runMigrations = async () => {
  logger.info("Running MySQL schema check...");

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      daily_threshold DECIMAL(10,2) DEFAULT 1000.00
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS otps (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      otp VARCHAR(20) NOT NULL,
      expires_at BIGINT NOT NULL,
      created_at BIGINT NOT NULL,
      UNIQUE KEY unique_otp_email (email)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS pending_registrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      otp VARCHAR(20) NOT NULL,
      expires_at BIGINT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      otp VARCHAR(20) NOT NULL,
      expires_at BIGINT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      type ENUM('expense', 'income') NOT NULL,
      category VARCHAR(100) NOT NULL,
      date DATE NOT NULL,
      payment_mode VARCHAR(100) NOT NULL,
      description TEXT,
      bill_url TEXT,
      CONSTRAINT fk_transactions_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS statement_imports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      file_hash CHAR(64) NOT NULL,
      transaction_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_statement_import_user_file (user_id, file_hash),
      CONSTRAINT fk_statement_imports_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS recurring_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      day_of_month INT NOT NULL,
      category VARCHAR(100) NOT NULL,
      type VARCHAR(100) NOT NULL,
      frequency VARCHAR(50) NOT NULL DEFAULT 'monthly',
      interval_count INT NOT NULL DEFAULT 1,
      start_date DATE NULL,
      payment_mode VARCHAR(50) NOT NULL DEFAULT 'manual',
      autopay_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      payment_account VARCHAR(100) NULL,
      CONSTRAINT chk_day_of_month CHECK (day_of_month BETWEEN 1 AND 31),
      CONSTRAINT fk_recurring_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INT PRIMARY KEY
    )
  `);

  await ensureColumn("users", "auth_provider", "VARCHAR(50) NOT NULL DEFAULT 'local'");
  await ensureColumn("users", "password_enabled", "BOOLEAN NOT NULL DEFAULT TRUE");
  await ensureColumn("transactions", "source_statement_hash", "CHAR(64) NULL");
  await ensureColumn("transactions", "import_fingerprint", "CHAR(64) NULL");
  await ensureColumn("recurring_events", "frequency", "VARCHAR(50) NOT NULL DEFAULT 'monthly'");
  await ensureColumn("recurring_events", "interval_count", "INT NOT NULL DEFAULT 1");
  await ensureColumn("recurring_events", "start_date", "DATE NULL");
  await ensureColumn("recurring_events", "payment_mode", "VARCHAR(50) NOT NULL DEFAULT 'manual'");
  await ensureColumn("recurring_events", "autopay_enabled", "BOOLEAN NOT NULL DEFAULT FALSE");
  await ensureColumn("recurring_events", "payment_account", "VARCHAR(100) NULL");
  await ensureIndex("transactions", "idx_transactions_user_date", "user_id, date");
  await ensureIndex("transactions", "idx_transactions_category", "category");
  await ensureIndex("transactions", "idx_transactions_import_fingerprint", "user_id, import_fingerprint");
  await ensureIndex("recurring_events", "idx_recurring_user", "user_id");
  await execute("INSERT IGNORE INTO schema_migrations (version) VALUES (?)", [1]);

  logger.info("MySQL schema is ready.");
};

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  credentials: true,
}));
app.use(express.json({ limit: "25mb" }));
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    logger.info("request", {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "finovo-api",
    environment: process.env.NODE_ENV || "development",
    email: getEmailConfigStatus(),
  });
});

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";
const SESSION_EXPIRES_IN = (process.env.SESSION_EXPIRES_IN || "2h") as SignOptions["expiresIn"];
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || EMAIL_USER;
const BREVO_FROM_NAME = process.env.BREVO_FROM_NAME || 'Finovo AI';
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const GEMINI_FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-2.5-flash')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini';
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Utilities', 'Entertainment', 'Health', 'Other'] as const;

const getEmailConfigStatus = () => {
  const trimmedUser = EMAIL_USER.trim();
  const trimmedPass = EMAIL_PASS.trim();
  const [localPart, domain] = trimmedUser.split("@");

  return {
    configured: Boolean((BREVO_API_KEY && BREVO_FROM_EMAIL) || (trimmedUser && trimmedPass)),
    provider: BREVO_API_KEY ? "brevo" : "gmail-smtp",
    userSet: Boolean(trimmedUser),
    passSet: Boolean(trimmedPass),
    brevoApiKeySet: Boolean(BREVO_API_KEY),
    brevoFromEmailSet: Boolean(BREVO_FROM_EMAIL),
    brevoFromNameSet: Boolean(BREVO_FROM_NAME),
    userPreview: trimmedUser
      ? `${localPart.slice(0, 3)}***@${domain || "unknown-domain"}`
      : null,
    passLength: trimmedPass.length,
    passHasSpaces: EMAIL_PASS !== trimmedPass,
    transport: "smtp.gmail.com:587/starttls with smtp.gmail.com:465/tls fallback",
    sendTimeoutMs: Number(process.env.EMAIL_SEND_TIMEOUT_MS || 30000),
    connectionTimeoutMs: Number(process.env.EMAIL_CONNECTION_TIMEOUT_MS || 30000),
    greetingTimeoutMs: Number(process.env.EMAIL_GREETING_TIMEOUT_MS || 30000),
    socketTimeoutMs: Number(process.env.EMAIL_SOCKET_TIMEOUT_MS || 30000),
  };
};

type GeminiCategory = typeof GEMINI_CATEGORIES[number];
type GeminiStatementTransaction = {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  payment_mode: string;
};
type NormalizedTransaction = {
  amount: number;
  type: "expense" | "income";
  category: string;
  date: string;
  payment_mode: string;
  description: string | null;
  bill_url: string | null;
  source_statement_hash: string | null;
  import_fingerprint: string | null;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const getRequiredEnv = (key: string) => {
  const value = process.env[key];
  if (!isNonEmptyString(value)) {
    throw new Error(`${key} is not configured`);
  }
  return value.trim();
};

const normalizeEmail = (value: unknown) =>
  isNonEmptyString(value) ? value.trim().toLowerCase() : "";

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toPositiveInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const isValidDateString = (value: unknown) =>
  isNonEmptyString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);

const sha256 = (value: string | Buffer) =>
  crypto.createHash("sha256").update(value).digest("hex");

const hashBase64File = (base64Data: string) =>
  sha256(Buffer.from(base64Data, "base64"));

const extractJsonObject = (text: string) => {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
};

const normalizeGeminiCategory = (value: unknown): GeminiCategory => {
  const category = typeof value === "string" ? value.trim() : "";
  return GEMINI_CATEGORIES.includes(category as GeminiCategory) ? category as GeminiCategory : "Other";
};

const normalizeGeminiAmount = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const amount = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(amount) ? amount : null;
};

const normalizeGeminiBillData = (text: string) => {
  const parsed = JSON.parse(extractJsonObject(text));
  const amount = normalizeGeminiAmount(parsed.amount);

  if (!isNonEmptyString(parsed.merchant) || amount === null || amount <= 0 || !isValidDateString(parsed.date)) {
    throw new Error("Gemini returned incomplete bill data");
  }

  return {
    merchant: parsed.merchant.trim(),
    amount,
    date: parsed.date,
    category: normalizeGeminiCategory(parsed.category),
    rawText: isNonEmptyString(parsed.rawText) ? parsed.rawText.trim() : undefined,
  };
};

const normalizeInsightList = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter(isNonEmptyString)
        .map((item) => item.trim())
        .slice(0, 6)
    : [];

const normalizeGeminiInsights = (text: string) => {
  const parsed = JSON.parse(extractJsonObject(text));
  const summary = isNonEmptyString(parsed.summary) ? parsed.summary.trim() : "";

  if (!summary) {
    throw new Error("Gemini returned incomplete financial insights");
  }

  return {
    summary,
    spendingHighlights: normalizeInsightList(parsed.spendingHighlights),
    trendAnalysis: normalizeInsightList(parsed.trendAnalysis),
    futureExpensePrediction: normalizeInsightList(parsed.futureExpensePrediction),
    savingAdvice: normalizeInsightList(parsed.savingAdvice),
    investmentGuidance: normalizeInsightList(parsed.investmentGuidance),
    actionPlan: normalizeInsightList(parsed.actionPlan),
  };
};

const normalizeGeminiStatementTransactions = (text: string) => {
  const parsed = JSON.parse(extractJsonObject(text));
  const transactions = Array.isArray(parsed) ? parsed : parsed.transactions;

  if (!Array.isArray(transactions)) {
    throw new Error("Gemini returned no statement transactions");
  }

  return transactions
    .map((transaction: any): GeminiStatementTransaction | null => {
      const amount = normalizeGeminiAmount(transaction.amount);
      const type = transaction.type === "income" ? "income" : transaction.type === "expense" ? "expense" : null;
      const date = isValidDateString(transaction.date) ? transaction.date : null;
      const description = isNonEmptyString(transaction.description) ? transaction.description.trim() : "";

      if (!date || !type || amount === null || amount <= 0 || !description) {
        return null;
      }

      return {
        date,
        description,
        amount,
        type,
        category: isNonEmptyString(transaction.category)
          ? transaction.category.trim()
          : type === "income"
            ? "Income"
            : "Other",
        payment_mode: isNonEmptyString(transaction.payment_mode)
          ? transaction.payment_mode.trim()
          : "Bank Statement",
      };
    })
    .filter((transaction): transaction is GeminiStatementTransaction => transaction !== null)
    .slice(0, 150);
};

const generateGemini = async (
  parts: any[],
  options: { responseMimeType?: "application/json" | "text/plain"; maxOutputTokens?: number } = {}
) => {
  if (AI_PROVIDER !== "gemini") {
    throw new Error("Gemini provider is disabled");
  }

  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const modelCandidates = Array.from(new Set([GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS]));
  let lastError = "";

  for (const model of modelCandidates) {
    const response = await fetch(
      `${GEMINI_API_BASE_URL}/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: options.maxOutputTokens || 1024,
            ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
          },
        }),
      }
    );

    if (!response.ok) {
      lastError = `Gemini error using ${model}: ${response.status} ${await response.text()}`;
      if (response.status === 400 || response.status === 404) {
        logger.warn("Gemini model unavailable, trying fallback", { model, status: response.status });
        continue;
      }
      throw new Error(lastError);
    }

    const data: any = await response.json();
    const text = data.candidates?.[0]?.content?.parts
      ?.map((part: any) => part.text || "")
      .join("\n")
      .trim();

    if (!text) {
      lastError = `Gemini returned an empty response using ${model}`;
      continue;
    }

    return text;
  }

  throw new Error(lastError || "Gemini returned no usable response");
};

const extractBillDataWithGemini = async (base64Data: string, mimeType: string) => {
  const today = new Date().toISOString().split("T")[0];
  const prompt = `Extract expense transaction data from this Indian receipt or invoice file.
Return ONLY valid JSON with this exact shape:
{"merchant":"string","amount":number,"date":"YYYY-MM-DD","category":"Food|Transport|Shopping|Utilities|Entertainment|Health|Other","rawText":"short OCR text you used"}

Rules:
- Pick the final payable amount only. Ignore GST, CGST, SGST, discounts, invoice numbers, phone numbers, GSTIN, item counts, and dates.
- Convert DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD.
- Use ${today} only if the bill date is unreadable.
- Category must be exactly one of: Food, Transport, Shopping, Utilities, Entertainment, Health, Other.`;

  const result = await generateGemini(
    [
      { text: prompt },
      {
        inline_data: {
          mime_type: mimeType,
          data: base64Data,
        },
      },
    ],
    { responseMimeType: "application/json", maxOutputTokens: 1024 }
  );

  return normalizeGeminiBillData(result);
};

const getFinancialInsightsWithGemini = async (transactions: any[], recurringEvents: any[] = []) => {
  const prompt = `You are an expert Indian personal-finance analyst. Analyze these expense tracker transactions and planned recurring payments to create a practical report for the user.

Return ONLY valid JSON with this exact shape:
{
  "summary":"2-3 sentence overall financial summary",
  "spendingHighlights":["bullet string"],
  "trendAnalysis":["bullet string"],
  "futureExpensePrediction":["bullet string"],
  "savingAdvice":["bullet string"],
  "investmentGuidance":["bullet string"],
  "actionPlan":["bullet string"]
}

Rules:
- Use INR formatting like ₹12,500.
- Use the user's previous transactions to identify category patterns, repeated payments, spikes, and unusual expenses.
- Use planned recurring payments to improve future expense predictions, including subscriptions, EMIs, rent, insurance, and yearly fees.
- Predict likely future expenses for the next 30 days and full year based on category totals, recurring payments, and recent spending pace.
- Give practical saving advice and future planning advice for an Indian user.
- Mention recurring commitments when they materially affect the forecast or action plan.
- Investment guidance must be general education only. Do not recommend a specific stock, fund, crypto, or guaranteed return.
- Prefer clear bullet strings, one idea per bullet.
- Keep every bullet under 24 words.
- Do not use markdown, tables, code fences, or text outside JSON.

Transactions:
${JSON.stringify(transactions.slice(0, 60), null, 2)}

Planned recurring payments for the next 365 days:
${JSON.stringify(recurringEvents.slice(0, 80), null, 2)}`;

  const result = await generateGemini(
    [{ text: prompt }],
    { responseMimeType: "application/json", maxOutputTokens: 1800 }
  );
  return normalizeGeminiInsights(result);
};

const importStatementWithGemini = async (base64Data: string, mimeType: string) => {
  const today = new Date().toISOString().split("T")[0];
  const prompt = `Extract incoming and outgoing money transactions from this Indian bank, credit card, UPI, PhonePe, GPay, Paytm, or wallet statement.
Return ONLY valid JSON with this exact shape:
{"transactions":[{"date":"YYYY-MM-DD","description":"string","amount":number,"type":"income|expense","category":"string","payment_mode":"Bank Statement|UPI|Card|Net Banking|Cash|Wallet"}]}

Rules:
- Extract real money movement rows only.
- CREDIT, CR, deposit, salary, refund, interest, received, inward UPI = type "income".
- DEBIT, DR, withdrawal, purchase, paid, sent, outward UPI, ATM, card spend, charges = type "expense".
- Use absolute positive amount values only. Do not use negative numbers.
- Ignore opening balance, closing balance, available balance, account numbers, totals, summaries, page headers, and duplicate continuation rows.
- Convert DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD.
- If a date is unreadable, omit that row rather than using ${today}.
- Choose a practical category. Use Salary, Refund, Interest, Transfer, Food, Transport, Shopping, Utilities, Entertainment, Health, Fees, ATM, Other.
- Keep descriptions short but traceable to the statement narration.
- Return up to 150 transactions, newest or statement order is fine.`;

  const result = await generateGemini(
    [
      {
        inline_data: {
          mime_type: mimeType,
          data: base64Data,
        },
      },
      { text: prompt },
    ],
    { responseMimeType: "application/json", maxOutputTokens: 8192 }
  );

  return normalizeGeminiStatementTransactions(result);
};

const createAuthResponse = (user: any) => {
  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: SESSION_EXPIRES_IN }
  );
  const decoded = jwt.decode(token) as { exp?: number } | null;

  return {
    token,
    expiresAt: decoded?.exp ? decoded.exp * 1000 : null,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      daily_threshold: user.daily_threshold,
    },
  };
};

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  sub?: string;
};

const verifyGoogleIdToken = async (credential: string): Promise<GoogleTokenInfo> => {
  if (!GOOGLE_CLIENT_ID) {
    throw Object.assign(new Error("Google sign-in is not configured"), { status: 500 });
  }

  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw Object.assign(new Error("Invalid Google sign-in token"), { status: 401 });
  }

  if (payload.aud !== GOOGLE_CLIENT_ID) {
    throw Object.assign(new Error("Google token was issued for another client"), { status: 401 });
  }

  if (!payload.email || payload.email_verified !== "true") {
    throw Object.assign(new Error("Google account email is not verified"), { status: 401 });
  }

  return payload;
};

const normalizeTransactionBody = (body: any) => {
  const { amount, type, category, date, payment_mode, description, bill_url, source_statement_hash, import_fingerprint } = body;
  const parsedAmount = toNumber(amount);

  if (parsedAmount === null || parsedAmount <= 0) {
    return { status: 400, body: { error: "Amount must be a positive number" } };
  }

  if (type !== "expense" && type !== "income") {
    return { status: 400, body: { error: "Type must be expense or income" } };
  }

  if (!isNonEmptyString(category) || !isValidDateString(date) || !isNonEmptyString(payment_mode)) {
    return { status: 400, body: { error: "Category, date, and payment mode are required" } };
  }

  const transaction = {
    amount: parsedAmount,
    type,
    category: category.trim(),
    date,
    payment_mode: payment_mode.trim(),
    description: isNonEmptyString(description) ? description.trim() : null,
    bill_url: isNonEmptyString(bill_url) ? bill_url.trim() : null,
    source_statement_hash: isNonEmptyString(source_statement_hash) ? source_statement_hash.trim() : null,
    import_fingerprint: isNonEmptyString(import_fingerprint) ? import_fingerprint.trim() : null,
  };

  return { transaction };
};

const createTransaction = async (userId: number, body: any) => {
  const normalized = normalizeTransactionBody(body);

  if ("status" in normalized) {
    return normalized;
  }

  return insertTransaction(userId, normalized.transaction);
};

const insertTransaction = async (userId: number, transaction: NormalizedTransaction) => {
  const info = await execute(`
    INSERT INTO transactions (
      user_id,
      amount,
      type,
      category,
      date,
      payment_mode,
      description,
      bill_url,
      source_statement_hash,
      import_fingerprint
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    userId,
    transaction.amount,
    transaction.type,
    transaction.category,
    transaction.date,
    transaction.payment_mode,
    transaction.description,
    transaction.bill_url,
    transaction.source_statement_hash,
    transaction.import_fingerprint,
  ]);

  return {
    status: 201,
    body: {
      id: info.insertId,
      user_id: userId,
      ...transaction,
    },
  };
};

const getStatementTransactionKey = (transaction: NormalizedTransaction) =>
  JSON.stringify([
    transaction.date,
    transaction.type,
    transaction.amount.toFixed(2),
    transaction.category.toLowerCase(),
    transaction.payment_mode.toLowerCase(),
    (transaction.description || "").toLowerCase(),
  ]);

const getStatementImportFingerprint = (
  statementHash: string,
  transaction: NormalizedTransaction,
  index: number
) =>
  sha256(JSON.stringify([
    statementHash,
    index,
    transaction.date,
    transaction.type,
    transaction.amount.toFixed(2),
    transaction.category.toLowerCase(),
    transaction.payment_mode.toLowerCase(),
  ]));

const findDuplicateStatementTransaction = (userId: number, transaction: NormalizedTransaction) =>
  transaction.import_fingerprint
    ? queryOne(
      `
        SELECT id
        FROM transactions
        WHERE user_id = ?
          AND import_fingerprint = ?
        LIMIT 1
      `,
      [userId, transaction.import_fingerprint]
    )
    : queryOne(
      `
      SELECT id
      FROM transactions
      WHERE user_id = ?
        AND amount = ?
        AND type = ?
        AND category = ?
        AND date = ?
        AND payment_mode = ?
        AND description <=> ?
      LIMIT 1
    `,
      [
        userId,
        transaction.amount,
        transaction.type,
        transaction.category,
        transaction.date,
        transaction.payment_mode,
        transaction.description,
      ]
    );

const findStatementImport = (userId: number, fileHash: string) =>
  queryOne(
    "SELECT id, transaction_count FROM statement_imports WHERE user_id = ? AND file_hash = ? LIMIT 1",
    [userId, fileHash]
  );

const recordStatementImport = async (userId: number, fileHash: string, transactionCount: number) => {
  try {
    await execute(
      "INSERT INTO statement_imports (user_id, file_hash, transaction_count) VALUES (?, ?, ?)",
      [userId, fileHash, transactionCount]
    );
  } catch (error: any) {
    if (error?.code !== "ER_DUP_ENTRY") {
      throw error;
    }
  }
};

const skipAllStatementTransactions = (transactions: any[], error: string) =>
  transactions.map((transaction) => ({ transaction, error }));

const saveStatementTransactions = async (
  userId: number,
  transactions: any[],
  options: { fileHash?: string } = {}
) => {
  const savedTransactions: any[] = [];
  const skipped: Array<{ transaction: any; error: string }> = [];
  const seenStatementRows = new Set<string>();

  if (options.fileHash) {
    const existingImport = await findStatementImport(userId, options.fileHash);
    if (existingImport) {
      return {
        savedTransactions,
        skipped: skipAllStatementTransactions(transactions, "This statement file was already imported"),
        duplicateStatement: true,
      };
    }
  }

  for (const [index, transaction] of transactions.entries()) {
    const sourceStatementHash = options.fileHash || null;
    const normalized = normalizeTransactionBody({
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
      date: transaction.date,
      payment_mode: transaction.payment_mode || "Bank Statement",
      description: isNonEmptyString(transaction.description)
        ? `Statement Import: ${transaction.description.trim()}`
        : "Statement Import",
      source_statement_hash: sourceStatementHash,
    });

    if ("status" in normalized) {
      skipped.push({
        transaction,
        error: String((normalized.body as any).error || "Transaction validation failed"),
      });
      continue;
    }

    if (sourceStatementHash) {
      normalized.transaction.import_fingerprint = getStatementImportFingerprint(
        sourceStatementHash,
        normalized.transaction,
        index
      );
    }

    const key = getStatementTransactionKey(normalized.transaction);
    const existing = seenStatementRows.has(key)
      ? { id: null }
      : await findDuplicateStatementTransaction(userId, normalized.transaction);

    if (existing) {
      skipped.push({
        transaction,
        error: "Duplicate statement transaction already exists",
      });
      continue;
    }

    const result = await insertTransaction(userId, normalized.transaction);
    seenStatementRows.add(key);
    savedTransactions.push(result.body);
  }

  const duplicateSkips = skipped.filter((row) => /duplicate|already imported/i.test(row.error)).length;
  if (options.fileHash && (savedTransactions.length > 0 || duplicateSkips > 0)) {
    await recordStatementImport(userId, options.fileHash, savedTransactions.length);
  }

  return { savedTransactions, skipped, duplicateStatement: false };
};

const findTransactionById = (id: number, userId: number) =>
  queryOne("SELECT * FROM transactions WHERE id = ? AND user_id = ?", [id, userId]);

const getTransactionFilters = (query: any, userId: number) => {
  const conditions = ["user_id = ?"];
  const params: any[] = [userId];

  if (isNonEmptyString(query.type)) {
    if (query.type !== "expense" && query.type !== "income") {
      return { error: "Type must be expense or income" };
    }
    conditions.push("type = ?");
    params.push(query.type);
  }

  if (isNonEmptyString(query.category)) {
    conditions.push("category = ?");
    params.push(query.category.trim());
  }

  if (isNonEmptyString(query.payment_mode)) {
    conditions.push("payment_mode = ?");
    params.push(query.payment_mode.trim());
  }

  if (isNonEmptyString(query.from)) {
    if (!isValidDateString(query.from)) {
      return { error: "From date must use YYYY-MM-DD format" };
    }
    conditions.push("date >= ?");
    params.push(query.from);
  }

  if (isNonEmptyString(query.to)) {
    if (!isValidDateString(query.to)) {
      return { error: "To date must use YYYY-MM-DD format" };
    }
    conditions.push("date <= ?");
    params.push(query.to);
  }

  return { where: conditions.join(" AND "), params };
};

const updateTransaction = async (id: number, userId: number, body: any) => {
  const existing: any = await findTransactionById(id, userId);
  if (!existing) {
    return { status: 404, body: { error: "Transaction not found" } };
  }

  const next = {
    amount: body.amount === undefined ? existing.amount : toNumber(body.amount),
    type: body.type === undefined ? existing.type : body.type,
    category: body.category === undefined ? existing.category : body.category,
    date: body.date === undefined ? existing.date : body.date,
    payment_mode: body.payment_mode === undefined ? existing.payment_mode : body.payment_mode,
    description: body.description === undefined ? existing.description : body.description,
    bill_url: body.bill_url === undefined ? existing.bill_url : body.bill_url,
  };

  if (next.amount === null || next.amount <= 0) {
    return { status: 400, body: { error: "Amount must be a positive number" } };
  }

  if (next.type !== "expense" && next.type !== "income") {
    return { status: 400, body: { error: "Type must be expense or income" } };
  }

  if (!isNonEmptyString(next.category) || !isValidDateString(next.date) || !isNonEmptyString(next.payment_mode)) {
    return { status: 400, body: { error: "Category, date, and payment mode are required" } };
  }

  const transaction = {
    amount: next.amount,
    type: next.type,
    category: next.category.trim(),
    date: next.date,
    payment_mode: next.payment_mode.trim(),
    description: isNonEmptyString(next.description) ? next.description.trim() : null,
    bill_url: isNonEmptyString(next.bill_url) ? next.bill_url.trim() : null,
  };

  await execute(`
    UPDATE transactions
    SET amount = ?, type = ?, category = ?, date = ?, payment_mode = ?, description = ?, bill_url = ?
    WHERE id = ? AND user_id = ?
  `, [
    transaction.amount,
    transaction.type,
    transaction.category,
    transaction.date,
    transaction.payment_mode,
    transaction.description,
    transaction.bill_url,
    id,
    userId,
  ]);

  return {
    status: 200,
    body: {
      id,
      user_id: userId,
      ...transaction,
    },
  };
};

const findRecurringEventById = (id: number, userId: number) =>
  queryOne("SELECT * FROM recurring_events WHERE id = ? AND user_id = ?", [id, userId]);

const isValidRecurringFrequency = (frequency: string) => ["monthly", "yearly"].includes(frequency);
const isValidRecurringPaymentMode = (paymentMode: string) => ["manual", "auto"].includes(paymentMode);

const getDateOnly = (date: Date) => {
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  return dateOnly;
};

const toDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDueDateForMonth = (year: number, month: number, dayOfMonth: number) => {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(dayOfMonth, lastDayOfMonth));
};

const getLegacyNextRecurringDueDate = (dayOfMonth: number, today = new Date()) => {
  const year = today.getFullYear();
  const month = today.getMonth();
  const currentDue = getDueDateForMonth(year, month, dayOfMonth);

  if (currentDue >= getDateOnly(today)) {
    return currentDue;
  }

  return getDueDateForMonth(year, month + 1, dayOfMonth);
};

const getNextRecurringDueDate = (event: any, today = new Date()) => {
  const dayOfMonth = Number(event.day_of_month);
  const frequency = isValidRecurringFrequency(String(event.frequency || "")) ? String(event.frequency) : "monthly";
  const intervalCount = Math.max(1, Number(event.interval_count) || 1);
  const monthStep = frequency === "yearly" ? intervalCount * 12 : intervalCount;
  const todayStart = getDateOnly(today);

  if (!event.start_date) {
    return getLegacyNextRecurringDueDate(dayOfMonth, todayStart);
  }

  const parsedStart = new Date(`${event.start_date}T00:00:00`);
  if (Number.isNaN(parsedStart.getTime())) {
    return getLegacyNextRecurringDueDate(dayOfMonth, todayStart);
  }

  const startDate = getDateOnly(parsedStart);
  const anchorMonth = startDate.getMonth();
  const anchorYear = startDate.getFullYear();
  let candidate = getDueDateForMonth(anchorYear, anchorMonth, dayOfMonth);
  if (candidate < startDate) {
    candidate = getDueDateForMonth(anchorYear, anchorMonth + monthStep, dayOfMonth);
  }

  let guard = 0;
  while (candidate < todayStart && guard < 240) {
    candidate = getDueDateForMonth(candidate.getFullYear(), candidate.getMonth() + monthStep, dayOfMonth);
    guard += 1;
  }

  return candidate;
};

const addRecurringDueInfo = (event: any) => {
  const nextDueDate = getNextRecurringDueDate(event);
  const todayStart = getDateOnly(new Date());

  return {
    ...event,
    next_due_date: toDateString(nextDueDate),
    days_until_due: Math.ceil((nextDueDate.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000)),
  };
};

const updateRecurringEvent = async (id: number, userId: number, body: any) => {
  const existing: any = await findRecurringEventById(id, userId);
  if (!existing) {
    return { status: 404, body: { error: "Recurring event not found" } };
  }

  const next = {
    name: body.name === undefined ? existing.name : body.name,
    amount: body.amount === undefined ? existing.amount : toNumber(body.amount),
    day_of_month: body.day_of_month === undefined ? existing.day_of_month : Number(body.day_of_month),
    category: body.category === undefined ? existing.category : body.category,
    type: body.type === undefined ? existing.type : body.type,
    frequency: body.frequency === undefined ? existing.frequency : body.frequency,
    interval_count: body.interval_count === undefined ? existing.interval_count : Number(body.interval_count),
    start_date: body.start_date === undefined ? existing.start_date : body.start_date,
    payment_mode: body.payment_mode === undefined ? existing.payment_mode : body.payment_mode,
    autopay_enabled: body.autopay_enabled === undefined ? existing.autopay_enabled : Boolean(body.autopay_enabled),
    payment_account: body.payment_account === undefined ? existing.payment_account : body.payment_account,
  };

  if (!isNonEmptyString(next.name) || !isNonEmptyString(next.category) || !isNonEmptyString(next.type)) {
    return { status: 400, body: { error: "Name, category, and type are required" } };
  }

  if (next.amount === null || next.amount <= 0) {
    return { status: 400, body: { error: "Amount must be a positive number" } };
  }

  if (!Number.isInteger(next.day_of_month) || next.day_of_month < 1 || next.day_of_month > 31) {
    return { status: 400, body: { error: "Day of month must be between 1 and 31" } };
  }

  if (!isNonEmptyString(next.frequency) || !isValidRecurringFrequency(next.frequency.trim())) {
    return { status: 400, body: { error: "Frequency must be monthly or yearly" } };
  }

  if (!Number.isInteger(next.interval_count) || next.interval_count < 1 || next.interval_count > 120) {
    return { status: 400, body: { error: "Interval must be between 1 and 120" } };
  }

  if (next.start_date !== null && next.start_date !== "" && !isValidDateString(next.start_date)) {
    return { status: 400, body: { error: "Start date must use YYYY-MM-DD format" } };
  }

  const paymentMode = isNonEmptyString(next.payment_mode) ? next.payment_mode.trim() : "manual";
  if (!isValidRecurringPaymentMode(paymentMode)) {
    return { status: 400, body: { error: "Payment mode must be manual or auto" } };
  }

  const event = {
    name: next.name.trim(),
    amount: next.amount,
    day_of_month: next.day_of_month,
    category: next.category.trim(),
    type: next.type.trim(),
    frequency: next.frequency.trim(),
    interval_count: next.interval_count,
    start_date: isNonEmptyString(next.start_date) ? next.start_date.trim() : null,
    payment_mode: paymentMode,
    autopay_enabled: Boolean(next.autopay_enabled || paymentMode === "auto"),
    payment_account: isNonEmptyString(next.payment_account) ? next.payment_account.trim() : null,
  };

  await execute(`
    UPDATE recurring_events
    SET name = ?, amount = ?, day_of_month = ?, category = ?, type = ?, frequency = ?, interval_count = ?, start_date = ?, payment_mode = ?, autopay_enabled = ?, payment_account = ?
    WHERE id = ? AND user_id = ?
  `, [
    event.name,
    event.amount,
    event.day_of_month,
    event.category,
    event.type,
    event.frequency,
    event.interval_count,
    event.start_date,
    event.payment_mode,
    event.autopay_enabled,
    event.payment_account,
    id,
    userId,
  ]);

  return {
    status: 200,
    body: {
      id,
      user_id: userId,
      ...event,
    },
  };
};

const getEmailTimeouts = () => ({
  connectionTimeout: Number(process.env.EMAIL_CONNECTION_TIMEOUT_MS || 30000),
  greetingTimeout: Number(process.env.EMAIL_GREETING_TIMEOUT_MS || 30000),
  socketTimeout: Number(process.env.EMAIL_SOCKET_TIMEOUT_MS || 30000),
});

const emailTransports = [
  {
    name: "gmail-starttls-587",
    options: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
    },
  },
  {
    name: "gmail-tls-465",
    options: {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
    },
  },
];

const getEmailErrorMessage = (error: any) => {
  const message = String(error?.message || "");
  const response = String(error?.response || "");
  const code = String(error?.code || "");
  const combined = `${message} ${response} ${code}`.toLowerCase();

  if (error?.provider === "brevo") {
    if (error?.responseCode === 401 || error?.responseCode === 403) {
      return "Brevo rejected the API key or sender. Check BREVO_API_KEY, BREVO_FROM_EMAIL, and sender verification in Render/Brevo.";
    }

    return "Brevo failed to send OTP. Check BREVO_API_KEY, BREVO_FROM_EMAIL, sender verification, and the provider response.";
  }

  if (combined.includes("invalid login") || combined.includes("username and password not accepted") || error?.responseCode === 535) {
    return "Gmail rejected the email credentials. Use EMAIL_USER with a Google App Password in EMAIL_PASS, then redeploy.";
  }

  if (combined.includes("less secure") || combined.includes("application-specific password")) {
    return "Gmail requires a Google App Password for this account. Normal Gmail passwords do not work with SMTP.";
  }

  if (combined.includes("timed out") || code === "ETIMEDOUT" || code === "ESOCKET") {
    return "Email sending timed out while connecting to Gmail SMTP. Check Render networking/logs and try a 30000ms email timeout.";
  }

  if (combined.includes("daily user sending quota exceeded") || error?.responseCode === 454) {
    return "Gmail rejected the send because the account hit a sending limit or temporary SMTP restriction.";
  }

  return "Failed to send OTP. Check Render logs for the Email error details from Gmail/Nodemailer.";
};

const getEmailErrorDebug = (error: any) => ({
  code: error?.code || null,
  command: error?.command || null,
  responseCode: error?.responseCode || null,
  message: error?.message || null,
  provider: error?.provider || null,
});

const sendEmailWithBrevo = async (mail: { to: string; subject: string; html: string }, timeoutMs: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: BREVO_FROM_NAME,
          email: BREVO_FROM_EMAIL,
        },
        to: [{ email: mail.to }],
        subject: mail.subject,
        htmlContent: mail.html,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      const error: any = new Error(`Brevo API ${response.status}: ${body}`);
      error.provider = "brevo";
      error.responseCode = response.status;
      throw error;
    }
  } catch (error: any) {
    if (error?.name === "AbortError") {
      const timeoutError: any = new Error(`Brevo API timed out after ${timeoutMs}ms`);
      timeoutError.provider = "brevo";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const sendOtpEmail = async (email: string, otp: string, purpose: "registration" | "password-reset" = "registration") => {
  const label = purpose === "registration" ? "Email Verification OTP" : "Password Reset OTP";
  if (!BREVO_API_KEY && (!EMAIL_USER || !EMAIL_PASS)) {
    logger.error("Email is not configured");
    return { status: 500, body: { error: "Email service is not configured" } };
  }

  const mail = {
    from: `"Finovo AI" <${EMAIL_USER}>`,
    to: email,
    subject: `Your Finovo AI ${label}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #6366f1;">Your ${label}</h2>
          <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; font-size: 32px; font-weight: bold; padding: 20px; text-align: center; border-radius: 12px; letter-spacing: 4px;">
            ${otp}
          </div>
          <p style="margin-top: 24px;">This OTP is valid for <strong>5 minutes</strong>.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="color: #6b7280; font-size: 14px;">Finovo AI - Intelligent expense tracking</p>
        </div>
      `,
  };

  const timeoutMs = Number(process.env.EMAIL_SEND_TIMEOUT_MS || 30000);
  let lastError: any = null;

  if (BREVO_API_KEY) {
    try {
      await sendEmailWithBrevo(mail, timeoutMs);
      return { status: 200, body: { message: "OTP sent successfully" } };
    } catch (error: any) {
      logger.error("Brevo email failed", {
        message: error?.message,
        responseCode: error?.responseCode,
      });
      return {
        status: 500,
        body: {
          error: getEmailErrorMessage(error),
          emailDebug: getEmailErrorDebug(error),
        },
      };
    }
  }

  for (const transport of emailTransports) {
    try {
      const transporter = nodemailer.createTransport({
        ...transport.options,
        ...getEmailTimeouts(),
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASS,
        },
      });

      await Promise.race([
        transporter.sendMail(mail),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Email send timed out after ${timeoutMs}ms using ${transport.name}`)), timeoutMs);
        }),
      ]);

      return { status: 200, body: { message: "OTP sent successfully" } };
    } catch (error: any) {
      lastError = error;
      logger.error("Email transport failed", {
        transport: transport.name,
        message: error?.message,
        code: error?.code,
        command: error?.command,
        responseCode: error?.responseCode,
        response: error?.response,
      });
    }
  }

  return {
    status: 500,
    body: {
      error: getEmailErrorMessage(lastError),
      emailDebug: getEmailErrorDebug(lastError),
    },
  };
};

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err?.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Session expired. Please login again." });
    }
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- Auth Routes ---
app.post("/api/auth/register", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password, name } = req.body;

  if (!email || !isNonEmptyString(password) || !isNonEmptyString(name)) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }

  try {
    const existingUser = await queryOne("SELECT id FROM users WHERE email = ?", [email]);
    if (existingUser) {
      return res.status(409).json({ error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    await execute(`
      INSERT INTO pending_registrations (email, password, name, otp, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        password = VALUES(password),
        name = VALUES(name),
        otp = VALUES(otp),
        expires_at = VALUES(expires_at),
        created_at = VALUES(created_at)
    `, [email, hashedPassword, name.trim(), otp, expiresAt, Date.now()]);

    const otpResult = await sendOtpEmail(email, otp, "registration");
    if (otpResult.status !== 200) {
      return res.status(otpResult.status).json(otpResult.body);
    }

    res.status(201).json({
      message: "OTP sent to your email. Verify it to finish registration.",
      email,
    });
  } catch (e: any) {
    if (e?.code !== "ER_DUP_ENTRY") {
      logger.error("Register error", { error: e });
    }
    res.status(400).json({ error: "Email already exists" });
  }
});

app.post("/api/auth/register/verify-otp", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const otp = String(req.body.otp || "").trim();

  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP are required" });
  }

  try {
    const pending: any = await queryOne(`
      SELECT * FROM pending_registrations
      WHERE email = ? AND otp = ? AND expires_at > ?
    `, [email, otp, Date.now()]);

    if (!pending) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    const existingUser = await queryOne("SELECT id FROM users WHERE email = ?", [email]);
    if (existingUser) {
      await execute("DELETE FROM pending_registrations WHERE email = ?", [email]);
      return res.status(409).json({ error: "Email already exists" });
    }

    const info = await execute(
      "INSERT INTO users (email, password, name, auth_provider, password_enabled) VALUES (?, ?, ?, 'local', TRUE)",
      [pending.email, pending.password, pending.name]
    );
    await execute("DELETE FROM pending_registrations WHERE email = ?", [email]);

    res.status(201).json(createAuthResponse({
      id: info.insertId,
      email: pending.email,
      name: pending.name,
      daily_threshold: 1000,
    }));
  } catch (e) {
    logger.error("Register OTP verification error", { error: e });
    res.status(500).json({ error: "Failed to verify registration OTP" });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const email = normalizeEmail(req.body.email);

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const user = await queryOne("SELECT id FROM users WHERE email = ?", [email]);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    await execute(`
      INSERT INTO password_resets (email, otp, expires_at, created_at)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        otp = VALUES(otp),
        expires_at = VALUES(expires_at),
        created_at = VALUES(created_at)
    `, [email, otp, expiresAt, Date.now()]);

    const otpResult = await sendOtpEmail(email, otp, "password-reset");
    res.status(otpResult.status).json(otpResult.body);
  } catch (e) {
    logger.error("Forgot password error", { error: e });
    res.status(500).json({ error: "Failed to send password reset OTP" });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const otp = String(req.body.otp || "").trim();
  const password = String(req.body.password || "");

  if (!email || !otp || !password) {
    return res.status(400).json({ error: "Email, OTP, and new password are required" });
  }

  try {
    const resetRecord: any = await queryOne(`
      SELECT * FROM password_resets
      WHERE email = ? AND otp = ? AND expires_at > ?
    `, [email, otp, Date.now()]);

    if (!resetRecord) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await execute("UPDATE users SET password = ?, password_enabled = TRUE WHERE email = ?", [hashedPassword, email]);
    await execute("DELETE FROM password_resets WHERE email = ?", [email]);

    if (!result.affectedRows) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "Password reset successfully. Please login with your new password." });
  } catch (e) {
    logger.error("Reset password error", { error: e });
    res.status(500).json({ error: "Failed to reset password" });
  }
});

app.post("/api/auth/send-otp", async (req, res) => {
  res.status(410).json({ error: "OTP login is disabled. Please login with email and password." });
});

app.get("/api/auth/debug-otp", async (req, res) => {
  if (IS_PRODUCTION) {
    return res.status(404).json({ error: "Not found" });
  }

  const email = String(req.query.email || "").trim();
  if (!email) {
    return res.status(400).json({ error: "Email query parameter is required" });
  }

  const otpRecord: any = await queryOne(`
    SELECT email, otp, expires_at, created_at
    FROM pending_registrations
    WHERE email = ?
    ORDER BY created_at DESC
    LIMIT 1
  `, [email]);

  if (!otpRecord) {
    return res.status(404).json({ error: "No OTP found for this email" });
  }

  const now = Date.now();
  const isExpired = otpRecord.expires_at <= now;

  res.json({
    email: otpRecord.email,
    otp: otpRecord.otp,
    expires_at: otpRecord.expires_at,
    expires_in_seconds: Math.max(0, Math.ceil((otpRecord.expires_at - now) / 1000)),
    is_expired: isExpired,
    created_at: otpRecord.created_at,
  });
});

app.post("/api/auth/verify-otp", async (req, res) => {
  res.status(410).json({ error: "OTP login is disabled. Please login with email and password." });
});

app.post("/api/auth/google", async (req, res) => {
  const credential = String(req.body.credential || "");

  if (!credential) {
    return res.status(400).json({ error: "Google credential is required" });
  }

  try {
    const googleUser = await verifyGoogleIdToken(credential);
    const email = normalizeEmail(googleUser.email);
    const name = isNonEmptyString(googleUser.name) ? googleUser.name.trim() : email.split("@")[0];

    let user: any = await queryOne("SELECT * FROM users WHERE email = ?", [email]);

    if (!user) {
      const randomPasswordHash = await bcrypt.hash(`google:${googleUser.sub}:${crypto.randomUUID()}`, 10);
      const info = await execute(
        "INSERT INTO users (email, password, name, auth_provider, password_enabled) VALUES (?, ?, ?, 'google', FALSE)",
        [email, randomPasswordHash, name]
      );

      user = {
        id: info.insertId,
        email,
        name,
        daily_threshold: 1000,
      };
    }

    res.json(createAuthResponse(user));
  } catch (error: any) {
    logger.error("Google auth error", { message: error?.message });
    res.status(error?.status || 500).json({ error: error?.message || "Failed to sign in with Google" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user: any = await queryOne("SELECT * FROM users WHERE email = ?", [email]);
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  if (!user.password_enabled) {
    return res.status(409).json({
      error: "This account was created with Google. Continue with Google or reset your password to enable password login.",
    });
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  res.json(createAuthResponse(user));
});

// --- Transaction Routes ---
app.get("/api/transactions", authenticateToken, async (req: any, res) => {
  const filters = getTransactionFilters(req.query, req.user.id);
  if ("error" in filters) {
    return res.status(400).json({ error: filters.error });
  }

  const limit = req.query.limit === undefined ? 100 : toPositiveInteger(req.query.limit);
  const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);

  if (!limit || !Number.isInteger(offset) || offset < 0) {
    return res.status(400).json({ error: "Limit must be positive and offset must be zero or greater" });
  }

  const transactions = await queryAll(`
    SELECT *
    FROM transactions
    WHERE ${filters.where}
    ORDER BY date DESC, id DESC
    LIMIT ${limit} OFFSET ${offset}
  `, filters.params);

  res.json(transactions);
});

app.post("/api/transactions", authenticateToken, async (req: any, res) => {
  const result = await createTransaction(req.user.id, req.body);
  res.status(result.status).json(result.body);
});

app.get("/api/transactions/summary", authenticateToken, async (req: any, res) => {
  const filters = getTransactionFilters(req.query, req.user.id);
  if ("error" in filters) {
    return res.status(400).json({ error: filters.error });
  }

  const summary: any = await queryOne(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense,
      COUNT(*) AS transaction_count
    FROM transactions
    WHERE ${filters.where}
  `, filters.params);

  res.json({
    total_income: summary.total_income,
    total_expense: summary.total_expense,
    balance: summary.total_income - summary.total_expense,
    transaction_count: summary.transaction_count,
  });
});

app.get("/api/transactions/categories", authenticateToken, async (req: any, res) => {
  const filters = getTransactionFilters(req.query, req.user.id);
  if ("error" in filters) {
    return res.status(400).json({ error: filters.error });
  }

  const categories = await queryAll(`
    SELECT category, type, COUNT(*) AS transaction_count, SUM(amount) AS total_amount
    FROM transactions
    WHERE ${filters.where}
    GROUP BY category, type
    ORDER BY total_amount DESC
  `, filters.params);

  res.json(categories);
});

app.get("/api/transactions/:id", authenticateToken, async (req: any, res) => {
  const id = toPositiveInteger(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Valid transaction id is required" });
  }

  const transaction = await findTransactionById(id, req.user.id);

  if (!transaction) {
    return res.status(404).json({ error: "Transaction not found" });
  }

  res.json(transaction);
});

app.patch("/api/transactions/:id", authenticateToken, async (req: any, res) => {
  const id = toPositiveInteger(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Valid transaction id is required" });
  }

  const result = await updateTransaction(id, req.user.id, req.body);
  res.status(result.status).json(result.body);
});

app.put("/api/transactions/:id", authenticateToken, async (req: any, res) => {
  const id = toPositiveInteger(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Valid transaction id is required" });
  }

  const result = await updateTransaction(id, req.user.id, req.body);
  res.status(result.status).json(result.body);
});

app.delete("/api/transactions/:id", authenticateToken, async (req: any, res) => {
  const id = toPositiveInteger(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Valid transaction id is required" });
  }

  const info = await execute("DELETE FROM transactions WHERE id = ? AND user_id = ?", [id, req.user.id]);
  if (info.affectedRows === 0) {
    return res.status(404).json({ error: "Transaction not found" });
  }

  res.json({ message: "Transaction deleted successfully", id });
});

// --- User Settings ---
app.patch("/api/user/threshold", authenticateToken, async (req: any, res) => {
  const threshold = toNumber(req.body.threshold);
  if (threshold === null || threshold < 0) {
    return res.status(400).json({ error: "Threshold must be a non-negative number" });
  }

  await execute("UPDATE users SET daily_threshold = ? WHERE id = ?", [threshold, req.user.id]);
  res.sendStatus(204);
});

app.get("/api/users/:id", authenticateToken, async (req: any, res) => {
  const id = toPositiveInteger(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Valid user id is required" });
  }

  if (id !== req.user.id) {
    return res.status(403).json({ error: "You can only access your own user record" });
  }

  const user = await queryOne(`
    SELECT id, email, name, daily_threshold
    FROM users
    WHERE id = ?
  `, [id]);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(user);
});

app.get("/api/users/:userId/transactions", authenticateToken, async (req: any, res) => {
  const userId = toPositiveInteger(req.params.userId);
  if (!userId) {
    return res.status(400).json({ error: "Valid user id is required" });
  }

  if (userId !== req.user.id) {
    return res.status(403).json({ error: "You can only access your own transactions" });
  }

  const transactions = await queryAll(
    "SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC",
    [userId]
  );

  res.json(transactions);
});

app.post("/api/users/:userId/transactions", authenticateToken, async (req: any, res) => {
  const userId = toPositiveInteger(req.params.userId);
  if (!userId) {
    return res.status(400).json({ error: "Valid user id is required" });
  }

  if (userId !== req.user.id) {
    return res.status(403).json({ error: "You can only create transactions for yourself" });
  }

  const result = await createTransaction(userId, req.body);
  res.status(result.status).json(result.body);
});

// --- Recurring Events ---
app.get("/api/recurring", authenticateToken, async (req: any, res) => {
  const events = await queryAll("SELECT * FROM recurring_events WHERE user_id = ?", [req.user.id]);
  res.json(events);
});

app.get("/api/recurring/upcoming", authenticateToken, async (req: any, res) => {
  const days = req.query.days === undefined ? 365 : toPositiveInteger(req.query.days);
  if (!days || days > 365) {
    return res.status(400).json({ error: "days must be between 1 and 365" });
  }

  const events = await queryAll("SELECT * FROM recurring_events WHERE user_id = ?", [req.user.id]);
  res.json(
    events
      .map(addRecurringDueInfo)
      .filter((event) => event.days_until_due <= days)
      .sort((a, b) => a.days_until_due - b.days_until_due)
  );
});

app.post("/api/recurring", authenticateToken, async (req: any, res) => {
  const {
    name,
    amount,
    day_of_month,
    category,
    type,
    frequency = "monthly",
    interval_count = 1,
    start_date = null,
    payment_mode = "manual",
    autopay_enabled,
    payment_account = null,
  } = req.body;
  const parsedAmount = toNumber(amount);
  const parsedDay = Number(day_of_month);
  const parsedInterval = Number(interval_count);
  const normalizedFrequency = isNonEmptyString(frequency) ? frequency.trim() : "monthly";
  const normalizedPaymentMode = isNonEmptyString(payment_mode) ? payment_mode.trim() : "manual";

  if (!isNonEmptyString(name) || !isNonEmptyString(category) || !isNonEmptyString(type)) {
    return res.status(400).json({ error: "Name, category, and type are required" });
  }

  if (parsedAmount === null || parsedAmount <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }

  if (!Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > 31) {
    return res.status(400).json({ error: "Day of month must be between 1 and 31" });
  }

  if (!isValidRecurringFrequency(normalizedFrequency)) {
    return res.status(400).json({ error: "Frequency must be monthly or yearly" });
  }

  if (!Number.isInteger(parsedInterval) || parsedInterval < 1 || parsedInterval > 120) {
    return res.status(400).json({ error: "Interval must be between 1 and 120" });
  }

  if (start_date !== null && start_date !== "" && !isValidDateString(start_date)) {
    return res.status(400).json({ error: "Start date must use YYYY-MM-DD format" });
  }

  if (!isValidRecurringPaymentMode(normalizedPaymentMode)) {
    return res.status(400).json({ error: "Payment mode must be manual or auto" });
  }

  const normalizedAutopay = Boolean(autopay_enabled || normalizedPaymentMode === "auto");
  const normalizedStartDate = isNonEmptyString(start_date) ? start_date.trim() : null;
  const normalizedPaymentAccount = isNonEmptyString(payment_account) ? payment_account.trim() : null;

  const info = await execute(`
    INSERT INTO recurring_events (user_id, name, amount, day_of_month, category, type, frequency, interval_count, start_date, payment_mode, autopay_enabled, payment_account)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    req.user.id,
    name.trim(),
    parsedAmount,
    parsedDay,
    category.trim(),
    type.trim(),
    normalizedFrequency,
    parsedInterval,
    normalizedStartDate,
    normalizedPaymentMode,
    normalizedAutopay,
    normalizedPaymentAccount,
  ]);

  res.status(201).json({
    id: info.insertId,
    name: name.trim(),
    amount: parsedAmount,
    day_of_month: parsedDay,
    category: category.trim(),
    type: type.trim(),
    frequency: normalizedFrequency,
    interval_count: parsedInterval,
    start_date: normalizedStartDate,
    payment_mode: normalizedPaymentMode,
    autopay_enabled: normalizedAutopay,
    payment_account: normalizedPaymentAccount,
  });
});

app.get("/api/recurring/:id", authenticateToken, async (req: any, res) => {
  const id = toPositiveInteger(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Valid recurring event id is required" });
  }

  const event = await findRecurringEventById(id, req.user.id);
  if (!event) {
    return res.status(404).json({ error: "Recurring event not found" });
  }

  res.json(event);
});

app.patch("/api/recurring/:id", authenticateToken, async (req: any, res) => {
  const id = toPositiveInteger(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Valid recurring event id is required" });
  }

  const result = await updateRecurringEvent(id, req.user.id, req.body);
  res.status(result.status).json(result.body);
});

app.delete("/api/recurring/:id", authenticateToken, async (req: any, res) => {
  const id = toPositiveInteger(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Valid recurring event id is required" });
  }

  const info = await execute("DELETE FROM recurring_events WHERE id = ? AND user_id = ?", [id, req.user.id]);
  if (info.affectedRows === 0) {
    return res.status(404).json({ error: "Recurring event not found" });
  }

  res.json({ message: "Recurring event deleted successfully", id });
});

// --- AI Routes (Gemini primary, client keeps Ollama fallback) ---
app.post("/api/ai/extract-bill", authenticateToken, async (req: any, res) => {
  const { base64Data, mimeType } = req.body || {};

  if (!isNonEmptyString(base64Data) || !isNonEmptyString(mimeType)) {
    return res.status(400).json({ error: "base64Data and mimeType are required" });
  }

  if (mimeType !== "application/pdf" && !mimeType.startsWith("image/")) {
    return res.status(400).json({ error: "Unsupported file type. Please upload a PDF, JPG, JPEG, or PNG invoice." });
  }

  try {
    const data = await extractBillDataWithGemini(base64Data, mimeType);
    res.json({ ...data, provider: "gemini", model: GEMINI_MODEL });
  } catch (error: any) {
    logger.error("Gemini bill extraction error", { error });
    res.status(502).json({
      error: "Gemini bill extraction failed",
      detail: IS_PRODUCTION ? undefined : error.message,
    });
  }
});

app.post("/api/ai/insights", authenticateToken, async (req: any, res) => {
  const transactions = Array.isArray(req.body?.transactions) ? req.body.transactions : null;
  const recurringEvents = Array.isArray(req.body?.recurringEvents) ? req.body.recurringEvents : [];

  if (!transactions) {
    return res.status(400).json({ error: "transactions must be an array" });
  }

  try {
    const insights = await getFinancialInsightsWithGemini(transactions, recurringEvents);
    res.json({ ...insights, provider: "gemini", model: GEMINI_MODEL });
  } catch (error: any) {
    logger.error("Gemini insights error", { error });
    res.status(502).json({
      error: "Gemini insights generation failed",
      detail: IS_PRODUCTION ? undefined : error.message,
    });
  }
});

app.post("/api/ai/import-statement", authenticateToken, async (req: any, res) => {
  const { base64Data, mimeType } = req.body || {};

  if (!isNonEmptyString(base64Data) || !isNonEmptyString(mimeType)) {
    return res.status(400).json({ error: "base64Data and mimeType are required" });
  }

  if (mimeType !== "application/pdf" && !mimeType.startsWith("image/")) {
    return res.status(400).json({ error: "Unsupported file type. Please upload a PDF, JPG, or PNG statement." });
  }

  try {
    const statementHash = hashBase64File(base64Data);
    const alreadyImported = Boolean(await findStatementImport(req.user.id, statementHash));
    if (alreadyImported) {
      return res.json({
        transactions: [],
        statementHash,
        alreadyImported,
        savedCount: 0,
        skippedCount: 0,
        pendingApproval: false,
        provider: "gemini",
        model: GEMINI_MODEL,
        message: "This statement file was already imported.",
      });
    }

    const transactions = await importStatementWithGemini(base64Data, mimeType);
    res.json({
      transactions,
      statementHash,
      alreadyImported,
      savedCount: 0,
      skippedCount: 0,
      pendingApproval: true,
      provider: "gemini",
      model: GEMINI_MODEL,
    });
  } catch (error: any) {
    logger.error("Gemini statement import error", { error });
    const message = error instanceof Error ? error.message : String(error);
    res.status(502).json({
      error: "Gemini statement import failed",
      detail: IS_PRODUCTION ? undefined : message,
      hint: getGeminiImportHint(message),
      model: GEMINI_MODEL,
    });
  }
});

app.post("/api/statement-import/preview", authenticateToken, async (req: any, res) => {
  const { base64Data, mimeType } = req.body || {};

  if (!isNonEmptyString(base64Data) || !isNonEmptyString(mimeType)) {
    return res.status(400).json({ error: "base64Data and mimeType are required" });
  }

  if (mimeType !== "application/pdf" && !mimeType.startsWith("image/")) {
    return res.status(400).json({ error: "Unsupported file type. Please upload a PDF, JPG, or PNG statement." });
  }

  try {
    const statementHash = hashBase64File(base64Data);
    const alreadyImported = Boolean(await findStatementImport(req.user.id, statementHash));
    if (alreadyImported) {
      return res.json({
        transactions: [],
        statementHash,
        alreadyImported,
        provider: "gemini",
        model: GEMINI_MODEL,
        message: "This statement file was already imported.",
      });
    }

    const transactions = await importStatementWithGemini(base64Data, mimeType);
    res.json({
      transactions,
      statementHash,
      alreadyImported,
      provider: "gemini",
      model: GEMINI_MODEL,
    });
  } catch (error: any) {
    logger.error("Gemini statement preview error", { error });
    const message = error instanceof Error ? error.message : String(error);
    res.status(502).json({
      error: "Gemini statement import failed",
      detail: IS_PRODUCTION ? undefined : message,
      hint: getGeminiImportHint(message),
      model: GEMINI_MODEL,
    });
  }
});

app.post("/api/statement-import/approve", authenticateToken, async (req: any, res) => {
  const transactions = Array.isArray(req.body?.transactions) ? req.body.transactions : null;
  const statementHash = isNonEmptyString(req.body?.statementHash) ? req.body.statementHash.trim() : undefined;

  if (!transactions) {
    return res.status(400).json({ error: "transactions must be an array" });
  }

  if (transactions.length === 0) {
    return res.status(400).json({ error: "No transactions to approve" });
  }

  if (transactions.length > 200) {
    return res.status(400).json({ error: "A maximum of 200 transactions can be approved at once" });
  }

  const { savedTransactions, skipped, duplicateStatement } = await saveStatementTransactions(req.user.id, transactions, {
    fileHash: statementHash,
  });

  res.json({
    message: duplicateStatement
      ? "This statement file was already imported. No transactions were added."
      : skipped.length
      ? `Saved ${savedTransactions.length} statement transactions, skipped ${skipped.length} duplicate or invalid rows`
      : `Saved ${savedTransactions.length} statement transactions`,
    savedTransactions,
    savedCount: savedTransactions.length,
    skippedCount: skipped.length,
    skipped,
  });
});

// --- File Upload (for bills) ---
const uploadsDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const extensionForMimeType = (mimeType: string) => {
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return "";
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const originalExt = path.extname(file.originalname || "").toLowerCase().replace(/[^.\w]/g, "");
      const ext = originalExt || extensionForMimeType(file.mimetype || "");
      cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
    },
  }),
});

const getCloudinaryConfig = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
};

const getLocalUploadResponse = (file: Express.Multer.File) => ({
  url: `/uploads/${path.basename(file.filename)}`,
  storage: "local",
});

const uploadBillToCloudinary = async (
  file: Express.Multer.File,
  userId: number,
  config: NonNullable<ReturnType<typeof getCloudinaryConfig>>
) => {
  const { cloudName, apiKey, apiSecret } = config;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = `finovo/bills/user-${userId}`;
  const signaturePayload = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(signaturePayload).digest("hex");
  const fileBuffer = fs.readFileSync(file.path);
  const formData = new FormData();

  formData.append("file", new Blob([fileBuffer], { type: file.mimetype }), file.originalname);
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp);
  formData.append("folder", folder);
  formData.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body: formData,
  });
  const data: any = await response.json().catch(() => ({}));

  if (!response.ok || !isNonEmptyString(data.secure_url)) {
    throw new Error(data.error?.message || "Cloudinary upload failed");
  }

  return {
    url: data.secure_url,
    public_id: data.public_id,
    resource_type: data.resource_type,
    format: data.format,
  };
};

const getGeminiImportHint = (message: string) => {
  if (/API key|permission|403|401/i.test(message)) {
    return "Check GEMINI_API_KEY in .env and restart npm run dev.";
  }

  if (/quota|rate|429/i.test(message)) {
    return "Gemini quota or rate limit was reached. Try again later or check AI Studio quota.";
  }

  if (/model|404|not found/i.test(message)) {
    return `The configured Gemini model (${GEMINI_MODEL}) may not be available for this API key. Try GEMINI_MODEL=gemini-2.5-flash-lite with GEMINI_FALLBACK_MODELS=gemini-2.5-flash, then restart.`;
  }

  if (/JSON|parse|transactions/i.test(message)) {
    return "Gemini could not return clean transaction JSON. Try a clearer, non-password-protected statement.";
  }

  return "Make sure the file is a readable, non-password-protected PDF/JPG/PNG and Gemini billing/quota is available.";
};

app.post("/api/upload", authenticateToken, upload.single('file'), async (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const mimeType = req.file.mimetype || "";
  if (mimeType !== "application/pdf" && !mimeType.startsWith("image/")) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Unsupported file type. Please upload a PDF, JPG, JPEG, or PNG invoice." });
  }

  const cloudinaryConfig = getCloudinaryConfig();
  if (!cloudinaryConfig) {
    logger.warn("Cloudinary is not configured; using local bill upload storage");
    return res.json(getLocalUploadResponse(req.file));
  }

  try {
    const uploaded = await uploadBillToCloudinary(req.file, req.user.id, cloudinaryConfig);
    fs.unlinkSync(req.file.path);
    res.json(uploaded);
  } catch (error: any) {
    logger.error("Cloudinary bill upload error; using local bill upload storage", { error });
    res.json({
      ...getLocalUploadResponse(req.file),
      warning: "Cloudinary upload failed; stored locally instead.",
    });
  }
});

app.post("/api/ai/import-statement-file", authenticateToken, upload.single('file'), async (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded. Use form-data key 'file'." });
  }

  const mimeType = req.file.mimetype || "";
  if (mimeType !== "application/pdf" && !mimeType.startsWith("image/")) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Unsupported file type. Please upload a PDF, JPG, or PNG statement." });
  }

  try {
    const base64Data = fs.readFileSync(req.file.path).toString("base64");
    const statementHash = hashBase64File(base64Data);
    const alreadyImported = Boolean(await findStatementImport(req.user.id, statementHash));
    if (alreadyImported) {
      return res.json({
        transactions: [],
        statementHash,
        alreadyImported,
        savedCount: 0,
        skippedCount: 0,
        pendingApproval: false,
        provider: "gemini",
        model: GEMINI_MODEL,
        fileStored: false,
        message: "This statement file was already imported.",
      });
    }

    const transactions = await importStatementWithGemini(base64Data, mimeType);

    res.json({
      transactions,
      statementHash,
      alreadyImported,
      savedCount: 0,
      skippedCount: 0,
      pendingApproval: true,
      provider: "gemini",
      model: GEMINI_MODEL,
      fileStored: false,
    });
  } catch (error: any) {
    logger.error("Gemini statement file import error", { error });
    const message = error instanceof Error ? error.message : String(error);
    res.status(502).json({
      error: "Gemini statement import failed",
      detail: IS_PRODUCTION ? undefined : message,
      hint: getGeminiImportHint(message),
      model: GEMINI_MODEL,
    });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

app.use('/uploads', express.static('uploads'));

// Vite Integration
async function startServer() {
  await runMigrations();
  logger.info("Email configuration status", getEmailConfigStatus());

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
