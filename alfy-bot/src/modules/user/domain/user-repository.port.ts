import { User } from '../../../shared/entities';

export abstract class UserRepositoryPort {
  abstract findOneById(id: number): Promise<User | null>;
  abstract findOneByTelegramId(telegramId: number): Promise<User | null>;
  abstract create(data: Partial<User>): Promise<User>;
  abstract save(user: User): Promise<User>;
}
