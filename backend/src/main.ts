import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

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

  // CORS. FRONTEND_URL is validated at boot, so there is no fallback origin.
  app.enableCors({
    origin: process.env.FRONTEND_URL,
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

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  // The path was previously logged as /api, which is not where anything lives.
  Logger.log(
    `Backend listening on http://localhost:${String(port)}/api/v1`,
    'Bootstrap',
  );
}

void bootstrap();
