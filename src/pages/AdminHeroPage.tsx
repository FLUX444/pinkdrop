import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Paperclip, UploadCloud } from 'lucide-react';
import { api } from '../api/client';
import { AdminLayout } from '../components/AdminLayout';
import { AdminLoginScreen } from '../components/AdminLoginScreen';
import { NumberInput } from '../components/NumberInput';
import { AdminProductPicker } from '../components/AdminProductPicker';
import type { HeroConfig, Product } from '../types';
import { formatPrice } from '../utils/formatPrice';
import { clearFormDraft, readFormDraft, writeFormDraft } from '../utils/formDraft';

const HERO_DRAFT_KEY = 'admin_hero_form';

export function AdminHeroPage() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [hero, setHero] = useState<HeroConfig | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    api
      .getAdminStatus()
      .then(async (status) => {
        setConfigured(status.configured);
        setAuthenticated(status.authenticated);
        if (status.authenticated) {
          const [heroData, productsData] = await Promise.all([
            api.getAdminHero(),
            api.getAdminProducts(),
          ]);
          setProducts(productsData.products);
          const draft = readFormDraft<HeroConfig>(HERO_DRAFT_KEY);
          setHero(draft ?? heroData.hero);
        }
      })
      .catch(() => setConfigured(false))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    if (!hero) return;
    writeFormDraft(HERO_DRAFT_KEY, hero);
  }, [hero]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoginBusy(true);
    try {
      await api.adminLogin(password);
      setPassword('');
      const [heroData, productsData] = await Promise.all([
        api.getAdminHero(),
        api.getAdminProducts(),
      ]);
      setHero(heroData.hero);
      setProducts(productsData.products);
      const draft = readFormDraft<HeroConfig>(HERO_DRAFT_KEY);
      setHero(draft ?? heroData.hero);
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
    setHero(null);
  };

  const updateField = <K extends keyof HeroConfig>(key: K, value: HeroConfig[K]) => {
    setHero((current) => (current ? { ...current, [key]: value } : current));
    setSaved(false);
  };

  const applyProductToHero = (product: Product, current: HeroConfig): HeroConfig => ({
    ...current,
    featuredProductId: product.id,
    featuredCategory: product.category ?? current.featuredCategory,
    productTitle: product.name,
    productNote: product.description || current.productNote,
    heroImageUrl: product.images[0] ?? current.heroImageUrl,
    productLabel: product.priceDrop?.enabled ? 'NEW_DROP' : current.productLabel,
  });

  const handleFeaturedProductChange = (value: string) => {
    const [category, productId] = value.split(':');
    const product = products.find((item) => item.id === productId && item.category === category);
    if (!product) return;

    setHero((current) => (current ? applyProductToHero(product, current) : current));
    setImageFile(null);
    setSaved(false);
  };

  const syncHeroFromFeaturedProduct = () => {
    if (!featuredProduct || !hero) return;
    setHero(applyProductToHero(featuredProduct, hero));
    setImageFile(null);
    setSaved(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hero) return;

    setError('');
    setBusy(true);
    setSaved(false);

    try {
      let heroImageUrl = hero.heroImageUrl;
      if (imageFile) {
        const uploaded = await api.uploadAdminImage(imageFile);
        heroImageUrl = uploaded.url;
      }

      const data = await api.updateAdminHero({ ...hero, heroImageUrl });
      setHero(data.hero);
      clearFormDraft(HERO_DRAFT_KEY);
      setImageFile(null);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  const selectImageFile = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Можно загрузить только изображение');
      return;
    }
    setError('');
    setSaved(false);
    setImageFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(false);
    selectImageFile(event.dataTransfer.files?.[0]);
  };

  const featuredProduct = products.find(
    (product) =>
      product.id === hero?.featuredProductId && product.category === hero?.featuredCategory
  );

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

  if (!hero) return null;

  return (
    <AdminLayout title="Главная страница" tag="HERO_EDITOR" onLogout={() => void handleLogout()}>
      <p className="admin-page__hint">
        Меняйте текст и картинку в hero-блоке. Анимация заголовка остаётся прежней.
      </p>

      <form className="admin-form" onSubmit={handleSubmit}>
        <label className="admin-form__field">
          Тег
          <input value={hero.tag} onChange={(e) => updateField('tag', e.target.value)} />
        </label>

        <div className="admin-form__row">
          <label className="admin-form__field">
            Заголовок (первая строка)
            <input
              value={hero.titleMain}
              onChange={(e) => updateField('titleMain', e.target.value)}
            />
          </label>
          <label className="admin-form__field">
            Заголовок (акцент)
            <input
              value={hero.titleAccent}
              onChange={(e) => updateField('titleAccent', e.target.value)}
            />
          </label>
        </div>

        <label className="admin-form__field">
          Подзаголовок
          <input value={hero.subtitle} onChange={(e) => updateField('subtitle', e.target.value)} />
        </label>

        <label className="admin-form__field">
          Выделенный текст в подзаголовке
          <input value={hero.bonusText} onChange={(e) => updateField('bonusText', e.target.value)} />
        </label>

        <div className="admin-form__row">
          <label className="admin-form__field">
            Кнопка 1
            <input
              value={hero.ctaPrimary}
              onChange={(e) => updateField('ctaPrimary', e.target.value)}
            />
          </label>
          <label className="admin-form__field">
            Кнопка 2
            <input
              value={hero.ctaSecondary}
              onChange={(e) => updateField('ctaSecondary', e.target.value)}
            />
          </label>
        </div>

        <section className="admin-hero-product">
          <div className="admin-hero-product__head">
            <h2>Плашка часов работы</h2>
            <p>
              На главной — крупная плашка в формате «С 9 ДО 21». В корзине и на карточках — компактная
              версия. Приём заказов настраивается отдельно.
            </p>
          </div>

          <label className="admin-form__field">
            Заголовок плашки
            <input
              value={hero.workingHoursLabel}
              onChange={(e) => updateField('workingHoursLabel', e.target.value)}
            />
          </label>

          <div className="admin-form__row">
            <label className="admin-form__field">
              Часы работы — с (час)
              <NumberInput
                min={0}
                max={23}
                value={hero.workingHoursFrom}
                onChange={(e) => updateField('workingHoursFrom', Number(e.target.value) || 0)}
              />
            </label>
            <label className="admin-form__field">
              Часы работы — до (час)
              <NumberInput
                min={1}
                max={24}
                value={hero.workingHoursTo}
                onChange={(e) => updateField('workingHoursTo', Number(e.target.value) || 0)}
              />
            </label>
          </div>

          <p className="admin-page__hint mono">
            PREVIEW: {hero.workingHoursLabel} · с {hero.workingHoursFrom}:00 до {hero.workingHoursTo}:00
          </p>

          <div className="admin-form__row">
            <label className="admin-form__field">
              Начало приёма заказов (час)
              <NumberInput
                min={0}
                max={23}
                value={hero.deliveryOpenHour}
                onChange={(e) => updateField('deliveryOpenHour', Number(e.target.value) || 0)}
              />
            </label>
            <label className="admin-form__field">
              Конец приёма заказов (час)
              <NumberInput
                min={1}
                max={24}
                value={hero.deliveryCutoffHour}
                onChange={(e) => updateField('deliveryCutoffHour', Number(e.target.value) || 0)}
              />
            </label>
          </div>

          <label className="admin-form__field">
            Текст в рабочее время
            <input
              value={hero.deliveryActiveLabel}
              onChange={(e) => updateField('deliveryActiveLabel', e.target.value)}
              placeholder="Доставка по Красноярску"
            />
          </label>
        </section>

        <section className="admin-hero-product">
          <div className="admin-hero-product__head">
            <h2>Карточка товара на главной</h2>
            <p>При клике на табличку откроется выбранный товар. Картинка, название и цена подтягиваются из него.</p>
          </div>

          <AdminProductPicker
            label="Куда ведёт клик (товар)"
            products={products}
            value={`${hero.featuredCategory}:${hero.featuredProductId}`}
            onChange={handleFeaturedProductChange}
          />

          {featuredProduct && (
            <div className="admin-hero-product__linked">
              <strong>Привязан: {featuredProduct.name}</strong>
              <span className="mono">
                {hero.featuredCategory}:{hero.featuredProductId} · {formatPrice(featuredProduct.price)}
              </span>
              <button type="button" className="btn btn--secondary" onClick={syncHeroFromFeaturedProduct}>
                Обновить карточку из товара
              </button>
            </div>
          )}
        </section>

        <div className="admin-form__row">
          <label className="admin-form__field">
            Название на карточке
            <input
              value={hero.productTitle}
              onChange={(e) => updateField('productTitle', e.target.value)}
            />
          </label>
          <label className="admin-form__field">
            Подпись
            <input
              value={hero.productNote}
              onChange={(e) => updateField('productNote', e.target.value)}
            />
          </label>
        </div>

        <label className="admin-form__field">
          Метка цены (префикс)
          <input
            value={hero.productLabel}
            onChange={(e) => updateField('productLabel', e.target.value)}
          />
          {featuredProduct && (
            <span className="admin-form__hint mono">
              Превью: {hero.productLabel} // {formatPrice(featuredProduct.price)}
            </span>
          )}
        </label>

        <div className="admin-form__field">
          Картинка hero
          <label
            className={`admin-upload${dragActive ? ' is-dragging' : ''}${imageFile ? ' has-file' : ''}`}
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
              onChange={(e) => selectImageFile(e.target.files?.[0])}
            />
            <span className="admin-upload__icon" aria-hidden>
              {imageFile ? <Paperclip size={22} /> : <UploadCloud size={24} />}
            </span>
            <span className="admin-upload__title">
              {imageFile ? imageFile.name : 'Прикрепите картинку hero'}
            </span>
            <span className="admin-upload__hint">
              Нажмите или перетащите файл сюда
            </span>
          </label>
          <span className="admin-form__hint">Текущая: {hero.heroImageUrl}</span>
        </div>

        {(previewUrl || hero.heroImageUrl) && (
          <div className="admin-form__preview admin-form__preview--hero">
            <img src={previewUrl || hero.heroImageUrl} alt="Hero preview" />
          </div>
        )}

        {error && <p className="admin-page__error">{error}</p>}
        {saved && <p className="admin-page__success">Сохранено</p>}

        <div className="admin-form__actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Сохраняем...' : 'Сохранить hero'}
          </button>
          <Link to="/" className="btn btn--secondary">На главную</Link>
        </div>
      </form>
    </AdminLayout>
  );
}
