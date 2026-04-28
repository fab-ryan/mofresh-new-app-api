import * as bcrypt from 'bcrypt';

export class HashingUtil {
  private static readonly SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

  static async hash(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, this.SALT_ROUNDS);
  }

  static async compare(plainText: string, hashedText: string): Promise<boolean> {
    return bcrypt.compare(plainText, hashedText);
  }
}
