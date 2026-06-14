import { useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { ReviewPrompt } from '../types';
import { ProductArtwork } from './ProductArtwork';

interface ReviewPromptModalProps {
  prompt: ReviewPrompt;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function ReviewPromptModal({ prompt, onClose, onSubmitted }: ReviewPromptModalProps) {
  const { setReviewPrompts, refreshUser } = useAuth();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const appendFiles = (nextFiles: FileList | File[]) => {
    setFiles((current) => {
      const merged = [...current, ...Array.from(nextFiles)];
      const unique = new Map(merged.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, file]));
      return Array.from(unique.values()).slice(0, 5);
    });
  };

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  };

  const submitReview = async () => {
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('rating', String(rating));
      formData.append('text', text);
      formData.append('anonymous', String(anonymous));
      for (const file of files) {
        formData.append('media', file);
      }

      const data = await api.createProductReview(prompt.category, prompt.productId, formData);
      setReviewPrompts(data.reviewPrompts);
      await refreshUser();
      onSubmitted?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить отзыв');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="review-prompt" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
          <X size={22} />
        </button>

        <div className="review-prompt__art">
          <ProductArtwork product={prompt.product} compact />
        </div>

        <div className="review-prompt__content">
          <span className="review-prompt__tag mono">REVIEW_AFTER_PAY</span>
          <h2>Оставьте отзыв</h2>
          <p>Вы купили {prompt.product.name}. Расскажите, как вам товар.</p>

          <div className="review-form__rating review-prompt__rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={value <= rating ? 'active' : ''}
                onClick={() => setRating(value)}
              >
                ★
              </button>
            ))}
          </div>

          <div
            className={`review-prompt__dropbox${isDragging ? ' is-dragging' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              appendFiles(event.dataTransfer.files);
            }}
          >
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Ваш отзыв..."
              rows={4}
            />
            <label className="review-prompt__attach" aria-label="Прикрепить фото или видео">
              <Paperclip size={18} />
              <input
                type="file"
                accept="image/*,video/mp4,video/webm"
                multiple
                onChange={(event) => appendFiles(event.target.files ?? [])}
              />
            </label>
            <span className="review-prompt__drop-hint mono">перетащите фото/видео сюда</span>
          </div>

          <label className="review-prompt__anonymous">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(event) => setAnonymous(event.target.checked)}
            />
            Оставить отзыв анонимно
          </label>

          {files.length > 0 && (
            <div className="review-form__files">
              {files.map((file, index) => (
                <span
                  key={`${file.name}:${file.size}:${file.lastModified}`}
                  className="review-form__file-chip"
                >
                  <span className="review-form__file-name">{file.name}</span>
                  <button
                    type="button"
                    className="review-form__file-remove"
                    onClick={() => removeFile(index)}
                    aria-label={`Удалить ${file.name}`}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {error && <p className="review-form__error">{error}</p>}

          <div className="review-prompt__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Закрыть
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={loading || !text.trim()}
              onClick={() => void submitReview()}
            >
              {loading ? 'Отправляем...' : 'Оставить отзыв'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
