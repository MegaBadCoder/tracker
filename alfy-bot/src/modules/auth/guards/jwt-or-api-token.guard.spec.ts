import { Test, TestingModule } from '@nestjs/testing';
import { JwtOrApiTokenGuard } from './jwt-or-api-token.guard';
import { ApiTokenAuthGuard } from './api-token-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeExecutionContext(authHeader?: string) {
  const req: Record<string, unknown> = {
    headers: authHeader ? { authorization: authHeader } : {},
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  };
}

describe('JwtOrApiTokenGuard', () => {
  let guard: JwtOrApiTokenGuard;
  let apiTokenGuard: { canActivate: jest.Mock };
  let jwtGuard: { canActivate: jest.Mock };

  beforeEach(async () => {
    apiTokenGuard = { canActivate: jest.fn().mockResolvedValue(true) };
    jwtGuard = { canActivate: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtOrApiTokenGuard,
        { provide: ApiTokenAuthGuard, useValue: apiTokenGuard },
        { provide: JwtAuthGuard, useValue: jwtGuard },
      ],
    }).compile();

    guard = module.get(JwtOrApiTokenGuard);
  });

  it('long hex token (48+ chars, all hex) → delegates to ApiTokenAuthGuard', async () => {
    const token = 'a'.repeat(48);
    const ctx = makeExecutionContext(`Bearer ${token}`);

    await guard.canActivate(ctx as never);

    expect(apiTokenGuard.canActivate).toHaveBeenCalledWith(ctx);
    expect(jwtGuard.canActivate).not.toHaveBeenCalled();
  });

  it('JWT-looking token (3 dot-separated parts) → delegates to JwtAuthGuard', async () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjF9.signature';
    const ctx = makeExecutionContext(`Bearer ${token}`);

    await guard.canActivate(ctx as never);

    expect(jwtGuard.canActivate).toHaveBeenCalledWith(ctx);
    expect(apiTokenGuard.canActivate).not.toHaveBeenCalled();
  });

  it('missing header → delegates to JwtAuthGuard (let it handle 401)', async () => {
    const ctx = makeExecutionContext(undefined);

    await guard.canActivate(ctx as never);

    expect(jwtGuard.canActivate).toHaveBeenCalledWith(ctx);
    expect(apiTokenGuard.canActivate).not.toHaveBeenCalled();
  });

  it('short token → delegates to JwtAuthGuard', async () => {
    const ctx = makeExecutionContext('Bearer shorttoken');

    await guard.canActivate(ctx as never);

    expect(jwtGuard.canActivate).toHaveBeenCalledWith(ctx);
    expect(apiTokenGuard.canActivate).not.toHaveBeenCalled();
  });
});
