import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface PhoneContactModalProps {
  phoneDisplay: string;
  phoneHref: string;
  onClose: () => void;
}

export function PhoneContactModal({ phoneDisplay, phoneHref, onClose }: PhoneContactModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(phoneDisplay);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="phone-contact-modal" role="presentation" onClick={onClose}>
      <div
        className="phone-contact-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="phone-contact-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="phone-contact-modal__close" onClick={onClose} aria-label="Закрыть">
          <X size={20} />
        </button>
        <span className="mono phone-contact-modal__tag">PHONE</span>
        <h2 id="phone-contact-modal-title">Телефон</h2>
        <p className="phone-contact-modal__number">{phoneDisplay}</p>
        <button type="button" className="btn btn--primary phone-contact-modal__copy" onClick={() => void handleCopy()}>
          {copied ? 'Скопировано' : 'Скопировать номер'}
        </button>
        <a className="phone-contact-modal__tel mono" href={`tel:${phoneHref}`}>
          tel:{phoneHref}
        </a>
      </div>
    </div>
  );
}
