import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AdminLayout } from '../components/AdminLayout';
import { AdminLoginScreen } from '../components/AdminLoginScreen';
import { DEFAULT_ABOUT } from '../data/about';
import type { AboutConfig } from '../types';
import { useOperatorAuth } from '../hooks/useOperatorAuth';

export function AdminAboutPage() {
  const auth = useOperatorAuth({ adminOnly: true });
  const [about, setAbout] = useState<AboutConfig>(DEFAULT_ABOUT);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pageError, setPageError] = useState('');

  useEffect(() => {
    if (!auth.authenticated) return;
    api
      .getAdminAbout()
      .then((data) => setAbout(data.about))
      .catch(() => setAbout(DEFAULT_ABOUT));
  }, [auth.authenticated]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setPageError('');
    setBusy(true);
    try {
      const data = await api.updateAdminAbout(about);
      setAbout(data.about);
      setSaved(true);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  if (auth.loading) {
    return <p className="admin-page__loading mono">LOADING...</p>;
  }

  if (!auth.configured) {
    return <p className="admin-page__loading">Админка не настроена</p>;
  }

  if (!auth.authenticated) {
    return (
      <AdminLoginScreen
        error={auth.error}
        password={auth.password}
        onPasswordChange={auth.setPassword}
        onSubmit={auth.handleLogin}
        busy={auth.loginBusy}
      />
    );
  }

  return (
    <AdminLayout title="О компании" tag="ABOUT_EDITOR" onLogout={() => void auth.handleLogout()}>
      <form className="admin-about" onSubmit={handleSave}>
        <div className="admin-about__grid">
          <label className="admin-about__field">
            <span className="mono">ABOUT_PINKDROP</span>
            <textarea
              value={about.aboutPinkdrop}
              onChange={(event) => {
                setAbout((current) => ({ ...current, aboutPinkdrop: event.target.value }));
                setSaved(false);
              }}
              rows={12}
              placeholder="Текст блока о магазине"
            />
            <span className="admin-about__hint">Абзацы разделяйте пустой строкой.</span>
          </label>

          <label className="admin-about__field">
            <span className="mono">ABOUT_PINKDROP_TEAM</span>
            <textarea
              value={about.aboutPinkdropTeam}
              onChange={(event) => {
                setAbout((current) => ({ ...current, aboutPinkdropTeam: event.target.value }));
                setSaved(false);
              }}
              rows={12}
              placeholder="Текст блока о команде"
            />
            <span className="admin-about__hint">Абзацы разделяйте пустой строкой.</span>
          </label>
        </div>

        <div className="admin-about__actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Сохраняем...' : 'Сохранить'}
          </button>
          {saved && <span className="admin-about__saved">Сохранено</span>}
        </div>

        {pageError && <p className="admin-page__error">{pageError}</p>}
      </form>
    </AdminLayout>
  );
}
