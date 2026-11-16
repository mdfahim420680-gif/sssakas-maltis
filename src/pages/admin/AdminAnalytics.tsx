import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { BarChart3, Calendar, CreditCard, DollarSign, ShoppingBag, Tag, TrendingUp } from 'lucide-react';
import { apiRequest, formatBDT } from '../../lib/api';
import { pushToast } from '../../store/uiSlice';
import {
  OrderStatusDonutChart,
  OrderStatusSegment,
  SalesOverviewChart,
  SalesSeriesPoint,
} from '../../components/admin/AdminCharts';

interface AnalyticsPayload {
  range: string;
  summary: {
    ordersCount: number;
    totalRevenue: number;
    totalCommission: number;
    totalDiscount: number;
    avgOrderValue: number;
  };
  salesSeries: SalesSeriesPoint[];
  orderStatusDistribution: {
    totalSubOrders: number;
    items: OrderStatusSegment[];
  };
  paymentBreakdown: Array<{ _id: string; count: number; totalAmount: number }>;
  categoryRevenue: Array<{ name: string; revenue: number; units: number }>;
  topCoupons: Array<{ _id: string; code: string; title: string; usedCount: number; discountType: string; discountValue: number }>;
  topSellers: Array<{ storeName: string; ordersCount: number; revenue: number; commission: number }>;
}

export function AdminAnalyticsPage() {
  const dispatch = useDispatch();
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiRequest<AnalyticsPayload & { success: boolean }>(`/api/admin/analytics?range=${range}`)
      .then((res) => setData(res))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unable to load analytics';
        dispatch(pushToast({ type: 'error', title: 'Analytics load failed', message }));
      })
      .finally(() => setLoading(false));
  }, [range, dispatch]);

  if (loading && !data) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-xs text-slate-500">
        Loading marketplace analytics...
      </div>
    );
  }
  if (!data) return null;

  const maxCatRevenue = Math.max(1, ...data.categoryRevenue.map((c) => c.revenue));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Marketplace Analytics &amp; Insights</h1>
          <p className="text-xs text-slate-500">
            Real-time revenue, category performance, payment splits, and seller commission trends
          </p>
        </div>

        <div className="relative flex items-center">
          <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
          <select
            aria-label="Analytics range"
            value={range}
            onChange={(e) => setRange(e.target.value as '7d' | '30d' | '90d' | 'all')}
            className="h-9 pl-8 pr-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Orders in Period', value: data.summary.ordersCount.toLocaleString('en-US'), icon: ShoppingBag, color: 'text-[#0D63F3] bg-blue-50' },
          { label: 'Gross Revenue', value: formatBDT(data.summary.totalRevenue), icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Platform Commission', value: formatBDT(data.summary.totalCommission), icon: DollarSign, color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Avg Order Value', value: formatBDT(data.summary.avgOrderValue), icon: BarChart3, color: 'text-amber-600 bg-amber-50' },
          { label: 'Coupon Discounts', value: formatBDT(data.summary.totalDiscount), icon: Tag, color: 'text-[#EF3E36] bg-red-50' },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-500 truncate">{item.label}</p>
              <p className="text-lg font-extrabold text-slate-900 tabular-nums mt-0.5 truncate">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-extrabold text-slate-900">Revenue Trend</h2>
            <span className="text-[11px] font-semibold text-slate-400 uppercase">{range}</span>
          </div>
          <SalesOverviewChart series={data.salesSeries} height={250} />
        </div>

        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-5">
          <h2 className="text-sm font-extrabold text-slate-900 mb-4">Fulfillment Breakdown</h2>
          <OrderStatusDonutChart
            segments={data.orderStatusDistribution.items}
            totalCount={data.orderStatusDistribution.totalSubOrders}
          />
        </div>
      </div>

      {/* Category Revenue + Payment Methods + Top Sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3">
          <h2 className="text-sm font-extrabold text-slate-900">Revenue by Category</h2>
          {data.categoryRevenue.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No category sales recorded in this period.</p>
          ) : (
            <div className="space-y-3">
              {data.categoryRevenue.map((cat) => (
                <div key={cat.name} className="space-y-1 text-xs">
                  <div className="flex justify-between font-semibold text-slate-800">
                    <span>{cat.name}</span>
                    <span className="tabular-nums font-bold">
                      {formatBDT(cat.revenue)} · {cat.units} units
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#0D63F3]"
                      style={{ width: `${Math.max(4, Math.round((cat.revenue / maxCatRevenue) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#0D63F3]" />
            <h2 className="text-sm font-extrabold text-slate-900">Payment Methods</h2>
          </div>
          {data.paymentBreakdown.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No transactions in period.</p>
          ) : (
            <div className="space-y-2.5 text-xs">
              {data.paymentBreakdown.map((pm) => (
                <div key={pm._id || 'unknown'} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="font-extrabold uppercase text-slate-800">{pm._id || 'Other'}</p>
                    <p className="text-[11px] text-slate-500 tabular-nums">{pm.count} orders</p>
                  </div>
                  <span className="font-bold text-[#0D63F3] tabular-nums">{formatBDT(pm.totalAmount)}</span>
                </div>
              ))}
            </div>
          )}

          {data.topCoupons.length > 0 && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <p className="text-xs font-extrabold text-slate-900">Most Used Coupons</p>
              {data.topCoupons.map((c) => (
                <div key={c._id} className="flex justify-between text-xs">
                  <span className="font-mono-num font-bold text-[#0D63F3]">{c.code}</span>
                  <span className="text-slate-600 tabular-nums">{c.usedCount} used</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3">
          <h2 className="text-sm font-extrabold text-slate-900">Seller Revenue Leaderboard</h2>
          {data.topSellers.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No seller orders recorded in period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400">
                    <th className="py-2 pr-2">Store</th>
                    <th className="py-2 pr-2">Orders</th>
                    <th className="py-2 pr-2">Revenue</th>
                    <th className="py-2 text-right">Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.topSellers.map((st) => (
                    <tr key={st.storeName}>
                      <td className="py-2.5 pr-2 font-bold text-slate-900">{st.storeName}</td>
                      <td className="py-2.5 pr-2 tabular-nums">{st.ordersCount}</td>
                      <td className="py-2.5 pr-2 font-bold tabular-nums">{formatBDT(st.revenue)}</td>
                      <td className="py-2.5 text-right text-emerald-700 font-semibold tabular-nums">
                        {formatBDT(st.commission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
