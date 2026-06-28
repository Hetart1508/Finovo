# Architecture

## Frontend

The frontend lives under `src/`.

Current important folders:

- `src/pages`: route-level screens. Many are still large and will be split in later phases.
- `src/components`: app components and shared UI primitives.
- `src/components/ui`: reusable Base UI/shadcn-style primitives.
- `src/lib`: frontend clients, session helpers, query setup, AI helpers, and calculations.

Target direction:

```txt
src/
  api/
  components/
    layout/
    shared/
    ui/
  features/
  hooks/
  lib/
  server-state/
  types/
  utils/
```

Pages should eventually become thin composition files. Feature-specific forms, tables, hooks, types, and utilities should live in `src/features/<feature>`.

## Backend

The backend is currently concentrated in `server.ts`.

Current responsibilities in that file:

- environment/config reading
- logger setup
- database pool and query helpers
- schema migrations
- validation and normalization helpers
- Gemini/Ollama/AI logic
- email/OTP logic
- auth middleware
- file upload setup
- all API routes
- production static serving

Target direction:

```txt
server/
  app.ts
  config/
  db/
  middleware/
  modules/
  services/
  utils/
```

`server.ts` should eventually become a small bootstrap file that imports app setup and starts the server.

## State And Data

- React Query owns server state: fetched transactions, investments, recurring events, aliases, summaries, and chat data.
- Local React state owns UI state: dialog open flags, filters, form values, selected rows, and temporary upload state.
- Browser storage currently stores auth/session data, theme, user threshold data, and selected AI chat session.

Redux is not needed right now because React Query already handles API state and most remaining state is page-local.

## Import Convention

This project currently uses `@` as a repo-root alias.

Use:

- `@/src/...` for app source files under `src`.
- `@/src/components/ui/...` for shared UI primitives.
- `@/lib/utils` for the current class-name helper until it is moved into `src/lib`.

This convention should become simpler in a later cleanup once all source code is under `src`.
