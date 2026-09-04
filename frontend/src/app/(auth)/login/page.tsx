'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { useLogin } from '@/hooks/use-auth';
import { LoginInput, loginSchema } from '@/lib/schemas';

// Premium dark auth theme, applied locally so the shared components (and the
// indigo storefront) are untouched. Red primary on the near-black ground.
const SUBMIT_BTN =
  'mt-2 w-full bg-[#CC0000] hover:bg-[#E00000] focus-visible:ring-white/40';
const INPUT_FOCUS =
  'border-white/15 bg-white/[0.05] text-white placeholder:text-white/35 focus-visible:border-[#CC0000] focus-visible:ring-[#CC0000]';

function LoginForm() {
  const searchParams = useSearchParams();
  // proxy.ts sets this when it bounces an unauthenticated user off a gated page.
  const returnTo = searchParams.get('returnTo') ?? undefined;

  const login = useLogin(returnTo);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  return (
    <form
      data-testid="login-form"
      onSubmit={handleSubmit((values) => login.mutate(values))}
      className="flex flex-col gap-5"
      noValidate
    >
      <FormField
        data-testid="login-identifier-input"
        label="Email or phone"
        type="text"
        autoComplete="username"
        placeholder="you@example.com or 0771234567"
        error={errors.identifier?.message}
        className={INPUT_FOCUS}
        {...register('identifier')}
      />

      <FormField
        data-testid="login-password-input"
        label="Password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        error={errors.password?.message}
        className={INPUT_FOCUS}
        {...register('password')}
      />

      <Button
        data-testid="login-submit-btn"
        type="submit"
        size="lg"
        loading={login.isPending}
        className={SUBMIT_BTN}
      >
        {login.isPending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell>
      <h1 className="text-[26px] font-bold tracking-tight text-white">
        Welcome back
      </h1>
      <p className="mt-1.5 text-sm text-white/55">
        Sign in to your account to continue
      </p>

      <div className="mt-8">
        {/* useSearchParams needs a Suspense boundary to keep the page static. */}
        <Suspense fallback={<div className="h-64" />}>
          <LoginForm />
        </Suspense>
      </div>

      <p className="mt-6 text-sm text-white/55">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-semibold text-[#FB6B6B] hover:text-[#ff8585]">
          Create one
        </Link>
      </p>

      {process.env.NODE_ENV !== 'production' && (
        <div className="mt-8 rounded-xl border border-white/10 border-l-2 border-l-[#CC0000] bg-white/[0.04] p-4 text-xs text-white/50">
          <p className="mb-1.5 font-semibold text-white/70">Demo credentials</p>
          <p>Admin: admin@textileshop.com / Admin@123456</p>
          <p>Customer: customer@example.com / Customer@123456</p>
        </div>
      )}
    </AuthShell>
  );
}
