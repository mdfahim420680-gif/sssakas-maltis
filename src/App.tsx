import { useEffect } from 'react';
import { Outlet, Route, Routes } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { AppDispatch } from './store';
import { fetchCurrentUser } from './store/authSlice';
import { hydrateCart } from './store/cartSlice';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { CartDrawer } from './components/layout/CartDrawer';
import { ToastContainer } from './components/ui/ToastContainer';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { StorePage, ShopsDirectoryPage } from './pages/StorePage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from './pages/AuthPages';
import { AccountPage } from './pages/AccountPage';
import { BecomeSellerPage } from './pages/BecomeSellerPage';
import { InfoPage } from './pages/InfoPages';

import { SellerLayout } from './pages/seller/SellerLayout';
import {
  SellerOverviewPage,
  SellerReviewsPage,
  SellerSettingsPage,
} from './pages/seller/SellerOverview';
import { SellerAddProductPage, SellerProductsPage } from './pages/seller/SellerCatalog';
import {
  SellerFinancePage,
  SellerOrdersPage,
  SellerReturnsPage,
} from './pages/seller/SellerOrdersFinance';

import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminOverviewPage } from './pages/admin/AdminOverview';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalytics';
import { AdminSellersPage, AdminUsersPage } from './pages/admin/AdminUsersSellers';
import {
  AdminCatalogPage,
  AdminOrdersPage,
  AdminReturnsPage,
} from './pages/admin/AdminCatalogOrders';
import {
  AdminBrandsPage,
  AdminCategoriesPage,
  AdminCustomersPage,
  AdminProductFormPage,
} from './pages/admin/AdminProductsPages';
import { AdminFinancePage } from './pages/admin/AdminFinance';
import {
  AdminAdsPage,
  AdminBannersPage,
  AdminCmsPage,
  AdminPromotionsPage,
} from './pages/admin/AdminCmsGrowth';
import {
  AdminAuditPage,
  AdminReviewsPage,
  AdminSearchPage,
  AdminSettingsPage,
  AdminSupportPage,
} from './pages/admin/AdminGovernance';

const ADMIN_ROLES = [
  'super_admin',
  'admin',
  'catalog_manager',
  'order_manager',
  'finance_manager',
  'support_agent',
  'content_manager',
];

function StorefrontShell() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7FB] text-slate-900">
      <Header />
      <CartDrawer />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    dispatch(fetchCurrentUser()).finally(() => {
      dispatch(hydrateCart());
    });
  }, [dispatch]);

  return (
    <>
      <ToastContainer />
      <Routes>
        {/* Dedicated Admin Control Center (strictly isolated from public storefront Header/Footer) */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={ADMIN_ROLES}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminOverviewPage />} />
          <Route path="dashboard" element={<AdminOverviewPage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="customers" element={<AdminCustomersPage />} />
          <Route path="sellers" element={<AdminSellersPage />} />
          <Route path="products" element={<AdminCatalogPage />} />
          <Route path="products/create" element={<AdminProductFormPage />} />
          <Route path="products/:id/edit" element={<AdminProductFormPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="brands" element={<AdminBrandsPage />} />
          <Route path="catalog" element={<AdminCatalogPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="returns" element={<AdminReturnsPage />} />
          <Route path="finance" element={<AdminFinancePage />} />
          <Route path="cms" element={<AdminCmsPage />} />
          <Route path="banners" element={<AdminBannersPage />} />
          <Route path="ads" element={<AdminAdsPage />} />
          <Route path="promotions" element={<AdminPromotionsPage />} />
          <Route path="coupons" element={<AdminPromotionsPage />} />
          <Route path="search" element={<AdminSearchPage />} />
          <Route path="reviews" element={<AdminReviewsPage />} />
          <Route path="support" element={<AdminSupportPage />} />
          <Route path="audit" element={<AdminAuditPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>

        {/* Public Storefront, Customer Account, Auth & Seller Center */}
        <Route element={<StorefrontShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/category/:slug" element={<SearchPage />} />
          <Route path="/product/:slug" element={<ProductDetailPage />} />
          <Route path="/shops" element={<ShopsDirectoryPage />} />
          <Route path="/shop/:slug" element={<StorePage />} />
          <Route path="/cart" element={<CartPage />} />

          {/* Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          {/* Authenticated Customer Routes */}
          <Route
            path="/checkout"
            element={
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <AccountPage defaultTab="orders" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:id"
            element={
              <ProtectedRoute>
                <OrderDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wishlist"
            element={
              <ProtectedRoute>
                <AccountPage defaultTab="wishlist" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountPage defaultTab="profile" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account/support"
            element={
              <ProtectedRoute>
                <AccountPage defaultTab="support" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/become-a-seller"
            element={
              <ProtectedRoute>
                <BecomeSellerPage />
              </ProtectedRoute>
            }
          />

          {/* Seller Center */}
          <Route
            path="/seller"
            element={
              <ProtectedRoute roles={['seller', 'admin', 'super_admin']} requireSellerStore>
                <SellerLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<SellerOverviewPage />} />
            <Route path="products" element={<SellerProductsPage />} />
            <Route path="add-product" element={<SellerAddProductPage />} />
            <Route path="orders" element={<SellerOrdersPage />} />
            <Route path="returns" element={<SellerReturnsPage />} />
            <Route path="finance" element={<SellerFinancePage />} />
            <Route path="reviews" element={<SellerReviewsPage />} />
            <Route path="settings" element={<SellerSettingsPage />} />
          </Route>

          {/* Informational & Policy Pages */}
          <Route
            path="/about"
            element={
              <InfoPage
                title="About NOVARA Bangladesh"
                subtitle="Shop Smart, Live Better — Trusted Multi-Vendor Marketplace"
                sections={[
                  {
                    heading: 'Built for Bangladesh Commerce',
                    body: 'NOVARA connects verified Bangladeshi electronics, fashion, lifestyle, and home merchants directly with shoppers across all 8 divisions and 64 districts.',
                  },
                  {
                    heading: 'Seller-Isolated Transparency',
                    body: 'Multiple verified merchants can offer the same authentic product on NOVARA so customers enjoy competitive BDT pricing, transparent shipping fees, and guaranteed 7-day returns.',
                  },
                ]}
              />
            }
          />
          <Route
            path="/contact"
            element={
              <InfoPage
                title="Contact NOVARA"
                subtitle="Customer & Merchant Support Desk — Dhaka, Bangladesh"
                sections={[
                  {
                    heading: 'Headquarters & Merchant Hub',
                    body: 'House 42, Road 11, Banani, Dhaka 1213, Bangladesh. Support hours: 9:00 AM – 10:00 PM BST daily.',
                  },
                  {
                    heading: 'Direct Support Channels',
                    body: 'Email: support@novara.com.bd | Hotline: +880 9612-000888. Logged-in users can also track real-time ticket replies inside Account > Support.',
                  },
                ]}
              />
            }
          />
          <Route
            path="/help"
            element={
              <InfoPage
                title="NOVARA Help Center"
                subtitle="Frequently Asked Questions for Buyers & Sellers"
                sections={[
                  {
                    heading: 'How Multi-Seller Orders Work',
                    body: 'If your cart includes items from two different stores, NOVARA automatically splits fulfillment into seller-specific suborders so each merchant dispatches immediately without waiting.',
                  },
                  {
                    heading: 'Cash on Delivery & Digital Payments',
                    body: 'Cash on Delivery is available across all 64 districts. Orders above ৳999 qualify for free standard delivery.',
                  },
                ]}
              />
            }
          />
          <Route
            path="/shipping-policy"
            element={
              <InfoPage
                title="Shipping & Delivery Policy"
                subtitle="Division & District-Aware Delivery Across Bangladesh"
                sections={[
                  {
                    heading: 'Dhaka Metro & Nationwide Delivery',
                    body: 'Dhaka Metro standard delivery typically arrives within 1–2 business days (base fee ৳60). Nationwide district & Upazila delivery arrives in 3–5 business days (base fee ৳120).',
                  },
                  {
                    heading: 'Free Shipping Qualification',
                    body: 'Orders with subtotal ৳999 or higher automatically qualify for free standard delivery across Bangladesh.',
                  },
                ]}
              />
            }
          />
          <Route
            path="/return-policy"
            element={
              <InfoPage
                title="Return & Refund Policy"
                subtitle="7-Day Easy Return Protection"
                sections={[
                  {
                    heading: 'Eligibility Window',
                    body: 'Delivered items may be submitted for return within 7 days of delivery from your Order Detail page if damaged, defective, or mismatched.',
                  },
                  {
                    heading: 'Refund Execution',
                    body: 'Once inspected and approved by our marketplace team, refunds are recorded against the seller ledger and disbursed back to your payment channel.',
                  },
                ]}
              />
            }
          />
          <Route
            path="/privacy"
            element={
              <InfoPage
                title="Privacy Policy"
                subtitle="Protecting Buyer & Merchant Account Data"
                sections={[
                  {
                    heading: 'Data Handling',
                    body: 'NOVARA stores only the account, shipping address, and order records necessary to fulfill your purchases and process verified merchant payouts.',
                  },
                ]}
              />
            }
          />
          <Route
            path="/terms"
            element={
              <InfoPage
                title="Terms & Conditions"
                subtitle="Marketplace Rules for Customers and Sellers"
                sections={[
                  {
                    heading: 'Authentic Listings & Fair Pricing',
                    body: 'All sellers on NOVARA must pass KYC verification and product moderation before publishing offers. Prices and stock are enforced authoritatively at checkout.',
                  },
                ]}
              />
            }
          />
          <Route
            path="*"
            element={
              <InfoPage
                title="Page Not Found"
                subtitle="The page you requested could not be located."
                sections={[
                  {
                    heading: 'Continue Shopping',
                    body: 'Explore trending electronics, fashion, and home essentials from the NOVARA homepage or search bar.',
                  },
                ]}
              />
            }
          />
        </Route>
      </Routes>
    </>
  );
}
