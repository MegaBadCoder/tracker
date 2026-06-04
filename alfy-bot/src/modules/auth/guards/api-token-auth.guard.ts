import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTokenService } from '../application/api-token.service';

@Injectable()
export class ApiTokenAuthGuard implements CanActivate {
  constructor(private readonly apiTokenService: ApiTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
      user?: { sub: number };
    }>();

    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }

    const token = authHeader.slice(7);
    const userId = await this.apiTokenService.verify(token);

    if (userId === null) {
      throw new UnauthorizedException();
    }

    request.user = { sub: userId };
    return true;
  }
}
