// Deprecated: Use src/lib/ai.ts (Ollama-powered, unlimited)



// Redirect to ai.ts
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          merchant: { type: "string" },
          amount: { type: "number" },
          date: { type: "string", description: "ISO date format YYYY-MM-DD" },
          category: { type: "string" }
        },
        required: ["merchant", "amount", "date", "category"]
      }
    }
  });

  const result = await model.generateContent([
    {
      inlineData: {
        data: base64Data,
        mimeType
      }
    },
    {
      text: "Extract merchant name, total amount, date (YYYY-MM-DD), category (Food, Transport, Shopping, Utilities, Entertainment, Health, Other) from this bill/receipt. Return JSON only."
    }
  ], {
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      }
    ]
  });

  const response = await result.response;
  return JSON.parse(response.text());
};


  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const result = await model.generateContent([
    "You are a senior financial advisor. Analyze these transactions from the last 30 days and provide 3-4 bullet points of financial insights, a prediction for next month's balance, and 2-3 saving tips. Use INR (₹). Keep concise for Indian user.",
    JSON.stringify(transactions.slice(0, 15))
  ]);
  
  const response = await result.response;
  return response.text();
};

