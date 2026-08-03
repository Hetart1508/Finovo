# Finovo — Startup & Production Readiness Roadmap

> **Goal:** Prepare Finovo for production-grade quality, investor-grade engineering, and rigorous testing of all existing functionalities — while keeping performance optimized across the web app, backend API, and the React Native mobile app.

---

## 1. Executive Summary

Finovo is a feature-rich AI-powered personal finance tracker for the Indian market. It already has:

- **Web app** (React + Vite + TanStack Query + Tailwind)
- **Backend** (Express + MySQL, single `server.ts` bootstrap)
- **Mobile app** (React Native / Expo, in progress)
- **AI layer** (Gemini + Groq + OpenRouter + HuggingFace with fallback chaining)
- **Auth** (JWT + OTP + Google OAuth + rate limiting + lockout)
- **Deployment config** (Vercel + Render + Aiven MySQL)

**What is missing to reach "startup-level" quality:**

1. **Automated testing** — there is currently *no unit, integration, or E2E test framework*. The only "tests" are verify scripts that grep the source for endpoint strings.
2. **Backend modularization** — `server.ts` is still ~6,000 lines and owns all routes, validations, AI logic, email, and business rules.
3. **Observability** — no structured error tracking, metrics, tracing, or alerting.
4. **CI/CD** — no pipeline for lint, test, build, and deploy on every commit.
5. **Security hardening** — no secrets manager, no audit on file uploads/S3, no rate-limit persistence, no scan pipeline.
6. **Performance budget** — no load tests, no bundle analysis, no query/N+1 audits, no caching strategy.
7. **Investor readiness** — no product metrics, no privacy/security documentation, no demo/seed data, no analytics event plan.

This roadmap is organized into **8 phases** with concrete deliverables, acceptance criteria, and effort estimates. Start with **Phase 1** (test foundation) and **Phase 2** (backend modularization) because they unblock everything else.

---

## 2. Current State Assessment (Baseline Audit)

| Area | Current State | Gap |
| --- | --- | --- |
| **Testing** | `verify-*.mjs` scripts only grep source for endpoint strings | No assertion framework, no test runner, no DB mocks, no CI |
| **Backend** | `server.ts` ~6,000 lines; some modules split (config, db, middleware) | Routes, AI, email, validations still monolith |
| **Frontend** | Pages refactored into feature modules; React Query used | No component tests, no E2E, bundle size not measured |
| **Mobile** | Foundation + auth + dashboard read paths done | Phases 2–7 pending (see `react-native/ROADMAP.md`) |
| **Security** | Helmet, CORS, rate limiting, cookie flags, JWT | No secret manager, no upload-object-storage, no pen-test |
| **Performance** | Vite manual chunks; compression enabled | No load test, no LRU cache, no index audit, no bundle analysis |
| **Observability** | Winston logger with request logging | No error tracking, no metrics, no tracing, no alerting |
| **CI/CD** | None | No automation for test/build/deploy |
| **Docs** | Good developer docs (`docs/*`) | Missing security, privacy, runbook, on-call docs |

---

## 3. Phase 1 — Test Foundation (P0)

**Purpose:** Introduce a real automated test stack so every later change is verifiable. This is the single highest-leverage investment.

### 3.1 Test Stack

- **Unit + integration (backend):** `vitest` + `supertest`
- **Unit (frontend):** `vitest` + `@testing-library/react` + `jsdom`
- **E2E (web):** `Playwright`
- **E2E (API):** `newman` (Postman CLI) against the collection in `postman/`
- **Coverage:** `@vitest/coverage-v8`

### 3.2 Deliverables

1. Add `vitest`, `supertest`, `@testing-library/react`, `jsdom`, `@playwright/test`, `newman` as dev dependencies.
2. Create `vitest.config.ts` (split into `vitest.unit` and `vitest.integration` projects).
3. Add `test` scripts to `package.json`:
   ```json
   "test:unit": "vitest run --project unit",
   "test:integration": "vitest run --project integration",
   "test:api": "newman run postman/Finovo-Expense.postman_collection.json -e postman/Finovo-Expense.postman_environment.json",
   "test:e2e": "playwright test",
   "test:coverage": "vitest run --coverage"
   ```
4. Refactor the flaky `verify-*.mjs` scripts into real tests (keep them as build guards if desired).
5. Add a **test database** (MySQL or SQLite via an abstraction) so integration tests never touch dev data.
6. Add a **factories module** for generating users, transactions, wallets, recurring events, investments.

### 3.3 Priority Test Targets (cover existing functionality)

| Area | Test Type | What to cover |
| --- | --- | --- |
| Auth (register, OTP, login, reset, Google, lockout) | Integration | Success + failure, rate limiting, generic errors |
| Transactions (CRUD, filters, dedup, pagination) | Integration | CRUD, duplicate detection, legacy dedup, filters |
| Statement import (preview, approve, aliases) | Integration | Parsing, dedup, alias enrichment, duplicate statement |
| Recurring (CRUD, due dates, yearly schedule) | Integration | Due-date math, frequency, interval |
| Investments (CRUD, projections, SIP calc) | Integration | Projection math, CAGR, validation |
| AI (extract bill, extract text, insights, advisor) | Integration (mocked) | Provider fallback chain, JSON parsing, validation |
| Email / monthly report | Integration (mocked) | Report build, email send, cron auth |
| Frontend pages | Component | Render each page, key interactions, empty/error states |
| Web E2E | E2E | Full user journey: register → add → dashboard → insights |

### 3.4 Acceptance Criteria

- `npm run test:unit` and `npm run test:integration` pass in CI.
- Coverage ≥ 60% on backend core modules and ≥ 40% overall (raise over time).
- Every existing API endpoint has at least one integration test.
- Playwright covers the main happy path end-to-end.

**Effort:** ~2–3 weeks.

---

## 4. Phase 2 — Backend Modularization & API Cleanup (P0)

**Purpose:** Break `server.ts` into maintainable, testable modules. This is the prerequisite for clean testing and scaling.

### 4.1 Target Structure

```txt
server/
  app.ts                 # express app assembly (small)
  server.ts              # bootstrap only: import app, connect DB, start
  config/                # env, logger (done)
  db/                    # client, migrations (done)
  middleware/            # auth, requestLogger, upload, rateLimit, errorHandler
  services/              # ai, email, dedup, report, advisor, aiUsage
  modules/               # one folder per domain
    auth/
    transactions/
    recurring/
    investments/
    wallets/
    statement-import/
    merchant-aliases/
    ai-advisor/
    insights/
    user/
    admin/
  utils/                 # validators, normalizers, formatters
```

### 4.2 Deliverables

1. Extract route handlers into `server/modules/<domain>/` (each exports an Express Router).
2. Extract all validation/normalization helpers into `server/utils/`.
3. Extract AI provider logic into `server/services/ai/` (gemini, openai-compatible, vision, fallback).
4. Extract email + report logic into `server/services/email/` and `server/services/report/`.
5. Extract the in-memory rate limiter into `server/middleware/rateLimit.ts` and **move state to Redis** (or a DB-backed store) so it survives restarts and works across multiple instances.
6. Add a centralized **error-handling middleware** and a consistent API error envelope.
7. Add **OpenAPI / Swagger** spec (`/api/docs`) generated from route definitions.
8. Keep `server.ts` under ~100 lines (bootstrap + startServer).

### 4.3 Acceptance Criteria

- `server.ts` < 100 lines.
- Each route module is independently testable with `supertest`.
- `npm run lint` passes.
- No behavior change: all existing endpoints still work (verified by Phase 1 tests).

**Effort:** ~2 weeks.

---

## 5. Phase 3 — Security, Compliance & Data Protection (P0)

**Purpose:** Make Finovo safe, trustworthy, and investor-defensible.

### 5.1 Deliverables

1. **Secrets management** — move keys out of `.env` into a manager (Vercel/Render env vars or AWS Secrets Manager / Vault). Never commit secrets.
2. **Upload object storage** — migrate `uploads/` (local) to **S3-compatible storage** (or Vercel Blob / Cloudflare R2) with **private buckets + signed URLs**. This is already flagged as a mobile requirement in `BACKEND_CONTRACT.md`.
3. **File security** — validate MIME, size, and magic bytes (already partially done in `upload.ts`); add virus scanning (ClamAV) or at least a policy.
4. **Rate limiting** — move from in-memory to Redis-backed (see Phase 2).
5. **Audit logging** — log auth events, admin actions, data exports, and suspicious activity.
6. **Data export & deletion** — GDPR-style: user data export endpoint + verify account deletion purges or anonymizes all PII.
7. **Password policy** — already strong; add zxcvbn integration and breach check (HaveIBeenPwned optional).
8. **Security headers** — already good (Helmet); add CSP report-uri and review `connectSrc`.
9. **Dependency scanning** — `npm audit` in CI + `Snyk`/`Dependabot`; pin production deps.
10. **Penetration test** — run a light OWASP ZAP scan in CI and a manual review before external release.
11. **Privacy policy + terms** — write investor-facing docs and in-app consent for AI personalization.

### 5.2 Acceptance Criteria

- No secrets in repo; `.env` gitignored (already) and scanned.
- File uploads stored in object storage with signed, expiring URLs.
- Rate limiting is persistent and multi-instance safe.
- `npm audit` has 0 high/critical vulnerabilities in CI.
- User data deletion actually removes/anonymizes PII.

**Effort:** ~2 weeks.

---

## 6. Phase 4 — Performance Optimization (P1)

**Purpose:** Make the app fast and cost-efficient; build a performance budget.

### 6.1 Backend Performance

1. **Database indexes** — profile slow queries and add indexes for the hot paths:
   - `transactions(user_id, date)`, `transactions(wallet_id, date)`, `transactions(dedupe_fingerprint)`, `transactions(import_fingerprint)`
   - `recurring_events(user_id)`, `mutual_fund_sip_investments(user_id)`, `wallet_members(wallet_id, user_id)`
2. **Query tuning** — add `EXPLAIN` on the dashboard summary, transactions list, advisor context queries.
3. **Caching** — add an in-process + Redis cache for:
   - Dashboard summaries (short TTL, invalidated on writes)
   - Merchant alias maps
   - AI provider key rotation (already in-memory)
   - Static assets
4. **Connection pooling** — verify `mysql2` pool limits and `wait_timeout`.
5. **AI cost/timeouts** — already have fallback & timeouts; add per-request response caching for repeated AI insights, and a **budget dashboard** (already exists in AI usage).
6. **Pagination enforcement** — cap `limit` on ALL list endpoints (already partially done for transactions).

### 6.2 Frontend Performance

1. **Bundle analysis** — add `vite-bundle-visualizer`; move heavy libs (tesseract.js, pdfjs-dist) to lazy-loaded dynamic imports (they are already in chunks).
2. **Code splitting** — route-level lazy loading + Suspense.
3. **Data fetching** — configure React Query `staleTime`/`gcTime`, add `keepPreviousData`, and prefetch on hover.
4. **Rendering** — memoize heavy components, virtualize long transaction/investment tables (react-window).
5. **Images/assets** — lazy-load images, use modern formats, preload critical fonts.
6. **Performance budget** — set Lighthouse thresholds (e.g., LCP < 2.5s, CLS < 0.1, TBT < 200ms) and track in CI.

### 6.3 Mobile Performance

- Use FlashList for lists, memoize re-renders, lazy-load heavy modules, reduce startup work, preload font/splash.

### 6.4 Load Testing

- Add `k6` scripts for auth, transactions, dashboard, and AI endpoints.
- Define target: e.g., **500 concurrent users, p95 < 800ms** for list endpoints, **error rate < 1%**.

### 6.5 Acceptance Criteria

- Lighthouse scores ≥ 90 on all categories.
- Slow-query log shows no full-table scans on hot paths.
- p95 response time targets met under load test.
- Bundle size tracked and PR-gated (fail if it grows > threshold).

**Effort:** ~2–3 weeks.

---

## 7. Phase 5 — CI/CD & Observability (P1)

**Purpose:** Automate quality gates and get visibility into production.

### 7.1 CI/CD Pipeline (GitHub Actions)

Add `.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npm audit --omit=dev
  test:
    runs-on: ubuntu-latest
    services:
      mysql: { image: mysql:8, env: {...}, ports: [3306:3306] }
    steps:
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run test:coverage
  build:
    runs-on: ubuntu-latest
    steps:
      - run: npm ci
      - run: npm run build
  deploy:
    if: github.ref == 'refs/heads/main'
    needs: [lint, test, build]
    runs-on: ubuntu-latest
    steps:
      - run: npm ci
      - run: npm run build
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
      - name: Deploy API to Render
        run: ... # Render deploy hook
```

### 7.2 Observability Stack

- **Error tracking:** Sentry (backend + frontend + mobile).
- **Metrics:** Prometheus endpoint on `/api/metrics` (or use Sentry performance + Datadog if budget allows).
- **Tracing:** OpenTelemetry for spans across AI calls, DB queries, email.
- **Logging:** structured JSON logs (Winston already) with request IDs; a central log sink (e.g., Better Stack / Grafana Loki).
- **Alerting:** Sentry alerts + uptime checks (Render/UptimeRobot) on `/api/health`.

### 7.3 Acceptance Criteria

- CI runs on every PR; PRs cannot merge with failing lint/test/build.
- Vercel + Render auto-deploy on `main`.
- Errors surface in Sentry with stack traces + user context.
- `/api/health` returns component health (DB, AI providers, email).

**Effort:** ~1–2 weeks.

---

## 8. Phase 6 — Mobile App Completion (P1)

**Purpose:** Finish the React Native app to feature parity so Finovo is a true multi-platform startup.

Follow `react-native/ROADMAP.md` (Phases 2–7):

- **Phase 2:** Full auth + profile + family wallets + monthly reports.
- **Phase 3:** Core finance workflows (dashboard, transactions, calendar, extraction).
- **Phase 4:** Smart upload + statement import (native picker, password-protected PDF).
- **Phase 5:** Recurring + investments.
- **Phase 6:** Insights + wealth advisor.
- **Phase 7:** Quality, store release (TestFlight / Play internal).

**Backend dependencies to implement:**

- `POST /api/auth/mobile/refresh` — rotating refresh tokens (hashed in MySQL, revoked on logout/reset/delete).
- `POST /api/statement-import/file-preview` — multipart with optional password, 10 MB limit.
- Object storage for bills (see Phase 3).

**Acceptance Criteria:** Feature parity with web; type-check + Expo web export passing; released to TestFlight + Play internal.

**Effort:** ~4–6 weeks (parallelizable with other phases).

---

## 9. Phase 7 — Investor Readiness & Product Polish (P2)

**Purpose:** Make Finovo compelling to present to investors.

### 9.1 Product & Analytics

1. **Product analytics** — add privacy-first analytics (e.g., PostHog or GA4) with a defined event taxonomy:
   - Activation: registration complete, first transaction added
   - Engagement: active sessions, transactions/month, AI insights viewed
   - Retention: D1/D7/D30
   - Revenue readiness: feature usage to inform pricing
2. **Feature flags** — add a lightweight flag system (released/split) for safe rollouts.
3. **Demo/seed data** — a "demo mode" with realistic Indian sample data so investors can explore without signing up.
4. **Onboarding** — a guided first-run experience (set profile, add income, add first transaction).

### 9.2 Documentation & Investor Package

Add to the repo:

- `docs/SECURITY.md` — security model, data handling, auth, encryption.
- `docs/PRIVACY.md` — what data is collected, AI personalization consent, data export/delete.
- `docs/ARCHITECTURE.md` — already present; keep updated.
- `docs/OPERATIONS.md` — runbook: deploy, rollback, backups, incident response.
- `docs/ROADMAP.md` — product roadmap (this file is a good start).
- `docs/API.md` — OpenAPI reference.
- `docs/PITCH.md` — one-page pitch: problem, solution, market (India), differentiators (AI, UPI/INR context, multi-platform), traction metrics, business model.
- `docs/COMPLIANCE.md` — DPDP Act (India) / GDPR positioning, data residency.

### 9.3 Quality & Accessibility

- Accessibility audit (WCAG 2.1 AA) on web.
- Error/empty/loading states across all pages (many already done).
- Localization groundwork (i18n) for future Hindi/languages.

### 9.4 Acceptance Criteria

- Investor can clone, run demo mode, and explore all features in < 10 minutes.
- Analytics dashboard shows activation, engagement, retention.
- Security + privacy docs written and linked from README.

**Effort:** ~2–3 weeks.

---

## 10. Phase 8 — Hardening, Stress & Release Checklist (P2)

**Purpose:** Final production gate before public launch.

### 10.1 Release Checklist

- [ ] All Phase 1–7 acceptance criteria met.
- [ ] `npm run test` (full suite) + `npm run build` pass in CI.
- [ ] 0 high/critical `npm audit` vulnerabilities.
- [ ] Load test passed at target concurrency.
- [ ] Lighthouse ≥ 90 across pages.
- [ ] Sentry error tracking live with alerting.
- [ ] Backups configured (automatic DB snapshots + restores tested).
- [ ] Uptime monitoring on `/api/health`.
- [ ] Rollback runbook tested.
- [ ] Privacy policy + security docs published.
- [ ] Mobile builds in TestFlight + Play internal.
- [ ] Terms of service + consent flows in place.

### 10.2 Operational Hardening

- **Database backups** — enable daily backups + point-in-time recovery on Aiven; test restore.
- **Vertical scaling** — move Render to a paid plan with multiple instances; add a load balancer.
- **Graceful shutdown** — handle SIGTERM, drain connections, flush logs.
- **Circuit breakers** — for AI providers and email (already some fallback; add resilience library).
- **Idempotency & retries** — already strong for transactions/dedup; extend to AI and email.

### 10.3 Acceptance Criteria

- Full release checklist passes.
- Stress test clears without errors.
- Backup restore verified in a staging environment.

**Effort:** ~1–2 weeks.

---

## 11. Roadmap Summary & Suggested Order

| Phase | Focus | Priority | Effort | Parallelizable |
| --- | --- | --- | --- | --- |
| 1 | Test foundation | P0 | 2–3 wks | No (blocks all) |
| 2 | Backend modularization | P0 | 2 wks | After 1 |
| 3 | Security & compliance | P0 | 2 wks | Yes |
| 4 | Performance optimization | P1 | 2–3 wks | Yes |
| 5 | CI/CD & observability | P1 | 1–2 wks | Yes |
| 6 | Mobile completion | P1 | 4–6 wks | Yes |
| 7 | Investor readiness & polish | P2 | 2–3 wks | After 1–3 |
| 8 | Hardening & release | P2 | 1–2 wks | After 4–7 |

**Recommended execution plan:**

1. **Start Phase 1 + Phase 2 together** — they are the foundation and both unblock testing and scaling.
2. **Run Phase 3 (security) and Phase 5 (CI/CD) in parallel** once Phase 1 gives you a safety net.
3. **Run Phase 4 (performance) and Phase 6 (mobile) in parallel**, as they are largely independent.
4. **Phase 7 (investor readiness) and Phase 8 (release) are the final polish** once the product is stable.

---

## 12. Concrete "First 10 Actions" (Start Today)

1. **Install Vitest + Testing Library** and add a `test` script.
2. **Write 1 integration test** for the auth login endpoint (happy + failure + lockout).
3. **Write 1 integration test** for transaction create + dedup.
4. **Add `@playwright/test`** and write the register→add→dashboard E2E happy path.
5. **Extract the first route module** from `server.ts` (e.g., `auth`) into `server/modules/auth/`.
6. **Add an error-handling middleware** and a consistent error envelope.
7. **Set up GitHub Actions** with lint + test + build jobs.
8. **Add `npm audit`** to CI and fix high/critical issues.
9. **Add `/api/health` component checks** for DB, AI providers, and email (already partially exists).
10. **Create `docs/SECURITY.md` and `docs/PRIVACY.md`** and link them from the README.

---

## 13. Key Metrics to Track for Investors

- **Activation rate:** % of registered users who add their first transaction.
- **Retention:** D1 / D7 / D30.
- **Engagement:** average transactions per user per month; AI features used per month.
- **Cost per user:** AI API spend per active user (you already track AI usage).
- **Performance:** p95 API latency; Lighthouse scores; crash-free rate (mobile).
- **Reliability:** uptime %, error rate, MTTR.

---

## 14. Risk Register

| Risk | Mitigation |
| --- | --- |
| AI API cost / quota exhaustion | Already have provider fallback + key rotation + usage dashboard; add per-user budgets and caching |
| Single-instance in-memory rate limiter | Move to Redis in Phase 2/3 |
| Local file storage not durable | Migrate to object storage (Phase 3) |
| Large monolith `server.ts` | Phase 2 modularization |
| No automated tests | Phase 1 (do first) |
| Mobile not at feature parity | Phase 6 |
| Data privacy / compliance | Phase 3 + Phase 7 docs |

---

*This roadmap is a living document. Update it as priorities shift and as phases complete. The single most important immediate step is introducing a real test framework (Phase 1) — every other phase depends on it.*
