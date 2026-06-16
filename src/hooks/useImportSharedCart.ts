import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { products as staticProducts } from '../data/products';
import { useCart } from '../context/CartContext';
import { parseCartShareParam } from '../utils/shareLinks';

export function useImportSharedCart() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { addItem } = useCart();
  const importedRef = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const raw = searchParams.get('items');
    if (!raw || importedRef.current) return;

    importedRef.current = true;
    const entries = parseCartShareParam(raw);
    if (entries.length === 0) {
      setNotice('Не удалось распознать список товаров из ссылки.');
      const next = new URLSearchParams(searchParams);
      next.delete('items');
      setSearchParams(next, { replace: true });
      return;
    }

    const importItems = async () => {
      const products = await api.getProducts().catch(() => staticProducts);
      let added = 0;

      for (const entry of entries) {
        const product = products.find(
          (item) => item.id === entry.productId && item.category === entry.category
        );
        if (!product) continue;
        addItem(product, entry.quantity);
        added += 1;
      }

      const next = new URLSearchParams(searchParams);
      next.delete('items');
      setSearchParams(next, { replace: true });

      if (added > 0) {
        setNotice(
          added === 1
            ? 'В корзину добавлен 1 товар из ссылки.'
            : `В корзину добавлено товаров: ${added}.`
        );
      } else {
        setNotice('Товары из ссылки сейчас недоступны.');
      }
    };

    void importItems();
  }, [addItem, searchParams, setSearchParams]);

  return { notice, clearNotice: () => setNotice(null) };
}
