import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { api } from '../api/client';
import type { AuthProvidersConfig, ReviewPrompt, User, UserOrder } from '../types';

interface AuthContextValue {
  user: User | null;
  orders: UserOrder[];
  reviewPrompts: ReviewPrompt[];
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authStep: 'phone' | 'code';
  pendingPhone: string;
  authProviders: AuthProvidersConfig | null;
  devCode: string | null;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  sendCode: (payload: {
    phone: string;
    intent: 'login' | 'register';
    password?: string;
    confirmPassword?: string;
  }) => Promise<{ devCode?: string; smsWarning?: string }>;
  verifyCode: (code: string) => Promise<void>;
  sendEmailCode: (payload: {
    email: string;
    password: string;
    confirmPassword?: string;
    intent?: 'login' | 'register';
  }) => Promise<{ devCode?: string; directLogin?: boolean }>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  sendPasswordResetCode: (email: string) => Promise<{ devCode?: string }>;
  verifyPasswordResetCode: (email: string, code: string) => Promise<void>;
  resetPasswordWithCode: (payload: {
    email: string;
    code: string;
    password: string;
    confirmPassword: string;
  }) => Promise<void>;
  confirmTelegramLogin: (code: string) => Promise<void>;
  signInWithPassword: (payload: {
    intent: 'login' | 'register';
    mode: 'phone' | 'email';
    contact: string;
    password: string;
    confirmPassword?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  removeAvatar: () => Promise<void>;
  refreshOrders: () => Promise<void>;
  refreshReviewPrompts: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setReviewPrompts: (prompts: ReviewPrompt[]) => void;
  markReviewPromptSeen: (promptId: string) => Promise<ReviewPrompt[]>;
  addPurchase: (productId: string) => void;
  hasPurchased: (productId: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [reviewPrompts, setReviewPrompts] = useState<ReviewPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authStep, setAuthStep] = useState<'phone' | 'code'>('phone');
  const [pendingPhone, setPendingPhone] = useState('');
  const [authProviders, setAuthProviders] = useState<AuthProvidersConfig | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const lastSessionRefreshRef = useRef(0);
  const bootSessionCheckFailedRef = useRef(false);
  const recentAuthGraceUntilRef = useRef(0);
  const SESSION_REFRESH_COOLDOWN_MS = 12_000;
  const API_READY_MAX_WAIT_MS = 15_000;
  const API_READY_POLL_MS = 400;
  const AUTH_SESSION_GRACE_MS = 15_000;

  const markRecentAuth = () => {
    recentAuthGraceUntilRef.current = Date.now() + AUTH_SESSION_GRACE_MS;
  };

  const applyAuthenticatedUser = async (nextUser: User) => {
    setUser(nextUser);
    markRecentAuth();
    try {
      await Promise.all([refreshOrders(), refreshReviewPrompts()]);
    } catch {
      // Профиль уже известен — не разлогиниваем из-за заказов/отзывов
    }
  };

  const refreshOrders = useCallback(async () => {
    try {
      const data = await api.getOrders();
      setOrders(data.orders);
    } catch {
      setOrders([]);
    }
  }, []);

  const refreshReviewPrompts = useCallback(async () => {
    try {
      const data = await api.getReviewPrompts();
      setReviewPrompts(data.prompts);
    } catch {
      setReviewPrompts([]);
    }
  }, []);

  const refreshUser = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;

    try {
      let me: User | null = null;

      for (let attempt = 0; attempt < 4; attempt += 1) {
        const { user: nextUser } = await api.getMe();
        me = nextUser;
        if (me) break;

        const inGrace = Date.now() < recentAuthGraceUntilRef.current;
        if (!inGrace) break;
        await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
      }

      if (me) {
        setUser(me);
        await Promise.all([refreshOrders(), refreshReviewPrompts()]);
        return;
      }

      if (!force && Date.now() < recentAuthGraceUntilRef.current) {
        return;
      }

      setUser(null);
      setOrders([]);
      setReviewPrompts([]);
    } catch {
      // Не сбрасываем сессию при временных сбоях API — cookie могла остаться валидной
    }
  }, [refreshOrders, refreshReviewPrompts]);

  useEffect(() => {
    let cancelled = false;

    const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

    const waitForApiReady = async () => {
      const deadline = Date.now() + API_READY_MAX_WAIT_MS;
      while (Date.now() < deadline) {
        if (cancelled) return false;
        try {
          const response = await fetch('/api/health', { credentials: 'include' });
          if (response.ok) return true;
        } catch {
          // API ещё не поднялся после перезапуска dev-сервера
        }
        await sleep(API_READY_POLL_MS);
      }
      return false;
    };

    const loadAuthState = async () => {
      bootSessionCheckFailedRef.current = false;
      await waitForApiReady();
      if (cancelled) return;

      let meUser: User | null = null;
      let sessionCheckFailed = false;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          const me = await api.getMe();
          meUser = me.user;
          sessionCheckFailed = false;
          break;
        } catch {
          sessionCheckFailed = true;
          if (attempt < 4) await sleep(500);
        }
      }

      if (sessionCheckFailed) {
        bootSessionCheckFailedRef.current = true;
      }

      if (cancelled) return;

      try {
        const providers = await api.getAuthProviders();
        if (!cancelled) setAuthProviders(providers);
      } catch {
        if (!cancelled) setAuthProviders(null);
      }

      if (cancelled) return;

      setUser(meUser);
      if (meUser) {
        try {
          await Promise.all([refreshOrders(), refreshReviewPrompts()]);
        } catch {
          // Профиль уже известен — не разлогиниваем из-за заказов/отзывов
        }
      } else {
        setOrders([]);
        setReviewPrompts([]);
      }

      if (!cancelled) setIsLoading(false);
    };

    void loadAuthState();

    return () => {
      cancelled = true;
    };
  }, [refreshOrders, refreshReviewPrompts]);

  useEffect(() => {
    if (!bootSessionCheckFailedRef.current || user || isLoading) return;

    let cancelled = false;

    const recoverSession = async () => {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        if (cancelled) return;
        try {
          const response = await fetch('/api/health', { credentials: 'include' });
          if (!response.ok) {
            await new Promise((resolve) => window.setTimeout(resolve, 600));
            continue;
          }
          await refreshUser();
          bootSessionCheckFailedRef.current = false;
          return;
        } catch {
          await new Promise((resolve) => window.setTimeout(resolve, 600));
        }
      }
    };

    void recoverSession();

    return () => {
      cancelled = true;
    };
  }, [user, isLoading, refreshUser]);

  useEffect(() => {
    const restoreSession = () => {
      if (!user && !isLoading) {
        const now = Date.now();
        if (now - lastSessionRefreshRef.current < SESSION_REFRESH_COOLDOWN_MS) return;
        lastSessionRefreshRef.current = now;
        void refreshUser();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') restoreSession();
    };

    window.addEventListener('focus', restoreSession);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', restoreSession);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user, isLoading, refreshUser]);

  const openAuthModal = () => {
    setAuthStep('phone');
    setPendingPhone('');
    setDevCode(null);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => setIsAuthModalOpen(false);

  const sendCode = async (payload: {
    phone: string;
    intent: 'login' | 'register';
    password?: string;
    confirmPassword?: string;
  }) => {
    const result = await api.sendCode(payload);
    setPendingPhone(payload.phone);
    setDevCode(result.devCode ?? null);
    setAuthStep('code');
    return { devCode: result.devCode, smsWarning: result.smsWarning };
  };

  const verifyCode = async (code: string) => {
    const { user: nextUser } = await api.verifyCode(pendingPhone, code);
    setIsAuthModalOpen(false);
    setAuthStep('phone');
    setPendingPhone('');
    setDevCode(null);
    await applyAuthenticatedUser(nextUser);
  };

  const sendEmailCode = async (payload: {
    email: string;
    password: string;
    confirmPassword?: string;
    intent?: 'login' | 'register';
  }) => {
    const result = await api.sendEmailCode(payload);
    if (result.directLogin && result.user) {
      setIsAuthModalOpen(false);
      await applyAuthenticatedUser(result.user);
      return { directLogin: true };
    }
    return { devCode: result.devCode, directLogin: false };
  };

  const verifyEmailCode = async (email: string, code: string) => {
    const { user: nextUser } = await api.verifyEmailCode(email, code);
    setIsAuthModalOpen(false);
    await applyAuthenticatedUser(nextUser);
  };

  const sendPasswordResetCode = async (email: string) => {
    const result = await api.sendPasswordResetCode(email);
    return { devCode: result.devCode };
  };

  const verifyPasswordResetCode = async (email: string, code: string) => {
    await api.verifyPasswordResetCode(email, code);
  };

  const resetPasswordWithCode = async (payload: {
    email: string;
    code: string;
    password: string;
    confirmPassword: string;
  }) => {
    const { user: nextUser } = await api.resetPasswordWithCode(payload);
    setIsAuthModalOpen(false);
    await applyAuthenticatedUser(nextUser);
  };

  const confirmTelegramLogin = async (code: string) => {
    const { user: nextUser } = await api.confirmTelegramLogin(code);
    setIsAuthModalOpen(false);
    await applyAuthenticatedUser(nextUser);
  };

  const signInWithPassword = async (payload: {
    intent: 'login' | 'register';
    mode: 'phone' | 'email';
    contact: string;
    password: string;
    confirmPassword?: string;
  }) => {
    const { user: nextUser } = await api.signInWithPassword(payload);
    setIsAuthModalOpen(false);
    await applyAuthenticatedUser(nextUser);
  };

  const logout = async () => {
    recentAuthGraceUntilRef.current = 0;
    await api.logout();
    setUser(null);
    setOrders([]);
    setReviewPrompts([]);
  };

  const updateName = async (name: string) => {
    const { user: nextUser } = await api.updateProfile(name);
    setUser(nextUser);
  };

  const uploadAvatar = async (file: File) => {
    const { user: nextUser } = await api.uploadAvatar(file);
    setUser(nextUser);
  };

  const removeAvatar = async () => {
    const { user: nextUser } = await api.removeAvatar();
    setUser(nextUser);
  };

  const addPurchase = (productId: string) => {
    if (!user) return;
    setUser({
      ...user,
      purchasedProductIds: [...new Set([...user.purchasedProductIds, productId])],
    });
  };

  const hasPurchased = (productId: string) =>
    user?.purchasedProductIds.includes(productId) ?? false;

  const markReviewPromptSeen = async (promptId: string) => {
    const data = await api.markReviewPromptSeen(promptId);
    setReviewPrompts(data.prompts);
    return data.prompts;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        orders,
        reviewPrompts,
        isLoading,
        isAuthModalOpen,
        authStep,
        pendingPhone,
        authProviders,
        devCode,
        openAuthModal,
        closeAuthModal,
        sendCode,
        verifyCode,
        sendEmailCode,
        verifyEmailCode,
        sendPasswordResetCode,
        verifyPasswordResetCode,
        resetPasswordWithCode,
        confirmTelegramLogin,
        signInWithPassword,
        logout,
        updateName,
        uploadAvatar,
        removeAvatar,
        refreshOrders,
        refreshReviewPrompts,
        refreshUser,
        setReviewPrompts,
        markReviewPromptSeen,
        addPurchase,
        hasPurchased,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
