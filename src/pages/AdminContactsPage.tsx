import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AdminLayout } from '../components/AdminLayout';
import { AdminLoginScreen } from '../components/AdminLoginScreen';
import { DEFAULT_CONTACTS } from '../data/contacts';
import type { ContactsConfig } from '../types';
import { useOperatorAuth } from '../hooks/useOperatorAuth';

export function AdminContactsPage() {
  const auth = useOperatorAuth({ adminOnly: true });
  const [contacts, setContacts] = useState<ContactsConfig>(DEFAULT_CONTACTS);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pageError, setPageError] = useState('');

  useEffect(() => {
    if (!auth.authenticated) return;
    api
      .getAdminContacts()
      .then((data) => setContacts(data.contacts))
      .catch(() => setContacts(DEFAULT_CONTACTS));
  }, [auth.authenticated]);

  const updateField = <K extends keyof ContactsConfig>(key: K, value: ContactsConfig[K]) => {
    setContacts((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setPageError('');
    setBusy(true);
    try {
      const data = await api.updateAdminContacts(contacts);
      setContacts(data.contacts);
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
        password={auth.password}
        error={auth.error}
        busy={auth.loginBusy}
        onPasswordChange={auth.setPassword}
        onSubmit={auth.handleLogin}
      />
    );
  }

  return (
    <AdminLayout
      title="Контакты"
      tag="ADMIN_CONTACTS"
      role={auth.role}
      onLogout={() => void auth.handleLogout()}
    >
      <form className="admin-contacts" onSubmit={(event) => void handleSave(event)}>
        <p className="admin-page__hint">
          Телефон, Telegram и блоки на главной в секции «Контакты». Изменения видны сразу после сохранения.
        </p>

        <div className="admin-contacts__grid">
          <label>
            Телефон (отображение)
            <input
              value={contacts.phoneDisplay}
              onChange={(event) => updateField('phoneDisplay', event.target.value)}
            />
          </label>
          <label>
            Телефон (для звонка)
            <input
              value={contacts.phoneHref}
              onChange={(event) => updateField('phoneHref', event.target.value)}
              placeholder="+73912223344"
            />
          </label>
          <label>
            Telegram username
            <input
              value={contacts.telegramUsername}
              onChange={(event) => updateField('telegramUsername', event.target.value)}
              placeholder="krasnoyarsk_shop_bot"
            />
          </label>
          <label>
            Telegram URL
            <input
              value={contacts.telegramUrl}
              onChange={(event) => updateField('telegramUrl', event.target.value)}
              placeholder="https://t.me/krasnoyarsk_shop_bot"
            />
          </label>
          <label className="admin-contacts__wide">
            Зона доставки
            <textarea
              rows={2}
              value={contacts.deliveryZone}
              onChange={(event) => updateField('deliveryZone', event.target.value)}
            />
          </label>
          <label>
            График — строка 1
            <input
              value={contacts.scheduleLine1}
              onChange={(event) => updateField('scheduleLine1', event.target.value)}
            />
          </label>
          <label>
            График — строка 2
            <input
              value={contacts.scheduleLine2}
              onChange={(event) => updateField('scheduleLine2', event.target.value)}
            />
          </label>
        </div>

        {pageError && <p className="admin-page__error">{pageError}</p>}
        {saved && <p className="admin-contacts__saved">Сохранено</p>}

        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Сохраняем...' : 'Сохранить контакты'}
        </button>
      </form>
    </AdminLayout>
  );
}
