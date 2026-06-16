# FinSight AI Expense Tracker

A sophisticated AI-powered expense tracker designed for the Indian market.

## Features
- **Multi-User Auth**: Secure JWT-based authentication.
- **Smart AI Upload**: Extract bill details (merchant, amount, date, category) using Gemini, with a local OCR/Ollama fallback.
- **Financial Insights**: Get personalized spending analysis and future forecasts.
- **Expense Calendar**: Visual spending patterns with threshold alerts.
- **Indian Context**: Support for UPI, INR (₹), and Indian festivals.

## Environment Variables
The following variables are required:
- `GEMINI_API_KEY`: Your Google Gemini API Key.
- `JWT_SECRET`: Secret key for signing JWT tokens.
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: MySQL connection settings.
- `EMAIL_USER`, `EMAIL_PASS`: SMTP credentials for OTP email.

## Tech Stack
- **Frontend**: React, Tailwind CSS, shadcn/ui, Recharts, Lucide-react.
- **Backend**: Node.js, Express, MySQL.
- **AI**: Google Gemini with local OCR/Ollama fallback.

## Getting Started
1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and fill in your database, JWT, email, and AI settings.
3. Start MySQL and make sure the configured database exists.
4. Start the development server: `npm run dev`
5. Open `http://localhost:3000` in your browser.

## Deployment

This repo is ready for a free-tier friendly setup:

- **Frontend**: Vercel
- **Backend**: Render
- **Database**: Aiven MySQL
- **API Testing**: Postman

### 1. Aiven MySQL

Create a MySQL service in Aiven, then create or import the `expense_tracker` database. The backend can connect with either `MYSQL_URL` or separate values:

```env
DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=
DB_SSL=true
```

If Aiven gives you a CA certificate, place it in `DB_CA_CERT` with newlines escaped as `\n`.

### 2. Render Backend

Use this repository as the source and keep the root directory as the project root.

```txt
Build Command: npm install && npm run build
Start Command: npm start
Health Check Path: /api/health
```

Set Render environment variables from `.env.example`, including:

```env
NODE_ENV=production
FRONTEND_URL=https://your-frontend.vercel.app
CORS_ORIGIN=https://your-frontend.vercel.app
JWT_SECRET=
GEMINI_API_KEY=
EMAIL_USER=
EMAIL_PASS=
```

### 3. Vercel Frontend

Deploy the same repository to Vercel.

```txt
Build Command: npm run build
Output Directory: dist
```

Set this Vercel environment variable without `/api` at the end:

```env
VITE_API_URL=https://your-backend.onrender.com
```

### 4. Postman

Import:

- `postman/FinSight-Expense.postman_collection.json`
- `postman/FinSight-Expense.postman_environment.json`

Set `baseUrl` to:

```txt
https://your-backend.onrender.com/api
```
