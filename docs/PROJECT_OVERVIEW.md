# Project Overview

Finovo is an AI-assisted personal finance app for the Indian market. It helps users track transactions, import bills/statements, review recurring payments, analyze spending, manage investments, and ask portfolio-aware finance questions.

## Main Product Areas

- Auth: login, registration, OTP verification, password reset, and Google sign-in.
- Dashboard: income, expense, balance, spending trend, category, and recurring payment views.
- Transactions: CRUD, filtering, sorting, pagination, and bill preview.
- Smart Upload: bill upload, AI extraction, and transaction creation.
- Statement Import: statement parsing, duplicate detection, merchant aliases, and approval.
- Calendar: daily spending visualization and threshold alerts.
- Recurring: recurring income, expense, investment, and service payment tracking.
- Investments: SIP/lumpsum tracking, projections, charts, and summary metrics.
- Insights: AI-generated spending insights from transactions and recurring data.
- AI Wealth Advisor: chat backed by saved investments and chat sessions.

## Runtime Shape

- Frontend: React, Vite, Tailwind CSS, Base UI/shadcn-style components, React Query.
- Backend: Express server in `server.ts`.
- Database: MySQL with startup migrations.
- AI: Gemini first, local Ollama/OCR fallback for selected flows.
- Auth: JWT stored in browser storage and attached by the Axios client.

## Important Entry Points

- `src/main.tsx`: React app mount and initial theme class.
- `src/App.tsx`: routes, protected/public wrappers, toast container, session-expired query clearing.
- `src/lib/api.ts`: shared Axios instance and auth/session interceptors.
- `src/lib/queryClient.ts`: React Query defaults.
- `src/lib/serverState.ts`: current shared query keys and query options.
- `server.ts`: current backend bootstrap, migrations, services, middleware, and routes.

## Current Refactor Direction

The active roadmap is in `REFACTOR_ROADMAP.md`.

1. Move shared UI and docs into predictable locations.
2. Split the backend into focused modules.
3. Move API/query logic out of pages.
4. Split large pages into feature components, hooks, types, and utilities.
