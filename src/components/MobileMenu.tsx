import type { CSSProperties } from 'react';
import { useEffect } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Y2KIcon } from './Y2KIcon';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const links = [
  { id: 'new', label: 'Новинка', icon: 'heart' as const, hint: 'Свежие дропы', route: '/' as const },
  { id: 'catalog', label: 'Каталог', icon: 'box' as const, hint: 'Все товары', route: '/catalog' as const },
  { id: 'catalog', label: 'Украшения', icon: 'ring' as const, hint: 'Кольца и наборы', route: '/catalog' as const },
  { id: 'catalog', label: 'Аксессуары', icon: 'accessory' as const, hint: 'Сумки и детали', route: '/catalog' as const },
  { id: 'contacts', label: 'Контакты', icon: 'phone' as const, hint: 'Связаться с нами', route: '/' as const },
] as const;

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleNavigate = (route: '/' | '/catalog', section: string) => {
    if (route === '/catalog') {
      navigate('/catalog');
      onClose();
      return;
    }

    if (location.pathname !== '/') {
      navigate(section === 'contacts' ? '/#contacts' : '/#new');
      onClose();
      return;
    }

    document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="mobile-menu">
      <div className="mobile-menu__backdrop" onClick={onClose} aria-hidden />

      <nav className="mobile-menu__panel" aria-label="Мобильное меню">
        <div className="mobile-menu__glow" aria-hidden />
        <div className="mobile-menu__grid" aria-hidden />

        <div className="mobile-menu__header">
          <div className="mobile-menu__brand">
            <span className="mobile-menu__logo-mark">PD</span>
            <div className="mobile-menu__logo-text">
              <span>
                <span className="mobile-menu__logo-pink">PINK</span>DROP
              </span>
              <small>Дроп за 3 часа</small>
            </div>
          </div>

          <button type="button" className="mobile-menu__close" onClick={onClose} aria-label="Закрыть меню">
            <X size={20} />
          </button>
        </div>

        <p className="mobile-menu__tagline mono">Навигация по магазину</p>

        <ul className="mobile-menu__list">
          {links.map((link, index) => (
            <li key={`${link.id}-${link.label}`} style={{ '--menu-item-index': index } as CSSProperties}>
              <button
                type="button"
                className="mobile-menu__link"
                onClick={() => handleNavigate(link.route, link.id)}
              >
                <span className="mobile-menu__index mono">{String(index + 1).padStart(2, '0')}</span>
                <span className="mobile-menu__icon-wrap">
                  <Y2KIcon name={link.icon} size={20} />
                </span>
                <span className="mobile-menu__copy">
                  <span className="mobile-menu__label">{link.label}</span>
                  <span className="mobile-menu__hint">{link.hint}</span>
                </span>
                <ChevronRight size={18} className="mobile-menu__chevron" aria-hidden />
              </button>
            </li>
          ))}
        </ul>

        <div className="mobile-menu__footer">
          <span className="mobile-menu__footer-mark mono">PINKDROP // 2026</span>
          <span className="mobile-menu__footer-note">Красноярск · доставка за 3 часа</span>
        </div>
      </nav>
    </div>
  );
}
