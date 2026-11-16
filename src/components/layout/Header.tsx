import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  ChevronDown,
  Flame,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
  Truck,
  User as UserIcon,
  X,
} from 'lucide-react';
import { AppDispatch, RootState } from '../../store';
import { logoutUser } from '../../store/authSlice';
import { setCartDrawerOpen } from '../../store/cartSlice';
import { dismissAnnouncement } from '../../store/uiSlice';
import { apiRequest, formatBDT } from '../../lib/api';
import { ImageWithFallback } from '../ui/ImageWithFallback';

interface HeaderCategory {
  _id: string;
  name: string;
  bnName: string;
  slug: string;
}

interface AutocompleteItem {
  _id: string;
  title: string;
  bnTitle?: string;
  slug: string;
  image: string;
  minPrice: number;
  discountPercent: number;
  categoryName: string;
}

export function Header() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();

  const { user, sellerStore } = useSelector((s: RootState) => s.auth);
  const cartItems = useSelector((s: RootState) => s.cart.items);
  const announcementDismissed = useSelector((s: RootState) => s.ui.announcementDismissed);

  const [categories, setCategories] = useState<HeaderCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showCatMenu, setShowCatMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const requestSeqRef = useRef(0);

  const [announcementText, setAnnouncementText] = useState('');

  useEffect(() => {
    apiRequest<{ categories: HeaderCategory[] }>('/api/catalog/categories')
      .then((res) => setCategories(res.categories || []))
      .catch(() => {});
    apiRequest<{ settings?: { announcementText?: string } }>('/api/catalog/settings')
      .then((res) => {
        if (res.settings?.announcementText) {
          setAnnouncementText(res.settings.announcementText);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setShowSuggestions(false);
    setShowCatMenu(false);
    setShowUserMenu(false);
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Debounced autocomplete with stale-request protection
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 1) {
      setSuggestions([]);
      setSearchLoading(false);
      return;
    }

    const seq = ++requestSeqRef.current;
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: trimmed });
        if (selectedCategory) params.set('category', selectedCategory);
        const res = await apiRequest<{ suggestions: AutocompleteItem[] }>(
          `/api/catalog/autocomplete?${params.toString()}`
        );
        if (seq === requestSeqRef.current) {
          setSuggestions(res.suggestions || []);
          setActiveIndex(-1);
        }
      } catch {
        if (seq === requestSeqRef.current) setSuggestions([]);
      } finally {
        if (seq === requestSeqRef.current) setSearchLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (selectedCategory) params.set('category', selectedCategory);
    setShowSuggestions(false);
    navigate(`/search?${params.toString()}`);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      return;
    }
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      const chosen = suggestions[activeIndex];
      setShowSuggestions(false);
      navigate(`/product/${chosen.slug}`);
    }
  };

  const totalCartQty = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const isAdmin =
    user &&
    [
      'super_admin',
      'admin',
      'catalog_manager',
      'order_manager',
      'finance_manager',
      'support_agent',
      'content_manager',
    ].includes(user.role);

  return (
    <header className="w-full bg-white sticky top-0 z-50 shadow-[0_1px_4px_rgba(15,23,42,0.05)]">
      {/* Row 1: Deep Navy Announcement Bar matching NOVARA reference */}
      {!announcementDismissed && (
        <div className="bg-[#0B1F4B] text-white text-[11.5px] sm:text-xs">
          <div className="max-w-[1360px] mx-auto px-4 h-9 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 overflow-x-auto no-scrollbar whitespace-nowrap">
              {(() => {
                const parts = announcementText
                  ? announcementText.split('|').map((s) => s.trim()).filter(Boolean)
                  : [
                      'Free Delivery on orders over ৳999',
                      'Mega Sale is Live! Up to 70% OFF',
                      'Secure Payment',
                    ];
                return (
                  <>
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <Truck className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                      {parts[0]}
                    </span>
                    {parts[1] && (
                      <>
                        <span className="hidden md:inline text-white/30">|</span>
                        <span className="hidden md:inline-flex items-center gap-1.5 font-medium">
                          <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          {parts[1]}
                        </span>
                      </>
                    )}
                    {parts[2] && (
                      <>
                        <span className="hidden lg:inline text-white/30">|</span>
                        <span className="hidden lg:inline-flex items-center gap-1.5 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          {parts[2]}
                        </span>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link to="/help" className="hidden sm:inline text-sky-200 hover:text-white font-medium">
                Help Center
              </Link>
              <button
                type="button"
                aria-label="Dismiss announcement bar"
                onClick={() => dispatch(dismissAnnouncement())}
                className="p-1 text-white/70 hover:text-white rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Row 2: Main Brand + Unified Search Bar + Account/Wishlist/Cart */}
      <div className="max-w-[1360px] mx-auto px-4 py-3 flex items-center justify-between gap-3 md:gap-6">
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            aria-label="Toggle mobile menu"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-10 h-10 rounded-xl bg-[#0D63F3] flex items-center justify-center text-white shadow-sm group-hover:bg-[#0A52CC] transition-colors">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <span className="block text-[20px] font-extrabold tracking-tight text-[#0B1F4B]">
                NOVARA
              </span>
              <span className="block text-[10px] font-medium text-slate-500">
                Shop Smart, Live Better
              </span>
            </div>
          </Link>
        </div>

        {/* Center Unified Search Bar */}
        <div ref={searchContainerRef} className="hidden md:block flex-1 max-w-2xl relative">
          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center h-11 rounded-lg border border-slate-300 bg-white focus-within:border-[#0D63F3] focus-within:ring-2 focus-within:ring-blue-500/15 overflow-hidden"
          >
            <select
              aria-label="Filter search by category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-full pl-3.5 pr-2 bg-slate-50 border-r border-slate-200 text-xs font-semibold text-slate-700 outline-none cursor-pointer max-w-[150px]"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>

            <input
              type="search"
              value={searchQuery}
              onFocus={() => searchQuery.trim() && setShowSuggestions(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search for products... (e.g. Earbuds, স্মার্টওয়াচ)"
              aria-label="Search for products"
              className="flex-1 h-full px-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none"
            />

            <button
              type="submit"
              aria-label="Submit product search"
              className="h-full px-5 bg-[#0D63F3] hover:bg-[#0A52CC] text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>

          {/* Autocomplete Dropdown */}
          {showSuggestions && searchQuery.trim().length > 0 && (
            <div
              role="listbox"
              aria-label="Search suggestions"
              className="absolute left-0 right-0 top-12 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-[60]"
            >
              {searchLoading ? (
                <div className="p-4 text-xs text-slate-500">Searching NOVARA catalog...</div>
              ) : suggestions.length === 0 ? (
                <div className="p-4 text-xs text-slate-500">
                  No matching products found for "{searchQuery}". Press Enter to view all search filters.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {suggestions.map((s, idx) => (
                    <Link
                      key={s._id}
                      to={`/product/${s.slug}`}
                      onClick={() => setShowSuggestions(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/70 transition-colors ${
                        idx === activeIndex ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                        <ImageWithFallback src={s.image} alt={s.title} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{s.title}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {s.categoryName} {s.bnTitle ? `· ${s.bnTitle}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-[#EF3E36] tabular-nums">
                          {formatBDT(s.minPrice)}
                        </span>
                        {s.discountPercent > 0 && (
                          <span className="block text-[10px] font-semibold text-emerald-600">
                            -{s.discountPercent}%
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleSearchSubmit()}
                    className="w-full px-4 py-2.5 text-xs font-bold text-[#0D63F3] bg-slate-50 hover:bg-slate-100 text-left"
                  >
                    See all results for "{searchQuery}" →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Icons: Account, Wishlist, Cart */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => (user ? setShowUserMenu((v) => !v) : navigate('/login'))}
              aria-label={user ? `Account menu for ${user.name}` : 'Sign in or register'}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
            >
              <UserIcon className="w-5 h-5" />
              <span className="hidden xl:inline text-xs font-semibold max-w-[100px] truncate">
                {user ? user.name.split(' ')[0] : 'Sign In'}
              </span>
            </button>

            {showUserMenu && user && (
              <div className="absolute right-0 top-12 w-56 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 z-[60]">
                <div className="px-3.5 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900 truncate">{user.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                </div>
                <Link
                  to="/account"
                  className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <UserIcon className="w-3.5 h-3.5" /> My Account
                </Link>
                <Link
                  to="/orders"
                  className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Package className="w-3.5 h-3.5" /> My Orders
                </Link>
                {sellerStore && sellerStore.status === 'active' && (
                  <Link
                    to="/seller"
                    className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#0D63F3] hover:bg-blue-50"
                  >
                    <Store className="w-3.5 h-3.5" /> Seller Center
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" /> Admin Control Center
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    dispatch(logoutUser());
                    setShowUserMenu(false);
                    navigate('/');
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 border-t border-slate-100 mt-1"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            )}
          </div>

          <Link
            to="/wishlist"
            aria-label="Wishlist"
            className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <Heart className="w-5 h-5" />
            {(user?.wishlistCount || 0) > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#0D63F3] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {user?.wishlistCount}
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={() => dispatch(setCartDrawerOpen(true))}
            aria-label={`Open shopping cart with ${totalCartQty} items`}
            className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
          >
            <ShoppingCart className="w-5 h-5" />
            {totalCartQty > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF3E36] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {totalCartQty}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="md:hidden px-4 pb-2.5">
        <form
          onSubmit={handleSearchSubmit}
          className="flex items-center h-10 rounded-lg border border-slate-300 bg-white overflow-hidden"
        >
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products (English / বাংলা)..."
            aria-label="Search products mobile"
            className="flex-1 h-full px-3 text-sm outline-none"
          />
          <button
            type="submit"
            aria-label="Search"
            className="h-full px-4 bg-[#0D63F3] text-white flex items-center justify-center"
          >
            <Search className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Row 3: Navigation Bar matching NOVARA reference */}
      <div className="hidden lg:block border-t border-slate-200/80 bg-white">
        <div className="max-w-[1360px] mx-auto px-4 h-12 flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCatMenu((v) => !v)}
                className="h-9 px-4 rounded-lg bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <Menu className="w-4 h-4" />
                All Categories
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showCatMenu && (
                <div className="absolute left-0 top-11 w-60 bg-white rounded-xl border border-slate-200 shadow-xl py-2 z-[60]">
                  {categories.map((c) => (
                    <Link
                      key={c._id}
                      to={`/category/${c.slug}`}
                      className="flex items-center justify-between px-4 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-[#0D63F3]"
                    >
                      <span>{c.name}</span>
                      <span className="text-[11px] text-slate-400">{c.bnName}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <nav aria-label="Main navigation" className="flex items-center gap-6 text-[13px] font-semibold">
              <Link
                to="/"
                className={`whitespace-nowrap transition-colors ${
                  location.pathname === '/' ? 'text-[#0D63F3]' : 'text-slate-700 hover:text-[#0D63F3]'
                }`}
              >
                Home
              </Link>
              <Link
                to="/search?discounted=true"
                className="relative whitespace-nowrap text-slate-700 hover:text-[#0D63F3] transition-colors flex items-center gap-1"
              >
                Flash Sale
                <span className="px-1.5 py-0.2 rounded bg-[#EF3E36] text-white text-[9px] font-bold leading-4">
                  Hot
                </span>
              </Link>
              <Link to="/search?discounted=true" className="whitespace-nowrap text-slate-700 hover:text-[#0D63F3]">
                Deals
              </Link>
              <Link to="/search?sort=newest" className="whitespace-nowrap text-slate-700 hover:text-[#0D63F3]">
                New Arrivals
              </Link>
              <Link to="/search?sort=relevance" className="whitespace-nowrap text-slate-700 hover:text-[#0D63F3]">
                Best Selling
              </Link>
              <Link to="/search" className="whitespace-nowrap text-slate-700 hover:text-[#0D63F3]">
                Brands
              </Link>
              <Link to="/shops" className="whitespace-nowrap text-slate-700 hover:text-[#0D63F3]">
                Shops
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isAdmin && (
              <Link
                to="/admin"
                className="h-9 px-3.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Admin Panel
              </Link>
            )}
            <Link
              to={sellerStore?.status === 'active' ? '/seller' : '/become-a-seller'}
              className="h-9 px-4 rounded-lg bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shadow-sm"
            >
              <Store className="w-3.5 h-3.5" />
              {sellerStore?.status === 'active' ? 'Seller Center' : 'Become a Seller'}
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Link to="/" className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold">Home</Link>
            <Link to="/search?discounted=true" className="px-3 py-1.5 rounded-lg bg-red-50 text-[#EF3E36] text-xs font-semibold">Flash Sale</Link>
            <Link to="/search" className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold">All Products</Link>
            <Link to="/shops" className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold">Verified Shops</Link>
            <Link to={sellerStore?.status === 'active' ? '/seller' : '/become-a-seller'} className="px-3 py-1.5 rounded-lg bg-[#0D63F3] text-white text-xs font-semibold">
              {sellerStore?.status === 'active' ? 'Seller Center' : 'Become a Seller'}
            </Link>
            {isAdmin && (
              <Link to="/admin" className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold">
                Admin Control
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
