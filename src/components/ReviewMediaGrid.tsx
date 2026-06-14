import type { ReviewMedia } from '../types';

interface ReviewMediaGridProps {
  media: ReviewMedia[];
  compact?: boolean;
}

export function ReviewMediaGrid({ media, compact = false }: ReviewMediaGridProps) {
  if (!media.length) return null;

  return (
    <div className={`review-media${compact ? ' review-media--compact' : ''}`}>
      {media.map((item) => (
        <div key={item.url} className="review-media__tile">
          <span className="review-media__grid" aria-hidden />
          {item.type === 'video' ? (
            <video src={item.url} controls playsInline preload="metadata" />
          ) : (
            <img src={item.url} alt={item.name ?? 'Фото отзыва'} loading="lazy" draggable={false} />
          )}
        </div>
      ))}
    </div>
  );
}
