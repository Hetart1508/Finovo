# Finovo Refactor Roadmap

This document is the Phase 0 audit baseline. The goal is to make the project easier to read, safer to change, and faster for a new developer to understand.

## Current Baseline

- TypeScript check: `npm run lint` passes.
- Main risk: too much behavior is concentrated in a few very large files.
- Frontend state/data pattern: React Query is already used for server state, with page-local `useState` for UI state.
- Backend pattern: one large `server.ts` owns configuration, database helpers, migrations, validations, AI integrations, email, auth, routes, uploads, and static serving.

## Largest Files

| File | Lines | Priority | Why it matters |
| --- | ---: | --- | --- |
| `server.ts` | 3451 | P0 | Many backend responsibilities in one file. Hardest file for knowledge transfer. |
| `src/pages/Auth.tsx` | 827 | P0 | UI, theme, form state, OTP, reset password, Google auth, and API calls mixed together. |
| `src/pages/Investments.tsx` | 715 | P0 | Forms, charts, calculations, API mutations, summaries, and table UI mixed together. |
| `src/pages/Transactions.tsx` | 684 | P0 | Filtering, sorting, form handling, bill viewing, CRUD, and table UI mixed together. |
| `src/pages/Recurring.tsx` | 494 | P1 | Recurring form logic, due date logic, mutation logic, and UI in one page. |
| `src/pages/StatementImport.tsx` | 463 | P1 | Upload, preview, alias edits, approval, and table UI in one page. |
| `src/lib/ollama.ts` | 446 | P1 | OCR, parsing, Ollama calls, fallback logic, and financial insight logic mixed together. |
| `src/pages/Calendar.tsx` | 392 | P1 | Calendar rendering, threshold persistence, transaction display, and filters together. |
| `src/pages/AIWealthAdvisor.tsx` | 378 | P1 | Chat state, session persistence, API calls, sidebar, and message UI together. |
| `src/pages/Dashboard.tsx` | 355 | P1 | Date range logic, summaries, charts, cards, and error handling together. |
| `src/pages/Insights.tsx` | 345 | P1 | Date range logic, AI insights, category aggregation, and UI together. |
| `src/pages/SmartUpload.tsx` | 329 | P2 | Upload/extract/create transaction flow can become a feature module. |
| `src/components/Layout.tsx` | 259 | P2 | Theme, nav, session expiry, and layout concerns can be separated. |

## Main Readability Problems

1. Page files are doing too many jobs.
2. API calls are spread across pages instead of being grouped by feature/domain.
3. Feature types are declared inside page files, making reuse difficult.
4. Several files use `any`, especially API responses and page state.
5. Backend code is monolithic, making route ownership and helper ownership unclear.
6. Two component roots exist: `src/components` and top-level `components/ui`.
7. Local storage keys and session/theme behavior are spread across multiple files.
8. Some reusable UI patterns are repeated in pages: loading, error, empty state, stats, dialogs, form sections.

## Refactor Principles

- Change behavior as little as possible in each step.
- Keep each PR/phase small enough to review.
- Prefer extracting existing code before rewriting it.
- Keep pages thin: routing, layout composition, and feature entry only.
- Put API calls, query keys, hooks, types, and helpers near their domain.
- Keep files ideally under 250 lines after extraction, except generated/vendor-style UI primitives.
- Run `npm run lint` after each phase.

## Target Structure

```txt
src/
  api/
  components/
    layout/
    shared/
    ui/
  features/
    auth/
    transactions/
    investments/
    recurring/
    statement-import/
    dashboard/
    insights/
    calendar/
    ai-advisor/
    smart-upload/
  hooks/
  lib/
  server-state/
  types/
  utils/
server/
  app.ts
  config/
  db/
  middleware/
  modules/
  services/
  utils/
```

This structure is the destination, not a single big-bang change.

## Phase 1: Structure And Documentation Skeleton

Purpose: make the project easier to navigate before deep refactors.

Micro goals:

1. Add `docs/PROJECT_OVERVIEW.md`. Done.
2. Add `docs/SETUP.md`. Done.
3. Add `docs/ARCHITECTURE.md`. Done.
4. Add `docs/API_FLOW.md`. Done.
5. Move top-level `components/ui` into `src/components/ui` if alias/imports allow cleanly. Done.
6. Create empty feature folders only when they receive real extracted code.
7. Keep app compiling after every move.

Done when:

- New developer can read the docs and understand app shape.
- Imports still compile.
- `npm run lint` passes.

## Phase 2: Backend Split

Purpose: reduce `server.ts` from 3451 lines into focused backend modules.

Suggested order:

1. Extract environment/config into `server/config/env.ts`. Done.
2. Extract logger into `server/config/logger.ts`. Done.
3. Extract database pool/query helpers into `server/db/client.ts`. Done.
4. Extract migrations into `server/db/migrations.ts`. Done.
5. Extract auth middleware into `server/middleware/auth.ts`. Done.
6. Extract upload setup into `server/middleware/upload.ts`. Done.
7. Extract utility helpers into `server/utils`.
8. Extract route modules by domain:
   - `auth.routes.ts`
   - `transactions.routes.ts`
   - `recurring.routes.ts`
   - `investments.routes.ts`
   - `ai.routes.ts`
   - `aiAdvisor.routes.ts`
   - `statementImport.routes.ts`
   - `merchantAliases.routes.ts`
   - `user.routes.ts`
9. Keep `server.ts` as the small bootstrap entry.

Done when:

- `server.ts` is mostly app setup and `startServer`.
- Route files are domain-owned.
- `npm run lint` passes.

Current Phase 2 status:

- Config, logger, DB client, migrations, request logging, auth middleware, and upload middleware are split.
- Route modules and shared backend utilities are still pending because they carry many cross-dependencies.

## Phase 3: API And React Query Standardization

Purpose: remove direct endpoint knowledge from page components.

Micro goals:

1. Split `src/lib/serverState.ts` into domain query files. Done.
2. Create typed API files:
   - `src/api/transactionsApi.ts` Done.
   - `src/api/investmentsApi.ts` Done.
   - `src/api/recurringApi.ts` Done.
   - `src/api/authApi.ts` Done.
   - `src/api/aiAdvisorApi.ts` Done.
   - `src/api/statementImportApi.ts` Done.
3. Create query hooks near features or in `src/server-state`. Done.
4. Centralize invalidation helpers for common mutations. Done.
5. Replace page-level `api.get/post/put/delete` calls with named functions. Done.

Done when:

- Pages no longer know raw API paths except rare routing-only cases.
- Query keys and invalidations are consistent.
- `npm run lint` passes.

Current Phase 3 status:

- Endpoint strings now live in `src/api` instead of page components.
- Domain query options live in `src/server-state`.
- Shared invalidation helpers live in `src/server-state/invalidations.ts`.
- `src/lib/serverState.ts` remains as a compatibility re-export for older imports.

## Phase 4: Frontend Feature Splits

Purpose: make page files small and readable.

Priority order:

1. `Auth.tsx` Started: extracted auth UI components and Google helpers.
2. `Investments.tsx` Started: extracted summary cards, SIP calculator, growth chart, form, types, and utils.
3. `Transactions.tsx` Mostly done: extracted transaction form, toolbar, table, bill preview, hooks, types, and constants.
4. `Recurring.tsx` Started: extracted form, metrics, table, yearly schedule, types, constants, and utils.
5. `StatementImport.tsx`
6. `AIWealthAdvisor.tsx`
7. `Dashboard.tsx`
8. `Insights.tsx`
9. `Calendar.tsx`
10. `SmartUpload.tsx`

Example feature layout:

```txt
src/features/transactions/
  components/
    TransactionFilters.tsx
    TransactionFormDialog.tsx
    TransactionTable.tsx
    BillPreviewDialog.tsx
  hooks/
    useTransactionFilters.ts
    useTransactionMutations.ts
  transactions.types.ts
  transactions.utils.ts
```

Done when:

- Each page becomes mostly composition.
- Large helper functions move into hooks/utils.
- Reusable UI sections are separate components.
- `npm run lint` passes.

Current Phase 4 status:

- `src/pages/Auth.tsx` reduced from 825 lines to 448 lines.
- Auth feature files now live under `src/features/auth`.
- Extracted password input, note, brand panel, tab switch, Google section, theme toggle, login card, register card, and Google auth utilities.
- Remaining Auth cleanup: move auth effects/handlers into hooks once the UI split has settled.
- `src/pages/Investments.tsx` reduced from 711 lines to 134 lines.
- Investment feature files now live under `src/features/investments`.
- Extracted investment types, currency/date/type helpers, investment form, summary cards, SIP calculator, growth chart, forecast cards, investments list/table, and investment hooks.
- Remaining Investments cleanup: optional polish only; page is now mostly composition.
- `src/pages/Transactions.tsx` reduced from 685 lines to 96 lines.
- Transaction feature files now live under `src/features/transactions`.
- Extracted shared add/edit transaction form, toolbar/filter, table/pagination, bill preview dialog, transaction hooks, transaction types, pagination constants, sort labels, categories, payment modes, and utils.
- Remaining Transactions cleanup: optional split of table row/pagination if needed; page is now mostly composition.
- `src/pages/Recurring.tsx` reduced from 495 lines to 180 lines.
- Recurring feature files now live under `src/features/recurring`.
- Extracted recurring add/edit form, metric cards, payments table, yearly schedule card, recurring types, domain constants, and schedule/amount/date helpers.
- Remaining Recurring cleanup: move dialog state and mutations into hooks.

## Phase 5: Shared Types And Utilities

Purpose: reduce `any` and improve discoverability.

Micro goals:

1. Create `src/types/transaction.ts`.
2. Create `src/types/investment.ts`.
3. Create `src/types/recurring.ts`.
4. Create `src/types/auth.ts`.
5. Create `src/types/ai.ts`.
6. Replace high-value `any` usage in API responses first.
7. Move date range helpers into `src/utils/dateRanges.ts`.
8. Move currency/number formatting into `src/utils/formatters.ts`.
9. Move storage keys into `src/lib/storageKeys.ts`.

Done when:

- Feature files import shared types instead of redefining them.
- Most page-level `any` usage is gone.
- `npm run lint` passes.

## Phase 6: Shared UI Patterns

Purpose: reduce repeated JSX and make screens consistent.

Micro goals:

1. Add shared `PageHeader`.
2. Add shared `LoadingState`.
3. Add shared `ErrorState`.
4. Add shared `EmptyState`.
5. Add shared `StatCard`.
6. Add shared confirmation dialog instead of `window.confirm`.
7. Extract repeated form row/field patterns only when repetition is obvious.

Done when:

- Feature pages read more like product flows than raw markup.
- Shared states are visually consistent.
- `npm run lint` passes.

## Phase 7: Knowledge Transfer Documentation

Purpose: make onboarding fast.

Docs to complete:

1. `docs/PROJECT_OVERVIEW.md`: what Finovo does and the major modules.
2. `docs/SETUP.md`: local setup, env vars, database, commands.
3. `docs/ARCHITECTURE.md`: frontend/backend structure and ownership rules.
4. `docs/API_FLOW.md`: request flow, auth, React Query, invalidation.
5. `docs/FEATURE_GUIDE.md`: how to add a new feature end to end.
6. `docs/TROUBLESHOOTING.md`: common local issues.

Done when:

- A new developer can set up, run, and modify one feature using docs only.

## Phase 8: Final Readability Pass

Purpose: polish names and remove leftover clutter.

Micro goals:

1. Rename vague variables where it improves meaning.
2. Remove dead code.
3. Remove debug logs that are not useful.
4. Add short comments only around non-obvious business rules.
5. Review files still above 300 lines and decide whether more extraction is worth it.
6. Add a small contributor checklist to README.

Done when:

- No major file remains large without a clear reason.
- README points to docs.
- `npm run test` passes.

## Immediate Next Step

Start Phase 1 with documentation skeleton and component path cleanup. This is low risk and creates the map for later backend and page refactors.
