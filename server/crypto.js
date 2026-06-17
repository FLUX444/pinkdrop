import crypto from 'crypto';
import { config } from './config.js';

export function getEncryptionKey() {
  const hex = config.encryptionKey;
  if (hex && hex.length === 64) {
    return Buffer.from(hex, 'hex');
  }

  return crypto.createHash('sha256').update('pinkdrop-dev-fallback-key').digest();
}

function getEncryptionKeyInternal() {
  return getEncryptionKey();
}

export function isEncryptionConfigured() {
  return Boolean(config.encryptionKey && config.encryptionKey.length === 64);
}

export function encryptJson(value) {
  const key = getEncryptionKeyInternal();
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
    const key = getEncryptionKeyInternal();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

const TEXT_ENCRYPTED_PREFIX = 'pd1:';

export function encryptText(text) {
  const value = String(text ?? '');
  if (!value) return value;

  const key = getEncryptionKeyInternal();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, encrypted]).toString('base64url');
  return `${TEXT_ENCRYPTED_PREFIX}${payload}`;
}

export function decryptText(payload) {
  if (payload == null || payload === '') return payload ?? '';

  const value = String(payload);
  if (!value.startsWith(TEXT_ENCRYPTED_PREFIX)) {
    return value;
  }

  try {
    const buffer = Buffer.from(value.slice(TEXT_ENCRYPTED_PREFIX.length), 'base64url');
    const iv = buffer.subarray(0, 12);
    const authTag = buffer.subarray(12, 28);
    const encrypted = buffer.subarray(28);
    const key = getEncryptionKeyInternal();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return value;
  }
}

export function isEncryptedText(payload) {
  return typeof payload === 'string' && payload.startsWith(TEXT_ENCRYPTED_PREFIX);
}
