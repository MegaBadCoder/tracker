import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  private debugLog(
    hypothesisId: string,
    location: string,
    message: string,
    data: Record<string, unknown>,
  ) {
    fetch('http://127.0.0.1:7243/ingest/308101b5-8b60-49f8-bb00-4c26a74393b7', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '8d0dd9',
      },
      body: JSON.stringify({
        sessionId: '8d0dd9',
        runId: 'pre-fix',
        hypothesisId,
        location,
        message,
        data,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }

  @Get()
  getHello(@Req() req: Request): string {
    // #region agent log
    this.debugLog('H12', 'src/app.controller.ts:14', 'backend root ping hit', {
      origin: req.headers.origin ?? null,
      referer: req.headers.referer ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    // #endregion
    return this.appService.getHello();
  }
}
