import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

export function AdminAddProductCard() {
  return (
    <Link to="/admin/products/new" className="admin-add-card" aria-label="Добавить товар">
      <span className="admin-add-card__icon" aria-hidden>
        <Plus size={42} strokeWidth={1.5} />
      </span>
      <span className="admin-add-card__label mono">ДОБАВИТЬ ТОВАР</span>
    </Link>
  );
}
