import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Paperclip, UploadCloud, X } from 'lucide-react';
import { api } from '../api/client';
import { AdminLayout } from '../components/AdminLayout';
import { AdminLoginScreen } from '../components/AdminLoginScreen';
import { NumberInput } from '../components/NumberInput';
import { detectCategoryFromName, getCategoryLabel } from '../utils/detectCategory';
import { usePersistedState } from '../hooks/usePersistedState';
import { clearFormDraft } from '../utils/formDraft';

const MAX_PRODUCT_IMAGES = 8;

export function AdminAddProductPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = usePersistedState('admin_add_product_name', '');
  const [price, setPrice] = usePersistedState('admin_add_product_price', '');
  const [oldPrice, setOldPrice] = usePersistedState('admin_add_product_old_price', '');
  const [stock, setStock] = usePersistedState('admin_add_product_stock', '10');
  const [description, setDescription] = usePersistedState('admin_add_product_description', '');
  const [color, setColor] = usePersistedState('admin_add_product_color', '');
  const [material, setMaterial] = usePersistedState('admin_add_product_material', '');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const detectedCategory = useMemo(
    () => (name.trim() ? detectCategoryFromName(name) : null),
    [name]
  );

  useEffect(() => {
    api
      .getAdminStatus()
      .then((status) => {
        setConfigured(status.configured);
        setAuthenticated(status.authenticated);
      })
      .catch(() => setConfigured(false))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const urls = imageFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [imageFiles]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoginBusy(true);
    try {
      await api.adminLogin(password);
      setAuthenticated(true);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    await api.adminLogout();
    setAuthenticated(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!imageFiles.length) {
      setError('Загрузите хотя бы одно изображение товара');
      return;
    }

    setBusy(true);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('price', price);
      formData.append('stock', stock);
      formData.append('description', description.trim());
      if (oldPrice) formData.append('oldPrice', oldPrice);
      if (color.trim()) formData.append('color', color.trim());
      if (material.trim()) formData.append('material', material.trim());
      imageFiles.forEach((file) => formData.append('images', file));

      await api.createAdminProduct(formData);
      clearFormDraft('admin_add_product_name');
      clearFormDraft('admin_add_product_price');
      clearFormDraft('admin_add_product_old_price');
      clearFormDraft('admin_add_product_stock');
      clearFormDraft('admin_add_product_description');
      clearFormDraft('admin_add_product_color');
      clearFormDraft('admin_add_product_material');
      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить товар');
    } finally {
      setBusy(false);
    }
  };

  const appendImageFiles = (files: FileList | File[]) => {
    const nextFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (!nextFiles.length) {
      setError('Можно загрузить только изображения');
      return;
    }

    setError('');
    setImageFiles((current) => {
      const merged = [...current, ...nextFiles];
      if (merged.length > MAX_PRODUCT_IMAGES) {
        setError(`Можно загрузить не больше ${MAX_PRODUCT_IMAGES} фото`);
        return merged.slice(0, MAX_PRODUCT_IMAGES);
      }
      return merged;
    });
  };

  const removeImageFile = (index: number) => {
    setImageFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (event.dataTransfer.files?.length) {
      appendImageFiles(event.dataTransfer.files);
    }
  };

  if (loading) {
    return <div className="admin-page"><p className="mono">LOADING_ADMIN...</p></div>;
  }

  if (!configured) {
    return (
      <div className="admin-page">
        <p>Админка не настроена. Добавьте `ADMIN_PASSWORD` в `.env`.</p>
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
    <AdminLayout title="Новый товар" tag="PRODUCT_CREATE" onLogout={() => void handleLogout()}>
      <p className="admin-page__hint">
        Категория определяется автоматически по названию. Можно загрузить до {MAX_PRODUCT_IMAGES} фото
        с разных ракурсов — на странице товара они переключаются с тем же оформлением.
      </p>

      <form className="admin-form" onSubmit={handleSubmit}>
        <label className="admin-form__field">
          Название *
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Например: Кольцо с кристаллом"
            required
          />
          {detectedCategory && (
            <span className="admin-form__hint mono">
              Категория: {getCategoryLabel(detectedCategory)} ({detectedCategory})
            </span>
          )}
        </label>

        <div className="admin-form__row">
          <label className="admin-form__field">
            Цена, ₽ *
            <NumberInput
              min="0"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              required
            />
          </label>
          <label className="admin-form__field">
            Старая цена, ₽
            <NumberInput
              min="0"
              value={oldPrice}
              onChange={(event) => setOldPrice(event.target.value)}
            />
          </label>
          <label className="admin-form__field">
            В наличии, шт *
            <NumberInput
              min="0"
              value={stock}
              onChange={(event) => setStock(event.target.value)}
              required
            />
          </label>
        </div>

        <label className="admin-form__field">
          Описание *
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            required
          />
        </label>

        <div className="admin-form__row">
          <label className="admin-form__field">
            Цвет
            <input value={color} onChange={(event) => setColor(event.target.value)} />
          </label>
          <label className="admin-form__field">
            Материал
            <input value={material} onChange={(event) => setMaterial(event.target.value)} />
          </label>
        </div>

        <div className="admin-form__field">
          Фотографии товара * ({imageFiles.length}/{MAX_PRODUCT_IMAGES})
          <label
            className={`admin-upload${dragActive ? ' is-dragging' : ''}${imageFiles.length ? ' has-file' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                if (event.target.files?.length) {
                  appendImageFiles(event.target.files);
                }
                event.target.value = '';
              }}
            />
            <span className="admin-upload__icon" aria-hidden>
              {imageFiles.length ? <Paperclip size={22} /> : <UploadCloud size={24} />}
            </span>
            <span className="admin-upload__title">
              {imageFiles.length
                ? `Выбрано фото: ${imageFiles.length}`
                : 'Прикрепите фото товара с разных ракурсов'}
            </span>
            <span className="admin-upload__hint">
              Нажмите или перетащите файлы сюда. Первое фото — главное.
            </span>
          </label>
        </div>

        {previewUrls.length > 0 && (
          <div className="admin-form__preview-grid">
            {previewUrls.map((url, index) => (
              <div key={url} className="admin-form__preview-item">
                <img src={url} alt={`Превью ${index + 1}`} />
                <button
                  type="button"
                  className="admin-form__preview-remove"
                  onClick={() => removeImageFile(index)}
                  aria-label={`Удалить фото ${index + 1}`}
                >
                  <X size={14} />
                </button>
                {index === 0 && <span className="admin-form__preview-badge">Главное</span>}
              </div>
            ))}
          </div>
        )}

        {error && <p className="admin-page__error">{error}</p>}

        <div className="admin-form__actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Сохраняем...' : 'Добавить в каталог'}
          </button>
          <Link to="/" className="btn btn--secondary">На главную</Link>
        </div>
      </form>
    </AdminLayout>
  );
}
