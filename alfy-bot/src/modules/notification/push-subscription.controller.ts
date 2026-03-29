import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PushSubscriptionService } from './push-subscription.service';
import { SubscribePushDto } from './dto/subscribe-push.dto';

@ApiTags('Push')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushSubscriptionController {
  constructor(
    private readonly pushService: PushSubscriptionService,
    private readonly config: ConfigService,
  ) {}

  @Post('subscribe')
  async subscribe(
    @Req() req: { user: JwtPayload },
    @Body() dto: SubscribePushDto,
  ) {
    return this.pushService.subscribe(req.user.sub, dto);
  }

  @Delete('subscribe')
  async unsubscribe(@Body() body: { endpoint: string }) {
    await this.pushService.unsubscribe(body.endpoint);
  }

  @Get('vapid-key')
  getVapidKey() {
    return { key: this.config.get<string>('VAPID_PUBLIC_KEY') };
  }
}
