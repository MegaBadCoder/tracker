import { Injectable } from '@nestjs/common';
import { User } from '../../../shared/entities';
import { UserRepositoryPort } from '../domain/user-repository.port';

@Injectable()
export class UserService {
  constructor(private userRepo: UserRepositoryPort) {}

  async findOrCreate(
    telegramId: number,
    userData: Partial<User>,
  ): Promise<User> {
    let user = await this.userRepo.findOneByTelegramId(telegramId);

    if (!user) {
      user = await this.userRepo.create({ telegramId, ...userData });
    }

    return user;
  }

  async updateSettings(
    telegramId: number,
    settings: Partial<User['settings']>,
  ): Promise<void> {
    const user = await this.userRepo.findOneByTelegramId(telegramId);
    if (user) {
      user.settings = { ...user.settings, ...settings };
      await this.userRepo.save(user);
    }
  }
}
