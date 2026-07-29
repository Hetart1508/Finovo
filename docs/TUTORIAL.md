# Node.js Backend Mastery — Step by Step Tutorial

**Project:** Finovo (Expense Tracker)  
**Goal:** Learn Node.js from absolute zero by studying a real production backend  
**Style:** Incremental — each session builds on the previous one

---

## Before You Start

### What You Need
- **Node.js** installed (`node -v` in terminal to check)
- **A text editor** (VS Code is open, you're good)
- **Basic JavaScript** (variables, functions, objects, arrays)
- **No Express/Node experience required**

### How This Works
1. Read the tutorial concept below
2. Open the referenced file in the project
3. Read the code along with the explanation
4. Try the practice exercise

---

# SESSION 1: What is a Backend? What is Node.js?

## 1.1 The Big Picture

When you use Finovo in your browser (the frontend), the app needs to:
- **Save** your transactions somewhere (a database)
- **Fetch** your transaction history
- **Authenticate** you (login)
- **Process** images with AI

The **backend** is the program that does all of this on a server. It:
1. Listens for requests from the frontend
2. Processes them (talks to database, runs AI, etc.)
3. Sends back a response (usually JSON)

## 1.2 What is Node.js?

Node.js lets you write backend code in **JavaScript** — the same language used in browsers. Before Node.js, you needed a different language (PHP, Python, Java) to write backends.

**Key insight:** Node.js is just JavaScript that runs on a computer/server instead of a browser.

## 1.3 The Project's Backend Entry Point

Open **`server.ts`** in your editor. Look at the very first line:

```typescript
import "dotenv/config";
```

This loads environment variables from a `.env` file (like passwords, API keys).

```typescript
import express from "express";
```

This imports the **Express** library — the most popular Node.js framework. Express makes it easy to handle HTTP requests.

```typescript
const app = express();
```

This creates the Express application. Everything else builds on this `app` variable.

## 1.4 Simple Server Pattern

Every Node.js/Express server follows this pattern:

```typescript
// 1. Import express
import express from "express";

// 2. Create the app
const app = express();

// 3. Define a route (what happens when someone visits /hello)
app.get("/hello", (req, res) => {
  res.send("Hello World!");
});

// 4. Start listening
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

Now find this in the **Finovo codebase** — at the very bottom of `server.ts`, you'll see:

```typescript
app.listen(PORT, () => {
  logger.info(`Server started on http://localhost:${PORT}`);
});
```

This is the **same pattern** but with proper logging using the project's logger.

## 1.5 Key Vocabulary

| Term | Meaning | Example |
|------|---------|---------|
| **Server** | A program that waits for requests | This whole `server.ts` file |
| **Route** | A URL pattern + handler | `app.get("/api/health", ...)` |
| **Request (req)** | What the client sends | URL, headers, body data |
| **Response (res)** | What the server sends back | JSON, HTML, status code |
| **Port** | A numbered door on the computer | Port 3000 |

## ✅ Practice

1. Open `server.ts` and find `app.get("/api/health", ...)`
2. Change the message to include your name
3. Run `npm run dev` in terminal
4. Visit `http://localhost:3000/api/health` in your browser

---

# SESSION 2: HTTP Methods and Routes

## 2.1 What Happens When You Open Finovo?

When you log into Finovo and see your transactions, this happens:

```
Browser ───GET /api/transactions───→ Backend
                                        │
                                        │ Query MySQL database
                                        │
Browser ←───── JSON with transactions ── Backend
```

## 2.2 HTTP Methods (Verbs)

Every request has a **method** that tells the server what to do:

| Method | Purpose | Finovo Example |
|--------|---------|----------------|
| `GET` | Read/fetch data | `GET /api/transactions` → list all transactions |
| `POST` | Create new data | `POST /api/transactions` → add a new transaction |
| `PATCH` | Update partially | `PATCH /api/transactions/5` → edit transaction #5 |
| `PUT` | Replace entirely | `PUT /api/user/profile` → replace profile |
| `DELETE` | Remove data | `DELETE /api/transactions/5` → delete transaction #5 |

## 2.3 Route Patterns in Finovo

Open `server.ts` and search for these patterns (they appear thousands of lines in):

### GET — Fetch data
```typescript
app.get("/api/transactions", authenticateToken, async (req, res) => {
  // ... fetches transactions from database
  res.json(transactions);
});
```

### POST — Create data
```typescript
app.post("/api/transactions", authenticateToken, async (req, res) => {
  const result = await createTransaction(req.user.id, req.body);
  res.status(result.status).json(result.body);
});
```

### DELETE — Remove data
```typescript
app.delete("/api/transactions/:id", authenticateToken, async (req, res) => {
  // req.params.id gets the :id from the URL
  const id = toPositiveInteger(req.params.id);
  // ... deletes from database
  res.json({ message: "Transaction deleted successfully", id });
});
```

## 2.4 Route Parameters (`:id`)

In the URL `/api/transactions/:id`, the `:id` is a **route parameter**:

```
URL:  /api/transactions/42
             ↓
req.params.id === "42"
```

Find this in Finovo: search for `/:id` in `server.ts`. You'll see many patterns like:
- `/api/transactions/:id`
- `/api/wallets/:walletId/members`
- `/api/merchant-aliases/:id`

## 2.5 Query Parameters

Sometimes data comes in the URL after `?`:

```
/api/transactions?type=expense&from=2024-01-01
                    ↓
req.query.type === "expense"
req.query.from === "2024-01-01"
```

Find this in Finovo: look for `getTransactionFilters(req.query, ...)` — this function parses query parameters to build database queries.

## ✅ Practice

1. Find every `app.get(...)` in `server.ts` — there are about 20+ of them
2. Find every `app.post(...)`
3. Spot the difference between route params (`:id`) and query params (`?filter=value`)
4. **Try:** Visit `http://localhost:3000/api/auth/me` — what happens? (Hint: you need authentication!)

---

# SESSION 3: Middleware — The Pipeline

## 3.1 What is Middleware?

**Middleware** is a function that runs **between** receiving a request and sending a response. Think of it as a pipeline:

```
Request comes in
       │
       ▼
  [Middleware 1: Logger]  ← logs the request
       │
       ▼
  [Middleware 2: Auth]    ← checks if user is logged in
       │
       ▼
  [Route Handler]         ← does the actual work
       │
       ▼
Response goes out
```

Every middleware can either:
1. **Pass through** → call `next()`
2. **Stop and respond** → send a response (like 401 Unauthorized)

## 3.2 Middleware Signature

```typescript
const myMiddleware = (req, res, next) => {
  // Do something
  next(); // Pass to the next middleware
};
```

## 3.3 Global vs Route-Level Middleware

### Global (applies to all routes)
In Finovo, look at the top of `server.ts`:

```typescript
app.use(compression());         // Compress responses
app.use(helmet({...}));         // Security headers
app.use(cors({...}));           // Allow cross-origin requests
app.use(express.json({...}));   // Parse JSON request bodies
app.use(requestLogger);         // Log every request
```

These apply to **every** route automatically.

### Route-level (applies to specific routes)

```typescript
app.get("/api/transactions", authenticateToken, async (req, res) => {
  //           Only this route  ↑ gets auth middleware
});
```

## 3.4 The Request Logger Middleware

Open **`server/middleware/requestLogger.ts`**:

```typescript
export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = Date.now();

  // Listen for when the response finishes
  res.on("finish", () => {
    logger.info("request", {
      method: req.method,        // GET, POST, etc.
      path: req.originalUrl,     // /api/transactions
      status: res.statusCode,    // 200, 404, etc.
      durationMs: Date.now() - startedAt,  // How long it took
    });
  });

  next();  // Pass to the next middleware/route handler
};
```

**What it does:** Every request gets logged with its method, path, status code, and duration.

## 3.5 The Auth Middleware

Open **`server/middleware/auth.ts`**:

```typescript
export const authenticateToken: RequestHandler = (req: any, res, next) => {
  // 1. Extract token from Authorization header or cookie
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];  // "Bearer <token>" → <token>

  if (!token) return res.sendStatus(401);  // No token → unauthorized

  // 2. Verify the JWT
  jwt.verify(token, JWT_SECRET, async (err, user: any) => {
    if (err) return res.sendStatus(401);  // Invalid token

    // 3. Attach user to request
    req.user = user;
    next();  // → proceed to the route handler
  });
};
```

**Key insight:** `req.user` is *injected* by the middleware. Every route handler can then access `req.user.id` to know who made the request.

## ✅ Practice

1. Open `server/middleware/auth.ts` and trace the full flow
2. Find where `req.user` is created and where it's used in a route handler
3. **Question:** What would happen if you called `next()` inside an `if` statement? (Hint: the route would hang)
4. **Question:** Why is `return res.sendStatus(401)` used instead of just `res.sendStatus(401)`?

---

# SESSION 4: The Request-Response Cycle

## 4.1 The `req` Object (Request)

When a client sends a request, Express gives you a `req` object with all the data:

```typescript
app.post("/api/transactions", authenticateToken, async (req, res) => {
  req.body          // The JSON body sent by client  { amount: 500, type: "expense" }
  req.params        // Route parameters              { id: "42" }
  req.query         // Query string parameters        { type: "expense", from: "2024-01" }
  req.headers       // HTTP headers                   { authorization: "Bearer ..." }
  req.user          // Added by auth middleware       { id: 1, email: "..." }
  req.ip            // Client IP address
});
```

## 4.2 The `res` Object (Response)

The `res` object is how you send data back:

```typescript
// Most common: JSON response
res.json({ id: 1, name: "My Wallet" });

// With a status code
res.status(201).json({ id: 1 });

// Just a status code (no body)
res.sendStatus(401);

// Redirect
res.redirect(303, "/auth");

// Set headers
res.setHeader("RateLimit-Limit", "100");
```

## 4.3 Response Status Codes

In Finovo, you'll see these status codes:

| Code | Meaning | When Used |
|------|---------|-----------|
| `200` | OK | Successful GET, PATCH, PUT, DELETE |
| `201` | Created | Successful POST (new resource) |
| `400` | Bad Request | Missing or invalid input |
| `401` | Unauthorized | Not logged in |
| `403` | Forbidden | Logged in but not allowed |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Duplicate (e.g., duplicate transaction) |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Something broke |

## 4.4 Trace a Complete Request

Let's trace what happens when you add a transaction in Finovo:

### Step 1: The route definition (in `server.ts`)
```typescript
app.post("/api/transactions", authenticateToken, async (req, res) => {
  const resolved = await resolveWalletIdForUser(req.user.id, req.body?.wallet_id);
  if ("status" in resolved) {
    return res.status(resolved.status).json(resolved.body);
  }
  const result = await createTransaction(req.user.id, req.body, resolved.walletId);
  res.status(result.status).json(result.body);
});
```

### Step 2: What happens inside `createTransaction()`?
```typescript
const createTransaction = async (userId, body, walletId) => {
  // 1. Validate input
  const normalized = normalizeTransactionBody(body);
  if ("status" in normalized) return normalized;  // Invalid → return error

  // 2. Check for duplicates (this is what "ER_DUP_ENTRY" means)
  const duplicate = await getDuplicateTransaction(walletId, normalized.transaction);
  if (duplicate) return duplicateTransactionResult(duplicate);

  // 3. Insert into database
  const info = await insertTransaction(userId, normalized.transaction, walletId);

  // 4. Return success
  return { status: 201, body: { id: info.insertId, ... } };
};
```

### Step 3: The response
```json
// Success (201)
{ "id": 123, "amount": 500, "type": "expense", ... }

// Or failure (400)
{ "error": "Amount must be a positive number" }
```

## ✅ Practice

1. Find where `res.status(201)` is used in `server.ts` (hint: it's in `insertTransaction`)
2. Find where `res.status(409)` is used (duplicate handling)
3. Trace the complete flow for `GET /api/transactions`
4. **Try:** Use Postman or `curl` to test:
   ```bash
   curl http://localhost:3000/api/health
   ```

---

# SESSION 5: Working with the Database

## 5.1 MySQL Connection

Open **`server/db/client.ts`**:

```typescript
import mysql from "mysql2/promise";

// Create a connection pool (reusable connections)
export const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "expense_tracker",
  waitForConnections: true,  // Queue requests if all connections are busy
  connectionLimit: 10,       // Max 10 simultaneous connections
});
```

**What is a pool?** Creating a database connection takes time. A pool keeps connections ready so you don't create a new one for every request.

## 5.2 Three Query Helpers

```typescript
// Get MANY rows
export const queryAll = async (sql, params) => {
  const [rows] = await db.execute(sql, params);
  return rows;  // Array of rows
};

// Get ONE row (returns first or undefined)
export const queryOne = async (sql, params) => {
  const rows = await queryAll(sql, params);
  return rows[0];
};

// Execute INSERT/UPDATE/DELETE (returns affectedRows, insertId)
export const execute = async (sql, params) => {
  const [result] = await db.execute(sql, params);
  return result;  // { affectedRows: 1, insertId: 123 }
};
```

## 5.3 Parameterized Queries (IMPORTANT!)

**Never** do this (SQL injection vulnerability):
```typescript
// ❌ DANGEROUS — never use string concatenation
const sql = `SELECT * FROM users WHERE email = '${req.body.email}'`;
```

**Always** do this (safe):
```typescript
// ✅ SAFE — uses parameterized query
const sql = "SELECT * FROM users WHERE email = ?";
const result = await queryOne(sql, [req.body.email]);
```

The `?` is a placeholder. MySQL2 automatically escapes the value, preventing SQL injection.

## 5.4 Real Examples from Finovo

### Simple query (one parameter)
```typescript
// server.ts — find user by email
const user = await queryOne(
  "SELECT * FROM users WHERE email = ? AND deleted_at IS NULL",
  [email]
);
```

### Multiple parameters
```typescript
// server.ts — get wallet membership
const membership = await queryOne(`
  SELECT wallets.id, wallets.name, wallets.type, wallet_members.role
  FROM wallets
  JOIN wallet_members ON wallet_members.wallet_id = wallets.id
  WHERE wallets.id = ? AND wallet_members.user_id = ?
  LIMIT 1
`, [walletId, userId]);
```

### INSERT with returned ID
```typescript
// server.ts — create a user
const info = await execute(
  "INSERT INTO users (email, password, name) VALUES (?, ?, ?)",
  [email, hashedPassword, name]
);
// info.insertId → the new user's ID
```

### Dynamic WHERE clauses
```typescript
// server.ts — building filters dynamically
const conditions = ["transactions.wallet_id = ?"];
const params = [walletId];

if (query.type) {
  conditions.push("transactions.type = ?");
  params.push(query.type);
}
if (query.from) {
  conditions.push("transactions.date >= ?");
  params.push(query.from);
}

const sql = `SELECT * FROM transactions WHERE ${conditions.join(" AND ")}`;
const results = await queryAll(sql, params);
```

## ✅ Practice

1. Open `server/db/client.ts` and understand all three helpers
2. Find examples of each helper in `server.ts`
3. **Try:** Connect to the database directly:
   ```bash
   mysql -u root -p -e "USE expense_tracker; SELECT * FROM transactions LIMIT 5;"
   ```
4. **Write:** A query that gets all transactions for a specific user sorted by date

---

# SESSION 6: Authentication with JWT

## 6.1 What is JWT?

**JWT** (JSON Web Token) is a string that proves a user is logged in. It looks like:

```
eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MX0.abc123def456
```

It has three parts separated by dots:

1. **Header** — algorithm type
2. **Payload** — data (user id, email)
3. **Signature** — verifies the token wasn't tampered with

## 6.2 Login Flow

```
1. User sends email + password
          │
          ▼
2. Server checks password hash in database
          │
          ▼
3. Server creates a JWT
   jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "2h" })
          │
          ▼
4. Server sends JWT back in cookie + response body
          │
          ▼
5. Browser stores the token
6. Browser sends token with every request (in Authorization header)
```

## 6.3 Find the Login Route

In `server.ts`, find `app.post("/api/auth/login", ...)`:

```typescript
app.post("/api/auth/login", authRateLimiters.login, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");

  // 1. Find user by email
  const user = await queryOne("SELECT * FROM users WHERE email = ?", [email]);
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  // 2. Check password (bcrypt.compare compares hash to plain text)
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) return res.status(401).json({ error: "Invalid email or password" });

  // 3. Create JWT
  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: SESSION_EXPIRES_IN }  // Usually "2h" (2 hours)
  );

  // 4. Set cookie and return response
  res.cookie("finovo_session", token, { httpOnly: true, secure: true, sameSite: "none" });
  res.json({ user: { id: user.id, email: user.email, name: user.name }, expiresAt });
});
```

## 6.4 Protecting Routes

Any route with `authenticateToken` middleware requires a valid JWT:

```typescript
// Protected route — needs authentication
app.get("/api/transactions", authenticateToken, async (req, res) => {
  // req.user exists here because auth middleware added it
  const userId = req.user.id;
  // ...
});
```

## 6.5 Password Hashing with bcrypt

Passwords are **never** stored as plain text:

```typescript
// Registration — hash the password before storing
const hashedPassword = await bcrypt.hash(password, 10);  // 10 = salt rounds

// Login — compare plain text with stored hash
const isValid = await bcrypt.compare(password, user.password);
// Returns true/false
```

## ✅ Practice

1. Find the login route in `server.ts` and trace every step
2. Find where `jwt.sign()` is called (hint: it's inside `createAuthResponse()`)
3. Find where `bcrypt.compare()` is called
4. **Question:** Why can't you just read `user.password` to get the password?

---

# SESSION 7: Validation and Error Handling

## 7.1 Why Validate?

Every input from the client is potentially dangerous or malformed. Validation is the process of checking:
- Is the value present? (not undefined/null/empty)
- Is it the right type? (number, string, array)
- Is it within acceptable bounds? (positive, not too long)
- Is it a valid format? (email, date, URL)

## 7.2 Helper Functions for Validation

Finovo has several reusable validation helpers. Find them in `server.ts`:

```typescript
// Check if a value is a non-empty string
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

// Convert to number (returns null if invalid)
const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// Convert to positive integer (returns null if invalid)
const toPositiveInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

// Validate a date string (must be YYYY-MM-DD)
const isValidDateString = (value: unknown) =>
  isNonEmptyString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);

// Check if a date is in the future
const isFutureDateString = (value: string) => value > getTodayDateString();
```

## 7.3 The Validation Pattern

Most validation functions in Finovo return a **union type**:

```typescript
type ValidationResult<T> = { data: T } | { error: string };
```

This means you always check for errors first:

```typescript
const validated = validateProfileInput(req.body);
if ("error" in validated) {
  // Something was wrong
  return res.status(400).json({ error: validated.error });
}

// Safe to use validated.data
const profile = validated.data;
```

## 7.4 Real Validation Example

Find `normalizeTransactionBody()` in `server.ts`:

```typescript
const normalizeTransactionBody = (body: any) => {
  const { amount, type, category, date, payment_mode } = body;

  // Check: amount must be a positive number
  const parsedAmount = toNumber(amount);
  if (parsedAmount === null || parsedAmount <= 0) {
    return { status: 400, body: { error: "Amount must be a positive number" } };
  }

  // Check: type must be expense or income
  if (type !== "expense" && type !== "income") {
    return { status: 400, body: { error: "Type must be expense or income" } };
  }

  // Check: required fields
  if (!isNonEmptyString(category) || !isValidDateString(date) || !isNonEmptyString(payment_mode)) {
    return { status: 400, body: { error: "Category, date, and payment mode are required" } };
  }

  // Check: no future dates
  if (isFutureDateString(date)) {
    return { status: 400, body: { error: "Transaction date cannot be in the future" } };
  }

  // All validations passed → return the clean data
  return { transaction: { amount: parsedAmount, type, category, date, ... } };
};
```

## 7.5 Email Normalization

Common input cleaning pattern:

```typescript
// Normalize email: trim + lowercase
const normalizeEmail = (value: unknown) =>
  isNonEmptyString(value) ? value.trim().toLowerCase() : "";

// Now "HetArth@Gmail.COM " becomes "hetarth@gmail.com"
```

## ✅ Practice

1. Find all validation helpers at the top of `server.ts`
2. Find `validateProfileInput()` and understand its structure
3. **Question:** What does `"error" in validated` check?
4. **Question:** Why validate on the backend if the frontend already validates?

---

# SESSION 8: Async/Await and Promises

## 8.1 Why Async Matters in Backend

Almost everything in a backend is **asynchronous**:
- Waiting for database queries
- Fetching data from external APIs
- Reading files
- Sending emails

While waiting, Node.js can handle **other requests** — this is the key to its performance.

## 8.2 The Pattern

```typescript
// Route handler with async
app.get("/api/transactions", authenticateToken, async (req, res) => {
  try {
    // This line PAUSES the function but NOT the server
    const transactions = await queryAll("SELECT * FROM transactions");
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});
```

**Key insight:** `await` pauses only this specific function. Other requests are still being handled.

## 8.3 Parallel Execution

Sometimes you need to do multiple things that don't depend on each other:

```typescript
// Sequential (slow): wait 1s, then wait 0.5s = 1.5s total
const profile = await queryOne("SELECT * FROM profiles WHERE user_id = ?", [id]);
const transactions = await queryAll("SELECT * FROM transactions WHERE user_id = ?", [id]);

// Parallel (fast): both start at same time, finish in 1s total
const [profile, transactions] = await Promise.all([
  queryOne("SELECT * FROM profiles WHERE user_id = ?", [id]),
  queryAll("SELECT * FROM transactions WHERE user_id = ?", [id]),
]);
```

Find this in Finovo at `server/services/aiUsage.ts`:

```typescript
const [summary, features, recent, settings] = await Promise.all([
  queryOne(`SELECT ... FROM ai_usage_events WHERE ...`),
  queryAll(`SELECT ... GROUP BY feature ...`),
  queryAll(`SELECT ... ORDER BY id DESC LIMIT 5`),
  getSettings(),
]);
```

## 8.4 Error Handling with try/catch

Every async route should have error handling:

```typescript
app.post("/api/auth/login", authRateLimiters.login, async (req, res) => {
  try {
    // ... login logic ...
    res.json(session);
  } catch (error) {
    // If anything in 'try' throws, we catch it here
    logger.error("Login error", { error });
    res.status(500).json({ error: "Failed to login" });
  }
});
```

## ✅ Practice

1. Find 3 examples of `await` in `server.ts`
2. Find 2 examples of `Promise.all`
3. Find one `try/catch` in a route handler
4. **Question:** What happens if you forget `await` before a database query?

---

# SESSION 9: Exploring the Full Route Map

Now that you understand the basics, let's map out **every** route in Finovo. This gives you a complete picture of what a real backend looks like.

## Auth Routes (no token needed)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/register` | Create account (sends OTP) |
| POST | `/api/auth/register/verify-otp` | Verify OTP, finish registration |
| POST | `/api/auth/login` | Login with email + password |
| POST | `/api/auth/google` | Login with Google |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with OTP |
| POST | `/api/auth/logout` | Clear session |

## Protected Routes (need JWT token)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/auth/me` | Get current user info |
| GET | `/api/wallets` | List user's wallets |
| POST | `/api/wallets` | Create a new wallet |
| GET | `/api/transactions` | List transactions (with filters) |
| POST | `/api/transactions` | Create a transaction |
| GET | `/api/transactions/:id` | Get one transaction |
| PATCH | `/api/transactions/:id` | Update a transaction |
| DELETE | `/api/transactions/:id` | Delete a transaction |
| GET | `/api/transactions/summary` | Get income/expense totals |
| GET | `/api/transactions/categories` | Get spending by category |
| GET | `/api/user/profile` | Get user profile |
| PUT | `/api/user/profile` | Update user profile |

## ✅ Practice

1. Open `server.ts` and verify each route exists
2. Group routes by domain (auth, transactions, wallets, etc.)
3. **Question:** Why are auth routes defined BEFORE the rate limiter middleware?

---

# SESSION 10: Putting It All Together

## The Complete Request Lifecycle

Let's trace one complete request — creating a transaction — from start to finish:

### Step 1: Request arrives
```
Client sends:
POST /api/transactions
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
Content-Type: application/json

{
  "amount": 500,
  "type": "expense",
  "category": "Food",
  "date": "2025-01-15",
  "payment_mode": "UPI",
  "description": "Lunch at restaurant"
}
```

### Step 2: Middleware chain
```
app.use(compression())      → passes through
app.use(helmet())           → passes through (sets security headers)
app.use(cors())             → passes through (allows cross-origin)
app.use(express.json())     → parses body → req.body is now an object
app.use(requestLogger)      → logs the request, calls next()
```

### Step 3: Route-specific middleware
```
app.post("/api/transactions", authenticateToken, ...)
                                   ↓
authenticateToken:
  1. Extract token from header
  2. jwt.verify(token, JWT_SECRET)  → if valid, req.user = { id: 1 }
  3. Calls next()
```

### Step 4: Route handler
```
app.post("/api/transactions", ..., async (req, res) => {
  1. resolveWalletIdForUser(req.user.id, req.body.wallet_id)
     → Ensures user has a personal wallet
     → Returns walletId

  2. createTransaction(req.user.id, req.body, walletId)
     a. normalizeTransactionBody(req.body)
        → validates amount, type, category, date
        → returns clean data or error
     b. getDuplicateTransaction(walletId, transaction)
        → checks if same transaction already exists
     c. insertTransaction(...)
        → INSERT INTO transactions (...) VALUES (...)
        → Returns { status: 201, body: { id: 123, ... } }

  3. res.status(201).json({ id: 123, amount: 500, ... })
})
```

### Step 5: Response sent back
```json
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": 123,
  "user_id": 1,
  "wallet_id": 1,
  "amount": 500,
  "type": "expense",
  "category": "Food",
  "date": "2025-01-15",
  "payment_mode": "UPI",
  "description": "Lunch at restaurant"
}
```

## You Now Understand Node.js Backend Development

You have learned:
1. ✅ How Express servers are structured
2. ✅ HTTP methods and routes
3. ✅ Middleware pipeline
4. ✅ Request/response cycle
5. ✅ Database operations (CRUD)
6. ✅ JWT authentication
7. ✅ Input validation
8. ✅ Async/await patterns
9. ✅ Complete request tracing

## Next Steps for Mastery

### Intermediate Concepts (in this project)
1. **Rate limiting** — Study the custom rate limiter in `server.ts`
2. **File uploads** — Study `server/middleware/upload.ts`
3. **Email service** — Study `sendAppEmail()` in `server.ts`
4. **Transaction dedup** — Study `server/services/transactionDedup.ts`
5. **AI provider chain** — Study `generateAiText()` in `server.ts`

### Advanced Concepts
1. **Testing** — Study scripts in `scripts/` directory
2. **Error classification** — Study `getEmailErrorMessage()`
3. **AsyncLocalStorage** — Study `server/services/aiUsage.ts`
4. **Architecture refactoring** — Study `docs/ARCHITECTURE.md`

### Build Your Own
The best way to master: build a **mini version** of this:
1. Express server with 2-3 routes
2. MySQL database with 1-2 tables
3. JWT authentication
4. Input validation
5. Deploy it somewhere (Render, Railway, Fly.io)

---

> **Remember:** Every complex system is just small pieces working together. You've now seen all the pieces.

