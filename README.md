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
