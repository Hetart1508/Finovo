import type { SignOptions } from "jsonwebtoken";

export const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const allowedOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const validateUrlOrigin = (origin: string) => {
  try {
    const parsed = new URL(origin);
    return parsed.origin === origin && /^https?:$/.test(parsed.protocol);
  } catch {
    return false;
  }
};

const jwtSecret = process.env.JWT_SECRET || "";
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be set and at least 32 characters long");
}

if (IS_PRODUCTION && !allowedOrigins.length) {
  throw new Error("FRONTEND_URL or CORS_ORIGIN must be set in production");
}

const invalidOrigins = allowedOrigins.filter((origin) => !validateUrlOrigin(origin));
if (invalidOrigins.length) {
  throw new Error(`Invalid CORS/FRONTEND origin: ${invalidOrigins.join(", ")}`);
}

if (IS_PRODUCTION && process.env.DB_SSL !== "true") {
  throw new Error("DB_SSL=true is required in production");
}

export const JWT_SECRET = jwtSecret;
export const SESSION_EXPIRES_IN = (process.env.SESSION_EXPIRES_IN || "2h") as SignOptions["expiresIn"];

export const EMAIL_USER = process.env.EMAIL_USER || "";
export const EMAIL_PASS = process.env.EMAIL_PASS || "";
export const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
export const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || EMAIL_USER;
export const BREVO_FROM_NAME = process.env.BREVO_FROM_NAME || "Finovo AI";

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
export const GEMINI_FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || "gemini-2.5-flash")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
export const AI_PROVIDER = process.env.AI_PROVIDER || "gemini";
export const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
