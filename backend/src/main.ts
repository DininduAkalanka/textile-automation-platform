import { join } from 'path';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { trustProxyHops } from './common/config/limits';
import { swaggerEnabled } from './common/config/exposure';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // QA P1-4: trust X-Forwarded-For only from the real number of proxy hops.
  // A hard-coded 1 let any client on a direct deployment (docker-compose / VPS)
  // pick its own IP with a spoofed header and walk straight past every
  // per-IP rate limit. 0 = trust none (req.ip is the socket address); Render
  // (RENDER=true) gets its single proxy hop; TRUST_PROXY_HOPS overrides both.
  app.set('trust proxy', trustProxyHops());

  // Security headers: HSTS, X-Content-Type-Options, frame-deny, etc.
  // (doc 09 §13, doc 05 §10). CSP is left off because this API serves JSON
  // only — the policy that matters belongs on the Next.js origin.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Parse cookies (httpOnly refresh-token cookie).
  app.use(cookieParser());

  // Global prefix (versioned API — doc 07 §2/§16)
  app.setGlobalPrefix('api/v1');

  // Uploaded product images. Served OUTSIDE the API prefix (static assets
  // ignore setGlobalPrefix) at /uploads/<file>, so the admin UI — and later
  // Instagram, which demands a public URL — can fetch them directly.
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
    // Uploaded files are immutable (random filenames), so cache hard.
    maxAge: '30d',
    index: false,
  });

  // CORS configuration (QA-003): Strict exact-origin allowlist.
  // Wildcard origins (*.vercel.app) are prohibited to prevent malicious third-party origins
  // from making credentialed requests. Credentials (cookies) require SameSite=None; Secure.
  const allowedOriginsSet = new Set<string>();
  if (process.env.FRONTEND_URL) {
    allowedOriginsSet.add(process.env.FRONTEND_URL.trim());
  }
  if (process.env.CORS_ALLOWED_ORIGINS) {
    process.env.CORS_ALLOWED_ORIGINS.split(',').forEach((o) => {
      const trimmed = o.trim();
      if (trimmed) allowedOriginsSet.add(trimmed);
    });
  }
  allowedOriginsSet.add('https://textile-automation-platform.vercel.app');

  // Allow local development origins in non-production
  if (process.env.NODE_ENV !== 'production') {
    allowedOriginsSet.add('http://localhost:3000');
    allowedOriginsSet.add('http://localhost:3001');
    allowedOriginsSet.add('http://127.0.0.1:3000');
    allowedOriginsSet.add('http://127.0.0.1:3001');
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin || allowedOriginsSet.has(origin)) {
        return callback(null, true);
      }
      // Return clean denial without throwing an unhandled Error
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global response transform
  app.useGlobalInterceptors(new TransformInterceptor());

  // Root route greeting so visiting the base domain directly does not return 404
  app.getHttpAdapter().get('/', (_req: Request, res: Response) => {
    res.json({
      message: 'Welcome to the Smart Textile E-Commerce API',
      status: 'online',
      version: '1.0.0',
      ...(swaggerEnabled() ? { docs: '/api/v1/docs' } : {}),
      health: '/api/v1/health',
    });
  });

  // Swagger OpenAPI Documentation (QA P2-11): off in production unless
  // SWAGGER_ENABLED=true; on in development and CI unless SWAGGER_ENABLED=false.
  if (swaggerEnabled()) {
    const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
    const config = new DocumentBuilder()
      .setTitle('Nandana Textile Platform API')
      .setDescription(
        'Enterprise E-Commerce, Production Management & AI Intelligence Platform API specification.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/v1/docs', app, document, {
      customSiteTitle: 'Nandana Textile API Docs',
    });
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  Logger.log(
    `Backend listening on http://localhost:${String(port)}/api/v1` +
      (swaggerEnabled()
        ? ` | Docs: http://localhost:${String(port)}/api/v1/docs`
        : ' | API docs disabled (SWAGGER_ENABLED)'),
    'Bootstrap',
  );
}

void bootstrap();
