'use client';

import { useEffect, useState } from 'react';

export default function AppPreloader() {
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Check session storage to avoid flashing preloader on page reloads/navigation
    const hasPreloaded = sessionStorage.getItem('nandana_preloaded');
    if (hasPreloaded) {
      return;
    }

    setVisible(true);

    // Fast loading simulation for premium responsive feel
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 4;
      });
    }, 35);

    // Slide up and fade out triggers
    const timeout1 = setTimeout(() => {
      setFadeOut(true);
      sessionStorage.setItem('nandana_preloaded', 'true');
    }, 1000);

    const timeout2 = setTimeout(() => {
      setVisible(false);
    }, 1750);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout1);
      clearTimeout(timeout2);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0a0a0a',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeOut ? 0 : 1,
        transform: fadeOut ? 'translateY(-100%)' : 'translateY(0)',
        transition: 'opacity 600ms cubic-bezier(0.7, 0, 0.3, 1), transform 800ms cubic-bezier(0.7, 0, 0.3, 1)',
        pointerEvents: fadeOut ? 'none' : 'auto',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '300px', width: '80%' }}>
        {/* Brand Text */}
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '2.1rem',
            color: 'var(--clr-gold)',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 500,
            marginBottom: '0.75rem',
            animation: 'scaleIn 1.2s cubic-bezier(0.16, 1, 0.3, 1) both',
            textAlign: 'center',
          }}
        >
          Nandana
        </h2>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.62rem',
            color: 'rgba(255, 255, 255, 0.45)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: '2.5rem',
          }}
        >
          Premium Textiles
        </span>

        {/* Progress Line wrapper */}
        <div
          style={{
            width: '100%',
            height: '1.5px',
            background: 'rgba(255, 255, 255, 0.08)',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '1px',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(to right, var(--clr-brand) 0%, var(--clr-gold) 100%)',
              transition: 'width 80ms linear',
              boxShadow: '0 0 8px var(--clr-gold)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
