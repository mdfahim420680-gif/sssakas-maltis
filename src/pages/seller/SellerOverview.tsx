import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Star } from 'lucide-react';
import { apiRequest, formatBDT } from '../../lib/api';
import { pushToast } from '../../store/uiSlice';

export function SellerOverviewPage() {
  const dispatch = useDispatch();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest('/api/seller/dashboard')
      .then((res) => setData(res))
      .catch((err: any) => dispatch(pushToast({ type: 'error', title: 'Dashboard load failed', message: err.message })))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 bg-white rounded-2xl border border-slate-200 text-sm text-slate-500">Loading Seller Center...</div>;
  if (!data) return null;

  const m = data.metrics;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Seller Dashboard — {data.store.name}</h1>
          <p className="text-xs text-slate-500">Isolated store metrics, active offers, and fulfillment queue</p>
        </div>
        <Link
          to="/seller/add-product"
          className="px-4 py-2 rounded-xl bg-[#0D63F3] text-white text-xs font-bold"
        >
          + Add Product / Offer
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {[
          { label: 'Gross Sales', value: formatBDT(m.grossSales) },
          { label: 'Refund-Adj. Sales', value: formatBDT(m.refundAdjustedSales) },
          { label: 'Eligible Payout', value: formatBDT(m.eligiblePayout), accent: true },
          { label: 'Pending Earnings', value: formatBDT(m.pendingEarnings) },
          { label: 'Orders To Fulfill', value: String(m.pendingOrdersCount) },
          { label: 'Low Stock Alerts', value: String(m.lowStockOffers) },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-[11px] font-semibold text-slate-500">{card.label}</p>
            <p className={`text-lg font-black mt-1 tabular-nums ${card.accent ? 'text-[#0D63F3]' : 'text-slate-900'}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">Recent Store Suborders</h2>
          <Link to="/seller/orders" className="text-xs font-bold text-[#0D63F3] hover:underline">
            Manage All Orders →
          </Link>
        </div>
        {data.recentOrders.length === 0 ? (
          <p className="text-xs text-slate-500">No suborders received yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4">Suborder</th>
                  <th className="py-2 pr-4">Items</th>
                  <th className="py-2 pr-4">Subtotal</th>
                  <th className="py-2 pr-4">Net Payable</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentOrders.map((o: any) => (
                  <tr key={o._id}>
                    <td className="py-2.5 pr-4 font-mono-num font-bold text-slate-900">{o.subOrderNumber}</td>
                    <td className="py-2.5 pr-4">{o.items.length} item(s)</td>
                    <td className="py-2.5 pr-4 tabular-nums">{formatBDT(o.subtotal)}</td>
                    <td className="py-2.5 pr-4 font-bold text-emerald-700 tabular-nums">{formatBDT(o.sellerNetPayable)}</td>
                    <td className="py-2.5 uppercase font-bold text-[#0D63F3]">{o.status.replace(/_/g, ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function SellerReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const dispatch = useDispatch();

  const load = () => {
    apiRequest('/api/seller/reviews')
      .then((r) => setReviews(r.reviews || []))
      .catch((err: any) => dispatch(pushToast({ type: 'error', title: 'Failed to load reviews', message: err.message })));
  };
  useEffect(load, []);

  const submitReply = async (reviewId: string) => {
    try {
      await apiRequest(`/api/seller/reviews/${reviewId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ text: replyText[reviewId] || '' }),
      });
      dispatch(pushToast({ type: 'success', title: 'Reply Posted' }));
      load();
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.message }));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
      <h1 className="text-lg font-extrabold text-slate-900">Customer Reviews on Your Store</h1>
      <p className="text-xs text-slate-500">
        Verified customer reviews are immutable by sellers. You may post an official store response below.
      </p>
      <div className="space-y-4 divide-y divide-slate-100">
        {reviews.length === 0 ? (
          <p className="text-xs text-slate-500">No reviews yet.</p>
        ) : (
          reviews.map((r) => (
            <div key={r._id} className="pt-4 first:pt-0 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{r.productId?.title || 'Product'}</span>
                <span className="flex items-center gap-1 text-amber-500 font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400" /> {r.rating}/5
                </span>
              </div>
              <p className="text-slate-700">{r.comment}</p>
              {r.sellerReply ? (
                <div className="p-2.5 rounded-lg bg-slate-50 text-slate-700">
                  <strong>Your Reply:</strong> {r.sellerReply.text}
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    placeholder="Write seller response..."
                    value={replyText[r._id] || ''}
                    onChange={(e) => setReplyText({ ...replyText, [r._id]: e.target.value })}
                    className="flex-1 h-9 px-3 rounded-lg border border-slate-300 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => submitReply(r._id)}
                    className="px-4 h-9 rounded-lg bg-[#0D63F3] text-white text-xs font-bold"
                  >
                    Reply
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function SellerSettingsPage() {
  const [store, setStore] = useState<any>(null);
  const dispatch = useDispatch();

  useEffect(() => {
    apiRequest('/api/seller/dashboard')
      .then((r) => setStore(r.store))
      .catch((err: any) => dispatch(pushToast({ type: 'error', title: 'Failed to load store settings', message: err.message })));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/seller/store', {
        method: 'PUT',
        body: JSON.stringify(store),
      });
      dispatch(pushToast({ type: 'success', title: 'Store Settings Saved' }));
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Save failed', message: err.message }));
    }
  };

  if (!store) return null;

  return (
    <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
      <h1 className="text-lg font-extrabold text-slate-900">Storefront &amp; Shipping Settings</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Store Name</label>
          <input
            value={store.name}
            onChange={(e) => setStore({ ...store, name: e.target.value })}
            className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Support Phone</label>
          <input
            value={store.supportPhone}
            onChange={(e) => setStore({ ...store, supportPhone: e.target.value })}
            className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-700 mb-1">Store Description</label>
          <textarea
            rows={3}
            value={store.description}
            onChange={(e) => setStore({ ...store, description: e.target.value })}
            className="w-full p-3 rounded-xl border border-slate-300 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Default Dhaka Delivery Fee (৳)</label>
          <input
            type="number"
            value={store.shippingDefaults?.dhakaFee ?? 60}
            onChange={(e) =>
              setStore({
                ...store,
                shippingDefaults: { ...store.shippingDefaults, dhakaFee: Number(e.target.value) },
              })
            }
            className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Default Nationwide Delivery Fee (৳)</label>
          <input
            type="number"
            value={store.shippingDefaults?.nationwideFee ?? 120}
            onChange={(e) =>
              setStore({
                ...store,
                shippingDefaults: { ...store.shippingDefaults, nationwideFee: Number(e.target.value) },
              })
            }
            className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm"
          />
        </div>
      </div>
      <button type="submit" className="px-5 py-2.5 rounded-xl bg-[#0D63F3] text-white text-xs font-bold">
        Save Settings
      </button>
    </form>
  );
}
