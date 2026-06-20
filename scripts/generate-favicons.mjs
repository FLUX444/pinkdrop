import { existsSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const SOURCE_CANDIDATES = [
  join(publicDir, 'images', 'pinkdrop-email-logo.png'),
  join(publicDir, 'images', 'pinkdrop-pd-logo.png'),
];

const SIZES = [16, 32, 48, 96, 120, 192, 512];
/** Высота логотипа в шапке (ширина — по пропорциям мастера, не квадрат favicon). */
const BRAND_LOGO_HEIGHTS = [48, 58, 96, 116, 174, 232];

function resolveSourcePath() {
  for (const candidate of SOURCE_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('Favicon source image not found in public/');
}

async function removeBlackBackground(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < 48 && g < 48 && b < 48) {
      data[i + 3] = 0;
    }
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  }).png();
}

async function renderPng(sourcePipeline, size) {
  return sourcePipeline
    .clone()
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: size >= 128 ? 'lanczos3' : 'cubic',
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

function buildIco(sizes, buffers) {
  const count = buffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const entries = buffers.map((buffer, index) => {
    const entry = { buffer, offset, size: sizes[index] };
    offset += buffer.length;
    return entry;
  });

  const output = Buffer.alloc(offset);
  output.writeUInt16LE(0, 0);
  output.writeUInt16LE(1, 2);
  output.writeUInt16LE(count, 4);

  entries.forEach(({ buffer, offset: dataOffset, size }, index) => {
    const entryOffset = 6 + index * 16;
    const dimension = size >= 256 ? 0 : size;
    output.writeUInt8(dimension, entryOffset);
    output.writeUInt8(dimension, entryOffset + 1);
    output.writeUInt8(0, entryOffset + 2);
    output.writeUInt8(0, entryOffset + 3);
    output.writeUInt16LE(1, entryOffset + 4);
    output.writeUInt16LE(32, entryOffset + 6);
    output.writeUInt32LE(buffer.length, entryOffset + 8);
    output.writeUInt32LE(dataOffset, entryOffset + 12);
    buffer.copy(output, dataOffset);
  });

  return output;
}

async function renderBrandLogoPng(sourcePipeline, height) {
  const meta = await sourcePipeline.metadata();
  const sourceWidth = meta.width ?? height;
  const sourceHeight = meta.height ?? height;
  const width = Math.max(1, Math.round(height * (sourceWidth / sourceHeight)));

  return sourcePipeline
    .clone()
    .resize(width, height, {
      fit: 'inside',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: 'lanczos3',
    })
    .sharpen({ sigma: 0.6, m1: 0.5, m2: 0.25 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function main() {
  const sourcePath = resolveSourcePath();
  console.log(`source: ${sourcePath}`);

  const master = await removeBlackBackground(sourcePath);
  const masterMeta = await master.metadata();
  console.log(`master: ${masterMeta.width}x${masterMeta.height}, alpha=${masterMeta.hasAlpha}`);

  for (const size of SIZES) {
    const buffer = await renderPng(master, size);
    writeFileSync(join(publicDir, `favicon-${size}.png`), buffer);
    console.log(`wrote favicon-${size}.png`);
  }

  const appleTouch = await renderPng(master, 180);
  writeFileSync(join(publicDir, 'apple-touch-icon.png'), appleTouch);
  console.log('wrote apple-touch-icon.png');

  const icoSizes = [16, 32, 48];
  const icoBuffers = await Promise.all(icoSizes.map((size) => renderPng(master, size)));
  writeFileSync(join(publicDir, 'favicon.ico'), buildIco(icoSizes, icoBuffers));
  console.log('wrote favicon.ico');

  const brandLogoDir = join(publicDir, 'images');
  for (const height of BRAND_LOGO_HEIGHTS) {
    const buffer = await renderBrandLogoPng(master, height);
    writeFileSync(join(brandLogoDir, `brand-logo-${height}.png`), buffer);
    console.log(`wrote images/brand-logo-${height}.png`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
