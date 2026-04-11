import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthMethod } from '../../../shared/entities';
import { AuthMethodRepositoryPort } from '../domain/auth-method-repository.port';

@Injectable()
export class TypeOrmAuthMethodRepository extends AuthMethodRepositoryPort {
  constructor(
    @InjectRepository(AuthMethod)
    private repo: Repository<AuthMethod>,
  ) {
    super();
  }

  async findByProvider(
    provider: string,
    providerUserId: string,
  ): Promise<AuthMethod | null> {
    return this.repo.findOne({ where: { provider, providerUserId } });
  }

  async findByUserIdAndProvider(
    userId: number,
    provider: string,
  ): Promise<AuthMethod | null> {
    return this.repo.findOne({ where: { userId, provider } });
  }

  async create(data: Partial<AuthMethod>): Promise<AuthMethod> {
    const method = this.repo.create(data);
    return this.repo.save(method);
  }

  async save(method: AuthMethod): Promise<AuthMethod> {
    return this.repo.save(method);
  }
}
