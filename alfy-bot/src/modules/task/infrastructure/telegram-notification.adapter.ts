import { Injectable, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { TelegramUserLookupPort } from '../domain/telegram-user-lookup.port';
import { NotificationPort } from '../domain/notification.port';

@Injectable()
export class TelegramNotificationAdapter extends NotificationPort {
  private readonly logger = new Logger(TelegramNotificationAdapter.name);

  constructor(
    private readonly telegramLookup: TelegramUserLookupPort,
    @InjectBot() private readonly bot: Telegraf,
  ) {
    super();
  }

  async send(userId: number, message: string): Promise<void> {
    const telegramId = await this.telegramLookup.getTelegramChatId(userId);
    if (!telegramId) {
      this.logger.warn(`User ${userId} has no telegramId`);
      return;
    }
    try {
      await this.bot.telegram.sendMessage(telegramId, message);
    } catch (err) {
      this.logger.error(
        `Failed to send notification to telegramId=${telegramId}`,
        err,
      );
    }
  }
}
