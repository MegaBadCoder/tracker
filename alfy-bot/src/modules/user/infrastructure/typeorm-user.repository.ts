import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../shared/entities';
import { UserRepositoryPort } from '../domain/user-repository.port';

@Injectable()
export class TypeOrmUserRepository extends UserRepositoryPort {
  constructor(
    @InjectRepository(User)
    private repo: Repository<User>,
  ) {
    super();
  }

  async findOneByTelegramId(telegramId: number): Promise<User | null> {
    return this.repo.findOne({ where: { telegramId } });
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.repo.create({
      ...data,
      settings: { notifications: true, language: 'ru' },
    });
    return this.repo.save(user);
  }

  async save(user: User): Promise<User> {
    return this.repo.save(user);
  }
}
