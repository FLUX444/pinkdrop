import { Link } from 'react-router-dom';
import type { FavoriteEntry } from '../types';
import { formatPrice } from '../utils/formatPrice';
import { getProductPath } from '../utils/productUrl';
import { getProductDisplayLabels } from '../utils/productDisplayTitle';
import { ProductArtwork } from './ProductArtwork';
import { ProductImage } from './ProductImage';
import { FavoriteButton } from './FavoriteButton';

interface FavoriteProductCardProps {
  entry: FavoriteEntry;
}

export function FavoriteProductCard({ entry }: FavoriteProductCardProps) {
  const product = entry.product;
  const unavailable = !entry.available || entry.missing;
  const cardTitle = product ? getProductDisplayLabels(product) : null;

  const body = (
    <article className={`favorite-card${unavailable ? ' favorite-card--unavailable' : ''}`}>
      <div className="favorite-card__media">
        {product?.images?.[0] ? (
          <ProductImage src={product.images[0]} alt={entry.name} variant="cart" />
        ) : product ? (
          <ProductArtwork product={product} compact showProduct />
        ) : (
          <div className="favorite-card__placeholder" aria-hidden>
            ?
          </div>
        )}
        {unavailable && (
          <div className="favorite-card__soldout" aria-hidden>
            <span>Нет в наличии</span>
          </div>
        )}
      </div>

      <div className="favorite-card__body">
        <div className="favorite-card__head">
          {product && <FavoriteButton product={product} className="favorite-btn--card" />}
          <div className="favorite-card__copy">
            <h3>{cardTitle?.title ?? entry.name}</h3>
            {cardTitle?.accent && <strong>{cardTitle.accent}</strong>}
          </div>
        </div>

        {product && !product.isFree && (
          <p className="favorite-card__price">{formatPrice(product.price)}</p>
        )}
        {product?.isFree && <p className="favorite-card__price">БЕСПЛАТНО</p>}

        {entry.missing && (
          <p className="favorite-card__status favorite-card__status--missing">
            Товар снят с витрины
          </p>
        )}
        {!entry.missing && !entry.available && (
          <p className="favorite-card__status favorite-card__status--soldout">
            Сейчас нет в наличии — мы сохранили его в избранном
          </p>
        )}
      </div>
    </article>
  );

  if (!product || unavailable || !product.category) {
    return body;
  }

  return (
    <Link to={getProductPath(product)} className="favorite-card__link">
      {body}
    </Link>
  );
}
