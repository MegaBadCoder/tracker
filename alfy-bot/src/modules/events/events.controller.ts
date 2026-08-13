import { Controller, Request, Sse, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable, interval, map, merge } from 'rxjs';
import { JwtOrApiTokenGuard } from '../auth/guards/jwt-or-api-token.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { UserEvent, UserEventsPort } from './domain/user-events.port';

interface AuthRequest extends Request {
  user: JwtPayload;
}

const PING_INTERVAL_MS = 25_000;

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtOrApiTokenGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly events: UserEventsPort) {}

  @Sse()
  @ApiOperation({ summary: 'SSE-поток событий текущего пользователя' })
  stream(@Request() req: AuthRequest): Observable<UserEvent> {
    return merge(
      this.events.subscribe(req.user.sub),
      interval(PING_INTERVAL_MS).pipe(map(() => ({ type: 'ping', data: {} }))),
    );
  }
}
