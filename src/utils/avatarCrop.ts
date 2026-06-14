export interface AvatarCropState {
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  enhance: boolean;
}

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

export function exportAvatarCrop(
  image: HTMLImageElement,
  state: AvatarCropState,
  viewportSize: number,
  outputSize = 512
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return Promise.reject(new Error('Canvas is not available'));
  }

  const ratio = outputSize / viewportSize;

  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, outputSize, outputSize);

  ctx.save();
  ctx.beginPath();
  ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
  ctx.clip();

  ctx.translate(outputSize / 2 + state.offsetX * ratio, outputSize / 2 + state.offsetY * ratio);
  ctx.rotate((state.rotation * Math.PI) / 180);
  ctx.scale(state.scale * ratio, state.scale * ratio);

  if (state.enhance) {
    ctx.filter = 'contrast(1.1) saturate(1.12) brightness(1.05)';
  }

  ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Не удалось обработать фото'))),
      'image/jpeg',
      0.92
    );
  });
}
