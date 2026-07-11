'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { useLogin } from '@/hooks/use-auth';
import { LoginInput, loginSchema } from '@/lib/schemas';

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
    defaultValues: { email: '', password: '' },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => login.mutate(values))}
      className="flex flex-col gap-5"
      noValidate
    >
      <FormField
        label="Email address"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register('email')}
      />

      <FormField
        label="Password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        error={errors.password?.message}
        {...register('password')}
      />

      <Button
        type="submit"
        size="lg"
        loading={login.isPending}
        className="mt-2 w-full"
      >
        {login.isPending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}

export default function LoginPage() {
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

        <h1 className="mb-1 text-center text-2xl font-bold">Welcome back</h1>
        <p className="mb-8 text-center text-sm text-neutral-500">
          Sign in to your account to continue
        </p>

        {/* useSearchParams needs a Suspense boundary to keep the page static. */}
        <Suspense fallback={<div className="h-64" />}>
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-indigo-600">
            Create one
          </Link>
        </p>

        <div className="mt-6 rounded-lg bg-neutral-100 p-4 text-xs text-neutral-500">
          <p className="mb-1.5 font-semibold">Demo credentials</p>
          <p>Admin: admin@textileshop.com / Admin@123456</p>
          <p>Customer: customer@example.com / Customer@123456</p>
        </div>
      </div>
    </div>
  );
}
