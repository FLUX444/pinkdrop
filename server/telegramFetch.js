import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { fetch as undiciFetch, ProxyAgent } from 'undici';

const serverDir = dirname(fileURLToPath(import.meta.url));

function loadTelegramProxyUrl() {
  const fromEnv = String(process.env.TELEGRAM_PROXY_URL ?? '').trim();
  if (fromEnv) return fromEnv;

  try {
    const settingsPath = join(serverDir, '..', 'BOT TG', 'proxy_settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    if (settings?.enabled) {
      const type = settings.type || 'http';
      const host = settings.host || '127.0.0.1';
      const port = settings.port || 2080;
      return `${type}://${host}:${port}`;
    }
  } catch {
    // ignore missing proxy settings
  }

  return null;
}

let proxyAgent = null;
let proxyUrlLoaded = null;

function getProxyDispatcher() {
  const proxyUrl = loadTelegramProxyUrl();
  if (!proxyUrl) return undefined;
  if (proxyUrl !== proxyUrlLoaded) {
    proxyAgent = new ProxyAgent(proxyUrl);
    proxyUrlLoaded = proxyUrl;
  }
  return proxyAgent;
}

export async function telegramFetch(url, options = {}) {
  const dispatcher = getProxyDispatcher();
  if (!dispatcher) {
    return fetch(url, options);
  }
  return undiciFetch(url, { ...options, dispatcher });
}
