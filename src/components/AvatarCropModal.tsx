import { useCallback, useEffect, useRef, useState } from 'react';
import { Crop, Loader2, RotateCw, Sparkles } from 'lucide-react';
import {
  clampCropState,
  exportAvatarCrop,
  getCoverScale,
  type AvatarCropState,
} from '../utils/avatarCrop';

const DEFAULT_CROP_SIZE = 280;
const MIN_CROP_SIZE = 120;
const MAX_CROP_SIZE = 360;

type CornerId = 'tl' | 'tr' | 'bl' | 'br';

interface AvatarCropModalProps {
  imageUrl: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => Promise<void>;
}

type InteractionState =
  | { mode: 'pan'; x: number; y: number; offsetX: number; offsetY: number }
  | { mode: 'resize-crop'; startDistance: number; startCropSize: number };

const CORNERS: CornerId[] = ['tl', 'tr', 'bl', 'br'];

function clampCropSize(size: number) {
  return Math.min(MAX_CROP_SIZE, Math.max(MIN_CROP_SIZE, size));
}

export function AvatarCropModal({ imageUrl, onCancel, onConfirm }: AvatarCropModalProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const cropOverlayRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<InteractionState | null>(null);
  const cropRef = useRef<AvatarCropState>({
    scale: 1,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    enhance: false,
  });
  const cropSizeRef = useRef(DEFAULT_CROP_SIZE);
  const imageSizeRef = useRef({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [cropSize, setCropSize] = useState(DEFAULT_CROP_SIZE);
  const [crop, setCrop] = useState<AvatarCropState>(cropRef.current);

  cropRef.current = crop;
  cropSizeRef.current = cropSize;
  imageSizeRef.current = imageSize;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const normalizeCrop = useCallback((next: AvatarCropState, viewportSize = cropSizeRef.current) => {
    const { width, height } = imageSizeRef.current;
    if (!width || !height) return next;
    return clampCropState(next, width, height, viewportSize);
  }, []);

  const applyCrop = useCallback(
    (updater: (current: AvatarCropState) => AvatarCropState, viewportSize = cropSizeRef.current) => {
      setCrop((current) => {
        const next = normalizeCrop(updater(current), viewportSize);
        cropRef.current = next;
        return next;
      });
    },
    [normalizeCrop]
  );

  const distanceFromCropCenter = useCallback((clientX: number, clientY: number) => {
    const cropRect = cropOverlayRef.current?.getBoundingClientRect();
    if (!cropRect) return 0;
    const cx = cropRect.left + cropRect.width / 2;
    const cy = cropRect.top + cropRect.height / 2;
    return Math.hypot(clientX - cx, clientY - cy);
  }, []);

  const endInteraction = useCallback(() => {
    interactionRef.current = null;
  }, []);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction) return;

      if (interaction.mode === 'resize-crop') {
        const distance = Math.max(distanceFromCropCenter(event.clientX, event.clientY), MIN_CROP_SIZE * 0.35);
        const ratio = distance / interaction.startDistance;
        const nextSize = clampCropSize(interaction.startCropSize * ratio);

        cropSizeRef.current = nextSize;
        setCropSize(nextSize);
        applyCrop((current) => current, nextSize);
        return;
      }

      applyCrop((current) => ({
        ...current,
        offsetX: interaction.offsetX + event.clientX - interaction.x,
        offsetY: interaction.offsetY + event.clientY - interaction.y,
      }));
    },
    [applyCrop, distanceFromCropCenter]
  );

  useEffect(() => {
    const handlePointerUp = () => endInteraction();
    const preventContextMenu = (event: MouseEvent) => {
      if (interactionRef.current?.mode === 'resize-crop') {
        event.preventDefault();
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('contextmenu', preventContextMenu);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('contextmenu', preventContextMenu);
    };
  }, [endInteraction, handlePointerMove]);

  const handleImageLoad = () => {
    const image = imageRef.current;
    if (!image) return;

    const size = {
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
    setImageSize(size);
    imageSizeRef.current = size;

    const initial = clampCropState(
      {
        scale: getCoverScale(image, DEFAULT_CROP_SIZE),
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
        enhance: false,
      },
      size.width,
      size.height,
      DEFAULT_CROP_SIZE
    );
    cropRef.current = initial;
    setCrop(initial);
    setReady(true);
  };

  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (busy || event.button !== 0) return;

    interactionRef.current = {
      mode: 'pan',
      x: event.clientX,
      y: event.clientY,
      offsetX: cropRef.current.offsetX,
      offsetY: cropRef.current.offsetY,
    };
  };

  const startCornerResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (busy) return;
    if (event.button !== 0 && event.button !== 2) return;

    event.preventDefault();
    event.stopPropagation();

    interactionRef.current = {
      mode: 'resize-crop',
      startDistance: Math.max(distanceFromCropCenter(event.clientX, event.clientY), MIN_CROP_SIZE * 0.35),
      startCropSize: cropSizeRef.current,
    };
  };

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.06 : -0.06;
    applyCrop((current) => ({
      ...current,
      scale: current.scale + delta,
    }));
  };

  const handleConfirm = async () => {
    const image = imageRef.current;
    if (!image || !ready) return;

    setBusy(true);
    setError('');
    try {
      const blob = await exportAvatarCrop(image, cropRef.current, cropSizeRef.current);
      await onConfirm(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить фото');
      setBusy(false);
    }
  };

  const imageTransform = `translate(calc(-50% + ${crop.offsetX}px), calc(-50% + ${crop.offsetY}px)) rotate(${crop.rotation}deg) scale(${crop.scale})`;

  return (
    <div
      className="avatar-crop-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Редактирование фото профиля"
      style={{ ['--crop-bg' as string]: `url("${imageUrl}")` }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="avatar-crop-modal__backdrop" aria-hidden />

      <div className="avatar-crop-modal__stage">
        <div className="avatar-crop-modal__workspace" onWheel={handleWheel}>
          <div className="avatar-crop-modal__pan-surface" onPointerDown={startPan}>
            <img
              ref={imageRef}
              src={imageUrl}
              alt=""
              draggable={false}
              className="avatar-crop-modal__image"
              width={imageSize.width || undefined}
              height={imageSize.height || undefined}
              style={{
                transform: imageTransform,
                filter: crop.enhance ? 'contrast(1.1) saturate(1.12) brightness(1.05)' : undefined,
              }}
              onLoad={handleImageLoad}
            />
          </div>

          <div
            ref={cropOverlayRef}
            className="avatar-crop-modal__crop-overlay"
            style={{ width: cropSize, height: cropSize }}
          >
            <div className="avatar-crop-modal__crop-dim" aria-hidden />
            <div className="avatar-crop-modal__circle-shade" aria-hidden />
            <div className="avatar-crop-modal__circle-ring" aria-hidden />
          </div>

          <div
            className="avatar-crop-modal__crop-handles"
            style={{ width: cropSize, height: cropSize }}
          >
            {CORNERS.map((corner) => (
              <button
                key={corner}
                type="button"
                tabIndex={-1}
                aria-label="Изменить размер круга"
                data-corner={corner}
                className={`avatar-crop-modal__corner avatar-crop-modal__corner--${corner}`}
                onPointerDown={startCornerResize}
                onContextMenu={(event) => event.preventDefault()}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="avatar-crop-modal__toolbar-wrap">
        <div className="avatar-crop-modal__toolbar">
          <button type="button" className="avatar-crop-modal__action" onClick={onCancel} disabled={busy}>
            Отмена
          </button>

          <div className="avatar-crop-modal__tools">
            <button
              type="button"
              className="avatar-crop-modal__tool is-active"
              aria-label="Обрезка"
              disabled={busy}
            >
              <Crop size={22} />
            </button>
            <button
              type="button"
              className="avatar-crop-modal__tool"
              aria-label="Повернуть"
              disabled={busy}
              onClick={() =>
                applyCrop((current) => ({
                  ...current,
                  rotation: current.rotation + 90,
                  offsetX: 0,
                  offsetY: 0,
                }))
              }
            >
              <RotateCw size={22} />
            </button>
            <button
              type="button"
              className={`avatar-crop-modal__tool${crop.enhance ? ' is-active' : ''}`}
              aria-label="Улучшить фото"
              disabled={busy}
              onClick={() => applyCrop((current) => ({ ...current, enhance: !current.enhance }))}
            >
              <Sparkles size={22} />
            </button>
          </div>

          <button
            type="button"
            className="avatar-crop-modal__action avatar-crop-modal__action--primary"
            onClick={() => void handleConfirm()}
            disabled={busy || !ready}
          >
            {busy ? <Loader2 size={18} className="profile-avatar-editor__spin" /> : 'Установить фото'}
          </button>
        </div>
      </div>

      {error && <p className="avatar-crop-modal__error">{error}</p>}
    </div>
  );
}
