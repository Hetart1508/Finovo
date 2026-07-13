# Finovo Mobile Implementation Roadmap

All React Native work remains inside this folder. A phase is complete only after its listed checks pass on both Android and iOS.

## Phase 0 — Workspace and parity baseline

Status: complete

- Isolated root-level mobile workspace.
- Expo SDK version and native architecture selected.
- Existing web routes and backend endpoints inventoried.
- Mobile navigation and backend constraints documented.

## Phase 1 — Application foundation

Status: complete

- Stable stack and tab navigation.
- Finovo color, spacing, radius, type and shadow tokens.
- Query, auth and wallet providers.
- Axios client with cookie compatibility and optional Bearer header.
- Secure session persistence and automatic expiry handling.
- Wallet preference persistence.
- Live Dashboard totals and transaction list reads.
- Loading, error, empty and placeholder states.
- Type-check and Expo web export passing.

## Phase 2 — Complete authentication and profile

Status: next

- Mobile access and rotating refresh-token integration.
- Register, registration OTP and resend timer.
- Forgot/reset password.
- Native Google authentication.
- Profile summary and edit wizard.
- Family wallet creation, budgets and member management.
- Monthly report preferences and account deletion.

Backend dependency: mobile token endpoints in `docs/BACKEND_CONTRACT.md`.

## Phase 3 — Core finance workflows

Status: pending

- Dashboard date ranges, category breakdown and native charts.
- Transaction search, filters, sorting and pagination.
- Add, edit and delete transaction forms.
- Natural-language transaction extraction.
- Duplicate confirmation.
- Bill preview.
- Calendar month view and daily threshold controls.

## Phase 4 — Smart Upload and Statement Import

Status: pending

- Camera/gallery bill capture.
- AI extraction, review and save.
- Native document picker for PDF/images.
- Password-protected statement flow.
- Extraction progress, preview editing and approval.
- Merchant alias management and duplicate reporting.

Backend dependency: multipart statement preview with password support and consistent upload limits.

## Phase 5 — Recurring and Investments

Status: pending

- Recurring metrics, CRUD and yearly schedule.
- Investment summary and CRUD.
- SIP calculator, forecast cards and native growth chart.

## Phase 6 — Insights and Wealth Advisor

Status: pending

- Insight range controls, categories and generated analysis.
- Advisor session list and management.
- Native chat, Markdown output, retries and keyboard handling.

## Phase 7 — Quality and store release

Status: pending

- Unit, component, API integration and end-to-end tests.
- Accessibility and performance verification.
- Crash reporting and privacy-safe analytics.
- Development, preview and production build profiles.
- TestFlight, Play internal testing and staged release.
