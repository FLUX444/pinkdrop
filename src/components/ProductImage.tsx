export type ProductImageVariant = 'default' | 'cart' | 'order';

interface ProductImageProps {
  src: string;
  alt?: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  variant?: ProductImageVariant;
}

export function ProductImage({
  src,
  alt = '',
  className = '',
  loading = 'lazy',
  variant = 'default',
}: ProductImageProps) {
  const variantClass = variant !== 'default' ? ` product-image--${variant}` : '';
  const framed = variant === 'cart' || variant === 'order';

  return (
    <span className={`product-image${framed ? ' product-image--framed' : ''}${variantClass}${className ? ` ${className}` : ''}`}>
      {framed && (
        <>
          <span className="product-image__grid" aria-hidden />
          <span className="product-image__glow" aria-hidden />
        </>
      )}
      <img src={src} alt={alt} loading={loading} draggable={false} />
    </span>
  );
}
