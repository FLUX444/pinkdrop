import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthModal } from './components/AuthModal';
import { BottomNav } from './components/BottomNav';
import { SiteFooter } from './components/SiteFooter';
import { CartPage } from './pages/CartPage';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { AdminPage } from './pages/AdminPage';
import { AdminAddProductPage } from './pages/AdminAddProductPage';
import { AdminEditProductPage } from './pages/AdminEditProductPage';
import { AdminHeroPage } from './pages/AdminHeroPage';
import { AdminDatabasePage } from './pages/AdminDatabasePage';
import { AdminOrdersPage } from './pages/AdminOrdersPage';
import { AdminMonitorPage } from './pages/AdminMonitorPage';
import { AdminPromoCodesPage } from './pages/AdminPromoCodesPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ChangeEmailPage } from './pages/ChangeEmailPage';
import { SecuritySupportPage } from './pages/SecuritySupportPage';
import { ProfilePage } from './pages/ProfilePage';
import { FavoritesPage } from './pages/FavoritesPage';
import { LinkTelegramPage } from './pages/LinkTelegramPage';
import { ProductPage } from './pages/ProductPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminUserEditPage } from './pages/AdminUserEditPage';
import { AdminSupportPage } from './pages/AdminSupportPage';
import { UserSupportPage } from './pages/UserSupportPage';
import { SupportChatWidget } from './components/SupportChatWidget';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/product/:category/:id" element={<ProductPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/favorites" element={<FavoritesPage />} />
          <Route path="/profile/link-telegram" element={<LinkTelegramPage />} />
          <Route path="/profile/change-password" element={<ChangePasswordPage />} />
          <Route path="/profile/change-email" element={<ChangeEmailPage />} />
          <Route path="/support/security" element={<SecuritySupportPage />} />
          <Route path="/profile/support" element={<UserSupportPage />} />
          <Route path="/profile/support/new" element={<UserSupportPage />} />
          <Route path="/profile/support/:threadId" element={<UserSupportPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/promo-codes" element={<AdminPromoCodesPage />} />
          <Route path="/admin/products/new" element={<AdminAddProductPage />} />
          <Route path="/admin/products/:category/:id/edit" element={<AdminEditProductPage />} />
          <Route path="/admin/hero" element={<AdminHeroPage />} />
          <Route path="/admin/database" element={<AdminDatabasePage />} />
          <Route path="/admin/orders" element={<AdminOrdersPage />} />
          <Route path="/admin/orders/:orderId" element={<AdminOrdersPage />} />
          <Route path="/admin/monitor" element={<AdminMonitorPage />} />
          <Route path="/admin/support" element={<AdminSupportPage />} />
          <Route path="/admin/support/:threadId" element={<AdminSupportPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/users/:userId" element={<AdminUserEditPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
        </Routes>

        <SiteFooter />

        <AuthModal />
        <SupportChatWidget />
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}

export default App;
