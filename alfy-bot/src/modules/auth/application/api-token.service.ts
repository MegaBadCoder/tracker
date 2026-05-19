import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { ApiToken } from '../../../shared/entities/api-token.entity';

@Injectable()
export class ApiTokenService {
  constructor(
    @InjectRepository(ApiToken)
    private readonly repo: Repository<ApiToken>,
  ) {}

  async generate(
    userId: number,
    name: string,
  ): Promise<{ id: number; plaintext: string }> {
    const plaintext = randomBytes(24).toString('hex'); // 48 hex chars
    const prefix = plaintext.slice(0, 10);
    const token_hash = await bcrypt.hash(plaintext, 10);

    const row = this.repo.create({
      user_id: userId,
      name,
      prefix,
      token_hash,
      last_used_at: null,
      revoked_at: null,
    });

    const saved = await this.repo.save(row);
    return { id: saved.id, plaintext };
  }

  async verify(plaintext: string): Promise<number | null> {
    if (plaintext.length < 48) return null;

    const prefix = plaintext.slice(0, 10);
    const row = await this.repo.findOne({
      where: { prefix, revoked_at: IsNull() },
    });

    if (!row) return null;

    const ok = await bcrypt.compare(plaintext, row.token_hash);
    if (!ok) return null;

    await this.repo.update(row.id, { last_used_at: new Date() });
    return row.user_id;
  }

  async list(userId: number): Promise<
    Array<{
      id: number;
      name: string;
      prefix: string;
      last_used_at: Date | null;
      created_at: Date;
    }>
  > {
    const rows = await this.repo.find({
      where: { user_id: userId, revoked_at: IsNull() },
      order: { created_at: 'DESC' },
    });

    return rows.map(({ id, name, prefix, last_used_at, created_at }) => ({
      id,
      name,
      prefix,
      last_used_at,
      created_at,
    }));
  }

  async revoke(id: number, userId: number): Promise<void> {
    const result = await this.repo.update(
      { id, user_id: userId, revoked_at: IsNull() },
      { revoked_at: new Date() },
    );

    if (!result.affected || result.affected === 0) {
      throw new NotFoundException(`ApiToken #${id} not found`);
    }
  }
}
