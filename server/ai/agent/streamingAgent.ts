import {
  GEMINI_API_KEYS,
  GEMINI_MODEL,
  GEMINI_FALLBACK_MODELS,
  GEMINI_API_BASE_URL,
} from "../../config/env";
import { logger } from "../../config/logger";
import { initTools, getAllTools, getTool } from "../tools";
import { buildSystemInstruction } from "./agentRules";
import { getUserMemories, summarizeConversationHistory, saveUserMemory } from "../memory/memoryManager";
import { initKnowledgeBase } from "../rag/knowledgeBase";

initTools();
initKnowledgeBase().catch(() => {});

const MAX_AGENT_ITERATIONS = 6;
const MAX_TOOL_CALLS = 10;

export interface StreamEvent {
  type: "status" | "tool_start" | "tool_result" | "text_delta" | "pending_action" | "error" | "message_complete";
  [key: string]: unknown;
}

export const getToolLabel = (toolName: string, args: Record<string, unknown> = {}): string => {
  const map: Record<string, string> = {
    get_spending_summary: "Analyzing your spending summary...",
    get_category_spending: args.category ? `Checking ${args.category} spending...` : "Calculating category totals...",
    get_top_merchants: "Finding your top merchants...",
    get_monthly_spending: "Reviewing monthly spending trends...",
    get_budget_status: "Evaluating your budget utilization...",
    compare_spending_periods: "Comparing with previous spending period...",
    calculate_change: "Computing deterministic variance...",
    get_current_date: "Checking current date...",
    get_transactions: "Reading your transaction history...",
    search_transactions: args.query ? `Searching for "${args.query}"...` : "Searching transactions...",
    get_transaction: "Retrieving transaction details...",
    create_expense: "Preparing expense for confirmation...",
    delete_expense: "Verifying transaction for deletion...",
    get_investments: "Checking investment portfolio...",
    get_investment_summary: "Calculating portfolio valuation...",
    get_recurring_expenses: "Reviewing recurring bills & SIPs...",
    get_ai_memory: "Retrieving your financial preferences...",
    search_finance_knowledge: "Searching verified financial knowledge...",
  };
  return map[toolName] || `Running ${toolName.replace(/_/g, " ")}...`;
};

// Format tools into Gemini Function Declarations schema
const formatToolsForGemini = () => {
  const tools = getAllTools();
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: "OBJECT",
          properties: Object.entries(t.parameters.properties || {}).reduce(
            (acc, [key, val]: [string, any]) => {
              acc[key] = {
                type: (val.type || "string").toUpperCase(),
                description: val.description || "",
                ...(val.enum ? { enum: val.enum } : {}),
              };
              return acc;
            },
            {} as Record<string, unknown>
          ),
          ...(t.parameters.required ? { required: t.parameters.required } : {}),
        },
      })),
    },
  ];
};

export const runStreamingAdvisorAgent = async (
  message: string,
  userId: number,
  sessionId: string,
  context: {
    profileContext?: any;
    summary?: any;
    investments?: any[];
    history?: any[];
    transactionContext?: any;
    clientMemories?: any[];
  },
  emitEvent: (event: StreamEvent) => void,
  abortSignal?: AbortSignal
): Promise<{ reply: string; toolsUsed: string[]; pendingAction: any }> => {
  if (!GEMINI_API_KEYS.length) {
    emitEvent({ type: "error", error: "No Gemini API key configured for AI agent." });
    throw new Error("No Gemini API key configured for AI agent");
  }

  const modelCandidates = Array.from(new Set([GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS]));
  const toolsDeclaration = formatToolsForGemini();
  const toolsUsed: string[] = [];
  let pendingAction: any = null;
  let totalToolCalls = 0;

  const today = new Date().toISOString().split("T")[0];
  const systemInstruction = buildSystemInstruction(today);

  // Retrieve long-term user memories from MySQL
  const dbMemories = await getUserMemories(userId);
  const combinedMemories = [
    ...(context.clientMemories || []),
    ...dbMemories.map((m) => `${m.type}: ${m.content}`),
  ];

  // Summarize older turns if conversation history is long
  const rawHistory = (context.history || []).map((h) => ({
    role: h.role === "user" ? "user" : "assistant",
    content: String(h.content || ""),
  }));
  const { recentMessages, summary: conversationSummary } = summarizeConversationHistory(rawHistory);

  // Input guardrail check
  const trimmed = message.trim();
  if (!trimmed) {
    emitEvent({ type: "error", error: "Empty message cannot be processed." });
    return { reply: "Please enter a question or command.", toolsUsed: [], pendingAction: null };
  }

  // Build context payload
  const userContextBlock = JSON.stringify({
    profile: context.profileContext || {},
    portfolioSummary: context.summary || {},
    savedGoalsAndPreferences: combinedMemories,
    conversationSummary: conversationSummary || undefined,
  }, null, 2);

  // Assemble Gemini messages contents
  const contents: any[] = [
    {
      role: "user",
      parts: [
        {
          text: `${systemInstruction}\n\n[USER CONTEXT]\n${userContextBlock}\n\n[USER INSTRUCTION]\nPlease answer the user's latest query accurately.`,
        },
      ],
    },
    {
      role: "model",
      parts: [{ text: "Understood. I will provide accurate financial insights using trusted database tools when required." }],
    },
  ];

  // Add recent conversation messages
  for (const m of recentMessages) {
    contents.push({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    });
  }

  // Add current prompt
  contents.push({
    role: "user",
    parts: [{ text: trimmed }],
  });

  emitEvent({ type: "status", status: "understanding_query", label: "Understanding your request..." });

  // Iterate across candidate keys and models
  for (const apiKey of GEMINI_API_KEYS) {
    for (const model of modelCandidates) {
      try {
        let iterations = 0;
        let accumulatedReply = "";

        while (iterations < MAX_AGENT_ITERATIONS) {
          if (abortSignal?.aborted) {
            emitEvent({ type: "status", status: "cancelled", label: "Generation stopped." });
            return { reply: accumulatedReply || "Generation stopped.", toolsUsed, pendingAction };
          }

          iterations++;

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 40_000);

          if (abortSignal) {
            abortSignal.addEventListener("abort", () => controller.abort(), { once: true });
          }

          let response: globalThis.Response;
          try {
            response = await fetch(
              `${GEMINI_API_BASE_URL}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({
                  contents,
                  tools: toolsDeclaration,
                  generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 2500,
                  },
                }),
              }
            );
          } finally {
            clearTimeout(timeout);
          }

          if (!response.ok) {
            const errText = await response.text();
            logger.warn("Gemini streaming call error", { status: response.status, model, errText: errText.slice(0, 300) });
            break; // Try next candidate
          }

          const data: any = await response.json();
          const candidate = data.candidates?.[0];
          if (!candidate || !candidate.content) {
            break;
          }

          const parts = candidate.content.parts || [];
          const functionCalls = parts.filter((p: any) => Boolean(p.functionCall));

          // If model called tools:
          if (functionCalls.length > 0) {
            contents.push({
              role: "model",
              parts: parts,
            });

            const functionResponseParts: any[] = [];

            for (const callPart of functionCalls) {
              const { name, args } = callPart.functionCall;
              totalToolCalls++;

              if (totalToolCalls > MAX_TOOL_CALLS) {
                logger.warn("Agent exceeded maximum tool calls", { totalToolCalls });
                break;
              }

              if (!toolsUsed.includes(name)) {
                toolsUsed.push(name);
              }

              const toolLabel = getToolLabel(name, args || {});
              emitEvent({ type: "tool_start", name, label: toolLabel });

              const tool = getTool(name);
              let toolResult: any;

              if (!tool) {
                toolResult = { error: `Tool ${name} is not registered.` };
              } else {
                try {
                  toolResult = await tool.execute(args || {}, userId, sessionId);
                  if (toolResult && toolResult.status === "pending_confirmation" && toolResult.actionId) {
                    pendingAction = {
                      actionId: toolResult.actionId,
                      toolName: toolResult.toolName,
                      summary: toolResult.summary,
                      details: toolResult.details,
                      message: toolResult.message,
                    };
                    emitEvent({ type: "pending_action", ...pendingAction });
                  }
                } catch (err: any) {
                  logger.error("Agent tool execution error", { toolName: name, error: err?.message });
                  toolResult = { error: `Execution error for ${name}: ${err?.message}` };
                }
              }

              emitEvent({
                type: "tool_result",
                name,
                label: toolLabel,
                summary: toolResult?.summary || (toolResult?.count ? `Found ${toolResult.count} records` : "Completed"),
              });

              functionResponseParts.push({
                functionResponse: {
                  name,
                  response: { output: toolResult },
                },
              });
            }

            contents.push({
              role: "function",
              parts: functionResponseParts,
            });

            emitEvent({ type: "status", status: "synthesizing", label: "Synthesizing your financial summary..." });
            continue; // Continue loop to synthesize
          }

          // Final response text
          accumulatedReply = parts
            .map((p: any) => p.text || "")
            .join("\n")
            .trim();

          if (!accumulatedReply && pendingAction) {
            accumulatedReply = pendingAction.message;
          }

          // Output guardrail: enforce disclaimer
          const hasDisclaimer = /disclaimer|planning guidance|not financial advice|not investment advice/i.test(accumulatedReply);
          if (!hasDisclaimer && accumulatedReply) {
            accumulatedReply += "\n\n*Disclaimer: This is for educational and financial planning purposes only and should not be construed as SEBI-registered investment advice. Past performance is not indicative of future returns.*";
          }

          // Stream final text delta chunks to client
          const words = accumulatedReply.split(/(\s+)/).filter(Boolean);
          const chunkSize = Math.max(1, Math.ceil(words.length / 45));
          for (let i = 0; i < words.length; i += chunkSize) {
            if (abortSignal?.aborted) break;
            const delta = words.slice(i, i + chunkSize).join("");
            emitEvent({ type: "text_delta", text: delta });
            await new Promise((r) => setTimeout(r, 16));
          }

          // Extract and save implicit goals if user mentioned one
          const goalMatch = message.match(/(?:save|budget|target|goal|invest)\s+(?:of\s+)?(?:₹|rs\.?\s*)?(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:lakhs?|cr|k)?\s*(?:for|towards|per month)?\s*([a-zA-Z\s]{3,30})/i);
          if (goalMatch) {
            saveUserMemory(userId, "financial_goal", `Goal mentioned: "${trimmed.slice(0, 150)}"`).catch(() => {});
          }

          return {
            reply: accumulatedReply,
            toolsUsed,
            pendingAction,
          };
        }
      } catch (err: any) {
        logger.warn("Candidate model execution error in streaming agent", { model, error: err?.message });
      }
    }
  }

  // Fallback response if all API keys or models are exhausted
  const fallbackReply = "I was unable to retrieve live financial data right now due to service limits. Please try asking again in a moment.";
  emitEvent({ type: "text_delta", text: fallbackReply });
  return {
    reply: fallbackReply,
    toolsUsed,
    pendingAction: null,
  };
};
