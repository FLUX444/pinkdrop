import { config as loadDotenv } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
loadDotenv({ path: resolve(rootDir, '.env') });
