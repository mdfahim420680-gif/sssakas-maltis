import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Box,
  Calendar,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  Megaphone,
  Package,
  Settings,
  ShoppingCart,
  Sparkles,
  Store,
  Tag,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { apiRequest, formatBDT, getAuthToken } from '../../lib/api';
import { RootState } from '../../store';
import { pushToast } from '../../store/uiSlice';
import {
  MiniSparkline,
  OrderStatusDonutChart,
  OrderStatusSegment,
  SalesOverviewChart,
  SalesSeriesPoint,
} from '../../components/admin/AdminCharts';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { AdminDialog } from '../../components/admin/AdminDialog';

interface DashboardResponse {
  range: '7d' | '30d' | '90d' | 'all';
  databaseMode: 'atlas' | 'memory';
  metrics: {
    usersCount: number;
    customerCount: number;
    storesCount: number;
    pendingSellersCount: number;
    productsCount: number;
    pendingProductsCount: number;
    ordersCount: number;
    deliveredOrdersCount: number;
    totalGmv: number;
    totalCommission: number;
    rangeGmv: number;
    rangeOrdersCount: number;
    pendingPayoutsCount: number;
    openReturnsCount: number;
    openTicketsCount: number;
    openOrdersCount: number;
    searchQueriesCount: number;
  };
  comparisons: {
    orders: number | null;
    sales: number | null;
    customers: number | null;
    sellers: number | null;
    products: number | null;
    commission: number | null;
  };
  salesSeries: SalesSeriesPoint[];
  orderStatusDistribution: {
    totalSubOrders: number;
    items: OrderStatusSegment[];
  };
  topSellingProducts: Array<{
    _id: string;
    title: string;
    slug: string;
    image: string;
    price: number;
    revenue: number;
    soldCount: number;
    ratingAvg: number;
  }>;
  topSellers: Array<{
    _id: string;
    name: string;
    slug: string;
    verified: boolean;
    ratingAvg: number;
    ratingCount: number;
    productCount: number;
    ordersCount: number;
    totalRevenue: number;
  }>;
  recentOrders: Array<{
    _id: string;
    orderNumber: string;
    customerName: string;
    productSummary: string;
    sellerName: string;
    grandTotal: number;
    paymentMethod: string;
    paymentStatus: string;
    status: string;
    createdAt: string;
  }>;
  recentActivities: Array<{
    id: string;
    type: string;
    title: string;
    subtitle: string;
    createdAt: string;
  }>;
  featuredBanner?: {
    _id: string;
    title: string;
    highlightText?: string;
    subtitle?: string;
    imageUrl?: string;
    ctaText?: string;
  } | null;
  integrations?: Record<string, boolean>;
}

interface OrderDetailModalData {
  parentOrder: {
    _id: string;
    orderNumber: string;
    grandTotal: number;
    itemsSubtotal: number;
    shippingTotal: number;
    couponDiscountTotal: number;
    paymentMethod: string;
    paymentStatus: string;
    createdAt: string;
    customerId?: { name?: string; email?: string; phone?: string };
    shippingAddress?: { fullName?: string; phone?: string; addressLine?: string; district?: string; division?: string };
  };
  subOrders: Array<{
    _id: string;
    subOrderNumber: string;
    storeName: string;
    subtotal: number;
    status: string;
    items: Array<{ productTitle: string; quantity: number; lineTotal: number }>;
  }>;
}

const STATUS_BADGE_MAP: Record<string, string> = {
  delivered: 'bg-emerald-50 text-emerald-700',
  processing: 'bg-blue-50 text-[#0D63F3]',
  confirmed: 'bg-sky-50 text-sky-700',
  packed: 'bg-indigo-50 text-indigo-700',
  shipped: 'bg-purple-50 text-purple-700',
  pending: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-red-50 text-[#EF3E36]',
};

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function AdminOverviewPage() {
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.auth.user);
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [orderDetail, setOrderDetail] = useState<OrderDetailModalData | null>(null);

  useEffect(() => {
    setLoading(true);
    apiRequest<DashboardResponse & { success: boolean }>(`/api/admin/dashboard?range=${range}`)
      .then((res) => setData(res))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unable to load dashboard';
        dispatch(pushToast({ type: 'error', title: 'Dashboard load failed', message }));
      })
      .finally(() => setLoading(false));
  }, [range, dispatch]);

  const handleExportCsv = async (type: 'orders' | 'products' | 'sellers') => {
    setExportMenuOpen(false);
    setExporting(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/reports/export?type=${type}&range=${range}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `novara-${type}-${range}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      dispatch(pushToast({ type: 'success', title: `Exported ${type} CSV report` }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Export failed';
      dispatch(pushToast({ type: 'error', title: 'Report export failed', message }));
    } finally {
      setExporting(false);
    }
  };

  const openOrderPreview = async (orderId: string) => {
    try {
      const res = await apiRequest<{ success: boolean } & OrderDetailModalData>(`/api/admin/orders/${orderId}`);
      setOrderDetail(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not fetch order details';
      dispatch(pushToast({ type: 'error', title: 'Order preview failed', message }));
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <div className="h-14 rounded-2xl bg-white border border-slate-200 animate-pulse" />
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse" />
            ))}
          </div>
          <div className="xl:col-span-5 h-60 rounded-2xl bg-blue-950/20 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const m = data.metrics;
  const cmp = data.comparisons;
  const orderSpark = data.salesSeries.slice(-8).map((s) => s.orders);
  const revSpark = data.salesSeries.slice(-8).map((s) => s.revenue);

  const kpiCards = [
    {
      label: 'Total Orders',
      value: m.ordersCount.toLocaleString('en-US'),
      growth: cmp.orders,
      to: '/admin/orders',
      icon: ShoppingCart,
      iconBg: 'bg-blue-50 text-[#0D63F3]',
      sparkColor: '#0D63F3',
      sparkData: orderSpark,
    },
    {
      label: 'Total Sales',
      value: formatBDT(m.totalGmv),
      growth: cmp.sales,
      to: '/admin/analytics',
      icon: CreditCard,
      iconBg: 'bg-emerald-50 text-emerald-600',
      sparkColor: '#10B981',
      sparkData: revSpark,
    },
    {
      label: 'Total Customers',
      value: m.customerCount.toLocaleString('en-US'),
      growth: cmp.customers,
      to: '/admin/customers',
      icon: Users,
      iconBg: 'bg-indigo-50 text-indigo-600',
      sparkColor: '#6366F1',
      sparkData: [Math.max(1, m.customerCount - 4), Math.max(1, m.customerCount - 2), m.customerCount],
    },
    {
      label: 'Total Sellers',
      value: m.storesCount.toLocaleString('en-US'),
      growth: cmp.sellers,
      to: '/admin/sellers',
      icon: Store,
      iconBg: 'bg-amber-50 text-amber-600',
      sparkColor: '#F59E0B',
      sparkData: [Math.max(1, m.storesCount - 1), m.storesCount, m.storesCount],
    },
    {
      label: 'Platform Commission',
      value: formatBDT(m.totalCommission),
      growth: cmp.commission,
      to: '/admin/finance',
      icon: Activity,
      iconBg: 'bg-cyan-50 text-cyan-600',
      sparkColor: '#06B6D4',
      sparkData: revSpark.map((v) => Math.round(v * 0.08)),
    },
    {
      label: 'Total Products',
      value: m.productsCount.toLocaleString('en-US'),
      growth: cmp.products,
      to: '/admin/products',
      icon: Box,
      iconBg: 'bg-rose-50 text-[#EF3E36]',
      sparkColor: '#A855F7',
      sparkData: [Math.max(1, m.productsCount - 5), Math.max(1, m.productsCount - 2), m.productsCount],
    },
  ];

  const integrations = data.integrations || {};
  const integrationItems = [
    {
      label: 'Database',
      ok: data.databaseMode === 'atlas' || Boolean(integrations.mongodbAtlas),
      note: data.databaseMode === 'atlas' ? 'MongoDB Atlas' : 'Local Dev DB',
    },
    {
      label: 'Media Storage',
      ok: Boolean(integrations.cloudinary),
      note: integrations.cloudinary ? 'Cloudinary' : 'Local Uploads',
    },
    {
      label: 'Email Service',
      ok: Boolean(integrations.transactionalEmail || integrations.smtp),
      note: integrations.transactionalEmail || integrations.smtp ? 'SMTP Live' : 'Dev Logger',
    },
    {
      label: 'Payments',
      ok: Boolean(integrations.bkash || integrations.nagad || integrations.sslcommerz),
      note: integrations.sslcommerz || integrations.bkash || integrations.nagad ? 'Online + COD' : 'COD Active',
    },
  ];

  const banner = data.featuredBanner;

  return (
    <div className="space-y-5">
      {/* Page Greeting + Range & CSV Export Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Welcome back, {user?.name || 'Admin'}!
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Live marketplace metrics across {m.ordersCount} orders, {m.storesCount} active sellers, and {m.productsCount}{' '}
            catalog products.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center">
            <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
            <select
              aria-label="Dashboard date range"
              value={range}
              onChange={(e) => setRange(e.target.value as '7d' | '30d' | '90d' | 'all')}
              className="h-9 pl-8 pr-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#0D63F3] cursor-pointer"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <div className="relative">
            <button
              type="button"
              disabled={exporting}
              onClick={() => setExportMenuOpen((prev) => !prev)}
              className="h-9 px-4 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exporting ? 'Exporting...' : 'Export Report'}</span>
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl border border-slate-200 shadow-xl py-1 z-30 text-xs">
                <button
                  type="button"
                  onClick={() => handleExportCsv('orders')}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 font-semibold text-slate-700"
                >
                  Orders Report (CSV)
                </button>
                <button
                  type="button"
                  onClick={() => handleExportCsv('products')}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 font-semibold text-slate-700"
                >
                  Product Catalog (CSV)
                </button>
                <button
                  type="button"
                  onClick={() => handleExportCsv('sellers')}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 font-semibold text-slate-700"
                >
                  Sellers Directory (CSV)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Row: 3x2 KPI Cards + Featured Hero Banner Card */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        <div className="xl:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {kpiCards.map((card) => (
            <Link
              key={card.label}
              to={card.to}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col justify-between gap-3 hover:border-[#0D63F3]/60 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${card.iconBg}`}>
                    <card.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500 truncate">{card.label}</p>
                    <p className="text-xl font-extrabold text-slate-900 tabular-nums tracking-tight mt-0.5 truncate">
                      {card.value}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-end justify-between gap-2">
                <div>
                  {card.growth !== null ? (
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold tabular-nums ${
                        card.growth >= 0 ? 'text-emerald-600' : 'text-[#EF3E36]'
                      }`}
                    >
                      {card.growth >= 0 ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                      {card.growth >= 0 ? '+' : ''}
                      {card.growth}%
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-400">Live total</span>
                  )}
                </div>
                <MiniSparkline values={card.sparkData} color={card.sparkColor} />
              </div>
            </Link>
          ))}
        </div>

        {/* Right Hero Banner Showcase Card */}
        <div className="xl:col-span-5 rounded-2xl bg-gradient-to-br from-[#06246E] via-[#0B47CB] to-[#1D74F5] p-6 text-white relative overflow-hidden flex flex-col justify-between shadow-lg">
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between gap-4 h-full">
            <div className="space-y-3 max-w-[60%]">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-[11px] font-bold text-blue-100">
                <Sparkles className="w-3 h-3 text-amber-300" />
                {banner?.highlightText || 'Active Campaign'}
              </span>
              <h2 className="text-2xl font-black leading-tight tracking-tight">
                {banner ? (
                  <>
                    {banner.title}
                  </>
                ) : (
                  'Launch a Storefront Hero Campaign'
                )}
              </h2>
              <p className="text-xs text-blue-100/90 leading-relaxed line-clamp-2">
                {banner?.subtitle || 'Schedule hero slides, promo banners, and flash campaigns directly from Admin.'}
              </p>
              <div className="pt-1">
                <Link
                  to="/admin/banners"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white text-[#082468] text-xs font-extrabold hover:bg-blue-50 transition-colors shadow-sm"
                >
                  <span>Manage Banners</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {banner?.imageUrl && (
              <div className="hidden sm:block w-40 h-40 rounded-2xl overflow-hidden border border-white/25 bg-white/10 shrink-0 shadow-2xl">
                <ImageWithFallback src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Middle Analytics Row: Sales Overview + Order Status + Top Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Sales Overview Chart */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Sales Overview</h2>
              <p className="text-[11px] text-slate-500">
                {range === 'all' ? 'Recent 30-day revenue trend' : `Revenue performance (${range})`}
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#0D63F3]" />
                This Period
              </span>
              {data.salesSeries.some((p) => p.previousRevenue !== null && p.previousRevenue > 0) && (
                <span className="inline-flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  Previous
                </span>
              )}
            </div>
          </div>
          <SalesOverviewChart series={data.salesSeries} />
        </div>

        {/* Order Status Donut */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-extrabold text-slate-900">Order Status</h2>
            <Link to="/admin/orders" className="text-[11px] font-bold text-[#0D63F3] hover:underline">
              All Orders
            </Link>
          </div>
          <OrderStatusDonutChart
            segments={data.orderStatusDistribution.items}
            totalCount={data.orderStatusDistribution.totalSubOrders}
          />
        </div>

        {/* Top Selling Products */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-purple-600" />
              <h2 className="text-sm font-extrabold text-slate-900">Top Selling Products</h2>
            </div>
            <Link to="/admin/products" className="text-xs font-bold text-[#0D63F3] hover:underline flex items-center gap-1">
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {data.topSellingProducts.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No published products found.</p>
            ) : (
              data.topSellingProducts.map((prod, idx) => (
                <Link
                  key={prod._id}
                  to={`/admin/products/${prod._id}/edit`}
                  className="flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50/80 rounded-xl px-1.5 -mx-1.5 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-full text-[11px] font-extrabold flex items-center justify-center shrink-0 ${
                        idx === 0
                          ? 'bg-amber-100 text-amber-700'
                          : idx === 1
                            ? 'bg-slate-100 text-slate-700'
                            : idx === 2
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-slate-50 text-slate-500'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0">
                      <ImageWithFallback src={prod.image} alt={prod.title} className="w-full h-full object-contain" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{prod.title}</p>
                      <p className="text-[11px] font-semibold text-slate-500 tabular-nums mt-0.5">
                        {prod.price > 0 ? formatBDT(prod.price) : 'Catalog Item'} · ★ {prod.ratingAvg.toFixed(1)}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-700 tabular-nums shrink-0">
                    {prod.soldCount.toLocaleString('en-US')} sold
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Orders + Top Sellers + Recent Activities */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Recent Orders Table */}
        <div className="xl:col-span-6 bg-white rounded-2xl border border-slate-200/80 p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#0D63F3]" />
              <h2 className="text-sm font-extrabold text-slate-900">Recent Orders</h2>
            </div>
            <Link to="/admin/orders" className="text-xs font-bold text-[#0D63F3] hover:underline flex items-center gap-1">
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {data.recentOrders.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No marketplace orders have been placed yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold text-[11px]">
                    <th className="py-2 pr-2.5">Order</th>
                    <th className="py-2 pr-2.5">Customer</th>
                    <th className="py-2 pr-2.5">Item &amp; Seller</th>
                    <th className="py-2 pr-2.5">Amount</th>
                    <th className="py-2 pr-2.5">Status</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recentOrders.slice(0, 6).map((o) => {
                    const badgeClass = STATUS_BADGE_MAP[o.status] || 'bg-slate-100 text-slate-700';
                    return (
                      <tr key={o._id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 pr-2.5 whitespace-nowrap">
                          <p className="font-mono-num font-bold text-[#0D63F3] leading-tight">#{o.orderNumber}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </td>
                        <td className="py-2.5 pr-2.5 font-semibold text-slate-800 whitespace-nowrap">
                          {o.customerName}
                        </td>
                        <td className="py-2.5 pr-2.5 max-w-[165px]">
                          <p className="text-slate-800 font-medium truncate">{o.productSummary}</p>
                          <p className="text-[10px] text-slate-400 truncate">{o.sellerName}</p>
                        </td>
                        <td className="py-2.5 pr-2.5 font-bold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatBDT(o.grandTotal)}
                        </td>
                        <td className="py-2.5 pr-2.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${badgeClass}`}>
                            {o.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            aria-label={`View order ${o.orderNumber}`}
                            onClick={() => openOrderPreview(o._id)}
                            className="inline-flex w-7 h-7 rounded-full bg-blue-50 text-[#0D63F3] hover:bg-[#0D63F3] hover:text-white items-center justify-center transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Sellers */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#0D63F3]" />
              <h2 className="text-sm font-extrabold text-slate-900">Top Sellers</h2>
            </div>
            <Link to="/admin/sellers" className="text-xs font-bold text-[#0D63F3] hover:underline flex items-center gap-1">
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2.5 flex-1">
            {data.topSellers.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No active seller stores yet.</p>
            ) : (
              data.topSellers.slice(0, 4).map((st, idx) => (
                <div
                  key={st._id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-8 h-8 rounded-full bg-[#0D63F3] text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">
                      {st.name.slice(0, 2).toUpperCase()}
                      <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-white text-slate-700 border border-slate-200 text-[9px] font-extrabold flex items-center justify-center">
                        {idx + 1}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{st.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        ★ {st.ratingAvg.toFixed(1)} · {st.productCount} items
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/shop/${st.slug}`}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-700 hover:border-[#0D63F3] hover:text-[#0D63F3] transition-colors shrink-0"
                  >
                    Visit Shop
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activities Timeline */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-extrabold text-slate-900">Recent Activities</h2>
            <Link to="/admin/audit" className="text-xs font-bold text-[#0D63F3] hover:underline flex items-center gap-1">
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="relative space-y-3.5 pl-4 before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-[1.5px] before:bg-slate-200">
            {data.recentActivities.length === 0 ? (
              <p className="text-xs text-slate-500">No activity recorded yet.</p>
            ) : (
              data.recentActivities.slice(0, 5).map((act, idx) => (
                <div key={act.id} className="relative">
                  <span
                    className={`absolute -left-4 top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                      idx === 0
                        ? 'bg-[#0D63F3]'
                        : idx === 1
                          ? 'bg-emerald-500'
                          : idx === 2
                            ? 'bg-amber-500'
                            : 'bg-purple-500'
                    }`}
                  />
                  <p className="text-xs font-bold text-slate-800 capitalize leading-snug">{act.title}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {act.subtitle} · {formatRelativeTime(act.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom 5 Quick-Action Cards (matching reference image) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Link
          to="/admin/ads"
          className="rounded-2xl bg-gradient-to-br from-[#0A47C7] to-[#1D74F5] p-4 text-white flex flex-col justify-between gap-3 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold">Manage Advertisements</p>
              <p className="text-[11px] text-blue-100 mt-0.5">Update banners, sliders &amp; offers</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg bg-white text-[#0A3FA8] text-[11px] font-extrabold">
            <span>Go to Ads</span>
            <ArrowRight className="w-3 h-3" />
          </span>
        </Link>

        <Link
          to="/admin/products"
          className="rounded-2xl bg-white border border-slate-200/80 p-4 flex flex-col justify-between gap-3 hover:border-[#0D63F3] hover:shadow-md transition-all"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0D63F3] flex items-center justify-center shrink-0">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-900">Manage Products</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {m.pendingProductsCount > 0
                  ? `${m.pendingProductsCount} awaiting moderation`
                  : 'Add, edit or moderate catalog'}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-[11px] font-bold">
            <span>Go to Products</span>
            <ArrowRight className="w-3 h-3" />
          </span>
        </Link>

        <Link
          to="/admin/sellers"
          className="rounded-2xl bg-white border border-slate-200/80 p-4 flex flex-col justify-between gap-3 hover:border-[#0D63F3] hover:shadow-md transition-all"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#0D63F3] flex items-center justify-center shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-900">Manage Sellers</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {m.pendingSellersCount > 0
                  ? `${m.pendingSellersCount} KYC applications pending`
                  : 'Handle seller requests & shops'}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-[11px] font-bold">
            <span>Go to Sellers</span>
            <ArrowRight className="w-3 h-3" />
          </span>
        </Link>

        <Link
          to="/admin/promotions"
          className="rounded-2xl bg-white border border-slate-200/80 p-4 flex flex-col justify-between gap-3 hover:border-[#0D63F3] hover:shadow-md transition-all"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-900">Manage Coupons</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Create discount coupons &amp; flash deals</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-[11px] font-bold">
            <span>Go to Coupons</span>
            <ArrowRight className="w-3 h-3" />
          </span>
        </Link>

        <Link
          to="/admin/settings"
          className="rounded-2xl bg-gradient-to-br from-[#071638] to-[#0B2D70] p-4 text-white flex flex-col justify-between gap-3 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Settings className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <p className="text-sm font-extrabold">Store Settings</p>
              <p className="text-[11px] text-blue-200 mt-0.5">Configure fees, rules &amp; store settings</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg bg-white text-[#081A45] text-[11px] font-extrabold">
            <span>Go to Settings</span>
            <ArrowRight className="w-3 h-3" />
          </span>
        </Link>
      </div>

      {/* Compact System Readiness Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          {integrationItems.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              {item.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              )}
              <span className="font-bold text-slate-700">{item.label}:</span>
              <span className="text-slate-500">{item.note}</span>
            </div>
          ))}
        </div>
        <Link to="/admin/analytics" className="text-xs font-bold text-[#0D63F3] hover:underline inline-flex items-center gap-1">
          <span>Detailed Analytics</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Order Quick-View Modal */}
      <AdminDialog
        open={Boolean(orderDetail)}
        onClose={() => setOrderDetail(null)}
        title={`Order #${orderDetail?.parentOrder.orderNumber || ''}`}
        subtitle="Quick customer summary, delivery snapshot, and suborder breakdown."
        badge="Order Quick View"
        size="lg"
        footer={
          orderDetail && (
            <>
              <button
                type="button"
                onClick={() => setOrderDetail(null)}
                className="px-4 h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
              <Link
                to={`/admin/orders?q=${encodeURIComponent(orderDetail.parentOrder.orderNumber)}`}
                onClick={() => setOrderDetail(null)}
                className="px-4 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center shadow-xs transition-colors"
              >
                Manage in Orders
              </Link>
            </>
          )
        }
      >
        {orderDetail && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/90">
                <p className="text-[11px] text-slate-400 font-semibold">Customer</p>
                <p className="font-bold text-[#0B1F4B] mt-0.5">
                  {orderDetail.parentOrder.customerId?.name || orderDetail.parentOrder.shippingAddress?.fullName}
                </p>
                <p className="text-slate-500 mt-0.5">
                  {orderDetail.parentOrder.shippingAddress?.phone || orderDetail.parentOrder.customerId?.phone}
                </p>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/90">
                <p className="text-[11px] text-slate-400 font-semibold">Payment &amp; Total</p>
                <p className="font-extrabold text-[#0D63F3] text-base tabular-nums mt-0.5">
                  {formatBDT(orderDetail.parentOrder.grandTotal)}
                </p>
                <p className="uppercase font-bold text-[11px] text-slate-600 mt-0.5">
                  {orderDetail.parentOrder.paymentMethod} · {orderDetail.parentOrder.paymentStatus}
                </p>
              </div>
            </div>

            {orderDetail.parentOrder.shippingAddress && (
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 text-slate-600">
                <strong className="text-[#0B1F4B]">Delivery Address:</strong>{' '}
                {orderDetail.parentOrder.shippingAddress.addressLine},{' '}
                {orderDetail.parentOrder.shippingAddress.district}, {orderDetail.parentOrder.shippingAddress.division}
              </div>
            )}

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {orderDetail.subOrders.map((sub) => (
                <div key={sub._id} className="bg-white p-3.5 rounded-xl border border-slate-200/90 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-num font-bold text-[#0B1F4B]">{sub.subOrderNumber}</span>
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-[#0D63F3] font-bold uppercase text-[10px]">
                      {sub.status}
                    </span>
                  </div>
                  <p className="text-slate-500 font-semibold">Seller: {sub.storeName}</p>
                  <div className="divide-y divide-slate-100">
                    {sub.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between py-1 text-slate-700">
                        <span>
                          {it.productTitle} × {it.quantity}
                        </span>
                        <span className="font-bold tabular-nums">{formatBDT(it.lineTotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </AdminDialog>
    </div>
  );
}
