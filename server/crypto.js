import crypto from 'crypto';
import { config } from './config.js';

function getEncryptionKey() {
  const hex = config.encryptionKey;
  if (hex && hex.length === 64) {
    return Buffer.from(hex, 'hex');
  }

  return crypto.createHash('sha256').update('pinkdrop-dev-fallback-key').digest();
}

export function isEncryptionConfigured() {
  return Boolean(config.encryptionKey && config.encryptionKey.length === 64);
}

export function encryptJson(value) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = JSON.stringify(value);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptJson(payload) {
  if (!payload) return null;

  try {
    const buffer = Buffer.from(payload, 'base64');
    const iv = buffer.subarray(0, 12);
    const authTag = buffer.subarray(12, 28);
    const encrypted = buffer.subarray(28);
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}
