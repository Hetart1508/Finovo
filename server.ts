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
  AI_TEXT_PROVIDER_PRIORITY,
  allowedOrigins,
  BREVO_API_KEY,
  BREVO_FROM_EMAIL,
  BREVO_FROM_NAME,
  EMAIL_PASS,
  EMAIL_USER,
  GEMINI_API_BASE_URL,
  GEMINI_API_KEYS,
  GEMINI_FALLBACK_MODELS,
  GEMINI_MODEL,
  GOOGLE_CLIENT_ID,
  GOOGLE_MOBILE_CLIENT_IDS,
  GROQ_API_BASE_URL,
  GROQ_API_KEY,
  GROQ_FALLBACK_MODELS,
  GROQ_MODEL,
  GROQ_VISION_MODEL,
  HUGGINGFACE_API_BASE_URL,
  HUGGINGFACE_API_KEY,
  HUGGINGFACE_FALLBACK_MODELS,
  HUGGINGFACE_MODEL,
  HUGGINGFACE_VISION_MODEL,
  IS_PRODUCTION,
  JWT_SECRET,
  OPENROUTER_API_BASE_URL,
  OPENROUTER_API_KEY,
  OPENROUTER_APP_NAME,
  OPENROUTER_FALLBACK_MODELS,
  OPENROUTER_MODEL,
  OPENROUTER_VISION_MODEL,
  OPENROUTER_SITE_URL,
  SESSION_EXPIRES_IN,
} from "./server/config/env";
import { logger } from "./server/config/logger";
import { execute, queryAll, queryOne } from "./server/db/client";
import { runMigrations } from "./server/db/migrations";
import { authenticateToken } from "./server/middleware/auth";
import { requestLogger } from "./server/middleware/requestLogger";
import { getLocalUploadResponse, upload, validateUploadedFileSignature } from "./server/middleware/upload";
import {
  areTransactionIdentitiesSimilar,
  createTransactionFingerprint,
  normalizeTransactionIdentity,
} from "./server/services/transactionDedup";
import {
  createAiUsageGuard,
  getAiUsageDashboard,
  isGeminiAdmin,
  recordAiUsage,
  requireGeminiAdmin,
  shouldSkipGeminiForMonthlyLimit,
  updateAiUsageSettings,
} from "./server/services/aiUsage";

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
        ? ["'self'", "https://accounts.google.com", "https://www.googletagmanager.com"]
        : ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://accounts.google.com", "https://www.googletagmanager.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: IS_PRODUCTION
        ? [
            "'self'",
            "https://accounts.google.com",
            "https://oauth2.googleapis.com",
            "https://generativelanguage.googleapis.com",
            "https://api.brevo.com",
            "https://www.google-analytics.com",
            "https://analytics.google.com",
            "https://region1.google-analytics.com",
          ]
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
    ai: getAiConfigStatus(),
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

const getAiConfigStatus = () => ({
  provider: AI_PROVIDER,
  textProviderPriority: AI_TEXT_PROVIDER_PRIORITY,
  geminiConfigured: GEMINI_API_KEYS.length > 0,
  geminiKeyCount: GEMINI_API_KEYS.length,
  geminiModel: GEMINI_MODEL,
  geminiFallbackModels: GEMINI_FALLBACK_MODELS,
  geminiModelCount: Array.from(new Set([GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS])).length,
  groqConfigured: Boolean(GROQ_API_KEY),
  groqModel: GROQ_MODEL,
  groqFallbackModels: GROQ_FALLBACK_MODELS,
  groqVisionModel: GROQ_VISION_MODEL,
  openRouterConfigured: Boolean(OPENROUTER_API_KEY),
  openRouterModel: OPENROUTER_MODEL,
  openRouterFallbackModels: OPENROUTER_FALLBACK_MODELS,
  openRouterVisionModel: OPENROUTER_VISION_MODEL,
  huggingFaceConfigured: Boolean(HUGGINGFACE_API_KEY),
  huggingFaceModel: HUGGINGFACE_MODEL,
  huggingFaceFallbackModels: HUGGINGFACE_FALLBACK_MODELS,
  huggingFaceVisionModel: HUGGINGFACE_VISION_MODEL,
});

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
  source_type: "manual" | "statement" | "invoice" | "single_line";
  source_document_hash: string | null;
  source_reference: string | null;
  idempotency_key: string | null;
  dedupe_fingerprint: string | null;
  dedupe_key: string | null;
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

const getAdvisorCurrentContext = () => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(now);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";

  return {
    timezone: "Asia/Kolkata",
    locale: "en-IN",
    iso_utc: now.toISOString(),
    current_year: Number(getPart("year")),
    current_month: getPart("month"),
    current_day_of_month: Number(getPart("day")),
    current_weekday: getPart("weekday"),
    current_time: `${getPart("hour")}:${getPart("minute")} ${getPart("dayPeriod")}`.trim(),
    current_date_label: new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(now),
  };
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

const stripAiReasoning = (text: string) => {
  let sanitized = text
    .replace(/&lt;\s*(\/?)\s*(think|analysis|reasoning)\b[^&]*?&gt;/gi, "<$1$2>")
    .replace(/<(think|analysis|reasoning)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");

  // Handle malformed provider output with a missing opening or closing tag.
  sanitized = sanitized
    .replace(/^[\s\S]*?<\/(?:think|analysis|reasoning)\s*>/i, "")
    .replace(/<(?:think|analysis|reasoning)\b[^>]*>[\s\S]*$/i, "")
    .replace(/<\/?(?:think|analysis|reasoning)\b[^>]*>/gi, "");

  return sanitized.trim();
};

const extractJsonObject = (text: string) => {
  const withoutReasoning = stripAiReasoning(text)
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();

  const firstObjectIndex = withoutReasoning.indexOf("{");
  const firstArrayIndex = withoutReasoning.indexOf("[");
  const start = [firstObjectIndex, firstArrayIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0];
  if (start === undefined) return withoutReasoning || text;

  const opening = withoutReasoning[start];
  const closing = opening === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < withoutReasoning.length; index += 1) {
    const char = withoutReasoning[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === opening) depth += 1;
    if (char === closing) depth -= 1;
    if (depth === 0) return withoutReasoning.slice(start, index + 1);
  }

  return withoutReasoning.slice(start);
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

  return normalized.slice(0, 250);
};

const geminiKeyState = GEMINI_API_KEYS.map(() => ({ unavailableUntil: 0 }));
let activeGeminiKeyIndex = 0;

const getGeminiKeyIdentifier = (index: number, key: string) =>
  `Key ${index + 1} ••••${key.slice(-4).toUpperCase()}`;

const getOrderedGeminiKeyIndexes = () => {
  const now = Date.now();
  const indexes = GEMINI_API_KEYS.map((_, index) => index);
  const ordered = indexes.slice(activeGeminiKeyIndex).concat(indexes.slice(0, activeGeminiKeyIndex));
  const available = ordered.filter((index) => geminiKeyState[index].unavailableUntil <= now);
  return available.length ? available : ordered;
};

const generateGemini = async (
  parts: any[],
  options: {
    responseMimeType?: "application/json" | "text/plain";
    maxOutputTokens?: number;
    onModel?: (model: string) => void;
    totalTimeoutMs?: number;
    perAttemptTimeoutMs?: number;
    maxAttemptsPerModel?: number;
    validateResponse?: (text: string) => void;
  } = {}
) => {
  if (!GEMINI_API_KEYS.length) {
    throw new Error("No Gemini API key is configured");
  }

  const modelCandidates = Array.from(new Set([GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS]));
  let lastError = "";
  const deadline = Date.now() + (options.totalTimeoutMs || 120_000);
  const maxAttemptsPerModel = options.maxAttemptsPerModel || 2;
  const inputText = parts.map((part) => typeof part?.text === "string" ? part.text : "").join("\n");

  for (const keyIndex of getOrderedGeminiKeyIndexes()) {
    const apiKey = GEMINI_API_KEYS[keyIndex];
    const keyIdentifier = getGeminiKeyIdentifier(keyIndex, apiKey);
    let rotateKey = false;
    for (const model of modelCandidates) {
      for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt += 1) {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) throw new Error("Gemini request timed out before a model became available");

      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        Math.min(options.perAttemptTimeoutMs || 45_000, remainingMs)
      );
      let response: globalThis.Response;
      try {
        response = await fetch(
          `${GEMINI_API_BASE_URL}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ role: "user", parts }],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: options.maxOutputTokens || 1024,
                thinkingConfig: { thinkingBudget: 0 },
                ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
              },
            }),
          }
        );
      } catch (error: any) {
        lastError = error?.name === "AbortError"
          ? `Gemini request timed out using ${model}`
          : `Gemini request failed using ${model}: ${error?.message || String(error)}`;
        await recordAiUsage({ provider: "gemini", model, keyIdentifier, inputText, success: false, errorType: "unavailable" });
        if (attempt < maxAttemptsPerModel && Date.now() < deadline) {
          logger.warn("Gemini request failed, retrying model", { model, error: lastError });
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        geminiKeyState[keyIndex].unavailableUntil = Date.now() + 30_000;
        rotateKey = true;
        break;
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        const responseText = await response.text();
        lastError = `Gemini error using ${model}: ${response.status} ${responseText.slice(0, 1000)}`;
        const quotaOrRateLimit = response.status === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(responseText);
        await recordAiUsage({
          provider: "gemini", model, keyIdentifier, inputText, success: false,
          errorType: quotaOrRateLimit ? "quota_or_rate_limit" : `http_${response.status}`,
        });
        const dailyQuotaExhausted = response.status === 429 && (
          /GenerateRequestsPerDay|requests per day|free_tier_requests|current quota/i.test(responseText)
          || /RESOURCE_EXHAUSTED/i.test(responseText) && /quotaValue/i.test(responseText)
        );
        if (dailyQuotaExhausted) {
          const tomorrow = new Date();
          tomorrow.setUTCHours(24, 5, 0, 0);
          geminiKeyState[keyIndex].unavailableUntil = tomorrow.getTime();
          rotateKey = true;
          logger.warn("Gemini key quota exhausted, rotating to the next configured key", { model, keyIdentifier, status: response.status });
          break;
        }
        if ([429, 503].includes(response.status) && attempt < maxAttemptsPerModel && Date.now() < deadline) {
          logger.warn("Gemini model temporarily unavailable, retrying", { model, status: response.status });
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        if ([401, 403].includes(response.status) || response.status >= 500) {
          geminiKeyState[keyIndex].unavailableUntil = Date.now() + (response.status < 500 ? 60 * 60_000 : 60_000);
          rotateKey = true;
          logger.warn("Gemini key unavailable, rotating to the next configured key", { model, keyIdentifier, status: response.status });
          break;
        }
        if ([400, 404, 429].includes(response.status)) {
          logger.warn("Gemini model unavailable, trying fallback", { model, status: response.status });
          if (response.status === 429) {
            geminiKeyState[keyIndex].unavailableUntil = Date.now() + 60_000;
            rotateKey = true;
          }
          break;
        }
        throw new Error(lastError);
      }

      const data: any = await response.json();
      const text = stripAiReasoning(data.candidates?.[0]?.content?.parts
        ?.map((part: any) => part.text || "")
        .join("\n")
        .trim() || "");

      if (!text) {
        lastError = `Gemini returned an empty response using ${model}`;
        await recordAiUsage({ provider: "gemini", model, keyIdentifier, inputText, success: false, errorType: "empty_response" });
        break;
      }

      try {
        options.validateResponse?.(text);
      } catch (error: any) {
        lastError = `Gemini returned an invalid response using ${model}: ${error?.message || String(error)}`;
        await recordAiUsage({ provider: "gemini", model, keyIdentifier, inputText, outputText: text, success: false, errorType: "invalid_response" });
        if (attempt < maxAttemptsPerModel && Date.now() < deadline) {
          logger.warn("Gemini returned an invalid response, retrying model", { model, error: lastError });
          continue;
        }
        logger.warn("Gemini returned an invalid response, trying fallback model", { model, error: lastError });
        break;
      }

      const promptTokens = Number(data.usageMetadata?.promptTokenCount || 0);
      const totalTokens = Number(data.usageMetadata?.totalTokenCount || 0);
      const candidateTokens = Number(data.usageMetadata?.candidatesTokenCount || 0);
      await recordAiUsage({
        provider: "gemini",
        model,
        keyIdentifier,
        inputTokens: promptTokens || undefined,
        outputTokens: (totalTokens > promptTokens ? totalTokens - promptTokens : candidateTokens) || undefined,
        inputText,
        outputText: text,
        success: true,
      });
      activeGeminiKeyIndex = keyIndex;
      geminiKeyState[keyIndex].unavailableUntil = 0;
      options.onModel?.(model);
        return text;
      }
      if (rotateKey) break;
    }
    if (!rotateKey && Date.now() >= deadline) break;
  }

  throw new Error(lastError || "Gemini returned no usable response");
};

type TextAiProvider = "gemini" | "groq" | "openrouter" | "huggingface";
type TextAiResult = {
  text: string;
  provider: TextAiProvider;
  model: string;
};
type TextAiOptions = {
  responseMimeType?: "application/json" | "text/plain";
  maxOutputTokens?: number;
  validateResponse?: (text: string) => void;
};

const DEFAULT_TEXT_PROVIDER_PRIORITY: TextAiProvider[] = ["gemini", "groq", "openrouter", "huggingface"];
const RETRYABLE_AI_STATUS_CODES = new Set([400, 404, 408, 409, 429, 500, 502, 503, 504]);
const GROQ_TEXT_MAX_OUTPUT_TOKENS = 2048;
const GROQ_VISION_MAX_OUTPUT_TOKENS = 4096;
const isUsableOpenRouterApiKey = (key: string) => /^sk-or-[0-9A-Za-z_.-]+$/.test(key);
const isKnownUnsupportedHuggingFaceVisionModel = (model: string) =>
  model === "Qwen/Qwen2.5-VL-7B-Instruct";

const normalizeTextProvider = (provider: string): TextAiProvider | null => {
  const normalized = provider.toLowerCase().replace(/[-_\s]/g, "");
  if (normalized === "gemini" || normalized === "google") return "gemini";
  if (normalized === "groq") return "groq";
  if (normalized === "openrouter") return "openrouter";
  if (normalized === "huggingface" || normalized === "hf") return "huggingface";
  return null;
};

const getTextProviderPriority = () => {
  // Keep one project-wide hierarchy for every AI feature. Environment entries
  // may add aliases later, but cannot move a backup ahead of the primary.
  const ordered = [...DEFAULT_TEXT_PROVIDER_PRIORITY, ...AI_TEXT_PROVIDER_PRIORITY]
    .map(normalizeTextProvider)
    .filter((provider): provider is TextAiProvider => Boolean(provider));

  return Array.from(new Set(ordered));
};

const generateOpenAiCompatibleText = async (
  provider: Exclude<TextAiProvider, "gemini">,
  apiBaseUrl: string,
  apiKey: string,
  modelCandidates: string[],
  prompt: string,
  options: TextAiOptions = {},
  extraHeaders: Record<string, string> = {}
): Promise<TextAiResult> => {
  if (!apiKey) {
    throw new Error(`${provider} API key is not configured`);
  }

  let lastError = "";
  for (const model of Array.from(new Set(modelCandidates.filter(Boolean)))) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              options.responseMimeType === "application/json"
                ? "Return only valid JSON. Do not include markdown, code fences, comments, or extra text."
                : "You are Finovo's finance assistant. Be clear, practical, and concise.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        ...(provider === "groq" && /qwen\/qwen3\.6-27b/i.test(model)
          ? { reasoning_effort: "none", reasoning_format: "hidden" }
          : {}),
        max_tokens: provider === "groq"
          ? Math.min(options.maxOutputTokens || 1024, GROQ_TEXT_MAX_OUTPUT_TOKENS)
          : options.maxOutputTokens || 1024,
      }),
    });

    if (!response.ok) {
      lastError = `${provider} error using ${model}: ${response.status} ${await response.text()}`;
      await recordAiUsage({
        provider, model, inputText: prompt, success: false,
        errorType: response.status === 429 ? "quota_or_rate_limit" : `http_${response.status}`,
      });
      if (RETRYABLE_AI_STATUS_CODES.has(response.status)) {
        logger.warn("Text AI model unavailable, trying fallback model", { provider, model, status: response.status });
        continue;
      }
      throw new Error(lastError);
    }

    const data: any = await response.json();
    const text = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || "";
    const trimmed = stripAiReasoning(String(text));
    if (!trimmed) {
      lastError = `${provider} returned an empty response using ${model}`;
      await recordAiUsage({ provider, model, inputText: prompt, success: false, errorType: "empty_response" });
      continue;
    }

    await recordAiUsage({
      provider,
      model,
      inputTokens: Number(data.usage?.prompt_tokens || 0) || undefined,
      outputTokens: Number(data.usage?.completion_tokens || 0) || undefined,
      estimatedCostUsd: Number.isFinite(Number(data.usage?.cost)) ? Number(data.usage.cost) : undefined,
      inputText: prompt,
      outputText: trimmed,
      success: true,
    });
    return { text: trimmed, provider, model };
  }

  throw new Error(lastError || `${provider} returned no usable response`);
};

const generateAiText = async (
  prompt: string,
  options: TextAiOptions = {}
): Promise<TextAiResult> => {
  const configuredProviders = {
    gemini: GEMINI_API_KEYS.length > 0 && !shouldSkipGeminiForMonthlyLimit(),
    groq: Boolean(GROQ_API_KEY),
    openrouter: isUsableOpenRouterApiKey(OPENROUTER_API_KEY),
    huggingface: Boolean(HUGGINGFACE_API_KEY),
  };
  const providerPriority = getTextProviderPriority().filter((provider) => configuredProviders[provider]);
  let lastError = "";

  for (const provider of providerPriority) {
    try {
      if (provider === "gemini") {
        let model = GEMINI_MODEL;
        const text = await generateGemini([{ text: prompt }], {
          ...options,
          onModel: (usedModel) => {
            model = usedModel;
          },
        });
        options.validateResponse?.(text);
        return { text, provider, model };
      }

      if (provider === "groq") {
        const result = await generateOpenAiCompatibleText(
          "groq",
          GROQ_API_BASE_URL,
          GROQ_API_KEY,
          [GROQ_MODEL, ...GROQ_FALLBACK_MODELS],
          prompt,
          options
        );
        options.validateResponse?.(result.text);
        return result;
      }

      if (provider === "openrouter") {
        const result = await generateOpenAiCompatibleText(
          "openrouter",
          OPENROUTER_API_BASE_URL,
          OPENROUTER_API_KEY,
          [OPENROUTER_MODEL, ...OPENROUTER_FALLBACK_MODELS],
          prompt,
          options,
          {
            ...(OPENROUTER_SITE_URL ? { "HTTP-Referer": OPENROUTER_SITE_URL } : {}),
            "X-Title": OPENROUTER_APP_NAME,
          }
        );
        options.validateResponse?.(result.text);
        return result;
      }

      const result = await generateOpenAiCompatibleText(
        "huggingface",
        HUGGINGFACE_API_BASE_URL,
        HUGGINGFACE_API_KEY,
        [HUGGINGFACE_MODEL, ...HUGGINGFACE_FALLBACK_MODELS],
        prompt,
        options
      );
      options.validateResponse?.(result.text);
      return result;
    } catch (error: any) {
      lastError = error?.message || String(error);
      logger.warn("Text AI provider failed, trying next provider", { provider, error: lastError });
    }
  }

  const configuredNames = Object.entries(configuredProviders)
    .filter(([, configured]) => configured)
    .map(([provider]) => provider);
  throw new Error(
    configuredNames.length
      ? `All configured text AI providers failed. Last error: ${lastError}`
      : "No configured text AI provider. Set at least one of GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, or HUGGINGFACE_API_KEY."
  );
};

type VisionInput = { base64Data: string; mimeType: string };
type VisionAiResult = TextAiResult & { texts: string[] };

const generateOpenAiCompatibleVision = async (
  provider: Exclude<TextAiProvider, "gemini">,
  apiBaseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  images: VisionInput[],
  options: TextAiOptions,
  extraHeaders: Record<string, string> = {}
) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: `Return only valid JSON without markdown or code fences.\n\n${prompt}` },
            ...images.map((image) => ({
              type: "image_url",
              image_url: { url: `data:${image.mimeType};base64,${image.base64Data}` },
            })),
          ],
        }],
        temperature: 0.2,
        ...(provider === "groq" && /qwen\/qwen3\.6-27b/i.test(model)
          ? { reasoning_effort: "none", reasoning_format: "hidden" }
          : {}),
        max_tokens: provider === "groq"
          ? Math.min(options.maxOutputTokens || 1024, GROQ_VISION_MAX_OUTPUT_TOKENS)
          : options.maxOutputTokens || 1024,
      }),
    });
    if (!response.ok) {
      const responseText = await response.text();
      await recordAiUsage({
        provider, model, inputText: prompt, success: false,
        errorType: response.status === 429 ? "quota_or_rate_limit" : `http_${response.status}`,
      });
      throw new Error(`${provider} vision error using ${model}: ${response.status} ${responseText.slice(0, 1000)}`);
    }
    const data: any = await response.json();
    const text = stripAiReasoning(String(data.choices?.[0]?.message?.content || ""));
    if (!text) {
      await recordAiUsage({ provider, model, inputText: prompt, success: false, errorType: "empty_response" });
      throw new Error(`${provider} vision returned an empty response using ${model}`);
    }
    options.validateResponse?.(text);
    await recordAiUsage({
      provider,
      model,
      inputTokens: Number(data.usage?.prompt_tokens || 0) || undefined,
      outputTokens: Number(data.usage?.completion_tokens || 0) || undefined,
      estimatedCostUsd: Number.isFinite(Number(data.usage?.cost)) ? Number(data.usage.cost) : undefined,
      inputText: prompt,
      outputText: text,
      success: true,
    });
    return text;
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error(`${provider} vision request timed out using ${model}`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const generateAiVision = async (
  images: VisionInput[],
  prompt: string,
  options: TextAiOptions = {}
): Promise<VisionAiResult> => {
  const providers = getTextProviderPriority();
  let lastError = "";

  for (const provider of providers) {
    try {
      if (provider === "gemini" && GEMINI_API_KEYS.length && !shouldSkipGeminiForMonthlyLimit()) {
        let model = GEMINI_MODEL;
        const text = await generateGemini([
          ...images.map((image) => ({ inline_data: { mime_type: image.mimeType, data: image.base64Data } })),
          { text: prompt },
        ], {
          ...options,
          totalTimeoutMs: 30_000,
          perAttemptTimeoutMs: 30_000,
          maxAttemptsPerModel: 1,
          onModel: (usedModel) => { model = usedModel; },
        });
        return { texts: [text], text, provider, model };
      }

      const configuration = provider === "groq"
        ? { key: GROQ_API_KEY, baseUrl: GROQ_API_BASE_URL, model: GROQ_VISION_MODEL, headers: {} }
        : provider === "openrouter"
          ? {
              key: OPENROUTER_API_KEY,
              baseUrl: OPENROUTER_API_BASE_URL,
              model: OPENROUTER_VISION_MODEL,
              headers: {
                ...(OPENROUTER_SITE_URL ? { "HTTP-Referer": OPENROUTER_SITE_URL } : {}),
                "X-Title": OPENROUTER_APP_NAME,
              },
            }
          : { key: HUGGINGFACE_API_KEY, baseUrl: HUGGINGFACE_API_BASE_URL, model: HUGGINGFACE_VISION_MODEL, headers: {} };

      if (!configuration.key) continue;
      if (provider === "openrouter" && !isUsableOpenRouterApiKey(configuration.key)) {
        logger.warn("Skipping OpenRouter vision fallback because OPENROUTER_API_KEY is missing or invalid.");
        continue;
      }
      if (provider === "huggingface" && isKnownUnsupportedHuggingFaceVisionModel(configuration.model)) {
        logger.warn("Skipping Hugging Face vision fallback because the configured model is unsupported.", {
          model: configuration.model,
        });
        continue;
      }
      if (images.some((image) => image.mimeType === "application/pdf")) {
        throw new Error(`${provider} vision cannot read raw PDF statements. Use extracted PDF text, unlocked rendered pages, or configure Gemini vision for PDF input.`);
      }
      const imagesPerChunk = provider === "groq" ? 1 : 2;
      const chunks = Array.from(
        { length: Math.ceil(images.length / imagesPerChunk) },
        (_, index) => images.slice(index * imagesPerChunk, index * imagesPerChunk + imagesPerChunk)
      );
      const texts: string[] = [];
      for (const [index, chunk] of chunks.entries()) {
        texts.push(await generateOpenAiCompatibleVision(
          provider as Exclude<TextAiProvider, "gemini">,
          configuration.baseUrl,
          configuration.key,
          configuration.model,
          `${provider === "groq" ? "Do not include reasoning, <think> tags, explanations, markdown, or prose.\n\n" : ""}${prompt}\n\nThese are statement image batch ${index + 1} of ${chunks.length}. Extract only rows visible in this batch.`,
          chunk,
          options,
          configuration.headers
        ));
      }
      return { texts, text: texts.join("\n"), provider, model: configuration.model };
    } catch (error: any) {
      lastError = error?.message || String(error);
      logger.warn("Vision AI provider failed, trying next provider", { provider, error: lastError });
    }
  }

  throw new Error(lastError || "No configured vision AI provider returned a usable response");
};

const extractBillDataWithAi = async (base64Data: string, mimeType: string) => {
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

  const result = await generateAiVision(
    [{ base64Data, mimeType }],
    prompt,
    { responseMimeType: "application/json", maxOutputTokens: 1024, validateResponse: normalizeGeminiBillData }
  );

  return { ...normalizeGeminiBillData(result.text), provider: result.provider, model: result.model };
};

const extractTransactionFromTextWithAi = async (description: string) => {
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

  const result = await generateAiText(prompt, {
    responseMimeType: "application/json",
    maxOutputTokens: 600,
    validateResponse: (text) => {
      normalizeGeminiTextTransaction(text);
    },
  });

  return {
    transaction: normalizeGeminiTextTransaction(result.text),
    provider: result.provider,
    model: result.model,
  };
};

const getFinancialInsightsWithAi = async (
  transactions: any[],
  recurringEvents: any[] = [],
  profileContext: any = { personalization_enabled: false }
) => {
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
- Use the preferred currency from profile context when available; otherwise use INR formatting like ₹12,500.
- Use the user's previous transactions to identify category patterns, repeated payments, spikes, and unusual expenses.
- Use planned recurring payments to improve future expense predictions, including subscriptions, EMIs, rent, insurance, and yearly fees.
- Predict likely future expenses for the next 30 days and full year based on category totals, recurring payments, and recent spending pace.
- Give practical saving advice and future planning advice for an Indian user.
- Mention recurring commitments when they materially affect the forecast or action plan.
- When personalization_enabled is true, tailor advice to the user's income, family, location, currency, risk comfort, goals, investments, loans, and insurance context.
- When personalization_enabled is false, ignore profile context and base the report only on transactions and recurring payments.
- Investment guidance must be general education only. Do not recommend a specific stock, fund, crypto, or guaranteed return.
- Prefer clear bullet strings, one idea per bullet.
- Keep every bullet under 24 words.
- Do not use markdown, tables, code fences, or text outside JSON.

Transactions:
${JSON.stringify(transactions.slice(0, 60), null, 2)}

Planned recurring payments for the next 365 days:
${JSON.stringify(recurringEvents.slice(0, 80), null, 2)}

Optional profile context:
${JSON.stringify(profileContext)}`;

  const result = await generateAiText(prompt, {
    responseMimeType: "application/json",
    maxOutputTokens: 3000,
    validateResponse: (text) => {
      normalizeGeminiInsights(text);
    },
  });
  return {
    insights: normalizeGeminiInsights(result.text),
    provider: result.provider,
    model: result.model,
  };
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

const getAgeFromDateOfBirth = (dateOfBirth: string | null | undefined) => {
  if (!dateOfBirth) return null;
  const parsed = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  let age = today.getUTCFullYear() - parsed.getUTCFullYear();
  const birthdayThisYear = Date.UTC(today.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  if (Date.now() < birthdayThisYear) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
};

const getAdvisorProfileContext = async (userId: number) => {
  const profile = await getUserProfile(userId);
  const monthly_report_preferences = await getMonthlyReportPreferences(userId);

  if (!profile) {
    return {
      personalization_enabled: false,
      note: "No user profile was found.",
    };
  }

  if (!profile.ai_personalization_enabled) {
    return {
      personalization_enabled: false,
      note: "User profile personalization is disabled. No saved profile details are included.",
    };
  }

  return {
    personalization_enabled: true,
    note: "Full profile context is available for personalized finance answers.",
    derived: {
      age: getAgeFromDateOfBirth(profile.date_of_birth),
      location: [profile.city, profile.country].filter(Boolean).join(", ") || null,
    },
    full_profile: {
      id: Number(profile.id),
      email: profile.email || null,
      name: profile.name || null,
      daily_threshold: Number(profile.daily_threshold || 0),
      date_of_birth: profile.date_of_birth || null,
      occupation: profile.occupation || null,
      city: profile.city || null,
      country: profile.country || "India",
      monthly_income: profile.monthly_income === null ? null : Number(profile.monthly_income),
      monthly_expense_target: profile.monthly_expense_target === null ? null : Number(profile.monthly_expense_target),
      emergency_fund_target: profile.emergency_fund_target === null ? null : Number(profile.emergency_fund_target),
      risk_appetite: profile.risk_appetite || null,
      investment_goal: profile.investment_goal || null,
      savings_goal: profile.savings_goal || null,
      investment_preference: profile.investment_preference || null,
      retirement_goal: profile.retirement_goal || null,
      existing_investments: profile.existing_investments || null,
      loan_details: profile.loan_details || null,
      insurance_details: profile.insurance_details || null,
      additional_information: profile.additional_information || null,
      financial_dependents: profile.financial_dependents === null ? null : Number(profile.financial_dependents),
      preferred_currency: profile.preferred_currency || "INR",
      ai_personalization_enabled: Boolean(profile.ai_personalization_enabled),
      profile_context_version: Number(profile.profile_context_version || 1),
      profile_updated_at: profile.profile_updated_at || null,
    },
    monthly_report_preferences,
  };
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

const normalizeAdvisorTransactionDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  return null;
};

const roundMoney = (value: number) => Number(value.toFixed(2));

const getAdvisorTransactionContext = async (userId: number) => {
  const transactions = await queryAll(`
    SELECT
      transactions.id,
      transactions.wallet_id,
      wallets.name AS wallet_name,
      wallets.type AS wallet_type,
      transactions.type,
      transactions.date,
      transactions.category,
      transactions.payment_mode,
      transactions.amount,
      transactions.description,
      transactions.merchant_name,
      transactions.payee_vpa,
      transactions.source_type
    FROM transactions
    LEFT JOIN wallets ON wallets.id = transactions.wallet_id
    WHERE transactions.user_id = ?
    ORDER BY transactions.date DESC, transactions.id DESC
    LIMIT 1000
  `, [userId]);

  const categoryTotals = new Map<string, { income: number; expense: number; count: number }>();
  const paymentModeTotals = new Map<string, { income: number; expense: number; count: number }>();
  const monthlyTotals = new Map<string, { income: number; expense: number; count: number }>();
  const payeeTotals = new Map<string, { amount: number; count: number; last_date: string | null }>();
  const walletTotals = new Map<string, { income: number; expense: number; count: number }>();
  let totalIncome = 0;
  let totalExpense = 0;
  let firstDate: string | null = null;
  let lastDate: string | null = null;

  const bump = (map: Map<string, { income: number; expense: number; count: number }>, key: string, type: string, amount: number) => {
    const current = map.get(key) || { income: 0, expense: 0, count: 0 };
    if (type === "income") current.income += amount;
    if (type === "expense") current.expense += amount;
    current.count += 1;
    map.set(key, current);
  };

  for (const transaction of transactions as any[]) {
    const date = normalizeAdvisorTransactionDate(transaction.date);
    const amount = Number(transaction.amount || 0);
    const type = transaction.type === "income" ? "income" : "expense";
    if (!date || !Number.isFinite(amount) || amount <= 0) continue;

    if (!lastDate || date > lastDate) lastDate = date;
    if (!firstDate || date < firstDate) firstDate = date;
    if (type === "income") totalIncome += amount;
    if (type === "expense") totalExpense += amount;

    bump(categoryTotals, transaction.category || "Uncategorized", type, amount);
    bump(paymentModeTotals, transaction.payment_mode || "Unknown", type, amount);
    bump(monthlyTotals, date.slice(0, 7), type, amount);
    bump(walletTotals, transaction.wallet_name || "No wallet", type, amount);

    const payee = transaction.merchant_name || transaction.payee_vpa || transaction.description;
    if (type === "expense" && isNonEmptyString(payee)) {
      const key = payee.trim().slice(0, 120);
      const current = payeeTotals.get(key) || { amount: 0, count: 0, last_date: null };
      current.amount += amount;
      current.count += 1;
      current.last_date = !current.last_date || date > current.last_date ? date : current.last_date;
      payeeTotals.set(key, current);
    }
  }

  const toSortedBreakdown = (map: Map<string, { income: number; expense: number; count: number }>, sortBy: "expense" | "income" | "count", limit: number) =>
    Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        income: roundMoney(value.income),
        expense: roundMoney(value.expense),
        net: roundMoney(value.income - value.expense),
        count: value.count,
      }))
      .sort((first, second) => Number(second[sortBy]) - Number(first[sortBy]))
      .slice(0, limit);

  const recentTransactions = (transactions as any[]).slice(0, 60).map((transaction) => ({
    date: normalizeAdvisorTransactionDate(transaction.date),
    type: transaction.type,
    amount: Number(transaction.amount || 0),
    category: transaction.category || null,
    payment_mode: transaction.payment_mode || null,
    description: transaction.merchant_name || transaction.description || null,
    payee_vpa: transaction.payee_vpa || null,
    wallet: transaction.wallet_name || null,
    source_type: transaction.source_type || null,
  }));

  const recurringLikeExpenses = Array.from(payeeTotals.entries())
    .filter(([, value]) => value.count >= 2)
    .map(([name, value]) => ({
      name,
      count: value.count,
      total_expense: roundMoney(value.amount),
      average_amount: roundMoney(value.amount / value.count),
      last_date: value.last_date,
    }))
    .sort((first, second) => second.total_expense - first.total_expense)
    .slice(0, 20);

  return {
    note: "Use this transaction context for financial planning, affordability, budgeting, cash-flow, recurring expense, saving capacity, and spending-pattern questions.",
    summary: {
      transaction_count: transactions.length,
      date_range: { first: firstDate, last: lastDate },
      total_income: roundMoney(totalIncome),
      total_expense: roundMoney(totalExpense),
      net_cashflow: roundMoney(totalIncome - totalExpense),
      average_monthly_expense: monthlyTotals.size ? roundMoney(totalExpense / monthlyTotals.size) : 0,
      average_monthly_income: monthlyTotals.size ? roundMoney(totalIncome / monthlyTotals.size) : 0,
    },
    top_expense_categories: toSortedBreakdown(categoryTotals, "expense", 12),
    payment_mode_breakdown: toSortedBreakdown(paymentModeTotals, "count", 10),
    wallet_breakdown: toSortedBreakdown(walletTotals, "count", 10),
    monthly_trend: toSortedBreakdown(monthlyTotals, "count", 18).sort((first, second) => first.name.localeCompare(second.name)),
    recurring_like_expenses: recurringLikeExpenses,
    recent_transactions: recentTransactions,
  };
};

const getAdvisorSmallTalkReply = (message: string) => {
  const normalized = message
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/^(?:h+i+|h+e+l+o+|h+e+y+|helo|helli|greetings)(?: there)?$/.test(normalized)) {
    return "Hello! How can I help you with your finances today?";
  }
  if (/^(?:thanks|thank you|thankyou|thx)$/.test(normalized)) {
    return "You're welcome! What else can I help you with?";
  }
  if (/^(?:ok|okay|got it|understood|sure)$/.test(normalized)) {
    return "Got it! What would you like help with next?";
  }
  return null;
};

const getWealthAdvisorReply = async (
  message: string,
  investments: any[],
  summary: any,
  history: any[],
  profileContext: any,
  transactionContext: any
) => {
  const smallTalkReply = getAdvisorSmallTalkReply(message);
  if (smallTalkReply) return { reply: smallTalkReply, provider: "local-fallback" };

  if (!(GEMINI_API_KEYS.length || [GROQ_API_KEY, OPENROUTER_API_KEY, HUGGINGFACE_API_KEY].some(Boolean))) {
    return { reply: getAdvisorFallbackReply(message, investments, summary, history), provider: "local-fallback" };
  }

  const prompt = `You are Finovo AI Wealth Advisor for an Indian user. Use the user's profile, transactions, portfolio, and chat history to answer any investment, wealth, goal, SIP, retirement, budgeting, cash-flow, affordability, or money planning question.

Rules:
- If the user's latest message is only a greeting, thanks, acknowledgement, or small talk, reply in one short friendly line and ask how you can help. Do not mention profile, portfolio, goals, retirement, SIPs, calculations, or disclaimer for those messages.
- Use current_context for all relative time/date questions such as today, tomorrow, this week, this month, this year, age, and birthday weekday/date calculations.
- Use profile, transaction, and portfolio context only when the user asks a finance, investment, planning, budgeting, cash-flow, goal, or follow-up question that needs it.
- Ask focused follow-up questions when important data is missing.
- When enough data exists, give practical calculations, required SIP/lumpsum, feasibility, assumptions, and next steps.
- Personalize the reply using all relevant fields from full_profile, derived profile values, and monthly_report_preferences when personalization_enabled is true.
- Use transaction_context to infer spending pattern, savings capacity, recurring expenses, category leaks, income consistency, emergency-fund gap, and goal affordability.
- Do not list raw transactions unless the user asks. Summarize patterns and cite only the relevant recent transactions or categories.
- Do not repeat sensitive profile fields such as email, date of birth, or internal ids unless the user directly asks or it is clearly needed for the answer.
- If profile values conflict with the user's latest message, trust the latest message and mention the assumption.
- Adapt tone and risk suggestions to age, dependents, income, emergency fund target, risk appetite, and stated investment goal when present.
- Use the user's preferred currency when present; otherwise use INR formatting like ₹15,00,000.
- Do not recommend specific stocks, funds, crypto, or guaranteed returns.
- Match the answer length to the user's need: short questions can get short replies, but complex planning questions should get a clear explanation, calculations, assumptions, and next steps without an artificial character or word limit.
- Use readable sections or bullets when the answer is longer.
- End with a short disclaimer that this is planning guidance, not financial advice.

Current context:
${JSON.stringify(getAdvisorCurrentContext())}

Profile context:
${JSON.stringify(profileContext)}

Transaction context:
${JSON.stringify(transactionContext)}

Portfolio summary:
${JSON.stringify(summary)}

Investments:
${JSON.stringify(investments)}

Recent chat:
${JSON.stringify(history.slice(-8))}

User message:
${message}`;

  const result = await generateAiText(prompt, { responseMimeType: "text/plain", maxOutputTokens: 1800 });
  return { reply: result.text, provider: result.provider, model: result.model };
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

type RenderedStatementPage = {
  base64Data: string;
  mimeType: "image/jpeg";
};

const getRenderedStatementPages = (value: unknown): RenderedStatementPage[] | null => {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length === 0 || value.length > 25) return null;

  const pages = value.map((page) => ({
    base64Data: typeof page?.base64Data === "string" ? page.base64Data : "",
    mimeType: page?.mimeType,
  }));
  if (pages.some((page) => !page.base64Data || page.mimeType !== "image/jpeg")) return null;
  if (pages.reduce((total, page) => total + page.base64Data.length, 0) > 18 * 1024 * 1024) return null;
  return pages as RenderedStatementPage[];
};

const getStatementImportPrompt = () => {
  const today = new Date().toISOString().split("T")[0];
  return `Extract incoming and outgoing money transactions from this Indian bank, credit card, UPI, PhonePe, GPay, Paytm, or wallet statement.
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
- Return up to 250 rows in exact statement order.`;
};

const importStatementWithAi = async (
  base64Data: string,
  mimeType: string,
  renderedPages?: RenderedStatementPage[] | null
) => {
  const prompt = getStatementImportPrompt();

  const statementImages: VisionInput[] = renderedPages?.length
    ? renderedPages.map((page) => ({ base64Data: page.base64Data, mimeType: page.mimeType }))
    : [{ base64Data, mimeType }];

  const result = await generateAiVision(
    statementImages,
    prompt,
    {
      responseMimeType: "application/json",
      maxOutputTokens: 10000,
      validateResponse: (text) => {
        normalizeGeminiStatementTransactions(text);
      },
    }
  );

  return {
    transactions: result.texts.flatMap((text) => normalizeGeminiStatementTransactions(text)).slice(0, 250),
    provider: result.provider,
    model: result.model,
  };
};

const splitStatementTextForImport = (statementText: string) => {
  const pages = statementText.match(/--- Page \d+ ---\n[\s\S]*?(?=\n--- Page \d+ ---|$)/g);
  const maxPagesPerChunk = 1;
  const maxCharsPerChunk = 12_000;

  if (pages?.length) {
    const chunks: string[] = [];
    let currentPages: string[] = [];
    let currentLength = 0;

    for (const page of pages) {
      const nextLength = currentLength + page.length;
      if (currentPages.length && (currentPages.length >= maxPagesPerChunk || nextLength > maxCharsPerChunk)) {
        chunks.push(currentPages.join("\n"));
        currentPages = [];
        currentLength = 0;
      }
      currentPages.push(page);
      currentLength += page.length;
    }

    if (currentPages.length) chunks.push(currentPages.join("\n"));
    return chunks.length ? chunks : [statementText];
  }

  if (statementText.length <= maxCharsPerChunk) return [statementText];

  const chunks: string[] = [];
  for (let start = 0; start < statementText.length; start += maxCharsPerChunk) {
    chunks.push(statementText.slice(start, start + maxCharsPerChunk));
  }
  return chunks;
};

const importStatementTextChunk = async (statementText: string, index: number, totalChunks: number) => {
  const prompt = `${getStatementImportPrompt()}

The PDF text was extracted locally and is enclosed below. Use only this statement text batch.
Batch ${index + 1} of ${totalChunks}. Extract only rows visible in this batch.
<statement_text>
${statementText}
</statement_text>`;

  const result = await generateAiText(prompt, {
    responseMimeType: "application/json",
    maxOutputTokens: 10000,
    validateResponse: (text) => {
      normalizeGeminiStatementTransactions(text);
    },
  });

  return {
    transactions: normalizeGeminiStatementTransactions(result.text),
    provider: result.provider,
    model: result.model,
  };
};

const importStatementFromText = async (statementText: string) => {
  const chunks = splitStatementTextForImport(statementText);
  const transactions: GeminiStatementTransaction[] = [];
  let provider: TextAiProvider | null = null;
  let model = "";

  for (const [index, chunk] of chunks.entries()) {
    const result = await importStatementTextChunk(chunk, index, chunks.length);
    provider = provider || result.provider;
    model = model || result.model;
    transactions.push(...result.transactions);
    if (transactions.length >= 250) break;
  }

  return {
    transactions: transactions.slice(0, 250),
    provider: provider || "gemini",
    model: model || GEMINI_MODEL,
  };
};

const createAuthResponse = (user: any, res?: Response, includeAccessToken = false) => {
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
    ...(includeAccessToken ? { accessToken: token } : {}),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      daily_threshold: user.daily_threshold,
      gemini_admin: isGeminiAdmin(user.email),
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
  savings_goal: string | null;
  investment_preference: string | null;
  retirement_goal: string | null;
  existing_investments: string | null;
  loan_details: string | null;
  insurance_details: string | null;
  additional_information: string | null;
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
      savings_goal: normalizeOptionalText(body?.savings_goal, 2000),
      investment_preference: normalizeOptionalText(body?.investment_preference, 2000),
      retirement_goal: normalizeOptionalText(body?.retirement_goal, 2000),
      existing_investments: normalizeOptionalText(body?.existing_investments, 4000),
      loan_details: normalizeOptionalText(body?.loan_details, 4000),
      insurance_details: normalizeOptionalText(body?.insurance_details, 4000),
      additional_information: normalizeOptionalText(body?.additional_information, 4000),
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
      user_profiles.savings_goal,
      user_profiles.investment_preference,
      user_profiles.retirement_goal,
      user_profiles.existing_investments,
      user_profiles.loan_details,
      user_profiles.insurance_details,
      user_profiles.additional_information,
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

  const allowedClientIds = new Set([GOOGLE_CLIENT_ID, ...GOOGLE_MOBILE_CLIENT_IDS].filter(Boolean));
  if (!payload.aud || !allowedClientIds.has(payload.aud)) {
    throw Object.assign(new Error("Google token was issued for another client"), { status: 401 });
  }

  if (!payload.email || (payload.email_verified !== "true" && payload.email_verified !== true)) {
    throw Object.assign(new Error("Google account email is not verified"), { status: 401 });
  }

  return payload;
};

const authenticateGoogleCredential = async (credential: string, res?: Response, includeAccessToken = false) => {
  const googleUser = await verifyGoogleIdToken(credential);
  const email = normalizeEmail(googleUser.email);
  const name = isNonEmptyString(googleUser.name) ? googleUser.name.trim() : email.split("@")[0];

  let user: any = await queryOne("SELECT * FROM users WHERE email = ? AND deleted_at IS NULL", [email]);

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

  return createAuthResponse(user, res, includeAccessToken);
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
    source_type: (["manual", "statement", "invoice", "single_line"] as const).includes(body.source_type)
      ? body.source_type
      : "manual",
    source_document_hash: /^[a-f0-9]{64}$/i.test(String(body.source_document_hash || ""))
      ? String(body.source_document_hash).toLowerCase()
      : null,
    source_reference: isNonEmptyString(body.source_reference) ? body.source_reference.trim().slice(0, 255).toLowerCase() : null,
    idempotency_key: isNonEmptyString(body.idempotency_key) ? sha256(body.idempotency_key.trim().slice(0, 255)) : null,
    dedupe_fingerprint: null,
    dedupe_key: null,
  };

  return { transaction };
};

const extractTransactionReference = (...values: unknown[]) => {
  const text = values.filter(isNonEmptyString).join(" ");
  const match = text.match(/\b(?:utr|upi ref(?:erence)?|ref(?:erence)? no|transaction id)\b[\s:#-]*([a-z0-9-]{6,64})/i);
  return match?.[1]?.toLowerCase() || null;
};

const getTransactionIdentity = (transaction: Pick<NormalizedTransaction, "payee_vpa" | "merchant_name" | "description">) =>
  transaction.payee_vpa || normalizeTransactionIdentity(transaction.merchant_name) || normalizeTransactionIdentity(transaction.description);

const getTransactionDedupeFingerprint = (walletId: number, transaction: NormalizedTransaction) => createTransactionFingerprint({
  walletId,
  date: transaction.date,
  type: transaction.type,
  amount: transaction.amount,
  identity: getTransactionIdentity(transaction),
});

const getDuplicateTransaction = async (walletId: number, transaction: NormalizedTransaction) => {
  if (transaction.idempotency_key) {
    const exact = await queryOne("SELECT * FROM transactions WHERE wallet_id = ? AND idempotency_key = ? LIMIT 1", [walletId, transaction.idempotency_key]);
    if (exact) return { transaction: exact, confidence: "exact" };
  }
  if (transaction.source_reference) {
    const exact = await queryOne(
      "SELECT * FROM transactions WHERE wallet_id = ? AND source_reference = ? LIMIT 1",
      [walletId, transaction.source_reference]
    );
    if (exact) return { transaction: exact, confidence: "exact" };
  }
  if (transaction.source_document_hash && transaction.source_type === "invoice") {
    const exact = await queryOne(
      "SELECT * FROM transactions WHERE wallet_id = ? AND source_type = 'invoice' AND source_document_hash = ? LIMIT 1",
      [walletId, transaction.source_document_hash]
    );
    if (exact) return { transaction: exact, confidence: "exact" };
  }
  if (transaction.dedupe_fingerprint) {
    const probable = await queryOne(
      "SELECT * FROM transactions WHERE wallet_id = ? AND dedupe_fingerprint = ? LIMIT 1",
      [walletId, transaction.dedupe_fingerprint]
    );
    if (probable) return { transaction: probable, confidence: "probable" };
  }

  // Also protects against duplicates of rows created before fingerprints were introduced.
  const legacyCandidates: any[] = await queryAll(
    "SELECT * FROM transactions WHERE wallet_id = ? AND date = ? AND type = ? AND amount = ? LIMIT 25",
    [walletId, transaction.date, transaction.type, transaction.amount]
  );
  const merchantIdentity = getTransactionIdentity(transaction);
  const legacy = legacyCandidates.find((candidate) => {
    const candidateIdentity = candidate.payee_vpa
      || normalizeTransactionIdentity(candidate.merchant_name)
      || normalizeTransactionIdentity(candidate.description);
    return merchantIdentity && areTransactionIdentitiesSimilar(merchantIdentity, candidateIdentity);
  });
  return legacy ? { transaction: legacy, confidence: "probable" } : null;
};

const duplicateTransactionResult = (duplicate: { transaction: any; confidence: string }) => ({
  status: 409,
  body: {
    error: duplicate.confidence === "exact" ? "This transaction was already submitted" : "A matching transaction already exists",
    duplicate: true,
    confidence: duplicate.confidence,
    requiresConfirmation: duplicate.confidence !== "exact",
    existingTransactionId: duplicate.transaction.id,
    existingTransaction: duplicate.transaction,
  },
});

const createTransaction = async (userId: number, body: any, walletId?: number) => {
  const normalized = normalizeTransactionBody(body);

  if ("status" in normalized) {
    return normalized;
  }

  const resolvedWalletId = walletId ?? await ensurePersonalWallet(userId);
  normalized.transaction.source_reference ||= extractTransactionReference(normalized.transaction.description);
  normalized.transaction.dedupe_fingerprint = getTransactionDedupeFingerprint(resolvedWalletId, normalized.transaction);
  const duplicate = await getDuplicateTransaction(resolvedWalletId, normalized.transaction);
  if (duplicate && (duplicate.confidence === "exact" || body.allowPossibleDuplicate !== true)) {
    return duplicateTransactionResult(duplicate);
  }
  normalized.transaction.dedupe_key = body.allowPossibleDuplicate === true
    ? sha256(`${normalized.transaction.dedupe_fingerprint}:${crypto.randomUUID()}`)
    : normalized.transaction.dedupe_fingerprint;
  try {
    return await insertTransaction(userId, normalized.transaction, resolvedWalletId);
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      const racedDuplicate = await getDuplicateTransaction(resolvedWalletId, normalized.transaction);
      if (racedDuplicate) return duplicateTransactionResult(racedDuplicate);
    }
    throw error;
  }
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
      , source_type
      , source_document_hash
      , source_reference
      , idempotency_key
      , dedupe_fingerprint
      , dedupe_key
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    transaction.source_type,
    transaction.source_document_hash,
    transaction.source_reference,
    transaction.idempotency_key,
    transaction.dedupe_fingerprint,
    transaction.dedupe_key,
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
      source_type: "statement",
      source_reference: extractTransactionReference(transaction.original_description, transaction.description),
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

    normalized.transaction.dedupe_fingerprint = getTransactionDedupeFingerprint(walletId, normalized.transaction);
    // Row identity prevents re-inserting the same statement row, while the canonical
    // fingerprint still detects that row when it appears in another statement file.
    normalized.transaction.dedupe_key = normalized.transaction.import_fingerprint || normalized.transaction.dedupe_fingerprint;

    const key = normalized.transaction.import_fingerprint || getStatementTransactionKey(normalized.transaction);
    const duplicateMatch = seenStatementRows.has(key) ? null : await getDuplicateTransaction(walletId, normalized.transaction);
    const sameStatementDifferentRow = duplicateMatch?.transaction?.source_statement_hash === sourceStatementHash
      && duplicateMatch.transaction.import_fingerprint !== normalized.transaction.import_fingerprint;
    const existing = seenStatementRows.has(key)
      ? { id: null }
      : (!sameStatementDifferentRow ? duplicateMatch?.transaction : null)
        || await findDuplicateStatementTransaction(walletId, normalized.transaction);

    if (existing) {
      skipped.push({
        transaction,
        error: "Duplicate statement transaction already exists",
      });
      continue;
    }

    let result;
    try {
      result = await insertTransaction(userId, normalized.transaction, walletId);
    } catch (error: any) {
      if (error?.code === "ER_DUP_ENTRY") {
        skipped.push({ transaction, error: "Duplicate statement transaction already exists" });
        continue;
      }
      throw error;
    }
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
    }, res, req.get("X-Finovo-Client") === "mobile"));
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
    res.json(await authenticateGoogleCredential(
      credential,
      res,
      req.get("X-Finovo-Client") === "mobile"
    ));
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
    const user: any = await queryOne("SELECT * FROM users WHERE email = ? AND deleted_at IS NULL", [email]);
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
    res.json(createAuthResponse(user, res, req.get("X-Finovo-Client") === "mobile"));
  } catch (error) {
    logger.error("Login error", { error });
    res.status(500).json({ error: "Failed to login" });
  }
});

app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
  const user: any = await queryOne("SELECT id, email, name, daily_threshold FROM users WHERE id = ? AND deleted_at IS NULL", [req.user.id]);
  if (!user) return res.sendStatus(401);
  res.json({ user: { ...user, gemini_admin: isGeminiAdmin(user.email) } });
});

app.get("/api/admin/ai-usage", authenticateToken, requireGeminiAdmin, async (_req: any, res) => {
  try {
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "Surrogate-Control": "no-store",
    });
    res.json(await getAiUsageDashboard());
  } catch (error) {
    logger.error("AI usage dashboard load failed", { error });
    res.status(500).json({ error: "Failed to load AI usage statistics" });
  }
});

app.put("/api/admin/ai-usage/settings", authenticateToken, requireGeminiAdmin, async (req: any, res) => {
  try {
    res.json(await updateAiUsageSettings(req.user.id, req.body));
  } catch (error: any) {
    res.status(400).json({ error: error?.message || "Invalid AI usage settings" });
  }
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

app.post("/api/transactions/extract", authenticateToken, createAiUsageGuard("transaction_extraction"), async (req: any, res) => {
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
    const data = await extractTransactionFromTextWithAi(description);
    res.json(data);
  } catch (error: any) {
    logger.error("AI transaction extraction failed", { error: error?.message });
    res.status(502).json({ error: "Could not extract transaction details. Try manual add." });
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
      savings_goal,
      investment_preference,
      retirement_goal,
      existing_investments,
      loan_details,
      insurance_details,
      additional_information,
      financial_dependents,
      preferred_currency,
      ai_personalization_enabled,
      profile_context_version
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
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
      savings_goal = VALUES(savings_goal),
      investment_preference = VALUES(investment_preference),
      retirement_goal = VALUES(retirement_goal),
      existing_investments = VALUES(existing_investments),
      loan_details = VALUES(loan_details),
      insurance_details = VALUES(insurance_details),
      additional_information = VALUES(additional_information),
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
    profile.savings_goal,
    profile.investment_preference,
    profile.retirement_goal,
    profile.existing_investments,
    profile.loan_details,
    profile.insurance_details,
    profile.additional_information,
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

app.delete("/api/user/account", authenticateToken, async (req: any, res) => {
  const user: any = await queryOne("SELECT id, email FROM users WHERE id = ? AND deleted_at IS NULL", [req.user.id]);
  if (!user) return res.status(404).json({ error: "User not found" });

  const archivedEmail = `deleted+${user.id}+${Date.now()}@deleted.finovo.local`;
  await execute(`
    UPDATE users
    SET
      deleted_at = CURRENT_TIMESTAMP,
      deleted_email = email,
      email = ?,
      failed_login_attempts = 0,
      locked_until = NULL
    WHERE id = ? AND deleted_at IS NULL
  `, [archivedEmail, user.id]);

  res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions());
  res.json({ message: "Account deleted. Please register again to use Finovo." });
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
    res.json(messages.map((message: any) => message.role === "assistant"
      ? { ...message, content: stripAiReasoning(String(message.content || "")) }
      : message));
  } catch (error) {
    logger.error("Advisor messages load error", { error, userId: req.user.id });
    res.status(500).json({ error: "Failed to load advisor messages" });
  }
});

app.post("/api/ai-advisor/chat", authenticateToken, createAiUsageGuard("wealth_advisor"), async (req: any, res) => {
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
    const safeHistory = history.map((item: any) => item.role === "assistant"
      ? { ...item, content: stripAiReasoning(String(item.content || "")) }
      : item);
    const [{ investments, summary }, profileContext, transactionContext] = await Promise.all([
      getAdvisorPortfolioContext(req.user.id),
      getAdvisorProfileContext(req.user.id),
      getAdvisorTransactionContext(req.user.id),
    ]);
    const advisor = requestedTitle
      ? { reply: `Done. I renamed this chat to "${requestedTitle}".`, provider: "local-fallback" }
      : await getWealthAdvisorReply(message, investments, summary, safeHistory, profileContext, transactionContext);

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
      profile: profileContext,
      transactions: transactionContext,
      ...advisor,
    });
  } catch (error: any) {
    logger.error("Advisor chat error", { error, userId: req.user.id });
    res.status(502).json({
      error: "AI Wealth Advisor failed",
      detail: IS_PRODUCTION ? undefined : error.message,
      hint: getGeminiImportHint(error.message || String(error)),
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

// --- AI Routes (Gemini multimodal, configurable text provider fallback chain) ---
app.post("/api/ai/extract-bill", authenticateToken, createAiUsageGuard("smart_bill_fetching"), async (req: any, res) => {
  const { base64Data, mimeType } = req.body || {};

  if (!isNonEmptyString(base64Data) || !isNonEmptyString(mimeType)) {
    return res.status(400).json({ error: "base64Data and mimeType are required" });
  }

  if (mimeType !== "application/pdf" && !mimeType.startsWith("image/")) {
    return res.status(400).json({ error: "Unsupported file type. Please upload a PDF, JPG, JPEG, or PNG invoice." });
  }

  try {
    const data = await extractBillDataWithAi(base64Data, mimeType);
    res.json(data);
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    if (/future/i.test(message)) {
      return res.status(400).json({ error: message });
    }

    logger.error("AI bill extraction error", { error });
    res.status(502).json({
      error: "AI bill extraction failed",
      detail: IS_PRODUCTION ? undefined : message,
      hint: getGeminiImportHint(message),
    });
  }
});

app.post("/api/ai/insights", authenticateToken, createAiUsageGuard("ai_insights"), async (req: any, res) => {
  const transactions = Array.isArray(req.body?.transactions) ? req.body.transactions : null;
  const recurringEvents = Array.isArray(req.body?.recurringEvents) ? req.body.recurringEvents : [];

  if (!transactions) {
    return res.status(400).json({ error: "transactions must be an array" });
  }

  try {
    const profileContext = await getAdvisorProfileContext(req.user.id);
    const data = await getFinancialInsightsWithAi(transactions, recurringEvents, profileContext);
    res.json({ ...data.insights, provider: data.provider, model: data.model });
  } catch (error: any) {
    logger.error("AI insights error", { error });
    res.status(502).json({
      error: "AI insights generation failed",
      detail: IS_PRODUCTION ? undefined : error.message,
      hint: getGeminiImportHint(error.message || String(error)),
    });
  }
});

app.post("/api/ai/import-statement", authenticateToken, createAiUsageGuard("statement_import"), async (req: any, res) => {
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

    const aiResult = await importStatementWithAi(base64Data, mimeType);
    const transactions = await enrichStatementTransactionsWithAliases(req.user.id, aiResult.transactions);
    res.json({
      transactions,
      statementHash,
      alreadyImported,
      savedCount: 0,
      skippedCount: 0,
      pendingApproval: true,
      provider: aiResult.provider,
      model: aiResult.model,
    });
  } catch (error: any) {
    logger.error("AI statement import error", { error });
    const message = error instanceof Error ? error.message : String(error);
    res.status(502).json({
      error: "AI statement import failed",
      detail: IS_PRODUCTION ? undefined : message,
      hint: getGeminiImportHint(message),
      model: GEMINI_MODEL,
    });
  }
});

app.post("/api/statement-import/preview-stream", authenticateToken, createAiUsageGuard("statement_import"), async (req: any, res) => {
  const { base64Data, mimeType, renderedPages: renderedPagesValue, extractedText: extractedTextValue } = req.body || {};

  if (!isNonEmptyString(base64Data) || !isNonEmptyString(mimeType)) {
    return res.status(400).json({ error: "base64Data and mimeType are required" });
  }

  if (mimeType !== "application/pdf" && !mimeType.startsWith("image/")) {
    return res.status(400).json({ error: "Unsupported file type. Please upload a PDF, JPG, or PNG statement." });
  }

  const renderedPages = getRenderedStatementPages(renderedPagesValue);
  if (renderedPagesValue !== undefined && (!renderedPages || mimeType !== "application/pdf")) {
    return res.status(400).json({ error: "Unlocked PDF pages are invalid or too large." });
  }
  if (renderedPages && base64Data.length + renderedPages.reduce((total, page) => total + page.base64Data.length, 0) > 21 * 1024 * 1024) {
    return res.status(400).json({ error: "The encrypted PDF and its unlocked pages are too large to process." });
  }
  const extractedText = typeof extractedTextValue === "string" ? extractedTextValue.trim() : "";
  if (extractedText.length > 500_000) {
    return res.status(400).json({ error: "Extracted statement text is too large to process." });
  }

  const writeEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  try {
    const statementHash = hashBase64File(base64Data);
    const alreadyImported = Boolean(await findStatementImport(req.user.id, statementHash));
    if (alreadyImported) {
      writeEvent("complete", {
        transactions: [],
        statementHash,
        alreadyImported,
        provider: "gemini",
        model: GEMINI_MODEL,
        message: "This statement file was already imported.",
      });
      return res.end();
    }

    let provider = "gemini";
    let model = GEMINI_MODEL;
    let extractedCount = 0;

    const streamTextChunks = async (text: string, initialBatchIndex = 0, totalBatchCount?: number) => {
      const chunks = splitStatementTextForImport(text);
      const totalBatches = totalBatchCount || chunks.length;
      for (const [index, chunk] of chunks.entries()) {
        if (extractedCount >= 250) break;
        const result = await importStatementTextChunk(chunk, index, chunks.length);
        provider = result.provider;
        model = result.model;
        const remaining = Math.max(0, 250 - extractedCount);
        const enrichedTransactions = await enrichStatementTransactionsWithAliases(
          req.user.id,
          result.transactions.slice(0, remaining)
        );
        extractedCount += enrichedTransactions.length;
        writeEvent("batch", {
          transactions: enrichedTransactions,
          statementHash,
          alreadyImported,
          provider,
          model,
          batchIndex: initialBatchIndex + index + 1,
          totalBatches,
          extractedCount,
          limitReached: extractedCount >= 250,
        });
      }
      return chunks.length;
    };

    if (!renderedPages?.length && extractedText.length >= 80) {
      const chunks = splitStatementTextForImport(extractedText);
      writeEvent("start", { statementHash, alreadyImported, totalBatches: chunks.length });
      await streamTextChunks(extractedText);
    } else if (renderedPages?.length) {
      const textChunks = extractedText.length >= 80 ? splitStatementTextForImport(extractedText) : [];
      writeEvent("start", {
        statementHash,
        alreadyImported,
        totalBatches: renderedPages.length + textChunks.length,
      });

      let visualFailed = false;
      for (const [index, page] of renderedPages.entries()) {
        if (extractedCount >= 250) break;
        try {
          const result = await importStatementWithAi(base64Data, mimeType, [page]);
          provider = result.provider;
          model = result.model;
          const remaining = Math.max(0, 250 - extractedCount);
          const enrichedTransactions = await enrichStatementTransactionsWithAliases(
            req.user.id,
            result.transactions.slice(0, remaining)
          );
          extractedCount += enrichedTransactions.length;
          writeEvent("batch", {
            transactions: enrichedTransactions,
            statementHash,
            alreadyImported,
            provider,
            model,
            batchIndex: index + 1,
            totalBatches: renderedPages.length + textChunks.length,
            extractedCount,
            limitReached: extractedCount >= 250,
          });
        } catch (visualError: any) {
          visualFailed = true;
          logger.warn("Statement page vision extraction failed, falling back to unlocked PDF text", {
            error: visualError?.message || String(visualError),
          });
          break;
        }
      }

      if (visualFailed) {
        if (!textChunks.length) {
          throw new Error("Statement page vision extraction failed and no selectable unlocked PDF text was available.");
        }
        await streamTextChunks(extractedText, renderedPages.length, renderedPages.length + textChunks.length);
      }
    } else {
      writeEvent("start", { statementHash, alreadyImported, totalBatches: 1 });
      const result = await importStatementWithAi(base64Data, mimeType, renderedPages);
      provider = result.provider;
      model = result.model;
      const enrichedTransactions = await enrichStatementTransactionsWithAliases(req.user.id, result.transactions);
      extractedCount = enrichedTransactions.length;
      writeEvent("batch", {
        transactions: enrichedTransactions,
        statementHash,
        alreadyImported,
        provider,
        model,
        batchIndex: 1,
        totalBatches: 1,
        extractedCount,
        limitReached: extractedCount >= 250,
      });
    }

    writeEvent("complete", {
      statementHash,
      alreadyImported,
      provider,
      model,
      extractedCount,
      limitReached: extractedCount >= 250,
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("AI statement streaming preview error", { message, stack: error?.stack });
    writeEvent("error", {
      error: "AI statement import failed",
      detail: IS_PRODUCTION ? undefined : message,
      hint: getGeminiImportHint(message),
      model: GEMINI_MODEL,
    });
  } finally {
    res.end();
  }
});

app.post("/api/statement-import/preview", authenticateToken, createAiUsageGuard("statement_import"), async (req: any, res) => {
  const { base64Data, mimeType, renderedPages: renderedPagesValue, extractedText: extractedTextValue } = req.body || {};

  if (!isNonEmptyString(base64Data) || !isNonEmptyString(mimeType)) {
    return res.status(400).json({ error: "base64Data and mimeType are required" });
  }

  if (mimeType !== "application/pdf" && !mimeType.startsWith("image/")) {
    return res.status(400).json({ error: "Unsupported file type. Please upload a PDF, JPG, or PNG statement." });
  }

  const renderedPages = getRenderedStatementPages(renderedPagesValue);
  if (renderedPagesValue !== undefined && (!renderedPages || mimeType !== "application/pdf")) {
    return res.status(400).json({ error: "Unlocked PDF pages are invalid or too large." });
  }
  if (renderedPages && base64Data.length + renderedPages.reduce((total, page) => total + page.base64Data.length, 0) > 21 * 1024 * 1024) {
    return res.status(400).json({ error: "The encrypted PDF and its unlocked pages are too large to process." });
  }
  const extractedText = typeof extractedTextValue === "string" ? extractedTextValue.trim() : "";
  if (extractedText.length > 500_000) {
    return res.status(400).json({ error: "Extracted statement text is too large to process." });
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

    let textResult: Awaited<ReturnType<typeof importStatementFromText>> | null = null;
    // Locally rendered pages mean the original PDF was password protected. Its
    // flattened text often loses debit/credit column positions, so preserve the
    // statement layout by sending the unlocked page images directly to Gemini.
    if (!renderedPages?.length && extractedText.length >= 80) {
      try {
        textResult = await importStatementFromText(extractedText);
        if (textResult.transactions.length === 0) {
          logger.warn("Statement text extraction returned no transactions, trying visual import");
          textResult = null;
        }
      } catch (textError: any) {
        logger.warn("Statement text extraction failed, trying visual import", {
          error: textError?.message || String(textError),
        });
      }
    }
    let extractedTransactions: GeminiStatementTransaction[];
    let visionResult: Awaited<ReturnType<typeof importStatementWithAi>> | null = null;
    if (textResult?.transactions?.length) {
      extractedTransactions = textResult.transactions;
    } else {
      try {
        visionResult = await importStatementWithAi(base64Data, mimeType, renderedPages);
        extractedTransactions = visionResult.transactions;
      } catch (visualError: any) {
        const visualMessage = visualError?.message || String(visualError);
        const canUseUnlockedTextFallback = Boolean(renderedPages?.length) && extractedText.length >= 80;
        if (!canUseUnlockedTextFallback) throw visualError;

        logger.warn("Gemini visual quota unavailable, trying unlocked statement text providers");
        textResult = await importStatementFromText(extractedText);
        extractedTransactions = textResult.transactions;
      }
    }
    const transactions = await enrichStatementTransactionsWithAliases(req.user.id, extractedTransactions);
    res.json({
      transactions,
      statementHash,
      alreadyImported,
      provider: textResult?.provider || visionResult?.provider || "gemini",
      model: textResult?.model || visionResult?.model || GEMINI_MODEL,
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("AI statement preview error", { message, stack: error?.stack });
    res.status(502).json({
      error: "AI statement import failed",
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

  if (transactions.length > 300) {
    return res.status(400).json({ error: "A maximum of 300 transactions can be approved at once" });
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
  if (/cannot read raw PDF statements/i.test(message)) {
    return "This PDF did not expose enough selectable text, and only Gemini can read raw PDF pages in the current provider setup. Wait for Gemini quota, enable Gemini billing, or upload a statement/export with selectable text.";
  }

  if (/Request too large|tokens per minute|TPM|413/i.test(message)) {
    return "The fallback vision provider rejected the statement because the request was too large. Try a shorter PDF, a clearer exported PDF with selectable text, or a provider plan/model with a higher token limit.";
  }

  if (/Missing Authentication header|openrouter.*401|OPENROUTER_API_KEY/i.test(message)) {
    return "OpenRouter fallback is enabled but its API key is missing or invalid. Set OPENROUTER_API_KEY or remove openrouter from AI_TEXT_PROVIDER_PRIORITY.";
  }

  if (/model_not_supported|not supported by any provider|huggingface/i.test(message)) {
    return "The configured Hugging Face vision model is not available for this account/provider. Choose a supported vision model or remove huggingface from AI_TEXT_PROVIDER_PRIORITY.";
  }

  if (/API key|permission|403|401/i.test(message)) {
    return "Check GEMINI_API_KEY in your local .env or Render environment variables, then restart/redeploy the service.";
  }

  if (/GenerateRequestsPerDay|requests per day|free_tier_requests/i.test(message)) {
    return "The Gemini free-tier daily request quota is exhausted. Wait for Google to reset the quota, enable billing, or use an API key from a project with available quota.";
  }

  if (/quota|rate|429/i.test(message)) {
    return "Gemini quota or rate limit was reached. Try again later or check AI Studio quota.";
  }

  if (/503|unavailable|timed out/i.test(message)) {
    return "Gemini is temporarily unavailable. The PDF was unlocked successfully; please retry the import in a moment.";
  }

  if (/model|404|not found/i.test(message)) {
    return `The configured Gemini model (${GEMINI_MODEL}) may not be available for this API key. Try GEMINI_MODEL=gemini-2.5-flash-lite with GEMINI_FALLBACK_MODELS=gemini-2.5-flash, then restart.`;
  }

  if (/JSON|parse|transactions/i.test(message)) {
    return "The PDF was unlocked, but Gemini could not extract clean transaction data. Retry the import or try a clearer statement.";
  }

  return "Make sure the file is a readable PDF/JPG/PNG and Gemini billing/quota is available.";
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

app.post("/api/ai/import-statement-file", authenticateToken, createAiUsageGuard("statement_import"), upload.single('file'), async (req: any, res) => {
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

    const aiResult = await importStatementWithAi(base64Data, mimeType);
    const transactions = await enrichStatementTransactionsWithAliases(req.user.id, aiResult.transactions);

    res.json({
      transactions,
      statementHash,
      alreadyImported,
      savedCount: 0,
      skippedCount: 0,
      pendingApproval: true,
      provider: aiResult.provider,
      model: aiResult.model,
      fileStored: false,
    });
  } catch (error: any) {
    logger.error("AI statement file import error", { error });
    const message = error instanceof Error ? error.message : String(error);
    res.status(502).json({
      error: "AI statement import failed",
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
  const server = app.listen(PORT, () => {
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
