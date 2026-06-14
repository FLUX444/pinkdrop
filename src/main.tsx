import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppDialogProvider } from './context/AppDialogContext';
import { AuthProvider } from './context/AuthContext';
import { PresenceProvider } from './context/PresenceContext';
import { CartProvider } from './context/CartContext';
import { SupportChatProvider } from './context/SupportChatContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppDialogProvider>
      <AuthProvider>
        <PresenceProvider>
          <CartProvider>
            <SupportChatProvider>
              <App />
            </SupportChatProvider>
          </CartProvider>
        </PresenceProvider>
      </AuthProvider>
    </AppDialogProvider>
  </StrictMode>
);
