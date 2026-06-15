import { Check, CheckCheck, User } from 'lucide-react';
import type { SupportMessage } from '../types';
import { operatorRoleLabel } from '../types';
import { AvatarWithPresence } from './AvatarWithPresence';
import { ReviewMediaGrid } from './ReviewMediaGrid';

interface SupportMessageBubbleProps {
  message: SupportMessage;
  userLabel?: string;
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SupportMessageBubble({ message, userLabel }: SupportMessageBubbleProps) {
  const author =
    message.senderRole === 'user' && userLabel ? userLabel : message.authorName;
  const roleBadge =
    message.senderRole === 'admin' && message.authorOperatorRole
      ? operatorRoleLabel(message.authorOperatorRole)
      : null;
  const media = message.media ?? [];
  const showBody = message.body && !(media.length > 0 && message.body === '📎 Вложение');

  return (
    <div className={`support-chat-bubble support-chat-bubble--${message.senderRole}`}>
      <div className="support-chat-bubble__head">
        <AvatarWithPresence userId={message.authorUserId} size={36}>
          {message.authorAvatarUrl ? (
            <img src={message.authorAvatarUrl} alt="" className="support-chat-bubble__avatar" />
          ) : (
            <span className="support-chat-bubble__avatar support-chat-bubble__avatar--fallback" aria-hidden>
              {author.trim().charAt(0).toUpperCase() || <User size={14} />}
            </span>
          )}
        </AvatarWithPresence>
        <span className="support-chat-bubble__author">{author}</span>
        {roleBadge && <span className="operator-role-badge">{roleBadge}</span>}
      </div>
      {showBody && <p>{message.body}</p>}
      {media.length > 0 && (
        <div className="support-chat-bubble__media">
          <ReviewMediaGrid
            media={media.map((item) => ({
              url: item.url,
              type: item.type,
              name: item.name ?? undefined,
            }))}
            compact
          />
        </div>
      )}
      <div className="support-chat-bubble__footer">
        <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
        {message.readStatus && (
          <span
            className={`support-chat-bubble__status support-chat-bubble__status--${message.readStatus}`}
            title={message.readStatus === 'read' ? 'Прочитано' : 'Отправлено'}
            aria-label={message.readStatus === 'read' ? 'Прочитано' : 'Отправлено'}
          >
            {message.readStatus === 'read' ? <CheckCheck size={14} /> : <Check size={14} />}
          </span>
        )}
      </div>
    </div>
  );
}
