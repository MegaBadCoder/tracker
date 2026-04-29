import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../shared/entities';
import { UserSettingsPort } from '../domain/user-settings.port';

@Injectable()
export class TypeOrmUserSettingsAdapter extends UserSettingsPort {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    super();
  }

  async getTimezone(userId: number): Promise<string> {
    const user = await this.userRepo.findOneBy({ id: userId });
    return user?.timezone ?? 'UTC';
  }

  async listAllUserIds(): Promise<number[]> {
    const users = await this.userRepo.find({ select: ['id'] });
    return users.map((u) => u.id);
  }
}
