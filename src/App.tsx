import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthModal } from './components/AuthModal';
import { BottomNav } from './components/BottomNav';
import { SiteFooter } from './components/SiteFooter';
import { CartPage } from './pages/CartPage';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { SimilarCatalogPage } from './pages/SimilarCatalogPage';
import { AdminPage } from './pages/AdminPage';
import { AdminAddProductPage } from './pages/AdminAddProductPage';
import { AdminEditProductPage } from './pages/AdminEditProductPage';
import { AdminHeroPage } from './pages/AdminHeroPage';
import { AdminLegalPage } from './pages/AdminLegalPage';
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
import { AdminContactsPage } from './pages/AdminContactsPage';
import { AdminAboutPage } from './pages/AdminAboutPage';
import { AdminSupportTeamPage } from './pages/AdminSupportTeamPage';
import { AdminEscalationPage } from './pages/AdminEscalationPage';
import { AdminNotificationsPage } from './pages/AdminNotificationsPage';
import { UserSupportPage } from './pages/UserSupportPage';
import { SupportChatWidget } from './components/SupportChatWidget';
import { SeoManager } from './components/SeoManager';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <SeoManager />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/catalog/similar/:category/:id" element={<SimilarCatalogPage />} />
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
          <Route path="/admin/legal" element={<AdminLegalPage />} />
          <Route path="/admin/database" element={<AdminDatabasePage />} />
          <Route path="/admin/orders" element={<AdminOrdersPage />} />
          <Route path="/admin/orders/:orderId" element={<AdminOrdersPage />} />
          <Route path="/admin/monitor" element={<AdminMonitorPage />} />
          <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
          <Route path="/admin/support" element={<AdminSupportPage />} />
          <Route path="/admin/support/:threadId" element={<AdminSupportPage />} />
          <Route path="/admin/escalations" element={<AdminEscalationPage />} />
          <Route path="/admin/escalations/:threadId" element={<AdminEscalationPage />} />
          <Route path="/admin/contacts" element={<AdminContactsPage />} />
          <Route path="/admin/about" element={<AdminAboutPage />} />
          <Route path="/admin/support-team" element={<AdminSupportTeamPage />} />
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
