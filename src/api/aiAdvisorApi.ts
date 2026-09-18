import api from '@/src/lib/api';
import type { AdvisorMessage, AdvisorSession } from '@/src/types/ai';
import { getData } from './http';

export type { AdvisorMessage, AdvisorSession } from '@/src/types/ai';

export type PendingAction = {
  actionId: string;
  toolName: string;
  summary: string;
  details: Record<string, unknown>;
  message: string;
};

export type AdvisorChatResponse = {
  message: AdvisorMessage;
  reply: string;
  provider: string;
  model?: string;
  guardrail_status?: string;
  suggested_prompts?: string[];
  tools_used?: string[];
  pending_action?: PendingAction | null;
  new_memories?: Array<{ category: string; key: string; value: string }>;
  message_count?: number;
  portfolio?: unknown;
  profile?: unknown;
  transactions?: unknown;
};

export const aiAdvisorApi = {
  listSessions: () => getData<AdvisorSession[]>(api.get('/ai-advisor/sessions')),
  listMessages: (sessionId: string) =>
    getData<AdvisorMessage[]>(api.get('/ai-advisor/messages', { params: { sessionId } })),
  sendMessage: (message: string, sessionId: string, clientMemories?: unknown) =>
    getData<AdvisorChatResponse>(api.post('/ai-advisor/chat', { message, sessionId, clientMemories })),
  confirmAction: (sessionId: string, actionId: string, confirm: boolean) =>
    getData<{ success: boolean; status: string; reply: string }>(
      api.post('/ai-advisor/confirm', { sessionId, actionId, confirm })
    ),
  clearMessages: (sessionId: string) =>
    getData(api.delete('/ai-advisor/messages', { params: { sessionId } })),
  createSession: () => getData<AdvisorSession>(api.post('/ai-advisor/sessions')),
  deleteSession: (sessionId: string) =>
    getData(api.delete(`/ai-advisor/sessions/${sessionId}`)),
};
