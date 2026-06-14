import { Headphones } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function SupportChatWidget() {
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();

  const handleFabClick = () => {
    if (!user) {
      openAuthModal();
      return;
    }
    navigate('/profile/support');
  };

  return (
    <button
      type="button"
      className="support-chat-fab"
      onClick={handleFabClick}
      aria-label="Связаться с поддержкой"
    >
      <Headphones size={22} />
    </button>
  );
}
