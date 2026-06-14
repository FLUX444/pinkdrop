import { Grid2X2, Search, ShoppingCart, User } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { totalItems } = useCart();
  const { user } = useAuth();

  const focusSearch = () => {
    if (location.pathname !== '/') {
      navigate('/');
      window.setTimeout(() => {
        document.querySelector<HTMLInputElement>('.search-bar__input')?.focus();
      }, 120);
      return;
    }
    document.querySelector<HTMLInputElement>('.search-bar__input')?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goCatalog = () => {
    if (location.pathname !== '/') {
      navigate('/');
      window.setTimeout(() => {
        document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
      }, 120);
      return;
    }
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className="bottom-nav" aria-label="Быстрая навигация">
      <button type="button" onClick={goCatalog}>
        <Grid2X2 size={20} />
        <span>Каталог</span>
      </button>
      <button type="button" onClick={focusSearch}>
        <Search size={20} />
        <span>Поиск</span>
      </button>
      <Link to="/cart" className="bottom-nav__cart">
        <ShoppingCart size={20} />
        <span>Корзина</span>
        {totalItems > 0 && <i>{totalItems}</i>}
      </Link>
      <Link to="/profile">
        <User size={20} />
        <span>{user ? 'Профиль' : 'Войти'}</span>
      </Link>
    </nav>
  );
}
