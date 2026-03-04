import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TelegramAuthDto } from './dto/telegram-auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('telegram')
  login(@Body() dto: TelegramAuthDto): Promise<{ accessToken: string }> {
    return this.authService.login(dto);
  }
}
