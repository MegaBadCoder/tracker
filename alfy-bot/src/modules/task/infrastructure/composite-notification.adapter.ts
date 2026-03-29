import { Injectable } from '@nestjs/common';
import { NotificationPort } from '../domain/notification.port';
import { TelegramNotificationAdapter } from './telegram-notification.adapter';
import { WebPushNotificationAdapter } from '../../notification/web-push-notification.adapter';

@Injectable()
export class CompositeNotificationAdapter extends NotificationPort {
  constructor(
    private readonly telegram: TelegramNotificationAdapter,
    private readonly webPush: WebPushNotificationAdapter,
  ) {
    super();
  }

  async send(userId: number, message: string): Promise<void> {
    await Promise.allSettled([
      this.telegram.send(userId, message),
      this.webPush.send(userId, message),
    ]);
  }
}
