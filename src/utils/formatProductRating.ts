export function formatRatingValue(rating: number): string {
  if (!Number.isFinite(rating) || rating <= 0) return '0';
  return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
}

export function formatReviewCount(count: number): string {
  const value = Math.max(0, Math.round(count));
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod100 >= 11 && mod100 <= 14) return `${value} отзывов`;
  if (mod10 === 1) return `${value} отзыв`;
  if (mod10 >= 2 && mod10 <= 4) return `${value} отзыва`;
  return `${value} отзывов`;
}

export function hasProductRating(reviewCount: number): boolean {
  return reviewCount > 0;
}
