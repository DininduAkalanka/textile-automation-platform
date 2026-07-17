import { z } from 'zod';

/**
 * Validation schemas, shared by react-hook-form resolvers and the services.
 *
 * These mirror the backend DTOs (class-validator). Ideally there would be one
 * definition in a shared package (plan decision D1); until that exists these
 * MUST be kept in step with backend/src/auth/dto/*.dto.ts by hand.
 */

// Accepts the ways a customer types an LK mobile: 0771234567, +94771234567,
// 94771234567. The backend normalizes to +947XXXXXXXX authoritatively.
const LK_PHONE_RE = /^(?:\+?94|0)7\d{8}$/;

export const loginSchema = z.object({
  // Email OR phone — the backend resolves whichever was given.
  identifier: z.string().min(1, 'Enter your email or phone number'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Mirrors RegisterDto: email and phone are BOTH optional at the field level,
 * with an "at least one" rule enforced on the form schema below (and again by
 * the backend). Password: 8+ chars, upper, lower, number.
 */
export const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z
    .string()
    .email('Enter a valid email address')
    .optional()
    .or(z.literal('')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Include at least one uppercase letter')
    .regex(/[a-z]/, 'Include at least one lowercase letter')
    .regex(/[0-9]/, 'Include at least one number'),
  phone: z
    .string()
    .regex(LK_PHONE_RE, 'Enter a valid Sri Lankan mobile (e.g. 0771234567)')
    .optional()
    .or(z.literal('')),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * The register FORM additionally confirms the password (a client-only concern —
 * the API never sees confirmPassword) and enforces "provide at least one
 * contact", so both the password-match and contact rules live here.
 */
export const registerFormSchema = registerSchema
  .extend({ confirmPassword: z.string().min(1, 'Confirm your password') })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((values) => Boolean(values.email || values.phone), {
    message: 'Provide an email or a phone number',
    path: ['email'],
  });
export type RegisterFormInput = z.infer<typeof registerFormSchema>;
