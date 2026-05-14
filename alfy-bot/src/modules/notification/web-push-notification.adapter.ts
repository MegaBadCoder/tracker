import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webPush from 'web-push';
import { NotificationPort } from '../task/domain/notification.port';
import { PushSubscriptionService } from './push-subscription.service';

@Injectable()
export class WebPushNotificationAdapter
  extends NotificationPort
  implements OnModuleInit
{
  private readonly logger = new Logger(WebPushNotificationAdapter.name);

  constructor(
    private readonly config: ConfigService,
    private readonly pushSubscriptionService: PushSubscriptionService,
  ) {
    super();
  }

  onModuleInit(): void {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>(
      'VAPID_SUBJECT',
      'mailto:admin@example.com',
    );

    if (publicKey && privateKey) {
      webPush.setVapidDetails(subject, publicKey, privateKey);
    } else {
      this.logger.warn('VAPID keys not configured — Web Push disabled');
    }
  }

  async send(userId: number, message: string): Promise<void> {
    const subscriptions =
      await this.pushSubscriptionService.findByUserId(userId);

    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({ title: 'Alfy', body: message });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
          );
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            this.logger.log(
              `Removing stale subscription: ${sub.endpoint.slice(0, 60)}…`,
            );
            await this.pushSubscriptionService.removeByEndpoint(sub.endpoint);
          } else {
            this.logger.error(
              `Failed to send push to endpoint=${sub.endpoint.slice(0, 60)}…`,
              err,
            );
          }
        }
      }),
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      this.logger.warn(
        `${failed.length}/${subscriptions.length} push notifications failed for userId=${userId}`,
      );
    }
  }
}
