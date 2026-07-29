# Codex Refactor Prompt: Split Monolithic Server File into Modular Files

## Objective

Refactor the existing monolithic server entry file, currently centered around the server-side application logic, into a cleaner modular structure by extracting related responsibilities into separate files.

The goal is to improve maintainability and separation of concerns without changing the current behavior, API contracts, business logic, or user-facing UI behavior.

## Scope

- Refactor the main server file only, starting from the existing monolithic server entry point.
- Split the code into logical modules based on responsibility.
- Preserve the current application behavior exactly.
- Do not change the frontend/UI implementation or user-visible behavior.
- Do not install new dependencies unless absolutely unavoidable, and only after explicitly explaining why it is necessary.

## Constraints

You must follow these rules strictly:

1. Do not change existing functionality.
2. Do not change existing API behavior, request/response shapes, route paths, status codes, or auth flow.
3. Do not change frontend/UI behavior, visuals, routes, or component logic.
4. Do not alter business rules, validation rules, or data handling behavior unless required to preserve the same behavior after extraction.
5. Do not install dependencies unless absolutely necessary and only after clearly explaining the reason.
6. Prefer moving code into new files rather than rewriting logic from scratch.
7. Keep imports and exports consistent with the existing project structure.
8. If there is ambiguity, preserve the current behavior and stop to ask for clarification instead of making assumptions.

## Preferred Target Structure

Use a layered structure similar to this:

- server/utils/
  - types.ts
  - helpers.ts
  - date.ts
  - crypto.ts
  - auth.ts
  - formatters.ts

- server/ai/
  - gemini.client.ts
  - openai-compatible.client.ts
  - text-provider.ts
  - vision-provider.ts
  - prompts.ts

- server/services/
  - auth.service.ts
  - wallet.service.ts
  - transaction.service.ts
  - statement-import.service.ts
  - merchant-alias.service.ts
  - investment.service.ts
  - recurring.service.ts
  - report.service.ts
  - advisor.service.ts
  - insight.service.ts

- server/routes/
  - auth.routes.ts
  - wallet.routes.ts
  - transaction.routes.ts
  - merchant-alias.routes.ts
  - investment.routes.ts
  - recurring.routes.ts
  - statement-import.routes.ts
  - upload.routes.ts
  - ai-advisor.routes.ts
  - insight.routes.ts
  - report.routes.ts
  - calendar.routes.ts
  - admin.routes.ts
  - user.routes.ts

- server/middleware/
  - rate-limiter.ts
  - error-handler.ts

- server/app.ts
- server/server.ts

## Refactor Strategy

### Phase 1: Extract Utility Helpers

Move common utility and helper logic into separate files under server/utils/, including things such as:

- type definitions
- string helpers
- normalization helpers
- date helpers
- crypto helpers
- auth helpers
- formatting helpers

### Phase 2: Extract AI Provider Layer

Separate AI-related logic into server/ai/ modules:

- Gemini client logic
- OpenAI-compatible client logic
- text provider selection and normalization
- vision provider logic
- prompt builders

### Phase 3: Extract Business Logic Services

Move domain-specific logic into service modules under server/services/, including:

- authentication and email logic
- wallet logic
- transaction normalization and persistence logic
- statement import logic
- merchant alias logic
- investment calculations and validation
- recurring payment logic
- report generation and emailing logic
- advisor response logic
- financial insight logic

### Phase 4: Extract Route Handlers

Move route definitions into route modules under server/routes/ while preserving the existing route paths and behavior.

### Phase 5: Create App Assembly and Entry Point

Create or update the app assembly structure so the server entry point becomes clean and minimal, while keeping runtime behavior unchanged.

## Important Behavior Preservation Rules

When refactoring, preserve the following as-is:

- existing API endpoints and methods
- existing request validation behavior
- existing authentication behavior
- existing response payload structure
- existing DB interaction patterns
- existing middleware behavior
- existing environmental configuration usage
- existing startup and shutdown behavior

## Do Not Change

Do not change:

- existing logic implementations
- existing business rules
- existing validation rules
- existing database schema usage
- existing UI components, design, or behavior
- existing package.json dependencies unless absolutely necessary
- existing route naming or API contracts

## Implementation Instructions for Codex

Please perform the refactor in the following way:

1. Start from the current monolithic server file and identify cohesive blocks of code.
2. Extract each logical group into a dedicated file with a clear purpose.
3. Keep the current functionality intact while improving organization.
4. Preserve imports, exports, and runtime behavior.
5. Avoid rewriting code unless required for correct extraction.
6. Prefer minimal, surgical changes over large rewrites.
7. Make the extracted files reusable and logically named.
8. Keep the main server file as a thin orchestrator after refactoring.
9. Ensure the app still runs correctly after the refactor.
10. If you encounter a blocker, explain it clearly rather than guessing.

## Verification Checklist

After the refactor, verify that:

- the project still starts correctly
- existing routes are still available
- authentication and middleware still behave the same
- AI-related flows still work as before
- no UI pages or frontend logic were changed
- no unnecessary dependency installation occurred

## Preferred Working Style

- Keep the refactor incremental and safe.
- Make small, reviewable changes.
- Do not introduce unrelated cleanup.
- Preserve code style where possible.
- Avoid broad formatting changes unless necessary.
- Avoid renaming public functions or routes unless required for module extraction.

## Final Deliverable

The final result should be:

- a cleaner modular server structure
- no functional regressions
- no UI regressions
- no unnecessary dependency installation
- a maintainable, logically separated codebase that is easier to evolve in the future

## Ready-to-Paste Prompt for Codex

Use the following prompt with Codex:

"Refactor the existing monolithic server file into a modular structure without changing any existing logic or behavior. Split the code into logical files under server/utils, server/ai, server/services, server/routes, server/middleware, and create a cleaner app assembly structure. Preserve all existing API routes, request/response shapes, authentication behavior, business logic, validation rules, and startup behavior exactly as they are today. Do not change the frontend/UI side at all. Do not install new dependencies unless absolutely necessary and only if you explain why. Prefer extracting code into new files rather than rewriting it. Keep the refactor minimal, safe, and incremental. Make sure the project continues to work after the extraction. If anything is ambiguous, preserve current behavior and ask for clarification instead of making assumptions."

## Notes for the User

- This prompt is designed to be safe and behavior-preserving.
- It is intended for a refactor-only task, not a feature addition or redesign.
- The instructions prioritize maintainability while explicitly protecting existing functionality and UI behavior.
