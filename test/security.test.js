import { describe, expect, it } from 'vitest';
import { hashPassword, hashToken, verifyPassword } from '../worker/security';
import { asInteger, cleanEmail, cleanText, parseJsonArray, validPassword } from '../worker/validation';

describe('password storage', () => {
  it('hashes valid passwords with a random salt and verifies without exposing the password', async () => {
    const first = await hashPassword('kata-sandi-yang-kuat');
    const second = await hashPassword('kata-sandi-yang-kuat');
    expect(first).toMatch(/^pbkdf2_sha256\$600000\$/);
    expect(first).not.toContain('kata-sandi-yang-kuat');
    expect(first).not.toBe(second);
    expect(await verifyPassword('kata-sandi-yang-kuat', first)).toBe(true);
    expect(await verifyPassword('salah-sekali', first)).toBe(false);
  }, 20_000);

  it('hashes tokens deterministically for indexed lookups', async () => {
    expect(await hashToken('one-time-token')).toBe(await hashToken('one-time-token'));
    expect(await hashToken('one-time-token')).not.toBe(await hashToken('different-token'));
  });
});

describe('input normalization', () => {
  it('normalizes email and rejects malformed addresses', () => {
    expect(cleanEmail(' Admin@Example.COM ')).toBe('admin@example.com');
    expect(cleanEmail('not-an-email')).toBeNull();
  });

  it('removes control characters and applies field limits', () => {
    expect(cleanText(' halo\u0000dunia ', 20)).toBe(' halodunia '.trim());
    expect(cleanText('abcdef', 3)).toBe('abc');
  });

  it('validates password length, arrays, and integer values', () => {
    expect(validPassword('12345678')).toBe(true);
    expect(validPassword('1234567')).toBe(false);
    expect(validPassword('terlalu')).toBe(false);
    expect(parseJsonArray('["a","b"]')).toEqual(['a', 'b']);
    expect(parseJsonArray('{}')).toEqual([]);
    expect(asInteger('15000')).toBe(15000);
    expect(asInteger('15.2')).toBeNull();
  });
});
