import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { FavoriteProductCard } from '../components/FavoriteProductCard';
import { AuthPanel } from '../components/AuthPanel';

export function FavoritesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { items, isLoading, refreshFavorites } = useFavorites();

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

  if (!user) {
    return (
      <div className="profile-page favorites-page">
        <div className="profile-page__header">
          <Link to="/profile" className="profile-page__back" aria-label="В профиль">
            <ArrowLeft size={22} />
          </Link>
          <h1 className="title-with-code">
            <span className="title-code">&lt;/&gt;</span>
            <span>ИЗБРАННОЕ</span>
          </h1>
        </div>

        <section className="favorites-page__intro">
          <span className="favorites-page__icon" aria-hidden>
            <Heart size={20} />
          </span>
          <div>
            <span className="mono favorites-page__tag">WISHLIST</span>
            <p>Войдите в аккаунт, чтобы синхронизировать избранное между устройствами</p>
          </div>
        </section>

        {isLoading ? (
          <p className="mono favorites-page__loading">LOADING_FAVORITES...</p>
        ) : items.length === 0 ? (
          <div className="favorites-page__empty">
            <p>Пока пусто</p>
            <span className="mono">NO_FAVORITES</span>
            <Link to="/#catalog" className="btn btn--primary">
              В каталог
            </Link>
          </div>
        ) : (
          <div className="favorites-page__grid">
            {items.map((entry) => (
              <FavoriteProductCard
                key={`${entry.category}:${entry.productId}`}
                entry={entry}
              />
            ))}
          </div>
        )}

        <AuthPanel variant="inline" />
      </div>
    );
  }

  return (
    <div className="profile-page favorites-page">
      <div className="profile-page__header">
        <Link to="/profile" className="profile-page__back" aria-label="В профиль">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="title-with-code">
          <span className="title-code">&lt;/&gt;</span>
          <span>ИЗБРАННОЕ</span>
        </h1>
      </div>

      <section className="favorites-page__intro">
        <span className="favorites-page__icon" aria-hidden>
          <Heart size={20} />
        </span>
        <div>
          <span className="mono favorites-page__tag">WISHLIST</span>
          <p>
            {items.length > 0
              ? `Сохранено ${items.length} ${items.length === 1 ? 'товар' : items.length < 5 ? 'товара' : 'товаров'}`
              : 'Добавляйте звёздочкой в каталоге — список останется здесь, пока вы сами не уберёте'}
          </p>
        </div>
      </section>

      {isLoading ? (
        <p className="mono favorites-page__loading">LOADING_FAVORITES...</p>
      ) : items.length === 0 ? (
        <div className="favorites-page__empty">
          <p>Пока пусто</p>
          <span className="mono">NO_FAVORITES</span>
          <Link to="/#catalog" className="btn btn--primary">
            В каталог
          </Link>
        </div>
      ) : (
        <div className="favorites-page__grid">
          {items.map((entry) => (
            <FavoriteProductCard
              key={`${entry.category}:${entry.productId}`}
              entry={entry}
            />
          ))}
        </div>
      )}
    </div>
  );
}
