import bcrypt from 'bcrypt';

export class Bcrypt {
  private static INSTANCE: Bcrypt;
  private readonly salt: number;

  private constructor(salt: number) {
    this.salt = salt;
  }

  static getInstance(salt: number) {
    if (!Bcrypt.INSTANCE) Bcrypt.INSTANCE = new Bcrypt(salt);

    return Bcrypt.INSTANCE;
  }

  async hash(plainText: string) {
    return bcrypt.hash(plainText, this.salt);
  }

  async compare(plainText: string, digest: string) {
    return bcrypt.compare(plainText, digest);
  }
}
