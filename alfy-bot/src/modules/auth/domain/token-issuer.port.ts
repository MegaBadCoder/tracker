export abstract class TokenIssuerPort {
  abstract sign(payload: { sub: number }): string;
}
