import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushSubscription } from '../../shared/entities/push-subscription.entity';
import { AuthModule } from '../auth/auth.module';
import { PushSubscriptionService } from './push-subscription.service';
import { PushSubscriptionController } from './push-subscription.controller';
import { WebPushNotificationAdapter } from './web-push-notification.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([PushSubscription]),
    ConfigModule,
    AuthModule,
  ],
  controllers: [PushSubscriptionController],
  providers: [PushSubscriptionService, WebPushNotificationAdapter],
  exports: [WebPushNotificationAdapter],
})
export class NotificationModule {}
