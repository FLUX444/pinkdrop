import { Star } from 'lucide-react';
import type { MouseEvent } from 'react';
import type { Product } from '../types';
import { useFavorites } from '../context/FavoritesContext';

interface FavoriteButtonProps {
  product: Product;
  className?: string;
  size?: number;
}

export function FavoriteButton({ product, className = '', size = 18 }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(product);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!product.category) return;
    void toggleFavorite(product);
  };

  return (
    <button
      type="button"
      className={`favorite-btn${active ? ' favorite-btn--active' : ''}${className ? ` ${className}` : ''}`}
      onClick={handleClick}
      aria-label={active ? 'Убрать из избранного' : 'Добавить в избранное'}
      aria-pressed={active}
    >
      <Star size={size} fill={active ? 'currentColor' : 'none'} strokeWidth={2.2} />
    </button>
  );
}
