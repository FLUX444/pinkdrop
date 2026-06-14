import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'yaml';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = join(rootDir, 'config', 'pinkdrop.yaml');

let cachedConfig = null;

export function getPinkdropConfigPath() {
  return configPath;
}

export function loadPinkdropYaml(force = false) {
  if (cachedConfig && !force) return cachedConfig;
  if (!existsSync(configPath)) {
    cachedConfig = {};
    return cachedConfig;
  }
  cachedConfig = parse(readFileSync(configPath, 'utf8')) ?? {};
  return cachedConfig;
}

function dig(source, path, fallback = '') {
  let current = source;
  for (const key of path) {
    if (current == null || typeof current !== 'object') return fallback;
    current = current[key];
  }
  if (current == null) return fallback;
  return current;
}

export function getYamlString(path, fallback = '') {
  const value = dig(loadPinkdropYaml(), path, fallback);
  return String(value ?? fallback).trim();
}

export function getYamlNumber(path, fallback = null) {
  const value = dig(loadPinkdropYaml(), path, fallback);
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
