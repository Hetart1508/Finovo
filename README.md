# FinSight AI Expense Tracker

A sophisticated AI-powered expense tracker designed for the Indian market.

## Features
- **Multi-User Auth**: Secure JWT-based authentication.
- **Smart AI Upload**: Extract bill details (merchant, amount, date, category) automatically using Google Gemini 1.5 Flash.
- **Financial Insights**: Get personalized spending analysis and future forecasts.
- **Expense Calendar**: Visual spending patterns with threshold alerts.
- **Bank Sync (Mock)**: Account Aggregator (AA) integration concepts.
- **Indian Context**: Support for UPI, INR (₹), and Indian festivals.

## Environment Variables
The following variables are required:
- `GEMINI_API_KEY`: Your Google Gemini API Key.
- `JWT_SECRET`: Secret key for signing JWT tokens.

## Tech Stack
- **Frontend**: React, Tailwind CSS, shadcn/ui, Recharts, Lucide-react.
- **Backend**: Node.js, Express, better-sqlite3 (SQL).
- **AI**: Google Gemini 1.5 Flash.

## Getting Started
1. Install dependencies: `npm install`
2. Start the development server: `npm run dev`
3. Open `http://localhost:3000` in your browser.
