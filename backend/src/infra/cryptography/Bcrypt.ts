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

  /**
   * A digest of another cost takes another time to verify, which would set its
   * account apart from an unknown email, verified at the configured cost.
   */
  needsRehash(digest: string) {
    return bcrypt.getRounds(digest) !== this.salt;
  }
}
