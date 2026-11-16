import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AlertCircle, Lock, Mail, MapPin, Phone, Shield, ShoppingBag } from 'lucide-react';
import { AppDispatch, RootState } from '../../store';
import { setAuthSession } from '../../store/authSlice';
import { hydrateCart } from '../../store/cartSlice';
import { pushToast, setLanguage } from '../../store/uiSlice';
import { apiRequest, setAuthToken } from '../../lib/api';
import { Modal } from '../ui/Modal';

interface PublicSettings {
  supportEmail?: string;
  supportPhone?: string;
  freeDeliveryThreshold?: number;
}

const SOCIAL_CHANNELS = [
  {
    id: 'youtube',
    label: 'YouTube',
    url: (import.meta.env.VITE_SOCIAL_YOUTUBE_URL as string | undefined)?.trim() || '',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    id: 'facebook',
    label: 'Facebook',
    url: (import.meta.env.VITE_SOCIAL_FACEBOOK_URL as string | undefined)?.trim() || '',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
        <path d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.351C0 23.407.593 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.73 0 1.323-.593 1.323-1.325V1.325C24 .593 23.407 0 22.675 0z" />
      </svg>
    ),
  },
  {
    id: 'x',
    label: 'X (Twitter)',
    url: (import.meta.env.VITE_SOCIAL_X_URL as string | undefined)?.trim() || '',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    id: 'instagram',
    label: 'Instagram',
    url: (import.meta.env.VITE_SOCIAL_INSTAGRAM_URL as string | undefined)?.trim() || '',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
      </svg>
    ),
  },
];

export function Footer() {
  const language = useSelector((s: RootState) => s.ui.language);
  const currentUser = useSelector((s: RootState) => s.auth.user);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<PublicSettings>({
    supportEmail: 'support@novara.com.bd',
    supportPhone: '+880 9612-000888',
    freeDeliveryThreshold: 999,
  });

  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  useEffect(() => {
    apiRequest<{ settings?: PublicSettings }>('/api/catalog/settings')
      .then((res) => {
        if (res.settings) {
          setSettings((prev) => ({ ...prev, ...res.settings }));
        }
      })
      .catch(() => {});
  }, []);

  const openSuperAdminModal = () => {
    setAdminError('');
    setAdminPassword('');
    setAdminModalOpen(true);
  };

  const closeSuperAdminModal = () => {
    if (adminSubmitting) return;
    setAdminModalOpen(false);
    setAdminPassword('');
    setAdminError('');
  };

  const handleSuperAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setAdminSubmitting(true);
    try {
      const res = await apiRequest('/api/auth/super-admin-login', {
        method: 'POST',
        body: JSON.stringify({
          email: adminEmail.trim(),
          password: adminPassword,
        }),
      });
      if (!res.user || res.user.role !== 'super_admin') {
        setAdminError('Access denied. Super Admin privileges are required.');
        return;
      }
      if (res.token) setAuthToken(res.token);
      dispatch(
        setAuthSession({
          user: res.user,
          sellerStore: res.sellerStore ?? null,
          sellerApplication: res.sellerApplication ?? null,
        })
      );
      await dispatch(hydrateCart());
      setAdminModalOpen(false);
      setAdminPassword('');
      setAdminEmail('');
      dispatch(pushToast({ type: 'success', title: 'Super Admin Authenticated' }));
      navigate('/admin');
    } catch (err: any) {
      setAdminError(err?.message || 'Authentication failed. Check your credentials.');
    } finally {
      setAdminSubmitting(false);
    }
  };

  return (
    <footer className="bg-[#0A1A38] text-slate-300 mt-14 border-t border-slate-800/80">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 pt-12 pb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
        {/* Brand, Contact & Social Channels */}
        <div className="sm:col-span-2 lg:col-span-4 space-y-4">
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-[#0D63F3] flex items-center justify-center text-white shadow-xs">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-lg font-extrabold text-white tracking-tight leading-none">
                NOVARA
              </span>
              <span className="block text-[11px] text-slate-400 mt-1">
                Shop Smart, Live Better
              </span>
            </div>
          </Link>

          <p className="text-xs text-slate-300/90 leading-relaxed max-w-sm">
            Trusted multi-vendor e-commerce marketplace across all 64 districts of Bangladesh—connecting verified merchants with transparent pricing and buyer protection.
          </p>

          <div className="space-y-1.5 text-xs text-slate-300 pt-1">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>Banani, Dhaka 1213, Bangladesh</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <a
                href={`mailto:${settings.supportEmail || 'support@novara.com.bd'}`}
                className="hover:text-white transition-colors"
              >
                {settings.supportEmail || 'support@novara.com.bd'}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <a
                href={`tel:${(settings.supportPhone || '+8809612000888').replace(/\s+/g, '')}`}
                className="hover:text-white transition-colors tabular-nums"
              >
                {settings.supportPhone || '+880 9612-000888'}
              </a>
            </div>
          </div>

          <div className="pt-2">
            <p className="text-[11px] font-semibold text-slate-400 mb-2">Connect With Us</p>
            <div className="flex items-center gap-2">
              {SOCIAL_CHANNELS.map((social) => {
                const isConfigured = /^https?:\/\//i.test(social.url);
                const baseClass =
                  'w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-[#0D63F3] hover:border-[#0D63F3] flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-sky-400';

                if (isConfigured) {
                  return (
                    <a
                      key={social.id}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`NOVARA on ${social.label}`}
                      title={social.label}
                      className={baseClass}
                    >
                      {social.icon}
                    </a>
                  );
                }

                return (
                  <Link
                    key={social.id}
                    to="/contact"
                    aria-label={`NOVARA ${social.label} channel`}
                    title={`${social.label} — Contact NOVARA`}
                    className={baseClass}
                  >
                    {social.icon}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-bold text-white mb-3.5">Marketplace</h3>
          <ul className="space-y-2.5 text-xs">
            <li><Link to="/" className="hover:text-white transition-colors">Home</Link></li>
            <li><Link to="/search" className="hover:text-white transition-colors">Explore Catalog</Link></li>
            <li><Link to="/shops" className="hover:text-white transition-colors">Verified Stores</Link></li>
            <li><Link to="/about" className="hover:text-white transition-colors">About NOVARA</Link></li>
            <li><Link to="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
          </ul>
        </div>

        {/* Customer Service */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-bold text-white mb-3.5">Customer Service</h3>
          <ul className="space-y-2.5 text-xs">
            <li><Link to="/help" className="hover:text-white transition-colors">Help Center</Link></li>
            <li><Link to="/orders" className="hover:text-white transition-colors">Track &amp; Orders</Link></li>
            <li><Link to="/shipping-policy" className="hover:text-white transition-colors">Shipping Policy</Link></li>
            <li><Link to="/return-policy" className="hover:text-white transition-colors">Return &amp; Refund</Link></li>
            <li><Link to="/account/support" className="hover:text-white transition-colors">Support Tickets</Link></li>
          </ul>
        </div>

        {/* Seller & Policies */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-bold text-white mb-3.5">Sell &amp; Policies</h3>
          <ul className="space-y-2.5 text-xs">
            <li><Link to="/become-a-seller" className="hover:text-white transition-colors">Become a Seller</Link></li>
            <li><Link to="/seller" className="hover:text-white transition-colors">Seller Center</Link></li>
            <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
            <li><Link to="/terms" className="hover:text-white transition-colors">Terms &amp; Conditions</Link></li>
          </ul>
        </div>

        {/* Payments & Regional Settings */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white mb-3.5">Payment Methods</h3>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
              <div className="px-2.5 py-1.5 rounded-lg bg-white text-[#E2136E] text-center">bKash</div>
              <div className="px-2.5 py-1.5 rounded-lg bg-white text-[#F15A24] text-center">Nagad</div>
              <div className="px-2.5 py-1.5 rounded-lg bg-white text-[#1A1F71] text-center">VISA</div>
              <div className="px-2.5 py-1.5 rounded-lg bg-white text-[#EB001B] text-center">Mastercard</div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2.5 leading-snug">
              Cash on Delivery across 64 districts.
              {settings.freeDeliveryThreshold ? ` Free delivery over ৳${settings.freeDeliveryThreshold}.` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <select
              aria-label="Select marketplace language"
              value={language}
              onChange={(e) => dispatch(setLanguage(e.target.value as 'en' | 'bn'))}
              className="px-2.5 py-1.5 rounded-lg bg-[#15294F] border border-slate-700 text-xs text-white outline-none focus:border-sky-400"
            >
              <option value="en">English</option>
              <option value="bn">বাংলা</option>
            </select>
            <span className="px-2.5 py-1.5 rounded-lg bg-[#15294F] border border-slate-700 text-xs text-white font-semibold tabular-nums">
              ৳ BDT
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Legal & Discreet Super Admin Portal Entry */}
      <div className="border-t border-slate-800/90 bg-[#08152E]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
            <span>© 2026 NOVARA Bangladesh. All rights reserved.</span>
            <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
              <span aria-hidden="true" className="text-slate-600 hidden sm:inline">·</span>
              <Link to="/privacy" className="hover:text-slate-200 transition-colors">Privacy</Link>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <Link to="/terms" className="hover:text-slate-200 transition-colors">Terms</Link>
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.focus();
              openSuperAdminModal();
            }}
            aria-label="Super Admin Access"
            title="Super Admin Access"
            className="p-2 shrink-0 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Dedicated Super Admin Authentication Modal */}
      <Modal
        open={adminModalOpen}
        title="Super Admin Access"
        onClose={closeSuperAdminModal}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSuperAdminLogin} className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
            <Shield className="w-4 h-4 text-[#0D63F3] shrink-0 mt-0.5" />
            <p>
              Restricted administrative console. Sign in with an authorized Super Admin account to manage NOVARA governance and operations.
            </p>
          </div>

          {currentUser?.role === 'super_admin' && (
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-slate-800">
              <span className="truncate">
                Active session: <strong>{currentUser.email}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setAdminModalOpen(false);
                  navigate('/admin');
                }}
                className="px-3 py-1.5 rounded-lg bg-[#0D63F3] text-white font-bold whitespace-nowrap shrink-0 cursor-pointer"
              >
                Open Console
              </button>
            </div>
          )}

          {adminError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#EF3E36] flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{adminError}</span>
            </div>
          )}

          <div>
            <label htmlFor="super-admin-email" className="block text-xs font-semibold text-slate-700 mb-1">
              Super Admin Email
            </label>
            <input
              id="super-admin-email"
              type="email"
              required
              autoFocus
              autoComplete="username"
              placeholder="superadmin@novara.com.bd"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900 outline-none focus:border-[#0D63F3]"
            />
          </div>

          <div>
            <label htmlFor="super-admin-password" className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <input
              id="super-admin-password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Enter Super Admin password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900 outline-none focus:border-[#0D63F3]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeSuperAdminModal}
              disabled={adminSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adminSubmitting}
              className="px-5 py-2 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
            >
              {adminSubmitting ? 'Verifying...' : 'Sign In to Console'}
            </button>
          </div>
        </form>
      </Modal>
    </footer>
  );
}
