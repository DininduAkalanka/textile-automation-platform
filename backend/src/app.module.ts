import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ProductionModule } from './production/production.module';
import { InventoryModule } from './inventory/inventory.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AiModule } from './ai/ai.module';
import { SocialModule } from './social/social.module';
import { UploadsModule } from './uploads/uploads.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AppController } from './app.controller';
import { validateEnv } from './common/config/env.validation';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      // Fail fast on a bad environment rather than booting with an empty
      // JWT_SECRET and silently signing worthless tokens (plan Session 0.1).
      validate: validateEnv,
    }),
    // Default API rate limit: 100 requests/min/IP (doc 09 §5.1).
    // Auth endpoints tighten this to 20/min via @Throttle.
    // In test/CI mode, raise limits to prevent 429s from automated test suites
    // where every spec's beforeEach fires a login request (29 tests × retries).
    ThrottlerModule.forRoot([{
      ttl: 60_000,
      limit: process.env.THROTTLE_LIMIT
        ? parseInt(process.env.THROTTLE_LIMIT, 10)
        : process.env.NODE_ENV === 'test'
        ? 10_000
        : 100,
    }]),
    PrismaModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    AnalyticsModule,
    ProductionModule,
    InventoryModule,
    NotificationsModule,
    AiModule,
    SocialModule,
    UploadsModule,
    ReviewsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // F-07: Global deny-by-default JWT guard. Every route requires a valid
    // JWT unless decorated with @Public(). This means a new controller that
    // forgets @UseGuards(JwtAuthGuard) fails CLOSED (401) rather than open.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
