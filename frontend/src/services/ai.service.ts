import { http, unwrap } from './http';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  image: string | null;
  link: string;
  requiresMeasurement: boolean;
}

export interface ChatReply {
  message: string;
  products: ChatProduct[];
  /** False when the answer came from the fallback rather than the model. */
  llm: boolean;
}

export const aiService = {
  customerChat: (message: string, history: ChatTurn[] = []) =>
    unwrap<ChatReply>(
      http.post('/ai/customer-chat', {
        message,
        // Bounded to the last 6 turns — the API rejects more, and a long history
        // only inflates the prompt (and the bill) without improving the answer.
        history: history.slice(-6),
      }),
    ),
};
