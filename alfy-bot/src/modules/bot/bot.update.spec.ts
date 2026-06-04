/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BotUpdate } from './bot.update';
import { ApiTokenService } from '../auth/application/api-token.service';
import { AuthService } from '../auth/auth.service';

// Minimal mock for InjectBot
const mockBot = { telegram: { setChatMenuButton: jest.fn() } };

const mockAuthService = {
  findOrCreateTelegramUser: jest.fn(),
};

const mockApiTokenService = {
  generate: jest.fn(),
  list: jest.fn(),
  revoke: jest.fn(),
};

function makeCtx(text: string) {
  return {
    from: { id: 12345 },
    message: { text },
    reply: jest.fn<Promise<void>, [string, unknown?]>(),
  };
}

describe('BotUpdate — MCP token commands', () => {
  let update: BotUpdate;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockAuthService.findOrCreateTelegramUser.mockResolvedValue({
      id: 1,
      firstName: 'Alice',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotUpdate,
        { provide: AuthService, useValue: mockAuthService },
        { provide: ApiTokenService, useValue: mockApiTokenService },
        { provide: 'DEFAULT_BOT_NAME', useValue: mockBot }, // nestjs-telegraf InjectBot token
      ],
    }).compile();

    update = module.get<BotUpdate>(BotUpdate);
  });

  // ── issueToken ──────────────────────────────────────────────────────────────

  describe('issueToken', () => {
    it('parses name, calls findOrCreate + generate, replies with plaintext and id', async () => {
      mockApiTokenService.generate.mockResolvedValue({
        id: 42,
        plaintext: 'abcdef0123456789abcdef0123456789abcdef0123456789',
      });

      const ctx = makeCtx('/mcp_token claude-desktop');
      await update.issueToken(ctx as any);

      expect(mockAuthService.findOrCreateTelegramUser).toHaveBeenCalledWith(
        12345,
        {},
      );
      expect(mockApiTokenService.generate).toHaveBeenCalledWith(
        1,
        'claude-desktop',
      );

      expect(ctx.reply).toHaveBeenCalledTimes(1);
      const replyText = ctx.reply.mock.calls[0][0];
      expect(replyText).toContain(
        'abcdef0123456789abcdef0123456789abcdef0123456789',
      );
      expect(replyText).toContain('42');
    });

    it('missing name → replies with usage hint, does not call generate', async () => {
      const ctx = makeCtx('/mcp_token');
      await update.issueToken(ctx as any);

      expect(mockApiTokenService.generate).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledTimes(1);
      const replyText = ctx.reply.mock.calls[0][0];
      // Should contain usage hint mentioning the command
      expect(replyText.toLowerCase()).toMatch(/mcp_token/);
    });
  });

  // ── listTokens ──────────────────────────────────────────────────────────────

  describe('listTokens', () => {
    it('empty list → replies with empty-state hint', async () => {
      mockApiTokenService.list.mockResolvedValue([]);

      const ctx = makeCtx('/mcp_tokens');
      await update.listTokens(ctx as any);

      expect(mockApiTokenService.list).toHaveBeenCalledWith(1);
      expect(ctx.reply).toHaveBeenCalledTimes(1);
      const replyText = ctx.reply.mock.calls[0][0];
      expect(replyText.toLowerCase()).toMatch(/нет активных токенов/);
    });

    it('populated list → formats each token without exposing hash', async () => {
      const now = new Date('2025-01-01T12:00:00Z');
      mockApiTokenService.list.mockResolvedValue([
        {
          id: 7,
          name: 'cursor',
          prefix: 'abcd012345',
          last_used_at: now,
          created_at: now,
        },
        {
          id: 8,
          name: 'claude',
          prefix: 'ef6789abcd',
          last_used_at: null,
          created_at: now,
        },
      ]);

      const ctx = makeCtx('/mcp_tokens');
      await update.listTokens(ctx as any);

      expect(ctx.reply).toHaveBeenCalledTimes(1);
      const replyText = ctx.reply.mock.calls[0][0];

      // Contains ids and names
      expect(replyText).toContain('7');
      expect(replyText).toContain('cursor');
      expect(replyText).toContain('8');
      expect(replyText).toContain('claude');

      // Contains prefixes
      expect(replyText).toContain('abcd012345');
      expect(replyText).toContain('ef6789abcd');

      // Does NOT contain token_hash (no bcrypt hash should appear)
      expect(replyText).not.toMatch(/\$2[aby]\$/);

      // "never" for null last_used
      expect(replyText.toLowerCase()).toMatch(/never|никогда/);
    });
  });

  // ── revokeToken ──────────────────────────────────────────────────────────────

  describe('revokeToken', () => {
    it('parses numeric id, calls revoke, replies success', async () => {
      mockApiTokenService.revoke.mockResolvedValue(undefined);

      const ctx = makeCtx('/mcp_token_revoke 42');
      await update.revokeToken(ctx as any);

      expect(mockApiTokenService.revoke).toHaveBeenCalledWith(42, 1);
      expect(ctx.reply).toHaveBeenCalledTimes(1);
      const replyText = ctx.reply.mock.calls[0][0];
      expect(replyText).toContain('42');
    });

    it('NotFoundException → user-facing 404 message, no crash', async () => {
      mockApiTokenService.revoke.mockRejectedValue(
        new NotFoundException('ApiToken #42 not found'),
      );

      const ctx = makeCtx('/mcp_token_revoke 42');
      await update.revokeToken(ctx as any);

      expect(ctx.reply).toHaveBeenCalledTimes(1);
      const replyText = ctx.reply.mock.calls[0][0];
      expect(replyText.toLowerCase()).toMatch(/не найден|not found/);
    });

    it('invalid id (non-number) → usage hint, does not call revoke', async () => {
      const ctx = makeCtx('/mcp_token_revoke abc');
      await update.revokeToken(ctx as any);

      expect(mockApiTokenService.revoke).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledTimes(1);
      const replyText = ctx.reply.mock.calls[0][0];
      expect(replyText.toLowerCase()).toMatch(/mcp_token_revoke/);
    });
  });
});
