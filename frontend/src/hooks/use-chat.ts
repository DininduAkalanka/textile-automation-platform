'use client';

import { useMutation } from '@tanstack/react-query';

import { aiService, ChatTurn } from '@/services/ai.service';
import { useChatStore } from '@/store/useChatStore';

/**
 * Sends a message and files the reply into the chat store.
 *
 * Errors are turned into an assistant message rather than a toast: a chat that
 * answers "sorry, I couldn't reach the assistant" reads as a conversation. A red
 * toast over a chat window reads as a broken website.
 */
export function useSendMessage() {
  const push = useChatStore((s) => s.push);
  const messages = useChatStore((s) => s.messages);

  return useMutation({
    mutationFn: (message: string) => {
      const history: ChatTurn[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      return aiService.customerChat(message, history);
    },

    onMutate: (message) => {
      push({ role: 'user', content: message });
    },

    onSuccess: (reply) => {
      push({
        role: 'assistant',
        content: reply.message,
        products: reply.products,
        degraded: !reply.llm,
      });
    },

    onError: (error: Error) => {
      push({
        role: 'assistant',
        content:
          error.message.includes('429') || error.message.toLowerCase().includes('many')
            ? 'You are asking rather quickly! Give me a moment and try again.'
            : "Sorry — I couldn't reach the assistant just now. You can still browse our products.",
        degraded: true,
      });
    },
  });
}
