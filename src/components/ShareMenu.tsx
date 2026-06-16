import { useEffect, useId, useRef, useState } from 'react';
import { Check, Copy, Send, Share2, Smartphone } from 'lucide-react';
import { buildTelegramShareUrl, canUseNativeShare, copyToClipboard } from '../utils/shareLinks';

interface ShareMenuProps {
  url: string;
  title: string;
  message?: string;
  className?: string;
  buttonLabel?: string;
  disabled?: boolean;
  align?: 'left' | 'right';
}

export function ShareMenu({
  url,
  title,
  message,
  className = '',
  buttonLabel = 'Поделиться',
  disabled = false,
  align = 'right',
}: ShareMenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareText = message ?? title;
  const nativeShareAvailable = canUseNativeShare();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const handleCopy = async () => {
    const ok = await copyToClipboard(url);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (!navigator.share) return;

    try {
      await navigator.share({ title, text: shareText, url });
      setOpen(false);
    } catch {
      // user cancelled or share failed
    }
  };

  return (
    <div
      ref={rootRef}
      className={`share-menu share-menu--${align}${className ? ` ${className}` : ''}`.trim()}
    >
      <button
        type="button"
        className="share-menu__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <Share2 size={16} aria-hidden />
        <span>{buttonLabel}</span>
      </button>

      {open && (
        <div id={menuId} className="share-menu__panel" role="menu" aria-label="Способы поделиться">
          <button type="button" className="share-menu__option" role="menuitem" onClick={() => void handleCopy()}>
            {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
            <span>{copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}</span>
          </button>

          <a
            className="share-menu__option share-menu__option--link"
            role="menuitem"
            href={buildTelegramShareUrl(url, shareText)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            <Send size={16} aria-hidden />
            <span>Отправить в Telegram</span>
          </a>

          {nativeShareAvailable && (
            <button
              type="button"
              className="share-menu__option"
              role="menuitem"
              onClick={() => void handleNativeShare()}
            >
              <Smartphone size={16} aria-hidden />
              <span>Другим приложением</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
