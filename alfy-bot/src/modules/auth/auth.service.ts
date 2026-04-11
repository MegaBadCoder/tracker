import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { TelegramAuthDto } from './dto/telegram-auth.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginEmailDto } from './dto/login-email.dto';
import { UserService } from '../user/application/user.service';
import { AuthMethodRepositoryPort } from './domain/auth-method-repository.port';

const AUTH_DATE_MAX_AGE_SEC = 86400; // 24h

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly authMethodRepo: AuthMethodRepositoryPort,
  ) {}

  // ──────────────────────────────────────────────
  // Email auth
  // ──────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<{ accessToken: string }> {
    const existing = await this.userService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.userService.createUser({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
    });

    await this.authMethodRepo.create({
      userId: user.id,
      provider: 'email',
      providerUserId: dto.email,
      passwordHash,
    });

    const accessToken = this.jwtService.sign({ sub: user.id });
    return { accessToken };
  }

  async loginWithEmail(
    dto: LoginEmailDto,
  ): Promise<{ accessToken: string }> {
    const method = await this.authMethodRepo.findByProvider(
      'email',
      dto.email,
    );
    if (!method || !method.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, method.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.jwtService.sign({ sub: method.userId });
    return { accessToken };
  }

  // ──────────────────────────────────────────────
  // Telegram auth
  // ──────────────────────────────────────────────

  validateInitData(initData: string): Record<string, string> {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash) {
      throw new UnauthorizedException('Missing hash in initData');
    }

    const dataCheckString = Array.from(params.entries())
      .filter(([key]) => key !== 'hash')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const botToken = this.configService.getOrThrow<string>('BOT_TOKEN');
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (expectedHash !== hash) {
      throw new UnauthorizedException('Invalid initData signature');
    }

    const authDate = params.get('auth_date');
    if (!authDate) {
      throw new UnauthorizedException('Missing auth_date in initData');
    }

    const age = Math.floor(Date.now() / 1000) - parseInt(authDate, 10);
    if (age > AUTH_DATE_MAX_AGE_SEC) {
      throw new UnauthorizedException('initData expired');
    }

    return Object.fromEntries(params.entries());
  }

  validateLoginWidget(
    dto: TelegramAuthDto,
  ): {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
  } {
    if (!dto.hash || !dto.auth_date || !dto.id) {
      throw new UnauthorizedException(
        'Missing required Login Widget fields',
      );
    }

    const age = Math.floor(Date.now() / 1000) - dto.auth_date;
    if (age > AUTH_DATE_MAX_AGE_SEC) {
      throw new UnauthorizedException('Login Widget data expired');
    }

    const fields: Record<string, string> = {};
    for (const key of [
      'id',
      'first_name',
      'last_name',
      'username',
      'photo_url',
      'auth_date',
    ] as const) {
      const value = dto[key];
      if (value !== undefined && value !== null) {
        fields[key] = String(value);
      }
    }

    const dataCheckString = Object.keys(fields)
      .sort()
      .map((key) => `${key}=${fields[key]}`)
      .join('\n');

    const botToken = this.configService.getOrThrow<string>('BOT_TOKEN');
    const secretKey = crypto
      .createHash('sha256')
      .update(botToken)
      .digest();

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (expectedHash !== dto.hash) {
      throw new UnauthorizedException('Invalid Login Widget signature');
    }

    return {
      id: dto.id,
      first_name: dto.first_name,
      last_name: dto.last_name,
      username: dto.username,
      photo_url: dto.photo_url,
    };
  }

  async login(dto: TelegramAuthDto): Promise<{ accessToken: string }> {
    // --- Dev flow ---
    if (dto.devTelegramId !== undefined) {
      if (this.configService.get<string>('NODE_ENV') !== 'development') {
        throw new BadRequestException(
          'Dev login is only available in development mode',
        );
      }
      const user = await this.findOrCreateTelegramUser(
        dto.devTelegramId,
        {},
      );
      const accessToken = this.jwtService.sign({ sub: user.id });
      return { accessToken };
    }

    // --- WebApp flow ---
    if (dto.initData) {
      const data = this.validateInitData(dto.initData);

      interface TelegramUser {
        id: number;
        username?: string;
        first_name?: string;
        last_name?: string;
        photo_url?: string;
      }

      const userRaw = JSON.parse(data.user) as TelegramUser;

      const user = await this.findOrCreateTelegramUser(userRaw.id, {
        username: userRaw.username,
        firstName: userRaw.first_name,
        lastName: userRaw.last_name,
        photoUrl: userRaw.photo_url,
      });

      const accessToken = this.jwtService.sign({ sub: user.id });
      return { accessToken };
    }

    // --- Login Widget flow ---
    if (dto.id && dto.hash) {
      const widgetUser = this.validateLoginWidget(dto);

      const user = await this.findOrCreateTelegramUser(widgetUser.id, {
        username: widgetUser.username,
        firstName: widgetUser.first_name,
        lastName: widgetUser.last_name,
        photoUrl: widgetUser.photo_url,
      });

      const accessToken = this.jwtService.sign({ sub: user.id });
      return { accessToken };
    }

    throw new BadRequestException(
      'Provide initData (WebApp) or Login Widget fields',
    );
  }

  // ──────────────────────────────────────────────
  // Profile (moved from controller per clean-arch)
  // ──────────────────────────────────────────────

  async getProfile(userId: number) {
    const user = await this.userService.findById(userId);
    if (!user) return null;
    return {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      photoUrl: user.photoUrl,
      phone: user.phone,
      username: user.username,
      timezone: user.timezone ?? 'UTC',
    };
  }

  async updateTimezone(
    userId: number,
    timezone: string,
  ): Promise<string> {
    return this.userService.updateTimezone(userId, timezone);
  }

  // ──────────────────────────────────────────────
  // Telegram user lookup via AuthMethod
  // ──────────────────────────────────────────────

  async getTelegramId(userId: number): Promise<number | null> {
    const method = await this.authMethodRepo.findByUserIdAndProvider(
      userId,
      'telegram',
    );
    if (!method?.providerUserId) return null;
    return parseInt(method.providerUserId, 10);
  }

  async findOrCreateTelegramUser(
    telegramId: number,
    profile: {
      username?: string;
      firstName?: string;
      lastName?: string;
      photoUrl?: string;
    },
  ) {
    const providerUserId = String(telegramId);

    const existing = await this.authMethodRepo.findByProvider(
      'telegram',
      providerUserId,
    );

    if (existing) {
      const user = await this.userService.findById(existing.userId);
      if (user) {
        let updated = false;
        if (profile.firstName && !user.firstName) {
          user.firstName = profile.firstName;
          updated = true;
        }
        if (profile.lastName && !user.lastName) {
          user.lastName = profile.lastName;
          updated = true;
        }
        if (profile.photoUrl && !user.photoUrl) {
          user.photoUrl = profile.photoUrl;
          updated = true;
        }
        if (profile.username && user.username !== profile.username) {
          user.username = profile.username;
          updated = true;
        }
        if (updated) {
          await this.userService.save(user);
        }
        return user;
      }
    }

    const user = await this.userService.createUser({
      username: profile.username,
      firstName: profile.firstName,
      lastName: profile.lastName,
      photoUrl: profile.photoUrl,
    });

    await this.authMethodRepo.create({
      userId: user.id,
      provider: 'telegram',
      providerUserId,
    });

    return user;
  }
}
