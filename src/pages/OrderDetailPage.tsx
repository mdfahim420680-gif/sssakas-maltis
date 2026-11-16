import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Package, Printer, RotateCcw, Store, Truck, XCircle } from 'lucide-react';
import { apiRequest, formatBDT } from '../lib/api';
import { pushToast } from '../store/uiSlice';
import { Modal } from '../components/ui/Modal';

export function OrderDetailPage() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [returnSubOrder, setReturnSubOrder] = useState<any>(null);
  const [returnReason, setReturnReason] = useState('damaged_item');
  const [returnDetails, setReturnDetails] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const loadOrder = () => {
    setLoading(true);
    apiRequest(`/api/orders/${id}`)
      .then((res) => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrder();
  }, [id]);

  const handleCancelSubOrder = async (subOrderId: string) => {
    try {
      await apiRequest(`/api/orders/suborders/${subOrderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Customer requested cancellation' }),
      });
      dispatch(pushToast({ type: 'success', title: 'Cancellation Processed' }));
      loadOrder();
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Cancel failed', message: err.message }));
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnSubOrder) return;
    setSubmittingReturn(true);
    try {
      await apiRequest('/api/orders/returns', {
        method: 'POST',
        body: JSON.stringify({
          subOrderId: returnSubOrder._id,
          reason: returnReason,
          details: returnDetails,
        }),
      });
      dispatch(pushToast({ type: 'success', title: 'Return Request Submitted' }));
      setReturnSubOrder(null);
      setReturnDetails('');
      loadOrder();
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Return failed', message: err.message }));
    } finally {
      setSubmittingReturn(false);
    }
  };

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-10 text-sm text-slate-500">Loading order details...</div>;
  }

  if (!data?.parentOrder) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 bg-white rounded-2xl border border-slate-200 text-center">
        <h1 className="text-lg font-bold">Order Not Found</h1>
        <Link to="/orders" className="inline-block mt-4 px-4 py-2 rounded-lg bg-[#0D63F3] text-white text-xs font-bold">
          Back to My Orders
        </Link>
      </div>
    );
  }

  const { parentOrder, subOrders, paymentTransaction, returns } = data;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-5">
        <div>
          <p className="text-xs text-slate-500">Parent Order Number</p>
          <h1 className="text-xl font-extrabold text-slate-900 font-mono-num">{parentOrder.orderNumber}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Placed on {new Date(parentOrder.createdAt).toLocaleString()} · Payment:{' '}
            <strong className="uppercase">{parentOrder.paymentMethod}</strong> ({parentOrder.paymentStatus})
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-slate-500 block">Grand Total</span>
            <span className="text-xl font-black text-[#0D63F3] tabular-nums">
              {formatBDT(parentOrder.grandTotal)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 print:hidden"
          >
            <Printer className="w-4 h-4" /> Print Invoice
          </button>
        </div>
      </div>

      {/* Shipping & Payment Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 text-xs space-y-1">
          <h2 className="text-sm font-bold text-slate-900 mb-2">Delivery Address</h2>
          <p className="font-bold text-slate-800">{parentOrder.shippingAddress.fullName}</p>
          <p className="text-slate-600">{parentOrder.shippingAddress.phone}</p>
          <p className="text-slate-600">
            {parentOrder.shippingAddress.streetAddress}, {parentOrder.shippingAddress.unionOrArea}
          </p>
          <p className="text-slate-600">
            {parentOrder.shippingAddress.upazila}, {parentOrder.shippingAddress.district},{' '}
            {parentOrder.shippingAddress.division} - {parentOrder.shippingAddress.postalCode}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 text-xs space-y-1.5">
          <h2 className="text-sm font-bold text-slate-900 mb-2">Payment &amp; Totals</h2>
          <div className="flex justify-between">
            <span className="text-slate-500">Items Subtotal</span>
            <span className="font-semibold tabular-nums">{formatBDT(parentOrder.itemsSubtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Shipping Total</span>
            <span className="font-semibold tabular-nums">{formatBDT(parentOrder.shippingTotal)}</span>
          </div>
          {parentOrder.couponDiscountTotal > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Coupon ({parentOrder.couponCode})</span>
              <span className="font-semibold tabular-nums">-{formatBDT(parentOrder.couponDiscountTotal)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-slate-100 font-bold text-slate-900">
            <span>Gateway Ref</span>
            <span className="font-mono-num">{paymentTransaction?.gatewayTransactionId || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Seller-Specific Suborders */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900">
          Seller Fulfillment Packages ({subOrders.length})
        </h2>

        {subOrders.map((sub: any) => {
          const ret = returns.find((r: any) => String(r.subOrderId) === String(sub._id));
          const canCancel = ['pending', 'confirmed', 'processing', 'packed'].includes(sub.status);
          const canReturn = sub.status === 'delivered' && !ret;

          return (
            <div key={sub._id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Store className="w-4 h-4 text-[#0D63F3]" />
                  <div>
                    <span className="text-xs font-bold text-slate-900">{sub.storeName}</span>
                    <span className="mx-2 text-slate-300">|</span>
                    <span className="text-xs font-mono-num text-slate-600">{sub.subOrderNumber}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#0D63F3] text-[11px] font-bold uppercase">
                    {sub.status.replace(/_/g, ' ')}
                  </span>
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => handleCancelSubOrder(sub._id)}
                      className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1 print:hidden"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Cancel
                    </button>
                  )}
                  {canReturn && (
                    <button
                      type="button"
                      onClick={() => setReturnSubOrder(sub)}
                      className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50 text-xs font-semibold flex items-center gap-1 print:hidden"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Request Return
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="divide-y divide-slate-100">
                  {sub.items.map((item: any, idx: number) => (
                    <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Package className="w-8 h-8 p-1.5 rounded-lg bg-slate-100 text-slate-500 shrink-0" />
                        <div>
                          <Link
                            to={`/product/${item.productSlug}`}
                            className="text-xs font-bold text-slate-900 hover:text-[#0D63F3]"
                          >
                            {item.productTitle}
                          </Link>
                          <p className="text-[11px] text-slate-500">
                            SKU: {item.variantSku} ({item.variantLabel}) · Qty: {item.quantity}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-900 tabular-nums">
                        {formatBDT(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>

                {sub.shipment?.trackingNumber && (
                  <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-200/70 text-xs flex items-center gap-2">
                    <Truck className="w-4 h-4 text-[#0D63F3]" />
                    <span>
                      Courier: <strong>{sub.shipment.courierName}</strong> · Tracking:{' '}
                      <strong className="font-mono-num">{sub.shipment.trackingNumber}</strong>
                    </span>
                  </div>
                )}

                {ret && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                    <strong>Return {ret.returnNumber}:</strong> Status is{' '}
                    <span className="uppercase font-bold">{ret.status.replace(/_/g, ' ')}</span> ({ret.reason})
                  </div>
                )}

                {/* Timeline */}
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-[11px] font-bold text-slate-700 mb-2">Fulfillment Timeline</p>
                  <div className="space-y-1.5">
                    {sub.timeline?.map((ev: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-[11px] text-slate-600">
                        <span>
                          <strong className="uppercase text-slate-800">{ev.status.replace(/_/g, ' ')}</strong> —{' '}
                          {ev.note}
                        </span>
                        <span className="text-slate-400 tabular-nums">
                          {new Date(ev.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Return Modal */}
      <Modal
        open={Boolean(returnSubOrder)}
        title={`Request Return — ${returnSubOrder?.subOrderNumber || ''}`}
        onClose={() => setReturnSubOrder(null)}
      >
        <form onSubmit={handleReturnSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Return Reason</label>
            <select
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm bg-white"
            >
              <option value="damaged_item">Damaged Item Received</option>
              <option value="wrong_item">Wrong Product / Variant</option>
              <option value="defective_not_working">Defective / Not Working</option>
              <option value="missing_accessories">Missing Accessories</option>
              <option value="not_as_described">Not as Described</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Details *</label>
            <textarea
              required
              minLength={10}
              rows={3}
              value={returnDetails}
              onChange={(e) => setReturnDetails(e.target.value)}
              placeholder="Explain the issue clearly..."
              className="w-full p-3 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReturnSubOrder(null)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingReturn}
              className="px-4 py-2 rounded-xl bg-[#0D63F3] text-white text-xs font-bold"
            >
              {submittingReturn ? 'Submitting...' : 'Submit Return Request'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
