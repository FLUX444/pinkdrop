export interface AvatarCropState {
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  enhance: boolean;
}

export type AvatarCropPayload = AvatarCropState & {
  cropSize: number;
};

export function getCoverScale(image: HTMLImageElement, viewportSize: number) {
  return Math.max(viewportSize / image.naturalWidth, viewportSize / image.naturalHeight);
}

export function getContainScale(image: HTMLImageElement, viewportSize: number) {
  return Math.min(viewportSize / image.naturalWidth, viewportSize / image.naturalHeight);
}

export function getRotatedDimensions(width: number, height: number, rotation: number) {
  const normalized = ((rotation % 360) + 360) % 360;
  const swap = normalized === 90 || normalized === 270;
  return {
    width: swap ? height : width,
    height: swap ? width : height,
  };
}

export function getMinCoverScale(
  naturalWidth: number,
  naturalHeight: number,
  viewportSize: number,
  rotation: number
) {
  const { width, height } = getRotatedDimensions(naturalWidth, naturalHeight, rotation);
  return Math.max(viewportSize / width, viewportSize / height);
}

export function clampCropState(
  state: AvatarCropState,
  naturalWidth: number,
  naturalHeight: number,
  viewportSize: number
): AvatarCropState {
  const minScale = getMinCoverScale(naturalWidth, naturalHeight, viewportSize, state.rotation);
  const scale = Math.max(minScale, state.scale);

  const { width, height } = getRotatedDimensions(naturalWidth, naturalHeight, state.rotation);
  const displayWidth = width * scale;
  const displayHeight = height * scale;

  const maxOffsetX = Math.max(0, displayWidth / 2 - viewportSize / 2);
  const maxOffsetY = Math.max(0, displayHeight / 2 - viewportSize / 2);

  return {
    ...state,
    scale,
    offsetX: Math.min(maxOffsetX, Math.max(-maxOffsetX, state.offsetX)),
    offsetY: Math.min(maxOffsetY, Math.max(-maxOffsetY, state.offsetY)),
  };
}

/** Браузер показывает EXIF-поворот в <img>, canvas — нет. Выравниваем пиксели с превью. */
export async function normalizeAvatarSourceImage(image: HTMLImageElement): Promise<HTMLImageElement> {
  await image.decode?.();

  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error('Изображение не загрузилось');
  }

  if (typeof createImageBitmap !== 'function') {
    return image;
  }

  try {
    const bitmap = await createImageBitmap(image, { imageOrientation: 'from-image' });
    const needsNormalize =
      bitmap.width !== image.naturalWidth || bitmap.height !== image.naturalHeight;

    if (!needsNormalize) {
      bitmap.close();
      return image;
    }

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return image;
    }

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const normalized = new Image();
    normalized.src = canvas.toDataURL('image/jpeg', 0.92);
    await normalized.decode();
    return normalized;
  } catch {
    return image;
  }
}

function isMostlyBlankCanvas(ctx: CanvasRenderingContext2D, size: number) {
  const { data } = ctx.getImageData(0, 0, size, size);
  let darkPixels = 0;
  let sampled = 0;

  for (let i = 0; i < data.length; i += 64) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 8) continue;
    sampled += 1;
    if (r < 24 && g < 24 && b < 24) darkPixels += 1;
  }

  return sampled > 0 && darkPixels / sampled > 0.92;
}

export async function exportAvatarCrop(
  image: HTMLImageElement,
  state: AvatarCropState,
  viewportSize: number,
  outputSize = 512
): Promise<Blob> {
  await image.decode?.();

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) {
    throw new Error('Изображение не загрузилось');
  }

  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas is not available');
  }

  const ratio = outputSize / viewportSize;
  const normalized = clampCropState(state, width, height, viewportSize);

  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, outputSize, outputSize);

  ctx.save();
  ctx.beginPath();
  ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
  ctx.clip();

  ctx.translate(
    outputSize / 2 + normalized.offsetX * ratio,
    outputSize / 2 + normalized.offsetY * ratio
  );
  ctx.rotate((normalized.rotation * Math.PI) / 180);
  ctx.scale(normalized.scale * ratio, normalized.scale * ratio);

  if (normalized.enhance) {
    ctx.filter = 'contrast(1.1) saturate(1.12) brightness(1.05)';
  }

  ctx.drawImage(image, -width / 2, -height / 2);
  ctx.restore();

  if (isMostlyBlankCanvas(ctx, outputSize)) {
    throw new Error('Не удалось обработать фото. Попробуйте другое изображение.');
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), 'image/jpeg', 0.92);
  });

  if (!blob) {
    throw new Error('Не удалось обработать фото');
  }

  return blob;
}
