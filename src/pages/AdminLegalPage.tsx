import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { AdminLayout } from '../components/AdminLayout';
import { AdminLoginScreen } from '../components/AdminLoginScreen';
import { LegalPageView } from '../components/LegalPageView';
import type { LegalPageContent } from '../types';

type LegalSlug = 'privacy' | 'terms';

const TABS: { slug: LegalSlug; label: string }[] = [
  { slug: 'privacy', label: 'Политика конфиденциальности' },
  { slug: 'terms', label: 'Пользовательское соглашение' },
];

function emptyPage(slug: LegalSlug): LegalPageContent {
  return {
    slug,
    tag: slug === 'privacy' ? 'PRIVACY_POLICY' : 'TERMS_OF_USE',
    title: '',
    subtitle: '',
    contentHtml: '',
    updatedAt: '',
  };
}

export function AdminLegalPage() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSlug, setActiveSlug] = useState<LegalSlug>('privacy');
  const [pages, setPages] = useState<Record<LegalSlug, LegalPageContent>>({
    privacy: emptyPage('privacy'),
    terms: emptyPage('terms'),
  });

  const activePage = pages[activeSlug];

  useEffect(() => {
    api
      .getAdminStatus()
      .then(async (status) => {
        setAuthenticated(status.authenticated);
        if (status.authenticated) {
          const data = await api.getAdminLegalPages();
          const next: Record<LegalSlug, LegalPageContent> = {
            privacy: emptyPage('privacy'),
            terms: emptyPage('terms'),
          };
          for (const page of data.pages) {
            if (page.slug === 'privacy' || page.slug === 'terms') {
              next[page.slug] = page;
            }
          }
          setPages(next);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const previewPage = useMemo(
    () => ({
      ...activePage,
      tag: activePage.tag.trim() || (activeSlug === 'privacy' ? 'PRIVACY_POLICY' : 'TERMS_OF_USE'),
      title: activePage.title.trim() || 'Заголовок документа',
      subtitle: activePage.subtitle.trim() || 'Подзаголовок',
      contentHtml: activePage.contentHtml.trim() || '<section><p>Текст документа</p></section>',
    }),
    [activePage, activeSlug]
  );

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoginBusy(true);
    try {
      await api.adminLogin(password);
      setPassword('');
      const data = await api.getAdminLegalPages();
      const next: Record<LegalSlug, LegalPageContent> = {
        privacy: emptyPage('privacy'),
        terms: emptyPage('terms'),
      };
      for (const page of data.pages) {
        if (page.slug === 'privacy' || page.slug === 'terms') {
          next[page.slug] = page;
        }
      }
      setPages(next);
      setAuthenticated(true);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Неверный пароль');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    await api.adminLogout();
    setAuthenticated(false);
  };

  const updateField = <K extends keyof LegalPageContent>(field: K, value: LegalPageContent[K]) => {
    setPages((current) => ({
      ...current,
      [activeSlug]: {
        ...current[activeSlug],
        [field]: value,
      },
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const payload = pages[activeSlug];
      const data = await api.updateAdminLegalPage(activeSlug, {
        tag: payload.tag,
        title: payload.title,
        subtitle: payload.subtitle,
        contentHtml: payload.contentHtml,
      });
      setPages((current) => ({
        ...current,
        [activeSlug]: data.page,
      }));
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="admin-page admin-page--loading">Загрузка...</div>;
  }

  if (!authenticated) {
    return (
      <AdminLoginScreen
        error={error}
        password={password}
        onPasswordChange={(value) => {
          setError('');
          setPassword(value);
        }}
        onSubmit={handleLogin}
        busy={loginBusy}
      />
    );
  }

  return (
    <AdminLayout title="Юридические страницы" tag="ADMIN_LEGAL" onLogout={() => void handleLogout()}>
      <div className="admin-legal">
        <div className="admin-legal__tabs">
          {TABS.map((tab) => (
            <button
              key={tab.slug}
              type="button"
              className={activeSlug === tab.slug ? 'is-active' : ''}
              onClick={() => {
                setActiveSlug(tab.slug);
                setSaved(false);
                setError('');
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="admin-legal__grid">
          <section className="admin-card admin-legal__editor">
            <h2>Редактирование</h2>
            <p className="admin-legal__hint">
              Можно менять заголовки и основной текст. Для списков и разделов используйте HTML:
              <code>&lt;section&gt;</code>, <code>&lt;h2&gt;</code>, <code>&lt;p&gt;</code>,{' '}
              <code>&lt;ul&gt;</code>, <code>&lt;li&gt;</code>, <code>&lt;a href=&quot;...&quot;&gt;</code>.
            </p>

            <label className="admin-field">
              <span>Тег</span>
              <input
                value={activePage.tag}
                onChange={(event) => updateField('tag', event.target.value)}
                placeholder="PRIVACY_POLICY"
              />
            </label>

            <label className="admin-field">
              <span>Заголовок страницы</span>
              <input
                value={activePage.title}
                onChange={(event) => updateField('title', event.target.value)}
                placeholder="Политика конфиденциальности"
              />
            </label>

            <label className="admin-field">
              <span>Подзаголовок</span>
              <input
                value={activePage.subtitle}
                onChange={(event) => updateField('subtitle', event.target.value)}
                placeholder="Действует с 11 июня 2026 г. · PinkDrop"
              />
            </label>

            <label className="admin-field">
              <span>Текст документа (HTML)</span>
              <textarea
                className="admin-legal__textarea"
                value={activePage.contentHtml}
                onChange={(event) => updateField('contentHtml', event.target.value)}
                rows={22}
                spellCheck
              />
            </label>

            {error && <p className="admin-form__error">{error}</p>}
            {saved && <p className="admin-form__success">Сохранено</p>}

            <div className="admin-legal__actions">
              <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void handleSave()}>
                {busy ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          </section>

          <section className="admin-card admin-legal__preview">
            <h2>Предпросмотр</h2>
            <div className="admin-legal__preview-frame">
              <LegalPageView page={previewPage} showBackLink={false} />
            </div>
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
