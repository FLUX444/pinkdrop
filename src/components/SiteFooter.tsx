import { Link } from 'react-router-dom';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="site-footer__copyright">© 2026 PinkDrop. Все права защищены.</p>
      <nav className="site-footer__links" aria-label="Юридическая информация">
        <Link to="/privacy">Политика конфиденциальности</Link>
        <Link to="/terms">Пользовательское соглашение</Link>
      </nav>
      <span className="mono site-footer__tag">PINKDROP // DELIVERY_3H // Y2K_EDITION</span>
    </footer>
  );
}
