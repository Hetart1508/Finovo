import { createWorker } from 'tesseract.js';

const OLLAMA_URL = (import.meta as any).env?.VITE_OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_VISION_MODEL = 'llava:13b'; // Upgrade to 'llava:34b' or 'qwen2-vl:7b' if available
const DEFAULT_TEXT_MODEL = 'llama3.2:1b';
const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Utilities', 'Entertainment', 'Health', 'Other'] as const;

type BillCategory = typeof CATEGORIES[number];

type BillData = {
  merchant: string;
  amount: number;
  date: string;
  category: BillCategory;
  rawText?: string;
};

const generate = async (prompt: string, options: { model?: string; image?: string; format?: 'json' } = {}, retries = 0) => {
  const model = options.model || (options.image ? DEFAULT_VISION_MODEL : DEFAULT_TEXT_MODEL);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout

  const body: any = {
    model,
    prompt,
    stream: false,
    options: {
      temperature: 0, // Deterministic for JSON
      top_p: 0.95,
      top_k: 40,
      num_predict: options.format === 'json' ? 768 : 2048,
      seed: 42 // Reproducible
    }
  };

  if (options.image) {
    body.images = [options.image];
  }

  if (options.format === 'json') {
    body.format = 'json';
  }

  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return data.response.trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (retries < 2 && (message.includes('abort') || message.includes('network'))) {
      return generate(prompt, options, retries + 1);
    }
    throw error;
  }
};

const normalizeCategory = (value: unknown): BillCategory => {
  const category = typeof value === 'string' ? value.trim() : '';
  return CATEGORIES.includes(category as BillCategory) ? category as BillCategory : 'Other';
};

const normalizeDate = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();

  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return toValidIsoDate(year, month, day);
  }

  const indianMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (indianMatch) {
    const [, day, month, rawYear] = indianMatch;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return toValidIsoDate(year, month, day);
  }

  return null;
};

const toValidIsoDate = (year: string, month: string, day: string) => {
  const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const date = new Date(`${normalized}T00:00:00`);

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return normalized;
};

const extractJsonObject = (text: string) => {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
};

const cleanOcrText = (text: string) =>
  text
    .replace(/\r/g, '\n')
    .replace(/[|]/g, ' ')
    .replace(/[₹]/g, ' Rs ')
    .replace(/[^\S\n]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();

const getFallbackCategory = (text: string): BillCategory => {
  if (/food|restaurant|cafe|swiggy|zomato|dominos|pizza|burger|kitchen|hotel/i.test(text)) return 'Food';
  if (/petrol|fuel|diesel|hpcl|bpcl|iocl|uber|ola|metro|parking|toll/i.test(text)) return 'Transport';
  if (/amazon|flipkart|myntra|store|mart|mall|retail|fashion|electronics/i.test(text)) return 'Shopping';
  if (/electricity|water|gas|broadband|wifi|mobile|recharge|utility|billdesk/i.test(text)) return 'Utilities';
  if (/movie|cinema|pvr|bookmyshow|game|netflix|spotify|entertainment/i.test(text)) return 'Entertainment';
  if (/pharmacy|medical|hospital|clinic|doctor|health|medicine/i.test(text)) return 'Health';
  return 'Other';
};

const parseAmount = (value: string) => {
  const amount = Number(value.replace(/,/g, ''));
  return Number.isFinite(amount) && amount > 0 && amount < 10_000_000 ? amount : null;
};

const lineHasNoiseNumber = (line: string) =>
  /\b(gstin|gst\s*no|invoice\s*(?:no|#)|bill\s*(?:no|#)|order\s*(?:id|no|#)|mobile|phone|tel|fssai|hsn|sac|cin|pan|qty|quantity|items?)\b/i.test(line);

const looksLikeDateLine = (line: string) =>
  /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/.test(line) || /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/.test(line);

const getLineAmounts = (line: string) =>
  [...line.matchAll(/(?:\b(?:rs|inr)\.?\s*)?(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?!\s*%)/gi)]
    .map((match) => ({
      amount: parseAmount(match[1]),
      hasCurrency: /\b(?:rs|inr)\.?\s*$/i.test(line.slice(0, match.index))
    }))
    .filter((candidate): candidate is { amount: number; hasCurrency: boolean } => candidate.amount !== null)
    .filter(({ amount }) => !Number.isInteger(amount) || amount < 1900 || amount > 2099);

const getFallbackAmount = (text: string) => {
  const lines = cleanOcrText(text).split('\n');
  const candidates: Array<{ amount: number; score: number }> = [];

  lines.forEach((line, index) => {
    const normalized = line.toLowerCase();
    const amounts = getLineAmounts(line);
    if (!amounts.length || lineHasNoiseNumber(line) || looksLikeDateLine(line)) return;

    let score = index / Math.max(lines.length, 1);
    if (/\b(amount\s*payable|grand\s*total|net\s*(?:amount|payable)|total\s*(?:amount|payable|due)|invoice\s*total|bill\s*amount)\b/i.test(normalized)) {
      score += 100;
    } else if (/\b(total|paid|payment|cash|card|upi)\b/i.test(normalized)) {
      score += 55;
    }

    if (/\b(sub\s*total|subtotal|tax|cgst|sgst|igst|vat|discount|saving|change|round(?:ed)?\s*off|balance|mrp|rate|price)\b/i.test(normalized)) {
      score -= 45;
    }

    amounts.forEach(({ amount, hasCurrency }) => {
      candidates.push({ amount, score: score + (hasCurrency ? 10 : 0) });
    });
  });

  const strongCandidates = candidates.filter(({ score }) => score >= 50);
  const pool = strongCandidates.length ? strongCandidates : candidates.filter(({ score }) => score >= 0);
  if (!pool.length) return 0;

  pool.sort((a, b) => b.score - a.score || b.amount - a.amount);
  return pool[0].amount;
};

const getFallbackMerchant = (text: string) => {
  const lines = cleanOcrText(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 2 && /[A-Za-z]/.test(line));

  const merchantLine = lines.find((line) =>
    !/invoice|receipt|tax|gst|date|amount|total|cash|upi|phone|mobile|address|pin|thanks|welcome|www\.|@|fssai/i.test(line)
  );

  return merchantLine?.replace(/[^\w\s&.-]/g, '').slice(0, 60).trim() || 'Unknown Merchant';
};

const getFallbackDate = (text: string) => {
  const dateMatch =
    text.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/) ||
    text.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
  return normalizeDate(dateMatch?.[1]) || new Date().toISOString().split('T')[0];
};

const normalizeAmount = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return parseAmount(value.replace(/[^\d,.]/g, ''));
  return null;
};

const validateAndParse = (text: string, sourceText = text): BillData => {
  try {
    const data = JSON.parse(extractJsonObject(text));
    const amount = normalizeAmount(data.amount);
    if (!data.merchant || amount === null || !data.date || !data.category) {
      throw new Error('Missing required fields');
    }

    const date = normalizeDate(data.date);
    if (!date) {
      throw new Error('Invalid date format');
    }

    if (amount <= 0) {
      throw new Error('Invalid amount');
    }

    return {
      merchant: String(data.merchant).trim(),
      amount,
      date,
      category: normalizeCategory(data.category),
      rawText: sourceText === text ? undefined : cleanOcrText(sourceText)
    };
  } catch {
    const amount = getFallbackAmount(sourceText);

    return {
      merchant: getFallbackMerchant(sourceText),
      amount: Math.max(amount, 0.01),
      date: getFallbackDate(sourceText),
      category: getFallbackCategory(sourceText),
      rawText: cleanOcrText(sourceText)
    };
  }
};

const runImageOcr = async (base64Data: string, mimeType: string) => {
  const worker = await createWorker('eng');
  try {
    const imageDataUrl = `data:${mimeType};base64,${base64Data}`;
    const result = await worker.recognize(imageDataUrl);
    return cleanOcrText(result.data.text);
  } finally {
    await worker.terminate();
  }
};

const parseBillText = async (ocrText: string) => {
  const today = new Date().toISOString().split('T')[0];
  const prompt = `You extract expense transaction data from OCR text of Indian bills and invoices.
Return ONLY valid JSON. Do not include markdown.

Rules:
1. MERCHANT: Store/restaurant name (e.g. "Swiggy", "Zomato", "Reliance Petrol").
2. AMOUNT: FINAL total amount in Rs only (ignore tax/CGST, pick largest, remove ₹/Rs symbol). Number like 245.50.
3. DATE: Convert to YYYY-MM-DD (DD/MM/YYYY -> YYYY-MM-DD). Use ${today} if unclear.
4. CATEGORY: Exactly one: Food, Transport, Shopping, Utilities, Entertainment, Health, Other.

Examples:
{"merchant": "Zomato", "amount": 456.0, "date": "2024-10-15", "category": "Food"}
{"merchant": "HP Petrol", "amount": 1250.75, "date": "2024-10-10", "category": "Transport"}

{
  "merchant": "string",
  "amount": number,
  "date": "YYYY-MM-DD", 
  "category": "Food|Transport|Shopping|Utilities|Entertainment|Health|Other"
}

OCR text:
${ocrText}`;

  const result = await generate(prompt, { format: 'json' });
  return validateAndParse(result, ocrText);
};

const parseBillImageWithVision = async (base64Data: string) => {
  const today = new Date().toISOString().split('T')[0];
  const prompt = `Analyze this Indian bill/receipt image and extract exactly these fields as valid JSON.
Use ${today} if the date is unclear. Category must be exactly one of Food, Transport, Shopping, Utilities, Entertainment, Health, Other.

{"merchant":"string","amount":number,"date":"YYYY-MM-DD","category":"Food|Transport|Shopping|Utilities|Entertainment|Health|Other"}`;

  let result;
  try {
    result = await generate(prompt, { image: base64Data, format: 'json' });
    return validateAndParse(result);
  } catch (error) {
    console.error('Primary extraction failed:', error);
    // Retry once with simpler prompt
    const simplePrompt = `JSON only: merchant, amount(number), date(YYYY-MM-DD), category from bill image.`;
    result = await generate(simplePrompt, { image: base64Data, format: 'json' });
    return validateAndParse(result);
  }
};

export const extractBillData = async (base64Data: string, mimeType: string) => {
  if (mimeType === 'application/pdf') {
    throw new Error('PDF OCR is not supported in the free local mode yet. Please upload a JPG or PNG invoice.');
  }

  if (!mimeType.startsWith('image/')) {
    throw new Error('Unsupported file type. Please upload a JPG or PNG invoice.');
  }

  let ocrText = '';

  try {
    ocrText = await runImageOcr(base64Data, mimeType);
    if (ocrText.length < 20) {
      throw new Error('OCR text was too short');
    }

    try {
      return await parseBillText(ocrText);
    } catch (error) {
      console.warn('Ollama text parsing failed, using OCR heuristic fallback:', error);
      return validateAndParse('', ocrText);
    }
  } catch (error) {
    if (ocrText.length >= 20) {
      return validateAndParse('', ocrText);
    }

    console.warn('Local OCR extraction failed, trying Ollama vision fallback:', error);
    try {
      return await parseBillImageWithVision(base64Data);
    } catch (visionError) {
      console.error('Ollama vision fallback failed:', visionError);
      throw new Error('Could not read text from this image. Try a clearer JPG/PNG with the bill text facing upright.');
    }
  }
};

export const getFinancialInsights = async (transactions: any[]) => {
  const prompt = `You are an expert Indian financial advisor. Provide 1-2 comprehensive paragraphs analyzing these transactions with key insights, trends, predictions, and actionable suggestions. Use INR (₹), Indian context (Diwali spending, fuel prices, UPI cashback).

Structure as paragraphs, not bullets. Cover:
- Spending summary by category %
- Notable trends/anomalies (e.g. Food spike)
- Next month prediction with reasoning
- 2-3 personalized saving suggestions

Keep professional, concise (200-300 words total).

Example:
"In the last 30 days, your Food expenses dominate at 45% (₹12,500), while Transport dropped 20% MoM - good trend. Anomalies include a Shopping spike post-Diwali. At current rates, expect ₹8,500 monthly surplus if consistent. 

Suggestions: Switch utility bills to CRED for 5% cashback (₹500/month save), meal prep to cut Food 20%, and consolidate UPI payments via Google Pay RuPay for extra rewards."

Transactions: ${JSON.stringify(transactions.slice(0, 30), null, 2)}`;

  const result = await generate(prompt);
  console.log('Raw Ollama response:', result); // Debug
  
  return {
    summary: result
  };
};
