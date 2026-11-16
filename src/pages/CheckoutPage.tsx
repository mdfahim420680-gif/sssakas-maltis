import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { CheckCircle2, CreditCard, MapPin, ShieldCheck, Store, Truck } from 'lucide-react';
import { BANGLADESH_DIVISIONS } from '../../shared/bangladeshGeo';
import { AppDispatch, RootState } from '../store';
import { clearCartState } from '../store/cartSlice';
import { pushToast } from '../store/uiSlice';
import { apiRequest, formatBDT } from '../lib/api';

export function CheckoutPage() {
  const { items } = useSelector((s: RootState) => s.cart);
  const { user } = useSelector((s: RootState) => s.auth);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const defaultAddr = user?.addresses?.find((a: any) => a.isDefault) || user?.addresses?.[0];

  const [fullName, setFullName] = useState(defaultAddr?.fullName || user?.name || '');
  const [phone, setPhone] = useState(defaultAddr?.phone || user?.phone || '');
  const [alternatePhone, setAlternatePhone] = useState(defaultAddr?.alternatePhone || '');
  const [division, setDivision] = useState(defaultAddr?.division || 'Dhaka');
  const [district, setDistrict] = useState(defaultAddr?.district || 'Dhaka');
  const [upazila, setUpazila] = useState(defaultAddr?.upazila || 'Dhanmondi');
  const [unionOrArea, setUnionOrArea] = useState(defaultAddr?.unionOrArea || '');
  const [streetAddress, setStreetAddress] = useState(defaultAddr?.streetAddress || '');
  const [postalCode, setPostalCode] = useState(defaultAddr?.postalCode || '1209');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [deliverySpeed, setDeliverySpeed] = useState<'standard' | 'express'>('standard');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'bkash' | 'nagad' | 'card'>('cod');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [serverQuote, setServerQuote] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [idempotencyKey] = useState(() => `chk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  const divisionObj = useMemo(
    () => BANGLADESH_DIVISIONS.find((d) => d.name === division) || BANGLADESH_DIVISIONS[0],
    [division]
  );
  const districtObj = useMemo(
    () => divisionObj.districts.find((d) => d.name === district) || divisionObj.districts[0],
    [divisionObj, district]
  );

  // Keep dependent selects synchronized
  const handleDivisionChange = (nextDiv: string) => {
    setDivision(nextDiv);
    const dObj = BANGLADESH_DIVISIONS.find((d) => d.name === nextDiv);
    if (dObj) {
      const firstDist = dObj.districts[0];
      setDistrict(firstDist.name);
      const firstUpz = firstDist.upazilas[0];
      setUpazila(firstUpz.name);
      if (firstUpz.postalCodes[0]) setPostalCode(firstUpz.postalCodes[0]);
    }
  };

  const handleDistrictChange = (nextDist: string) => {
    setDistrict(nextDist);
    const distObj = divisionObj.districts.find((d) => d.name === nextDist);
    if (distObj) {
      const firstUpz = distObj.upazilas[0];
      setUpazila(firstUpz.name);
      if (firstUpz.postalCodes[0]) setPostalCode(firstUpz.postalCodes[0]);
    }
  };

  const handleUpazilaChange = (nextUpz: string) => {
    setUpazila(nextUpz);
    const uObj = districtObj.upazilas.find((u) => u.name === nextUpz);
    if (uObj?.postalCodes[0]) setPostalCode(uObj.postalCodes[0]);
  };

  // Fetch authoritative server quote whenever address/delivery/coupon changes
  useEffect(() => {
    if (items.length === 0) return;
    apiRequest('/api/cart/quote', {
      method: 'POST',
      body: JSON.stringify({
        items: items.map((i) => ({ offerId: i.offerId, quantity: i.quantity })),
        division,
        district,
        upazila,
        deliverySpeed,
        couponCode: appliedCoupon || undefined,
      }),
    })
      .then((res) => {
        setServerQuote(res.quote);
        setCouponError(res.couponError || '');
      })
      .catch(() => {});
  }, [items, division, district, upazila, deliverySpeed, appliedCoupon]);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/login?redirect=/checkout');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest<{
        parentOrder: { _id: string; orderNumber: string };
        payment: { mode: string; redirectUrl?: string; message: string };
      }>('/api/orders/checkout', {
        method: 'POST',
        body: JSON.stringify({
          address: {
            fullName,
            phone,
            alternatePhone: alternatePhone || undefined,
            division,
            district,
            upazila,
            unionOrArea,
            streetAddress,
            postalCode,
            deliveryInstructions: deliveryInstructions || undefined,
          },
          deliverySpeed,
          paymentMethod,
          couponCode: appliedCoupon || undefined,
          idempotencyKey,
        }),
      });

      dispatch(clearCartState());
      dispatch(
        pushToast({
          type: 'success',
          title: `Order ${res.parentOrder.orderNumber} Confirmed`,
          message: res.payment.message,
        })
      );

      if (res.payment.redirectUrl) {
        window.location.href = res.payment.redirectUrl;
        return;
      }
      navigate(`/orders/${res.parentOrder._id}`);
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Checkout Failed', message: err.message }));
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
        <h1 className="text-lg font-bold text-slate-900">Sign in to Complete Checkout</h1>
        <p className="text-xs text-slate-600">
          Your cart items will automatically sync to your account upon signing in.
        </p>
        <Link
          to="/login?redirect=/checkout"
          className="inline-block px-6 py-2.5 rounded-xl bg-[#0D63F3] text-white text-xs font-bold"
        >
          Sign In / Register
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
        <h1 className="text-lg font-bold text-slate-900">Your Cart is Empty</h1>
        <Link to="/search" className="inline-block px-5 py-2.5 rounded-xl bg-[#0D63F3] text-white text-xs font-bold">
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1360px] mx-auto px-4 py-6">
      <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-6">
        Bangladesh Checkout
      </h1>

      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-5">
          {/* 1. Delivery Address */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#0D63F3]" /> 1. Delivery Address (Bangladesh)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm outline-none focus:border-[#0D63F3]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Mobile (BD) *</label>
                <input
                  required
                  placeholder="017XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm outline-none focus:border-[#0D63F3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Division *</label>
                <select
                  value={division}
                  onChange={(e) => handleDivisionChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm bg-white outline-none focus:border-[#0D63F3]"
                >
                  {BANGLADESH_DIVISIONS.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name} ({d.bnName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">District *</label>
                <select
                  value={district}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm bg-white outline-none focus:border-[#0D63F3]"
                >
                  {divisionObj.districts.map((dist) => (
                    <option key={dist.name} value={dist.name}>
                      {dist.name} ({dist.bnName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Upazila / Thana *</label>
                <select
                  value={upazila}
                  onChange={(e) => handleUpazilaChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm bg-white outline-none focus:border-[#0D63F3]"
                >
                  {districtObj.upazilas.map((u) => (
                    <option key={u.name} value={u.name}>
                      {u.name} ({u.bnName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Union / Ward / Area *</label>
                <input
                  required
                  placeholder="e.g. Road 9/A, Sector 7"
                  value={unionOrArea}
                  onChange={(e) => setUnionOrArea(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm outline-none focus:border-[#0D63F3]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Detailed House &amp; Road Address *</label>
                <input
                  required
                  placeholder="House #, Flat #, Road #, Landmark"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm outline-none focus:border-[#0D63F3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Postal Code (4 digits) *</label>
                <input
                  required
                  maxLength={4}
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm outline-none focus:border-[#0D63F3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alternate Phone (Optional)</label>
                <input
                  placeholder="018XXXXXXXX"
                  value={alternatePhone}
                  onChange={(e) => setAlternatePhone(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm outline-none focus:border-[#0D63F3]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Instructions (Optional)</label>
                <input
                  placeholder="Call before arriving / Leave with building guard"
                  value={deliveryInstructions}
                  onChange={(e) => setDeliveryInstructions(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm outline-none focus:border-[#0D63F3]"
                />
              </div>
            </div>
          </div>

          {/* 2. Delivery Speed */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#0D63F3]" /> 2. Delivery Option
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  id: 'standard',
                  title: 'Standard Courier Delivery',
                  desc: '2-4 business days across Bangladesh (Free over threshold)',
                },
                {
                  id: 'express',
                  title: 'Express Priority Delivery',
                  desc: 'Next-day Dhaka / Priority nationwide (+৳60 per seller)',
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDeliverySpeed(opt.id as 'standard' | 'express')}
                  className={`p-4 rounded-xl border text-left cursor-pointer ${
                    deliverySpeed === opt.id ? 'border-[#0D63F3] bg-blue-50/50' : 'border-slate-200'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">{opt.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Payment Method */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#0D63F3]" /> 3. Payment Method
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 'cod', label: 'Cash on Delivery', sub: 'Pay at doorstep' },
                { id: 'bkash', label: 'bKash', sub: 'MFS Checkout' },
                { id: 'nagad', label: 'Nagad', sub: 'MFS Checkout' },
                { id: 'card', label: 'Card / SSLCommerz', sub: 'Visa / Mastercard' },
              ].map((pm) => (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => setPaymentMethod(pm.id as any)}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer ${
                    paymentMethod === pm.id ? 'border-[#0D63F3] bg-blue-50/60' : 'border-slate-200'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">{pm.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{pm.sub}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Server-Authoritative Order Review */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 space-y-4 sticky top-24">
          <h2 className="text-base font-bold text-slate-900">Order Review (Server-Quoted)</h2>

          {/* Seller packages breakdown */}
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {(serverQuote?.sellerGroups || []).map((g: any) => (
              <div key={g.storeId} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-[#0D63F3]" />
                    {g.storeName}
                  </span>
                  <span className="tabular-nums">{formatBDT(g.subtotal)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Seller Shipping ({district})</span>
                  <span className="tabular-nums">{g.shippingFee === 0 ? 'Free' : formatBDT(g.shippingFee)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Coupon */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700">Promo / Coupon Code</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Try NOVARA10"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                className="flex-1 h-9 px-3 rounded-lg border border-slate-300 text-xs uppercase outline-none"
              />
              <button
                type="button"
                onClick={() => setAppliedCoupon(couponInput.trim().toUpperCase())}
                className="px-3.5 h-9 rounded-lg bg-slate-900 text-white text-xs font-bold"
              >
                Apply
              </button>
            </div>
            {couponError && <p className="text-[11px] text-red-600">{couponError}</p>}
            {appliedCoupon && !couponError && (
              <p className="text-[11px] text-emerald-700 font-semibold">Coupon {appliedCoupon} applied!</p>
            )}
          </div>

          <div className="space-y-2 text-xs pt-2 border-t border-slate-200">
            <div className="flex justify-between text-slate-600">
              <span>Items Subtotal</span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {formatBDT(serverQuote?.itemsSubtotal || 0)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Delivery Total</span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {serverQuote?.shippingTotal === 0 ? 'Free' : formatBDT(serverQuote?.shippingTotal || 0)}
              </span>
            </div>
            {(serverQuote?.couponDiscountTotal || 0) > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Coupon Discount</span>
                <span className="tabular-nums">-{formatBDT(serverQuote.couponDiscountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
              <span>Grand Total</span>
              <span className="text-[#0D63F3] tabular-nums">{formatBDT(serverQuote?.grandTotal || 0)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] disabled:bg-slate-400 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            {submitting ? 'Placing Order...' : 'Place Order'}
          </button>

          <p className="text-[11px] text-slate-500 flex items-center gap-1.5 justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Authoritative price &amp; inventory verified on server
          </p>
        </div>
      </form>
    </div>
  );
}
