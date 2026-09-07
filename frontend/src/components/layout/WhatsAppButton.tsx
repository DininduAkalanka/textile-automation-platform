'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { X, Send, Clock, ShieldCheck } from 'lucide-react';

const WHATSAPP_NUMBER = '94717088445';
const FORMATTED_PHONE = '+94 71 708 8445';

interface Props {
  productContext?: {
    name: string;
    sku?: string;
    price?: number;
    url?: string;
  };
}

export default function WhatsAppButton({ productContext }: Props) {
  const pathname = usePathname();
  const hasStickyBottomBar = pathname === '/cart' || pathname?.startsWith('/products/');

  const [isOpen, setIsOpen] = useState(false);
  const [customMsg, setCustomMsg] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // Mutual exclusion: Close AI chat whenever WhatsApp drawer opens
  useEffect(() => {
    if (isOpen) {
      window.dispatchEvent(new CustomEvent('close-ai-chat'));
    }
  }, [isOpen]);

  // Listen to close-whatsapp-chat event dispatched by AI chat launcher
  useEffect(() => {
    const handleClose = () => setIsOpen(false);
    window.addEventListener('close-whatsapp-chat', handleClose);
    return () => window.removeEventListener('close-whatsapp-chat', handleClose);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const defaultGreeting = productContext
    ? `Hello Nandana Textile, I am interested in "${productContext.name}"${productContext.sku ? ` (SKU: ${productContext.sku})` : ''}. Could you please share more details?`
    : 'Hello Nandana Textile, I would like to inquire about your fabrics and tailoring services.';

  const handleSend = (textToSend?: string) => {
    const text = textToSend || customMsg || defaultGreeting;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  };

  const QUICK_PROMPTS = [
    { label: '📏 Size & Fit Advice', text: 'Hi! Could you help me choose the right size for my measurements?' },
    { label: '👔 Custom Uniform Quote', text: 'Hello, I would like to get a quote for custom school/corporate uniforms.' },
    { label: '🚚 Delivery & Tracking', text: 'Hi! Could you please update me on island-wide courier delivery times?' },
    { label: '💳 Payment & BNPL', text: 'Hi! How do I pay using Koko, Mintpay or Cash on Delivery?' },
  ];

  return (
    <div
      className={`fixed z-40 font-sans transition-all duration-300 ${
        hasStickyBottomBar
          ? 'bottom-20 left-4 sm:bottom-6 sm:left-6'
          : 'bottom-4 left-4 sm:bottom-6 sm:left-6'
      }`}
    >
      {/* ── WhatsApp Popover Panel ───────────────────────────────── */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute bottom-16 left-0 w-[calc(100vw-2rem)] sm:w-[360px] max-w-[360px] max-h-[min(520px,calc(100dvh-6.5rem))] flex flex-col bg-white rounded-2xl shadow-2xl border border-neutral-200/90 overflow-hidden animate-fade-in transition-all"
          style={{ boxShadow: '0 12px 36px -4px rgba(0,0,0,0.22)' }}
        >
          {/* Header */}
          <div className="bg-[#075E54] text-white p-4 relative shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-[#128C7E] flex items-center justify-center font-bold text-lg text-white border-2 border-white/20">
                    NT
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#075E54]" />
                </div>
                <div>
                  <h4 className="font-bold text-sm tracking-wide">Nandana Textile Support</h4>
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Online • {FORMATTED_PHONE}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Close WhatsApp chat"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-2 text-[11px] text-white/90 leading-tight">
              Sri Lanka&apos;s Trusted Textile & Uniform Specialists. Typically replies in under 5 minutes.
            </p>
          </div>

          {/* Chat Body */}
          <div className="p-4 bg-[#E5DDD5]/30 space-y-3 flex-1 overflow-y-auto">
            {/* Incoming Agent Message Bubble */}
            <div className="bg-white rounded-2xl rounded-tl-sm p-3.5 shadow-sm border border-neutral-150 text-xs text-neutral-800 space-y-1.5 max-w-[92%]">
              <p className="font-semibold text-neutral-900">
                Ayubowan! 👋 Welcome to Nandana Textile.
              </p>
              <p className="text-neutral-600 leading-relaxed">
                How can our garment specialists assist you today? Click a quick question below or send us a direct message.
              </p>
              <div className="flex items-center justify-end gap-1 text-[10px] text-neutral-400 pt-0.5">
                <Clock size={10} />
                <span>Just now</span>
              </div>
            </div>

            {/* Product context card if on a product page */}
            {productContext && (
              <div className="bg-white/90 border border-emerald-200 rounded-xl p-2.5 text-xs flex items-center justify-between gap-2 shadow-xs">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-bold text-emerald-700">Product Inquiring:</p>
                  <p className="font-semibold text-neutral-900 truncate text-[11px]">{productContext.name}</p>
                  {productContext.price && (
                    <p className="text-[11px] font-bold text-neutral-700">
                      Rs. {productContext.price.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleSend(defaultGreeting)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-[11px] shrink-0 transition-colors shadow-xs"
                >
                  Inquire Now
                </button>
              </div>
            )}

            {/* Quick Prompt Chips */}
            <div className="space-y-1.5 pt-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Quick Inquiries:</p>
              <div className="grid grid-cols-1 gap-1.5">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => handleSend(q.text)}
                    className="w-full text-left px-3 py-2 rounded-xl bg-white hover:bg-emerald-50 hover:border-emerald-300 border border-neutral-200 text-neutral-700 text-xs font-medium transition-all flex items-center justify-between group shadow-2xs"
                  >
                    <span>{q.label}</span>
                    <span className="text-neutral-400 group-hover:text-emerald-600 font-bold transition-colors">›</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-white border-t border-neutral-200 flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 text-xs bg-neutral-100 rounded-xl border border-neutral-200 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all text-neutral-900 placeholder:text-neutral-400"
            />
            <button
              type="button"
              onClick={() => handleSend()}
              className="w-9 h-9 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white flex items-center justify-center transition-transform hover:scale-105 shadow-sm shrink-0"
              aria-label="Send WhatsApp message"
            >
              <Send size={15} />
            </button>
          </div>

          {/* Secure Guarantee */}
          <div className="bg-neutral-50 py-1.5 px-3 border-t border-neutral-100 flex items-center justify-center gap-1.5 text-[10px] text-neutral-500 shrink-0">
            <ShieldCheck size={12} className="text-emerald-600" />
            <span>Official Nandana Textile verified WhatsApp channel</span>
          </div>
        </div>
      )}

      {/* ── Floating Toggle Button ───────────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle WhatsApp Customer Chat"
        className="group relative flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white p-3.5 sm:px-4 sm:py-3.5 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-emerald-300/50"
      >
        {/* Pulsing ring indicator */}
        <span className="absolute -inset-1 rounded-full bg-[#25D366] opacity-30 group-hover:opacity-50 animate-ping pointer-events-none" />

        {/* Official WhatsApp SVG */}
        <svg
          className="w-6 h-6 fill-current shrink-0"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M17.472 14.382c-.301-.15-1.78-.879-2.056-.98-.276-.1-.476-.15-.677.15-.2.301-.777.98-.952 1.18-.175.201-.351.226-.652.075-.3-.15-1.267-.467-2.414-1.488-.893-.796-1.496-1.78-1.671-2.08-.176-.301-.019-.464.132-.614.135-.135.301-.351.451-.527.151-.175.201-.301.301-.501.101-.2.05-.376-.025-.526-.075-.15-.677-1.63-.927-2.233-.244-.588-.492-.508-.677-.517l-.577-.01c-.201 0-.526.075-.802.376-.276.301-1.053 1.029-1.053 2.51s1.078 2.912 1.229 3.113c.15.201 2.122 3.24 5.141 4.544.718.31 1.279.496 1.716.635.722.23 1.379.197 1.898.12.578-.087 1.78-.727 2.031-1.429.25-.702.25-1.303.175-1.429-.075-.125-.276-.2-.577-.35zM12.04 2C6.52 2 2.03 6.49 2.03 12.01c0 1.95.56 3.84 1.63 5.48L2 22l4.67-1.62c1.58.99 3.42 1.54 5.37 1.54 5.52 0 10.01-4.49 10.01-10.01C22.05 6.49 17.56 2 12.04 2zm0 18.25c-1.74 0-3.41-.49-4.86-1.41l-.35-.22-2.77.96.98-2.7-.24-.38a8.212 8.212 0 0 1-1.28-4.49c0-4.56 3.71-8.27 8.27-8.27 4.56 0 8.27 3.71 8.27 8.27 0 4.56-3.71 8.24-8.27 8.24z" />
        </svg>

        {/* Text label (desktop only) */}
        <span className="hidden sm:inline font-bold text-xs tracking-wider uppercase">
          WhatsApp Us
        </span>
      </button>
    </div>
  );
}
