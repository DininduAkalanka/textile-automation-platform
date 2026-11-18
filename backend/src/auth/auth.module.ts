import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';
import { PasswordRecoveryService } from './password-recovery.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { VerificationModule } from '../verification/verification.module';

@Module({
  imports: [
    VerificationModule,
    EmailModule,
    SmsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          // Fail fast: never sign tokens with a predictable fallback secret.
          throw new Error(
            'JWT_SECRET is not set. Refusing to start with an insecure default.',
          );
        }
        return {
          secret,
          signOptions: {
            expiresIn: (configService.get<string>('JWT_EXPIRATION') ||
              '7d') as any,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordRecoveryService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
