import jwt, { type JwtPayload } from 'jsonwebtoken';

export class Jwt {
  private static INSTANCE: Jwt;
  private readonly secret: string;

  private constructor(secret: string) {
    this.secret = secret;
  }

  static getInstance(secret: string) {
    if (!Jwt.INSTANCE) Jwt.INSTANCE = new Jwt(secret);

    return Jwt.INSTANCE;
  }

  async encrypt(plainText: string) {
    return jwt.sign({ id: plainText }, this.secret);
  }

  async decrypt(cipherText: string) {
    return jwt.verify(cipherText, this.secret) as JwtPayload;
  }
}
