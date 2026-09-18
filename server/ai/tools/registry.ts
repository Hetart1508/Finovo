// server/ai/tools/registry.ts
// Central tool registry — only registered tools can be called by the agent.

export type ToolPermission = 'READ' | 'WRITE' | 'DESTRUCTIVE';

export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  permission: ToolPermission;
  execute: (
    args: Record<string, unknown>,
    userId: number,
    sessionId: string
  ) => Promise<unknown>;
}

const toolRegistry = new Map<string, AgentTool>();

export const registerTool = (tool: AgentTool): void => {
  toolRegistry.set(tool.name, tool);
};

export const getTool = (name: string): AgentTool | undefined =>
  toolRegistry.get(name);

export const getAllTools = (): AgentTool[] =>
  Array.from(toolRegistry.values());
