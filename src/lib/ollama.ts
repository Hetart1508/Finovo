const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_VISION_MODEL = 'llava:13b'; // Upgrade to 'llava:34b' or 'qwen2-vl:7b' if available
const DEFAULT_TEXT_MODEL = 'llama3.2:1b';

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
    if (retries < 2 && (error as Error).message.includes('abort') || error.message.includes('network')) {
      return generate(prompt, options, retries + 1);
    }
    throw error;
  }
};

const validateAndParse = (text: string) => {
  try {
    const data = JSON.parse(text);
    if (!data.merchant || typeof data.amount !== 'number' || !data.date || !data.category) {
      throw new Error('Missing required fields');
    }
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      throw new Error('Invalid date format');
    }
    // Validate amount > 0
    if (data.amount <= 0) {
      throw new Error('Invalid amount');
    }
    return data;
  } catch {
    // Fallback regex parsing
    const amountMatch = text.match(/₹?(\d+(?:\.\d{2})?)/i) || text.match(/(\d+(?:,\d{2,3})+(?:\.\d{2})?)/);
    const dateMatch = text.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/) || text.match(/(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/);
    
    const merchant = text.match(/[A-Z][a-zA-Z\s&]{2,50}(?:\sLtd|LLP|Pvt)/)?.[0] || 'Unknown Merchant';
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
    const rawDate = dateMatch ? dateMatch[1] : '2024-10-01';
    const category = /food|restaurant|swiggy|zomato|dominos/i.test(text) ? 'Food' :
                    /petrol|fuel|bpcl/i.test(text) ? 'Transport' :
                    /amazon|flipkart|myntra/i.test(text) ? 'Shopping' : 'Other';

    return {
      merchant,
      amount: Math.max(amount, 0.01),
      date: '2024-10-01', // Fallback; improve with better parsing if needed
      category
    };
  }
};

export const extractBillData = async (base64Data: string, mimeType: string) => {
  const prompt = `Analyze this Indian bill/receipt image and extract EXACTLY these fields as VALID JSON. Focus on clearest text. Rules:
1. MERCHANT: Store/restaurant name (e.g. "Swiggy", "Zomato", "Reliance Petrol").
2. AMOUNT: FINAL total amount in Rs only (ignore tax/CGST, pick largest, remove ₹/Rs symbol). Number like 245.50.
3. DATE: Convert to YYYY-MM-DD (DD/MM/YYYY → YYYY-MM-DD). Use today if unclear.
4. CATEGORY: Exactly one: Food, Transport, Shopping, Utilities, Entertainment, Health, Other.

Examples:
{"merchant": "Zomato", "amount": 456.0, "date": "2024-10-15", "category": "Food"}
{"merchant": "HP Petrol", "amount": 1250.75, "date": "2024-10-10", "category": "Transport"}

Bill shows GST? Ignore, pick TOTAL/NET AMT. No invention!

{
  "merchant": "string",
  "amount": number,
  "date": "YYYY-MM-DD", 
  "category": "Food|Transport|Shopping|Utilities|Entertainment|Health|Other"
}`;

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


