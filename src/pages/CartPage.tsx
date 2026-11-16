import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowRight, Minus, Plus, ShoppingBag, Store, Trash2 } from 'lucide-react';
import { AppDispatch, RootState } from '../store';
import { removeCartItem, updateCartItemQty } from '../store/cartSlice';
import { formatBDT } from '../lib/api';
import { ImageWithFallback } from '../components/ui/ImageWithFallback';

export function CartPage() {
  const { items, quote } = useSelector((s: RootState) => s.cart);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const groups = new Map<string, { storeName: string; storeSlug: string; items: typeof items }>();
  for (const item of items) {
    const g = groups.get(item.storeId) || { storeName: item.storeName, storeSlug: item.storeSlug, items: [] };
    g.items.push(item);
    groups.set(item.storeId, g);
  }

  return (
    <div className="max-w-[1360px] mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
        Shopping Cart ({items.reduce((s, i) => s + i.quantity, 0)} items)
      </h1>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">Your cart is empty</h2>
          <p className="text-xs text-slate-500 mt-1">Browse products from verified sellers across Bangladesh.</p>
          <Link
            to="/search"
            className="inline-flex items-center gap-1.5 mt-4 px-5 py-2.5 rounded-xl bg-[#0D63F3] text-white text-xs font-bold"
          >
            Start Shopping <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-4">
            {Array.from(groups.entries()).map(([storeId, group]) => {
              const sq = quote.sellerGroups.find((g) => g.storeId === storeId);
              return (
                <div key={storeId} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <Link
                      to={`/shop/${group.storeSlug}`}
                      className="flex items-center gap-2 text-xs font-bold text-slate-900 hover:text-[#0D63F3]"
                    >
                      <Store className="w-4 h-4 text-[#0D63F3]" />
                      {group.storeName}
                    </Link>
                    <span className="text-xs text-slate-600 tabular-nums">
                      Seller Delivery: <strong>{sq?.shippingFee === 0 ? 'Free' : formatBDT(sq?.shippingFee || 60)}</strong>
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {group.items.map((item) => (
                      <div key={item.offerId} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                        <Link
                          to={`/product/${item.productSlug}`}
                          className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200/60"
                        >
                          <ImageWithFallback src={item.productImage} alt={item.productTitle} />
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link
                            to={`/product/${item.productSlug}`}
                            className="text-sm font-bold text-slate-900 hover:text-[#0D63F3] line-clamp-1"
                          >
                            {item.productTitle}
                          </Link>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Variant: {item.variantLabel} · Est. Delivery: {item.deliveryEstimateDays}
                          </p>
                          <p className="text-xs font-bold text-[#EF3E36] mt-1 tabular-nums">
                            {formatBDT(item.unitPrice)} each
                          </p>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4">
                          <div className="inline-flex items-center border border-slate-300 rounded-lg">
                            <button
                              type="button"
                              aria-label={`Decrease quantity of ${item.productTitle}`}
                              onClick={() =>
                                dispatch(updateCartItemQty({ offerId: item.offerId, quantity: item.quantity - 1 }))
                              }
                              className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-9 text-center text-xs font-bold tabular-nums">{item.quantity}</span>
                            <button
                              type="button"
                              aria-label={`Increase quantity of ${item.productTitle}`}
                              disabled={item.quantity >= Math.min(item.stock, item.maxPurchaseQty)}
                              onClick={() =>
                                dispatch(updateCartItemQty({ offerId: item.offerId, quantity: item.quantity + 1 }))
                              }
                              className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="text-right min-w-[80px]">
                            <p className="text-sm font-extrabold text-slate-900 tabular-nums">
                              {formatBDT(item.unitPrice * item.quantity)}
                            </p>
                          </div>

                          <button
                            type="button"
                            aria-label={`Remove ${item.productTitle}`}
                            onClick={() => dispatch(removeCartItem(item.offerId))}
                            className="p-2 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Order Summary</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal</span>
                <span className="font-semibold text-slate-900 tabular-nums">{formatBDT(quote.itemsSubtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Estimated Delivery ({quote.sellerGroups.length} seller package{quote.sellerGroups.length > 1 ? 's' : ''})</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {quote.shippingTotal === 0 ? 'Free' : formatBDT(quote.shippingTotal)}
                </span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-3 border-t border-slate-200">
                <span>Total</span>
                <span className="text-[#0D63F3] tabular-nums">{formatBDT(quote.grandTotal)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/checkout')}
              className="w-full h-11 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              Proceed to Checkout <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
