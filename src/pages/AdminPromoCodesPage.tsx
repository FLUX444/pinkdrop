import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, Infinity, Percent, Plus, Sparkles, Tag, Trash2, Users } from 'lucide-react';
import { api } from '../api/client';
import { useAppDialog } from '../context/AppDialogContext';
import { AdminLayout } from '../components/AdminLayout';
import { AdminLoginScreen } from '../components/AdminLoginScreen';
import { NumberInput } from '../components/NumberInput';
import { SelectDropdown } from '../components/SelectDropdown';
import { usePersistedState } from '../hooks/usePersistedState';
import { clearFormDraft } from '../utils/formDraft';
import { formatPrice } from '../utils/formatPrice';
import type { PromoCode } from '../types';

type DurationPreset = '20m' | '1y';
type DurationUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'years';

const DURATION_UNIT_OPTIONS: Array<{ value: DurationUnit; label: string }> = [
  { value: 'seconds', label: 'секунд' },
  { value: 'minutes', label: 'минут' },
  { value: 'hours', label: 'часов' },
  { value: 'days', label: 'дней' },
  { value: 'years', label: 'лет' },
];

const DISCOUNT_TYPE_OPTIONS = [
  { value: 'percent' as const, label: 'Процент %' },
  { value: 'fixed' as const, label: 'Фиксированная ₽' },
];

const DURATION_OPTIONS: Array<{ id: DurationPreset; label: string; hint: string }> = [
  { id: '20m', label: '20 мин', hint: 'быстрая акция' },
  { id: '1y', label: '1 год', hint: 'долгая акция' },
];

function formatRemaining(ms: number) {
  if (ms <= 0) return 'истёк';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 120) return `${seconds} сек`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 120) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} ч`;
  const days = Math.floor(hours / 24);
  if (days < 60) return `${days} дн`;
  return `${Math.floor(days / 30)} мес`;
}

function statusLabel(status: PromoCode['status']) {
  if (status === 'active') return 'Активен';
  if (status === 'expired') return 'Истёк';
  return 'Исчерпан';
}

export function AdminPromoCodesPage() {
  const { confirm } = useAppDialog();
  const [configured, setConfigured] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [creating, setCreating] = useState(false);

  const [code, setCode] = usePersistedState('admin_promo_code', '');
  const [discountType, setDiscountType] = usePersistedState<'percent' | 'fixed'>('admin_promo_discount_type', 'percent');
  const [discountValue, setDiscountValue] = usePersistedState('admin_promo_discount_value', '10');
  const [durationPreset, setDurationPreset] = usePersistedState<DurationPreset>('admin_promo_duration_preset', '20m');
  const [useCustomDuration, setUseCustomDuration] = usePersistedState('admin_promo_use_custom_duration', false);
  const [customDurationValue, setCustomDurationValue] = usePersistedState('admin_promo_custom_duration_value', '7');
  const [customDurationUnit, setCustomDurationUnit] = usePersistedState<DurationUnit>('admin_promo_custom_duration_unit', 'days');
  const [maxUses, setMaxUses] = usePersistedState<'unlimited' | '1' | '5' | '10' | '100'>('admin_promo_max_uses', 'unlimited');
  const [useCustomMaxUses, setUseCustomMaxUses] = usePersistedState('admin_promo_use_custom_max_uses', false);
  const [customMaxUses, setCustomMaxUses] = usePersistedState('admin_promo_custom_max_uses', '50');

  const loadPromoCodes = async () => {
    const data = await api.getAdminPromoCodes();
    setPromoCodes(data.promoCodes);
  };

  useEffect(() => {
    api
      .getAdminStatus()
      .then(async (status) => {
        setConfigured(status.configured);
        setAuthenticated(status.authenticated);
        if (status.authenticated) {
          await loadPromoCodes();
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить админку');
      })
      .finally(() => setLoading(false));
  }, []);

  const activeCount = useMemo(
    () => promoCodes.filter((promo) => promo.status === 'active').length,
    [promoCodes]
  );

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoginBusy(true);
    try {
      await api.adminLogin(password);
      setPassword('');
      await loadPromoCodes();
      setAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    await api.adminLogout();
    setAuthenticated(false);
    setPromoCodes([]);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setCreating(true);
    try {
      const { promo } = await api.createAdminPromoCode({
        code,
        discountType,
        discountValue: Number(discountValue),
        durationPreset: useCustomDuration ? undefined : durationPreset,
        durationValue: useCustomDuration ? Number(customDurationValue) : null,
        durationUnit: useCustomDuration ? customDurationUnit : null,
        maxUses: useCustomMaxUses
          ? Number(customMaxUses)
          : maxUses === 'unlimited'
            ? null
            : Number(maxUses),
      });
      setPromoCodes((items) => [promo, ...items]);
      setCode('');
      clearFormDraft('admin_promo_code');
      setMessage(`Промокод ${promo.code} создан`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать промокод');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (promo: PromoCode) => {
    const confirmed = await confirm({
      title: 'Удалить промокод',
      message: `Удалить промокод ${promo.code}?`,
      confirmLabel: 'Удалить',
      variant: 'danger',
    });
    if (!confirmed) return;
    setBusyId(promo.id);
    setError('');
    try {
      await api.deleteAdminPromoCode(promo.id);
      setPromoCodes((items) => items.filter((item) => item.id !== promo.id));
      setMessage(`Промокод ${promo.code} удалён`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить промокод');
    } finally {
      setBusyId('');
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <p className="mono">LOADING_ADMIN...</p>
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="admin-page">
        <p>Админка не настроена. Добавьте `ADMIN_PASSWORD` в `.env` и перезапустите сервер.</p>
        <Link to="/">На главную</Link>
      </div>
    );
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
    <AdminLayout title="Промокоды" tag="PROMO_CODES" onLogout={() => void handleLogout()}>
      <div className="admin-promo__stats">
        <div className="admin-promo__stat">
          <Sparkles size={18} />
          <span>Активных</span>
          <strong>{activeCount}</strong>
        </div>
        <div className="admin-promo__stat">
          <Tag size={18} />
          <span>Всего</span>
          <strong>{promoCodes.length}</strong>
        </div>
      </div>

      {message && <p className="admin-promo__message">{message}</p>}
      {error && <p className="admin-page__error">{error}</p>}

      <section className="admin-promo__create">
        <div className="admin-promo__create-head">
          <Plus size={20} />
          <h2>Новый промокод</h2>
        </div>

        <form className="admin-promo__form" onSubmit={handleCreate}>
          <label className="admin-promo__field admin-promo__field--wide">
            <span>Код</span>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Например SUMMER20"
              required
              minLength={2}
              maxLength={32}
            />
          </label>

          <div className="admin-promo__field-row">
            <label className="admin-promo__field">
              <span>Тип скидки</span>
              <SelectDropdown
                value={discountType}
                options={DISCOUNT_TYPE_OPTIONS}
                onChange={setDiscountType}
                ariaLabel="Тип скидки"
              />
            </label>
            <label className="admin-promo__field">
              <span>Размер</span>
              <NumberInput
                min={1}
                max={discountType === 'percent' ? 100 : undefined}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                required
              />
            </label>
          </div>

          <div className="admin-promo__field">
            <span>Срок действия</span>
            <div className="admin-promo__option-block">
              <div className={`admin-promo__chips${useCustomDuration ? ' is-muted' : ''}`}>
                {DURATION_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`admin-promo__chip${!useCustomDuration && durationPreset === option.id ? ' is-active' : ''}`}
                    onClick={() => {
                      setUseCustomDuration(false);
                      setDurationPreset(option.id);
                    }}
                    disabled={useCustomDuration}
                  >
                    <Clock3 size={14} />
                    <strong>{option.label}</strong>
                    <em>{option.hint}</em>
                  </button>
                ))}
              </div>

              <div className={`admin-promo__custom-panel${useCustomDuration ? ' is-active' : ''}`}>
                <label className="admin-promo__custom-toggle">
                  <input
                    type="checkbox"
                    checked={useCustomDuration}
                    onChange={(event) => setUseCustomDuration(event.target.checked)}
                  />
                  <span className="admin-promo__custom-toggle__copy">
                    <strong>Свой срок</strong>
                    <em>Укажите длительность вручную</em>
                  </span>
                </label>
                {useCustomDuration && (
                  <div className="admin-promo__custom-row">
                    <NumberInput
                      min={1}
                      value={customDurationValue}
                      onChange={(event) => setCustomDurationValue(event.target.value)}
                      required
                    />
                    <SelectDropdown
                      value={customDurationUnit}
                      options={DURATION_UNIT_OPTIONS}
                      onChange={setCustomDurationUnit}
                      ariaLabel="Единица времени"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="admin-promo__field">
            <span>Лимит использований</span>
            <div className="admin-promo__option-block">
              <div className={`admin-promo__chips${useCustomMaxUses ? ' is-muted' : ''}`}>
                {(['unlimited', '1', '5', '10', '100'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`admin-promo__chip admin-promo__chip--compact${!useCustomMaxUses && maxUses === value ? ' is-active' : ''}`}
                    onClick={() => {
                      setUseCustomMaxUses(false);
                      setMaxUses(value);
                    }}
                    disabled={useCustomMaxUses}
                  >
                    {value === 'unlimited' ? <Infinity size={14} /> : <Users size={14} />}
                    <strong>{value === 'unlimited' ? 'Без лимита' : `${value} раз`}</strong>
                  </button>
                ))}
              </div>

              <div className={`admin-promo__custom-panel${useCustomMaxUses ? ' is-active' : ''}`}>
                <label className="admin-promo__custom-toggle">
                  <input
                    type="checkbox"
                    checked={useCustomMaxUses}
                    onChange={(event) => setUseCustomMaxUses(event.target.checked)}
                  />
                  <span className="admin-promo__custom-toggle__copy">
                    <strong>Своё количество</strong>
                    <em>Задайте лимит вручную</em>
                  </span>
                </label>
                {useCustomMaxUses && (
                  <div className="admin-promo__custom-row admin-promo__custom-row--uses">
                    <NumberInput
                      min={1}
                      step={1}
                      value={customMaxUses}
                      onChange={(event) => setCustomMaxUses(event.target.value)}
                      placeholder="Например, 250"
                      required
                    />
                    <span className="admin-promo__custom-suffix">раз</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn--primary admin-promo__submit" disabled={creating}>
            {creating ? 'Создаём...' : 'Создать промокод'}
          </button>
        </form>
      </section>

      <section className="admin-promo__list">
        <h2 className="mono">// АКТИВНЫЕ И АРХИВ</h2>
        {promoCodes.length === 0 ? (
          <p className="admin-promo__empty">Промокодов пока нет — создайте первый выше.</p>
        ) : (
          <div className="admin-promo__grid">
            {promoCodes.map((promo) => (
              <article
                key={promo.id}
                className={`admin-promo__card admin-promo__card--${promo.status}`}
              >
                <div className="admin-promo__card-head">
                  <div>
                    <span className="admin-promo__code">{promo.code}</span>
                    <span className={`admin-promo__badge admin-promo__badge--${promo.status}`}>
                      {statusLabel(promo.status)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="admin-promo__delete"
                    onClick={() => void handleDelete(promo)}
                    disabled={busyId === promo.id}
                    aria-label={`Удалить ${promo.code}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="admin-promo__card-body">
                  <p>
                    <Percent size={14} />
                    {promo.discountType === 'percent'
                      ? `−${promo.discountValue}%`
                      : `−${formatPrice(promo.discountValue)}`}
                  </p>
                  <p>
                    <Clock3 size={14} />
                    {promo.status === 'expired'
                      ? 'Срок истёк'
                      : `Осталось ${formatRemaining(promo.remainingMs)}`}
                  </p>
                  <p>
                    <Users size={14} />
                    {promo.maxUses == null
                      ? `Использований: ${promo.useCount} / ∞`
                      : `Использований: ${promo.useCount} / ${promo.maxUses}`}
                  </p>
                </div>

                <p className="admin-promo__card-foot mono">
                  1 раз на пользователя · до{' '}
                  {new Date(promo.expiresAt).toLocaleString('ru-RU')}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </AdminLayout>
  );
}
