import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Product, SupportThread } from '../types';

export interface ProductSupportPayload {
  orderId: string;
  product: Product;
}

interface SupportChatContextValue {
  isOpen: boolean;
  activeThreadId: string | null;
  productContext: ProductSupportPayload | null;
  openGeneralSupport: () => void;
  openProductSupport: (payload: ProductSupportPayload) => void;
  openThreadSupport: (threadId: string) => void;
  closeSupport: () => void;
  setActiveThread: (thread: SupportThread | null) => void;
}

const SupportChatContext = createContext<SupportChatContextValue | null>(null);

export function SupportChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [productContext, setProductContext] = useState<ProductSupportPayload | null>(null);

  const openGeneralSupport = useCallback(() => {
    setProductContext(null);
    setActiveThreadId(null);
    setIsOpen(true);
  }, []);

  const openProductSupport = useCallback((payload: ProductSupportPayload) => {
    setProductContext(payload);
    setActiveThreadId(null);
    setIsOpen(true);
  }, []);

  const openThreadSupport = useCallback((threadId: string) => {
    setProductContext(null);
    setActiveThreadId(threadId);
    setIsOpen(true);
  }, []);

  const closeSupport = useCallback(() => {
    setIsOpen(false);
    setProductContext(null);
    setActiveThreadId(null);
  }, []);

  const setActiveThread = useCallback((thread: SupportThread | null) => {
    setActiveThreadId(thread?.id ?? null);
  }, []);

  return (
    <SupportChatContext.Provider
      value={{
        isOpen,
        activeThreadId,
        productContext,
        openGeneralSupport,
        openProductSupport,
        openThreadSupport,
        closeSupport,
        setActiveThread,
      }}
    >
      {children}
    </SupportChatContext.Provider>
  );
}

export function useSupportChat() {
  const ctx = useContext(SupportChatContext);
  if (!ctx) throw new Error('useSupportChat must be used within SupportChatProvider');
  return ctx;
}
