import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { apiRequest, formatBDT } from '../../lib/api';
import { pushToast } from '../../store/uiSlice';
import { ALLOWED_SUBORDER_TRANSITIONS, canSellerTransitionSuborderStatus, OrderStatus } from '../../../shared/pricing';

export function SellerOrdersPage() {
  const [subOrders, setSubOrders] = useState<any[]>([]);
  const [courierMap, setCourierMap] = useState<Record<string, { courierName: string; trackingNumber: string }>>({});
  const dispatch = useDispatch();

  const load = () => {
    apiRequest('/api/seller/orders')
      .then((res) => setSubOrders(res.subOrders || []))
      .catch((err: any) => dispatch(pushToast({ type: 'error', title: 'Failed to load orders', message: err.message })));
  };
  useEffect(load, []);

  const updateStatus = async (subId: string, nextStatus: OrderStatus) => {
    try {
      const ship = courierMap[subId];
      await apiRequest(`/api/seller/orders/${subId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
          courierName: ship?.courierName,
          trackingNumber: ship?.trackingNumber,
        }),
      });
      dispatch(pushToast({ type: 'success', title: `Suborder updated to ${nextStatus}` }));
      load();
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Update Failed', message: err.message }));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
      <h1 className="text-lg font-extrabold text-slate-900">Store Suborders &amp; Fulfillment</h1>
      {subOrders.length === 0 ? (
        <p className="text-xs text-slate-500">No orders for your store yet.</p>
      ) : (
        <div className="space-y-4">
          {subOrders.map((sub) => {
            const allowedNext = (ALLOWED_SUBORDER_TRANSITIONS[sub.status as OrderStatus] || []).filter((ns) =>
              canSellerTransitionSuborderStatus(sub.status as OrderStatus, ns)
            );
            const ship = courierMap[sub._id] || {
              courierName: sub.shipment?.courierName || 'Pathao Courier',
              trackingNumber: sub.shipment?.trackingNumber || '',
            };
            return (
              <div key={sub._id} className="p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono-num font-bold text-sm text-slate-900">{sub.subOrderNumber}</span>
                    <span className="ml-2 text-slate-500">
                      {sub.parentOrderId?.shippingAddress?.district}, {sub.parentOrderId?.shippingAddress?.division} ·{' '}
                      {sub.parentOrderId?.paymentMethod?.toUpperCase()}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#0D63F3] font-bold uppercase">
                    {sub.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="text-slate-600">
                  {sub.items.map((i: any, idx: number) => (
                    <div key={idx} className="flex justify-between">
                      <span>{i.productTitle} ({i.variantSku}) × {i.quantity}</span>
                      <span className="font-semibold tabular-nums">{formatBDT(i.lineTotal)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-1.5 mt-1.5 border-t border-slate-100 font-bold text-slate-900">
                    <span>Net Seller Payable (after {formatBDT(sub.commissionAmount)} commission)</span>
                    <span className="text-emerald-700 tabular-nums">{formatBDT(sub.sellerNetPayable)}</span>
                  </div>
                </div>

                {allowedNext.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    <input
                      placeholder="Courier (Pathao / Steadfast)"
                      value={ship.courierName}
                      onChange={(e) =>
                        setCourierMap({ ...courierMap, [sub._id]: { ...ship, courierName: e.target.value } })
                      }
                      className="h-8 px-2.5 rounded-lg border border-slate-300 text-xs"
                    />
                    <input
                      placeholder="Tracking Number"
                      value={ship.trackingNumber}
                      onChange={(e) =>
                        setCourierMap({ ...courierMap, [sub._id]: { ...ship, trackingNumber: e.target.value } })
                      }
                      className="h-8 px-2.5 rounded-lg border border-slate-300 text-xs"
                    />
                    {allowedNext.map((ns) => (
                      <button
                        key={ns}
                        type="button"
                        onClick={() => updateStatus(sub._id, ns)}
                        className="px-3 py-1.5 rounded-lg bg-[#0D63F3] hover:bg-[#0A52CC] text-white font-bold uppercase text-[11px]"
                      >
                        Mark {ns.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SellerReturnsPage() {
  const [returns, setReturns] = useState<any[]>([]);
  const dispatch = useDispatch();

  const load = () => {
    apiRequest('/api/seller/returns')
      .then((r) => setReturns(r.returns || []))
      .catch((err: any) => dispatch(pushToast({ type: 'error', title: 'Failed to load returns', message: err.message })));
  };
  useEffect(load, []);

  const respond = async (id: string, decision: 'approve' | 'dispute') => {
    try {
      await apiRequest(`/api/seller/returns/${id}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({
          decision,
          response: decision === 'approve' ? 'Seller approved return' : 'Disputed by seller for admin review',
        }),
      });
      dispatch(pushToast({ type: 'info', title: `Return ${decision}d` }));
      load();
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Response failed', message: err.message }));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
      <h1 className="text-lg font-extrabold text-slate-900">Returns &amp; Disputes</h1>
      {returns.length === 0 ? (
        <p className="text-xs text-slate-500">No return requests for your store.</p>
      ) : (
        <div className="space-y-3">
          {returns.map((r) => (
            <div key={r._id} className="p-4 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="font-bold text-slate-900">{r.returnNumber} — {r.reason}</span>
                <span className="uppercase font-bold text-[#0D63F3]">{r.status.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-slate-600">{r.details}</p>
              {r.status === 'requested' && (
                <div className="flex gap-2">
                  <button onClick={() => respond(r._id, 'approve')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold">
                    Approve Return
                  </button>
                  <button onClick={() => respond(r._id, 'dispute')} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold">
                    Escalate Dispute
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SellerFinancePage() {
  const [data, setData] = useState<any>(null);
  const [amount, setAmount] = useState(500);
  const [method, setMethod] = useState<'bkash' | 'nagad' | 'bank'>('bkash');
  const [accountNumber, setAccountNumber] = useState('');
  const dispatch = useDispatch();

  const load = () => {
    apiRequest('/api/seller/finance')
      .then((res) => {
        setData(res);
        if (res?.minPayoutAmount) {
          setAmount((prev) => (prev < res.minPayoutAmount ? res.minPayoutAmount : prev));
        }
      })
      .catch((err: any) => dispatch(pushToast({ type: 'error', title: 'Failed to load finance', message: err.message })));
  };
  useEffect(load, []);

  const handlePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/seller/finance/payouts', {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(amount),
          method,
          accountNumber,
          idempotencyKey: `payout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      dispatch(pushToast({ type: 'success', title: 'Payout Request Submitted' }));
      load();
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Payout Error', message: err.message }));
    }
  };

  if (!data) return null;
  const minPayout = Number(data.minPayoutAmount ?? 500);
  const payouts = data.payouts || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {[
          { label: 'Gross Sales', val: formatBDT(data.grossSales) },
          { label: 'Commission Deducted', val: formatBDT(data.totalCommission) },
          { label: 'Pending (In-Transit)', val: formatBDT(data.pendingEarnings) },
          { label: 'Held for Payouts', val: formatBDT(data.heldBalance) },
          { label: 'Eligible Balance', val: formatBDT(data.eligiblePayout), blue: true },
          { label: 'Completed Payouts', val: formatBDT(data.completedPayout) },
          { label: 'Refund Adjustments', val: formatBDT(data.refundAdjustments) },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-[11px] font-semibold text-slate-500">{c.label}</p>
            <p className={`text-lg font-black mt-1 tabular-nums ${c.blue ? 'text-[#0D63F3]' : 'text-slate-900'}`}>
              {c.val}
            </p>
          </div>
        ))}
      </div>

      {/* Request Payout */}
      <form onSubmit={handlePayout} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900">Request Payout</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="number"
            min={minPayout}
            required
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder={`Amount (min ৳${minPayout})`}
            className="h-10 px-3 rounded-xl border border-slate-300 text-sm"
          />
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as any)}
            className="h-10 px-3 rounded-xl border border-slate-300 text-sm bg-white"
          >
            <option value="bkash">bKash</option>
            <option value="nagad">Nagad</option>
            <option value="bank">Bank Transfer</option>
          </select>
          <input
            required
            placeholder="Wallet / Account Number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-300 text-sm"
          />
          <button
            type="submit"
            disabled={data.eligiblePayout < minPayout}
            className="h-10 px-4 rounded-xl bg-[#0D63F3] disabled:bg-slate-300 text-white text-xs font-bold"
          >
            Request Payout
          </button>
        </div>
      </form>

      {/* Payout Requests History */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
        <h2 className="text-base font-bold text-slate-900">Payout Requests History ({payouts.length})</h2>
        {payouts.length === 0 ? (
          <p className="text-xs text-slate-500">No payout requests submitted yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">Payout #</th>
                  <th className="py-2 pr-3">Method &amp; Account</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Settlement Ref</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payouts.map((p: any) => (
                  <tr key={p._id}>
                    <td className="py-2 pr-3 font-mono-num font-bold text-slate-900">{p.payoutNumber}</td>
                    <td className="py-2 pr-3">{p.method?.toUpperCase()} ({p.accountNumber})</td>
                    <td className="py-2 pr-3 uppercase font-bold text-[11px]">{p.status}</td>
                    <td className="py-2 pr-3 font-mono-num text-slate-600">{p.settlementReference || '—'}</td>
                    <td className="py-2 text-right font-bold tabular-nums">{formatBDT(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ledger */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
        <h2 className="text-base font-bold text-slate-900">Financial Ledger</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">Event</th>
                <th className="py-2 pr-3">Bucket</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.recentEntries.map((e: any) => (
                <tr key={e._id}>
                  <td className="py-2 pr-3 font-semibold">{e.entryType}</td>
                  <td className="py-2 pr-3 uppercase text-[11px]">{e.bucket}</td>
                  <td className="py-2 pr-3 text-slate-600">{e.description}</td>
                  <td className="py-2 text-right font-bold tabular-nums">{formatBDT(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
