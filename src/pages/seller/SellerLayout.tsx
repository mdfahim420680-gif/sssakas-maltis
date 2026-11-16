import { Link, NavLink, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  BarChart3,
  Box,
  DollarSign,
  MessageSquare,
  Package,
  PlusCircle,
  RotateCcw,
  Settings,
  Store,
} from 'lucide-react';
import { RootState } from '../../store';

const NAV_ITEMS = [
  { to: '/seller', label: 'Overview & Analytics', icon: BarChart3, end: true },
  { to: '/seller/products', label: 'Products & Inventory', icon: Box },
  { to: '/seller/add-product', label: 'Add Product / Offer', icon: PlusCircle },
  { to: '/seller/orders', label: 'Orders & Shipments', icon: Package },
  { to: '/seller/returns', label: 'Returns & Disputes', icon: RotateCcw },
  { to: '/seller/finance', label: 'Earnings & Payouts', icon: DollarSign },
  { to: '/seller/reviews', label: 'Customer Reviews', icon: MessageSquare },
  { to: '/seller/settings', label: 'Store Settings', icon: Settings },
];

export function SellerLayout() {
  const sellerStore = useSelector((s: RootState) => s.auth.sellerStore);

  return (
    <div className="max-w-[1360px] mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-3 xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-3 space-y-2">
          <div className="px-3 py-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2 text-[#0D63F3] font-bold text-xs">
              <Store className="w-4 h-4" />
              <span>Seller Center</span>
            </div>
            <p className="text-sm font-extrabold text-slate-900 mt-1 truncate">
              {sellerStore?.name || 'My Store'}
            </p>
            {sellerStore?.slug && (
              <Link to={`/shop/${sellerStore.slug}`} className="text-[11px] text-[#0D63F3] hover:underline">
                View Public Storefront →
              </Link>
            )}
          </div>

          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                    isActive ? 'bg-[#0D63F3] text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="lg:col-span-9 xl:col-span-10 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
