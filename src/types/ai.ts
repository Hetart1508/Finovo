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
