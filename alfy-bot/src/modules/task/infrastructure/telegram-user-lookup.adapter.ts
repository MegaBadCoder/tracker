import { Injectable } from '@nestjs/common';
import { AuthMethodRepositoryPort } from '../../auth/domain/auth-method-repository.port';
import { TelegramUserLookupPort } from '../domain/telegram-user-lookup.port';

@Injectable()
export class TelegramUserLookupAdapter extends TelegramUserLookupPort {
  constructor(private readonly authMethodRepo: AuthMethodRepositoryPort) {
    super();
  }

  async getTelegramChatId(userId: number): Promise<number | null> {
    const method = await this.authMethodRepo.findByUserIdAndProvider(
      userId,
      'telegram',
    );
    if (!method?.providerUserId) return null;
    return parseInt(method.providerUserId, 10);
  }
}
