'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Sparkles, X } from 'lucide-react';

import { ChatProductCard } from './chat-product-card';
import { Button } from '@/components/ui/button';
import { useSendMessage } from '@/hooks/use-chat';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/store/useChatStore';

const MAX_CHARS = 500;

/** Teach the customer what this thing is for (doc 10 §15). */
const SUGGESTIONS = [
  'School uniforms',
  'Cotton fabrics',
  'Best fabric for hot weather',
  'Under Rs. 2000',
];

/**
 * The floating shopping assistant (plan Session 9.3, doc 10 §5.5 and §7).
 *
 * Every product it shows is a real row from the database — the AI service filters
 * the model's chosen ids against what was actually retrieved, then reads the
 * products back from Postgres. A hallucinated product cannot reach this component.
 */
export function ChatWidget() {
  const { open, toggle, setOpen, messages, unread } = useChatStore();
  const send = useSendMessage();

  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, send.isPending]);

  const submit = (text: string) => {
    const message = text.trim().slice(0, MAX_CHARS);
    if (!message || send.isPending) return;
    setDraft('');
    send.mutate(message);
  };

  return (
    <>
      {/* Launcher — never obscures the page, only itself. */}
      <button
        type="button"
        onClick={toggle}
        aria-label={open ? 'Close shopping assistant' : 'Open shopping assistant'}
        className={cn(
          'fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
          open ? 'bg-neutral-800 text-white' : 'bg-indigo-600 text-white',
        )}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {/* A reply arrived while it was shut. A dot, not a popup. */}
        {unread && !open && (
          <span className="absolute right-1 top-1 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Shopping assistant"
          className={cn(
            'fixed z-40 flex flex-col overflow-hidden bg-white shadow-2xl',
            // Full-screen sheet on a phone, panel on a desktop (doc 10 §5.5).
            'inset-0 sm:inset-auto sm:bottom-24 sm:right-5 sm:h-[560px] sm:w-[380px] sm:rounded-2xl sm:border sm:border-neutral-200',
          )}
        >
          <header className="flex items-center justify-between border-b border-neutral-200 bg-indigo-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Sparkles size={18} aria-hidden />
              <div>
                <p className="text-sm font-semibold leading-tight">
                  Shopping assistant
                </p>
                <p className="text-[11px] text-indigo-200">
                  Ask about fabrics, uniforms or sizes
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-md p-1 hover:bg-indigo-500"
            >
              <X size={18} />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="pt-6 text-center">
                <Sparkles
                  className="mx-auto mb-3 h-8 w-8 text-indigo-300"
                  aria-hidden
                />
                <p className="text-sm font-medium text-neutral-900">
                  What are you looking for?
                </p>
                <p className="mx-auto mt-1 max-w-[16rem] text-xs text-neutral-500">
                  Describe it in your own words — I&apos;ll find it in our
                  catalogue.
                </p>

                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => submit(suggestion)}
                      className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 transition-colors hover:border-indigo-400 hover:text-indigo-600"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                    message.role === 'user'
                      ? 'ml-auto bg-indigo-600 text-white'
                      : 'bg-neutral-100 text-neutral-900',
                  )}
                >
                  {message.content}
                </div>

                {message.products && message.products.length > 0 && (
                  <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
                    {message.products.map((product) => (
                      <ChatProductCard key={product.id} product={product} />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {send.isPending && (
              <div className="flex w-16 gap-1 rounded-2xl bg-neutral-100 px-3.5 py-3">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit(draft);
            }}
            className="border-t border-neutral-200 p-3"
          >
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <input
                  value={draft}
                  onChange={(event) =>
                    setDraft(event.target.value.slice(0, MAX_CHARS))
                  }
                  placeholder="e.g. cotton fabric for school shirts"
                  aria-label="Message"
                  className="w-full rounded-full border border-neutral-300 px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                />
                {draft.length > MAX_CHARS - 100 && (
                  <p className="mt-1 pl-3 text-[11px] text-neutral-400">
                    {MAX_CHARS - draft.length} characters left
                  </p>
                )}
              </div>

              <Button
                type="submit"
                size="icon"
                className="shrink-0 rounded-full"
                disabled={!draft.trim() || send.isPending}
                aria-label="Send"
              >
                <Send size={16} />
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
