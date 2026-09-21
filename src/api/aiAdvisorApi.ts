import api, { apiBaseUrl } from '@/src/lib/api';
import type { AdvisorMessage, AdvisorSession, AdvisorFeedback } from '@/src/types/ai';
import { getData } from './http';

export type { AdvisorMessage, AdvisorSession, AdvisorFeedback } from '@/src/types/ai';

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

export type StreamEvent =
  | { type: 'status'; status: string; label: string }
  | { type: 'tool_start'; name: string; label: string }
  | { type: 'tool_result'; name: string; label: string; summary: string }
  | { type: 'text_delta'; text: string }
  | { type: 'pending_action'; actionId: string; toolName: string; summary: string; details: Record<string, unknown>; message: string }
  | { type: 'message_complete'; messageId: number; sessionId: string; reply: string; toolsUsed: string[]; pendingAction?: PendingAction | null; suggestedPrompts?: string[] }
  | { type: 'error'; error: string };

export const aiAdvisorApi = {
  listSessions: (archived: boolean = false) =>
    getData<AdvisorSession[]>(api.get('/ai-advisor/sessions', { params: { archived: archived ? 'true' : undefined } })),
  searchSessions: (q: string) =>
    getData<Array<AdvisorSession & { matching_snippet?: string }>>(api.get('/ai-advisor/sessions/search', { params: { q } })),
  patchSession: (sessionId: string, data: { title?: string; archived?: boolean; pinned?: boolean }) =>
    getData<{ message: string; sessionId: string }>(api.patch(`/ai-advisor/sessions/${sessionId}`, data)),
  listMessages: (sessionId: string) =>
    getData<AdvisorMessage[]>(api.get('/ai-advisor/messages', { params: { sessionId } })),
  sendMessage: (message: string, sessionId: string, clientMemories?: unknown) =>
    getData<AdvisorChatResponse>(api.post('/ai-advisor/chat', { message, sessionId, clientMemories })),
  confirmAction: (sessionId: string, actionId: string, confirm: boolean) =>
    getData<{ success: boolean; status: string; reply: string }>(
      api.post('/ai-advisor/confirm', { sessionId, actionId, confirm })
    ),
  sendFeedback: (feedback: AdvisorFeedback) =>
    getData<{ success: boolean; message: string }>(
      api.post(`/ai-advisor/messages/${feedback.messageId}/feedback`, feedback)
    ),
  clearMessages: (sessionId: string) =>
    getData(api.delete('/ai-advisor/messages', { params: { sessionId } })),
  createSession: (title?: string) => getData<AdvisorSession>(api.post('/ai-advisor/sessions', { title })),
  deleteSession: (sessionId: string) =>
    getData(api.delete(`/ai-advisor/sessions/${sessionId}`)),
  streamMessage: async (
    message: string,
    sessionId: string,
    onEvent: (event: StreamEvent) => void,
    clientMemories?: unknown,
    abortSignal?: AbortSignal
  ): Promise<void> => {
    const response = await fetch(`${apiBaseUrl}/ai-advisor/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message, sessionId, clientMemories }),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Streaming request failed');
    }

    if (!response.body) {
      throw new Error('Response body is missing');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const dataStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(dataStr) as StreamEvent;
          onEvent(parsed);
        } catch {
          // ignore malformed lines
        }
      }
    }

    if (buffer.trim().startsWith('data: ')) {
      try {
        const parsed = JSON.parse(buffer.trim().slice(6)) as StreamEvent;
        onEvent(parsed);
      } catch {
        // ignore
      }
    }
  },
};
