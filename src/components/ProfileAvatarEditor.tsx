import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Loader2 } from 'lucide-react';
import type { User, PresenceStatus } from '../types';
import type { AvatarCropPayload } from '../utils/avatarCrop';
import { AvatarCropModal } from './AvatarCropModal';
import { AvatarWithPresence } from './AvatarWithPresence';
import { usePresence } from '../context/PresenceContext';

const PRESENCE_LABELS: Record<PresenceStatus, string> = {
  online: 'В сети',
  away: 'Отошёл',
  offline: 'Не в сети',
};

function TelegramCameraIcon() {
  return (
    <svg className="profile-avatar-editor__camera-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M9.5 6.5 10.8 4h2.4l1.3 2.5H18c1.1 0 2 .9 2 2v9.5c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V8.5c0-1.1.9-2 2-2h3.5Zm2.5 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z"
      />
    </svg>
  );
}

interface ProfileAvatarEditorProps {
  user: User;
  onUpload: (file: File, crop: AvatarCropPayload) => Promise<void>;
  onRemove: () => Promise<void>;
}

function getDisplayLabel(user: User) {
  return user.name || user.email || user.phone || '?';
}

function resolveAvatarSrc(url: string | null | undefined, version: number) {
  if (!url) return null;

  const absolute = url.startsWith('/') ? `${window.location.origin}${url}` : url;
  if (!url.startsWith('/uploads/avatars/')) return absolute;
  return version > 0 ? `${absolute}?v=${version}` : absolute;
}

export function ProfileAvatarEditor({ user, onUpload, onRemove }: ProfileAvatarEditorProps) {
  const presenceStatus = usePresence(user.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const originalFileRef = useRef<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const resolvedAvatar = resolveAvatarSrc(user.avatarUrl, avatarVersion);
  const displayAvatar = resolvedAvatar && resolvedAvatar !== failedSrc ? resolvedAvatar : null;
  const hasUploadedAvatar = Boolean(user.avatarUrl?.startsWith('/uploads/avatars/'));

  useEffect(() => {
    setFailedSrc(null);
  }, [user.avatarUrl, avatarVersion]);

  useEffect(() => {
    return () => {
      if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl);
    };
  }, [cropSourceUrl]);

  const handlePick = () => {
    setError('');
    inputRef.current?.click();
  };

  const closeCropModal = () => {
    if (cropSourceUrl) {
      URL.revokeObjectURL(cropSourceUrl);
    }
    setCropSourceUrl(null);
    originalFileRef.current = null;
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Можно загрузить только изображение');
      return;
    }

    setError('');
    originalFileRef.current = file;
    if (cropSourceUrl) {
      URL.revokeObjectURL(cropSourceUrl);
    }
    setCropSourceUrl(URL.createObjectURL(file));
  };

  const handleCropConfirm = async (crop: AvatarCropPayload) => {
    const file = originalFileRef.current;
    if (!file) {
      setError('Не удалось прочитать файл');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await onUpload(file, crop);
      setAvatarVersion((value) => value + 1);
      closeCropModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить фото');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError('');
    try {
      await onRemove();
      setAvatarVersion((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить фото');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile-avatar-editor">
      <button
        type="button"
        className="profile-avatar-editor__trigger"
        onClick={handlePick}
        disabled={busy}
        aria-label="Изменить фото профиля"
      >
        <AvatarWithPresence userId={user.id} size={96} className="profile-avatar-editor__presence">
          {displayAvatar ? (
            <img
              src={displayAvatar}
              alt=""
              className="profile-avatar-editor__image"
              onError={() => {
                if (displayAvatar) setFailedSrc(displayAvatar);
              }}
            />
          ) : (
            <span className="profile-avatar-editor__placeholder" aria-hidden>
              {getDisplayLabel(user).charAt(0).toUpperCase()}
            </span>
          )}
        </AvatarWithPresence>
        <span className="profile-avatar-editor__camera" aria-hidden>
          {busy ? <Loader2 size={16} className="profile-avatar-editor__spin" /> : <TelegramCameraIcon />}
        </span>
      </button>

      <p
        className={`profile-avatar-editor__status profile-avatar-editor__status--${presenceStatus}`}
        aria-live="polite"
      >
        {PRESENCE_LABELS[presenceStatus]}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif"
        className="profile-avatar-editor__input"
        onChange={handleFileChange}
      />

      <p className="profile-avatar-editor__hint">Нажмите на фото, чтобы изменить</p>

      {hasUploadedAvatar && (
        <button
          type="button"
          className="profile-avatar-editor__remove"
          onClick={() => void handleRemove()}
          disabled={busy}
        >
          Удалить фото
        </button>
      )}

      {error && <p className="profile-avatar-editor__error">{error}</p>}

      {cropSourceUrl && (
        <AvatarCropModal
          imageUrl={cropSourceUrl}
          onCancel={closeCropModal}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}
