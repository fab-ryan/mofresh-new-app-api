import { randomInt } from 'crypto';

export class PasswordGeneratorUtil {
  static generate(length: number = 12): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    const allChars = uppercase + lowercase + numbers + symbols;

    let password = '';
    password += uppercase[randomInt(0, uppercase.length)];
    password += lowercase[randomInt(0, lowercase.length)];
    password += numbers[randomInt(0, numbers.length)];
    password += symbols[randomInt(0, symbols.length)];

    while (password.length < length) {
      password += allChars[randomInt(0, allChars.length)];
    }

    return this.shuffle(password);
  }

  private static shuffle(str: string): string {
    const array = str.split('');
    for (let i = array.length - 1; i > 0; i--) {
      const j = randomInt(0, i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array.join('');
  }
}
