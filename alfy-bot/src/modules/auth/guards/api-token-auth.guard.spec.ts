import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiTokenAuthGuard } from './api-token-auth.guard';
import { ApiTokenService } from '../application/api-token.service';

function makeExecutionContext(authHeader?: string) {
  const req: Record<string, unknown> = {};
  if (authHeader !== undefined) {
    req['headers'] = { authorization: authHeader };
  } else {
    req['headers'] = {};
  }

  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    _req: req,
  };
}

describe('ApiTokenAuthGuard', () => {
  let guard: ApiTokenAuthGuard;
  let apiTokenService: { verify: jest.Mock };

  beforeEach(async () => {
    apiTokenService = { verify: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiTokenAuthGuard,
        { provide: ApiTokenService, useValue: apiTokenService },
      ],
    }).compile();

    guard = module.get(ApiTokenAuthGuard);
  });

  it('valid token → sets req.user = { sub: userId } and returns true', async () => {
    apiTokenService.verify.mockResolvedValue(42);
    const ctx = makeExecutionContext('Bearer ' + 'a'.repeat(48));

    const result = await guard.canActivate(ctx as never);

    expect(result).toBe(true);
    expect(ctx._req['user']).toEqual({ sub: 42 });
    expect(apiTokenService.verify).toHaveBeenCalledWith('a'.repeat(48));
  });

  it('invalid token → throws UnauthorizedException', async () => {
    apiTokenService.verify.mockResolvedValue(null);
    const ctx = makeExecutionContext('Bearer ' + 'a'.repeat(48));

    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('missing Authorization header → throws UnauthorizedException', async () => {
    const ctx = makeExecutionContext(undefined);

    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(apiTokenService.verify).not.toHaveBeenCalled();
  });

  it('non-Bearer scheme → throws UnauthorizedException', async () => {
    const ctx = makeExecutionContext('Basic dXNlcjpwYXNz');

    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(apiTokenService.verify).not.toHaveBeenCalled();
  });
});
