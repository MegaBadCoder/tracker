import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { TelegramAuthDto } from './dto/telegram-auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private debugLog(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
    fetch('http://127.0.0.1:7243/ingest/308101b5-8b60-49f8-bb00-4c26a74393b7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8d0dd9'},body:JSON.stringify({sessionId:'8d0dd9',runId:'pre-fix',hypothesisId,location,message,data,timestamp:Date.now()})}).catch(()=>{})
  }

  @Post('telegram')
  login(@Body() dto: TelegramAuthDto, @Req() req: Request): Promise<{ accessToken: string }> {
    // #region agent log
    this.debugLog('H11', 'src/modules/auth/auth.controller.ts:18', 'auth endpoint hit', {
      origin: req.headers.origin ?? null,
      referer: req.headers.referer ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      hasInitData: !!dto.initData,
      hasWidgetId: typeof dto.id === 'number',
      hasWidgetHash: !!dto.hash,
      hasDevTelegramId: typeof dto.devTelegramId === 'number',
    });
    // #endregion
    return this.authService.login(dto);
  }
}
