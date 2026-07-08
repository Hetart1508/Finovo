import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";

import { createServer as createViteServer } from "vite";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fs from "fs";
import nodemailer from "nodemailer";
import crypto from "crypto";
import {
  AI_PROVIDER,
  allowedOrigins,
  BREVO_API_KEY,
  BREVO_FROM_EMAIL,
  BREVO_FROM_NAME,
  EMAIL_PASS,
  EMAIL_USER,
  GEMINI_API_BASE_URL,
  GEMINI_API_KEY,
  GEMINI_FALLBACK_MODELS,
  GEMINI_MODEL,
  GOOGLE_CLIENT_ID,
  IS_PRODUCTION,
  JWT_SECRET,
  SESSION_EXPIRES_IN,
} from "./server/config/env";
import { logger } from "./server/config/logger";
import { execute, queryAll, queryOne } from "./server/db/client";
import { runMigrations } from "./server/db/migrations";
import { authenticateToken } from "./server/middleware/auth";
import { requestLogger } from "./server/middleware/requestLogger";
import { getLocalUploadResponse, upload, validateUploadedFileSignature } from "./server/middleware/upload";

const app = express();
if (IS_PRODUCTION) {
  app.set("trust proxy", 1);
}

const isLocalDevelopmentOrigin = (origin: string) => {
  if (IS_PRODUCTION) return false;
  try {
    const parsed = new URL(origin);
    return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  } catch {
    return false;
  }
};

app.use(compression());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      imgSrc: ["'self'", "data:", "blob:"],
      frameSrc: ["'self'", "https://accounts.google.com"],
      scriptSrc: IS_PRODUCTION
        ? ["'self'", "https://accounts.google.com"]
        : ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: IS_PRODUCTION
        ? ["'self'", "https://accounts.google.com", "https://oauth2.googleapis.com", "https://generativelanguage.googleapis.com", "https://api.brevo.com"]
        : ["'self'", "ws:", "http:", "https:"],
    },
  },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginResourcePolicy: { policy: "same-origin" },
  frameguard: { action: "deny" },
  hsts: IS_PRODUCTION ? { maxAge: 15552000, includeSubDomains: true } : false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (!allowedOrigins.length && !IS_PRODUCTION) return callback(null, true);
    if (isLocalDevelopmentOrigin(origin)) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(requestLogger);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "finovo-api",
    environment: process.env.NODE_ENV || "development",
    email: getEmailConfigStatus(),
  });
});

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
  vpa: string | null;
  record_kind: "transaction";
};
type ExtractedTransaction = {
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  payment_mode: string;
  description: string | null;
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
  payee_vpa: string | null;
  merchant_name: string | null;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeEmail = (value: unknown) =>
  isNonEmptyString(value) ? value.trim().toLowerCase() : "";

const AUTH_COOKIE_NAME = "finovo_session";
const AUTH_COOKIE_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const GENERIC_AUTH_ERROR = "Invalid email or password";
const GENERIC_RESET_MESSAGE = "If this email exists, password reset instructions have been sent.";
const PASSWORD_POLICY_ERROR = "Password must be at least 10 characters and include uppercase, lowercase, number, and special character.";
const MAX_OTP_ATTEMPTS = 5;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

const getAuthCookieOptions = () => ({
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION ? "none" as const : "lax" as const,
  path: "/",
});

type RateLimitRule = {
  windowMs: number;
  max: number;
  message: string;
};

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_BUCKET_CLEANUP_SIZE = 10000;

const getRequestIp = (req: Request) =>
  String(req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress || "unknown")
    .split(",")[0]
    .trim();

const cleanupRateLimitBuckets = (now: number) => {
  if (rateLimitBuckets.size < RATE_LIMIT_BUCKET_CLEANUP_SIZE) return;
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }
};

const getRateLimitKeys = (name: string, req: Request, includeEmail: boolean) => {
  const ip = getRequestIp(req) || "unknown";
  const email = normalizeEmail((req.body as any)?.email);
  const keys = [`${name}:ip:${ip}`];
  if (includeEmail) {
    keys.push(`${name}:email:${email || "no-email"}`);
  }
  return { keys, ip, email };
};

const createRateLimiter = (
  name: string,
  rule: RateLimitRule,
  options: { includeEmail?: boolean } = {}
) => (req: Request, res: Response, next: NextFunction) => {
  const now = Date.now();
  cleanupRateLimitBuckets(now);

  const includeEmail = options.includeEmail ?? true;
  const { keys, ip, email } = getRateLimitKeys(name, req, includeEmail);
  const buckets = keys.map((key) => ({
    key,
    bucket: rateLimitBuckets.get(key),
  }));
  const limitedBucket = buckets.find(({ bucket }) => bucket && bucket.resetAt > now && bucket.count >= rule.max)?.bucket;

  if (limitedBucket) {
    const retryAfterSeconds = Math.ceil((limitedBucket.resetAt - now) / 1000);
    logger.warn("Rate limit exceeded", { limiter: name, ip, email: email || null, path: req.path });
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.setHeader("RateLimit-Limit", String(rule.max));
    res.setHeader("RateLimit-Remaining", "0");
    res.setHeader("RateLimit-Reset", String(retryAfterSeconds));
    return res.status(429).json({ error: rule.message });
  }

  let remaining = rule.max - 1;
  let resetAt = now + rule.windowMs;
  for (const { key, bucket } of buckets) {
    const nextBucket = !bucket || bucket.resetAt <= now
      ? { count: 1, resetAt: now + rule.windowMs }
      : { count: bucket.count + 1, resetAt: bucket.resetAt };
    rateLimitBuckets.set(key, nextBucket);
    remaining = Math.min(remaining, Math.max(0, rule.max - nextBucket.count));
    resetAt = Math.min(resetAt, nextBucket.resetAt);
  }

  res.setHeader("RateLimit-Limit", String(rule.max));
  res.setHeader("RateLimit-Remaining", String(remaining));
  res.setHeader("RateLimit-Reset", String(Math.ceil((resetAt - now) / 1000)));
  return next();
};

const apiRateLimiter = createRateLimiter(
  "api",
  { windowMs: 15 * 60 * 1000, max: 500, message: "Too many requests. Please try again later." },
  { includeEmail: false }
);

const authRateLimiters = {
  login: createRateLimiter("login", { windowMs: 15 * 60 * 1000, max: 5, message: "Too many login attempts. Please try again later." }),
  register: createRateLimiter("register", { windowMs: 30 * 60 * 1000, max: 5, message: "Too many registration attempts. Please try again later." }),
  otpVerify: createRateLimiter("otp-verify", { windowMs: 10 * 60 * 1000, max: 5, message: "Too many OTP attempts. Please try again later." }),
  forgotPassword: createRateLimiter("forgot-password", { windowMs: 15 * 60 * 1000, max: 3, message: "Too many password reset requests. Please try again later." }),
  resetPassword: createRateLimiter("reset-password", { windowMs: 10 * 60 * 1000, max: 5, message: "Too many password reset attempts. Please try again later." }),
  google: createRateLimiter("google", { windowMs: 15 * 60 * 1000, max: 10, message: "Too many Google sign-in attempts. Please try again later." }),
};

app.use("/api", apiRateLimiter);

const validatePasswordPolicy = (password: string) =>
  password.length >= 10 &&
  /[a-z]/.test(password) &&
  /[A-Z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password);

const hashOtp = (otp: string) => bcrypt.hash(otp, 10);

const verifyOtpHash = async (otp: string, hash: string | null | undefined) => {
  if (!hash) return false;
  if (hash.length < 40) return otp === hash;
  return bcrypt.compare(otp, hash);
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toPositiveInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getWalletMembership = (walletId: number, userId: number) =>
  queryOne(`
    SELECT
      wallets.id,
      wallets.name,
      wallets.type,
      wallets.owner_user_id,
      wallets.monthly_expense_target,
      wallet_members.role
    FROM wallets
    JOIN wallet_members ON wallet_members.wallet_id = wallets.id
    WHERE wallets.id = ? AND wallet_members.user_id = ?
    LIMIT 1
  `, [walletId, userId]);

const ensurePersonalWallet = async (userId: number) => {
  let wallet: any = await queryOne(
    "SELECT id FROM wallets WHERE owner_user_id = ? AND type = 'personal' ORDER BY id ASC LIMIT 1",
    [userId]
  );

  if (!wallet) {
    const user: any = await queryOne("SELECT name FROM users WHERE id = ?", [userId]);
    const profile: any = await queryOne("SELECT monthly_expense_target FROM user_profiles WHERE user_id = ?", [userId]);
    const info = await execute(
      "INSERT INTO wallets (name, type, owner_user_id, monthly_expense_target) VALUES (?, 'personal', ?, ?)",
      [`${user?.name || "User"}'s Personal Wallet`, userId, profile?.monthly_expense_target ?? null]
    );
    wallet = { id: info.insertId };
  }

  await execute(
    "INSERT IGNORE INTO wallet_members (wallet_id, user_id, role) VALUES (?, ?, 'owner')",
    [wallet.id, userId]
  );
  return Number(wallet.id);
};

const resolveWalletIdForUser = async (userId: number, requestedWalletId?: unknown) => {
  const walletId = requestedWalletId === undefined || requestedWalletId === null || requestedWalletId === ""
    ? await ensurePersonalWallet(userId)
    : toPositiveInteger(requestedWalletId);

  if (!walletId) {
    return { status: 400, body: { error: "A valid wallet id is required" } };
  }

  const membership = await getWalletMembership(walletId, userId);
  if (!membership) {
    return { status: 403, body: { error: "You do not have access to this wallet" } };
  }

  return { walletId, membership };
};

const isValidDateString = (value: unknown) =>
  isNonEmptyString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);

type InvestmentInput = {
  investment_type: "sip" | "lumpsum";
  sip_name: string;
  fund_name: string;
  monthly_sip_amount: number;
  total_invested_amount: number;
  current_value: number;
  expected_cagr: number;
  start_date: string;
  end_date: string;
  notes: string | null;
};

const isValidCalendarDate = (value: unknown): value is string => {
  if (!isValidDateString(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const validateInvestmentInput = (body: any): { data: InvestmentInput } | { error: string } => {
  const investmentType = body?.investment_type === undefined || body?.investment_type === null || body?.investment_type === ""
    ? "sip"
    : String(body.investment_type).toLowerCase();
  const sipName = isNonEmptyString(body?.sip_name) ? body.sip_name.trim() : "";
  const fundName = isNonEmptyString(body?.fund_name) ? body.fund_name.trim() : "";
  const monthlySipAmount = toNumber(body?.monthly_sip_amount);
  const totalInvestedAmountInput = toNumber(body?.total_invested_amount);
  const currentValueInput = toNumber(body?.current_value);
  const expectedCagr = toNumber(body?.expected_cagr);
  const startDate = body?.start_date;
  const endDate = body?.end_date;

  if (investmentType !== "sip" && investmentType !== "lumpsum") {
    return { error: "Investment type must be SIP or Lumpsum" };
  }
  if (!sipName || !fundName) {
    return { error: "Investment name and fund name are required" };
  }
  if (sipName.length > 255 || fundName.length > 255) {
    return { error: "Investment name and fund name must be 255 characters or fewer" };
  }
  if (monthlySipAmount === null || monthlySipAmount <= 0) {
    return { error: investmentType === "lumpsum" ? "Lumpsum amount must be a positive number" : "Monthly SIP amount must be a positive number" };
  }
  if (currentValueInput !== null && currentValueInput < 0) {
    return { error: "Current value must be a non-negative number" };
  }
  if (expectedCagr === null || expectedCagr < 0 || expectedCagr > 999.9999) {
    return { error: "Expected CAGR must be between 0 and 999.9999" };
  }
  if (!isValidCalendarDate(startDate) || !isValidCalendarDate(endDate)) {
    return { error: "Start date and end date are required in YYYY-MM-DD format" };
  }
  if (endDate < startDate) {
    return { error: "End date must be on or after start date" };
  }
  const totalInvestedAmount = totalInvestedAmountInput === null
    ? investmentType === "lumpsum"
      ? monthlySipAmount
      : monthlySipAmount * getInvestmentMonths(startDate, endDate)
    : totalInvestedAmountInput;
  if (totalInvestedAmount < 0) {
    return { error: "Total invested amount must be a non-negative number" };
  }
  const currentValue = currentValueInput === null
    ? getInvestmentCurrentValue({
      investment_type: investmentType,
      monthly_sip_amount: monthlySipAmount,
      total_invested_amount: totalInvestedAmount,
      expected_cagr: expectedCagr,
      start_date: startDate,
    })
    : currentValueInput;
  if (body?.notes !== undefined && body.notes !== null && typeof body.notes !== "string") {
    return { error: "Notes must be text" };
  }

  return {
    data: {
      investment_type: investmentType,
      sip_name: sipName,
      fund_name: fundName,
      monthly_sip_amount: monthlySipAmount,
      total_invested_amount: totalInvestedAmount,
      current_value: currentValue,
      expected_cagr: expectedCagr,
      start_date: startDate,
      end_date: endDate,
      notes: isNonEmptyString(body?.notes) ? body.notes.trim() : null,
    },
  };
};

const getInvestmentMonths = (startDate: string, endDate: string) => {
  const [startYear, startMonth] = startDate.split("-").map(Number);
  const [endYear, endMonth] = endDate.split("-").map(Number);
  return Math.max(0, (endYear - startYear) * 12 + endMonth - startMonth);
};

const getDateFromString = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const getInvestmentElapsedYears = (startDate: string, endDate: string) => {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const elapsedDays = (getDateFromString(endDate).getTime() - getDateFromString(startDate).getTime()) / millisecondsPerDay;
  return Math.max(0, elapsedDays / 365);
};

const getInvestmentCurrentValue = (investment: Pick<InvestmentInput, "investment_type" | "monthly_sip_amount" | "total_invested_amount" | "expected_cagr" | "start_date">) => {
  const today = getTodayDateString();
  if (investment.start_date > today) return 0;

  const rate = investment.expected_cagr / 100;

  if (investment.investment_type === "lumpsum") {
    const elapsedYears = getInvestmentElapsedYears(investment.start_date, today);
    const currentValue = rate === 0
      ? investment.total_invested_amount
      : investment.total_invested_amount * Math.pow(1 + rate, elapsedYears);

    return Number(currentValue.toFixed(2));
  }

  const months = getInvestmentMonths(investment.start_date, today);
  const monthlyRate = investment.expected_cagr / 12 / 100;
  const currentValue = monthlyRate === 0
    ? investment.monthly_sip_amount * months
    : investment.monthly_sip_amount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);

  return Number(currentValue.toFixed(2));
};

const getInvestmentProjection = (investment: any) => {
  const investmentType = investment.investment_type === "lumpsum" ? "lumpsum" : "sip";
  const monthlySipAmount = Number(investment.monthly_sip_amount);
  const totalInvestedAmount = Number(investment.total_invested_amount);
  const monthlyRate = Number(investment.expected_cagr) / 12 / 100;
  const annualRate = Number(investment.expected_cagr) / 100;
  const months = getInvestmentMonths(investment.start_date, investment.end_date);
  const futureValue = investmentType === "lumpsum"
    ? annualRate === 0
      ? totalInvestedAmount
      : totalInvestedAmount * Math.pow(1 + annualRate, months / 12)
    : monthlyRate === 0
      ? monthlySipAmount * months
      : monthlySipAmount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);

  return {
    months,
    future_value: Number(futureValue.toFixed(2)),
    estimated_capital_gain: Number((futureValue - totalInvestedAmount).toFixed(2)),
  };
};

const withInvestmentProjection = (investment: any) => ({
  ...investment,
  ...getInvestmentProjection(investment),
});

const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isFutureDateString = (value: string) => value > getTodayDateString();

const MONTH_NAME_TO_NUMBER: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

const toValidIsoDate = (year: string, month: string, day: string) => {
  const normalized = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() + 1 !== Number(month) ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return normalized;
};

const normalizeBillDate = (value: unknown) => {
  if (!isNonEmptyString(value)) return null;
  const trimmed = value.trim();

  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return toValidIsoDate(year, month, day);
  }

  const indianMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (indianMatch) {
    const [, day, month, rawYear] = indianMatch;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return toValidIsoDate(year, month, day);
  }

  const namedMonthMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{2,4})$/);
  if (namedMonthMatch) {
    const [, day, rawMonth, rawYear] = namedMonthMatch;
    const month = MONTH_NAME_TO_NUMBER[rawMonth.toLowerCase()];
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return month ? toValidIsoDate(year, month, day) : null;
  }

  return null;
};

const getBillDateFromText = (text: string) => {
  const normalizedText = text.replace(/\r/g, "\n").replace(/[^\S\n]+/g, " ");
  const dateLine = normalizedText
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /\bdate\b/i.test(line));
  const candidates = dateLine ? [dateLine, normalizedText] : [normalizedText];

  for (const candidate of candidates) {
    const match =
      candidate.match(/(\d{1,2}\s+(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\.?,?\s+\d{2,4})/i) ||
      candidate.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/) ||
      candidate.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
    const date = normalizeBillDate(match?.[1]);
    if (date) return date;
  }

  return null;
};

const VPA_PATTERN = /\b[a-z0-9][a-z0-9._-]{0,255}@[a-z][a-z0-9.-]{1,63}\b/i;
const VPA_VALUE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,255}@[a-z][a-z0-9.-]{1,63}$/i;
const normalizeVpa = (value: unknown) => {
  if (!isNonEmptyString(value)) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length <= 320 && VPA_VALUE_PATTERN.test(normalized) ? normalized : null;
};
const extractVpa = (...values: unknown[]) => {
  for (const value of values) {
    if (!isNonEmptyString(value)) continue;
    const match = value.toLowerCase().match(VPA_PATTERN);
    if (match) return normalizeVpa(match[0]);
  }
  return null;
};
const normalizeCompanyName = (value: unknown) =>
  isNonEmptyString(value) && value.trim().length <= 255 ? value.trim() : null;

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
  const cleaned = value.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
};

const isStatementBalanceRow = (transaction: any) => {
  const recordKind = isNonEmptyString(transaction?.record_kind)
    ? transaction.record_kind.trim().toLowerCase()
    : "";
  if (["balance", "summary", "header", "total", "non_transaction"].includes(recordKind)) return true;
  if (transaction?.is_balance === true || transaction?.isBalance === true) return true;

  const text = [
    transaction?.description,
    transaction?.narration,
    transaction?.particulars,
    transaction?.details,
  ]
    .filter(isNonEmptyString)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return /\b(?:opening|closing|available|ledger|running|initial|beginning|previous)\s+(?:account\s+)?bal(?:ance)?\b/i.test(text)
    || /\b(?:opening|closing)\s+(?:account|ledger)\s+bal(?:ance)?\b/i.test(text)
    || /\bbal(?:ance)?\s+(?:as\s+(?:on|of)|at\s+(?:the\s+)?(?:start|end)|forward)\b/i.test(text)
    || /\b(?:op|cl)\.?\s*bal(?:ance)?\b/i.test(text)
    || /\bbal(?:ance)?\s*(?:b\/?f|c\/?f|brought forward|carried forward)\b/i.test(text)
    || /\b(?:b\/?f|c\/?f|brought forward|carried forward)\s*bal(?:ance)?\b/i.test(text)
    || /^bal(?:ance)?$/i.test(text);
};

const normalizeGeminiBillData = (text: string) => {
  const parsed = JSON.parse(extractJsonObject(text));
  const amount = normalizeGeminiAmount(parsed.amount);
  const date = normalizeBillDate(parsed.date);

  if (!isNonEmptyString(parsed.merchant) || amount === null || amount <= 0 || !date) {
    throw new Error("Gemini returned incomplete bill data");
  }

  const visibleBillDate = isNonEmptyString(parsed.rawText) ? getBillDateFromText(parsed.rawText) : null;
  if (isFutureDateString(date) || (visibleBillDate && isFutureDateString(visibleBillDate))) {
    throw new Error("Bill date cannot be in the future");
  }

  return {
    merchant: parsed.merchant.trim(),
    amount,
    date,
    category: normalizeGeminiCategory(parsed.category),
    rawText: isNonEmptyString(parsed.rawText) ? parsed.rawText.trim() : undefined,
  };
};

const getClosestAllowedValue = <T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] => {
  if (!isNonEmptyString(value)) return fallback;
  const normalized = value.trim().toLowerCase();
  return allowed.find((item) => item.toLowerCase() === normalized) || fallback;
};

const normalizeGeminiTextTransaction = (text: string): ExtractedTransaction => {
  const parsed = JSON.parse(extractJsonObject(text));
  const amount = normalizeGeminiAmount(parsed?.amount);
  const type = parsed?.type === "income" ? "income" : parsed?.type === "expense" ? "expense" : null;
  const date = isValidDateString(parsed?.date) ? parsed.date : getTodayDateString();

  const normalized = normalizeTransactionBody({
    amount,
    type,
    category: getClosestAllowedValue(parsed?.category, GEMINI_CATEGORIES, "Other"),
    date,
    payment_mode: getClosestAllowedValue(
      parsed?.payment_mode,
      ["UPI", "Card", "Cash", "Net Banking", "Bank Transfer", "Bank Statement", "Wallet"] as const,
      "UPI"
    ),
    description: isNonEmptyString(parsed?.description) ? parsed.description.trim() : null,
  });

  if ("status" in normalized) {
    throw new Error(String((normalized.body as any).error || "Could not extract a valid transaction"));
  }

  return {
    amount: normalized.transaction.amount,
    type: normalized.transaction.type,
    category: normalized.transaction.category,
    date: normalized.transaction.date,
    payment_mode: normalized.transaction.payment_mode,
    description: normalized.transaction.description,
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

  const normalized: GeminiStatementTransaction[] = [];
  let previousBalance: number | null = null;

  for (const transaction of transactions) {
      const debitAmount = normalizeGeminiAmount(transaction.debit_amount);
      const creditAmount = normalizeGeminiAmount(transaction.credit_amount);
      const currentBalance = normalizeGeminiAmount(transaction.balance);
      const balanceDelta = previousBalance !== null && currentBalance !== null
        ? currentBalance - previousBalance
        : null;

      let type: "income" | "expense" | null = null;
      let amount = normalizeGeminiAmount(transaction.amount);

      // Running balance is the strongest signal because OCR can shift values between
      // visually adjacent Debit and Credit columns.
      if (balanceDelta !== null && Math.abs(balanceDelta) >= 0.005) {
        type = balanceDelta > 0 ? "income" : "expense";
        amount = Math.abs(balanceDelta);
      } else if (debitAmount !== null && debitAmount > 0 && !(creditAmount !== null && creditAmount > 0)) {
        type = "expense";
        amount = debitAmount;
      } else if (creditAmount !== null && creditAmount > 0 && !(debitAmount !== null && debitAmount > 0)) {
        type = "income";
        amount = creditAmount;
      } else if (transaction.type === "income" || transaction.type === "expense") {
        type = transaction.type;
      }

      if (currentBalance !== null) previousBalance = currentBalance;
      if (isStatementBalanceRow(transaction)) continue;

      const date = isValidDateString(transaction.date) ? transaction.date : null;
      const description = isNonEmptyString(transaction.description) ? transaction.description.trim() : "";

      if (!date || isFutureDateString(date) || !type || amount === null || amount <= 0 || !description) {
        continue;
      }

      normalized.push({
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
        vpa: extractVpa(transaction.vpa, description),
        record_kind: "transaction",
      });
  }

  return normalized.slice(0, 150);
};

const parseGeminiErrorResponse = async (response: Response) => {
  const text = await response.text();
  let message = text;
  let code: string | number | undefined = response.status;
  let retryAfter: string | undefined;

  try {
    const data = JSON.parse(text);
    const error = data?.error;
    if (error) {
      message = error.message || message;
      code = error.code ?? error.status ?? code;
      if (Array.isArray(error.details)) {
        const retryInfo = error.details.find((detail: any) =>
          typeof detail["@type"] === "string" && detail["@type"].includes("RetryInfo")
        );
        if (retryInfo?.retryDelay) {
          retryAfter = retryInfo.retryDelay;
        }
      }
    }
  } catch {
    // ignore parse errors and use raw text
  }

  return { message, code, retryAfter, text };
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
      const { message, code, retryAfter } = await parseGeminiErrorResponse(response);
      lastError = `Gemini error using ${model}: ${response.status} ${message}${retryAfter ? ` (retry after ${retryAfter})` : ""}`;

      if (response.status === 429 || code === 429 || String(code).toUpperCase().includes("RESOURCE_EXHAUSTED")) {
        throw new Error(lastError);
      }

      if (response.status === 400 || response.status === 404) {
        logger.warn("Gemini model unavailable, trying fallback", { model, status: response.status, code, message });
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
  const today = getTodayDateString();
  const prompt = `Extract expense transaction data from this Indian receipt or invoice file.
Return ONLY valid JSON with this exact shape:
{"merchant":"string","amount":number,"date":"YYYY-MM-DD","category":"Food|Transport|Shopping|Utilities|Entertainment|Health|Other","rawText":"short OCR text you used"}

Rules:
- Pick the final payable amount only. Ignore GST, CGST, SGST, discounts, invoice numbers, phone numbers, GSTIN, item counts, and dates.
- Convert DD/MM/YYYY, DD-MM-YYYY, or dates like "15 Aug 2026" to YYYY-MM-DD.
- Use ${today} only if no bill date is visible.
- Return the visible bill date even if it is after ${today}; the app will reject future-dated bills.
- In rawText, include the exact bill date line if it is visible.
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

const extractTransactionFromTextWithGemini = async (description: string) => {
  if (!GEMINI_API_KEY || AI_PROVIDER !== "gemini") {
    throw new Error("AI transaction extraction is not configured");
  }

  const today = getTodayDateString();
  const prompt = `Extract one personal-finance transaction from this user description for an Indian expense tracker.
Return ONLY valid JSON with this exact shape:
{"amount":number,"type":"income|expense","category":"Food|Transport|Shopping|Utilities|Entertainment|Health|Other","date":"YYYY-MM-DD","payment_mode":"UPI|Card|Cash|Net Banking|Bank Transfer|Bank Statement|Wallet","description":"short user-facing description"}

Rules:
- Extract exactly one transaction.
- Use positive amount values only.
- Classify salary, refund, interest, cashback, received, credited, deposit as income when appropriate.
- Classify paid, spent, bought, sent, debited, purchase, bill, fee, EMI as expense when appropriate.
- Convert relative dates using today = ${today}. For "today" use ${today}; for "yesterday" use the previous calendar date.
- If no date is mentioned, use ${today}.
- Never return a date after ${today}; use ${today} if the text implies a future date.
- Choose the closest category from the allowed list. Put rent, EMI, fees, subscriptions, and bills under Other unless a better listed category clearly applies.
- Choose the closest payment mode. Use UPI when the text mentions GPay, PhonePe, Paytm, QR, VPA, or UPI ID.
- Keep description short and clear, without repeating amount/date/payment mode.
- Do not include markdown, comments, code fences, or extra text.

User description:
${description}`;

  const result = await generateGemini(
    [{ text: prompt }],
    { responseMimeType: "application/json", maxOutputTokens: 600 }
  );

  return normalizeGeminiTextTransaction(result);
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

const getAdvisorFallbackReply = (message: string, investments: any[], summary: any, history: any[]) => {
  const text = message.toLowerCase();
  const currentValue = Number(summary?.current_value || 0);
  const monthlySip = Number(summary?.total_monthly_sip || 0);
  const invested = Number(summary?.total_invested_amount || 0);
  const hasAnswerContext = history.length >= 2;

  if (!investments.length) {
    return "I can answer investment and money planning questions, but add at least one SIP or lumpsum investment to get advice based on your real portfolio. If this is a goal, also share the target amount, timeline, and monthly capacity.";
  }

  if ((text.includes("retire") || text.includes("retirement")) && !hasAnswerContext) {
    return `Your current portfolio is about ₹${currentValue.toLocaleString("en-IN")} with monthly SIPs of ₹${monthlySip.toLocaleString("en-IN")}. To check retirement at 55, please answer: your current age, desired monthly retirement expense, existing emergency fund, and whether you want to include inflation.`;
  }

  if ((text.includes("car") || text.includes("lakh")) && !hasAnswerContext) {
    return `For a car goal, I need 3 details: target car price, exact timeline, and whether you want to pay fully upfront or use a loan/down payment. Your current portfolio is about ₹${currentValue.toLocaleString("en-IN")}.`;
  }

  if (text.includes("sip") && !hasAnswerContext) {
    return `To calculate the right SIP, tell me the target amount, timeline, expected annual return, and how much you can already invest monthly. Current SIP total: ₹${monthlySip.toLocaleString("en-IN")}/month.`;
  }

  return `Based on your tracked investments, you have invested about ₹${invested.toLocaleString("en-IN")} and the current value is about ₹${currentValue.toLocaleString("en-IN")}. For a better answer, share the target amount, timeline, risk comfort, and monthly capacity if relevant. Short timelines usually need lower risk; 5+ year timelines can usually handle more growth exposure. This is planning guidance, not financial advice.`;
};

const getAdvisorPortfolioContext = async (userId: number) => {
  const investments = await queryAll(`
    SELECT id, investment_type, sip_name, fund_name, monthly_sip_amount, total_invested_amount,
           current_value, expected_cagr, start_date, end_date
    FROM mutual_fund_sip_investments
    WHERE user_id = ?
    ORDER BY current_value DESC, id DESC
  `, [userId]);

  const summary = investments.reduce((totals, investment: any) => {
    const type = investment.investment_type === "lumpsum" ? "lumpsum" : "sip";
    if (type === "sip") totals.total_monthly_sip += Number(investment.monthly_sip_amount);
    if (type === "lumpsum") totals.total_lumpsum_amount += Number(investment.total_invested_amount);
    totals.total_invested_amount += Number(investment.total_invested_amount);
    totals.current_value += Number(investment.current_value);
    return totals;
  }, {
    total_monthly_sip: 0,
    total_lumpsum_amount: 0,
    total_invested_amount: 0,
    current_value: 0,
  });

  return {
    investments: investments.slice(0, 20),
    summary: {
      investment_count: investments.length,
      total_monthly_sip: Number(summary.total_monthly_sip.toFixed(2)),
      total_lumpsum_amount: Number(summary.total_lumpsum_amount.toFixed(2)),
      total_invested_amount: Number(summary.total_invested_amount.toFixed(2)),
      current_value: Number(summary.current_value.toFixed(2)),
    },
  };
};

const getWealthAdvisorReply = async (message: string, investments: any[], summary: any, history: any[]) => {
  if (!GEMINI_API_KEY || AI_PROVIDER !== "gemini") {
    return { reply: getAdvisorFallbackReply(message, investments, summary, history), provider: "local-fallback" };
  }

  const prompt = `You are Finovo AI Wealth Advisor for an Indian user. Use the user's portfolio and chat history to answer any investment, wealth, goal, SIP, retirement, or money planning question.

Rules:
- Ask focused follow-up questions when important data is missing.
- When enough data exists, give practical calculations, required SIP/lumpsum, feasibility, assumptions, and next steps.
- Use INR formatting like ₹15,00,000.
- Do not recommend specific stocks, funds, crypto, or guaranteed returns.
- Keep the answer concise, under 170 words.
- End with a short disclaimer that this is planning guidance, not financial advice.

Portfolio summary:
${JSON.stringify(summary)}

Investments:
${JSON.stringify(investments)}

Recent chat:
${JSON.stringify(history.slice(-8))}

User message:
${message}`;

  const reply = await generateGemini([{ text: prompt }], { responseMimeType: "text/plain", maxOutputTokens: 700 });
  return { reply, provider: "gemini", model: GEMINI_MODEL };
};

const ADVISOR_TITLE_MAX_LENGTH = 25;

const toAdvisorTitleCase = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const compactAdvisorTitle = (value: string) => {
  const title = toAdvisorTitleCase(value);
  return title.length > ADVISOR_TITLE_MAX_LENGTH
    ? title.slice(0, ADVISOR_TITLE_MAX_LENGTH).trim()
    : title || "New Chat";
};

const getAdvisorTitle = (message: string) => {
  const cleaned = message
    .replace(/\s+/g, " ")
    .replace(/[?!.]+$/g, "")
    .trim();
  const renameMatch = cleaned.match(/^(?:please\s+)?(?:name|rename|title)\s+(?:this\s+)?chat\s+(?:as|to)?\s+(.+)$/i);
  if (renameMatch?.[1]) {
    return compactAdvisorTitle(renameMatch[1]);
  }
  const lower = cleaned.toLowerCase();
  const amountMatch = cleaned.match(/₹\s*[\d,.]+\s*(?:lakh|lac|cr|crore|k)?|(?:\d+(?:\.\d+)?)\s*(?:lakh|lac|cr|crore)/i);
  const timelineMatch = cleaned.match(/\b(?:in|within|after)\s+\d+\s+(?:months?|years?|yrs?)\b/i);
  const ageMatch = cleaned.match(/\b(?:at|by)\s+\d{2}\b/i);
  const parts = [amountMatch?.[0], timelineMatch?.[0], ageMatch?.[0]]
    .filter(Boolean)
    .map((part) => String(part).replace(/\s+/g, " ").trim());

  if (lower.includes("retire") || lower.includes("retirement")) {
    return compactAdvisorTitle(["Retirement", ...parts].join(" "));
  }
  if (lower.includes("car")) {
    return compactAdvisorTitle(["Car Goal", ...parts].join(" "));
  }
  if (lower.includes("home") || lower.includes("house") || lower.includes("flat")) {
    return compactAdvisorTitle(["Home Goal", ...parts].join(" "));
  }
  if (lower.includes("sip")) {
    return compactAdvisorTitle(["SIP Plan", ...parts].join(" "));
  }
  if (lower.includes("tax")) {
    return "Tax Planning";
  }
  if (lower.includes("emergency")) {
    return "Emergency Fund Planning";
  }
  if (lower.includes("loan") || lower.includes("emi")) {
    return compactAdvisorTitle(["Loan EMI", ...parts].join(" "));
  }

  return compactAdvisorTitle(cleaned);
};

const getAdvisorRequestedTitle = (message: string) => {
  const cleaned = message.replace(/\s+/g, " ").replace(/[?!.]+$/g, "").trim();
  const renameMatch = cleaned.match(/^(?:please\s+)?(?:name|rename|title)\s+(?:this\s+)?chat\s+(?:as|to)?\s+(.+)$/i);
  return renameMatch?.[1] ? compactAdvisorTitle(renameMatch[1]) : null;
};

const ensureAdvisorSession = async (userId: number, sessionId: string, firstMessage = "New Chat") => {
  const title = getAdvisorTitle(firstMessage);
  await execute(`
    INSERT INTO ai_advisor_sessions (user_id, session_id, title)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      updated_at = CURRENT_TIMESTAMP,
      title = IF(title = 'New Chat' OR title = 'Default Chat', VALUES(title), title)
  `, [userId, sessionId, title]);
};

const importStatementWithGemini = async (base64Data: string, mimeType: string) => {
  const today = new Date().toISOString().split("T")[0];
  const prompt = `Extract incoming and outgoing money transactions from this Indian bank, credit card, UPI, PhonePe, GPay, Paytm, or wallet statement.
Return ONLY valid JSON with this exact shape:
{"transactions":[{"record_kind":"transaction|balance|summary","date":"YYYY-MM-DD or null","description":"string","debit_amount":"number or null","credit_amount":"number or null","balance":"number or null","amount":"number or null","type":"income|expense|null","category":"string","payment_mode":"Bank Statement|UPI|Card|Net Banking|Cash|Wallet","vpa":"payee@provider or null"}]}

Rules:
- Extract real money movement rows only.
- Classify every candidate row first: transaction = an actual debit/credit; balance = opening/closing/running/available balance; summary = totals or statement metadata.
- Opening balance is NEVER income and closing balance is NEVER an expense. They are account states, not money movements.
- Read the statement's Debit and Credit columns by their physical header positions. Preserve which column contains the value; do not infer direction from the description.
- Put a value under Debit into debit_amount only. Put a value under Credit into credit_amount only. A dash means null.
- Always return the running Balance for every row when visible. The server will verify direction from balance movement.
- For a transaction, exactly one of debit_amount or credit_amount should normally be non-null. Set amount to that same value.
- CREDIT, CR, deposit, salary, refund, interest, received, inward UPI = type "income".
- DEBIT, DR, withdrawal, purchase, paid, sent, outward UPI, ATM, card spend, charges = type "expense".
- If Debit=90.00, Credit=-, Balance=15730.29, return debit_amount=90, credit_amount=null, type="expense".
- If Debit=-, Credit=1000.00, Balance rises from 19.29 to 1019.29, return debit_amount=null, credit_amount=1000, type="income".
- Use absolute positive amount values only. Do not use negative numbers.
- Return the opening balance row as record_kind="balance", with its balance value, before transaction rows. It will be used only to verify the first transaction and will not be imported.
- Preserve the exact top-to-bottom statement row order; never reverse or sort rows.
- Ignore closing/available balances, account numbers, totals, summaries, page headers, and duplicate continuation rows.
- Never return balance rows such as OPENING BALANCE, CLOSING BALANCE, BAL B/F, BAL C/F, BROUGHT FORWARD, or CARRIED FORWARD as transactions.
- Also classify INITIAL BALANCE, BEGINNING BALANCE, PREVIOUS BALANCE, OP BAL, CL BAL, BALANCE AS ON, and ledger/running balances as record_kind "balance".
- Only record_kind "transaction" rows will be imported. When uncertain whether a row is a transaction or balance, classify it as "balance".
- Convert DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD.
- If a date is unreadable, omit that row rather than using ${today}.
- Omit rows dated after ${today}; future transactions must not be imported.
- Choose a practical category. Use Salary, Refund, Interest, Transfer, Food, Transport, Shopping, Utilities, Entertainment, Health, Fees, ATM, Other.
- Keep descriptions short but traceable to the statement narration.
- Copy the payee UPI ID/VPA exactly into vpa when present in the narration. Otherwise return null.
- Return up to 150 rows in exact statement order.`;

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

const createAuthResponse = (user: any, res?: Response) => {
  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: SESSION_EXPIRES_IN }
  );
  const decoded = jwt.decode(token) as { exp?: number } | null;
  const expiresAt = decoded?.exp ? decoded.exp * 1000 : Date.now() + AUTH_COOKIE_MAX_AGE_MS;

  if (res) {
    res.cookie(AUTH_COOKIE_NAME, token, {
      ...getAuthCookieOptions(),
      maxAge: Math.max(0, expiresAt - Date.now()),
      expires: new Date(expiresAt),
    });
  }

  return {
    expiresAt,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      daily_threshold: user.daily_threshold,
    },
  };
};

type ProfileInput = {
  name: string;
  date_of_birth: string | null;
  occupation: string | null;
  city: string | null;
  country: string;
  monthly_income: number | null;
  monthly_expense_target: number | null;
  emergency_fund_target: number | null;
  risk_appetite: "low" | "moderate" | "high" | null;
  investment_goal: string | null;
  financial_dependents: number | null;
  preferred_currency: string;
  ai_personalization_enabled: boolean;
};

const normalizeOptionalText = (value: unknown, maxLength: number) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
};

const normalizeCurrency = (value: unknown) => {
  const currency = isNonEmptyString(value) ? value.trim().toUpperCase() : "INR";
  return /^[A-Z]{3,10}$/.test(currency) ? currency : null;
};

const toNullableNonNegativeNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = toNumber(value);
  return parsed !== null && parsed >= 0 ? parsed : undefined;
};

const toNullableNonNegativeInteger = (value: unknown) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
};

const validateProfileInput = (body: any): { data: ProfileInput } | { error: string } => {
  const name = isNonEmptyString(body?.name) ? body.name.trim() : "";
  const dateOfBirth = body?.date_of_birth === undefined || body?.date_of_birth === null || body?.date_of_birth === ""
    ? null
    : String(body.date_of_birth);
  const occupation = normalizeOptionalText(body?.occupation, 255);
  const city = normalizeOptionalText(body?.city, 120);
  const country = normalizeOptionalText(body?.country, 120) || "India";
  const monthlyIncome = toNullableNonNegativeNumber(body?.monthly_income);
  const monthlyExpenseTarget = toNullableNonNegativeNumber(body?.monthly_expense_target);
  const emergencyFundTarget = toNullableNonNegativeNumber(body?.emergency_fund_target);
  const financialDependents = toNullableNonNegativeInteger(body?.financial_dependents);
  const preferredCurrency = normalizeCurrency(body?.preferred_currency);
  const riskAppetiteInput = body?.risk_appetite === undefined || body?.risk_appetite === null || body?.risk_appetite === ""
    ? null
    : String(body.risk_appetite).toLowerCase();

  if (!name || name.length > 255) {
    return { error: "Name is required and must be 255 characters or fewer" };
  }
  if (dateOfBirth !== null && !isValidCalendarDate(dateOfBirth)) {
    return { error: "Date of birth must be a valid YYYY-MM-DD date" };
  }
  if (monthlyIncome === undefined || monthlyExpenseTarget === undefined || emergencyFundTarget === undefined) {
    return { error: "Financial amounts must be non-negative numbers" };
  }
  if (financialDependents === undefined) {
    return { error: "Financial dependents must be a non-negative whole number" };
  }
  if (riskAppetiteInput !== null && riskAppetiteInput !== "low" && riskAppetiteInput !== "moderate" && riskAppetiteInput !== "high") {
    return { error: "Risk appetite must be low, moderate, or high" };
  }
  if (!preferredCurrency) {
    return { error: "Preferred currency must be a valid currency code" };
  }

  return {
    data: {
      name,
      date_of_birth: dateOfBirth,
      occupation,
      city,
      country,
      monthly_income: monthlyIncome,
      monthly_expense_target: monthlyExpenseTarget,
      emergency_fund_target: emergencyFundTarget,
      risk_appetite: riskAppetiteInput as ProfileInput["risk_appetite"],
      investment_goal: normalizeOptionalText(body?.investment_goal, 2000),
      financial_dependents: financialDependents,
      preferred_currency: preferredCurrency,
      ai_personalization_enabled: Boolean(body?.ai_personalization_enabled),
    },
  };
};

const getUserProfile = async (userId: number) => {
  const profile: any = await queryOne(`
    SELECT
      users.id,
      users.email,
      users.name,
      users.daily_threshold,
      user_profiles.date_of_birth,
      user_profiles.occupation,
      user_profiles.city,
      COALESCE(user_profiles.country, 'India') AS country,
      user_profiles.monthly_income,
      user_profiles.monthly_expense_target,
      user_profiles.emergency_fund_target,
      user_profiles.risk_appetite,
      user_profiles.investment_goal,
      user_profiles.financial_dependents,
      COALESCE(user_profiles.preferred_currency, 'INR') AS preferred_currency,
      COALESCE(user_profiles.ai_personalization_enabled, FALSE) AS ai_personalization_enabled,
      COALESCE(user_profiles.profile_context_version, 1) AS profile_context_version,
      user_profiles.updated_at AS profile_updated_at
    FROM users
    LEFT JOIN user_profiles ON user_profiles.user_id = users.id
    WHERE users.id = ?
  `, [userId]);

  if (!profile) return null;

  return {
    ...profile,
    ai_personalization_enabled: Boolean(profile.ai_personalization_enabled),
  };
};

const encodeBase64UrlJson = (value: unknown) =>
  Buffer.from(JSON.stringify(value), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

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

  if (!payload.email || (payload.email_verified !== "true" && payload.email_verified !== true)) {
    throw Object.assign(new Error("Google account email is not verified"), { status: 401 });
  }

  return payload;
};

const authenticateGoogleCredential = async (credential: string, res?: Response) => {
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

  return createAuthResponse(user, res);
};

const normalizeTransactionBody = (body: any) => {
  const { amount, type, category, date, payment_mode, description, bill_url, source_statement_hash, import_fingerprint, payee_vpa, merchant_name } = body;
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

  if (isFutureDateString(date)) {
    return { status: 400, body: { error: "Transaction date cannot be in the future" } };
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
    payee_vpa: normalizeVpa(payee_vpa),
    merchant_name: normalizeCompanyName(merchant_name),
  };

  return { transaction };
};

const createTransaction = async (userId: number, body: any, walletId?: number) => {
  const normalized = normalizeTransactionBody(body);

  if ("status" in normalized) {
    return normalized;
  }

  const resolvedWalletId = walletId ?? await ensurePersonalWallet(userId);
  return insertTransaction(userId, normalized.transaction, resolvedWalletId);
};

const insertTransaction = async (userId: number, transaction: NormalizedTransaction, walletId: number) => {
  const info = await execute(`
    INSERT INTO transactions (
      user_id,
      wallet_id,
      created_by_user_id,
      amount,
      type,
      category,
      date,
      payment_mode,
      description,
      bill_url,
      source_statement_hash,
      import_fingerprint,
      payee_vpa,
      merchant_name
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    userId,
    walletId,
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
    transaction.payee_vpa,
    transaction.merchant_name,
  ]);

  return {
    status: 201,
    body: {
      id: info.insertId,
      user_id: userId,
      wallet_id: walletId,
      created_by_user_id: userId,
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

const findDuplicateStatementTransaction = (walletId: number, transaction: NormalizedTransaction) =>
  transaction.import_fingerprint
    ? queryOne(
      `
        SELECT id
        FROM transactions
        WHERE wallet_id = ?
          AND import_fingerprint = ?
        LIMIT 1
      `,
      [walletId, transaction.import_fingerprint]
    )
    : queryOne(
      `
      SELECT id
      FROM transactions
      WHERE wallet_id = ?
        AND amount = ?
        AND type = ?
        AND category = ?
        AND date = ?
        AND payment_mode = ?
        AND description <=> ?
      LIMIT 1
    `,
      [
        walletId,
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

const getMerchantAliases = (userId: number) =>
  queryAll(
    "SELECT id, vpa, company_name, created_at, updated_at FROM merchant_aliases WHERE user_id = ? ORDER BY company_name, vpa",
    [userId]
  );

const getMerchantAliasMap = async (userId: number, vpas: Array<string | null>) => {
  const uniqueVpas = [...new Set(vpas.filter((vpa): vpa is string => Boolean(vpa)))];
  if (!uniqueVpas.length) return new Map<string, string>();

  const placeholders = uniqueVpas.map(() => "?").join(", ");
  const aliases: any[] = await queryAll(
    `SELECT vpa, company_name FROM merchant_aliases WHERE user_id = ? AND vpa IN (${placeholders})`,
    [userId, ...uniqueVpas]
  );
  return new Map(aliases.map((alias) => [alias.vpa, alias.company_name]));
};

const upsertMerchantAlias = async (userId: number, vpaValue: unknown, companyNameValue: unknown) => {
  const vpa = normalizeVpa(vpaValue);
  const companyName = normalizeCompanyName(companyNameValue);
  if (!vpa) return { status: 400, body: { error: "A valid UPI VPA is required" } };
  if (!companyName) return { status: 400, body: { error: "Company name is required and must be 255 characters or fewer" } };

  await execute(
    `
      INSERT INTO merchant_aliases (user_id, vpa, company_name)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), updated_at = CURRENT_TIMESTAMP
    `,
    [userId, vpa, companyName]
  );
  await execute(
    "UPDATE transactions SET merchant_name = ? WHERE user_id = ? AND payee_vpa = ?",
    [companyName, userId, vpa]
  );
  const alias = await queryOne(
    "SELECT id, vpa, company_name, created_at, updated_at FROM merchant_aliases WHERE user_id = ? AND vpa = ?",
    [userId, vpa]
  );
  return { status: 200, body: alias };
};

const enrichStatementTransactionsWithAliases = async (userId: number, transactions: GeminiStatementTransaction[]) => {
  const withVpas = transactions.map((transaction) => ({
    ...transaction,
    vpa: extractVpa(transaction.vpa, transaction.description),
  }));
  const aliases = await getMerchantAliasMap(userId, withVpas.map(({ vpa }) => vpa));
  return withVpas.map((transaction) => ({
    ...transaction,
    original_description: transaction.description,
    merchant_name: transaction.vpa ? aliases.get(transaction.vpa) || null : null,
    alias_status: transaction.vpa && aliases.has(transaction.vpa) ? "matched" : transaction.vpa ? "unknown" : "not_applicable",
  }));
};

const skipAllStatementTransactions = (transactions: any[], error: string) =>
  transactions.map((transaction) => ({ transaction, error }));

const saveStatementTransactions = async (
  userId: number,
  transactions: any[],
  options: { fileHash?: string; walletId?: number } = {}
) => {
  const savedTransactions: any[] = [];
  const skipped: Array<{ transaction: any; error: string }> = [];
  const seenStatementRows = new Set<string>();
  const walletId = options.walletId ?? await ensurePersonalWallet(userId);

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

  for (const transaction of transactions) {
    const vpa = extractVpa(transaction.vpa, transaction.payee_vpa, transaction.original_description, transaction.description);
    const companyName = normalizeCompanyName(transaction.merchant_name);
    if (vpa && companyName) {
      await upsertMerchantAlias(userId, vpa, companyName);
    }
  }
  const aliasMap = await getMerchantAliasMap(
    userId,
    transactions.map((transaction) => extractVpa(transaction.vpa, transaction.payee_vpa, transaction.original_description, transaction.description))
  );

  for (const [index, transaction] of transactions.entries()) {
    const sourceStatementHash = options.fileHash || null;
    const payeeVpa = extractVpa(transaction.vpa, transaction.payee_vpa, transaction.original_description, transaction.description);
    const merchantName = payeeVpa ? aliasMap.get(payeeVpa) || null : null;
    const originalDescription = isNonEmptyString(transaction.original_description)
      ? transaction.original_description.trim()
      : isNonEmptyString(transaction.description)
        ? transaction.description.trim()
        : "";
    const normalized = normalizeTransactionBody({
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
      date: transaction.date,
      payment_mode: transaction.payment_mode || "Bank Statement",
      description: merchantName
        ? `Statement Import: ${merchantName}`
        : originalDescription
          ? `Statement Import: ${originalDescription}`
          : "Statement Import",
      source_statement_hash: sourceStatementHash,
      payee_vpa: payeeVpa,
      merchant_name: merchantName,
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
      : await findDuplicateStatementTransaction(walletId, normalized.transaction);

    if (existing) {
      skipped.push({
        transaction,
        error: "Duplicate statement transaction already exists",
      });
      continue;
    }

    const result = await insertTransaction(userId, normalized.transaction, walletId);
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
  queryOne(`
    SELECT
      transactions.*,
      users.name AS created_by_name,
      users.email AS created_by_email
    FROM transactions
    LEFT JOIN users ON users.id = transactions.created_by_user_id
    JOIN wallet_members ON wallet_members.wallet_id = transactions.wallet_id
    WHERE transactions.id = ? AND wallet_members.user_id = ?
    LIMIT 1
  `, [id, userId]);

const getTransactionFilters = async (query: any, userId: number) => {
  const resolved = await resolveWalletIdForUser(userId, query.wallet_id);
  if ("status" in resolved) {
    return { error: resolved.body.error, status: resolved.status };
  }

  const conditions = ["transactions.wallet_id = ?"];
  const params: any[] = [resolved.walletId];

  if (isNonEmptyString(query.type)) {
    if (query.type !== "expense" && query.type !== "income") {
      return { error: "Type must be expense or income" };
    }
    conditions.push("transactions.type = ?");
    params.push(query.type);
  }

  if (isNonEmptyString(query.category)) {
    conditions.push("transactions.category = ?");
    params.push(query.category.trim());
  }

  if (isNonEmptyString(query.payment_mode)) {
    conditions.push("transactions.payment_mode = ?");
    params.push(query.payment_mode.trim());
  }

  if (isNonEmptyString(query.from)) {
    if (!isValidDateString(query.from)) {
      return { error: "From date must use YYYY-MM-DD format" };
    }
    conditions.push("transactions.date >= ?");
    params.push(query.from);
  }

  if (isNonEmptyString(query.to)) {
    if (!isValidDateString(query.to)) {
      return { error: "To date must use YYYY-MM-DD format" };
    }
    conditions.push("transactions.date <= ?");
    params.push(query.to);
  }

  return { where: conditions.join(" AND "), params, walletId: resolved.walletId };
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
    payee_vpa: body.payee_vpa === undefined ? existing.payee_vpa : body.payee_vpa,
    merchant_name: body.merchant_name === undefined ? existing.merchant_name : body.merchant_name,
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

  if (isFutureDateString(next.date)) {
    return { status: 400, body: { error: "Transaction date cannot be in the future" } };
  }

  const transaction = {
    amount: next.amount,
    type: next.type,
    category: next.category.trim(),
    date: next.date,
    payment_mode: next.payment_mode.trim(),
    description: isNonEmptyString(next.description) ? next.description.trim() : null,
    bill_url: isNonEmptyString(next.bill_url) ? next.bill_url.trim() : null,
    payee_vpa: normalizeVpa(next.payee_vpa),
    merchant_name: normalizeCompanyName(next.merchant_name),
  };

  await execute(`
    UPDATE transactions
    SET amount = ?, type = ?, category = ?, date = ?, payment_mode = ?, description = ?, bill_url = ?, payee_vpa = ?, merchant_name = ?
    WHERE id = ?
  `, [
    transaction.amount,
    transaction.type,
    transaction.category,
    transaction.date,
    transaction.payment_mode,
    transaction.description,
    transaction.bill_url,
    transaction.payee_vpa,
    transaction.merchant_name,
    id,
  ]);

  return {
    status: 200,
    body: {
      id,
      user_id: existing.user_id,
      wallet_id: existing.wallet_id,
      created_by_user_id: existing.created_by_user_id,
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

const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

type MonthlyReportPreferences = {
  email_enabled: boolean;
  report_frequency: "daily" | "weekly" | "monthly" | "custom";
  custom_interval_days: number;
  send_day_of_month: number;
  include_ai_summary: boolean;
  include_next_month_planning: boolean;
  delivery_email: string | null;
};

const getDefaultMonthlyReportPreferences = (): MonthlyReportPreferences => ({
  email_enabled: true,
  report_frequency: "monthly",
  custom_interval_days: 30,
  send_day_of_month: 1,
  include_ai_summary: false,
  include_next_month_planning: true,
  delivery_email: null,
});

const formatCurrency = (value: unknown) => INR_FORMATTER.format(Number(value) || 0);

const formatPercent = (value: number) => `${Number(value.toFixed(1))}%`;

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getMonthStartEnd = (month: string) => {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) return null;
  const startDate = `${month}-01`;
  const endDate = toDateString(new Date(year, monthNumber, 0));
  return { startDate, endDate, year, monthIndex: monthNumber - 1 };
};

const getPreviousMonthString = (date = new Date()) => {
  const previous = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
};

const getNextMonthString = (month: string) => {
  const bounds = getMonthStartEnd(month);
  if (!bounds) return null;
  const next = new Date(bounds.year, bounds.monthIndex + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
};

const getMonthLabel = (month: string) => {
  const bounds = getMonthStartEnd(month);
  if (!bounds) return month;
  return new Date(bounds.year, bounds.monthIndex, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
};

const getDaysInMonth = (month: string) => {
  const bounds = getMonthStartEnd(month);
  return bounds ? new Date(bounds.year, bounds.monthIndex + 1, 0).getDate() : 30;
};

const getMonthlyReportPreferences = async (userId: number): Promise<MonthlyReportPreferences> => {
  const row: any = await queryOne("SELECT * FROM monthly_report_preferences WHERE user_id = ?", [userId]);
  if (!row) return getDefaultMonthlyReportPreferences();
  const frequency = ["daily", "weekly", "monthly", "custom"].includes(String(row.report_frequency))
    ? String(row.report_frequency) as MonthlyReportPreferences["report_frequency"]
    : "monthly";

  return {
    email_enabled: Boolean(row.email_enabled),
    report_frequency: frequency,
    custom_interval_days: Number(row.custom_interval_days) || 30,
    send_day_of_month: Number(row.send_day_of_month) || 1,
    include_ai_summary: Boolean(row.include_ai_summary),
    include_next_month_planning: Boolean(row.include_next_month_planning),
    delivery_email: row.delivery_email || null,
  };
};

const validateMonthlyReportPreferences = (body: any): { data: MonthlyReportPreferences } | { error: string } => {
  const defaults = getDefaultMonthlyReportPreferences();
  const frequency = body?.report_frequency === undefined ? defaults.report_frequency : String(body.report_frequency);
  const customIntervalDays = body?.custom_interval_days === undefined
    ? defaults.custom_interval_days
    : Number(body.custom_interval_days);
  const sendDay = body?.send_day_of_month === undefined ? defaults.send_day_of_month : Number(body.send_day_of_month);
  if (!["daily", "weekly", "monthly", "custom"].includes(frequency)) {
    return { error: "Report frequency must be daily, weekly, monthly, or custom" };
  }

  if (!Number.isInteger(customIntervalDays) || customIntervalDays < 1 || customIntervalDays > 365) {
    return { error: "Custom interval must be between 1 and 365 days" };
  }

  if (!Number.isInteger(sendDay) || sendDay < 1 || sendDay > 28) {
    return { error: "Send day must be between 1 and 28" };
  }

  return {
    data: {
      email_enabled: body?.email_enabled === undefined ? defaults.email_enabled : Boolean(body.email_enabled),
      report_frequency: frequency as MonthlyReportPreferences["report_frequency"],
      custom_interval_days: customIntervalDays,
      send_day_of_month: sendDay,
      include_ai_summary: body?.include_ai_summary === undefined ? defaults.include_ai_summary : Boolean(body.include_ai_summary),
      include_next_month_planning: body?.include_next_month_planning === undefined
        ? defaults.include_next_month_planning
        : Boolean(body.include_next_month_planning),
      delivery_email: null,
    },
  };
};

const getMonthDifference = (from: Date, to: Date) =>
  (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth();

const getRecurringEventsDueBetween = (events: any[], startDate: string, endDate: string) => {
  const start = getDateFromString(startDate);
  const end = getDateFromString(endDate);
  const dueEvents: any[] = [];

  for (const event of events) {
    const dayOfMonth = Number(event.day_of_month);
    const frequency = isValidRecurringFrequency(String(event.frequency || "")) ? String(event.frequency) : "monthly";
    const intervalCount = Math.max(1, Number(event.interval_count) || 1);
    const monthStep = frequency === "yearly" ? intervalCount * 12 : intervalCount;
    const anchor = event.start_date ? getDateFromString(event.start_date) : start;
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

    while (cursor <= end) {
      const dueDate = getDueDateForMonth(cursor.getFullYear(), cursor.getMonth(), dayOfMonth);
      const monthDifference = getMonthDifference(new Date(anchor.getFullYear(), anchor.getMonth(), 1), cursor);
      const isAligned = monthDifference >= 0 && monthDifference % monthStep === 0;

      if (isAligned && dueDate >= anchor && dueDate >= start && dueDate <= end) {
        dueEvents.push({
          ...event,
          next_due_date: toDateString(dueDate),
          days_until_due: Math.ceil((dueDate.getTime() - getDateOnly(new Date()).getTime()) / (24 * 60 * 60 * 1000)),
        });
      }

      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  return dueEvents.sort((a, b) => String(a.next_due_date).localeCompare(String(b.next_due_date)));
};

const buildMonthlyReport = async (userId: number, month = getPreviousMonthString()) => {
  const bounds = getMonthStartEnd(month);
  if (!bounds) {
    return { error: "Month must use YYYY-MM format" };
  }

  const nextMonth = getNextMonthString(month) as string;
  const nextBounds = getMonthStartEnd(nextMonth) as NonNullable<ReturnType<typeof getMonthStartEnd>>;
  const user: any = await queryOne(`
    SELECT users.id, users.name, users.email, users.daily_threshold, user_profiles.monthly_expense_target
    FROM users
    LEFT JOIN user_profiles ON user_profiles.user_id = users.id
    WHERE users.id = ?
  `, [userId]);

  if (!user) {
    return { error: "User not found" };
  }

  const transactions = await queryAll(`
    SELECT *
    FROM transactions
    WHERE user_id = ? AND date BETWEEN ? AND ?
    ORDER BY date ASC, id ASC
  `, [userId, bounds.startDate, bounds.endDate]);

  const recurringEvents = await queryAll("SELECT * FROM recurring_events WHERE user_id = ?", [userId]);
  const investments = await queryAll("SELECT * FROM mutual_fund_sip_investments WHERE user_id = ?", [userId]);

  const totalIncome = transactions
    .filter((transaction: any) => transaction.type === "income")
    .reduce((sum: number, transaction: any) => sum + Number(transaction.amount), 0);
  const totalExpense = transactions
    .filter((transaction: any) => transaction.type === "expense")
    .reduce((sum: number, transaction: any) => sum + Number(transaction.amount), 0);
  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
  const averageDailyExpense = totalExpense / getDaysInMonth(month);

  const byCategory = new Map<string, number>();
  const byDay = new Map<string, number>();
  for (const transaction of transactions as any[]) {
    if (transaction.type !== "expense") continue;
    byCategory.set(transaction.category, (byCategory.get(transaction.category) || 0) + Number(transaction.amount));
    byDay.set(transaction.date, (byDay.get(transaction.date) || 0) + Number(transaction.amount));
  }

  const topCategories = [...byCategory.entries()]
    .map(([category, amount]) => ({
      category,
      amount: Number(amount.toFixed(2)),
      share_percent: totalExpense > 0 ? Number(((amount / totalExpense) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const dailyThreshold = Number(user.daily_threshold) || 0;
  const overExpensedDays = [...byDay.entries()]
    .filter(([, amount]) => dailyThreshold > 0 && amount > dailyThreshold)
    .map(([date, amount]) => ({
      date,
      amount: Number(amount.toFixed(2)),
      threshold: dailyThreshold,
      over_by: Number((amount - dailyThreshold).toFixed(2)),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const highestExpenseDay = [...byDay.entries()]
    .map(([date, amount]) => ({ date, amount: Number(amount.toFixed(2)) }))
    .sort((a, b) => b.amount - a.amount)[0] || null;

  const recurringPaidThisMonth = getRecurringEventsDueBetween(recurringEvents, bounds.startDate, bounds.endDate);
  const nextMonthDue = getRecurringEventsDueBetween(recurringEvents, nextBounds.startDate, nextBounds.endDate);
  const nextMonthRecurringExpense = nextMonthDue
    .filter((event: any) => event.type !== "income")
    .reduce((sum: number, event: any) => sum + Number(event.amount), 0);
  const nextMonthRecurringIncome = nextMonthDue
    .filter((event: any) => event.type === "income")
    .reduce((sum: number, event: any) => sum + Number(event.amount), 0);

  const investmentSummary = investments.reduce((summary: any, investment: any) => {
    const projection = getInvestmentProjection(investment);
    summary.count += 1;
    summary.monthly_commitment += investment.investment_type === "lumpsum" ? 0 : Number(investment.monthly_sip_amount);
    summary.total_invested += Number(investment.total_invested_amount);
    summary.current_value += Number(investment.current_value);
    summary.projected_future_value += Number(projection.future_value);
    return summary;
  }, {
    count: 0,
    monthly_commitment: 0,
    total_invested: 0,
    current_value: 0,
    projected_future_value: 0,
  });

  const targetExpense = Number(user.monthly_expense_target) || 0;
  const expectedNextMonthExpense = Number((averageDailyExpense * getDaysInMonth(nextMonth) + nextMonthRecurringExpense).toFixed(2));
  const recommendedBudget = targetExpense > 0
    ? Math.min(targetExpense, expectedNextMonthExpense || targetExpense)
    : expectedNextMonthExpense;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    month,
    month_label: getMonthLabel(month),
    next_month: nextMonth,
    next_month_label: getMonthLabel(nextMonth),
    period: {
      start_date: bounds.startDate,
      end_date: bounds.endDate,
    },
    summary: {
      total_income: Number(totalIncome.toFixed(2)),
      total_expense: Number(totalExpense.toFixed(2)),
      net_savings: Number(netSavings.toFixed(2)),
      savings_rate_percent: Number(savingsRate.toFixed(1)),
      average_daily_expense: Number(averageDailyExpense.toFixed(2)),
      transaction_count: transactions.length,
      expense_transaction_count: transactions.filter((transaction: any) => transaction.type === "expense").length,
      income_transaction_count: transactions.filter((transaction: any) => transaction.type === "income").length,
    },
    monthly_targets: {
      daily_threshold: dailyThreshold,
      monthly_expense_target: targetExpense || null,
      target_gap: targetExpense > 0 ? Number((targetExpense - totalExpense).toFixed(2)) : null,
    },
    top_categories: topCategories,
    highest_expense_day: highestExpenseDay,
    over_expensed_days: overExpensedDays,
    recurring_paid_this_month: recurringPaidThisMonth,
    next_month_planning: {
      expected_expense_from_spending_pace: Number((averageDailyExpense * getDaysInMonth(nextMonth)).toFixed(2)),
      recurring_expense_due: Number(nextMonthRecurringExpense.toFixed(2)),
      recurring_income_due: Number(nextMonthRecurringIncome.toFixed(2)),
      expected_total_expense: expectedNextMonthExpense,
      recommended_budget: Number(recommendedBudget.toFixed(2)),
      due_items: nextMonthDue,
    },
    investment_summary: {
      count: investmentSummary.count,
      monthly_commitment: Number(investmentSummary.monthly_commitment.toFixed(2)),
      total_invested: Number(investmentSummary.total_invested.toFixed(2)),
      current_value: Number(investmentSummary.current_value.toFixed(2)),
      projected_future_value: Number(investmentSummary.projected_future_value.toFixed(2)),
    },
  };
};

const buildMonthlyReportEmailHtml = (report: any) => {
  const topCategoryRows = report.top_categories.length
    ? report.top_categories.map((category: any) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(category.category)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 700;">${formatCurrency(category.amount)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${category.share_percent}%</td>
      </tr>
    `).join("")
    : `<tr><td colspan="3" style="padding: 12px; color: #6b7280;">No category spending recorded for this month.</td></tr>`;

  const overExpenseRows = report.over_expensed_days.length
    ? report.over_expensed_days.map((day: any) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(day.date)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 700;">${formatCurrency(day.amount)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #dc2626;">${formatCurrency(day.over_by)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="3" style="padding: 12px; color: #16a34a;">No days crossed your daily threshold.</td></tr>`;

  const dueRows = report.next_month_planning.due_items.length
    ? report.next_month_planning.due_items.map((item: any) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.next_due_date)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.name)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.category)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 700;">${formatCurrency(item.amount)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="4" style="padding: 12px; color: #6b7280;">No recurring payments are due next month.</td></tr>`;

  return `
    <div style="margin: 0; padding: 0; background: #f3f4f6; font-family: Arial, sans-serif; color: #111827;">
      <div style="max-width: 760px; margin: 0 auto; padding: 28px 16px;">
        <div style="background: #111827; color: #ffffff; border-radius: 18px 18px 0 0; padding: 32px;">
          <p style="margin: 0 0 8px; color: #93c5fd; font-size: 13px; letter-spacing: .08em; text-transform: uppercase;">Finovo Monthly Financial Digest</p>
          <h1 style="margin: 0; font-size: 30px; line-height: 1.2;">${escapeHtml(report.month_label)} report</h1>
          <p style="margin: 12px 0 0; color: #d1d5db; font-size: 15px;">Hi ${escapeHtml(report.user.name)}, here is your full month review and ${escapeHtml(report.next_month_label)} planning snapshot.</p>
        </div>

        <div style="background: #ffffff; padding: 28px 32px; border-radius: 0 0 18px 18px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="width: 50%; padding: 12px; background: #ecfdf5; border-radius: 12px;">
                <p style="margin: 0; color: #047857; font-size: 13px;">Income</p>
                <p style="margin: 6px 0 0; font-size: 24px; font-weight: 800;">${formatCurrency(report.summary.total_income)}</p>
              </td>
              <td style="width: 16px;"></td>
              <td style="width: 50%; padding: 12px; background: #fef2f2; border-radius: 12px;">
                <p style="margin: 0; color: #b91c1c; font-size: 13px;">Expense</p>
                <p style="margin: 6px 0 0; font-size: 24px; font-weight: 800;">${formatCurrency(report.summary.total_expense)}</p>
              </td>
            </tr>
          </table>

          <h2 style="font-size: 20px; margin: 0 0 12px;">Month summary</h2>
          <p style="line-height: 1.7; color: #374151; margin: 0 0 18px;">
            You recorded <strong>${report.summary.transaction_count}</strong> transactions in ${escapeHtml(report.month_label)}.
            Net savings were <strong>${formatCurrency(report.summary.net_savings)}</strong>, with a savings rate of
            <strong>${formatPercent(report.summary.savings_rate_percent)}</strong>. Your average daily expense was
            <strong>${formatCurrency(report.summary.average_daily_expense)}</strong>.
            ${report.highest_expense_day ? `The highest expense day was <strong>${escapeHtml(report.highest_expense_day.date)}</strong> at <strong>${formatCurrency(report.highest_expense_day.amount)}</strong>.` : "There was no expense day to highlight this month."}
          </p>

          <h2 style="font-size: 20px; margin: 24px 0 12px;">Top expense categories</h2>
          <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
            <thead>
              <tr style="background: #f9fafb;">
                <th align="left" style="padding: 12px; font-size: 12px; color: #6b7280;">Category</th>
                <th align="right" style="padding: 12px; font-size: 12px; color: #6b7280;">Amount</th>
                <th align="right" style="padding: 12px; font-size: 12px; color: #6b7280;">Share</th>
              </tr>
            </thead>
            <tbody>${topCategoryRows}</tbody>
          </table>

          <h2 style="font-size: 20px; margin: 24px 0 12px;">Over-expensed days</h2>
          <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
            <thead>
              <tr style="background: #f9fafb;">
                <th align="left" style="padding: 12px; font-size: 12px; color: #6b7280;">Date</th>
                <th align="right" style="padding: 12px; font-size: 12px; color: #6b7280;">Spent</th>
                <th align="right" style="padding: 12px; font-size: 12px; color: #6b7280;">Over by</th>
              </tr>
            </thead>
            <tbody>${overExpenseRows}</tbody>
          </table>

          <h2 style="font-size: 20px; margin: 24px 0 12px;">${escapeHtml(report.next_month_label)} planning</h2>
          <p style="line-height: 1.7; color: #374151; margin: 0 0 18px;">
            Based on this month’s spending pace, expected spending for next month is <strong>${formatCurrency(report.next_month_planning.expected_expense_from_spending_pace)}</strong>.
            Known recurring expense due next month is <strong>${formatCurrency(report.next_month_planning.recurring_expense_due)}</strong>.
            A practical budget target is <strong>${formatCurrency(report.next_month_planning.recommended_budget)}</strong>.
          </p>
          <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
            <thead>
              <tr style="background: #f9fafb;">
                <th align="left" style="padding: 12px; font-size: 12px; color: #6b7280;">Due date</th>
                <th align="left" style="padding: 12px; font-size: 12px; color: #6b7280;">Payment</th>
                <th align="left" style="padding: 12px; font-size: 12px; color: #6b7280;">Category</th>
                <th align="right" style="padding: 12px; font-size: 12px; color: #6b7280;">Amount</th>
              </tr>
            </thead>
            <tbody>${dueRows}</tbody>
          </table>

          <h2 style="font-size: 20px; margin: 24px 0 12px;">Investment snapshot</h2>
          <p style="line-height: 1.7; color: #374151; margin: 0;">
            You have <strong>${report.investment_summary.count}</strong> investment records. Current value is
            <strong>${formatCurrency(report.investment_summary.current_value)}</strong> against total invested
            <strong>${formatCurrency(report.investment_summary.total_invested)}</strong>. Monthly SIP commitment is
            <strong>${formatCurrency(report.investment_summary.monthly_commitment)}</strong>.
          </p>

          <div style="margin-top: 28px; padding: 16px; background: #eff6ff; border-radius: 12px; color: #1e3a8a;">
            <strong>Next action:</strong> Review the due payments table, keep aside your recurring amount early, and watch categories that crossed 25% of your monthly expense.
          </div>

          <p style="margin: 28px 0 0; color: #6b7280; font-size: 13px;">This report is generated from your Finovo transactions, recurring payments, profile targets, and investment records.</p>
        </div>
      </div>
    </div>
  `;
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

    return "Brevo failed to send the email. Check BREVO_API_KEY, BREVO_FROM_EMAIL, sender verification, and the provider response.";
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

  return "Failed to send email. Check Render logs for the Email error details from Gmail/Nodemailer.";
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

const sendAppEmail = async (mail: { to: string; subject: string; html: string }) => {
  if (!BREVO_API_KEY && (!EMAIL_USER || !EMAIL_PASS)) {
    logger.error("Email is not configured");
    return { status: 500, body: { error: "Email service is not configured" } };
  }

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
        transporter.sendMail({
          from: `"Finovo AI" <${EMAIL_USER}>`,
          ...mail,
        }),
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

const sendOtpEmail = async (email: string, otp: string, purpose: "registration" | "password-reset" = "registration") => {
  const label = purpose === "registration" ? "Email Verification OTP" : "Password Reset OTP";

  return sendAppEmail({
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
  });
};

const upsertMonthlyReportLog = async (
  userId: number,
  reportMonth: string,
  deliveryEmail: string,
  status: "sent" | "failed" | "skipped",
  errorMessage: string | null = null
) => {
  await execute(`
    INSERT INTO monthly_report_logs (user_id, report_month, delivery_email, status, error_message)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      status = VALUES(status),
      error_message = VALUES(error_message),
      sent_at = CURRENT_TIMESTAMP
  `, [userId, reportMonth, deliveryEmail, status, errorMessage]);
};

const sendMonthlyReportEmail = async (userId: number, month = getPreviousMonthString(), options: { force?: boolean } = {}) => {
  const report: any = await buildMonthlyReport(userId, month);
  if (report.error) {
    return { status: 400, body: { error: report.error } };
  }

  const preferences = await getMonthlyReportPreferences(userId);
  const deliveryEmail = report.user.email;

  if (!preferences.email_enabled && !options.force) {
    await upsertMonthlyReportLog(userId, month, deliveryEmail, "skipped", "Monthly report email is disabled");
    return { status: 200, body: { message: "Monthly report email is disabled", status: "skipped", report } };
  }

  const existingLog: any = await queryOne(`
    SELECT id, status
    FROM monthly_report_logs
    WHERE user_id = ? AND report_month = ? AND delivery_email = ? AND status = 'sent'
    LIMIT 1
  `, [userId, month, deliveryEmail]);

  if (existingLog && !options.force) {
    return { status: 200, body: { message: "Monthly report was already sent", status: "skipped", report } };
  }

  const emailResult = await sendAppEmail({
    to: deliveryEmail,
    subject: `Your Finovo monthly financial report - ${report.month_label}`,
    html: buildMonthlyReportEmailHtml(report),
  });

  if (emailResult.status >= 400) {
    const errorMessage = String((emailResult.body as any)?.error || "Monthly report email failed");
    await upsertMonthlyReportLog(userId, month, deliveryEmail, "failed", errorMessage);
    return { status: emailResult.status, body: { ...emailResult.body, status: "failed", report } };
  }

  await upsertMonthlyReportLog(userId, month, deliveryEmail, "sent");
  return {
    status: 200,
    body: {
      message: "Monthly report sent successfully",
      status: "sent",
      delivery_email: deliveryEmail,
      report,
    },
  };
};

const getReportScheduleIntervalDays = (preferences: MonthlyReportPreferences) => {
  if (preferences.report_frequency === "daily") return 1;
  if (preferences.report_frequency === "weekly") return 7;
  if (preferences.report_frequency === "custom") return preferences.custom_interval_days;
  return null;
};

const isMonthlyReportDueToday = async (userId: number, preferences: MonthlyReportPreferences, now = new Date()) => {
  if (!preferences.email_enabled) return false;

  if (preferences.report_frequency === "monthly") {
    return now.getDate() >= preferences.send_day_of_month;
  }

  const intervalDays = getReportScheduleIntervalDays(preferences);
  if (!intervalDays) return false;

  const lastSent: any = await queryOne(`
    SELECT sent_at
    FROM monthly_report_logs
    WHERE user_id = ? AND status = 'sent'
    ORDER BY sent_at DESC
    LIMIT 1
  `, [userId]);

  if (!lastSent?.sent_at) return true;

  const lastSentAt = new Date(lastSent.sent_at);
  const elapsedMs = now.getTime() - lastSentAt.getTime();
  return elapsedMs >= intervalDays * 24 * 60 * 60 * 1000;
};

// --- Auth Routes ---
app.post("/api/auth/register", authRateLimiters.register, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password, name } = req.body;

  if (!email || !isNonEmptyString(password) || !isNonEmptyString(name)) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }

  if (!validatePasswordPolicy(String(password))) {
    return res.status(400).json({ error: PASSWORD_POLICY_ERROR });
  }

  try {
    const existingUser = await queryOne("SELECT id FROM users WHERE email = ?", [email]);
    if (existingUser) {
      return res.status(409).json({ error: "Unable to create account with the provided details" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await hashOtp(otp);
    const expiresAt = Date.now() + 5 * 60 * 1000;

    await execute(`
      INSERT INTO pending_registrations (email, password, name, otp, attempt_count, expires_at, created_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
      ON DUPLICATE KEY UPDATE
        password = VALUES(password),
        name = VALUES(name),
        otp = VALUES(otp),
        attempt_count = 0,
        expires_at = VALUES(expires_at),
        created_at = VALUES(created_at)
    `, [email, hashedPassword, name.trim(), otpHash, expiresAt, Date.now()]);

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
    res.status(400).json({ error: "Unable to create account with the provided details" });
  }
});

app.post("/api/auth/register/verify-otp", authRateLimiters.otpVerify, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const otp = String(req.body.otp || "").trim();

  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP are required" });
  }

  try {
    const pending: any = await queryOne(`
      SELECT * FROM pending_registrations
      WHERE email = ? AND expires_at > ?
    `, [email, Date.now()]);

    if (!pending || Number(pending.attempt_count) >= MAX_OTP_ATTEMPTS) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    const isValidOtp = await verifyOtpHash(otp, pending.otp);
    if (!isValidOtp) {
      const attempts = Number(pending.attempt_count || 0) + 1;
      if (attempts >= MAX_OTP_ATTEMPTS) {
        await execute("DELETE FROM pending_registrations WHERE email = ?", [email]);
      } else {
        await execute("UPDATE pending_registrations SET attempt_count = ? WHERE email = ?", [attempts, email]);
      }
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    const existingUser = await queryOne("SELECT id FROM users WHERE email = ?", [email]);
    if (existingUser) {
      await execute("DELETE FROM pending_registrations WHERE email = ?", [email]);
      return res.status(409).json({ error: "Unable to verify registration" });
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
    }, res));
  } catch (e) {
    logger.error("Register OTP verification error", { error: e });
    res.status(500).json({ error: "Failed to verify registration OTP" });
  }
});

app.post("/api/auth/forgot-password", authRateLimiters.forgotPassword, async (req, res) => {
  const email = normalizeEmail(req.body.email);

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const user = await queryOne("SELECT id FROM users WHERE email = ?", [email]);
    if (!user) {
      return res.json({ message: GENERIC_RESET_MESSAGE });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await hashOtp(otp);
    const expiresAt = Date.now() + 5 * 60 * 1000;

    await execute(`
      INSERT INTO password_resets (email, otp, attempt_count, expires_at, created_at)
      VALUES (?, ?, 0, ?, ?)
      ON DUPLICATE KEY UPDATE
        otp = VALUES(otp),
        attempt_count = 0,
        expires_at = VALUES(expires_at),
        created_at = VALUES(created_at)
    `, [email, otpHash, expiresAt, Date.now()]);

    const otpResult = await sendOtpEmail(email, otp, "password-reset");
    if (otpResult.status >= 400) {
      return res.status(otpResult.status).json(otpResult.body);
    }
    res.json({ message: GENERIC_RESET_MESSAGE });
  } catch (e) {
    logger.error("Forgot password error", { error: e });
    res.status(500).json({ error: "Failed to process password reset request" });
  }
});

app.post("/api/auth/reset-password", authRateLimiters.resetPassword, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const otp = String(req.body.otp || "").trim();
  const password = String(req.body.password || "");

  if (!email || !otp || !password) {
    return res.status(400).json({ error: "Email, OTP, and new password are required" });
  }

  if (!validatePasswordPolicy(password)) {
    return res.status(400).json({ error: PASSWORD_POLICY_ERROR });
  }

  try {
    const resetRecord: any = await queryOne(`
      SELECT * FROM password_resets
      WHERE email = ? AND expires_at > ?
    `, [email, Date.now()]);

    if (!resetRecord || Number(resetRecord.attempt_count) >= MAX_OTP_ATTEMPTS) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    const isValidOtp = await verifyOtpHash(otp, resetRecord.otp);
    if (!isValidOtp) {
      const attempts = Number(resetRecord.attempt_count || 0) + 1;
      if (attempts >= MAX_OTP_ATTEMPTS) {
        await execute("DELETE FROM password_resets WHERE email = ?", [email]);
      } else {
        await execute("UPDATE password_resets SET attempt_count = ? WHERE email = ?", [attempts, email]);
      }
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await execute(`
      UPDATE users
      SET password = ?, password_enabled = TRUE, failed_login_attempts = 0, locked_until = NULL
      WHERE email = ?
    `, [hashedPassword, email]);
    await execute("DELETE FROM password_resets WHERE email = ?", [email]);

    if (!result.affectedRows) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
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
    SELECT email, attempt_count, expires_at, created_at
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
    otp_available: false,
    attempt_count: Number(otpRecord.attempt_count || 0),
    expires_at: otpRecord.expires_at,
    expires_in_seconds: Math.max(0, Math.ceil((otpRecord.expires_at - now) / 1000)),
    is_expired: isExpired,
    created_at: otpRecord.created_at,
  });
});

app.post("/api/auth/verify-otp", async (req, res) => {
  res.status(410).json({ error: "OTP login is disabled. Please login with email and password." });
});

app.post("/api/auth/google", authRateLimiters.google, async (req, res) => {
  const credential = String(req.body.credential || "");

  if (!credential) {
    return res.status(400).json({ error: "Google credential is required" });
  }

  try {
    res.json(await authenticateGoogleCredential(credential, res));
  } catch (error: any) {
    logger.error("Google auth error", { message: error?.message });
    res.status(error?.status || 500).json({ error: error?.message || "Failed to sign in with Google" });
  }
});

app.post("/api/auth/google/redirect", authRateLimiters.google, async (req, res) => {
  const credential = String(req.body.credential || "");
  const frontendOrigin = process.env.FRONTEND_URL || allowedOrigins[0] || `${req.protocol}://${req.get("host")}`;
  const redirectUrl = new URL("/auth", frontendOrigin);

  try {
    if (!credential) {
      throw Object.assign(new Error("Google credential is required"), { status: 400 });
    }

    const session = await authenticateGoogleCredential(credential, res);
    redirectUrl.hash = new URLSearchParams({
      google_auth: encodeBase64UrlJson(session),
    }).toString();
  } catch (error: any) {
    logger.error("Google redirect auth error", { message: error?.message });
    redirectUrl.hash = new URLSearchParams({
      google_auth_error: error?.message || "Failed to sign in with Google",
    }).toString();
  }

  res.redirect(303, redirectUrl.toString());
});

app.post("/api/auth/login", authRateLimiters.login, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const user: any = await queryOne("SELECT * FROM users WHERE email = ?", [email]);
    if (!user) {
      await bcrypt.compare(password, "$2b$10$CwTycUXWue0Thq9StjUM0uJ8Q4aHj2zBgVeq9DXtjLrG6xXWgUG1e");
      return res.status(401).json({ error: GENERIC_AUTH_ERROR });
    }

    if (user.locked_until && Number(user.locked_until) > Date.now()) {
      return res.status(401).json({ error: GENERIC_AUTH_ERROR });
    }

    const isValidPassword = Boolean(user.password_enabled) && await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      const attempts = Number(user.failed_login_attempts || 0) + 1;
      const lockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOGIN_LOCKOUT_MS : null;
      await execute(
        "UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?",
        [attempts, lockedUntil, user.id]
      );
      return res.status(401).json({ error: GENERIC_AUTH_ERROR });
    }

    await execute("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?", [user.id]);
    res.json(createAuthResponse(user, res));
  } catch (error) {
    logger.error("Login error", { error });
    res.status(500).json({ error: "Failed to login" });
  }
});

app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
  const user: any = await queryOne("SELECT id, email, name, daily_threshold FROM users WHERE id = ?", [req.user.id]);
  if (!user) return res.sendStatus(401);
  res.json({ user });
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions());
  res.json({ message: "Logged out successfully" });
});

// --- Wallet Routes ---
app.get("/api/wallets", authenticateToken, async (req: any, res) => {
  await ensurePersonalWallet(req.user.id);
  const wallets = await queryAll(`
    SELECT
      wallets.id,
      wallets.name,
      wallets.type,
      wallets.owner_user_id,
      wallets.monthly_expense_target,
      wallet_members.role,
      COUNT(all_members.user_id) AS member_count
    FROM wallets
    JOIN wallet_members ON wallet_members.wallet_id = wallets.id
    LEFT JOIN wallet_members all_members ON all_members.wallet_id = wallets.id
    WHERE wallet_members.user_id = ?
    GROUP BY wallets.id, wallets.name, wallets.type, wallets.owner_user_id, wallets.monthly_expense_target, wallet_members.role
    ORDER BY wallets.type = 'personal' DESC, wallets.created_at ASC, wallets.name ASC
  `, [req.user.id]);

  res.json(wallets);
});

app.post("/api/wallets", authenticateToken, async (req: any, res) => {
  const name = isNonEmptyString(req.body?.name) ? req.body.name.trim() : "";
  const monthlyExpenseTarget = req.body?.monthly_expense_target === undefined || req.body?.monthly_expense_target === ""
    ? null
    : toNumber(req.body.monthly_expense_target);

  if (!name || name.length > 255) {
    return res.status(400).json({ error: "Wallet name is required and must be 255 characters or fewer" });
  }

  if (monthlyExpenseTarget !== null && monthlyExpenseTarget < 0) {
    return res.status(400).json({ error: "Monthly budget must be zero or greater" });
  }

  const info = await execute(
    "INSERT INTO wallets (name, type, owner_user_id, monthly_expense_target) VALUES (?, 'family', ?, ?)",
    [name, req.user.id, monthlyExpenseTarget]
  );
  await execute(
    "INSERT INTO wallet_members (wallet_id, user_id, role) VALUES (?, ?, 'owner')",
    [info.insertId, req.user.id]
  );

  const wallet = await getWalletMembership(info.insertId, req.user.id);
  res.status(201).json(wallet);
});

app.get("/api/wallets/:walletId/members", authenticateToken, async (req: any, res) => {
  const walletId = toPositiveInteger(req.params.walletId);
  if (!walletId) return res.status(400).json({ error: "A valid wallet id is required" });

  const membership = await getWalletMembership(walletId, req.user.id);
  if (!membership) return res.status(403).json({ error: "You do not have access to this wallet" });

  const members = await queryAll(`
    SELECT users.id, users.name, users.email, wallet_members.role, wallet_members.created_at
    FROM wallet_members
    JOIN users ON users.id = wallet_members.user_id
    WHERE wallet_members.wallet_id = ?
    ORDER BY wallet_members.role = 'owner' DESC, users.name ASC, users.email ASC
  `, [walletId]);

  res.json(members);
});

app.post("/api/wallets/:walletId/members", authenticateToken, async (req: any, res) => {
  const walletId = toPositiveInteger(req.params.walletId);
  if (!walletId) return res.status(400).json({ error: "A valid wallet id is required" });

  const membership: any = await getWalletMembership(walletId, req.user.id);
  if (!membership) return res.status(403).json({ error: "You do not have access to this wallet" });
  if (membership.type !== "family") return res.status(400).json({ error: "Members can only be added to family wallets" });
  if (membership.role !== "owner") return res.status(403).json({ error: "Only the owner can add family wallet members" });

  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: "Registered member email is required" });

  const member: any = await queryOne("SELECT id FROM users WHERE email = ?", [email]);
  if (!member) return res.status(404).json({ error: "No registered user found with this email" });

  await execute(
    "INSERT IGNORE INTO wallet_members (wallet_id, user_id, role) VALUES (?, ?, 'member')",
    [walletId, member.id]
  );

  const members = await queryAll(`
    SELECT users.id, users.name, users.email, wallet_members.role, wallet_members.created_at
    FROM wallet_members
    JOIN users ON users.id = wallet_members.user_id
    WHERE wallet_members.wallet_id = ?
    ORDER BY wallet_members.role = 'owner' DESC, users.name ASC, users.email ASC
  `, [walletId]);
  res.status(201).json({ members });
});

app.delete("/api/wallets/:walletId/members/:userId", authenticateToken, async (req: any, res) => {
  const walletId = toPositiveInteger(req.params.walletId);
  const memberUserId = toPositiveInteger(req.params.userId);
  if (!walletId || !memberUserId) return res.status(400).json({ error: "Valid wallet and user ids are required" });

  const membership: any = await getWalletMembership(walletId, req.user.id);
  if (!membership) return res.status(403).json({ error: "You do not have access to this wallet" });
  if (membership.role !== "owner") return res.status(403).json({ error: "Only the owner can remove members" });
  if (memberUserId === Number(membership.owner_user_id)) return res.status(400).json({ error: "The wallet owner cannot be removed" });

  const info = await execute("DELETE FROM wallet_members WHERE wallet_id = ? AND user_id = ?", [walletId, memberUserId]);
  if (!info.affectedRows) return res.status(404).json({ error: "Wallet member not found" });
  res.json({ message: "Member removed" });
});

app.patch("/api/wallets/:walletId/budget", authenticateToken, async (req: any, res) => {
  const walletId = toPositiveInteger(req.params.walletId);
  if (!walletId) return res.status(400).json({ error: "A valid wallet id is required" });

  const membership: any = await getWalletMembership(walletId, req.user.id);
  if (!membership) return res.status(403).json({ error: "You do not have access to this wallet" });
  if (membership.role !== "owner") return res.status(403).json({ error: "Only the owner can update the wallet budget" });

  const monthlyExpenseTarget = req.body?.monthly_expense_target === undefined || req.body?.monthly_expense_target === ""
    ? null
    : toNumber(req.body.monthly_expense_target);
  if (monthlyExpenseTarget !== null && monthlyExpenseTarget < 0) {
    return res.status(400).json({ error: "Monthly budget must be zero or greater" });
  }

  await execute("UPDATE wallets SET monthly_expense_target = ? WHERE id = ?", [monthlyExpenseTarget, walletId]);
  const wallet = await getWalletMembership(walletId, req.user.id);
  res.json(wallet);
});

// --- Transaction Routes ---
app.get("/api/merchant-aliases", authenticateToken, async (req: any, res) => {
  res.json(await getMerchantAliases(req.user.id));
});

app.post("/api/merchant-aliases", authenticateToken, async (req: any, res) => {
  const result = await upsertMerchantAlias(req.user.id, req.body?.vpa, req.body?.company_name);
  res.status(result.status).json(result.body);
});

app.patch("/api/merchant-aliases/:id", authenticateToken, async (req: any, res) => {
  const id = toPositiveInteger(req.params.id);
  const companyName = normalizeCompanyName(req.body?.company_name);
  if (!id) return res.status(400).json({ error: "A valid merchant alias id is required" });
  if (!companyName) return res.status(400).json({ error: "Company name is required and must be 255 characters or fewer" });

  const alias: any = await queryOne("SELECT * FROM merchant_aliases WHERE id = ? AND user_id = ?", [id, req.user.id]);
  if (!alias) return res.status(404).json({ error: "Merchant alias not found" });
  const result = await upsertMerchantAlias(req.user.id, alias.vpa, companyName);
  res.json(result.body);
});

app.delete("/api/merchant-aliases/:id", authenticateToken, async (req: any, res) => {
  const id = toPositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ error: "A valid merchant alias id is required" });
  const result = await execute("DELETE FROM merchant_aliases WHERE id = ? AND user_id = ?", [id, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ error: "Merchant alias not found" });
  res.json({ message: "Merchant alias deleted" });
});

app.get("/api/transactions", authenticateToken, async (req: any, res) => {
  const filters = await getTransactionFilters(req.query, req.user.id);
  if ("error" in filters) {
    return res.status(filters.status || 400).json({ error: filters.error });
  }

  const limit = req.query.limit === undefined ? 100 : toPositiveInteger(req.query.limit);
  const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);

  if (!limit || !Number.isInteger(offset) || offset < 0) {
    return res.status(400).json({ error: "Limit must be positive and offset must be zero or greater" });
  }

  const transactions = await queryAll(`
    SELECT
      transactions.*,
      users.name AS created_by_name,
      users.email AS created_by_email
    FROM transactions
    LEFT JOIN users ON users.id = transactions.created_by_user_id
    WHERE ${filters.where}
    ORDER BY transactions.date DESC, transactions.id DESC
    LIMIT ${limit} OFFSET ${offset}
  `, filters.params);

  res.json(transactions);
});

app.post("/api/transactions", authenticateToken, async (req: any, res) => {
  const resolved = await resolveWalletIdForUser(req.user.id, req.body?.wallet_id);
  if ("status" in resolved) {
    return res.status(resolved.status).json(resolved.body);
  }

  const result = await createTransaction(req.user.id, req.body, resolved.walletId);
  res.status(result.status).json(result.body);
});

app.post("/api/transactions/extract", authenticateToken, async (req: any, res) => {
  const description = isNonEmptyString(req.body?.description) ? req.body.description.trim() : "";

  if (description.length < 6) {
    return res.status(400).json({ error: "Enter a transaction description to extract" });
  }

  if (description.length > 1000) {
    return res.status(400).json({ error: "Transaction description must be 1000 characters or fewer" });
  }

  if (!/\d/.test(description)) {
    return res.status(400).json({
      error: "Add more transaction details, especially the amount. Example: Spent 1200 on shopping today using UPI.",
    });
  }

  try {
    const transaction = await extractTransactionFromTextWithGemini(description);
    res.json({ transaction });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("AI transaction extraction failed", { error: message });
    res.status(502).json({
      error: "Could not extract transaction details. Try manual add.",
      detail: message,
    });
  }
});

app.get("/api/transactions/summary", authenticateToken, async (req: any, res) => {
  const filters = await getTransactionFilters(req.query, req.user.id);
  if ("error" in filters) {
    return res.status(filters.status || 400).json({ error: filters.error });
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
  const filters = await getTransactionFilters(req.query, req.user.id);
  if ("error" in filters) {
    return res.status(filters.status || 400).json({ error: filters.error });
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

  const existing = await findTransactionById(id, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: "Transaction not found" });
  }

  const info = await execute("DELETE FROM transactions WHERE id = ?", [id]);
  if (info.affectedRows === 0) {
    return res.status(404).json({ error: "Transaction not found" });
  }

  res.json({ message: "Transaction deleted successfully", id });
});

// --- User Settings ---
app.get("/api/user/profile", authenticateToken, async (req: any, res) => {
  const profile = await getUserProfile(req.user.id);
  if (!profile) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(profile);
});

app.put("/api/user/profile", authenticateToken, async (req: any, res) => {
  const validated = validateProfileInput(req.body);
  if ("error" in validated) {
    return res.status(400).json({ error: validated.error });
  }

  const profile = validated.data;
  await execute("UPDATE users SET name = ? WHERE id = ?", [profile.name, req.user.id]);
  await execute(`
    INSERT INTO user_profiles (
      user_id,
      date_of_birth,
      occupation,
      city,
      country,
      monthly_income,
      monthly_expense_target,
      emergency_fund_target,
      risk_appetite,
      investment_goal,
      financial_dependents,
      preferred_currency,
      ai_personalization_enabled,
      profile_context_version
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON DUPLICATE KEY UPDATE
      date_of_birth = VALUES(date_of_birth),
      occupation = VALUES(occupation),
      city = VALUES(city),
      country = VALUES(country),
      monthly_income = VALUES(monthly_income),
      monthly_expense_target = VALUES(monthly_expense_target),
      emergency_fund_target = VALUES(emergency_fund_target),
      risk_appetite = VALUES(risk_appetite),
      investment_goal = VALUES(investment_goal),
      financial_dependents = VALUES(financial_dependents),
      preferred_currency = VALUES(preferred_currency),
      ai_personalization_enabled = VALUES(ai_personalization_enabled),
      profile_context_version = profile_context_version + 1
  `, [
    req.user.id,
    profile.date_of_birth,
    profile.occupation,
    profile.city,
    profile.country,
    profile.monthly_income,
    profile.monthly_expense_target,
    profile.emergency_fund_target,
    profile.risk_appetite,
    profile.investment_goal,
    profile.financial_dependents,
    profile.preferred_currency,
    profile.ai_personalization_enabled,
  ]);

  const updatedProfile = await getUserProfile(req.user.id);
  res.json(updatedProfile);
});

app.patch("/api/user/profile/ai-personalization", authenticateToken, async (req: any, res) => {
  const enabled = Boolean(req.body?.enabled);
  await execute(`
    INSERT INTO user_profiles (user_id, ai_personalization_enabled)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE
      ai_personalization_enabled = VALUES(ai_personalization_enabled),
      profile_context_version = profile_context_version + 1
  `, [req.user.id, enabled]);

  const updatedProfile = await getUserProfile(req.user.id);
  res.json(updatedProfile);
});

app.get("/api/user/monthly-report/preferences", authenticateToken, async (req: any, res) => {
  const preferences = await getMonthlyReportPreferences(req.user.id);
  res.json(preferences);
});

app.put("/api/user/monthly-report/preferences", authenticateToken, async (req: any, res) => {
  const validated = validateMonthlyReportPreferences(req.body);
  if ("error" in validated) {
    return res.status(400).json({ error: validated.error });
  }

  const preferences = validated.data;
  await execute(`
    INSERT INTO monthly_report_preferences (
      user_id,
      email_enabled,
      report_frequency,
      custom_interval_days,
      send_day_of_month,
      include_ai_summary,
      include_next_month_planning,
      delivery_email
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      email_enabled = VALUES(email_enabled),
      report_frequency = VALUES(report_frequency),
      custom_interval_days = VALUES(custom_interval_days),
      send_day_of_month = VALUES(send_day_of_month),
      include_ai_summary = VALUES(include_ai_summary),
      include_next_month_planning = VALUES(include_next_month_planning),
      delivery_email = VALUES(delivery_email)
  `, [
    req.user.id,
    preferences.email_enabled,
    preferences.report_frequency,
    preferences.custom_interval_days,
    preferences.send_day_of_month,
    preferences.include_ai_summary,
    preferences.include_next_month_planning,
    preferences.delivery_email,
  ]);

  res.json(await getMonthlyReportPreferences(req.user.id));
});

app.get("/api/reports/monthly", authenticateToken, async (req: any, res) => {
  const month = isNonEmptyString(req.query.month) ? req.query.month.trim() : getPreviousMonthString();
  const report: any = await buildMonthlyReport(req.user.id, month);
  if (report.error) {
    return res.status(400).json({ error: report.error });
  }

  res.json(report);
});

app.post("/api/reports/monthly/send", authenticateToken, async (req: any, res) => {
  const month = isNonEmptyString(req.body?.month) ? req.body.month.trim() : getPreviousMonthString();
  const result = await sendMonthlyReportEmail(req.user.id, month, { force: Boolean(req.body?.force) });
  res.status(result.status).json(result.body);
});

app.post("/api/admin/monthly-reports/send", async (req, res) => {
  const expectedSecret = process.env.MONTHLY_REPORT_CRON_SECRET || "";
  const authorization = String(req.headers.authorization || "");
  const providedSecret = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : String(req.headers["x-cron-secret"] || "");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return res.status(401).json({ error: "Invalid monthly report cron secret" });
  }

  const month = isNonEmptyString(req.body?.month) ? req.body.month.trim() : getPreviousMonthString();
  if (!getMonthStartEnd(month)) {
    return res.status(400).json({ error: "Month must use YYYY-MM format" });
  }

  const users = await queryAll(`
    SELECT
      users.id,
      monthly_report_preferences.email_enabled,
      monthly_report_preferences.report_frequency,
      monthly_report_preferences.custom_interval_days,
      monthly_report_preferences.send_day_of_month,
      monthly_report_preferences.include_ai_summary,
      monthly_report_preferences.include_next_month_planning,
      monthly_report_preferences.delivery_email
    FROM users
    LEFT JOIN monthly_report_preferences ON monthly_report_preferences.user_id = users.id
    WHERE COALESCE(monthly_report_preferences.email_enabled, TRUE) = TRUE
  `);

  const results = [];
  for (const user of users as any[]) {
    const preferences: MonthlyReportPreferences = {
      ...getDefaultMonthlyReportPreferences(),
      email_enabled: user.email_enabled === null || user.email_enabled === undefined ? true : Boolean(user.email_enabled),
      report_frequency: ["daily", "weekly", "monthly", "custom"].includes(String(user.report_frequency))
        ? String(user.report_frequency) as MonthlyReportPreferences["report_frequency"]
        : "monthly",
      custom_interval_days: Number(user.custom_interval_days) || 30,
      send_day_of_month: Number(user.send_day_of_month) || 1,
      include_ai_summary: user.include_ai_summary === null || user.include_ai_summary === undefined
        ? false
        : Boolean(user.include_ai_summary),
      include_next_month_planning: user.include_next_month_planning === null || user.include_next_month_planning === undefined
        ? true
        : Boolean(user.include_next_month_planning),
      delivery_email: user.delivery_email || null,
    };
    const isDue = await isMonthlyReportDueToday(Number(user.id), preferences);

    if (!isDue && !Boolean(req.body?.force)) {
      results.push({
        user_id: Number(user.id),
        status: "skipped",
        http_status: 200,
        message: "Report schedule is not due",
      });
      continue;
    }

    const shouldForceSend = Boolean(req.body?.force) || preferences.report_frequency !== "monthly";
    const result = await sendMonthlyReportEmail(Number(user.id), month, { force: shouldForceSend });
    results.push({
      user_id: Number(user.id),
      status: (result.body as any)?.status || (result.status >= 400 ? "failed" : "sent"),
      http_status: result.status,
      message: (result.body as any)?.message || (result.body as any)?.error || null,
    });
  }

  res.json({
    month,
    processed: results.length,
    sent: results.filter((result) => result.status === "sent").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  });
});

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

// --- Mutual Fund SIP Investments ---
app.post("/api/investments", authenticateToken, async (req: any, res) => {
  const validated = validateInvestmentInput(req.body);
  if ("error" in validated) {
    return res.status(400).json({ error: validated.error });
  }

  const investment = validated.data;
  try {
    const info = await execute(`
      INSERT INTO mutual_fund_sip_investments (
        user_id, investment_type, sip_name, fund_name, monthly_sip_amount, total_invested_amount,
        current_value, expected_cagr, start_date, end_date, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.user.id,
      investment.investment_type,
      investment.sip_name,
      investment.fund_name,
      investment.monthly_sip_amount,
      investment.total_invested_amount,
      investment.current_value,
      investment.expected_cagr,
      investment.start_date,
      investment.end_date,
      investment.notes,
    ]);

    const created: any = await queryOne(
      "SELECT * FROM mutual_fund_sip_investments WHERE id = ? AND user_id = ?",
      [info.insertId, req.user.id]
    );
    res.status(201).json(withInvestmentProjection(created));
  } catch (error) {
    logger.error("Create investment error", { error, userId: req.user.id });
    res.status(500).json({ error: "Failed to create investment" });
  }
});

app.get("/api/investments", authenticateToken, async (req: any, res) => {
  try {
    const investments = await queryAll(`
      SELECT *
      FROM mutual_fund_sip_investments
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
    `, [req.user.id]);
    res.json(investments.map(withInvestmentProjection));
  } catch (error) {
    logger.error("List investments error", { error, userId: req.user.id });
    res.status(500).json({ error: "Failed to load investments" });
  }
});

app.get("/api/investments/summary", authenticateToken, async (req: any, res) => {
  try {
    const investments = await queryAll(`
      SELECT *
      FROM mutual_fund_sip_investments
      WHERE user_id = ?
    `, [req.user.id]);

    const summary = investments.reduce((totals, investment: any) => {
      const investmentType = investment.investment_type === "lumpsum" ? "lumpsum" : "sip";
      const projection = getInvestmentProjection(investment);
      if (investmentType === "lumpsum") {
        totals.lumpsum_count += 1;
        totals.total_lumpsum_amount += Number(investment.total_invested_amount);
      } else {
        totals.sip_count += 1;
        totals.total_monthly_sip += Number(investment.monthly_sip_amount);
      }
      totals.total_invested_amount += Number(investment.total_invested_amount);
      totals.current_value += Number(investment.current_value);
      totals.projected_future_value += projection.future_value;
      totals.estimated_capital_gain += projection.estimated_capital_gain;
      return totals;
    }, {
      sip_count: 0,
      lumpsum_count: 0,
      total_monthly_sip: 0,
      total_lumpsum_amount: 0,
      total_invested_amount: 0,
      current_value: 0,
      projected_future_value: 0,
      estimated_capital_gain: 0,
    });

    res.json({
      investment_count: investments.length,
      sip_count: summary.sip_count,
      lumpsum_count: summary.lumpsum_count,
      total_monthly_sip: Number(summary.total_monthly_sip.toFixed(2)),
      total_lumpsum_amount: Number(summary.total_lumpsum_amount.toFixed(2)),
      total_invested_amount: Number(summary.total_invested_amount.toFixed(2)),
      current_value: Number(summary.current_value.toFixed(2)),
      current_capital_gain: Number((summary.current_value - summary.total_invested_amount).toFixed(2)),
      projected_future_value: Number(summary.projected_future_value.toFixed(2)),
      estimated_capital_gain: Number(summary.estimated_capital_gain.toFixed(2)),
    });
  } catch (error) {
    logger.error("Investment summary error", { error, userId: req.user.id });
    res.status(500).json({ error: "Failed to load investment summary" });
  }
});

app.get("/api/investments/:id", authenticateToken, async (req: any, res) => {
  const id = toPositiveInteger(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Valid investment id is required" });
  }

  try {
    const investment: any = await queryOne(
      "SELECT * FROM mutual_fund_sip_investments WHERE id = ? AND user_id = ?",
      [id, req.user.id]
    );
    if (!investment) {
      return res.status(404).json({ error: "Investment not found" });
    }
    res.json(withInvestmentProjection(investment));
  } catch (error) {
    logger.error("Get investment error", { error, userId: req.user.id, investmentId: id });
    res.status(500).json({ error: "Failed to load investment" });
  }
});

app.put("/api/investments/:id", authenticateToken, async (req: any, res) => {
  const id = toPositiveInteger(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Valid investment id is required" });
  }

  const validated = validateInvestmentInput(req.body);
  if ("error" in validated) {
    return res.status(400).json({ error: validated.error });
  }

  const investment = validated.data;
  try {
    const info = await execute(`
      UPDATE mutual_fund_sip_investments
      SET investment_type = ?, sip_name = ?, fund_name = ?, monthly_sip_amount = ?, total_invested_amount = ?,
          current_value = ?, expected_cagr = ?, start_date = ?, end_date = ?, notes = ?
      WHERE id = ? AND user_id = ?
    `, [
      investment.investment_type,
      investment.sip_name,
      investment.fund_name,
      investment.monthly_sip_amount,
      investment.total_invested_amount,
      investment.current_value,
      investment.expected_cagr,
      investment.start_date,
      investment.end_date,
      investment.notes,
      id,
      req.user.id,
    ]);

    if (!info.affectedRows) {
      return res.status(404).json({ error: "Investment not found" });
    }

    const updated: any = await queryOne(
      "SELECT * FROM mutual_fund_sip_investments WHERE id = ? AND user_id = ?",
      [id, req.user.id]
    );
    res.json(withInvestmentProjection(updated));
  } catch (error) {
    logger.error("Update investment error", { error, userId: req.user.id, investmentId: id });
    res.status(500).json({ error: "Failed to update investment" });
  }
});

app.delete("/api/investments/:id", authenticateToken, async (req: any, res) => {
  const id = toPositiveInteger(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Valid investment id is required" });
  }

  try {
    const info = await execute(
      "DELETE FROM mutual_fund_sip_investments WHERE id = ? AND user_id = ?",
      [id, req.user.id]
    );
    if (!info.affectedRows) {
      return res.status(404).json({ error: "Investment not found" });
    }
    res.json({ message: "Investment deleted successfully", id });
  } catch (error) {
    logger.error("Delete investment error", { error, userId: req.user.id, investmentId: id });
    res.status(500).json({ error: "Failed to delete investment" });
  }
});

// --- AI Wealth Advisor ---
app.get("/api/ai-advisor/sessions", authenticateToken, async (req: any, res) => {
  try {
    const sessions = await queryAll(`
      SELECT s.session_id, s.title, s.created_at, s.updated_at, COUNT(m.id) AS message_count
      FROM ai_advisor_sessions s
      LEFT JOIN ai_advisor_messages m
        ON m.user_id = s.user_id AND m.session_id = s.session_id
      WHERE s.user_id = ?
      GROUP BY s.id
      ORDER BY s.updated_at DESC, s.id DESC
    `, [req.user.id]);
    res.json(sessions);
  } catch (error) {
    logger.error("Advisor sessions load error", { error, userId: req.user.id });
    res.status(500).json({ error: "Failed to load advisor chats" });
  }
});

app.post("/api/ai-advisor/sessions", authenticateToken, async (req: any, res) => {
  const sessionId = crypto.randomUUID();
  const title = isNonEmptyString(req.body?.title) ? compactAdvisorTitle(req.body.title) : "New Chat";

  try {
    await execute(
      "INSERT INTO ai_advisor_sessions (user_id, session_id, title) VALUES (?, ?, ?)",
      [req.user.id, sessionId, title]
    );
    res.status(201).json({ session_id: sessionId, title, message_count: 0 });
  } catch (error) {
    logger.error("Advisor session create error", { error, userId: req.user.id });
    res.status(500).json({ error: "Failed to create advisor chat" });
  }
});

app.delete("/api/ai-advisor/sessions/:sessionId", authenticateToken, async (req: any, res) => {
  const sessionId = isNonEmptyString(req.params?.sessionId) ? String(req.params.sessionId).slice(0, 64) : "";
  if (!sessionId) return res.status(400).json({ error: "Valid session id is required" });

  try {
    await execute("DELETE FROM ai_advisor_messages WHERE user_id = ? AND session_id = ?", [req.user.id, sessionId]);
    await execute("DELETE FROM ai_advisor_sessions WHERE user_id = ? AND session_id = ?", [req.user.id, sessionId]);
    res.json({ message: "Advisor chat deleted", sessionId });
  } catch (error) {
    logger.error("Advisor session delete error", { error, userId: req.user.id });
    res.status(500).json({ error: "Failed to delete advisor chat" });
  }
});

app.get("/api/ai-advisor/messages", authenticateToken, async (req: any, res) => {
  const sessionId = isNonEmptyString(req.query?.sessionId) ? String(req.query.sessionId).slice(0, 64) : "default";

  try {
    const messages = await queryAll(`
      SELECT id, session_id, role, content, created_at
      FROM ai_advisor_messages
      WHERE user_id = ? AND session_id = ?
      ORDER BY created_at ASC, id ASC
    `, [req.user.id, sessionId]);
    res.json(messages);
  } catch (error) {
    logger.error("Advisor messages load error", { error, userId: req.user.id });
    res.status(500).json({ error: "Failed to load advisor messages" });
  }
});

app.post("/api/ai-advisor/chat", authenticateToken, async (req: any, res) => {
  const message = isNonEmptyString(req.body?.message) ? req.body.message.trim() : "";
  const sessionId = isNonEmptyString(req.body?.sessionId) ? String(req.body.sessionId).slice(0, 64) : "default";

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: "Message must be 2000 characters or fewer" });
  }

  try {
    await ensureAdvisorSession(req.user.id, sessionId, message);
    const requestedTitle = getAdvisorRequestedTitle(message);
    if (requestedTitle) {
      await execute(
        "UPDATE ai_advisor_sessions SET title = ? WHERE user_id = ? AND session_id = ?",
        [requestedTitle, req.user.id, sessionId]
      );
    }
    await execute(
      "INSERT INTO ai_advisor_messages (user_id, session_id, role, content) VALUES (?, ?, 'user', ?)",
      [req.user.id, sessionId, message]
    );

    const history = await queryAll(`
      SELECT role, content, created_at
      FROM ai_advisor_messages
      WHERE user_id = ? AND session_id = ?
      ORDER BY created_at ASC, id ASC
      LIMIT 30
    `, [req.user.id, sessionId]);
    const { investments, summary } = await getAdvisorPortfolioContext(req.user.id);
    const advisor = requestedTitle
      ? { reply: `Done. I renamed this chat to "${requestedTitle}".`, provider: "local-fallback" }
      : await getWealthAdvisorReply(message, investments, summary, history);

    const info = await execute(
      "INSERT INTO ai_advisor_messages (user_id, session_id, role, content) VALUES (?, ?, 'assistant', ?)",
      [req.user.id, sessionId, advisor.reply]
    );

    res.json({
      message: {
        id: info.insertId,
        session_id: sessionId,
        role: "assistant",
        content: advisor.reply,
        created_at: new Date().toISOString(),
      },
      portfolio: summary,
      ...advisor,
    });
  } catch (error: any) {
    logger.error("Advisor chat error", { error, userId: req.user.id });
    res.status(502).json({
      error: "AI Wealth Advisor failed",
      detail: IS_PRODUCTION ? undefined : error.message,
    });
  }
});

app.delete("/api/ai-advisor/messages", authenticateToken, async (req: any, res) => {
  const sessionId = isNonEmptyString(req.query?.sessionId) ? String(req.query.sessionId).slice(0, 64) : "default";

  try {
    await execute("DELETE FROM ai_advisor_messages WHERE user_id = ? AND session_id = ?", [req.user.id, sessionId]);
    await execute("UPDATE ai_advisor_sessions SET title = 'New Chat' WHERE user_id = ? AND session_id = ?", [req.user.id, sessionId]);
    res.json({ message: "Advisor chat cleared", sessionId });
  } catch (error) {
    logger.error("Advisor messages clear error", { error, userId: req.user.id });
    res.status(500).json({ error: "Failed to clear advisor messages" });
  }
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
    const message = error instanceof Error ? error.message : String(error);
    if (/future/i.test(message)) {
      return res.status(400).json({ error: message });
    }

    logger.error("Gemini bill extraction error", { error: message });
    res.status(502).json({
      error: "Gemini bill extraction failed",
      detail: message,
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
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Gemini insights error", { error: message });
    res.status(502).json({
      error: "Gemini insights generation failed",
      detail: message,
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

    const extractedTransactions = await importStatementWithGemini(base64Data, mimeType);
    const transactions = await enrichStatementTransactionsWithAliases(req.user.id, extractedTransactions);
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

    const extractedTransactions = await importStatementWithGemini(base64Data, mimeType);
    const transactions = await enrichStatementTransactionsWithAliases(req.user.id, extractedTransactions);
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

  const resolved = await resolveWalletIdForUser(req.user.id, req.body?.wallet_id);
  if ("status" in resolved) {
    return res.status(resolved.status).json(resolved.body);
  }

  const { savedTransactions, skipped, duplicateStatement } = await saveStatementTransactions(req.user.id, transactions, {
    fileHash: statementHash,
    walletId: resolved.walletId,
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

  if (!validateUploadedFileSignature(req.file)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Uploaded file type could not be verified" });
  }

  const mimeType = req.file.mimetype || "";
  if (mimeType !== "application/pdf" && !mimeType.startsWith("image/")) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Unsupported file type. Please upload a PDF, JPG, JPEG, or PNG invoice." });
  }

  res.json(getLocalUploadResponse(req.file));
});

app.post("/api/ai/import-statement-file", authenticateToken, upload.single('file'), async (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded. Use form-data key 'file'." });
  }

  if (!validateUploadedFileSignature(req.file)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Uploaded statement file type could not be verified" });
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

    const extractedTransactions = await importStatementWithGemini(base64Data, mimeType);
    const transactions = await enrichStatementTransactionsWithAliases(req.user.id, extractedTransactions);

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

app.use("/api", (error: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("API error", { error });
  const status = error?.code === "LIMIT_FILE_SIZE" ? 413 : error?.status || 500;
  const safeMessage = status === 413
    ? "Uploaded file is too large"
    : IS_PRODUCTION
      ? "Request failed"
      : error?.message || "Request failed";
  res.status(status).json({ error: safeMessage });
});

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
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return;
        }

        if (path.basename(filePath) === "index.html") {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }));
    app.get('*', (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  const server = app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      logger.error(`Port ${PORT} is already in use. Stop the process using it or start Finovo with PORT=${PORT + 1} npm run dev.`);
      process.exit(1);
    }

    logger.error("Server failed to start", { error });
    process.exit(1);
  });
}

startServer();
