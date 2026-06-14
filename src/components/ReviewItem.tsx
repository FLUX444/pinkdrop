import type { Review } from '../types';
import { ReviewAuthorAvatar } from './ReviewAuthorAvatar';
import { ReviewMediaGrid } from './ReviewMediaGrid';

interface ReviewItemProps {
  review: Review;
}

export function ReviewItem({ review }: ReviewItemProps) {
  const dateLabel = new Date(review.createdAt ?? review.date ?? Date.now()).toLocaleDateString('ru-RU');

  return (
    <article className="review-item">
      <ReviewAuthorAvatar
        author={review.author}
        avatarUrl={review.authorAvatarUrl}
        anonymous={review.anonymous}
        userId={review.userId}
      />
      <div className="review-item__body">
        <div className="review-item__header">
          <strong>{review.author}</strong>
          <span className="review-item__date">{dateLabel}</span>
          <span className="review-item__stars" aria-label={`Оценка ${review.rating} из 5`}>
            {'★'.repeat(review.rating)}
          </span>
        </div>
        <p>{review.text}</p>
        {Boolean(review.media?.length) && <ReviewMediaGrid media={review.media ?? []} />}
      </div>
    </article>
  );
}
