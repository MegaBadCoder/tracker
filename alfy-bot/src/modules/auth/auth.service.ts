import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { TelegramAuthDto } from './dto/telegram-auth.dto';
import { UserService } from '../user/application/user.service';

const AUTH_DATE_MAX_AGE_SEC = 86400; // 24h

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  /**
   * Validates Telegram WebApp initData string.
   * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
   */
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

  /**
   * Validates Telegram Login Widget data.
   * https://core.telegram.org/widgets/login#checking-authorization
   */
  validateLoginWidget(dto: TelegramAuthDto): { id: number; first_name?: string; username?: string } {
    if (!dto.hash || !dto.auth_date || !dto.id) {
      throw new UnauthorizedException('Missing required Login Widget fields');
    }

    const age = Math.floor(Date.now() / 1000) - dto.auth_date;
    if (age > AUTH_DATE_MAX_AGE_SEC) {
      throw new UnauthorizedException('Login Widget data expired');
    }

    const fields: Record<string, string> = {};
    for (const key of ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date'] as const) {
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
    const secretKey = crypto.createHash('sha256').update(botToken).digest();

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (expectedHash !== dto.hash) {
      throw new UnauthorizedException('Invalid Login Widget signature');
    }

    return { id: dto.id, first_name: dto.first_name, username: dto.username };
  }

  async login(dto: TelegramAuthDto): Promise<{ accessToken: string }> {
    // --- Dev flow ---
    if (dto.devTelegramId !== undefined) {
      if (this.configService.get<string>('NODE_ENV') !== 'development') {
        throw new ForbiddenException('Dev login is only available in development mode');
      }
      const user = await this.userService.findOrCreate(dto.devTelegramId, {});
      const accessToken = this.jwtService.sign({ telegramId: user.telegramId, sub: user.id });
      return { accessToken };
    }

    // --- WebApp flow ---
    if (dto.initData) {
      const data = this.validateInitData(dto.initData);

      interface TelegramUser {
        id: number;
        username?: string;
        first_name?: string;
      }

      const userRaw = JSON.parse(data.user) as TelegramUser;
      const telegramId = userRaw.id;

      const user = await this.userService.findOrCreate(telegramId, {
        username: userRaw.username,
        firstName: userRaw.first_name,
      });

      const payload = { telegramId: user.telegramId, sub: user.id };
      const accessToken = this.jwtService.sign(payload);
      return { accessToken };
    }

    // --- Login Widget flow ---
    if (dto.id && dto.hash) {
      const widgetUser = this.validateLoginWidget(dto);

      const user = await this.userService.findOrCreate(widgetUser.id, {
        username: widgetUser.username,
        firstName: widgetUser.first_name,
      });

      const payload = { telegramId: user.telegramId, sub: user.id };
      const accessToken = this.jwtService.sign(payload);
      return { accessToken };
    }

    throw new BadRequestException('Provide initData (WebApp) or Login Widget fields');
  }
}
