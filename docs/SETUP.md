# Setup

## Requirements

- Node.js compatible with the installed dependencies.
- MySQL database.
- Optional: Gemini API key for AI features.
- Optional: email provider credentials for OTP email.
- Optional: Ollama for local AI/OCR fallback flows.

## Install

```bash
npm install
```

## Environment

Create `.env` in the project root. The most important values are:

```env
JWT_SECRET=
DB_HOST=
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=expense_tracker
GEMINI_API_KEY=
EMAIL_USER=
EMAIL_PASS=
GOOGLE_CLIENT_ID=
VITE_GOOGLE_CLIENT_ID=
```

The backend can also use `MYSQL_URL` instead of separate database fields.

For deployed frontend/backend separation:

```env
FRONTEND_URL=
CORS_ORIGIN=
VITE_API_URL=
```

`VITE_API_URL` should be the backend origin without `/api`; the client adds `/api`.

## Run Locally

```bash
npm run dev
```

The Express server starts the API and Vite middleware. Open the local URL printed by the server, usually `http://localhost:3000`.

## Validate

```bash
npm run lint
npm run verify:api
npm run build
```

Or run the full check:

```bash
npm run test
```

## Common Local Notes

- The database must exist before startup.
- Startup migrations create or update app tables.
- If AI keys are missing, some AI flows may fail or use fallback behavior.
- If email credentials are missing, OTP email delivery will not work as expected.
- Uploaded files are stored in `uploads/` during local development.
