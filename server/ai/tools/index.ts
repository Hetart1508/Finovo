import { registerAnalyticsTools } from "./analyticsTools";
import { registerTransactionTools } from "./transactionTools";
import { registerInvestmentTools } from "./investmentTools";
import { registerRecurringTools } from "./recurringTools";
import { registerMemoryTools } from "./memoryTools";
import { registerKnowledgeTools } from "./knowledgeTools";
import { getAllTools, getTool, AgentTool } from "./registry";

let initialized = false;

export const initTools = (): void => {
  if (initialized) return;
  registerAnalyticsTools();
  registerTransactionTools();
  registerInvestmentTools();
  registerRecurringTools();
  registerMemoryTools();
  registerKnowledgeTools();
  initialized = true;
};

export { getAllTools, getTool };
export type { AgentTool };
