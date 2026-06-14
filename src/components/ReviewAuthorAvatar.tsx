import { User } from 'lucide-react';
import { AvatarWithPresence } from './AvatarWithPresence';

interface ReviewAuthorAvatarProps {
  author: string;
  avatarUrl?: string | null;
  anonymous?: boolean;
  userId?: string | null;
  size?: number;
}

export function ReviewAuthorAvatar({
  author,
  avatarUrl,
  anonymous = false,
  userId = null,
  size = 44,
}: ReviewAuthorAvatarProps) {
  if (anonymous) {
    return (
      <span
        className="review-author-avatar review-author-avatar--anonymous"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <User size={Math.round(size * 0.48)} strokeWidth={2.2} />
      </span>
    );
  }

  const avatarNode = avatarUrl ? (
    <img
      src={avatarUrl}
      alt=""
      className="review-author-avatar"
      style={{ width: size, height: size }}
      loading="lazy"
    />
  ) : (
    <span
      className="review-author-avatar review-author-avatar--placeholder"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {(author.trim().charAt(0) || '?').toUpperCase()}
    </span>
  );

  return (
    <AvatarWithPresence userId={userId} size={size}>
      {avatarNode}
    </AvatarWithPresence>
  );
}
