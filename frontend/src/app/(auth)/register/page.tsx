'use client';

import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { useRegister } from '@/hooks/use-auth';
import { RegisterFormInput, registerFormSchema } from '@/lib/schemas';

// Premium dark auth theme, applied locally (shared components stay indigo).
const SUBMIT_BTN =
  'mt-2 w-full bg-[#CC0000] hover:bg-[#E00000] focus-visible:ring-white/40';
const INPUT_FOCUS =
  'border-white/15 bg-white/[0.05] text-white placeholder:text-white/35 focus-visible:border-[#CC0000] focus-visible:ring-[#CC0000]';

export default function RegisterPage() {
  const registerMutation = useRegister();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormInput>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: '',
    },
  });

  return (
    <AuthShell>
      <h1 className="text-[26px] font-bold tracking-tight text-white">
        Create your account
      </h1>
      <p className="mt-1.5 text-sm text-white/55">
        Shop uniforms, fabrics and more
      </p>

      <div className="mt-8">
        <form
          data-testid="register-form"
          onSubmit={handleSubmit((values) =>
            // confirmPassword is a form-only field; the API never sees it.
            // Empty contact fields are sent as undefined, not '', so the
            // backend's optional email/phone validation treats them as absent.
            registerMutation.mutate({
              firstName: values.firstName,
              lastName: values.lastName,
              email: values.email || undefined,
              password: values.password,
              phone: values.phone || undefined,
            }),
          )}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-3">
            <FormField
              data-testid="register-firstname-input"
              label="First name"
              autoComplete="given-name"
              error={errors.firstName?.message}
              className={INPUT_FOCUS}
              {...register('firstName')}
            />
            <FormField
              data-testid="register-lastname-input"
              label="Last name"
              autoComplete="family-name"
              error={errors.lastName?.message}
              className={INPUT_FOCUS}
              {...register('lastName')}
            />
          </div>

          <p className="-mb-1 text-xs text-white/45">
            Provide an email, a phone number, or both — you&apos;ll verify one
            of them.
          </p>

          <FormField
            data-testid="register-email-input"
            label="Email (optional if phone given)"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            className={INPUT_FOCUS}
            {...register('email')}
          />

          <FormField
            data-testid="register-phone-input"
            label="Phone (optional if email given)"
            type="tel"
            autoComplete="tel"
            placeholder="07XXXXXXXX"
            error={errors.phone?.message}
            className={INPUT_FOCUS}
            {...register('phone')}
          />

          <FormField
            data-testid="register-password-input"
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            error={errors.password?.message}
            className={INPUT_FOCUS}
            {...register('password')}
          />

          <FormField
            data-testid="register-confirm-password-input"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            error={errors.confirmPassword?.message}
            className={INPUT_FOCUS}
            {...register('confirmPassword')}
          />

          <Button
            data-testid="register-submit-btn"
            type="submit"
            size="lg"
            loading={registerMutation.isPending}
            className={SUBMIT_BTN}
          >
            {registerMutation.isPending ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-sm text-white/55">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-[#FB6B6B] hover:text-[#ff8585]">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
