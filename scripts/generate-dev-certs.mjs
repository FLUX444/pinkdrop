import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const certDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'certs');
const keyPath = join(certDir, 'key.pem');
const certPath = join(certDir, 'cert.pem');

mkdirSync(certDir, { recursive: true });

if (existsSync(keyPath) && existsSync(certPath)) {
  console.log('Dev certificates already exist:', certDir);
  process.exit(0);
}

const opensslCandidates = [
  'openssl',
  'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
  'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe',
];

function runOpenSsl() {
  let lastError;
  for (const openssl of opensslCandidates) {
    try {
      execSync(
        `"${openssl}" req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"`,
        { cwd: certDir, stdio: 'inherit', shell: true }
      );
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

try {
  runOpenSsl();
  console.log('Created dev HTTPS certificates in', certDir);
} catch {
  console.error(
    [
      'OpenSSL not found. Install Git for Windows (includes openssl) or use ngrok:',
      '  ngrok http 3001',
      'Then set API_URL and VK_REDIRECT_URI to the https://....ngrok-free.app URL',
    ].join('\n')
  );
  process.exit(1);
}
