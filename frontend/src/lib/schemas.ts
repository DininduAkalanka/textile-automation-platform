import { z } from 'zod';

/**
 * Validation schemas, shared by react-hook-form resolvers and the services.
 *
 * These mirror the backend DTOs (class-validator). Ideally there would be one
 * definition in a shared package (plan decision D1); until that exists these
 * MUST be kept in step with backend/src/auth/dto/*.dto.ts by hand.
 */

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Mirrors RegisterDto: 8+ chars, upper, lower, number. */
export const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Include at least one uppercase letter')
    .regex(/[a-z]/, 'Include at least one lowercase letter')
    .regex(/[0-9]/, 'Include at least one number'),
  phone: z.string().optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * The register FORM additionally confirms the password. This is a client-only
 * concern — the API never sees confirmPassword — so it is a separate schema
 * rather than a field on the DTO mirror above.
 */
export const registerFormSchema = registerSchema
  .extend({ confirmPassword: z.string().min(1, 'Confirm your password') })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type RegisterFormInput = z.infer<typeof registerFormSchema>;
