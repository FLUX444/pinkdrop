import { Grid2X2, Search, ShoppingCart, User } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

function focusSearchInput() {
  document.querySelector<HTMLInputElement>('.search-bar__input')?.focus();
}

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { totalItems } = useCart();
  const { user } = useAuth();
  const isCatalog = location.pathname === '/catalog';

  const openCatalogSearch = () => {
    if (isCatalog) {
      focusSearchInput();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    navigate('/catalog');
    window.setTimeout(() => {
      focusSearchInput();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 150);
  };

  const goCatalog = () => {
    navigate('/catalog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className="bottom-nav" aria-label="Быстрая навигация">
      <button type="button" className={isCatalog ? 'is-active' : ''} onClick={goCatalog}>
        <Grid2X2 size={20} />
        <span>Каталог</span>
      </button>
      <button type="button" onClick={openCatalogSearch}>
        <Search size={20} />
        <span>Поиск</span>
      </button>
      <Link to="/cart" className={`bottom-nav__cart${location.pathname === '/cart' ? ' is-active' : ''}`}>
        <ShoppingCart size={20} />
        <span>Корзина</span>
        {totalItems > 0 && <i>{totalItems}</i>}
      </Link>
      <Link to="/profile" className={location.pathname.startsWith('/profile') ? 'is-active' : ''}>
        <User size={20} />
        <span>{user ? 'Профиль' : 'Войти'}</span>
      </Link>
    </nav>
  );
}
