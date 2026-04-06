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
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtPayload } from './strategies/jwt.strategy';
import { UserService } from '../user/application/user.service';

interface AuthRequest extends Request {
  user: JwtPayload;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Post('telegram')
  login(@Body() dto: TelegramAuthDto): Promise<{ accessToken: string }> {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req: AuthRequest) {
    const user = await this.userService.findById(req.user.sub);
    if (!user) return null;
    return {
      firstName: user.firstName,
      username: user.username,
      timezone: user.timezone ?? 'UTC',
    };
  }

  @Patch('timezone')
  @UseGuards(JwtAuthGuard)
  async updateTimezone(
    @Request() req: AuthRequest,
    @Body() body: { timezone: string },
  ) {
    const timezone = await this.userService.updateTimezone(
      req.user.sub,
      body.timezone,
    );
    return { timezone };
  }
}
