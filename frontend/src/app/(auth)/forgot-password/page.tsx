'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';

import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { authService } from '@/services/auth.service';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const request = useMutation({ mutationFn: authService.forgotPassword });

  return (
    <AuthShell>
      <h1 className="text-[26px] font-bold text-white">Forgot password?</h1>
      {request.isSuccess ? (
        <div role="status" className="mt-4 space-y-4 text-sm text-white/75">
          <p>If {request.variables} is a verified contact on an active account, a reset link will arrive by {request.variables.includes('@') ? 'email' : 'SMS'}. It expires in 15 minutes.</p>
          <button type="button" onClick={() => request.reset()} className="text-[#FB6B6B] hover:underline">
            Request another link
          </button>
        </div>
      ) : (
        <form className="mt-4 space-y-5" onSubmit={(event) => {
          event.preventDefault();
          request.mutate(identifier.trim());
        }}>
          <p className="text-sm text-white/70">Enter the email or mobile number you verified for your account.</p>
          <FormField label="Email or phone" autoComplete="username" required maxLength={254}
            value={identifier} onChange={(event) => setIdentifier(event.target.value)}
            className="border-white/15 bg-white/5 text-white" />
          {request.isError && <p role="alert" className="text-sm text-[#FB6B6B]">{request.error.message}</p>}
          <Button type="submit" size="lg" loading={request.isPending} className="w-full bg-[#CC0000] hover:bg-[#E00000]">
            Send reset link
          </Button>
        </form>
      )}
      <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-[#FB6B6B] hover:underline">Back to sign in</Link>
    </AuthShell>
  );
}
