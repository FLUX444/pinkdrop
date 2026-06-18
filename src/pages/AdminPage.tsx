import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useAppDialog } from '../context/AppDialogContext';
import { AdminLayout } from '../components/AdminLayout';
import { AdminLoginScreen } from '../components/AdminLoginScreen';
import { formatPrice } from '../utils/formatPrice';
import type { Product } from '../types';

function AdminBasePriceInput({
  product,
  disabled,
  onSaved,
  onError,
}: {
  product: Product;
  disabled: boolean;
  onSaved: (product: Product) => void;
  onError: (message: string) => void;
}) {
  const drop = product.priceDrop;
  const storedBase = drop?.basePrice ?? product.price;

  const [value, setValue] = useState(String(storedBase));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(String(storedBase));
  }, [storedBase, product.id]);

  const save = async () => {
    if (!product.category) return;

    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setValue(String(storedBase));
      onError('Укажите корректную цену');
      return;
    }

    if (parsed === storedBase) return;

    setSaving(true);
    onError('');
    try {
      const data = await api.updateAdminProductBasePrice(product.category, product.id, parsed);
      onSaved(data.product);
    } catch (err) {
      setValue(String(storedBase));
      onError(err instanceof Error ? err.message : 'Не удалось обновить цену');
    } finally {
      setSaving(false);
    }
  };

  return (
    <input
      type="number"
      min={1}
      className="admin-table__price-input"
      value={value}
      disabled={disabled || saving}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => void save()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
      }}
      aria-label={`Исходная цена ${product.name}`}
    />
  );
}

export function AdminPage() {
  const { confirm } = useAppDialog();
  const navigate = useNavigate();
  const [configured, setConfigured] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [busyId, setBusyId] = useState('');

  const loadProducts = async () => {
    const data = await api.getAdminProducts();
    setProducts(data.products);
  };

  useEffect(() => {
    api
      .getAdminStatus()
      .then(async (status) => {
        setConfigured(status.configured);
        if (status.role === 'support' && status.allowed) {
          navigate('/admin/support', { replace: true });
          return;
        }
        setAuthenticated(status.authenticated);
        if (status.authenticated) {
          await loadProducts();
        }
      })
      .catch(() => setConfigured(false))
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoginBusy(true);
    try {
      await api.adminLogin(password);
      setPassword('');
      await loadProducts();
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
    setProducts([]);
  };

  const updateDrop = async (product: Product, enabled: boolean) => {
    if (!product.category) return;
    const key = `${product.category}:${product.id}`;
    setBusyId(key);
    try {
      const data = await api.updateAdminPriceDrop(product.category, product.id, {
        enabled,
        basePrice: product.price,
      });
      setProducts((items) =>
        items.map((item) => (item.id === product.id ? data.product : item))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить товар');
    } finally {
      setBusyId('');
    }
  };

  const deleteProduct = async (product: Product) => {
    if (!product.category) return;
    const confirmed = await confirm({
      title: 'Удалить товар',
      message: `Удалить «${product.name}»? Товар будет удалён из базы данных, с сайта, из корзин и промптов отзывов.`,
      confirmLabel: 'Удалить',
      variant: 'danger',
    });
    if (!confirmed) return;

    const key = `${product.category}:${product.id}`;
    setBusyId(key);
    setError('');
    try {
      await api.deleteAdminProduct(product.category, product.id);
      setProducts((items) => items.filter((item) => item.id !== product.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить товар');
    } finally {
      setBusyId('');
    }
  };

  const resetDrop = async (product: Product) => {
    if (!product.category) return;
    const key = `${product.category}:${product.id}`;
    setBusyId(key);
    try {
      const data = await api.resetAdminPriceDrop(product.category, product.id);
      setProducts((items) =>
        items.map((item) => (item.id === product.id ? data.product : item))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сбросить цену');
    } finally {
      setBusyId('');
    }
  };

  if (loading) {
    return <div className="admin-page"><p className="mono">LOADING_ADMIN...</p></div>;
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
    <AdminLayout title="Автоснижение цен" tag="PRICE_DROP_CONTROL" onLogout={() => void handleLogout()}>
      <p className="admin-page__hint">
        Цена падает каждые 2 часа на 1% от исходной. Максимум −28%, затем цена сбрасывается.
        Меняйте исходную цену прямо в таблице или в карточке товара — скидка, таймер и база обновятся
        автоматически. Вкл/выкл нужен только чтобы полностью отключить автоснижение.
      </p>

      {error && <p className="admin-page__error">{error}</p>}

      <div className="admin-table-wrap">
        <table className="admin-table admin-table--prices">
          <colgroup>
            <col className="admin-table__col-product" />
            <col className="admin-table__col-price" />
            <col className="admin-table__col-price" />
            <col className="admin-table__col-discount" />
            <col className="admin-table__col-step" />
            <col className="admin-table__col-action" />
            <col className="admin-table__col-action" />
            <col className="admin-table__col-action" />
            <col className="admin-table__col-action" />
          </colgroup>
          <thead>
            <tr>
              <th>Товар</th>
              <th className="admin-table__cell-num">Исходная</th>
              <th className="admin-table__cell-num">Текущая</th>
              <th className="admin-table__cell-center">Скидка</th>
              <th className="admin-table__cell-step">След. шаг</th>
              <th className="admin-table__cell-center">Автоснижение</th>
              <th className="admin-table__cell-center">Сброс</th>
              <th className="admin-table__cell-center">Изменить</th>
              <th className="admin-table__cell-center">Удалить</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const drop = product.priceDrop;
              const key = `${product.category}:${product.id}`;
              const nextDrop = drop?.nextDropAt
                ? new Date(drop.nextDropAt).toLocaleString('ru-RU')
                : drop?.enabled
                  ? '—'
                  : 'выкл';

              return (
                <tr key={key}>
                  <td>
                    <strong>{product.name}</strong>
                    <span className="admin-table__meta mono">{product.category}</span>
                  </td>
                  <td className="admin-table__cell-num">
                    <AdminBasePriceInput
                      product={product}
                      disabled={busyId === key}
                      onSaved={(nextProduct) => {
                        setProducts((items) =>
                          items.map((item) => (item.id === nextProduct.id ? nextProduct : item))
                        );
                      }}
                      onError={setError}
                    />
                  </td>
                  <td className="admin-table__cell-num">{formatPrice(product.price)}</td>
                  <td className="admin-table__cell-center">
                    {drop?.enabled ? `−${drop.discountPercent}%` : '0%'}
                  </td>
                  <td className="admin-table__cell-step">{nextDrop}</td>
                  <td className="admin-table__cell-center">
                    <button
                      type="button"
                      className={`admin-toggle${drop?.enabled ? ' is-on' : ''}`}
                      disabled={busyId === key}
                      onClick={() => void updateDrop(product, !drop?.enabled)}
                    >
                      {drop?.enabled ? 'Вкл' : 'Выкл'}
                    </button>
                  </td>
                  <td className="admin-table__cell-center">
                    <button
                      type="button"
                      className="admin-reset"
                      disabled={busyId === key || !drop?.enabled}
                      onClick={() => void resetDrop(product)}
                    >
                      <RefreshCw size={16} />
                      Сброс
                    </button>
                  </td>
                  <td className="admin-table__cell-center">
                    <Link
                      to={`/admin/products/${product.category}/${product.id}/edit`}
                      className="admin-edit"
                      aria-label={`Изменить ${product.name}`}
                    >
                      <Pencil size={16} />
                    </Link>
                  </td>
                  <td className="admin-table__cell-center">
                    <button
                      type="button"
                      className="admin-delete"
                      disabled={busyId === key}
                      onClick={() => void deleteProduct(product)}
                      aria-label={`Удалить ${product.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
