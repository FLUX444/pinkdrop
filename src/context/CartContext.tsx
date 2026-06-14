import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { CartItem, CartNotice, Product } from '../types';
import { api } from '../api/client';
import { useAuth } from './AuthContext';
import { clampProductQuantity, isProductInStock } from '../utils/productStock';

interface CartContextValue {
  items: CartItem[];
  selectedItems: CartItem[];
  selectedProductIds: Set<string>;
  promoCode: string;
  appliedPromoId: string;
  promoDiscount: number;
  promoError: string;
  promoApplying: boolean;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  toggleItemSelected: (productId: string) => void;
  setAllItemsSelected: (selected: boolean) => void;
  isItemSelected: (productId: string) => boolean;
  setPromoCode: (code: string) => void;
  applyPromo: () => Promise<void>;
  clearCart: () => void;
  removeSelectedItems: () => void;
  totalItems: number;
  selectedItemCount: number;
  subtotal: number;
  selectedSubtotal: number;
  total: number;
  selectedTotal: number;
  allItemsSelected: boolean;
  someItemsSelected: boolean;
  cartNotice: CartNotice | null;
  refreshCart: () => Promise<void>;
  clearCartNotice: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const GUEST_CART_KEY = 'pinkdrop_cart';
const CART_SELECTION_KEY = 'pinkdrop_cart_selection';

function readGuestCart(): CartItem[] {
  const saved = localStorage.getItem(GUEST_CART_KEY);
  return saved ? JSON.parse(saved) : [];
}

function writeGuestCart(cart: CartItem[]) {
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
}

function readCartSelection(): Set<string> {
  try {
    const raw = localStorage.getItem(CART_SELECTION_KEY);
    if (!raw) return new Set();
    const ids = JSON.parse(raw);
    return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeCartSelection(ids: Set<string>) {
  localStorage.setItem(CART_SELECTION_KEY, JSON.stringify([...ids]));
}

function normalizeCartItem(item: CartItem): CartItem | null {
  if (!isProductInStock(item.product)) return null;
  const quantity = clampProductQuantity(item.product, item.quantity);
  if (quantity <= 0) return null;
  return { ...item, quantity };
}

function normalizeCart(cart: CartItem[]): CartItem[] {
  return cart.map(normalizeCartItem).filter((item): item is CartItem => item !== null);
}

function mergeCarts(serverCart: CartItem[], localCart: CartItem[]): CartItem[] {
  const merged = [...serverCart];

  for (const localItem of localCart) {
    const existing = merged.find((item) => item.product.id === localItem.product.id);
    if (existing) {
      existing.quantity = clampProductQuantity(
        existing.product,
        Math.max(existing.quantity, localItem.quantity)
      );
    } else {
      merged.push(localItem);
    }
  }

  return normalizeCart(merged);
}

function cartsMatch(left: CartItem[], right: CartItem[]): boolean {
  if (left.length !== right.length) return false;

  return left.every((item) => {
    const other = right.find((candidate) => candidate.product.id === item.product.id);
    return other?.quantity === item.quantity;
  });
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>(() => normalizeCart(readGuestCart()));
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoError, setPromoError] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [appliedPromoId, setAppliedPromoId] = useState('');
  const [promoApplying, setPromoApplying] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(() => readCartSelection());
  const [cartNotice, setCartNotice] = useState<CartNotice | null>(null);
  const loadedUserIdRef = useRef<string | null>(null);
  const addLockRef = useRef<Set<string>>(new Set());
  const previousItemIdsRef = useRef<string[]>([]);
  const cartSaveSeqRef = useRef(0);

  const persistLocal = useCallback((cart: CartItem[]) => {
    const next = normalizeCart(cart);
    writeGuestCart(next);
    setItems(next);
  }, []);

  const persistServer = useCallback(async (cart: CartItem[]) => {
    const next = normalizeCart(cart);
    if (!user) {
      persistLocal(next);
      return;
    }
    const saveSeq = ++cartSaveSeqRef.current;
    try {
      const data = await api.saveCart(next);
      if (saveSeq !== cartSaveSeqRef.current) return;
      const normalized = normalizeCart(data.items);
      setItems(normalized);
      writeGuestCart(normalized);
      if (data.notice) setCartNotice(data.notice);
    } catch {
      if (saveSeq !== cartSaveSeqRef.current) return;
      try {
        const data = await api.getCart();
        if (saveSeq !== cartSaveSeqRef.current) return;
        const normalized = normalizeCart(data.items);
        setItems(normalized);
        writeGuestCart(normalized);
        if (data.notice) setCartNotice(data.notice);
      } catch {
        setItems(next);
      }
    }
  }, [persistLocal, user]);

  const refreshCart = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.getCart();
      const normalized = normalizeCart(data.items);
      setItems(normalized);
      writeGuestCart(normalized);
      if (data.notice) setCartNotice(data.notice);
    } catch {
      // keep current cart
    }
  }, [user]);

  const clearCartNotice = useCallback(() => setCartNotice(null), []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      loadedUserIdRef.current = null;
      setItems(normalizeCart(readGuestCart()));
      return;
    }

    const userId = user.id ?? null;
    if (!userId || loadedUserIdRef.current === userId) return;
    loadedUserIdRef.current = userId;

    const syncCart = async () => {
      const localCart = normalizeCart(readGuestCart());

      try {
        const data = await api.getCart();
        const serverCart = normalizeCart(data.items);
        const merged = mergeCarts(serverCart, localCart);

        if (!cartsMatch(serverCart, merged)) {
          const saved = await api.saveCart(merged);
          const normalized = normalizeCart(saved.items);
          setItems(normalized);
          writeGuestCart(normalized);
          if (saved.notice) setCartNotice(saved.notice);
          return;
        }

        setItems(merged);
        writeGuestCart(merged);
        if (data.notice) setCartNotice(data.notice);
      } catch {
        setItems(localCart);
        writeGuestCart(localCart);
      }
    };

    void syncCart();
  }, [authLoading, user?.id]);

  useEffect(() => {
    writeCartSelection(selectedProductIds);
  }, [selectedProductIds]);

  useEffect(() => {
    setSelectedProductIds((prev) => {
      const validIds = new Set(items.map((item) => item.product.id));
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      if (next.size === prev.size && [...next].every((id) => prev.has(id))) {
        return prev;
      }
      return next;
    });
  }, [items]);

  const commitCart = useCallback(
    (next: CartItem[]) => {
      const normalized = normalizeCart(next);
      setItems(normalized);
      if (user) {
        void persistServer(normalized);
      } else {
        writeGuestCart(normalized);
      }
      return normalized;
    },
    [persistServer, user]
  );

  const addItem = useCallback(
    (product: Product, quantity = 1) => {
      if (!isProductInStock(product)) return;
      if (addLockRef.current.has(product.id)) return;

      addLockRef.current.add(product.id);
      window.setTimeout(() => addLockRef.current.delete(product.id), 350);

      setItems((prev) => {
        const existing = prev.find((item) => item.product.id === product.id);
        const nextQty = existing
          ? clampProductQuantity(product, existing.quantity + quantity)
          : clampProductQuantity(product, quantity);

        if (nextQty <= 0) return prev;

        const next = existing
          ? prev.map((item) =>
              item.product.id === product.id
                ? { ...item, product, quantity: nextQty }
                : item
            )
          : [...prev, { product, quantity: nextQty }];

        if (user) {
          writeGuestCart(next);
          void persistServer(next);
        } else {
          writeGuestCart(next);
        }
        return next;
      });
    },
    [persistServer, user]
  );

  const removeItem = useCallback(
    (productId: string) => {
      setItems((prev) => {
        const next = prev.filter((item) => item.product.id !== productId);
        writeGuestCart(next);
        if (user) void persistServer(next);
        return next;
      });
    },
    [persistServer, user]
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      setItems((prev) => {
        const current = prev.find((item) => item.product.id === productId);
        if (!current) return prev;

        if (quantity < 1) {
          const next = prev.filter((item) => item.product.id !== productId);
          writeGuestCart(next);
          if (user) void persistServer(next);
          return next;
        }

        const nextQty = clampProductQuantity(current.product, quantity);
        const next = prev.map((item) =>
          item.product.id === productId ? { ...item, quantity: nextQty } : item
        );
        writeGuestCart(next);
        if (user) void persistServer(next);
        return next;
      });
    },
    [persistServer, user]
  );

  const selectedItems = useMemo(
    () => items.filter((item) => selectedProductIds.has(item.product.id)),
    [items, selectedProductIds]
  );

  useEffect(() => {
    const currentIds = items.map((item) => item.product.id);
    const previousIds = previousItemIdsRef.current;

    setSelectedProductIds((prev) => {
      const next = new Set<string>();
      for (const id of currentIds) {
        const isNewItem = !previousIds.includes(id);
        if (prev.has(id) || isNewItem) {
          next.add(id);
        }
      }
      return next;
    });

    previousItemIdsRef.current = currentIds;
  }, [items]);

  const refreshAppliedPromo = useCallback(async () => {
    if (!appliedPromo || !user) return;
    try {
      const subtotal = selectedItems.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      );
      const result = await api.validatePromo({ code: appliedPromo, subtotal });
      setPromoDiscount(result.discount);
      setAppliedPromoId(result.promoCodeId);
      setPromoError('');
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : 'Промокод недействителен');
      setPromoDiscount(0);
      setAppliedPromo('');
      setAppliedPromoId('');
    }
  }, [appliedPromo, selectedItems, user]);

  useEffect(() => {
    if (!appliedPromo) return;
    void refreshAppliedPromo();
  }, [appliedPromo, refreshAppliedPromo]);

  const applyPromo = async () => {
    const code = promoCode.trim();
    if (!code) {
      setPromoError('Введите промокод');
      return;
    }
    if (!user) {
      setPromoError('Войдите в аккаунт, чтобы применить промокод');
      return;
    }

    setPromoApplying(true);
    setPromoError('');
    try {
      const subtotal = selectedItems.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      );
      const result = await api.validatePromo({ code, subtotal });
      setAppliedPromo(result.code);
      setAppliedPromoId(result.promoCodeId);
      setPromoDiscount(result.discount);
      setPromoCode(result.code);
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : 'Промокод не найден');
      setPromoDiscount(0);
      setAppliedPromo('');
      setAppliedPromoId('');
    } finally {
      setPromoApplying(false);
    }
  };

  const toggleItemSelected = useCallback((productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }, []);

  const setAllItemsSelected = useCallback(
    (selected: boolean) => {
      setSelectedProductIds(selected ? new Set(items.map((item) => item.product.id)) : new Set());
    },
    [items]
  );

  const isItemSelected = useCallback(
    (productId: string) => selectedProductIds.has(productId),
    [selectedProductIds]
  );

  const removeSelectedItems = useCallback(() => {
    setItems((prev) => {
      const next = prev.filter((item) => !selectedProductIds.has(item.product.id));
      writeGuestCart(next);
      if (user) void persistServer(next);
      return next;
    });
    setSelectedProductIds(new Set());
  }, [persistServer, selectedProductIds, user]);

  const clearCart = () => {
    commitCart([]);
    setPromoCode('');
    setPromoDiscount(0);
    setAppliedPromo('');
    setAppliedPromoId('');
    setPromoError('');
  };

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [items]
  );

  const selectedSubtotal = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [selectedItems]
  );

  const total = Math.max(0, subtotal - promoDiscount);
  const selectedTotal = Math.max(0, selectedSubtotal - promoDiscount);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const selectedItemCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const allItemsSelected = items.length > 0 && items.every((item) => selectedProductIds.has(item.product.id));
  const someItemsSelected = items.some((item) => selectedProductIds.has(item.product.id));

  return (
    <CartContext.Provider
      value={{
        items,
        selectedItems,
        selectedProductIds,
        promoCode,
        appliedPromoId,
        promoDiscount,
        promoError,
        promoApplying,
        addItem,
        removeItem,
        updateQuantity,
        toggleItemSelected,
        setAllItemsSelected,
        isItemSelected,
        setPromoCode,
        applyPromo,
        clearCart,
        removeSelectedItems,
        totalItems,
        selectedItemCount,
        subtotal,
        selectedSubtotal,
        total,
        selectedTotal,
        allItemsSelected,
        someItemsSelected,
        cartNotice,
        refreshCart,
        clearCartNotice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
