import { create } from 'zustand';
import { ChatProduct } from '@/services/ai.service';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  products?: ChatProduct[];
  /** Assistant messages that came from the fallback rather than the model. */
  degraded?: boolean;
}

interface ChatState {
  open: boolean;
  messages: ChatMessage[];
  /** Set when a reply arrives while the widget is closed. */
  unread: boolean;

  setOpen: (open: boolean) => void;
  toggle: () => void;
  push: (message: Omit<ChatMessage, 'id'>) => void;
  reset: () => void;
}

/**
 * Session-scoped, deliberately NOT persisted (plan Session 9.3, task 1).
 *
 * A shopping conversation is about right now. Reloading the page and finding
 * yesterday's chat waiting is unsettling rather than helpful, and it would mean
 * storing a customer's questions in localStorage for anyone at the same computer
 * to read.
 */
export const useChatStore = create<ChatState>((set, get) => ({
  open: false,
  messages: [],
  unread: false,

  setOpen: (open) => set({ open, unread: open ? false : get().unread }),
  toggle: () => {
    const open = !get().open;
    set({ open, unread: open ? false : get().unread });
  },

  push: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { ...message, id: crypto.randomUUID() },
      ],
      // An answer that lands while the panel is shut gets a dot, not a popup.
      unread: message.role === 'assistant' && !state.open ? true : state.unread,
    })),

  reset: () => set({ messages: [], unread: false }),
}));
