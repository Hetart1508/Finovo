import crypto from "crypto";
import { AsyncLocalStorage } from "async_hooks";
import type { NextFunction, Request, Response } from "express";
import {
  AI_CREDIT_USD,
  GEMINI_ADMIN_EMAILS,
  GEMINI_API_KEYS,
  GEMINI_LIMIT_BEHAVIOR,
  GEMINI_MONTHLY_CREDIT_LIMIT,
  GEMINI_RATE_LIMIT_IP_PER_MINUTE,
  GEMINI_RATE_LIMIT_USER_PER_MINUTE,
  GEMINI_WARNING_PERCENT,
} from "../config/env";
import { execute, queryAll, queryOne } from "../db/client";
import { logger } from "../config/logger";

export type AiFeature =
  | "ai_insights"
  | "wealth_advisor"
  | "transaction_extraction"
  | "statement_import"
  | "smart_bill_fetching";

type AiRequestContext = {
  userId: number;
  feature: AiFeature;
  ipHash: string;
  skipGemini: boolean;
};

type UsageRecord = {
  provider: string;
  model: string;
  keyIdentifier?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  inputText?: string;
  outputText?: string;
  success: boolean;
  errorType?: string | null;
};

const requestContext = new AsyncLocalStorage<AiRequestContext>();
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;

const monthStartSql = "DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01 00:00:00')";

const hashIp = (ip: string) => crypto.createHash("sha256").update(ip).digest("hex");

export const getRequestIp = (req: Request) =>
  String(req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress || "unknown")
    .split(",")[0]
    .trim();

const consumeRateBucket = (key: string, limit: number) => {
  const now = Date.now();
  const existing = rateBuckets.get(key);
  const bucket = !existing || existing.resetAt <= now
    ? { count: 1, resetAt: now + RATE_WINDOW_MS }
    : { count: existing.count + 1, resetAt: existing.resetAt };
  rateBuckets.set(key, bucket);
  return { allowed: bucket.count <= limit, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
};

const getSettings = async () => {
  const existing: any = await queryOne("SELECT monthly_credit_limit, warning_percent, limit_behavior FROM ai_usage_settings WHERE id = 1");
  if (existing) return existing;
  await execute(
    "INSERT IGNORE INTO ai_usage_settings (id, monthly_credit_limit, warning_percent, limit_behavior) VALUES (1, ?, ?, ?)",
    [GEMINI_MONTHLY_CREDIT_LIMIT, GEMINI_WARNING_PERCENT, GEMINI_LIMIT_BEHAVIOR]
  );
  return {
    monthly_credit_limit: GEMINI_MONTHLY_CREDIT_LIMIT,
    warning_percent: GEMINI_WARNING_PERCENT,
    limit_behavior: GEMINI_LIMIT_BEHAVIOR,
  };
};

const getMonthlyGeminiCredits = async () => {
  const row: any = await queryOne(
    `SELECT COALESCE(SUM(credits_used), 0) AS credits_used
     FROM ai_usage_events
     WHERE provider = 'gemini' AND created_at >= ${monthStartSql}`
  );
  return Number(row?.credits_used || 0);
};

export const createAiUsageGuard = (feature: AiFeature) => async (req: any, res: Response, next: NextFunction) => {
  const userId = Number(req.user?.id);
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const ip = getRequestIp(req);
  const context = { userId, feature, ipHash: hashIp(ip), skipGemini: false };
  const userLimit = consumeRateBucket(`ai:user:${userId}`, GEMINI_RATE_LIMIT_USER_PER_MINUTE);
  const ipLimit = consumeRateBucket(`ai:ip:${ip}`, GEMINI_RATE_LIMIT_IP_PER_MINUTE);
  if (!userLimit.allowed || !ipLimit.allowed) {
    const retryAfter = Math.max(userLimit.retryAfter, ipLimit.retryAfter);
    res.setHeader("Retry-After", String(retryAfter));
    await requestContext.run(context, () => recordAiUsage({
      provider: "gemini",
      model: "application-rate-limiter",
      success: false,
      errorType: "quota_or_rate_limit",
    }));
    return res.status(429).json({ error: "AI rate limit reached. Please try again shortly." });
  }

  try {
    const [settings, usedCredits] = await Promise.all([getSettings(), getMonthlyGeminiCredits()]);
    const limit = Number(settings.monthly_credit_limit || 0);
    const atLimit = limit > 0 && usedCredits >= limit;
    if (atLimit && settings.limit_behavior === "block") {
      await requestContext.run(context, () => recordAiUsage({
        provider: "gemini",
        model: "monthly-credit-limit",
        success: false,
        errorType: "quota_or_rate_limit",
      }));
      return res.status(429).json({
        error: "Monthly AI credit limit reached. AI requests are temporarily paused.",
        code: "AI_MONTHLY_LIMIT_REACHED",
      });
    }

    return requestContext.run({ ...context, skipGemini: atLimit }, next);
  } catch (error) {
    logger.error("AI usage guard failed", { error, userId, feature });
    return res.status(503).json({ error: "AI usage controls are temporarily unavailable." });
  }
};

export const shouldSkipGeminiForMonthlyLimit = () => Boolean(requestContext.getStore()?.skipGemini);

export const estimateTokens = (text = "") => Math.max(0, Math.ceil(text.length / 4));

const getRatesPerMillion = (provider: string, model: string) => {
  if (provider !== "gemini") return { input: 0, output: 0 };
  if (/flash-lite/i.test(model)) return { input: 0.10, output: 0.40 };
  if (/flash/i.test(model)) return { input: 0.30, output: 2.50 };
  return { input: 1.25, output: 10.00 };
};

export const recordAiUsage = async (record: UsageRecord) => {
  const context = requestContext.getStore();
  if (!context) return;

  const inputTokens = Math.max(0, Math.round(record.inputTokens ?? (record.success ? estimateTokens(record.inputText) : 0)));
  const outputTokens = Math.max(0, Math.round(record.outputTokens ?? (record.success ? estimateTokens(record.outputText) : 0)));
  const rates = getRatesPerMillion(record.provider, record.model);
  const estimatedCostUsd = (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
  const creditsUsed = estimatedCostUsd / AI_CREDIT_USD;

  try {
    await execute(
      `INSERT INTO ai_usage_events
       (user_id, feature, provider, model, key_identifier, input_tokens, output_tokens,
        estimated_cost_usd, credits_used, status, error_type, request_ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        context.userId,
        context.feature,
        record.provider.slice(0, 30),
        record.model.slice(0, 160),
        record.keyIdentifier?.slice(0, 40) || null,
        inputTokens,
        outputTokens,
        estimatedCostUsd,
        creditsUsed,
        record.success ? "success" : "failed",
        record.errorType?.slice(0, 40) || null,
        context.ipHash,
      ]
    );
  } catch (error) {
    logger.error("Failed to persist AI usage event", { error, provider: record.provider, model: record.model });
  }
};

export const isGeminiAdmin = (email: unknown) =>
  typeof email === "string" && GEMINI_ADMIN_EMAILS.includes(email.trim().toLowerCase());

export const requireGeminiAdmin = async (req: any, res: Response, next: NextFunction) => {
  try {
    const user: any = await queryOne("SELECT email FROM users WHERE id = ? AND deleted_at IS NULL", [req.user?.id]);
    if (!user || !isGeminiAdmin(user.email)) return res.status(403).json({ error: "Admin access required" });
    req.adminEmail = user.email;
    return next();
  } catch (error) {
    logger.error("Gemini admin authorization failed", { error, userId: req.user?.id });
    return res.status(500).json({ error: "Could not verify admin access" });
  }
};

export const getAiUsageDashboard = async () => {
  const [summary, features, recent, settings] = await Promise.all([
    queryOne<any>(
      `SELECT COUNT(*) AS total_requests,
              COALESCE(SUM(input_tokens), 0) AS input_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens,
              COALESCE(SUM(estimated_cost_usd), 0) AS estimated_cost_usd,
              COALESCE(SUM(credits_used), 0) AS credits_used,
              SUM(status = 'failed') AS failed_requests,
              SUM(error_type = 'quota_or_rate_limit') AS quota_errors
       FROM ai_usage_events WHERE created_at >= ${monthStartSql}`
    ),
    queryAll<any>(
      `SELECT feature, COUNT(*) AS total_requests,
              COALESCE(SUM(input_tokens), 0) AS input_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens,
              COALESCE(SUM(estimated_cost_usd), 0) AS estimated_cost_usd,
              SUM(status = 'failed') AS failed_requests
       FROM ai_usage_events WHERE created_at >= ${monthStartSql}
       GROUP BY feature ORDER BY total_requests DESC`
    ),
    queryAll<any>(
      `SELECT provider, model, key_identifier, status, error_type, input_tokens, output_tokens,
              estimated_cost_usd, created_at
       FROM ai_usage_events ORDER BY id DESC LIMIT 25`
    ),
    getSettings(),
  ]);
  const configuredLimit = Number(settings.monthly_credit_limit || 0);
  const usedCredits = Number(summary?.credits_used || 0);
  const warningAt = configuredLimit * Number(settings.warning_percent || 80) / 100;
  const active = recent.find((item: any) => item.status === "success") || recent[0] || null;
  return {
    month: new Date().toISOString().slice(0, 7),
    keys: GEMINI_API_KEYS.map((key, index) => ({
      identifier: `Key ${index + 1} ••••${key.slice(-4).toUpperCase()}`,
      configured: true,
    })),
    summary: { ...summary, active_model: active?.model || null, active_provider: active?.provider || null },
    features,
    recent,
    settings: {
      monthly_credit_limit: configuredLimit,
      warning_percent: Number(settings.warning_percent),
      limit_behavior: settings.limit_behavior,
      warning_active: configuredLimit > 0 && usedCredits >= warningAt,
      limit_reached: configuredLimit > 0 && usedCredits >= configuredLimit,
      remaining_credits: configuredLimit > 0 ? Math.max(0, configuredLimit - usedCredits) : null,
      credit_usd: AI_CREDIT_USD,
    },
  };
};

export const updateAiUsageSettings = async (userId: number, value: any) => {
  const monthlyLimit = Number(value?.monthly_credit_limit);
  const warningPercent = Number(value?.warning_percent);
  const behavior = value?.limit_behavior === "block" ? "block" : value?.limit_behavior === "fallback" ? "fallback" : null;
  if (!Number.isFinite(monthlyLimit) || monthlyLimit < 0 || monthlyLimit > 1_000_000_000) {
    throw new Error("Monthly credit limit must be between 0 and 1,000,000,000");
  }
  if (!Number.isInteger(warningPercent) || warningPercent < 1 || warningPercent > 100) {
    throw new Error("Warning percent must be a whole number from 1 to 100");
  }
  if (!behavior) throw new Error("Limit behavior must be block or fallback");
  await execute(
    `INSERT INTO ai_usage_settings (id, monthly_credit_limit, warning_percent, limit_behavior, updated_by_user_id)
     VALUES (1, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE monthly_credit_limit = VALUES(monthly_credit_limit),
       warning_percent = VALUES(warning_percent), limit_behavior = VALUES(limit_behavior),
       updated_by_user_id = VALUES(updated_by_user_id)`,
    [monthlyLimit, warningPercent, behavior, userId]
  );
  return getAiUsageDashboard();
};
