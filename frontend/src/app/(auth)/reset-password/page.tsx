'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';

import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { registerSchema } from '@/lib/schemas';
import { authService } from '@/services/auth.service';

export default function ResetPasswordPage() {
  const [error, setError] = useState('');
  const reset = useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) => authService.resetPassword(token, password),
    onSuccess: () => window.history.replaceState(null, '', window.location.pathname),
  });
  return (
    <AuthShell>
      <h1 className="text-[26px] font-bold text-white">{reset.isSuccess ? 'Password updated' : 'Choose a new password'}</h1>
      {reset.isSuccess ? (
        <div className="mt-4 space-y-5 text-sm text-white/75">
          <p role="status">You can now sign in with your new password.</p>
          <Link href="/login" className="inline-block font-semibold text-[#FB6B6B] hover:underline">Sign in</Link>
        </div>
      ) : (
        <form className="mt-4 space-y-5" onSubmit={(event) => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          const password = String(fields.get('password') ?? '');
          const validation = registerSchema.shape.password.safeParse(password);
          if (!validation.success) return setError(validation.error.issues[0].message);
          if (password !== fields.get('confirmation')) return setError('Passwords do not match.');
          const token = window.location.hash.slice(1);
          if (!/^[0-9a-f]{64}$/.test(token)) return setError('Open the link from your reset message or request a new one.');
          setError('');
          reset.mutate({ token, password });
        }}>
          <p className="text-sm text-white/70">Use 8–64 characters, including an uppercase letter, a lowercase letter and a number. Admin and manager accounts need at least 12 characters.</p>
          <FormField label="New password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={64} required className="border-white/15 bg-white/5 text-white" />
          <FormField label="Confirm new password" name="confirmation" type="password" autoComplete="new-password" maxLength={64} required className="border-white/15 bg-white/5 text-white" />
          {(error || reset.isError) && <p role="alert" className="text-sm text-[#FB6B6B]">{error || reset.error?.message}</p>}
          <Button type="submit" size="lg" loading={reset.isPending} className="w-full bg-[#CC0000] hover:bg-[#E00000]">Reset password</Button>
          <Link href="/forgot-password" className="inline-block text-sm font-semibold text-[#FB6B6B] hover:underline">Request a new link</Link>
        </form>
      )}
    </AuthShell>
  );
}
