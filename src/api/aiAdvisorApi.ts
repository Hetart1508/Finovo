import api from '@/src/lib/api';
import type { AdvisorMessage, AdvisorSession } from '@/src/types/ai';
import { getData } from './http';

export type { AdvisorMessage, AdvisorSession } from '@/src/types/ai';

export type AdvisorChatResponse = {
  message: AdvisorMessage;
  reply: string;
  provider: string;
  portfolio?: unknown;
  profile?: unknown;
  transactions?: unknown;
};

export const aiAdvisorApi = {
  listSessions: () => getData<AdvisorSession[]>(api.get('/ai-advisor/sessions')),
  listMessages: (sessionId: string) =>
    getData<AdvisorMessage[]>(api.get('/ai-advisor/messages', { params: { sessionId } })),
  sendMessage: (message: string, sessionId: string) =>
    getData<AdvisorChatResponse>(api.post('/ai-advisor/chat', { message, sessionId })),
  clearMessages: (sessionId: string) =>
    getData(api.delete('/ai-advisor/messages', { params: { sessionId } })),
  createSession: () => getData<AdvisorSession>(api.post('/ai-advisor/sessions')),
  deleteSession: (sessionId: string) =>
    getData(api.delete(`/ai-advisor/sessions/${sessionId}`)),
};
