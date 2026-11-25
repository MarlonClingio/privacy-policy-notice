import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (password: string, salt: string, keylen: number) => Promise<Buffer>;
const KEY_LENGTH = 64;

/** Hash no formato `salt:hash` (hex) usando scrypt, nativo do Node. */
export class PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derived = await scrypt(password, salt, KEY_LENGTH);
    return `${salt}:${derived.toString('hex')}`;
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;

    const expected = Buffer.from(hash, 'hex');
    const derived = await scrypt(password, salt, KEY_LENGTH);
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  }
}
