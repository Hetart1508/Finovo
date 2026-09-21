export type AdvisorMessage = {
  id: number;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  status?: 'pending' | 'streaming' | 'completed' | 'failed' | 'cancelled';
  tools_executed?: string[] | string;
};

export type AdvisorSession = {
  session_id: string;
  title: string;
  message_count: number;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
  pinned?: boolean | number;
};

export type AdvisorFeedback = {
  messageId: number;
  rating: 'thumbs_up' | 'thumbs_down';
  comment?: string;
  sessionId?: string;
};
