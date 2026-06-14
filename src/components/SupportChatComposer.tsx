import { useRef, useState } from 'react';
import { Paperclip, Send, X } from 'lucide-react';

const MAX_FILES = 5;
const ACCEPT = 'image/*,video/mp4,video/webm,video/quicktime';

function isMediaFile(file: File) {
  return file.type.startsWith('image/') || file.type.startsWith('video/');
}

interface SupportChatComposerProps {
  draft: string;
  onDraftChange: (value: string) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
  onSubmit: () => void | Promise<void>;
  sending?: boolean;
  placeholder?: string;
  variant?: 'widget' | 'admin';
}

export function SupportChatComposer({
  draft,
  onDraftChange,
  files,
  onFilesChange,
  onSubmit,
  sending = false,
  placeholder = 'Ваше сообщение...',
  variant = 'widget',
}: SupportChatComposerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const appendFiles = (incoming: FileList | File[]) => {
    const next = [...files];
    for (const file of Array.from(incoming)) {
      if (!isMediaFile(file)) continue;
      if (next.length >= MAX_FILES) break;
      const duplicate = next.some(
        (item) =>
          item.name === file.name && item.size === file.size && item.lastModified === file.lastModified
      );
      if (!duplicate) next.push(file);
    }
    onFilesChange(next);
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, itemIndex) => itemIndex !== index));
  };

  const canSend = (draft.trim().length > 0 || files.length > 0) && !sending;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    void onSubmit();
  };

  return (
    <form
      className={`support-chat-composer support-chat-composer--${variant}${isDragging ? ' is-dragging' : ''}`}
      onSubmit={handleSubmit}
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
      {files.length > 0 && (
        <div className="support-chat-composer__files">
          {files.map((file, index) => (
            <span
              key={`${file.name}:${file.size}:${file.lastModified}`}
              className="support-chat-composer__file-chip"
            >
              <span className="support-chat-composer__file-name">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                aria-label={`Убрать ${file.name}`}
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="support-chat-composer__row">
        <button
          type="button"
          className="support-chat-composer__attach"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Прикрепить фото или видео"
          disabled={sending || files.length >= MAX_FILES}
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(event) => {
            appendFiles(event.target.files ?? []);
            event.target.value = '';
          }}
        />

        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={placeholder}
          rows={variant === 'admin' ? 3 : 2}
          maxLength={2000}
          disabled={sending}
        />

        {variant === 'admin' ? (
          <button type="submit" className="btn btn--primary" disabled={!canSend}>
            <Send size={16} />
            {sending ? 'Отправка...' : 'Отправить'}
          </button>
        ) : (
          <button type="submit" disabled={!canSend} aria-label="Отправить">
            <Send size={18} />
          </button>
        )}
      </div>

      <span className="support-chat-composer__hint mono">
        {isDragging ? 'Отпустите файлы' : 'Скрепка или перетащите фото/видео'}
      </span>
    </form>
  );
}
