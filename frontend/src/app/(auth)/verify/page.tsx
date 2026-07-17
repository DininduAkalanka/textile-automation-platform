'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { useAuthStore } from '@/store/useAuthStore';
import { useSendCode, useVerifyCode } from '@/hooks/use-auth';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-200 p-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-10 shadow-xl">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 no-underline">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-indigo-600 text-lg font-bold text-white">
              T
            </div>
            <span className="font-display text-2xl font-bold text-neutral-900">
              TextileShop
            </span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/';
  const router = useRouter();

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loadUser = useAuthStore((s) => s.loadUser);

  const sendCode = useSendCode();
  const verifyCode = useVerifyCode();

  // Registration auto-sends the first code, then redirects here with
  // ?sent=EMAIL|SMS — start straight in code-entry mode for that channel so
  // the user types the code they already received instead of re-sending
  // into the 60s cooldown.
  const sentParam = searchParams.get('sent');
  const initialChannel: 'EMAIL' | 'SMS' | null =
    sentParam === 'EMAIL' || sentParam === 'SMS' ? sentParam : null;

  const [channel, setChannel] = useState<'EMAIL' | 'SMS' | null>(
    initialChannel,
  );
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(initialChannel ? 60 : 0);

  // The (auth) route group has no layout that hydrates the session, so on a
  // direct load pull the profile in ourselves.
  useEffect(() => {
    if (!isAuthenticated) void loadUser();
  }, [isAuthenticated, loadUser]);

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSend = (ch: 'EMAIL' | 'SMS') => {
    sendCode.mutate(ch, {
      onSuccess: () => {
        setChannel(ch);
        setCode('');
        setCooldown(60);
      },
      onError: (err: Error) => {
        // A cooldown error means a valid code was ALREADY sent moments ago
        // (e.g. the auto-send at registration) — open the entry field so the
        // user can type that code instead of being stranded behind the timer.
        if ((err as Error & { code?: string }).code === 'OTP_COOLDOWN') {
          setChannel(ch);
          setCooldown(60);
        }
      },
    });
  };

  const handleVerify = () => {
    if (!channel) return;
    verifyCode.mutate(
      { channel, code },
      { onSuccess: () => router.push(returnTo) },
    );
  };

  // Not signed in.
  if (!user && !isAuthenticated) {
    return (
      <Shell>
        <h1 className="mb-1 text-center text-2xl font-bold">Verify your contact</h1>
        <p className="mb-8 text-center text-sm text-neutral-500">
          Please sign in first, then come back to verify.
        </p>
        <Link href="/login" className="block">
          <Button size="lg" className="w-full">Sign in</Button>
        </Link>
      </Shell>
    );
  }

  // Already verified — nothing to do.
  if (user?.emailVerified || user?.phoneVerified) {
    return (
      <Shell>
        <p className="mb-2 text-center text-4xl">✅</p>
        <h1 className="mb-1 text-center text-2xl font-bold">You&apos;re verified</h1>
        <p className="mb-8 text-center text-sm text-neutral-500">
          Your contact is confirmed — you&apos;re all set to check out.
        </p>
        <Button size="lg" className="w-full" onClick={() => router.push(returnTo)}>
          Continue
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="mb-1 text-center text-2xl font-bold">Verify your contact</h1>
      <p className="mb-8 text-center text-sm text-neutral-500">
        Confirm your email or phone so we can send you order updates.
      </p>

      {!channel ? (
        <div className="flex flex-col gap-3">
          {user?.email && !user.emailVerified && (
            <Button
              size="lg"
              className="w-full"
              loading={sendCode.isPending}
              onClick={() => handleSend('EMAIL')}
            >
              Email a code to {user.email}
            </Button>
          )}
          {user?.phone && !user.phoneVerified && (
            <Button
              size="lg"
              variant={user?.email ? 'outline' : 'default'}
              className="w-full"
              loading={sendCode.isPending}
              onClick={() => handleSend('SMS')}
            >
              Text a code to {user.phone}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-600">
            Enter the 6-digit code sent to your{' '}
            {channel === 'EMAIL' ? 'email' : 'phone'}.
          </p>
          <FormField
            label="Verification code"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <Button
            size="lg"
            className="w-full"
            loading={verifyCode.isPending}
            disabled={code.length !== 6}
            onClick={handleVerify}
          >
            Verify
          </Button>
          <button
            type="button"
            className="text-sm text-indigo-600 disabled:text-neutral-400"
            disabled={cooldown > 0 || sendCode.isPending}
            onClick={() => handleSend(channel)}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>
          {user?.email && user?.phone && (
            <button
              type="button"
              className="text-sm text-neutral-500"
              onClick={() => setChannel(null)}
            >
              Use a different method
            </button>
          )}
        </div>
      )}
    </Shell>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <div className="h-40 animate-pulse rounded-lg bg-neutral-100" />
        </Shell>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
