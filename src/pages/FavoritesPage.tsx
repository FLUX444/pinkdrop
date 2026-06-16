import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { ProductCard } from '../components/ProductCard';
import { ShareMenu } from '../components/ShareMenu';
import { AuthPanel } from '../components/AuthPanel';
import { useImportSharedFavorites } from '../hooks/useImportSharedFavorites';
import { buildFavoritesShare } from '../utils/shareLinks';

export function FavoritesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { items, isLoading, refreshFavorites } = useFavorites();
  const { notice: importNotice, clearNotice: clearImportNotice } = useImportSharedFavorites();
  const favoritesShare = buildFavoritesShare(items);

  useEffect(() => {
    void refreshFavorites();
  }, [refreshFavorites]);

  if (authLoading) {
    return (
      <div className="favorites-page">
        <p className="mono favorites-page__loading">LOADING_FAVORITES...</p>
      </div>
    );
  }

  const pageClass = 'profile-page favorites-page';

  const renderGrid = () => {
    if (isLoading) {
      return <p className="mono favorites-page__loading">LOADING_FAVORITES...</p>;
    }

    if (items.length === 0) {
      return (
        <div className="favorites-page__empty">
          <p>Пока пусто</p>
          <span className="mono">NO_FAVORITES</span>
          <Link to="/catalog" className="btn btn--primary">
            В каталог
          </Link>
        </div>
      );
    }

    return (
      <div className="favorites-page__grid product-grid product-grid--compact favorites-page__grid--wide">
        {items.map((entry) =>
          entry.product ? (
            <ProductCard key={`${entry.category}:${entry.productId}`} product={entry.product} />
          ) : (
            <article key={`${entry.category}:${entry.productId}`} className="favorites-page__missing-card">
              <p>{entry.name}</p>
              <span className="mono">UNAVAILABLE</span>
            </article>
          )
        )}
      </div>
    );
  };

  if (!user) {
    return (
      <div className={pageClass}>
        <div className="favorites-page__top">
          <Link to="/profile" className="profile-page__back" aria-label="В профиль">
            <ArrowLeft size={22} />
          </Link>
          <div className="favorites-page__title-wrap">
            <h1 className="title-with-code">
              <span className="title-code">&lt;/&gt;</span>
              <span>ИЗБРАННОЕ</span>
            </h1>
            <p className="favorites-page__subtitle">Войдите, чтобы синхронизировать список между устройствами</p>
          </div>
          {items.length > 0 && (
            <ShareMenu
              className="favorites-page__share"
              url={favoritesShare.url}
              title={favoritesShare.title}
              message={favoritesShare.message}
            />
          )}
        </div>

        {importNotice && (
          <div className="favorites-page__import-notice" role="status">
            <div>
              <strong>Ссылка открыта</strong>
              <p>{importNotice}</p>
            </div>
            <button type="button" onClick={clearImportNotice} aria-label="Закрыть">
              <X size={18} />
            </button>
          </div>
        )}

        {renderGrid()}
        <AuthPanel variant="inline" />
      </div>
    );
  }

  return (
    <div className={pageClass}>
      <div className="favorites-page__top">
        <Link to="/profile" className="profile-page__back" aria-label="В профиль">
          <ArrowLeft size={22} />
        </Link>
        <div className="favorites-page__title-wrap">
          <h1 className="title-with-code">
            <span className="title-code">&lt;/&gt;</span>
            <span>ИЗБРАННОЕ</span>
          </h1>
          <p className="favorites-page__subtitle">
            {items.length > 0
              ? `${items.length} ${items.length === 1 ? 'товар' : items.length < 5 ? 'товара' : 'товаров'}`
              : 'Добавляйте звёздочкой в каталоге'}
          </p>
        </div>
        {items.length > 0 && (
          <ShareMenu
            className="favorites-page__share"
            url={favoritesShare.url}
            title={favoritesShare.title}
            message={favoritesShare.message}
          />
        )}
      </div>

      {importNotice && (
        <div className="favorites-page__import-notice" role="status">
          <div>
            <strong>Ссылка открыта</strong>
            <p>{importNotice}</p>
          </div>
          <button type="button" onClick={clearImportNotice} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
      )}

      {renderGrid()}
    </div>
  );
}
