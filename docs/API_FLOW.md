# API Flow

## Client Request Flow

1. UI components call React Query hooks or mutations.
2. Query options currently live in `src/lib/serverState.ts`.
3. Direct mutations in pages currently call the shared Axios client from `src/lib/api.ts`.
4. The Axios client prefixes requests with `/api` or `VITE_API_URL + /api`.
5. The request interceptor attaches the JWT when a valid session exists.
6. The response interceptor clears the session and emits `session-expired` on `401` or `403`.
7. `src/App.tsx` listens for `session-expired` and clears React Query cache.

## Backend Request Flow

1. Express receives requests in `server.ts`.
2. Public auth routes handle login, registration, OTP, password reset, and Google auth.
3. Protected routes use `authenticateToken`.
4. Route handlers validate and normalize request data.
5. Database helpers execute MySQL queries.
6. Handlers return JSON responses consumed by React Query or page mutations.

## Current Query Keys

Shared keys live in `src/lib/serverState.ts`:

- `transactions`
- `dashboardTransactions`
- `recurring`
- `upcomingRecurring`
- `merchantAliases`
- `investments`
- `investmentSummary`
- `aiAdvisorSessions`
- `aiAdvisorMessages`

## Mutation Pattern

Current pages usually:

1. call `useMutation`
2. call an API endpoint directly
3. show a toast
4. invalidate related query keys
5. reset local form/dialog state

This works, but it spreads endpoint paths and invalidation rules across pages.

## Target API Pattern

Later phases should move toward:

```txt
src/api/<domain>Api.ts
src/server-state/<domain>Queries.ts
src/features/<domain>/hooks/use<Domain>Mutations.ts
```

Benefits:

- Pages stop knowing raw endpoint paths.
- API response types become reusable.
- Query invalidation becomes consistent.
- New developers can find each feature's data flow quickly.
