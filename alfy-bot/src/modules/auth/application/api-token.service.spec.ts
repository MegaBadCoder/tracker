import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ApiToken } from '../../../shared/entities/api-token.entity';
import { ApiTokenService } from './api-token.service';

function makeRepo() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };
}

describe('ApiTokenService', () => {
  let service: ApiTokenService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    repo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiTokenService,
        { provide: getRepositoryToken(ApiToken), useValue: repo },
      ],
    }).compile();

    service = module.get(ApiTokenService);
  });

  describe('generate', () => {
    it('returns 48-char hex plaintext', async () => {
      repo.create.mockReturnValue({});
      repo.save.mockResolvedValue({ id: 1 });

      const { plaintext } = await service.generate(42, 'test token');

      expect(plaintext).toHaveLength(48);
      expect(/^[0-9a-f]+$/.test(plaintext)).toBe(true);
    });

    it('stores bcrypt-verifiable hash and correct prefix', async () => {
      let savedRow: Partial<ApiToken> | undefined;
      repo.create.mockImplementation((data: Partial<ApiToken>) => data);
      repo.save.mockImplementation((row: Partial<ApiToken>) => {
        savedRow = row;
        return Promise.resolve({ ...row, id: 1 });
      });

      const { plaintext } = await service.generate(42, 'my token');
      const prefix = plaintext.slice(0, 10);

      expect(savedRow!.prefix).toBe(prefix);
      expect(savedRow!.name).toBe('my token');
      expect(savedRow!.user_id).toBe(42);
      const hashOk = await bcrypt.compare(plaintext, savedRow!.token_hash!);
      expect(hashOk).toBe(true);
    });

    it('returns id from saved row', async () => {
      repo.create.mockImplementation((d: Partial<ApiToken>) => d);
      repo.save.mockResolvedValue({ id: 99 });

      const { id } = await service.generate(1, 'x');
      expect(id).toBe(99);
    });
  });

  describe('verify', () => {
    it('returns user_id and updates last_used_at for valid token', async () => {
      const plaintext = 'a'.repeat(48);
      const hash = await bcrypt.hash(plaintext, 10);
      repo.findOne.mockResolvedValue({ id: 7, user_id: 42, token_hash: hash });
      repo.update.mockResolvedValue({ affected: 1 });

      const result = await service.verify(plaintext);

      expect(result).toBe(42);
      expect(repo.update).toHaveBeenCalledWith(
        7,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        expect.objectContaining({ last_used_at: expect.any(Date) }),
      );
    });

    it('returns null for token shorter than 48 chars', async () => {
      const result = await service.verify('short');
      expect(result).toBeNull();
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('returns null when no row found for prefix', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.verify('a'.repeat(48));
      expect(result).toBeNull();
    });

    it('returns null when bcrypt compare fails (same prefix, different suffix)', async () => {
      const correctPlaintext = 'a'.repeat(48);
      const wrongPlaintext = 'a'.repeat(10) + 'b'.repeat(38);
      const hash = await bcrypt.hash(correctPlaintext, 10);
      repo.findOne.mockResolvedValue({ id: 7, user_id: 42, token_hash: hash });

      const result = await service.verify(wrongPlaintext);
      expect(result).toBeNull();
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('returns null for revoked token (findOne returns null because of IsNull filter)', async () => {
      // Simulate revoked: repo returns null when revoked_at is not IsNull
      repo.findOne.mockResolvedValue(null);
      const result = await service.verify('a'.repeat(48));
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('returns entries without token_hash', async () => {
      repo.find.mockResolvedValue([
        {
          id: 1,
          name: 'tok1',
          prefix: 'abcde12345',
          last_used_at: null,
          created_at: new Date('2026-01-01'),
          token_hash: 'SECRET',
          user_id: 42,
        },
        {
          id: 2,
          name: 'tok2',
          prefix: 'xyz0000000',
          last_used_at: new Date('2026-01-02'),
          created_at: new Date('2025-12-01'),
          token_hash: 'SECRET2',
          user_id: 42,
        },
      ]);

      const result = await service.list(42);

      expect(result).toHaveLength(2);
      for (const entry of result) {
        expect(entry).not.toHaveProperty('token_hash');
      }
      expect(result[0]).toMatchObject({
        id: 1,
        name: 'tok1',
        prefix: 'abcde12345',
      });
    });

    it('queries only active (non-revoked) tokens for user', async () => {
      repo.find.mockResolvedValue([]);

      await service.list(42);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const findCall = expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({ user_id: 42 }),
      });
      expect(repo.find).toHaveBeenCalledWith(findCall);
    });
  });

  describe('revoke', () => {
    it('sets revoked_at for owned token', async () => {
      repo.update.mockResolvedValue({ affected: 1 });

      await expect(service.revoke(3, 42)).resolves.toBeUndefined();

      expect(repo.update).toHaveBeenCalledWith(
        { id: 3, user_id: 42, revoked_at: IsNull() },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        expect.objectContaining({ revoked_at: expect.any(Date) }),
      );
    });

    it('throws NotFoundException when 0 rows affected', async () => {
      repo.update.mockResolvedValue({ affected: 0 });

      await expect(service.revoke(99, 42)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
