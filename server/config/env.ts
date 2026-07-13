import type { SignOptions } from "jsonwebtoken";

export const IS_PRODUCTION = process.env.NODE_ENV === "production";

const readEnv = (name: string, fallback = "") => {
  const value = process.env[name];
  if (value === undefined) return fallback;

  const trimmed = value.trim();
  const hasMatchingQuotes =
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"));

  return hasMatchingQuotes ? trimmed.slice(1, -1).trim() : trimmed;
};

const extractGoogleApiKey = (value: string) => {
  const matches = value.match(/AIza[0-9A-Za-z_-]{35}/g);
  return matches?.at(-1) || value;
};

export const allowedOrigins = (readEnv("CORS_ORIGIN") || readEnv("FRONTEND_URL") || "")
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

const jwtSecret = readEnv("JWT_SECRET");
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

if (IS_PRODUCTION && readEnv("DB_SSL") !== "true") {
  throw new Error("DB_SSL=true is required in production");
}

export const JWT_SECRET = jwtSecret;
export const SESSION_EXPIRES_IN = readEnv("SESSION_EXPIRES_IN", "2h") as SignOptions["expiresIn"];

export const EMAIL_USER = readEnv("EMAIL_USER");
export const EMAIL_PASS = readEnv("EMAIL_PASS");
export const BREVO_API_KEY = readEnv("BREVO_API_KEY");
export const BREVO_FROM_EMAIL = readEnv("BREVO_FROM_EMAIL") || EMAIL_USER;
export const BREVO_FROM_NAME = readEnv("BREVO_FROM_NAME", "Finovo AI");

export const GOOGLE_CLIENT_ID = readEnv("GOOGLE_CLIENT_ID");

export const GEMINI_API_KEY = extractGoogleApiKey(
  readEnv("GEMINI_API_KEY") || readEnv("GOOGLE_GEMINI_API_KEY") || readEnv("GOOGLE_API_KEY")
);
export const GEMINI_API_KEYS = Array.from(new Set([
  readEnv("GEMINI_API_KEY_1"),
  readEnv("GEMINI_API_KEY_2"),
  readEnv("GEMINI_API_KEY_3"),
  GEMINI_API_KEY,
].map(extractGoogleApiKey).filter(Boolean)));
export const GEMINI_MODEL = readEnv("GEMINI_MODEL", "gemini-2.5-flash-lite");
export const GEMINI_FALLBACK_MODELS = readEnv("GEMINI_FALLBACK_MODELS", "gemini-2.5-flash")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
export const AI_PROVIDER = readEnv("AI_PROVIDER", "gemini").toLowerCase();
const defaultTextProviderPriority = "gemini,groq,openrouter,huggingface";
const configuredTextProviderPriority = readEnv("AI_TEXT_PROVIDER_PRIORITY") || readEnv("AI_PROVIDER_PRIORITY");
const legacyPrimaryProvider = readEnv("AI_PROVIDER");
export const AI_TEXT_PROVIDER_PRIORITY = (
  configuredTextProviderPriority ||
  (legacyPrimaryProvider ? `${legacyPrimaryProvider},${defaultTextProviderPriority}` : defaultTextProviderPriority)
)
  .split(",")
  .map((provider) => provider.trim().toLowerCase())
  .filter(Boolean);
export const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
export const GEMINI_ADMIN_EMAILS = (readEnv("GEMINI_ADMIN_EMAILS", "hetarth150804@gmail.com"))
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
export const GEMINI_MONTHLY_CREDIT_LIMIT = Math.max(0, Number(readEnv("GEMINI_MONTHLY_CREDIT_LIMIT", "10000")) || 0);
export const GEMINI_WARNING_PERCENT = Math.min(100, Math.max(1, Number(readEnv("GEMINI_WARNING_PERCENT", "80")) || 80));
export const GEMINI_LIMIT_BEHAVIOR = readEnv("GEMINI_LIMIT_BEHAVIOR", "fallback").toLowerCase() === "block"
  ? "block" as const
  : "fallback" as const;
export const AI_CREDIT_USD = Math.max(0.000001, Number(readEnv("AI_CREDIT_USD", "0.001")) || 0.001);
export const GEMINI_RATE_LIMIT_USER_PER_MINUTE = Math.max(1, Number(readEnv("GEMINI_RATE_LIMIT_USER_PER_MINUTE", "20")) || 20);
export const GEMINI_RATE_LIMIT_IP_PER_MINUTE = Math.max(1, Number(readEnv("GEMINI_RATE_LIMIT_IP_PER_MINUTE", "40")) || 40);

export const GROQ_API_KEY = readEnv("GROQ_API_KEY");
export const GROQ_MODEL = readEnv("GROQ_MODEL", "qwen/qwen3.6-27b");
export const GROQ_FALLBACK_MODELS = readEnv("GROQ_FALLBACK_MODELS", "openai/gpt-oss-120b,openai/gpt-oss-20b")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
export const GROQ_API_BASE_URL = readEnv("GROQ_API_BASE_URL", "https://api.groq.com/openai/v1");
export const GROQ_VISION_MODEL = readEnv("GROQ_VISION_MODEL", "qwen/qwen3.6-27b");

export const OPENROUTER_API_KEY = readEnv("OPENROUTER_API_KEY");
export const OPENROUTER_MODEL = readEnv("OPENROUTER_MODEL", "deepseek/deepseek-chat-v3-0324:free");
export const OPENROUTER_FALLBACK_MODELS = readEnv(
  "OPENROUTER_FALLBACK_MODELS",
  "qwen/qwen3-235b-a22b:free,meta-llama/llama-3.3-70b-instruct:free"
)
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
export const OPENROUTER_API_BASE_URL = readEnv("OPENROUTER_API_BASE_URL", "https://openrouter.ai/api/v1");
export const OPENROUTER_SITE_URL = readEnv("OPENROUTER_SITE_URL") || readEnv("FRONTEND_URL");
export const OPENROUTER_APP_NAME = readEnv("OPENROUTER_APP_NAME", "Finovo");
export const OPENROUTER_VISION_MODEL = readEnv("OPENROUTER_VISION_MODEL", "openrouter/free");

export const HUGGINGFACE_API_KEY = readEnv("HUGGINGFACE_API_KEY") || readEnv("HF_TOKEN");
export const HUGGINGFACE_MODEL = readEnv("HUGGINGFACE_MODEL", "meta-llama/Llama-3.1-8B-Instruct");
export const HUGGINGFACE_FALLBACK_MODELS = readEnv(
  "HUGGINGFACE_FALLBACK_MODELS",
  "mistralai/Mistral-7B-Instruct-v0.3,Qwen/Qwen2.5-7B-Instruct"
)
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
export const HUGGINGFACE_API_BASE_URL = readEnv("HUGGINGFACE_API_BASE_URL", "https://router.huggingface.co/v1");
export const HUGGINGFACE_VISION_MODEL = readEnv("HUGGINGFACE_VISION_MODEL", "Qwen/Qwen2.5-VL-7B-Instruct");
