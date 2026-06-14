import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../types';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/formatPrice';
import { ProductImage } from './ProductImage';
import { getProductPath } from '../utils/productUrl';

interface CrossSellProps {
  products: Product[];
}

export function CrossSell({ products }: CrossSellProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(products.map((product) => `${product.category}:${product.id}`))
  );
  const { addItem } = useCart();

  if (products.length === 0) return null;

  const productKey = (product: Product) => `${product.category}:${product.id}`;

  const toggle = (product: Product) => {
    const key = productKey(product);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleAdd = () => {
    products.filter((product) => selected.has(productKey(product))).forEach((product) => addItem(product));
  };

  return (
    <section className="cross-sell">
      <h3 className="cross-sell__title title-with-code">
        <span className="title-code">&lt;/&gt;</span>
        <span>ВМЕСТЕ ДЕШЕВЛЕ</span>
      </h3>
      <div className="cross-sell__list">
        {products.map((product) => (
          <label key={productKey(product)} className="cross-sell__item">
            <input
              type="checkbox"
              checked={selected.has(productKey(product))}
              onChange={() => toggle(product)}
            />
            <Link
              to={getProductPath(product)}
              className="cross-sell__thumb"
              onClick={(event) => event.stopPropagation()}
            >
              <ProductImage src={product.images[0]} alt="" />
            </Link>
            <div className="cross-sell__info">
              <Link to={getProductPath(product)} className="cross-sell__name">
                {product.name}
              </Link>
              <strong>{formatPrice(product.price)}</strong>
            </div>
          </label>
        ))}
      </div>
      <button
        type="button"
        className="btn btn--secondary cross-sell__btn"
        onClick={handleAdd}
        disabled={selected.size === 0}
      >
        Добавить выбранное в корзину
      </button>
    </section>
  );
}
