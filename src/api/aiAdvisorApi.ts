import api from '@/src/lib/api';
import { getData } from './http';

export type AdvisorMessage = {
  id: number;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export type AdvisorSession = {
  session_id: string;
  title: string;
  message_count: number;
  updated_at?: string;
};

export const aiAdvisorApi = {
  listSessions: () => getData<AdvisorSession[]>(api.get('/ai-advisor/sessions')),
  listMessages: (sessionId: string) =>
    getData<AdvisorMessage[]>(api.get('/ai-advisor/messages', { params: { sessionId } })),
  sendMessage: (message: string, sessionId: string) =>
    getData(api.post('/ai-advisor/chat', { message, sessionId })),
  clearMessages: (sessionId: string) =>
    getData(api.delete('/ai-advisor/messages', { params: { sessionId } })),
  createSession: () => getData<AdvisorSession>(api.post('/ai-advisor/sessions')),
  deleteSession: (sessionId: string) =>
    getData(api.delete(`/ai-advisor/sessions/${sessionId}`)),
};
