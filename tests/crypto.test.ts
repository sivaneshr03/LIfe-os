import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generateOpaqueToken, generateSalt } from '../src/server/lib/crypto';

describe('Web Crypto Password & Token Suite', () => {
  it('generates distinct cryptographic salts', () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    expect(salt1).not.toBe(salt2);
    expect(salt1.length).toBe(32); // 16 bytes = 32 hex chars
  });

  it('hashes password and verifies successfully with correct password', async () => {
    const password = 'SuperSecretPassword123!';
    const { hash, salt } = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(salt).toBeDefined();
    expect(hash.length).toBe(64); // 256 bits = 64 hex chars

    const isValid = await verifyPassword(password, hash, salt);
    expect(isValid).toBe(true);
  });

  it('rejects verification with wrong password', async () => {
    const password = 'CorrectPassword123!';
    const { hash, salt } = await hashPassword(password);

    const isWrongValid = await verifyPassword('IncorrectPassword', hash, salt);
    expect(isWrongValid).toBe(false);
  });

  it('generates opaque session tokens with sufficient entropy', () => {
    const token1 = generateOpaqueToken(32);
    const token2 = generateOpaqueToken(32);

    expect(token1).not.toBe(token2);
    expect(token1.length).toBe(64); // 32 bytes = 64 hex chars
  });
});
