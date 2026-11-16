import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Minus, Plus, ShoppingBag, Store, Trash2, X, ArrowRight } from 'lucide-react';
import { AppDispatch, RootState } from '../../store';
import { removeCartItem, setCartDrawerOpen, updateCartItemQty } from '../../store/cartSlice';
import { formatBDT } from '../../lib/api';
import { ImageWithFallback } from '../ui/ImageWithFallback';

export function CartDrawer() {
  const { items, quote, drawerOpen } = useSelector((s: RootState) => s.cart);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!drawerOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch(setCartDrawerOpen(false));
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen, dispatch]);

  if (!drawerOpen) return null;

  // Group items by seller storeId
  const groups = new Map<string, { storeName: string; storeSlug: string; items: typeof items }>();
  for (const item of items) {
    const g = groups.get(item.storeId) || {
      storeName: item.storeName,
      storeSlug: item.storeSlug,
      items: [],
    };
    g.items.push(item);
    groups.set(item.storeId, g);
  }

  return (
    <div
      className="fixed inset-0 z-[75] flex justify-end bg-slate-950/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping Cart Drawer"
      onClick={(e) => {
        if (e.target === e.currentTarget) dispatch(setCartDrawerOpen(false));
      }}
    >
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-[#0D63F3]" />
            <h2 className="text-base font-bold text-slate-900">
              Your Cart ({items.reduce((s, i) => s + i.quantity, 0)})
            </h2>
          </div>
          <button
            type="button"
            onClick={() => dispatch(setCartDrawerOpen(false))}
            aria-label="Close cart drawer"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {items.length === 0 ? (
            <div className="py-16 text-center px-4">
              <ShoppingBag className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-700">Your NOVARA cart is empty</p>
              <p className="text-xs text-slate-500 mt-1">
                Explore verified Bangladesh sellers and add items to your bag.
              </p>
              <Link
                to="/search"
                onClick={() => dispatch(setCartDrawerOpen(false))}
                className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg bg-[#0D63F3] text-white text-xs font-semibold"
              >
                Browse Products
              </Link>
            </div>
          ) : (
            Array.from(groups.entries()).map(([storeId, group]) => {
              const sellerQuote = quote.sellerGroups.find((g) => g.storeId === storeId);
              return (
                <div key={storeId} className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-white border-b border-slate-200/80">
                    <Link
                      to={`/shop/${group.storeSlug}`}
                      onClick={() => dispatch(setCartDrawerOpen(false))}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-[#0D63F3]"
                    >
                      <Store className="w-3.5 h-3.5 text-[#0D63F3]" />
                      {group.storeName}
                    </Link>
                    <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                      Delivery: {sellerQuote ? (sellerQuote.shippingFee === 0 ? 'Free' : formatBDT(sellerQuote.shippingFee)) : '৳60'}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-200/70">
                    {group.items.map((item) => (
                      <div key={item.offerId} className="p-3 bg-white flex gap-3">
                        <Link
                          to={`/product/${item.productSlug}`}
                          onClick={() => dispatch(setCartDrawerOpen(false))}
                          className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200/60"
                        >
                          <ImageWithFallback src={item.productImage} alt={item.productTitle} />
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link
                            to={`/product/${item.productSlug}`}
                            onClick={() => dispatch(setCartDrawerOpen(false))}
                            className="text-xs font-semibold text-slate-900 line-clamp-1 hover:text-[#0D63F3]"
                          >
                            {item.productTitle}
                          </Link>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Variant: {item.variantLabel}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs font-bold text-[#EF3E36] tabular-nums">
                              {formatBDT(item.unitPrice * item.quantity)}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                aria-label={`Decrease quantity of ${item.productTitle}`}
                                onClick={() =>
                                  dispatch(updateCartItemQty({ offerId: item.offerId, quantity: item.quantity - 1 }))
                                }
                                className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-semibold w-5 text-center tabular-nums">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                aria-label={`Increase quantity of ${item.productTitle}`}
                                disabled={item.quantity >= Math.min(item.stock, item.maxPurchaseQty)}
                                onClick={() =>
                                  dispatch(updateCartItemQty({ offerId: item.offerId, quantity: item.quantity + 1 }))
                                }
                                className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Remove ${item.productTitle} from cart`}
                                onClick={() => dispatch(removeCartItem(item.offerId))}
                                className="p-1 text-slate-400 hover:text-red-600 ml-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-slate-200 p-4 bg-slate-50 space-y-3">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal</span>
                <span className="font-semibold text-slate-900 tabular-nums">{formatBDT(quote.itemsSubtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Estimated Delivery ({quote.sellerGroups.length} seller{quote.sellerGroups.length > 1 ? 's' : ''})</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {quote.shippingTotal === 0 ? 'Free' : formatBDT(quote.shippingTotal)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                <span>Estimated Total</span>
                <span className="text-[#0D63F3] tabular-nums">{formatBDT(quote.grandTotal)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  dispatch(setCartDrawerOpen(false));
                  navigate('/cart');
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-bold hover:bg-slate-100"
              >
                View Full Cart
              </button>
              <button
                type="button"
                onClick={() => {
                  dispatch(setCartDrawerOpen(false));
                  navigate('/checkout');
                }}
                className="px-4 py-2.5 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                Checkout <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
