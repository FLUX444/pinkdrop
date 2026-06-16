import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { products as staticProducts } from '../data/products';
import { useFavorites } from '../context/FavoritesContext';
import { parseFavoritesShareParam } from '../utils/shareLinks';

export function useImportSharedFavorites() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { items, toggleFavorite } = useFavorites();
  const importedRef = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const raw = searchParams.get('items');
    if (!raw || importedRef.current) return;

    importedRef.current = true;
    const entries = parseFavoritesShareParam(raw);
    if (entries.length === 0) {
      setNotice('Не удалось распознать список избранного из ссылки.');
      const next = new URLSearchParams(searchParams);
      next.delete('items');
      setSearchParams(next, { replace: true });
      return;
    }

    const importItems = async () => {
      const products = await api.getProducts().catch(() => staticProducts);
      const existing = new Set(items.map((item) => `${item.category}:${item.productId}`));
      let added = 0;

      for (const entry of entries) {
        const product = products.find(
          (item) => item.id === entry.productId && item.category === entry.category
        );
        if (!product?.category) continue;
        if (existing.has(`${product.category}:${product.id}`)) continue;
        await toggleFavorite(product);
        existing.add(`${product.category}:${product.id}`);
        added += 1;
      }

      const next = new URLSearchParams(searchParams);
      next.delete('items');
      setSearchParams(next, { replace: true });

      if (added > 0) {
        setNotice(
          added === 1
            ? 'В избранное добавлен 1 товар из ссылки.'
            : `В избранное добавлено товаров: ${added}.`
        );
      } else {
        setNotice('Товары из ссылки уже в избранном или недоступны.');
      }
    };

    void importItems();
  }, [items, searchParams, setSearchParams, toggleFavorite]);

  return { notice, clearNotice: () => setNotice(null) };
}
