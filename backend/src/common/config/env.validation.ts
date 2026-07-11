import { Type, plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Environment validation (plan Session 0.1).
 *
 * The app previously read `process.env` directly with `|| 'fallback'` defaults,
 * so a missing or empty JWT_SECRET produced a server that booted happily and
 * signed tokens with an empty string. Validating at boot means the process dies
 * immediately and loudly instead — "fail securely, not silently" (doc 09 §2).
 */

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export class EnvironmentVariables {
  @IsOptional()
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  // process.env values are always strings ("3001"), so the target type must be
  // stated explicitly for the coercion to happen.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  PORT = 3001;

  @IsString()
  @IsNotEmpty({ message: 'DATABASE_URL is required' })
  DATABASE_URL!: string;

  /**
   * 32 chars minimum. A short secret is brute-forceable, and there is no
   * fallback: an unsigned or weakly-signed access token defeats the whole auth
   * layer (doc 09 §3).
   */
  @IsString()
  @MinLength(32, {
    message:
      'JWT_SECRET must be at least 32 characters. Generate one with: openssl rand -hex 32',
  })
  JWT_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRATION = '7d';

  /** CORS origin. Wrong value here silently breaks every browser request. */
  @IsUrl({ require_tld: false })
  FRONTEND_URL!: string;

  // ─── Payments (PayHere is the primary gateway — decision D12) ───
  @IsOptional()
  @IsString()
  PAYHERE_MERCHANT_ID?: string;

  @IsOptional()
  @IsString()
  PAYHERE_MERCHANT_SECRET?: string;

  @IsOptional()
  @IsEnum(['sandbox', 'live'])
  PAYHERE_MODE?: string;

  @IsOptional()
  @IsString()
  PAYHERE_NOTIFY_URL?: string;

  // ─── Stripe: cut from MVP (D12), retained only for the legacy mock path ───
  @IsOptional()
  @IsString()
  STRIPE_SECRET_KEY?: string;

  @IsOptional()
  @IsString()
  STRIPE_PUBLISHABLE_KEY?: string;

  @IsOptional()
  @IsString()
  STRIPE_WEBHOOK_SECRET?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('\n  - ');

    // Thrown before the HTTP server starts, so this never reaches a client.
    throw new Error(
      `Invalid environment configuration:\n  - ${details}\n\n` +
        'Copy backend/.env.example to backend/.env and fill in real values.',
    );
  }

  return validated;
}
