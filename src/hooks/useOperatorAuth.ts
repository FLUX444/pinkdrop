import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { OperatorRole } from '../types';

interface UseOperatorAuthOptions {
  adminOnly?: boolean;
  onAuthenticated?: () => void | Promise<void>;
}

export function useOperatorAuth(options: UseOperatorAuthOptions = {}) {
  const navigate = useNavigate();
  const onAuthenticatedRef = useRef(options.onAuthenticated);
  onAuthenticatedRef.current = options.onAuthenticated;

  const [configured, setConfigured] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [role, setRole] = useState<OperatorRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const applyStatus = useCallback(
    async (status: Awaited<ReturnType<typeof api.getAdminStatus>>) => {
      setConfigured(status.configured);
      setAllowed(status.allowed);
      setAuthenticated(status.authenticated);
      setRole(status.role ?? null);

      if (status.authenticated && options.adminOnly && status.role === 'support') {
        navigate('/admin/support', { replace: true });
        return;
      }

      if (status.authenticated && onAuthenticatedRef.current) {
        await onAuthenticatedRef.current();
      }
    },
    [navigate, options.adminOnly]
  );

  useEffect(() => {
    api
      .getAdminStatus()
      .then((status) => applyStatus(status))
      .catch(() => setConfigured(false))
      .finally(() => setLoading(false));
  }, [applyStatus]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoginBusy(true);
    try {
      const result = await api.adminLogin(password);
      setPassword('');
      const status = await api.getAdminStatus();
      await applyStatus(status);
      if (status.authenticated) {
        setAuthenticated(true);
        if (result.role === 'support' || status.role === 'support') {
          navigate('/admin/support', { replace: true });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    await api.adminLogout();
    setAuthenticated(false);
    setRole(null);
  };

  return {
    configured,
    allowed,
    authenticated,
    role,
    loading,
    password,
    error,
    loginBusy,
    setPassword,
    setError,
    handleLogin,
    handleLogout,
  };
}
