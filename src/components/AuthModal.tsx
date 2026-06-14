import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthPanel } from './AuthPanel';

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal } = useAuth();

  if (!isAuthModalOpen) return null;

  return (
    <div className="modal-overlay" onClick={closeAuthModal}>
      <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={closeAuthModal} aria-label="Закрыть">
          <X size={24} />
        </button>
        <div className="auth-modal__tag mono">AUTH_v2.0</div>
        <AuthPanel variant="modal" />
      </div>
    </div>
  );
}
