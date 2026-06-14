import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product } from '../types';
import { ProductArtwork } from './ProductArtwork';

interface ProductImageGalleryProps {
  product: Product;
}

export function ProductImageGallery({ product }: ProductImageGalleryProps) {
  const images = product.images.length > 0 ? product.images : [];
  const [imageIndex, setImageIndex] = useState(0);
  const activeIndex = images.length ? Math.min(imageIndex, images.length - 1) : 0;

  const prevImage = () =>
    setImageIndex((index) => (index === 0 ? images.length - 1 : index - 1));
  const nextImage = () =>
    setImageIndex((index) => (index === images.length - 1 ? 0 : index + 1));

  return (
    <div className="product-gallery">
      <div className="product-modal__slider">
        <ProductArtwork product={product} imageSrc={images[activeIndex]} />
        {images.length > 1 && (
          <>
            <button type="button" className="slider-btn slider-btn--prev" onClick={prevImage}>
              <ChevronLeft size={24} />
            </button>
            <button type="button" className="slider-btn slider-btn--next" onClick={nextImage}>
              <ChevronRight size={24} />
            </button>
            <div className="slider-dots">
              {images.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className={index === activeIndex ? 'active' : ''}
                  onClick={() => setImageIndex(index)}
                  aria-label={`Фото ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="product-gallery__thumbs" role="tablist" aria-label="Фото товара">
          {images.map((src, index) => (
            <button
              key={`${src}-${index}`}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              className={`product-gallery__thumb${index === activeIndex ? ' is-active' : ''}`}
              onClick={() => setImageIndex(index)}
            >
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
