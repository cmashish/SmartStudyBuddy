export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type ChatResponse = {
  answer: string;
  session_id: string;
};
