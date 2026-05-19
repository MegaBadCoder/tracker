import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiTokenAuthGuard } from './guards/api-token-auth.guard';
import { JwtOrApiTokenGuard } from './guards/jwt-or-api-token.guard';
import { ApiTokenService } from './application/api-token.service';
import { AuthMethodRepositoryPort } from './domain/auth-method-repository.port';
import { EmailNotificationPort } from './domain/email-notification.port';
import { TokenIssuerPort } from './domain/token-issuer.port';
import { TypeOrmAuthMethodRepository } from './infrastructure/typeorm-auth-method.repository';
import { JwtTokenIssuer } from './infrastructure/jwt-token-issuer';
import { AuthMethod, ApiToken } from '../../shared/entities';
import { UserModule } from '../user/user.module';
import { EmailModule } from '../email/email.module';
import { EmailService } from '../email/email.service';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    TypeOrmModule.forFeature([AuthMethod, ApiToken]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '30d' },
      }),
    }),
    UserModule,
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    ApiTokenService,
    ApiTokenAuthGuard,
    JwtOrApiTokenGuard,
    {
      provide: AuthMethodRepositoryPort,
      useClass: TypeOrmAuthMethodRepository,
    },
    {
      provide: EmailNotificationPort,
      useClass: EmailService,
    },
    {
      provide: TokenIssuerPort,
      useClass: JwtTokenIssuer,
    },
  ],
  exports: [
    JwtAuthGuard,
    ApiTokenService,
    ApiTokenAuthGuard,
    JwtOrApiTokenGuard,
    AuthService,
    AuthMethodRepositoryPort,
  ],
})
export class AuthModule {}
