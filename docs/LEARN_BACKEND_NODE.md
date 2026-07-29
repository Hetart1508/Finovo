# Learn Node.js Backend Development Through Finovo

This guide maps the Finovo backend code to core Node.js/Express concepts. Follow the modules in order — each one builds on the previous.

---

## Table of Contents

1. [Project Setup & Entry Point](#1-project-setup--entry-point)
2. [Configuration & Environment Variables](#2-configuration--environment-variables)
3. [Database Layer](#3-database-layer)
4. [Middleware System](#4-middleware-system)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [REST API Routes](#6-rest-api-routes)
7. [Request Validation & Normalization](#7-request-validation--normalization)
8. [File Uploads](#8-file-uploads)
9. [Email Service](#9-email-service)
10. [AI Provider Integration](#10-ai-provider-integration)
11. [Rate Limiting](#11-rate-limiting)
12. [Domain Services](#12-domain-services)
13. [Architecture & Refactoring](#13-architecture--refactoring)
14. [Learning Path Summary](#14-learning-path-summary)

---

## 1. Project Setup & Entry Point

**File:** `server.ts`, `package.json`

### What to learn

- **Express app creation** — `const app = express()`
- **Middleware `.use()` chain** — `compression()`, `helmet()`, `cors()`, `express.json()`
- **Route handlers** — `app.get()`, `app.post()`, `app.patch()`, `app.delete()`
- **Path parameters** — `/api/wallets/:walletId/members`
- **Query parameters** — `req.query.type`, `req.query.from`
- **Request body** — `req.body`
- **Response methods** — `res.json()`, `res.status().json()`, `res.sendStatus()`
- **TypeScript with Node** — Type imports, interfaces, `tsx` runner
- **Environment loading** — `import "dotenv/config"`
- **Production static serving** — serving built frontend from `dist/`

### Key code to study

```typescript
// server.ts — app setup (lines 1-60)
const app = express();
app.use(compression());
app.use(helmet({...}));
app.use(cors({ origin: ..., credentials: true }));
app.use(express.json({ limit: "25mb" }));

// Route example
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "finovo-api" });
});

// Path parameter example
app.get("/api/transactions/:id", authenticateToken, async (req, res) => {
  const id = toPositiveInteger(req.params.id);
  // ...
});
```

### Practice

1. Create a new Express route that returns a simple message
2. Add a route with path parameters and query parameters
3. Try sending different HTTP methods (GET, POST, PATCH, DELETE)

---

## 2. Configuration & Environment Variables

**File:** `server/config/env.ts`

### What to learn

- **Environment variables** — `process.env.VAR_NAME`
- **Configuration validation** — throwing errors when required vars are missing
- **Type-safe config** — exporting typed constants from a config module
- **Conditional production checks** — `IS_PRODUCTION` flag
- **Arrays from comma-separated env vars** — `.split(",").map(...).filter(Boolean)`

### Key code to study

```typescript
// server/config/env.ts
export const IS_PRODUCTION = process.env.NODE_ENV === "production";

const readEnv = (name: string, fallback = "") => {
  const value = process.env[name];
  return value === undefined ? fallback : value.trim();
};

// Validation
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be set and at least 32 characters long");
}

// Comma-separated list
export const allowedOrigins = readEnv("CORS_ORIGIN")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);
```

### Practice

1. Add a new environment variable to the config module
2. Add validation that throws a clear error if it's missing

---

## 3. Database Layer

**File:** `server/db/client.ts`, `server/db/migrations.ts`

### What to learn

- **MySQL connection pool** — `mysql.createPool()` with connection limits
- **Connection configuration** — host, port, user, password, database, SSL
- **Parameterized queries** — `?` placeholders prevent SQL injection
- **Three query helpers** — `queryAll()` (many rows), `queryOne()` (single row), `execute()` (INSERT/UPDATE/DELETE)
- **Schema migrations** — `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN`
- **Index management** — `CREATE INDEX` for performance
- **Foreign keys** — `REFERENCES` with `ON DELETE CASCADE`

### Key code to study

```typescript
// server/db/client.ts
export const db = mysql.createPool({
  ...getDbConfig(),
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
  dateStrings: true,
});

export const queryAll = async <T>(sql: string, params: any[] = []) => {
  const [rows] = await db.execute<T[]>(sql, params);
  return rows;
};

export const queryOne = async <T>(sql: string, params: any[] = []) => {
  const rows = await queryAll<T>(sql, params);
  return rows[0];
};

export const execute = async (sql: string, params: any[] = []) => {
  const [result] = await db.execute<ResultSetHeader>(sql, params);
  return result; // { insertId, affectedRows }
};
```

### Practice

1. Write a `queryAll` that joins two tables
2. Use `execute()` with an INSERT and get the `insertId`
3. Examine the migrations file to understand the schema design

---

## 4. Middleware System

**File:** `server/middleware/auth.ts`, `server/middleware/requestLogger.ts`

### What to learn

- **Middleware signature** — `(req, res, next) => void`
- **Order matters** — middleware runs in the order you `.use()` it
- **Request logging** — logging method, path, status, duration
- **Modifying `req`** — attaching user data to `req.user`
- **`res.on("finish")`** — hooking into response completion
- **Returning early** — `res.status().json()` without calling `next()` to stop the chain

### Key code to study

```typescript
// server/middleware/requestLogger.ts
export const requestLogger: RequestHandler = (req, res, next) => {
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
};
```

### Practice

1. Write a middleware that adds a `requestId` to each request
2. Write a middleware that rejects requests without a specific header

---

## 5. Authentication & Authorization

**File:** `server/middleware/auth.ts`

### What to learn

- **JWT (JSON Web Tokens)** — `jwt.sign()`, `jwt.verify()`
- **Cookie parsing** — parsing the `Cookie` header manually
- **Bearer token** — `Authorization: Bearer <token>` header
- **Token expiration** — `expiresIn`, `TokenExpiredError`
- **User lookup on each request** — verifying the account is still active
- **Type augmentation** — adding `req.user` via `any` cast (improvement: extend Express Request type)

### Key code to study

```typescript
// server/middleware/auth.ts
export const authenticateToken: RequestHandler = (req: any, res, next) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.split(" ")[1];
  const cookies = parseCookieHeader(req.headers.cookie);
  const token = cookies.finovo_session || bearerToken;

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, async (err, user: any) => {
    if (err?.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Session expired." });
    }
    if (err) return res.sendStatus(401);

    // Verify user still exists
    const activeUser = await queryOne(
      "SELECT id FROM users WHERE id = ? AND deleted_at IS NULL", [user.id]
    );
    if (!activeUser) return res.status(401).json({ error: "Account is no longer active." });

    req.user = user;
    next();
  });
};
```

### Practice

1. Create a simple JWT sign/verify utility
2. Understand how `req.user` flows to route handlers
3. Add a new protected route and test it with a valid/invalid token

---

## 6. REST API Routes

**File:** `server.ts` (all routes)

### What to learn

- **REST conventions** — GET for list, POST for create, PATCH/PUT for update, DELETE for remove
- **URL structure** — `/api/transactions`, `/api/transactions/:id`
- **Query filters** — `?type=expense&from=2024-01-01&to=2024-12-31`
- **Pagination** — `limit` and `offset` query parameters
- **Handlers pattern** — validate → process → respond with status code
- **Error responses** — consistent `{ error: string }` shape

### Key route patterns to study

```typescript
// LIST — GET /api/transactions
app.get("/api/transactions", authenticateToken, async (req, res) => {
  const filters = await getTransactionFilters(req.query, req.user.id);
  // ... build WHERE clause from filters
  const transactions = await queryAll(`SELECT ... WHERE ${filters.where}`, filters.params);
  res.json(transactions);
});

// CREATE — POST /api/transactions
app.post("/api/transactions", authenticateToken, async (req, res) => {
  const result = await createTransaction(req.user.id, req.body);
  res.status(result.status).json(result.body);
});

// READ — GET /api/transactions/:id
app.get("/api/transactions/:id", authenticateToken, async (req, res) => {
  const transaction = await findTransactionById(id, req.user.id);
  if (!transaction) return res.status(404).json({ error: "Transaction not found" });
  res.json(transaction);
});

// UPDATE — PATCH /api/transactions/:id
app.patch("/api/transactions/:id", authenticateToken, async (req, res) => {
  const result = await updateTransaction(id, req.user.id, req.body);
  res.status(result.status).json(result.body);
});

// DELETE — DELETE /api/transactions/:id
app.delete("/api/transactions/:id", authenticateToken, async (req, res) => {
  // ... delete logic
  res.json({ message: "Deleted successfully", id });
});
```

### Practice

1. Map out the CRUD routes for any entity (wallets, transactions, investments)
2. Write a new route that returns aggregated data (e.g., total spending per category)

---

## 7. Request Validation & Normalization

**File:** `server.ts` (validation functions throughout)

### What to learn

- **Input sanitization** — trimming strings, normalizing emails to lowercase
- **Type coercion** — `toNumber()`, `toPositiveInteger()`
- **Date validation** — `isValidDateString()`, `isFutureDateString()`
- **Enums** — `const GEMINI_CATEGORIES = ['Food', 'Transport', ...] as const`
- **Normalization pattern** — functions that return `{ data: T } | { error: string }` for type-safe validation

### Key code to study

```typescript
// server.ts — normalization helpers
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

// Validation pattern — returns either data or error
const validateProfileInput = (body: any): { data: ProfileInput } | { error: string } => {
  const name = isNonEmptyString(body?.name) ? body.name.trim() : "";
  if (!name || name.length > 255) {
    return { error: "Name is required and must be 255 characters or fewer" };
  }
  return { data: { name, ... } };
};

// Usage in route
const validated = validateProfileInput(req.body);
if ("error" in validated) {
  return res.status(400).json({ error: validated.error });
}
```

### Practice

1. Create a validation function for a new entity
2. Practice date validation (past dates, future dates, format checking)
3. Build a normalization chain that cleans user input

---

## 8. File Uploads

**File:** `server/middleware/upload.ts`

### What to learn

- **Multer** — Express multipart/form-data middleware
- **File size limits** — `limits: { fileSize: 5 * 1024 * 1024 }`
- **File type validation** — checking MIME type AND file extension
- **Magic bytes** — reading file headers to verify actual content (not just trusting extension)
- **Disk storage** — saving files to a local directory with unique names

### Key code to study

```typescript
export const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype || "")) {
      return cb(new Error("Unsupported file type"));
    }
    return cb(null, true);
  },
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
    },
  }),
});
```

### Practice

1. Create a file upload route and test with Postman
2. Implement file signature validation for a new file type

---

## 9. Email Service

**File:** `server.ts` — `sendAppEmail()`, `sendOtpEmail()`, `sendMonthlyReportEmail()`

### What to learn

- **Nodemailer** — sending emails via SMTP
- **Brevo API** — transactional email API as alternative
- **HTML email templates** — inline styles, responsive layout
- **Timeout handling** — `AbortController` + `Promise.race`
- **Fallback strategy** — try Brevo first, fall back to Gmail SMTP
- **Error categorization** — classifying email errors for user-friendly messages

### Key code to study

```typescript
const sendAppEmail = async (mail: { to: string; subject: string; html: string }) => {
  if (!BREVO_API_KEY && (!EMAIL_USER || !EMAIL_PASS)) {
    return { status: 500, body: { error: "Email service is not configured" } };
  }

  // Try Brevo first
  if (BREVO_API_KEY) {
    try {
      await sendEmailWithBrevo(mail, timeoutMs);
      return { status: 200 };
    } catch (error) { /* fall through */ }
  }

  // Fallback: try multiple Gmail SMTP transports
  for (const transport of emailTransports) {
    try {
      const transporter = nodemailer.createTransport({
        ...transport.options,
        auth: { user: EMAIL_USER, pass: EMAIL_PASS },
      });
      await transporter.sendMail({ from: `"Finovo" <${EMAIL_USER}>`, ...mail });
      return { status: 200 };
    } catch (error) { lastError = error; }
  }
  // All transports failed
  return { status: 500, body: { error: getEmailErrorMessage(lastError) } };
};
```

### Practice

1. Set up a test email send using Nodemailer with a Gmail App Password
2. Write an HTML email template for a welcome email

---

## 10. AI Provider Integration

**File:** `server.ts` — `generateGemini()`, `generateAiText()`, `generateAiVision()`

### What to learn

- **Multiple provider architecture** — Gemini, Groq, OpenRouter, Hugging Face
- **Fallback chain** — try primary provider, fall through on failure
- **OpenAI-compatible API** — Groq, OpenRouter, Hugging Face all use the same `/chat/completions` shape
- **API key rotation** — cycling through multiple Gemini keys
- **Retry logic** — retrying on transient errors, skipping on permanent errors
- **Abort/timeout** — `AbortController` for per-attempt timeout
- **Token counting** — estimating + recording usage
- **JSON extraction** — `extractJsonObject()` to parse AI responses from code fences

### Key code to study

```typescript
// Provider priority chain
const getTextProviderPriority = () => {
  const ordered = [...DEFAULT_TEXT_PROVIDER_PRIORITY, ...AI_TEXT_PROVIDER_PRIORITY]
    .map(normalizeTextProvider)
    .filter((provider) => Boolean(provider));
  return Array.from(new Set(ordered));
};

// Fallback across multiple providers
const generateAiText = async (prompt: string, options = {}) => {
  const providerPriority = getTextProviderPriority().filter(p => configuredProviders[p]);
  for (const provider of providerPriority) {
    try {
      if (provider === "gemini") return await generateGemini(...);
      if (provider === "groq") return await generateOpenAiCompatibleText("groq", ...);
      // ...
    } catch (error) {
      logger.warn("Provider failed, trying next", { provider, error });
    }
  }
  throw new Error("All providers failed");
};

// OpenAI-compatible endpoint pattern
const generateOpenAiCompatibleText = async (provider, apiBaseUrl, apiKey, modelCandidates, prompt) => {
  for (const model of modelCandidates) {
    const response = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: "..." }, { role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 1024,
      }),
    });
    // Parse and return...
  }
};
```

### Practice

1. Call a local or test AI endpoint using the fetch API
2. Understand the fallback pattern — test what happens when the first provider fails
3. Build your own simple AI text client following this pattern

---

## 11. Rate Limiting

**File:** `server.ts` — in-memory rate limiter implementation

### What to learn

- **In-memory rate limiting** — `Map<string, { count, resetAt }>`
- **Sliding window** — tokens reset after `windowMs`
- **Multiple rate limit keys** — per-IP and per-email buckets
- **Rate limit headers** — `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `Retry-After`
- **Per-endpoint limits** — different limits for login vs register vs API

### Key code to study

```typescript
const createRateLimiter = (name, rule, options = {}) =>
  (req, res, next) => {
    const { keys } = getRateLimitKeys(name, req, options.includeEmail ?? true);
    const buckets = keys.map(key => ({
      key,
      bucket: rateLimitBuckets.get(key),
    }));

    const limited = buckets.find(b => b.bucket && b.bucket.count >= rule.max);
    if (limited) {
      return res.status(429).json({ error: rule.message });
    }

    // Update buckets
    for (const { key, bucket } of buckets) {
      const next = !bucket || bucket.resetAt <= now
        ? { count: 1, resetAt: now + rule.windowMs }
        : { count: bucket.count + 1, resetAt: bucket.resetAt };
      rateLimitBuckets.set(key, next);
    }
    next();
  };

// Applied per-route
const authRateLimiters = {
  login: createRateLimiter("login", { windowMs: 15 * 60 * 1000, max: 5, ... }),
  register: createRateLimiter("register", { windowMs: 30 * 60 * 1000, max: 5, ... }),
};

app.post("/api/auth/login", authRateLimiters.login, async (req, res) => { ... });
```

### Practice

1. Write a simple rate limiter from scratch
2. Add rate limiting to a new route

---

## 12. Domain Services

**File:** `server/services/transactionDedup.ts`, `server/services/aiUsage.ts`

### What to learn

- **Responsibility separation** — extracting complex logic out of route handlers
- **Transaction deduplication** — fuzzy matching using Levenshtein distance and token analysis
- **Fingerprinting** — SHA-256 hashing to create unique row identities
- **AI usage tracking** — recording every AI call with tokens, cost, and status
- **AsyncLocalStorage** — passing request context (userId, feature) without threading it through every function call

### Key code to study

```typescript
// transactionDedup.ts — fuzzy identity matching
export const areTransactionIdentitiesSimilar = (left: string, right: string) => {
  const leftTokens = identityTokens(left);
  const rightTokens = identityTokens(right);
  const matches = leftTokens.filter(leftToken =>
    rightTokens.some(rightToken => editDistance(leftToken, rightToken) <= maxDistance)
  ).length;
  return matches / Math.min(leftTokens.length, rightTokens.length) >= 0.6;
};

// aiUsage.ts — context propagation
const requestContext = new AsyncLocalStorage<AiRequestContext>();
// Set at middleware boundary
return requestContext.run({ ...context, skipGemini: atLimit }, next);
// Read anywhere downstream
export const shouldSkipGeminiForMonthlyLimit = () => Boolean(requestContext.getStore()?.skipGemini);
```

### Practice

1. Extract a simple business function from `server.ts` into its own service file
2. Understand how `AsyncLocalStorage` works (it's like React Context for Node.js)

---

## 13. Architecture & Refactoring

**File:** `docs/ARCHITECTURE.md`, `docs/API_FLOW.md`

### What to learn

- **Current state** — monolith in `server.ts` with ~6000 lines
- **Target state** — modular structure under `server/`:
  ```
  server/
    app.ts        # Express setup
    config/       # env, logger
    db/           # client, migrations
    middleware/   # auth, requestLogger, upload
    modules/     # routes grouped by domain (target)
    services/    # business logic
    utils/       # validation, normalization helpers
  ```
- **Why refactor** — readability, testability, knowledge transfer
- **API client pattern** — Axios instance with interceptors
- **React Query pattern** — hooks + query keys + invalidation

### Key code to study

```typescript
// docs/ARCHITECTURE.md — the refactoring roadmap
// Current: Everything in server.ts
// Target: server/modules/ with one file per domain
// server/modules/auth.ts, server/modules/transactions.ts, etc.
```

### Practice

1. Take one route (e.g., `/api/transactions`) and extract it into `server/modules/transactions.ts`
2. Move its validation functions into `server/utils/validation.ts`
3. Import and use it in `server.ts`

---

## 14. Learning Path Summary

### Phase 1: Foundations (Week 1)
| Concept | File | Status |
|---------|------|--------|
| Express app setup | `server.ts` (top 60 lines) | |
| Environment config | `server/config/env.ts` | |
| MySQL queries | `server/db/client.ts` | |
| Basic routes | `server.ts` — health check, auth routes | |

### Phase 2: Authentication & Middleware (Week 2)
| Concept | File | Status |
|---------|------|--------|
| JWT tokens | `server/middleware/auth.ts` | |
| Middleware chaining | `server/middleware/requestLogger.ts` | |
| Rate limiting | Inline in `server.ts` | |
| Cookie/session management | `createAuthResponse()` in `server.ts` | |

### Phase 3: CRUD & Validation (Week 3)
| Concept | File | Status |
|---------|------|--------|
| Transaction CRUD | `/api/transactions` routes in `server.ts` | |
| Input validation | `normalizeTransactionBody()`, `validateProfileInput()` | |
| Query parameter filtering | `getTransactionFilters()` in `server.ts` | |
| File uploads | `server/middleware/upload.ts` | |

### Phase 4: Advanced Patterns (Week 4)
| Concept | File | Status |
|---------|------|--------|
| AI provider chain | `generateAiText()` in `server.ts` | |
| Email sending | `sendAppEmail()` in `server.ts` | |
| Transaction dedup | `server/services/transactionDedup.ts` | |
| AI usage tracking | `server/services/aiUsage.ts` | |

### Phase 5: Architecture (Week 5+)
| Concept | File | Status |
|---------|------|--------|
| Service extraction | Move logic from `server.ts` to modules | |
| Domain services | `server/services/*` pattern | |
| Testing | Scripts in `scripts/` directory | |
| Deployment | `render.yaml`, `vercel.json` | |

### Commands to Run as You Learn

```bash
# Start the dev server
npm run dev

# Lint your changes
npm run lint

# Verify API endpoints
npm run verify:api

# View database tables (requires MySQL CLI)
mysql -u root -p -e "USE expense_tracker; SHOW TABLES;"

# Test a route with curl
curl http://localhost:3000/api/health

# Type check
npx tsc --noEmit
```

---

> **Tip:** Start by reading `server.ts` from top to bottom — it's the biggest file but it contains every backend concept you need to learn. Use the table of contents above to jump to specific sections.
>
> **Next:** Open `server.ts` and find each pattern listed in this guide. Read the corresponding code, then try to recreate a simplified version in a new file.

