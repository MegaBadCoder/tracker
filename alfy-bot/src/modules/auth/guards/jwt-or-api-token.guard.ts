import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { ApiTokenAuthGuard } from './api-token-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

const API_TOKEN_REGEX = /^[0-9a-f]{48,}$/;

function isApiToken(token: string): boolean {
  return API_TOKEN_REGEX.test(token);
}

@Injectable()
export class JwtOrApiTokenGuard implements CanActivate {
  constructor(
    private readonly apiTokenGuard: ApiTokenAuthGuard,
    private readonly jwtGuard: JwtAuthGuard,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
    }>();

    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      if (isApiToken(token)) {
        return this.apiTokenGuard.canActivate(context);
      }
    }

    return this.jwtGuard.canActivate(context);
  }
}
