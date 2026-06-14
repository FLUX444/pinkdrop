import type { CatalogView, Product } from '../types';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: Product[];
  onPriceDropDue?: () => void;
  title?: string;
  id?: string;
  variant?: 'dark' | 'light';
  view?: CatalogView;
  append?: React.ReactNode;
}

export function ProductGrid({
  products,
  onPriceDropDue,
  title,
  id,
  variant = 'dark',
  view = 'compact',
  append,
}: ProductGridProps) {
  if (products.length === 0 && !append) return null;

  return (
    <section id={id} className={`product-section product-section--${variant} ${id === 'new' ? 'product-section--featured' : ''}`}>
      {title && (
        <h2 className="product-section__title">
          {title}
        </h2>
      )}
      <div className={`product-grid product-grid--${view}`}>
        {products.map((p) => (
          <ProductCard key={`${p.category ?? 'item'}-${p.id}`} product={p} onPriceDropDue={onPriceDropDue} />
        ))}
        {append}
      </div>
    </section>
  );
}
