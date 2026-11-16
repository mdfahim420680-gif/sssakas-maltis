import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  BadgeCheck,
  Check,
  ChevronRight,
  Flag,
  Heart,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
  Truck,
  Zap,
} from 'lucide-react';
import { apiRequest, formatBDT } from '../lib/api';
import { AppDispatch, RootState } from '../store';
import { addItemToCart } from '../store/cartSlice';
import { setWishlistCount } from '../store/authSlice';
import { pushToast } from '../store/uiSlice';
import { ImageWithFallback } from '../components/ui/ImageWithFallback';
import { ProductCard, ProductCardItem } from '../components/ui/ProductCard';

export function ProductDetailPage() {
  const { slug } = useParams();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const user = useSelector((s: RootState) => s.auth.user);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [selectedSku, setSelectedSku] = useState<string>('');
  const [selectedOfferId, setSelectedOfferId] = useState<string>('');
  const [qty, setQty] = useState(1);
  const [zoomActive, setZoomActive] = useState(false);

  // Review form state
  const [reviewSubOrderId, setReviewSubOrderId] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadProduct = async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`/api/catalog/products/${slug}`);
      setData(res);
      const firstOffer = res.offers?.[0];
      if (firstOffer) {
        setSelectedSku(firstOffer.variantSku);
        setSelectedOfferId(firstOffer._id);
      } else if (res.product?.variants?.[0]) {
        setSelectedSku(res.product.variants[0].sku);
      }
      if (res.eligibleSubOrders?.[0]) {
        setReviewSubOrderId(res.eligibleSubOrders[0]._id);
      }
      setSelectedImageIdx(0);
      setQty(1);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProduct();
  }, [slug]);

  const variantOffers = useMemo(() => {
    if (!data?.offers) return [];
    const matching = data.offers.filter((o: any) => o.variantSku === selectedSku);
    return matching.length > 0 ? matching : data.offers;
  }, [data, selectedSku]);

  const activeOffer = useMemo(() => {
    return (
      variantOffers.find((o: any) => o._id === selectedOfferId) ||
      variantOffers[0] ||
      data?.offers?.[0] ||
      null
    );
  }, [variantOffers, selectedOfferId, data]);

  const handleVariantChange = (sku: string) => {
    setSelectedSku(sku);
    const firstMatching = data?.offers?.find((o: any) => o.variantSku === sku && o.stock > 0) ||
      data?.offers?.find((o: any) => o.variantSku === sku);
    if (firstMatching) {
      setSelectedOfferId(firstMatching._id);
      setQty(1);
    }
  };

  const handleAddToCart = async (buyNow = false) => {
    if (!activeOffer) return;
    try {
      await dispatch(
        addItemToCart({ offerId: activeOffer._id, quantity: qty, openDrawer: !buyNow })
      ).unwrap();
      if (buyNow) {
        navigate('/checkout');
      } else {
        dispatch(
          pushToast({
            type: 'success',
            title: 'Added to Cart',
            message: `${data.product.title} from ${activeOffer.store.name}`,
          })
        );
      }
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Could not add item', message: err.message }));
    }
  };

  const handleToggleWishlist = async () => {
    if (!user) {
      navigate(`/login?redirect=/product/${slug}`);
      return;
    }
    try {
      const res = await apiRequest<{ wishlisted: boolean; count: number }>(
        `/api/auth/wishlist/${data.product._id}`,
        { method: 'POST' }
      );
      dispatch(setWishlistCount(res.count));
      dispatch(
        pushToast({
          type: 'info',
          title: res.wishlisted ? 'Saved to Wishlist' : 'Removed from Wishlist',
        })
      );
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Wishlist error', message: err.message }));
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      await apiRequest(`/api/catalog/products/${data.product._id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          subOrderId: reviewSubOrderId,
          rating: reviewRating,
          title: reviewTitle,
          comment: reviewComment,
        }),
      });
      dispatch(pushToast({ type: 'success', title: 'Review Published', message: 'Thank you for your verified review!' }));
      setReviewTitle('');
      setReviewComment('');
      loadProduct();
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Review failed', message: err.message }));
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1360px] mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 h-[440px] rounded-2xl bg-slate-200/70 animate-pulse" />
          <div className="lg:col-span-7 h-[440px] rounded-2xl bg-slate-200/70 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data?.product) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 bg-white rounded-2xl border border-slate-200 text-center">
        <h1 className="text-lg font-bold text-slate-900">Product Unavailable</h1>
        <p className="text-xs text-slate-500 mt-1">This product may have been unpublished or removed.</p>
        <Link to="/search" className="inline-block mt-4 px-5 py-2 rounded-lg bg-[#0D63F3] text-white text-xs font-bold">
          Browse Catalog
        </Link>
      </div>
    );
  }

  const product = data.product;
  const maxQty = activeOffer ? Math.min(activeOffer.stock, activeOffer.maxPurchaseQty || 5) : 1;

  return (
    <div className="max-w-[1360px] mx-auto px-4 py-6 space-y-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
        <Link to="/" className="hover:text-[#0D63F3]">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        {product.categoryId && (
          <>
            <Link to={`/category/${product.categoryId.slug}`} className="hover:text-[#0D63F3]">
              {product.categoryId.name}
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
          </>
        )}
        <span className="text-slate-900 font-semibold truncate">{product.title}</span>
      </nav>

      {/* Main Contiguous Purchase Section */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Gallery Left */}
        <div className="lg:col-span-5 space-y-3">
          <div
            onClick={() => setZoomActive((v) => !v)}
            className="relative aspect-square rounded-2xl bg-[#F8FAFC] border border-slate-200/70 overflow-hidden cursor-zoom-in"
          >
            {activeOffer?.discountPercent > 0 && (
              <span className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg bg-[#EF3E36] text-white text-xs font-bold tabular-nums">
                -{activeOffer.discountPercent}% OFF
              </span>
            )}
            <ImageWithFallback
              src={product.images?.[selectedImageIdx]}
              alt={product.title}
              className={`w-full h-full object-cover transition-transform duration-300 ${
                zoomActive ? 'scale-125' : 'scale-100'
              }`}
            />
          </div>

          {product.images?.length > 1 && (
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {product.images.map((img: string, idx: number) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImageIdx(idx)}
                  aria-label={`View product image ${idx + 1}`}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 ${
                    idx === selectedImageIdx ? 'border-[#0D63F3]' : 'border-slate-200'
                  }`}
                >
                  <ImageWithFallback src={img} alt={`${product.title} view ${idx + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Purchase Details Center/Right */}
        <div className="lg:col-span-7 grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-7 space-y-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-bold text-[#0D63F3]">{product.brandId?.name || 'Brand'}</span>
                <span>·</span>
                <span>Model: {product.modelName || 'Standard'}</span>
                <span>·</span>
                <span>SKU: {selectedSku}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1.5 leading-snug">
                {product.title}
              </h1>
              {product.bnTitle && <p className="text-sm text-slate-500 mt-0.5">{product.bnTitle}</p>}

              <div className="flex items-center gap-3 mt-2.5">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    {product.ratingAvg > 0 ? product.ratingAvg.toFixed(1) : 'New'}
                  </span>
                </div>
                <span className="text-xs text-slate-500 tabular-nums">
                  {product.ratingCount} Verified Reviews
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-slate-600 tabular-nums">{product.totalSold} Sold</span>
              </div>
            </div>

            {/* Price & Flash indicator */}
            {activeOffer ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <span className="text-2xl sm:text-3xl font-black text-[#EF3E36] tabular-nums">
                    {formatBDT(activeOffer.price)}
                  </span>
                  {activeOffer.compareAtPrice && (
                    <span className="text-sm text-slate-400 line-through tabular-nums">
                      {formatBDT(activeOffer.compareAtPrice)}
                    </span>
                  )}
                  {activeOffer.isFlashSale && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] font-bold">
                      <Zap className="w-3 h-3" /> Flash Sale Price
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Sold by{' '}
                  <Link to={`/shop/${activeOffer.store.slug}`} className="font-bold text-[#0D63F3] hover:underline">
                    {activeOffer.store.name}
                  </Link>{' '}
                  ·{' '}
                  <span className={activeOffer.stock > 0 ? 'text-emerald-700 font-semibold' : 'text-red-600 font-semibold'}>
                    {activeOffer.stock > 0 ? `In Stock (${activeOffer.stock} available)` : 'Out of Stock'}
                  </span>
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                Currently out of stock across all sellers.
              </div>
            )}

            {/* Variant Selection */}
            {product.variants?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-800 mb-2">
                  Select Variant ({product.variants.find((v: any) => v.sku === selectedSku)?.label})
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v: any) => {
                    const active = v.sku === selectedSku;
                    return (
                      <button
                        key={v.sku}
                        type="button"
                        onClick={() => handleVariantChange(v.sku)}
                        className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          active
                            ? 'border-[#0D63F3] bg-blue-50 text-[#0D63F3]'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity & Action Buttons */}
            {activeOffer && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-700">Quantity:</span>
                  <div className="inline-flex items-center border border-slate-300 rounded-xl bg-white">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-l-xl"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-10 text-center text-sm font-bold tabular-nums">{qty}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      disabled={qty >= maxQty}
                      onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                      className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-r-xl disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-500">Max {maxQty} per order</span>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    disabled={activeOffer.stock <= 0}
                    onClick={() => handleAddToCart(false)}
                    className="flex-1 min-w-[150px] h-11 px-5 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] disabled:bg-slate-300 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <ShoppingCart className="w-4 h-4" /> Add to Cart
                  </button>
                  <button
                    type="button"
                    disabled={activeOffer.stock <= 0}
                    onClick={() => handleAddToCart(true)}
                    className="flex-1 min-w-[140px] h-11 px-5 rounded-xl bg-[#0B1F4B] hover:bg-slate-900 disabled:bg-slate-300 text-white text-sm font-bold cursor-pointer"
                  >
                    Buy Now
                  </button>
                  <button
                    type="button"
                    aria-label="Save to wishlist"
                    onClick={handleToggleWishlist}
                    className="h-11 w-11 rounded-xl border border-slate-300 hover:border-red-300 hover:text-red-600 flex items-center justify-center text-slate-600 cursor-pointer"
                  >
                    <Heart className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Multi-Seller Offer Comparison Module */}
            {variantOffers.length > 0 && (
              <div className="pt-3 border-t border-slate-200">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-2.5">
                  Seller Offers for {selectedSku} ({variantOffers.length})
                </h2>
                <div className="space-y-2">
                  {variantOffers.map((offer: any) => {
                    const isSelected = activeOffer?._id === offer._id;
                    return (
                      <div
                        key={offer._id}
                        className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                          isSelected ? 'border-[#0D63F3] bg-blue-50/40' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-[#0D63F3]" />
                            <Link
                              to={`/shop/${offer.store.slug}`}
                              className="text-xs font-bold text-slate-900 hover:text-[#0D63F3]"
                            >
                              {offer.store.name}
                            </Link>
                            {offer.store.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#0D63F3]" />}
                            <span className="text-[11px] text-slate-500">
                              ★ {offer.store.ratingAvg?.toFixed(1) || '4.5'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Est. {offer.deliveryEstimateDays} · Dhaka {formatBDT(offer.shippingFeeDhaka)} / Nationwide{' '}
                            {formatBDT(offer.shippingFeeNationwide)} · Stock: {offer.stock}
                          </p>
                          {offer.offerNote && <p className="text-[11px] text-emerald-700 mt-0.5">{offer.offerNote}</p>}
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm font-extrabold text-[#EF3E36] tabular-nums">
                            {formatBDT(offer.price)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOfferId(offer._id);
                              setQty(1);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1 ${
                              isSelected
                                ? 'bg-[#0D63F3] text-white'
                                : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                            {isSelected ? 'Selected' : 'Select'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Delivery, Warranty & Payment Info Sidebar */}
          <div className="xl:col-span-5 space-y-3">
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 space-y-3.5 text-xs">
              <h3 className="font-bold text-slate-900 text-sm">Delivery &amp; Service</h3>
              <div className="flex items-start gap-2.5">
                <Truck className="w-4 h-4 text-[#0D63F3] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">
                    Estimated Delivery: {activeOffer?.deliveryEstimateDays || '2-4 Days'}
                  </p>
                  <p className="text-slate-500 mt-0.5">
                    Dhaka Metro {formatBDT(activeOffer?.shippingFeeDhaka ?? 60)} · Nationwide{' '}
                    {formatBDT(activeOffer?.shippingFeeNationwide ?? 120)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <RotateCcw className="w-4 h-4 text-[#0D63F3] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">{product.returnPolicyDays} Days Easy Return</p>
                  <p className="text-slate-500 mt-0.5">Eligible for damaged, defective, or wrong items</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#0D63F3] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">{product.warranty}</p>
                  <p className="text-slate-500 mt-0.5">Cash on Delivery, bKash, Nagad &amp; Cards accepted</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Description, Specifications & Reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-6 space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 mb-2">Product Description</h2>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{product.description}</p>
          </div>

          {product.specifications?.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-3">Specifications</h2>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
                {product.specifications.map((spec: any, i: number) => (
                  <div key={i} className="grid grid-cols-3 text-xs">
                    <div className="px-4 py-2.5 bg-slate-50 font-semibold text-slate-700">{spec.key}</div>
                    <div className="col-span-2 px-4 py-2.5 text-slate-900">{spec.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Verified Reviews Column */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Verified Customer Reviews</h2>
            <span className="text-sm font-bold text-amber-500 tabular-nums">
              ★ {product.ratingAvg > 0 ? product.ratingAvg.toFixed(1) : '—'} ({data.reviews?.length || 0})
            </span>
          </div>

          {/* Rating Breakdown */}
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = data.ratingDistribution?.[stars] || 0;
              const pct = data.reviews?.length ? Math.round((count / data.reviews.length) * 100) : 0;
              return (
                <div key={stars} className="flex items-center gap-2 text-xs">
                  <span className="w-8 text-slate-600 font-medium tabular-nums">{stars} ★</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-slate-500 tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>

          {/* Eligible Customer Review Submission */}
          {data.eligibleSubOrders?.length > 0 && (
            <form onSubmit={handleReviewSubmit} className="p-4 rounded-xl bg-blue-50/50 border border-blue-200 space-y-3">
              <p className="text-xs font-bold text-slate-900">Write a Verified Purchase Review</p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={reviewSubOrderId}
                  onChange={(e) => setReviewSubOrderId(e.target.value)}
                  className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
                >
                  {data.eligibleSubOrders.map((s: any) => (
                    <option key={s._id} value={s._id}>
                      {s.subOrderNumber} ({s.storeName})
                    </option>
                  ))}
                </select>
                <select
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                  className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
                >
                  {[5, 4, 3, 2, 1].map((r) => (
                    <option key={r} value={r}>
                      {r} Stars
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                placeholder="Review headline"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs"
              />
              <textarea
                required
                rows={2}
                placeholder="Share your experience with product quality and seller delivery..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-xs"
              />
              <button
                type="submit"
                disabled={submittingReview}
                className="px-4 py-2 rounded-lg bg-[#0D63F3] text-white text-xs font-bold"
              >
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          )}

          {/* Review List */}
          <div className="space-y-3 divide-y divide-slate-100">
            {data.reviews?.length === 0 ? (
              <p className="text-xs text-slate-500">No verified reviews yet for this product.</p>
            ) : (
              data.reviews.map((rev: any) => (
                <div key={rev._id} className="pt-3 first:pt-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{rev.customerName}</span>
                    <span className="text-[11px] font-semibold text-emerald-700">Verified Purchase</span>
                  </div>
                  <div className="flex items-center gap-1 text-amber-400">
                    {Array.from({ length: rev.rating }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-amber-400" />
                    ))}
                    {rev.title && <span className="ml-1.5 text-xs font-semibold text-slate-800">{rev.title}</span>}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{rev.comment}</p>
                  {rev.sellerReply && (
                    <div className="p-2.5 rounded-lg bg-slate-50 text-[11px] text-slate-700 border border-slate-200/60">
                      <span className="font-bold">Seller Response:</span> {rev.sellerReply.text}
                    </div>
                  )}
                  {user && (
                    <button
                      type="button"
                      onClick={() =>
                        apiRequest(`/api/catalog/reviews/${rev._id}/report`, {
                          method: 'POST',
                          body: JSON.stringify({ reason: 'Flagged by user for moderation review' }),
                        }).then(() =>
                          dispatch(pushToast({ type: 'info', title: 'Review Reported', message: 'Moderators will review this.' }))
                        )
                      }
                      className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-red-600"
                    >
                      <Flag className="w-3 h-3" /> Report
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Related Products */}
      {data.relatedProducts?.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Similar &amp; Related Products</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {data.relatedProducts.map((p: ProductCardItem) => (
              <ProductCard key={p._id} product={p} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
