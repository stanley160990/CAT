import crypto from 'node:crypto';

/**
 * Hash string using SHA-1 as required by specifications.
 */
export function hashPassword(plainText: string): string {
  return crypto.createHash('sha1').update(plainText.trim()).digest('hex');
}

/**
 * Verify plain text password against stored SHA-1 hash.
 */
export function verifyPassword(plainText: string, storedHash: string): boolean {
  if (!plainText || !storedHash) return false;
  const computed = hashPassword(plainText);
  return computed.toLowerCase() === storedHash.toLowerCase();
}
