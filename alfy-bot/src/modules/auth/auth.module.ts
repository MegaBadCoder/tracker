import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthMethodRepositoryPort } from './domain/auth-method-repository.port';
import { EmailNotificationPort } from './domain/email-notification.port';
import { TokenIssuerPort } from './domain/token-issuer.port';
import { TypeOrmAuthMethodRepository } from './infrastructure/typeorm-auth-method.repository';
import { JwtTokenIssuer } from './infrastructure/jwt-token-issuer';
import { AuthMethod } from '../../shared/entities';
import { UserModule } from '../user/user.module';
import { EmailModule } from '../email/email.module';
import { EmailService } from '../email/email.service';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    TypeOrmModule.forFeature([AuthMethod]),
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
  exports: [JwtAuthGuard, AuthService, AuthMethodRepositoryPort],
})
export class AuthModule {}
