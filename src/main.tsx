import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppDialogProvider } from './context/AppDialogContext';
import { AuthProvider } from './context/AuthContext';
import { PresenceProvider } from './context/PresenceContext';
import { CartProvider } from './context/CartContext';
import { FavoritesProvider } from './context/FavoritesContext';
import { SupportChatProvider } from './context/SupportChatContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppDialogProvider>
      <AuthProvider>
        <PresenceProvider>
          <CartProvider>
            <FavoritesProvider>
              <SupportChatProvider>
                <App />
              </SupportChatProvider>
            </FavoritesProvider>
          </CartProvider>
        </PresenceProvider>
      </AuthProvider>
    </AppDialogProvider>
  </StrictMode>
);
