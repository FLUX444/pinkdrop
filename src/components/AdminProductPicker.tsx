import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { Product } from '../types';
import { formatPrice } from '../utils/formatPrice';

interface AdminProductPickerProps {
  products: Product[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function AdminProductPicker({ products, value, onChange, label }: AdminProductPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = products.find((product) => `${product.category}:${product.id}` === value);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="admin-form__field admin-product-picker" ref={rootRef}>
      {label && <span className="admin-product-picker__label">{label}</span>}
      <button
        type="button"
        className={`admin-product-picker__trigger ${isOpen ? 'admin-product-picker__trigger--open' : ''}`}
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {selected ? (
          <>
            <img src={selected.images[0]} alt="" className="admin-product-picker__thumb" />
            <span className="admin-product-picker__selected">
              <span className="admin-product-picker__name">{selected.name}</span>
              <span className="admin-product-picker__price mono">{formatPrice(selected.price)}</span>
            </span>
          </>
        ) : (
          <span className="admin-product-picker__placeholder">Выберите товар</span>
        )}
        <ChevronDown size={16} className="admin-product-picker__chevron" aria-hidden />
      </button>

      <div
        className={`admin-product-picker__panel ${isOpen ? 'admin-product-picker__panel--open' : ''}`}
        role="listbox"
      >
        <div className="admin-product-picker__list">
          {products.map((product) => {
            const productValue = `${product.category}:${product.id}`;
            const isActive = productValue === value;

            return (
              <button
                key={productValue}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`admin-product-picker__option ${isActive ? 'admin-product-picker__option--active' : ''}`}
                onClick={() => {
                  onChange(productValue);
                  setIsOpen(false);
                }}
              >
                <img src={product.images[0]} alt="" className="admin-product-picker__thumb" />
                <span className="admin-product-picker__option-body">
                  <span className="admin-product-picker__name">{product.name}</span>
                  <span className="admin-product-picker__price mono">{formatPrice(product.price)}</span>
                </span>
                {isActive && <Check size={16} className="admin-product-picker__check" aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
