import { AuthMethod } from '../../../shared/entities';

export abstract class AuthMethodRepositoryPort {
  abstract findByProvider(
    provider: string,
    providerUserId: string,
  ): Promise<AuthMethod | null>;
  abstract findByUserIdAndProvider(
    userId: number,
    provider: string,
  ): Promise<AuthMethod | null>;
  abstract create(data: Partial<AuthMethod>): Promise<AuthMethod>;
  abstract save(method: AuthMethod): Promise<AuthMethod>;
}
