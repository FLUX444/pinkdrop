import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  accountEmailsMatch,
  buildSignInPath,
  normalizeAccountEmail,
} from '../utils/accountSession';

type Options = {
  accountEmail: string;
  returnPath?: string;
  enabled?: boolean;
};

export function useRequiredAccountSession({
  accountEmail,
  returnPath = '',
  enabled = true,
}: Options) {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);

  const normalizedAccount = normalizeAccountEmail(accountEmail);
  const isEnabled = enabled && Boolean(normalizedAccount);
  const isReady = Boolean(
    user?.email && accountEmailsMatch(user.email, normalizedAccount)
  );

  useEffect(() => {
    if (!isEnabled || isLoading) return;

    if (!user) {
      navigate(buildSignInPath(normalizedAccount, returnPath || undefined), { replace: true });
      return;
    }

    if (!user.email) {
      navigate(buildSignInPath(normalizedAccount, returnPath || undefined), { replace: true });
      return;
    }

    if (accountEmailsMatch(user.email, normalizedAccount)) {
      return;
    }

    setSwitching(true);
    void logout()
      .then(() => {
        navigate(buildSignInPath(normalizedAccount, returnPath || undefined), { replace: true });
      })
      .finally(() => {
        setSwitching(false);
      });
  }, [isEnabled, isLoading, logout, navigate, normalizedAccount, returnPath, user]);

  return {
    isReady,
    isLoading: isLoading || switching,
    targetEmail: normalizedAccount || user?.email || '',
  };
}
