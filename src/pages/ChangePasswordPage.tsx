import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ChangePasswordSection } from '../components/ChangePasswordSection';
import { useCredentialsEntry } from '../hooks/useCredentialsEntry';
import { useRequiredAccountSession } from '../hooks/useRequiredAccountSession';
import { useAuth } from '../context/AuthContext';
import { getAccountFromSearchParams } from '../utils/accountSession';

export function ChangePasswordPage() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const accountEmail = getAccountFromSearchParams(searchParams);
  const { ready: entryReady, isEntering, error: entryError, hasEntry } = useCredentialsEntry();
  const returnPath = useMemo(() => {
    const next = new URLSearchParams(searchParams);
    return `/profile/change-password?${next.toString()}`;
  }, [searchParams]);

  const { isReady, isLoading, targetEmail } = useRequiredAccountSession({
    accountEmail,
    returnPath,
    enabled: Boolean(accountEmail) && !hasEntry,
  });

  if (hasEntry) {
    if (isEntering || !entryReady) {
      return (
        <div className="profile-page change-password-page">
          <p className="profile-page__loading mono">Входим в аккаунт...</p>
        </div>
      );
    }
    if (entryError) {
      return (
        <div className="profile-page change-password-page">
          <p className="profile-page__message">{entryError}</p>
          <Link to="/profile" className="profile-page__back-link">
            Вернуться в профиль
          </Link>
        </div>
      );
    }
    return <ChangePasswordLegacyPage />;
  }

  if (!accountEmail) {
    return <ChangePasswordLegacyPage />;
  }

  if (isLoading || !isReady) {
    return (
      <div className="profile-page change-password-page">
        <p className="profile-page__loading mono">LOADING...</p>
      </div>
    );
  }

  return (
    <div className="profile-page change-password-page">
      <div className="profile-page__header">
        <Link to="/profile" className="profile-page__back" aria-label="Назад в профиль">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="title-with-code">
          <span className="title-code">&lt;/&gt;</span>
          <span>СМЕНА ПАРОЛЯ</span>
        </h1>
      </div>

      <ChangePasswordSection
        email={targetEmail}
        onCancel={() => navigate('/profile')}
        onSuccess={() => {
          void refreshUser();
          navigate('/profile?password=changed', { replace: true });
        }}
      />
    </div>
  );
}

function ChangePasswordLegacyPage() {
  const { user, isLoading, refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/profile', { replace: true });
    }
  }, [isLoading, navigate, user]);

  useEffect(() => {
    if (!isLoading && user && !user.email) {
      navigate('/profile', { replace: true });
    }
  }, [isLoading, navigate, user]);

  if (isLoading || !user?.email) {
    return (
      <div className="profile-page change-password-page">
        <p className="profile-page__loading mono">LOADING...</p>
      </div>
    );
  }

  return (
    <div className="profile-page change-password-page">
      <div className="profile-page__header">
        <Link to="/profile" className="profile-page__back" aria-label="Назад в профиль">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="title-with-code">
          <span className="title-code">&lt;/&gt;</span>
          <span>СМЕНА ПАРОЛЯ</span>
        </h1>
      </div>

      <ChangePasswordSection
        email={user.email}
        onCancel={() => navigate('/profile')}
        onSuccess={() => {
          void refreshUser();
          navigate('/profile?password=changed', { replace: true });
        }}
      />
    </div>
  );
}
