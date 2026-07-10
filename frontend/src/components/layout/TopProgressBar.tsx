'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Start page transition progress animation
    setVisible(true);
    setProgress(30);

    const timer1 = setTimeout(() => {
      setProgress(70);
    }, 120);

    const timer2 = setTimeout(() => {
      setProgress(100);
    }, 380);

    const timer3 = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 650);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '3px',
        width: `${progress}%`,
        background: 'linear-gradient(to right, var(--clr-brand) 0%, var(--clr-gold) 100%)',
        zIndex: 99999,
        transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1), opacity 150ms ease',
        boxShadow: '0 0 10px rgba(204, 0, 0, 0.4)',
      }}
    />
  );
}
