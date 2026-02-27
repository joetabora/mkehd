import crypto from 'node:crypto';
import { config } from './config.js';

function getKey(): Buffer {
  const key = config.tokenEncryptionKey;
  const normalized = key.trim();

  if (/^[0-9a-fA-F]{64}$/.test(normalized)) {
    return Buffer.from(normalized, 'hex');
  }

  return crypto.createHash('sha256').update(normalized).digest();
}

const key = getKey();

export function encryptString(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64url')}.${encrypted.toString('base64url')}.${tag.toString('base64url')}`;
}

export function decryptString(payload: string): string {
  const [ivEncoded, encryptedEncoded, tagEncoded] = payload.split('.');
  if (!ivEncoded || !encryptedEncoded || !tagEncoded) {
    throw new Error('Invalid encrypted payload format.');
  }

  const iv = Buffer.from(ivEncoded, 'base64url');
  const encrypted = Buffer.from(encryptedEncoded, 'base64url');
  const tag = Buffer.from(tagEncoded, 'base64url');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
