import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenIssuerPort } from '../domain/token-issuer.port';

@Injectable()
export class JwtTokenIssuer extends TokenIssuerPort {
  constructor(private readonly jwtService: JwtService) {
    super();
  }

  sign(payload: { sub: number }): string {
    return this.jwtService.sign(payload);
  }
}
