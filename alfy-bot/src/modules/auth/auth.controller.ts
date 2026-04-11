import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { TelegramAuthDto } from './dto/telegram-auth.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginEmailDto } from './dto/login-email.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtPayload } from './strategies/jwt.strategy';

interface AuthRequest extends Request {
  user: JwtPayload;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('telegram')
  loginTelegram(
    @Body() dto: TelegramAuthDto,
  ): Promise<{ accessToken: string }> {
    return this.authService.login(dto);
  }

  @Post('register')
  register(
    @Body() dto: RegisterDto,
  ): Promise<{ accessToken: string }> {
    return this.authService.register(dto);
  }

  @Post('login')
  loginEmail(
    @Body() dto: LoginEmailDto,
  ): Promise<{ accessToken: string }> {
    return this.authService.loginWithEmail(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req: AuthRequest) {
    return this.authService.getProfile(req.user.sub);
  }

  @Patch('timezone')
  @UseGuards(JwtAuthGuard)
  async updateTimezone(
    @Request() req: AuthRequest,
    @Body() body: { timezone: string },
  ) {
    const timezone = await this.authService.updateTimezone(
      req.user.sub,
      body.timezone,
    );
    return { timezone };
  }
}
