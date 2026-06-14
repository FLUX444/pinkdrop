import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../api/client';
import type { FavoriteEntry, Product } from '../types';
import { useAuth } from './AuthContext';

interface FavoritesContextValue {
  items: FavoriteEntry[];
  isLoading: boolean;
  isFavorite: (product: Product) => boolean;
  toggleFavorite: (product: Product) => Promise<boolean>;
  removeFavorite: (productId: string, category: string) => Promise<void>;
  refreshFavorites: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);
const GUEST_FAVORITES_KEY = 'pinkdrop_favorites';

type GuestFavoriteRef = {
  productId: string;
  category: string;
  addedAt?: string;
};

function favoriteKey(productId: string, category?: string) {
  return `${category ?? 'unknown'}:${productId}`;
}

function readGuestFavorites(): GuestFavoriteRef[] {
  try {
    const raw = localStorage.getItem(GUEST_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.productId === 'string' &&
        typeof item.category === 'string'
    );
  } catch {
    return [];
  }
}

function writeGuestFavorites(items: GuestFavoriteRef[]) {
  localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(items));
}

function buildGuestFavoriteItems(
  guestRefs: GuestFavoriteRef[],
  products: Product[]
): FavoriteEntry[] {
  return guestRefs.map((ref) => {
    const product =
      products.find((item) => item.id === ref.productId && item.category === ref.category) ?? null;
    const available = product
      ? product.isFree || typeof product.stock !== 'number' || product.stock > 0
      : false;

    return {
      productId: ref.productId,
      category: ref.category,
      name: product?.name ?? 'Товар',
      addedAt: ref.addedAt ?? new Date().toISOString(),
      available,
      missing: !product,
      product,
    };
  });
}

async function hydrateGuestFavorites(guestRefs: GuestFavoriteRef[]) {
  if (guestRefs.length === 0) return [];
  try {
    const products = await api.getProducts();
    return buildGuestFavoriteItems(guestRefs, products);
  } catch {
    return guestRefs.map((ref) => ({
      productId: ref.productId,
      category: ref.category,
      name: 'Товар',
      addedAt: ref.addedAt ?? new Date().toISOString(),
      available: false,
      missing: true,
      product: null,
    }));
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<FavoriteEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const favoriteKeysRef = useRef<Set<string>>(new Set());
  const syncingRef = useRef(false);

  const applyItems = useCallback((nextItems: FavoriteEntry[]) => {
    setItems(nextItems);
    favoriteKeysRef.current = new Set(
      nextItems.map((item) => favoriteKey(item.productId, item.category))
    );
  }, []);

  const refreshFavorites = useCallback(async () => {
    if (!user) {
      const guestRefs = readGuestFavorites();
      if (guestRefs.length === 0) {
        applyItems([]);
        return;
      }

      setIsLoading(true);
      try {
        const hydrated = await hydrateGuestFavorites(guestRefs);
        applyItems(hydrated);
      } catch {
        applyItems([]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    try {
      const data = await api.getFavorites();
      applyItems(data.items);
    } catch {
      applyItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [applyItems, user]);

  useEffect(() => {
    if (!user) {
      let cancelled = false;

      const loadGuestFavorites = async () => {
        const guestRefs = readGuestFavorites();
        if (guestRefs.length === 0) {
          applyItems([]);
          return;
        }

        favoriteKeysRef.current = new Set(
          guestRefs.map((item) => favoriteKey(item.productId, item.category))
        );
        setIsLoading(true);

        try {
          const hydrated = await hydrateGuestFavorites(guestRefs);
          if (!cancelled) applyItems(hydrated);
        } catch {
          if (!cancelled) applyItems([]);
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      };

      void loadGuestFavorites();

      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;

    const syncOnLogin = async () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      setIsLoading(true);

      try {
        const guestRefs = readGuestFavorites();
        const serverData = await api.getFavorites();
        const merged = new Map<string, GuestFavoriteRef>();

        for (const item of serverData.items) {
          merged.set(favoriteKey(item.productId, item.category), {
            productId: item.productId,
            category: item.category,
            addedAt: item.addedAt,
          });
        }

        for (const item of guestRefs) {
          merged.set(favoriteKey(item.productId, item.category), item);
        }

        if (guestRefs.length > 0) {
          const mergedData = await api.saveFavorites([...merged.values()]);
          applyItems(mergedData.items);
          writeGuestFavorites([]);
        } else {
          applyItems(serverData.items);
        }
      } catch {
        if (!cancelled) applyItems([]);
      } finally {
        syncingRef.current = false;
        if (!cancelled) setIsLoading(false);
      }
    };

    void syncOnLogin();

    return () => {
      cancelled = true;
    };
  }, [applyItems, user?.id]);

  const isFavorite = useCallback(
    (product: Product) => {
      if (!product.category) return false;
      return favoriteKeysRef.current.has(favoriteKey(product.id, product.category));
    },
    [items]
  );

  const toggleFavorite = useCallback(
    async (product: Product) => {
      if (!product.category) return false;

      if (!user) {
        const guestRefs = readGuestFavorites();
        const key = favoriteKey(product.id, product.category);
        const exists = guestRefs.some(
          (item) => favoriteKey(item.productId, item.category) === key
        );
        const nextRefs = exists
          ? guestRefs.filter((item) => favoriteKey(item.productId, item.category) !== key)
          : [
              { productId: product.id, category: product.category, addedAt: new Date().toISOString() },
              ...guestRefs,
            ];
        writeGuestFavorites(nextRefs);
        const hydrated = await hydrateGuestFavorites(nextRefs);
        applyItems(hydrated);
        return !exists;
      }

      const data = await api.toggleFavorite(product.id, product.category);
      applyItems(data.items);
      return Boolean(data.added);
    },
    [applyItems, user]
  );

  const removeFavorite = useCallback(
    async (productId: string, category: string) => {
      if (!user) {
        const guestRefs = readGuestFavorites().filter(
          (item) => favoriteKey(item.productId, item.category) !== favoriteKey(productId, category)
        );
        writeGuestFavorites(guestRefs);
        const hydrated = await hydrateGuestFavorites(guestRefs);
        applyItems(hydrated);
        return;
      }

      const data = await api.removeFavorite(productId, category);
      applyItems(data.items);
    },
    [applyItems, user]
  );

  const value = useMemo(
    () => ({
      items,
      isLoading,
      isFavorite,
      toggleFavorite,
      removeFavorite,
      refreshFavorites,
    }),
    [items, isLoading, isFavorite, toggleFavorite, removeFavorite, refreshFavorites]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within FavoritesProvider');
  }
  return context;
}
