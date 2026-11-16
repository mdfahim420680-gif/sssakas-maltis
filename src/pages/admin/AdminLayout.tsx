import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Award,
  BarChart3,
  Bell,
  Box,
  ChevronDown,
  ChevronRight,
  DollarSign,
  ExternalLink,
  FileCheck,
  Globe,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Maximize2,
  Megaphone,
  Menu,
  MessageSquare,
  Minimize2,
  Package,
  PlusSquare,
  RotateCcw,
  Search,
  Settings,
  ShoppingBag,
  Store,
  Tag,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { AppDispatch, RootState } from '../../store';
import { logoutUser } from '../../store/authSlice';
import { pushToast, setLanguage } from '../../store/uiSlice';
import { apiRequest, formatBDT } from '../../lib/api';

interface BadgeCounts {
  orders?: number;
  sellers?: number;
  pendingProducts?: number;
  returns?: number;
  tickets?: number;
  payouts?: number;
}

interface AdminSearchResults {
  orders: Array<{ _id: string; orderNumber: string; grandTotal: number; paymentStatus: string }>;
  products: Array<{ _id: string; title: string; moderationStatus: string }>;
  sellers: Array<{ _id: string; name: string; district: string; status: string }>;
  users: Array<{ _id: string; name: string; email: string; role: string }>;
  coupons: Array<{ _id: string; code: string; title: string; active: boolean }>;
}

interface AdminNotificationItem {
  _id: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

interface NavLeaf {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  badgeKey?: keyof BadgeCounts;
  roles: string[];
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  children: NavLeaf[];
}

const ALL_ADMIN_ROLES = [
  'super_admin',
  'admin',
  'catalog_manager',
  'order_manager',
  'finance_manager',
  'support_agent',
  'content_manager',
];

const PRIMARY_ITEMS: NavLeaf[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, roles: ALL_ADMIN_ROLES },
  { to: '/admin/analytics', label: 'Analytics', icon: TrendingUp, roles: ALL_ADMIN_ROLES },
  {
    to: '/admin/orders',
    label: 'Orders',
    icon: Package,
    badgeKey: 'orders',
    roles: ['super_admin', 'admin', 'order_manager'],
  },
];

const PRODUCT_GROUP: NavGroup = {
  id: 'products',
  label: 'Products',
  icon: Box,
  roles: ['super_admin', 'admin', 'catalog_manager'],
  children: [
    { to: '/admin/products', label: 'All Products', icon: Box, roles: ['super_admin', 'admin', 'catalog_manager'] },
    { to: '/admin/products/create', label: 'Add Product', icon: PlusSquare, roles: ['super_admin', 'admin', 'catalog_manager'] },
    { to: '/admin/categories', label: 'Categories', icon: Layers, roles: ['super_admin', 'admin', 'catalog_manager'] },
    { to: '/admin/brands', label: 'Brands', icon: Award, roles: ['super_admin', 'admin', 'catalog_manager'] },
  ],
};

const DIRECTORY_ITEMS: NavLeaf[] = [
  {
    to: '/admin/sellers',
    label: 'Sellers',
    icon: Store,
    badgeKey: 'sellers',
    roles: ['super_admin', 'admin'],
  },
  {
    to: '/admin/customers',
    label: 'Customers',
    icon: UserCheck,
    roles: ['super_admin', 'admin', 'support_agent', 'order_manager'],
  },
  {
    to: '/admin/users',
    label: 'Users & RBAC',
    icon: Users,
    roles: ['super_admin', 'admin'],
  },
];

const MARKETING_GROUP: NavGroup = {
  id: 'marketing',
  label: 'Marketing',
  icon: Megaphone,
  roles: ['super_admin', 'admin', 'content_manager'],
  children: [
    { to: '/admin/ads', label: 'Advertisements', icon: Megaphone, roles: ['super_admin', 'admin', 'content_manager'] },
    { to: '/admin/banners', label: 'Banners & Sliders', icon: ImageIcon, roles: ['super_admin', 'admin', 'content_manager'] },
    { to: '/admin/promotions', label: 'Coupons & Promos', icon: Tag, roles: ['super_admin', 'admin', 'content_manager'] },
    { to: '/admin/cms', label: 'Homepage CMS', icon: LayoutTemplate, roles: ['super_admin', 'admin', 'content_manager'] },
  ],
};

const ENGAGEMENT_ITEMS: NavLeaf[] = [
  {
    to: '/admin/reviews',
    label: 'Reviews',
    icon: Award,
    roles: ['super_admin', 'admin', 'catalog_manager', 'support_agent'],
  },
  {
    to: '/admin/support',
    label: 'Support Inbox',
    icon: MessageSquare,
    badgeKey: 'tickets',
    roles: ['super_admin', 'admin', 'support_agent'],
  },
];

const REPORTS_GROUP: NavGroup = {
  id: 'reports',
  label: 'Reports & Finance',
  icon: BarChart3,
  roles: ['super_admin', 'admin', 'finance_manager', 'order_manager'],
  children: [
    { to: '/admin/finance', label: 'Finance & Payouts', icon: DollarSign, badgeKey: 'payouts', roles: ['super_admin', 'admin', 'finance_manager'] },
    { to: '/admin/returns', label: 'Returns & Refunds', icon: RotateCcw, badgeKey: 'returns', roles: ['super_admin', 'admin', 'order_manager', 'finance_manager'] },
  ],
};

const SYSTEM_GROUP: NavGroup = {
  id: 'system',
  label: 'System & Settings',
  icon: Settings,
  roles: ['super_admin', 'admin', 'catalog_manager', 'content_manager'],
  children: [
    { to: '/admin/search', label: 'Search & Synonyms', icon: Search, roles: ['super_admin', 'admin', 'catalog_manager', 'content_manager'] },
    { to: '/admin/audit', label: 'Audit Logs', icon: FileCheck, roles: ['super_admin', 'admin'] },
    { to: '/admin/settings', label: 'Store Settings', icon: Settings, roles: ['super_admin', 'admin'] },
  ],
};

export function AdminLayout() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((s: RootState) => s.auth.user);
  const language = useSelector((s: RootState) => s.ui.language);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    products: true,
    marketing: true,
    reports: false,
    system: false,
  });

  const [badgeCounts, setBadgeCounts] = useState<BadgeCounts>({});
  const [dbMode, setDbMode] = useState<'atlas' | 'memory'>('atlas');
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AdminSearchResults | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const notifWrapRef = useRef<HTMLDivElement>(null);
  const profileWrapRef = useRef<HTMLDivElement>(null);

  const userRole = user?.role || 'customer';
  const canSee = (roles: string[]) => userRole === 'super_admin' || roles.includes(userRole);

  // Sync sidebar open groups with active route
  useEffect(() => {
    setMobileOpen(false);
    const p = location.pathname;
    if (p.startsWith('/admin/products') || p.startsWith('/admin/categories') || p.startsWith('/admin/brands') || p.startsWith('/admin/catalog')) {
      setOpenGroups((prev) => ({ ...prev, products: true }));
    } else if (p.startsWith('/admin/ads') || p.startsWith('/admin/banners') || p.startsWith('/admin/promotions') || p.startsWith('/admin/cms')) {
      setOpenGroups((prev) => ({ ...prev, marketing: true }));
    } else if (p.startsWith('/admin/finance') || p.startsWith('/admin/returns')) {
      setOpenGroups((prev) => ({ ...prev, reports: true }));
    } else if (p.startsWith('/admin/search') || p.startsWith('/admin/audit') || p.startsWith('/admin/settings')) {
      setOpenGroups((prev) => ({ ...prev, system: true }));
    }
  }, [location.pathname]);

  // Fetch badge counts & notifications
  const loadSidebarTelemetry = () => {
    apiRequest<{ badgeCounts?: BadgeCounts; unreadNotifications?: number; databaseMode?: 'atlas' | 'memory' }>(
      '/api/admin/dashboard?range=30d'
    )
      .then((res) => {
        if (res.badgeCounts) setBadgeCounts(res.badgeCounts);
        if (typeof res.unreadNotifications === 'number') setUnreadNotifications(res.unreadNotifications);
        if (res.databaseMode) setDbMode(res.databaseMode);
      })
      .catch(() => {
        // Non-blocking for header badges
      });
  };

  useEffect(() => {
    loadSidebarTelemetry();
  }, [location.pathname]);

  // Keyboard shortcut Ctrl+K / Cmd+K for Admin Global Search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotifOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close popovers on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchWrapRef.current && !searchWrapRef.current.contains(target)) setSearchOpen(false);
      if (notifWrapRef.current && !notifWrapRef.current.contains(target)) setNotifOpen(false);
      if (profileWrapRef.current && !profileWrapRef.current.contains(target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Debounced live global search
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      apiRequest<{ success: boolean } & AdminSearchResults>(`/api/admin/search?q=${encodeURIComponent(trimmed)}`)
        .then((res) => {
          setSearchResults({
            orders: res.orders || [],
            products: res.products || [],
            sellers: res.sellers || [],
            users: res.users || [],
            coupons: res.coupons || [],
          });
        })
        .catch(() => setSearchResults(null))
        .finally(() => setSearching(false));
    }, 220);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const openNotifications = async () => {
    const next = !notifOpen;
    setNotifOpen(next);
    setProfileOpen(false);
    if (next) {
      try {
        const res = await apiRequest<{ notifications: AdminNotificationItem[]; unreadCount: number }>(
          '/api/admin/notifications'
        );
        setNotifications(res.notifications || []);
        setUnreadNotifications(res.unreadCount || 0);
      } catch {
        // Ignore transient fetch errors
      }
    }
  };

  const markAllRead = async () => {
    try {
      await apiRequest('/api/admin/notifications/read', { method: 'PATCH' });
      setUnreadNotifications(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to mark notifications read';
      dispatch(pushToast({ type: 'error', title: 'Error', message }));
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Some sandboxed iframes disallow fullscreen API
    }
  };

  const handleLogout = async () => {
    await dispatch(logoutUser());
    dispatch(pushToast({ type: 'info', title: 'Signed out of Admin Panel' }));
    navigate('/login');
  };

  const renderLeafLink = (item: NavLeaf, nested = false) => {
    if (!canSee(item.roles)) return null;
    const count = item.badgeKey ? badgeCounts[item.badgeKey] || 0 : 0;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          `group flex items-center justify-between gap-2.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-all whitespace-nowrap ${
            nested ? 'pl-10 py-1.5 text-[12.5px]' : ''
          } ${
            isActive
              ? 'bg-[#0D63F3] text-white shadow-[0_6px_18px_-4px_rgba(13,99,243,0.65)]'
              : 'text-slate-300 hover:bg-white/[0.08] hover:text-white'
          }`
        }
      >
        <span className="flex items-center gap-3 min-w-0">
          <item.icon className="w-[17px] h-[17px] shrink-0 opacity-90" />
          <span className="truncate">{item.label}</span>
        </span>
        {count > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-[#1B75FF] text-white text-[10px] font-bold tabular-nums shrink-0 group-[.active]:bg-white/20">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </NavLink>
    );
  };

  const renderGroup = (group: NavGroup) => {
    if (!canSee(group.roles)) return null;
    const visibleChildren = group.children.filter((c) => canSee(c.roles));
    if (visibleChildren.length === 0) return null;
    const isOpen = Boolean(openGroups[group.id]);

    return (
      <div key={group.id} className="space-y-1">
        <button
          type="button"
          onClick={() => setOpenGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
          aria-expanded={isOpen}
          className="w-full flex items-center justify-between gap-2.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold text-slate-300 hover:bg-white/[0.08] hover:text-white transition-colors whitespace-nowrap"
        >
          <span className="flex items-center gap-3 min-w-0">
            <group.icon className="w-[17px] h-[17px] shrink-0 opacity-90" />
            <span className="truncate">{group.label}</span>
          </span>
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          )}
        </button>
        {isOpen && <div className="space-y-0.5">{visibleChildren.map((child) => renderLeafLink(child, true))}</div>}
      </div>
    );
  };

  const initials = (user?.name || 'AD')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  const sidebarBody = (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#071636] via-[#091D48] to-[#081738] text-white select-none">
      {/* Brand Area */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-white/10 shrink-0">
        <Link to="/admin" className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#0D63F3] flex items-center justify-center shadow-[0_6px_16px_rgba(13,99,243,0.45)] shrink-0">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[16px] font-extrabold tracking-tight text-white leading-none">NOVARA</p>
            <p className="text-[11px] font-medium text-blue-200/80 mt-1 leading-none">Admin Panel</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-300 hover:bg-white/10"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto px-3 pt-3 pb-6 space-y-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]"
        aria-label="Admin sidebar navigation"
      >
        {PRIMARY_ITEMS.map((item) => renderLeafLink(item))}
        {renderGroup(PRODUCT_GROUP)}
        {DIRECTORY_ITEMS.map((item) => renderLeafLink(item))}
        {renderGroup(MARKETING_GROUP)}
        {ENGAGEMENT_ITEMS.map((item) => renderLeafLink(item))}
        {renderGroup(REPORTS_GROUP)}
        {renderGroup(SYSTEM_GROUP)}
      </nav>

      {/* Bottom Live Storefront + Admin Profile + Logout */}
      <div className="p-3 border-t border-white/10 space-y-2.5 shrink-0">
        <div className="rounded-xl bg-white/[0.06] border border-white/10 p-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-[11px] font-bold text-white truncate">Your Store is Live</span>
            </div>
            <p className="text-[10px] text-blue-200/75 mt-0.5 truncate">
              {dbMode === 'atlas' ? 'MongoDB Atlas Sync' : 'Local Dev Database'}
            </p>
          </div>
          <div className="flex items-end gap-0.5 h-5 shrink-0" aria-hidden="true">
            <span className="w-1 h-2 bg-blue-400/50 rounded-full" />
            <span className="w-1 h-3 bg-blue-400/70 rounded-full" />
            <span className="w-1 h-4 bg-blue-400 rounded-full" />
            <span className="w-1 h-5 bg-[#3B82F6] rounded-full" />
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-white/[0.04]">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0D63F3] to-[#38BDF8] flex items-center justify-center text-xs font-extrabold text-white shrink-0">
            {initials || 'AD'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate">{user?.name}</p>
            <p className="text-[10px] font-medium text-blue-200/75 uppercase tracking-wider truncate">
              {userRole.replace(/_/g, ' ')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/[0.08] hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  const hasSearchHits =
    searchResults &&
    (searchResults.orders.length > 0 ||
      searchResults.products.length > 0 ||
      searchResults.sellers.length > 0 ||
      searchResults.users.length > 0 ||
      searchResults.coupons.length > 0);

  return (
    <div className="min-h-screen flex bg-[#F3F6FB] text-slate-900">
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:block w-[252px] shrink-0 sticky top-0 h-screen z-40 shadow-xl">
        {sidebarBody}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/55 backdrop-blur-[1px]"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-[264px] max-w-[85vw] h-full z-10 shadow-2xl">{sidebarBody}</aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Dedicated Admin Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur border-b border-slate-200/80 px-4 lg:px-7 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              aria-label="Open admin menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Global Admin Search */}
            <div ref={searchWrapRef} className="relative w-full max-w-md">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onFocus={() => setSearchOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  placeholder="Search anything... (Ctrl + K)"
                  aria-label="Global admin search"
                  className="w-full h-10 pl-10 pr-4 rounded-full bg-[#F4F7FC] border border-slate-200/90 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0D63F3] focus:bg-white transition-colors"
                />
              </div>

              {searchOpen && searchQuery.trim().length > 0 && (
                <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 z-50 max-h-[70vh] overflow-y-auto">
                  {searching ? (
                    <p className="text-xs text-slate-500 py-3 px-2">Searching marketplace records...</p>
                  ) : !hasSearchHits ? (
                    <p className="text-xs text-slate-500 py-3 px-2">No matching orders, products, sellers, or users.</p>
                  ) : (
                    <div className="space-y-3 text-xs">
                      {searchResults!.orders.length > 0 && (
                        <div>
                          <p className="px-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                            Orders
                          </p>
                          {searchResults!.orders.map((o) => (
                            <button
                              key={o._id}
                              type="button"
                              onClick={() => {
                                setSearchOpen(false);
                                navigate(`/admin/orders?q=${encodeURIComponent(o.orderNumber)}`);
                              }}
                              className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-slate-50 text-left"
                            >
                              <span className="font-mono-num font-bold text-slate-900">#{o.orderNumber}</span>
                              <span className="font-semibold text-[#0D63F3] tabular-nums">{formatBDT(o.grandTotal)}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults!.products.length > 0 && (
                        <div>
                          <p className="px-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                            Products
                          </p>
                          {searchResults!.products.map((p) => (
                            <button
                              key={p._id}
                              type="button"
                              onClick={() => {
                                setSearchOpen(false);
                                navigate(`/admin/products/${p._id}/edit`);
                              }}
                              className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-slate-50 text-left gap-2"
                            >
                              <span className="font-semibold text-slate-900 truncate">{p.title}</span>
                              <span className="text-[10px] font-bold uppercase text-slate-500 shrink-0">
                                {p.moderationStatus}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults!.sellers.length > 0 && (
                        <div>
                          <p className="px-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                            Sellers
                          </p>
                          {searchResults!.sellers.map((s) => (
                            <button
                              key={s._id}
                              type="button"
                              onClick={() => {
                                setSearchOpen(false);
                                navigate('/admin/sellers');
                              }}
                              className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-slate-50 text-left"
                            >
                              <span className="font-semibold text-slate-900">{s.name}</span>
                              <span className="text-[11px] text-slate-500">{s.district}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults!.users.length > 0 && (
                        <div>
                          <p className="px-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                            Users
                          </p>
                          {searchResults!.users.map((u) => (
                            <button
                              key={u._id}
                              type="button"
                              onClick={() => {
                                setSearchOpen(false);
                                navigate(u.role === 'customer' ? '/admin/customers' : '/admin/users');
                              }}
                              className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-slate-50 text-left gap-2"
                            >
                              <span className="font-semibold text-slate-900 truncate">{u.name}</span>
                              <span className="text-[11px] text-slate-500 truncate">{u.email}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults!.coupons.length > 0 && (
                        <div>
                          <p className="px-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                            Coupons
                          </p>
                          {searchResults!.coupons.map((c) => (
                            <button
                              key={c._id}
                              type="button"
                              onClick={() => {
                                setSearchOpen(false);
                                navigate('/admin/promotions');
                              }}
                              className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-slate-50 text-left"
                            >
                              <span className="font-mono-num font-bold text-[#0D63F3]">{c.code}</span>
                              <span className="text-slate-600 truncate">{c.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Admin Header Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/"
              className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>Storefront</span>
            </Link>

            {/* Notifications */}
            <div ref={notifWrapRef} className="relative">
              <button
                type="button"
                onClick={openNotifications}
                aria-label="Admin notifications"
                className="relative w-9 h-9 rounded-full bg-[#F4F7FC] hover:bg-slate-200/70 flex items-center justify-center text-slate-700 transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#EF3E36] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-extrabold text-slate-900">Notifications</span>
                    {unreadNotifications > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="text-[11px] font-bold text-[#0D63F3] hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 mt-1">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-500 py-5 text-center">You have no new notifications.</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n._id}
                          type="button"
                          onClick={() => {
                            setNotifOpen(false);
                            if (n.link) navigate(n.link);
                          }}
                          className={`w-full text-left py-2.5 px-2 rounded-lg hover:bg-slate-50 transition-colors ${
                            !n.read ? 'bg-blue-50/50' : ''
                          }`}
                        >
                          <p className="text-xs font-bold text-slate-900">{n.title}</p>
                          <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {new Date(n.createdAt).toLocaleString()}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label="Toggle fullscreen"
              className="hidden sm:flex w-9 h-9 rounded-full bg-[#F4F7FC] hover:bg-slate-200/70 items-center justify-center text-slate-700 transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Language Switch */}
            <button
              type="button"
              onClick={() => dispatch(setLanguage(language === 'en' ? 'bn' : 'en'))}
              className="h-9 px-2.5 sm:px-3 rounded-full bg-[#F4F7FC] hover:bg-slate-200/70 flex items-center gap-1.5 text-xs font-bold text-slate-700 transition-colors whitespace-nowrap"
              aria-label="Switch admin interface language"
            >
              <Globe className="w-3.5 h-3.5 text-[#0D63F3]" />
              <span className="hidden sm:inline">{language === 'en' ? 'English' : 'বাংলা'}</span>
            </button>

            {/* Profile Menu */}
            <div ref={profileWrapRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((prev) => !prev);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-[#0D63F3] text-white text-[11px] font-extrabold flex items-center justify-center">
                  {initials || 'AD'}
                </div>
                <span className="hidden sm:inline text-xs font-bold text-slate-800 max-w-[110px] truncate">
                  {user?.name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl border border-slate-200 shadow-xl py-1.5 z-50 text-xs">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <p className="font-bold text-slate-900 truncate">{user?.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                  </div>
                  <Link
                    to="/admin/settings"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-semibold"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Platform Settings</span>
                  </Link>
                  <Link
                    to="/"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Public Storefront</span>
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-[#EF3E36] hover:bg-red-50 font-bold text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Admin Page Content */}
        <main className="flex-1 p-4 lg:p-7 max-w-[1560px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
