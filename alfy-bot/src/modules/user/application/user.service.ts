import { Injectable } from '@nestjs/common';
import { User } from '../../../shared/entities';
import { UserRepositoryPort } from '../domain/user-repository.port';

@Injectable()
export class UserService {
  constructor(private userRepo: UserRepositoryPort) {}

  async findById(id: number): Promise<User | null> {
    return this.userRepo.findOneById(id);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOneByEmail(email);
  }

  async createUser(data: Partial<User>): Promise<User> {
    return this.userRepo.create(data);
  }

  async save(user: User): Promise<User> {
    return this.userRepo.save(user);
  }

  async updateSettings(
    userId: number,
    settings: Partial<User['settings']>,
  ): Promise<void> {
    const user = await this.userRepo.findOneById(userId);
    if (user) {
      user.settings = { ...user.settings, ...settings };
      await this.userRepo.save(user);
    }
  }

  async updateEmail(userId: number, email: string): Promise<void> {
    const user = await this.userRepo.findOneById(userId);
    if (!user) return;
    user.email = email;
    await this.userRepo.save(user);
  }

  async updateTimezone(userId: number, timezone: string): Promise<string> {
    const user = await this.userRepo.findOneById(userId);
    if (!user) return 'UTC';
    user.timezone = timezone;
    await this.userRepo.save(user);
    return timezone;
  }
}
