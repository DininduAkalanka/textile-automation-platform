'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ContactPage() {
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    phone: '',
    inquiryType: 'general',
    subject: '',
    message: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 700);
  };

  return (
    <div className="bg-neutral-50 min-h-screen text-neutral-800">
      {/* ── Breadcrumb ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-neutral-200/80">
        <div className="container mx-auto px-4 py-3.5">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-neutral-500 font-sans">
            <Link href="/" className="hover:text-neutral-900 transition-colors">
              Home
            </Link>
            <span className="text-neutral-300">/</span>
            <span className="text-neutral-900 font-medium">Contact & Showrooms</span>
          </nav>
        </div>
      </div>

      {/* ── Hero Header: Refined Editorial Typography ──────────── */}
      <section className="bg-white border-b border-neutral-200/80 py-12 sm:py-16">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#CC0000] mb-3">
            <span className="w-5 h-[1.5px] bg-[#CC0000] inline-block" />
            SHOWROOMS & CUSTOMER CONCIERGE
            <span className="w-5 h-[1.5px] bg-[#CC0000] inline-block" />
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-neutral-900 tracking-tight">
            How May We Assist You?
          </h1>
          <p className="mt-3 text-sm sm:text-base text-neutral-600 max-w-2xl mx-auto leading-relaxed font-sans">
            Visit our physical showrooms in Veyangoda and Kurunegala for in-store order collection, 
            private fitting rooms, or contact our dedicated uniform and fabric specialists.
          </p>
        </div>
      </section>

      {/* ── Direct Contact Channels: Production-Grade Monochromatic Architecture ── */}
      <section className="py-8 sm:py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            
            {/* Phone Channel */}
            <div className="bg-white rounded-xl p-6 border border-neutral-200/90 shadow-sm hover:border-neutral-300 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-lg bg-neutral-100 text-neutral-900 flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <h2 className="text-sm font-bold text-neutral-900">Direct Telephone</h2>
              <p className="text-[11.5px] text-neutral-500 mt-1 mb-3">Mon – Sat: 8:30 AM – 7:00 PM</p>
              <div className="space-y-1 font-mono text-xs">
                <a href="tel:0332288445" className="block text-neutral-800 hover:text-[#CC0000] font-semibold transition-colors">
                  033 228 8445 <span className="text-[10px] font-normal text-neutral-500">(Veyangoda)</span>
                </a>
                <a href="tel:0717088445" className="block text-neutral-800 hover:text-[#CC0000] font-semibold transition-colors">
                  071 708 8445 <span className="text-[10px] font-normal text-neutral-500">(Hotline)</span>
                </a>
              </div>
            </div>

            {/* WhatsApp Channel */}
            <div className="bg-white rounded-xl p-6 border border-neutral-200/90 shadow-sm hover:border-neutral-300 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-lg bg-neutral-100 text-neutral-900 flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                </svg>
              </div>
              <h2 className="text-sm font-bold text-neutral-900">WhatsApp Concierge</h2>
              <p className="text-[11.5px] text-neutral-500 mt-1 mb-3">Instant sizing & order guidance</p>
              <a
                href="https://wa.me/94717088445?text=Hello%20Nandana%20Textile,%20I'd%20like%20to%20inquire%20about%20your%20products"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-neutral-900 hover:text-[#CC0000] transition-colors"
              >
                <span>+94 71 708 8445</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
              </a>
            </div>

            {/* Email Channel */}
            <div className="bg-white rounded-xl p-6 border border-neutral-200/90 shadow-sm hover:border-neutral-300 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-lg bg-neutral-100 text-neutral-900 flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <h2 className="text-sm font-bold text-neutral-900">Email Inquiries</h2>
              <p className="text-[11.5px] text-neutral-500 mt-1 mb-3">Within 24 business hours</p>
              <a href="mailto:info@nandanatextile.lk" className="block font-mono text-xs font-semibold text-neutral-900 hover:text-[#CC0000] truncate transition-colors">
                info@nandanatextile.lk
              </a>
            </div>

            {/* In-Store Pickup Channel */}
            <div className="bg-white rounded-xl p-6 border border-neutral-200/90 shadow-sm hover:border-neutral-300 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-lg bg-neutral-100 text-neutral-900 flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <h2 className="text-sm font-bold text-neutral-900">In-Store Pickup</h2>
              <p className="text-[11.5px] text-neutral-500 mt-1 mb-3">Ready in 2–4 hours | Zero fee</p>
              <span className="inline-block text-[11px] font-mono uppercase tracking-wider text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-sm">
                Veyangoda & Kurunegala
              </span>
            </div>

          </div>
        </div>
      </section>

      {/* ── Showroom Locations: Architectural Fashion Cards ───── */}
      <section className="py-6 sm:py-10">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="mb-8 pb-3 border-b border-neutral-200">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#CC0000] font-semibold block mb-1">
              PHYSICAL STORES
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-neutral-900">
              Nandana Textile Showrooms
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              Visit our showrooms to collect orders, try garments in private fitting rooms, or consult our tailoring specialists.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Veyangoda Flagship */}
            <div className="bg-white rounded-xl border border-neutral-200/90 p-6 sm:p-7 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 bg-neutral-900 text-white rounded-sm">
                    FLAGSHIP SHOWROOM
                  </span>
                  <span className="text-[11px] font-mono font-medium text-neutral-600">
                    Open Mon – Sat
                  </span>
                </div>
                <h3 className="font-serif text-xl font-bold text-neutral-900">
                  Nandana Textile — Veyangoda
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 mt-1.5 flex items-start gap-2">
                  <svg className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>50 Main Street, Veyangoda, Sri Lanka</span>
                </p>

                <div className="mt-5 pt-4 border-t border-neutral-100 space-y-2.5 text-xs text-neutral-600 font-sans">
                  <div className="flex justify-between py-1 border-b border-neutral-100">
                    <span className="font-medium text-neutral-800">Monday – Saturday</span>
                    <span className="font-mono text-neutral-700">8:30 AM – 7:00 PM</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-neutral-100">
                    <span className="font-medium text-neutral-800">Sunday & Poya Days</span>
                    <span className="font-mono text-neutral-700">9:00 AM – 3:00 PM</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-medium text-neutral-800">Showroom Phone</span>
                    <a href="tel:0332288445" className="hover:text-[#CC0000] font-mono font-semibold text-neutral-900">033 228 8445</a>
                  </div>
                </div>

                <div className="mt-5 p-3.5 bg-neutral-50 rounded-lg border border-neutral-100 text-xs text-neutral-600">
                  <p className="font-bold text-neutral-900 mb-2 uppercase tracking-wider text-[10px] font-mono">Showroom Services:</p>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <span className="bg-white px-2 py-0.5 rounded-sm border border-neutral-200">Express Online Order Pickup</span>
                    <span className="bg-white px-2 py-0.5 rounded-sm border border-neutral-200">Private Trial & Fitting Rooms</span>
                    <span className="bg-white px-2 py-0.5 rounded-sm border border-neutral-200">On-Site Tailoring Adjustments</span>
                    <span className="bg-white px-2 py-0.5 rounded-sm border border-neutral-200">School & Corporate Uniforms</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center gap-3">
                <a
                  href="https://maps.google.com/?q=50+Main+Street+Veyangoda+Nandana+Textile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center py-2.5 px-4 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <span>Directions on Map</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                </a>
                <a
                  href="https://wa.me/94717088445?text=Hello%20Nandana%20Textile%20Veyangoda,%20I'd%20like%20to%20check%20showroom%20visiting%20hours"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-5 rounded-lg border border-neutral-300 hover:border-neutral-900 text-neutral-900 text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>

            {/* Kurunegala Branch */}
            <div className="bg-white rounded-xl border border-neutral-200/90 p-6 sm:p-7 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 border border-neutral-300 text-neutral-800 bg-neutral-50 rounded-sm">
                    KURUNEGALA BRANCH
                  </span>
                  <span className="text-[11px] font-mono font-medium text-neutral-600">
                    Open Mon – Sat
                  </span>
                </div>
                <h3 className="font-serif text-xl font-bold text-neutral-900">
                  Nandana Textile — Kurunegala
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 mt-1.5 flex items-start gap-2">
                  <svg className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>No. 145, Main Street, Kurunegala, Sri Lanka</span>
                </p>

                <div className="mt-5 pt-4 border-t border-neutral-100 space-y-2.5 text-xs text-neutral-600 font-sans">
                  <div className="flex justify-between py-1 border-b border-neutral-100">
                    <span className="font-medium text-neutral-800">Monday – Saturday</span>
                    <span className="font-mono text-neutral-700">8:30 AM – 6:00 PM</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-neutral-100">
                    <span className="font-medium text-neutral-800">Sunday & Poya Days</span>
                    <span className="font-mono text-neutral-700">9:00 AM – 2:00 PM</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-medium text-neutral-800">Direct Hotline</span>
                    <a href="tel:0717088445" className="hover:text-[#CC0000] font-mono font-semibold text-neutral-900">071 708 8445</a>
                  </div>
                </div>

                <div className="mt-5 p-3.5 bg-neutral-50 rounded-lg border border-neutral-100 text-xs text-neutral-600">
                  <p className="font-bold text-neutral-900 mb-2 uppercase tracking-wider text-[10px] font-mono">Showroom Services:</p>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <span className="bg-white px-2 py-0.5 rounded-sm border border-neutral-200">Textile Yardage & Fabric Rolls</span>
                    <span className="bg-white px-2 py-0.5 rounded-sm border border-neutral-200">Online Order Pickup Counter</span>
                    <span className="bg-white px-2 py-0.5 rounded-sm border border-neutral-200">In-Store Returns & Exchanges</span>
                    <span className="bg-white px-2 py-0.5 rounded-sm border border-neutral-200">Institutional Uniform Desk</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center gap-3">
                <a
                  href="https://maps.google.com/?q=145+Main+Street+Kurunegala+Nandana+Textile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center py-2.5 px-4 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <span>Directions on Map</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                </a>
                <a
                  href="https://wa.me/94717088445?text=Hello%20Nandana%20Textile%20Kurunegala,%20I'd%20like%20to%20inquire%20about%20store%20pickup"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-5 rounded-lg border border-neutral-300 hover:border-neutral-900 text-neutral-900 text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Contact Form & Pickup Guide ────────────────────────── */}
      <section className="py-10 sm:py-16 bg-white border-t border-b border-neutral-200/80">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

            {/* Left: Contact Form */}
            <div className="lg:col-span-7">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#CC0000] font-semibold block mb-1">
                SEND AN INQUIRY
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
                We're Here to Help
              </h2>
              <p className="text-xs sm:text-sm text-neutral-600 mb-6">
                Fill out the form below and our team will get back to you promptly within business hours.
              </p>

              {submitted ? (
                <div className="p-7 bg-neutral-50 rounded-xl border border-neutral-200 text-center animate-fade-in">
                  <div className="w-12 h-12 rounded-full bg-neutral-900 text-white flex items-center justify-center mx-auto mb-3">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3 className="font-serif text-lg font-bold text-neutral-900">Message Received</h3>
                  <p className="text-xs text-neutral-600 mt-1 max-w-md mx-auto">
                    Thank you for reaching out to Nandana Textile. Our customer support team will contact you via phone or email shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setFormState({
                        name: '',
                        email: '',
                        phone: '',
                        inquiryType: 'general',
                        subject: '',
                        message: '',
                      });
                    }}
                    className="mt-4 font-mono text-xs font-bold text-[#CC0000] hover:underline uppercase tracking-wider"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-800 mb-1">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formState.name}
                        onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                        placeholder="Kasun Perera"
                        className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-[#CC0000] focus:border-[#CC0000] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-800 mb-1">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={formState.email}
                        onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                        placeholder="kasun@example.com"
                        className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-[#CC0000] focus:border-[#CC0000] transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-800 mb-1">
                        Phone / WhatsApp Number
                      </label>
                      <input
                        type="tel"
                        value={formState.phone}
                        onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                        placeholder="071 234 5678"
                        className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-[#CC0000] focus:border-[#CC0000] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-800 mb-1">
                        Inquiry Topic <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formState.inquiryType}
                        onChange={(e) => setFormState({ ...formState, inquiryType: e.target.value })}
                        className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-[#CC0000] focus:border-[#CC0000] bg-white transition-colors"
                      >
                        <option value="general">General Customer Service</option>
                        <option value="pickup">Showroom Order Pickup & Status</option>
                        <option value="uniforms">School & Corporate Uniform Procurement</option>
                        <option value="tailoring">Custom Measurement & Tailoring</option>
                        <option value="exchange">Return or Exchange Request</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1">
                      Subject <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formState.subject}
                      onChange={(e) => setFormState({ ...formState, subject: e.target.value })}
                      placeholder="Brief summary of your inquiry"
                      className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-[#CC0000] focus:border-[#CC0000] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1">
                      Message Details <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={formState.message}
                      onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                      placeholder="Please provide details regarding your inquiry, order ID if applicable, or questions..."
                      className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-[#CC0000] focus:border-[#CC0000] transition-colors resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-8 py-3 rounded-lg bg-[#CC0000] hover:bg-[#b30000] text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Sending...</span>
                      </>
                    ) : (
                      <span>Submit Message</span>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Right: In-Store Pickup Guide */}
            <div className="lg:col-span-5 bg-neutral-50 rounded-xl p-6 sm:p-7 border border-neutral-200/80">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-semibold block mb-1">
                FULFILLMENT GUIDE
              </span>
              <h3 className="font-serif text-lg font-bold text-neutral-900 mb-4">
                How Showroom Pickup Works
              </h3>

              <div className="space-y-4">
                <div className="flex items-start gap-3 text-xs">
                  <div className="w-6 h-6 rounded bg-neutral-900 text-white flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5">
                    01
                  </div>
                  <div>
                    <p className="font-bold text-neutral-900">Select Store Pickup at Checkout</p>
                    <p className="text-neutral-600 mt-0.5 text-[11.5px] leading-relaxed">
                      Choose either Veyangoda or Kurunegala showroom during online checkout. There are zero shipping or handling fees.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-xs">
                  <div className="w-6 h-6 rounded bg-neutral-900 text-white flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5">
                    02
                  </div>
                  <div>
                    <p className="font-bold text-neutral-900">Receive Ready Notification</p>
                    <p className="text-neutral-600 mt-0.5 text-[11.5px] leading-relaxed">
                      Orders placed before 2:00 PM are prepared the same day within 2 to 4 hours. You will receive an SMS and email with your pickup confirmation code.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-xs">
                  <div className="w-6 h-6 rounded bg-neutral-900 text-white flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5">
                    03
                  </div>
                  <div>
                    <p className="font-bold text-neutral-900">Visit Showroom & Try On</p>
                    <p className="text-neutral-600 mt-0.5 text-[11.5px] leading-relaxed">
                      Present your order code at the pickup counter. You are invited to try your garments in our private fitting rooms before leaving.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-xs">
                  <div className="w-6 h-6 rounded bg-neutral-900 text-white flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5">
                    04
                  </div>
                  <div>
                    <p className="font-bold text-neutral-900">Instant Size Exchange</p>
                    <p className="text-neutral-600 mt-0.5 text-[11.5px] leading-relaxed">
                      If an alternative size or cut fits better, exchange garments immediately on the spot with zero delay.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-neutral-200/80">
                <p className="text-xs text-neutral-500 mb-2">Need immediate status on an existing pickup order?</p>
                <a
                  href="https://wa.me/94717088445?text=Hello,%20I'm%20inquiring%20about%20my%20store%20pickup%20order"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs font-bold text-neutral-900 hover:text-[#CC0000] inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>Chat with Showroom Desk on WhatsApp →</span>
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── FAQ Section ────────────────────────────────────────── */}
      <section className="py-12 sm:py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-8">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#CC0000] font-semibold block mb-1">
              STORE POLICIES
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-neutral-900">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3">
            {[
              {
                q: 'How long are in-store pickup orders held?',
                a: 'Orders are held at your selected showroom for up to 7 calendar days from the date of the "Ready for Pickup" notification. If you require extended holding, simply notify our team via WhatsApp or phone.',
              },
              {
                q: 'Can an authorized representative collect the order?',
                a: 'Yes. Please have them present the order confirmation SMS or email containing your Order ID (#ORD-XXXX).',
              },
              {
                q: 'What payment options are available at pickup?',
                a: 'You may choose Pay at Store / Cash on Delivery during checkout, or settle via Visa, Mastercard, or Koko BNPL at the showroom terminal.',
              },
              {
                q: 'Do you offer tailoring and alteration services on-site?',
                a: 'Yes. Our flagship showroom in Veyangoda provides trouser length hemming, uniform adjustments, and corporate tailoring consultations.',
              },
            ].map((faq, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-neutral-200/90 p-5">
                <h3 className="text-sm font-bold text-neutral-900">{faq.q}</h3>
                <p className="text-xs text-neutral-600 mt-1.5 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
