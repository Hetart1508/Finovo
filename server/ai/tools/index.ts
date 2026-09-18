import { registerAnalyticsTools } from "./analyticsTools";
import { registerTransactionTools } from "./transactionTools";
import { registerInvestmentTools } from "./investmentTools";
import { registerRecurringTools } from "./recurringTools";
import { registerMemoryTools } from "./memoryTools";
import { getAllTools, getTool, AgentTool } from "./registry";

let initialized = false;

export const initTools = (): void => {
  if (initialized) return;
  registerAnalyticsTools();
  registerTransactionTools();
  registerInvestmentTools();
  registerRecurringTools();
  registerMemoryTools();
  initialized = true;
};

export { getAllTools, getTool };
export type { AgentTool };
