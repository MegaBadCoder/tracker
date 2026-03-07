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
  private debugLog(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
    fetch('http://127.0.0.1:7243/ingest/308101b5-8b60-49f8-bb00-4c26a74393b7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8d0dd9'},body:JSON.stringify({sessionId:'8d0dd9',runId:'pre-fix',hypothesisId,location,message,data,timestamp:Date.now()})}).catch(()=>{})
  }

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

    // Build data-check-string: sorted key=value pairs excluding hash
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

    // Build data-check-string: sorted key=value pairs excluding hash
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
    try {
    // #region agent log
    this.debugLog('H6', 'src/modules/auth/auth.service.ts:121', 'auth login called', {
      hasInitData: !!dto.initData,
      hasWidgetId: typeof dto.id === 'number',
      hasWidgetHash: !!dto.hash,
      hasDevTelegramId: typeof dto.devTelegramId === 'number',
      nodeEnv: this.configService.get<string>('NODE_ENV') ?? 'unknown',
    });
    // #endregion

    // --- Dev flow ---
    if (dto.devTelegramId !== undefined) {
      // #region agent log
      this.debugLog('H6', 'src/modules/auth/auth.service.ts:132', 'auth login selected dev flow', {});
      // #endregion
      if (this.configService.get<string>('NODE_ENV') !== 'development') {
        throw new ForbiddenException('Dev login is only available in development mode');
      }
      const user = await this.userService.findOrCreate(dto.devTelegramId, {});
      const accessToken = this.jwtService.sign({ telegramId: user.telegramId, sub: user.id });
      return { accessToken };
    }

    // --- WebApp flow ---
    if (dto.initData) {
      // #region agent log
      this.debugLog('H7', 'src/modules/auth/auth.service.ts:143', 'auth login selected webapp flow', {
        initDataLength: dto.initData.length,
      });
      // #endregion
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
      // #region agent log
      this.debugLog('H7', 'src/modules/auth/auth.service.ts:164', 'auth webapp flow success', {
        telegramId,
      });
      // #endregion
      return { accessToken };
    }

    // --- Login Widget flow ---
    if (dto.id && dto.hash) {
      // #region agent log
      this.debugLog('H8', 'src/modules/auth/auth.service.ts:172', 'auth login selected widget flow', {
        telegramId: dto.id,
      });
      // #endregion
      const widgetUser = this.validateLoginWidget(dto);

      const user = await this.userService.findOrCreate(widgetUser.id, {
        username: widgetUser.username,
        firstName: widgetUser.first_name,
      });

      const payload = { telegramId: user.telegramId, sub: user.id };
      const accessToken = this.jwtService.sign(payload);
      // #region agent log
      this.debugLog('H8', 'src/modules/auth/auth.service.ts:184', 'auth widget flow success', {
        telegramId: widgetUser.id,
      });
      // #endregion
      return { accessToken };
    }

    // #region agent log
    this.debugLog('H6', 'src/modules/auth/auth.service.ts:191', 'auth login rejected bad payload', {});
    // #endregion
    throw new BadRequestException('Provide initData (WebApp) or Login Widget fields');
    } catch (error) {
      const err = error as { name?: string; message?: string; status?: number };
      // #region agent log
      this.debugLog('H9', 'src/modules/auth/auth.service.ts:196', 'auth login threw error', {
        name: err?.name ?? 'unknown',
        message: err?.message ?? 'unknown',
        status: typeof err?.status === 'number' ? err.status : null,
      });
      // #endregion
      throw error;
    }
  }
}
