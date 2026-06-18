import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Paperclip, UploadCloud, X } from 'lucide-react';
import { api } from '../api/client';
import { AdminLayout } from '../components/AdminLayout';
import { AdminLoginScreen } from '../components/AdminLoginScreen';
import { NumberInput } from '../components/NumberInput';
import { getCategoryLabel } from '../utils/detectCategory';
import { calculatePriceDropCurrentPrice } from '../utils/productPriceDrop';
import { formatPrice } from '../utils/formatPrice';
import { clearFormDraft, readFormDraft, writeFormDraft } from '../utils/formDraft';
import type { Product, ProductDbCategory } from '../types';

const MAX_PRODUCT_IMAGES = 8;

type ProductEditDraft = {
  name: string;
  price: string;
  oldPrice: string;
  stock: string;
  description: string;
  color: string;
  material: string;
};

function productEditDraftKey(category: string, id: string) {
  return `admin_edit_product_${category}_${id}`;
}

export function AdminEditProductPage() {
  const navigate = useNavigate();
  const { category = '', id = '' } = useParams<{ category: string; id: string }>();
  const savedDraft =
    category && id ? readFormDraft<ProductEditDraft>(productEditDraftKey(category, id)) : null;

  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formReady, setFormReady] = useState(() => Boolean(savedDraft));

  const [name, setName] = useState(() => savedDraft?.name ?? '');
  const [price, setPrice] = useState(() => savedDraft?.price ?? '');
  const [oldPrice, setOldPrice] = useState(() => savedDraft?.oldPrice ?? '');
  const [stock, setStock] = useState(() => savedDraft?.stock ?? '0');
  const [description, setDescription] = useState(() => savedDraft?.description ?? '');
  const [color, setColor] = useState(() => savedDraft?.color ?? '');
  const [material, setMaterial] = useState(() => savedDraft?.material ?? '');
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [priceDropEnabled, setPriceDropEnabled] = useState(false);
  const [priceDropDiscount, setPriceDropDiscount] = useState(0);

  const previewCurrentPrice =
    priceDropEnabled && price
      ? calculatePriceDropCurrentPrice(Number.parseInt(price, 10) || 0, priceDropDiscount)
      : null;

  const applyProductFields = (product: Product) => {
    const draft =
      category && id ? readFormDraft<ProductEditDraft>(productEditDraftKey(category, id)) : null;

    const editPrice = product.priceDrop?.enabled
      ? (product.priceDrop.basePrice ?? product.price)
      : product.price;

    setName(draft?.name ?? product.name);
    setPrice(draft?.price ?? String(editPrice));
    setOldPrice(draft?.oldPrice ?? (product.oldPrice != null ? String(product.oldPrice) : ''));
    setStock(draft?.stock ?? String(product.stock ?? 0));
    setDescription(draft?.description ?? (product.description ?? ''));
    setColor(draft?.color ?? (product.color ?? ''));
    setMaterial(draft?.material ?? (product.material ?? ''));
    setExistingImages(product.images ?? []);
    setPriceDropEnabled(Boolean(product.priceDrop?.enabled));
    setPriceDropDiscount(product.priceDrop?.discountPercent ?? 0);
    setFormReady(true);
  };

  useEffect(() => {
    if (!category || !id || !formReady) return;

    writeFormDraft<ProductEditDraft>(productEditDraftKey(category, id), {
      name,
      price,
      oldPrice,
      stock,
      description,
      color,
      material,
    });
  }, [category, color, description, formReady, id, material, name, oldPrice, price, stock]);

  useEffect(() => {
    api
      .getAdminStatus()
      .then(async (status) => {
        setConfigured(status.configured);
        if (status.authenticated && category && id) {
          const data = await api.getAdminProduct(category, id);
          applyProductFields(data.product);
        }
        setAuthenticated(status.authenticated);
      })
      .catch(() => setConfigured(false))
      .finally(() => setLoading(false));
  }, [category, id]);

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
      setPassword('');
      if (category && id) {
        const data = await api.getAdminProduct(category, id);
        applyProductFields(data.product);
      } else {
        setFormReady(true);
      }
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
  };

  const totalImages = existingImages.length + imageFiles.length;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!totalImages) {
      setError('Оставьте хотя бы одно изображение товара');
      return;
    }

    setBusy(true);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('price', price);
      formData.append('stock', stock);
      formData.append('description', description.trim());
      formData.append('existingImages', JSON.stringify(existingImages));
      if (oldPrice && !priceDropEnabled) formData.append('oldPrice', oldPrice);
      if (color.trim()) formData.append('color', color.trim());
      if (material.trim()) formData.append('material', material.trim());
      imageFiles.forEach((file) => formData.append('images', file));

      await api.updateAdminProduct(category, id, formData);
      clearFormDraft(productEditDraftKey(category, id));
      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить товар');
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
      if (existingImages.length + merged.length > MAX_PRODUCT_IMAGES) {
        setError(`Можно загрузить не больше ${MAX_PRODUCT_IMAGES} фото`);
        return merged.slice(0, MAX_PRODUCT_IMAGES - existingImages.length);
      }
      return merged;
    });
  };

  const removeExistingImage = (index: number) => {
    setExistingImages((current) => current.filter((_, imageIndex) => imageIndex !== index));
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
    return (
      <div className="admin-page">
        <p className="mono">LOADING_ADMIN...</p>
      </div>
    );
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
    <AdminLayout title="Редактирование товара" tag="PRODUCT_EDIT" onLogout={() => void handleLogout()}>
      <p className="admin-page__hint">
        Категория: {category ? getCategoryLabel(category as ProductDbCategory) : '—'} ({category}). Можно менять фото, цену,
        остаток и описание. Всего до {MAX_PRODUCT_IMAGES} изображений.
        {priceDropEnabled
          ? ' Автоснижение включено: указывайте исходную цену, скидка по таймеру применится автоматически.'
          : ''}
      </p>

      <form className="admin-form" onSubmit={handleSubmit}>
        <label className="admin-form__field">
          Название *
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Название товара"
            required
          />
        </label>

        <div className="admin-form__row">
          <label className="admin-form__field">
            {priceDropEnabled ? 'Исходная цена (до скидки), ₽ *' : 'Цена, ₽ *'}
            <NumberInput
              min="0"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              required
            />
            {priceDropEnabled && previewCurrentPrice != null && Number.isFinite(previewCurrentPrice) && (
              <span className="admin-form__price-preview">
                Со скидкой −{priceDropDiscount}%: <strong>{formatPrice(previewCurrentPrice)}</strong>
                {priceDropDiscount > 0 ? ' · таймер скидки сохраняется' : ''}
              </span>
            )}
          </label>
          {!priceDropEnabled && (
            <label className="admin-form__field">
              Старая цена, ₽
              <NumberInput
                min="0"
                value={oldPrice}
                onChange={(event) => setOldPrice(event.target.value)}
              />
            </label>
          )}
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

        {existingImages.length > 0 && (
          <div className="admin-form__field">
            Текущие фото
            <div className="admin-edit-images">
              {existingImages.map((url, index) => (
                <div key={`${url}-${index}`} className="admin-edit-images__item">
                  <img src={url} alt="" loading="lazy" />
                  <button
                    type="button"
                    className="admin-edit-images__remove"
                    onClick={() => removeExistingImage(index)}
                    aria-label="Удалить фото"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="admin-form__field">
          Добавить фото ({totalImages}/{MAX_PRODUCT_IMAGES})
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
                ? `Новых фото: ${imageFiles.length}`
                : 'Прикрепите дополнительные фото'}
            </span>
          </label>
        </div>

        {previewUrls.length > 0 && (
          <div className="admin-edit-images">
            {previewUrls.map((url, index) => (
              <div key={url} className="admin-edit-images__item">
                <img src={url} alt="" loading="lazy" />
                <button
                  type="button"
                  className="admin-edit-images__remove"
                  onClick={() => removeImageFile(index)}
                  aria-label="Убрать новое фото"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="admin-page__error">{error}</p>}

        <div className="admin-form__actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Сохраняем...' : 'Сохранить изменения'}
          </button>
          <Link to="/admin" className="btn btn--secondary">
            Отмена
          </Link>
        </div>
      </form>
    </AdminLayout>
  );
}
