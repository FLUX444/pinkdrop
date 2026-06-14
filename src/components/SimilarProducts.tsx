import type { Product } from '../types';
import { ProductCard } from './ProductCard';

interface SimilarProductsProps {
  products: Product[];
  title?: string;
  onPriceDropDue?: () => void;
}

export function SimilarProducts({
  products,
  title = 'Похожие товары',
  onPriceDropDue,
}: SimilarProductsProps) {
  if (products.length === 0) return null;

  return (
    <section className="similar-products">
      <h2 className="similar-products__title title-with-code">
        <span className="title-code">&lt;/&gt;</span>
        <span>{title}</span>
      </h2>
      <div className="product-grid product-grid--comfortable similar-products__grid">
        {products.map((product) => (
          <ProductCard
            key={`${product.category}:${product.id}`}
            product={product}
            onPriceDropDue={onPriceDropDue}
          />
        ))}
      </div>
    </section>
  );
}
