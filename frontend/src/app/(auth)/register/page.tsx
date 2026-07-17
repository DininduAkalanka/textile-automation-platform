'use client';

import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { useRegister } from '@/hooks/use-auth';
import { RegisterFormInput, registerFormSchema } from '@/lib/schemas';

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

        <h1 className="mb-1 text-center text-2xl font-bold">
          Create your account
        </h1>
        <p className="mb-8 text-center text-sm text-neutral-500">
          Shop uniforms, fabrics and more
        </p>

        <form
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
              label="First name"
              autoComplete="given-name"
              error={errors.firstName?.message}
              {...register('firstName')}
            />
            <FormField
              label="Last name"
              autoComplete="family-name"
              error={errors.lastName?.message}
              {...register('lastName')}
            />
          </div>

          <p className="-mb-1 text-xs text-neutral-500">
            Provide an email, a phone number, or both — you&apos;ll verify one
            of them.
          </p>

          <FormField
            label="Email (optional if phone given)"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <FormField
            label="Phone (optional if email given)"
            type="tel"
            autoComplete="tel"
            placeholder="07XXXXXXXX"
            error={errors.phone?.message}
            {...register('phone')}
          />

          <FormField
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register('password')}
          />

          <FormField
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <Button
            type="submit"
            size="lg"
            loading={registerMutation.isPending}
            className="mt-2 w-full"
          >
            {registerMutation.isPending ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-indigo-600">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
