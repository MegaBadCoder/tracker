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
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendCodeDto } from './dto/resend-code.dto';
import { LinkEmailDto } from './dto/link-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
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
  ): Promise<{ message: string; email: string }> {
    return this.authService.register(dto);
  }

  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ accessToken: string }> {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-code')
  resendCode(@Body() dto: ResendCodeDto): Promise<{ message: string }> {
    return this.authService.resendCode(dto);
  }

  @Post('login')
  loginEmail(@Body() dto: LoginEmailDto): Promise<{ accessToken: string }> {
    return this.authService.loginWithEmail(dto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ accessToken: string }> {
    return this.authService.resetPassword(dto);
  }

  @Post('link-email')
  @UseGuards(JwtAuthGuard)
  linkEmail(
    @Request() req: AuthRequest,
    @Body() dto: LinkEmailDto,
  ): Promise<{ message: string; email: string }> {
    return this.authService.linkEmail(req.user.sub, dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @Request() req: AuthRequest,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.changePassword(req.user.sub, dto);
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
