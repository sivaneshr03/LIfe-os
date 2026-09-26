/**
 * Edge-compatible cryptography utilities using native Web Crypto API.
 */

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function generateOpaqueToken(byteLength = 32): string {
  const buffer = new Uint8Array(byteLength);
  crypto.getRandomValues(buffer);
  return bufferToHex(buffer.buffer);
}

export function generateSalt(byteLength = 16): string {
  const buffer = new Uint8Array(byteLength);
  crypto.getRandomValues(buffer);
  return bufferToHex(buffer.buffer);
}

export async function hashPassword(password: string, existingSalt?: string): Promise<{ hash: string; salt: string }> {
  const saltHex = existingSalt || generateSalt();
  const saltBytes = hexToBuffer(saltHex);
  const enc = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH_BITS
  );

  return {
    hash: bufferToHex(derivedBits),
    salt: saltHex,
  };
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

export async function verifyPassword(password: string, expectedHash: string, salt: string): Promise<boolean> {
  const { hash: computedHash } = await hashPassword(password, salt);
  const computedBytes = hexToBuffer(computedHash);
  const expectedBytes = hexToBuffer(expectedHash);

  return timingSafeEqual(computedBytes, expectedBytes);
}

export async function hashIp(ip: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(ip || 'unknown'));
  return bufferToHex(digest);
}
