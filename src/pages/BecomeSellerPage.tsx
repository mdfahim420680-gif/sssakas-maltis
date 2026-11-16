import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AlertCircle, CheckCircle2, Clock, Store } from 'lucide-react';
import { AppDispatch, RootState } from '../store';
import { fetchCurrentUser } from '../store/authSlice';
import { pushToast } from '../store/uiSlice';
import { apiRequest } from '../lib/api';
import { BANGLADESH_DIVISIONS } from '../../shared/bangladeshGeo';
import { sellerApplicationSchema } from '../../shared/validation';

const PAYOUT_HINTS: Record<'bkash' | 'nagad' | 'bank', { label: string; placeholder: string; hint: string }> = {
  bkash: {
    label: 'bKash Wallet Number *',
    placeholder: '017XXXXXXXX',
    hint: 'Enter an 11-digit Bangladesh bKash number (e.g. 01711223344).',
  },
  nagad: {
    label: 'Nagad Wallet Number *',
    placeholder: '018XXXXXXXX',
    hint: 'Enter an 11-digit Bangladesh Nagad number (e.g. 01811223344).',
  },
  bank: {
    label: 'Bank Account Number *',
    placeholder: 'e.g. 1011234567890',
    hint: 'Enter your 8–24 digit/character Bangladesh bank account number.',
  },
};

export function BecomeSellerPage() {
  const { user, sellerStore } = useSelector((s: RootState) => s.auth);
  const dispatch = useDispatch<AppDispatch>();
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [storeName, setStoreName] = useState('');
  const [businessType, setBusinessType] = useState<'individual' | 'sole_proprietorship' | 'limited_company'>('sole_proprietorship');
  const [nidNumber, setNidNumber] = useState('');
  const [tradeLicenseNumber, setTradeLicenseNumber] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [division, setDivision] = useState('Dhaka');
  const [district, setDistrict] = useState('Dhaka');
  const [pickupAddress, setPickupAddress] = useState('');
  const [bankOrMfsType, setBankOrMfsType] = useState<'bkash' | 'nagad' | 'bank'>('bkash');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState(user?.name || '');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!user) return;
    setPhone((prev) => prev || user.phone || '');
    setAccountHolderName((prev) => prev || user.name || '');

    apiRequest('/api/seller/onboarding')
      .then((res) => {
        const app = res.application;
        setApplication(app);
        if (app && app.status === 'additional_info_required') {
          setStoreName(app.storeName || '');
          setBusinessType(app.businessType || 'sole_proprietorship');
          setNidNumber(app.nidNumber || '');
          setTradeLicenseNumber(app.tradeLicenseNumber || '');
          setPhone(app.phone || user.phone || '');
          setDivision(app.division || 'Dhaka');
          setDistrict(app.district || 'Dhaka');
          setPickupAddress(app.pickupAddress || '');
          setBankOrMfsType(app.bankOrMfsType || 'bkash');
          setAccountNumber(app.accountNumber || '');
          setAccountHolderName(app.accountHolderName || user.name || '');
          setDescription(app.description || '');
        }
      })
      .catch(() => {});
  }, [user]);

  const divObj = BANGLADESH_DIVISIONS.find((d) => d.name === division) || BANGLADESH_DIVISIONS[0];
  const payoutMeta = PAYOUT_HINTS[bankOrMfsType];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const payload = {
      storeName: storeName.trim(),
      businessType,
      nidNumber: nidNumber.trim(),
      tradeLicenseNumber: tradeLicenseNumber.trim() || undefined,
      phone: phone.trim(),
      division,
      district,
      pickupAddress: pickupAddress.trim(),
      bankOrMfsType,
      accountNumber: accountNumber.trim(),
      accountHolderName: accountHolderName.trim(),
      description: description.trim(),
    };

    const clientCheck = sellerApplicationSchema.safeParse(payload);
    if (!clientCheck.success) {
      const msg = clientCheck.error.issues[0]?.message || 'Please check your application details.';
      setFormError(msg);
      dispatch(pushToast({ type: 'error', title: 'Validation Error', message: msg }));
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ application: any }>('/api/seller/onboarding/apply', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setApplication(res.application);
      dispatch(fetchCurrentUser());
      dispatch(
        pushToast({
          type: 'success',
          title: 'Application Submitted',
          message: 'Your seller application is pending Admin verification.',
        })
      );
    } catch (err: any) {
      const msg = err.message || 'Unable to submit application';
      setFormError(msg);
      dispatch(pushToast({ type: 'error', title: 'Submission Failed', message: msg }));
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-lg mx-auto my-14 p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-4">
        <Store className="w-10 h-10 text-[#0D63F3] mx-auto" />
        <h1 className="text-xl font-extrabold text-slate-900">Sell Across Bangladesh on NOVARA</h1>
        <p className="text-xs text-slate-600">
          Zero mandatory subscription fees to onboard. Sign in or create a customer account to submit your store verification application.
        </p>
        <Link to="/login?redirect=/become-a-seller" className="inline-block px-6 py-2.5 rounded-xl bg-[#0D63F3] text-white text-xs font-bold">
          Sign In to Apply
        </Link>
      </div>
    );
  }

  if (sellerStore?.status === 'suspended' || application?.status === 'suspended') {
    return (
      <div className="max-w-xl mx-auto my-14 p-8 bg-white rounded-2xl border border-red-200 text-center space-y-3">
        <Clock className="w-10 h-10 text-[#EF3E36] mx-auto" />
        <h1 className="text-xl font-extrabold text-slate-900">
          Seller Store Suspended
        </h1>
        <p className="text-xs text-slate-600">
          {sellerStore?.name || application?.storeName} is currently suspended by platform administration. Seller Center access and public product listings are disabled until reinstated.
        </p>
        {application?.reviewNotes && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 text-left">
            <strong>Reviewer Notes:</strong> {application.reviewNotes}
          </div>
        )}
        <Link to="/account/support" className="inline-block px-5 py-2 rounded-xl bg-[#0D63F3] text-white text-xs font-bold">
          Contact Platform Support
        </Link>
      </div>
    );
  }

  if (sellerStore && sellerStore.status === 'active') {
    return (
      <div className="max-w-lg mx-auto my-14 p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-4">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
        <h1 className="text-xl font-extrabold text-slate-900">Your Store "{sellerStore.name}" is Approved</h1>
        <Link to="/seller" className="inline-block px-6 py-2.5 rounded-xl bg-[#0D63F3] text-white text-xs font-bold">
          Open Seller Center →
        </Link>
      </div>
    );
  }

  if (application && ['pending', 'rejected'].includes(application.status)) {
    return (
      <div className="max-w-xl mx-auto my-12 p-7 bg-white rounded-2xl border border-slate-200 space-y-4">
        <div className="flex items-center gap-3">
          <Clock className={`w-8 h-8 ${application.status === 'rejected' ? 'text-[#EF3E36]' : 'text-amber-500'}`} />
          <div>
            <h1 className="text-lg font-extrabold text-slate-900">
              Seller Application: {application.storeName}
            </h1>
            <p className="text-xs text-slate-500">
              Status: <strong className={`uppercase ${application.status === 'rejected' ? 'text-[#EF3E36]' : 'text-[#0D63F3]'}`}>{application.status.replace(/_/g, ' ')}</strong>
            </p>
          </div>
        </div>
        {application.reviewNotes && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <strong>Reviewer Notes:</strong> {application.reviewNotes}
          </div>
        )}
        <p className="text-xs text-slate-600">
          An administrator must approve your store before Seller Center privileges are granted.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-5" noValidate>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Apply to Become a Verified NOVARA Seller</h1>
          <p className="text-xs text-slate-500 mt-1">
            Submit your business &amp; payout details. Approved sellers manage their own inventory, pricing, and suborders.
          </p>
        </div>

        {application?.status === 'additional_info_required' && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <strong>Additional Information Requested:</strong>{' '}
            {application.reviewNotes || 'Please update your KYC or payout details and resubmit.'}
          </div>
        )}

        {formError && (
          <div role="alert" className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-[#EF3E36] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="seller-store-name" className="block text-xs font-semibold text-slate-700 mb-1">Store Name *</label>
            <input
              id="seller-store-name"
              required
              placeholder="e.g. Dhaka Electronics Hub"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label htmlFor="seller-business-type" className="block text-xs font-semibold text-slate-700 mb-1">Business Type *</label>
            <select
              id="seller-business-type"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value as any)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm bg-white"
            >
              <option value="individual">Individual Seller</option>
              <option value="sole_proprietorship">Sole Proprietorship</option>
              <option value="limited_company">Limited Company</option>
            </select>
          </div>
          <div>
            <label htmlFor="seller-nid" className="block text-xs font-semibold text-slate-700 mb-1">NID Number (10-17 digits) *</label>
            <input
              id="seller-nid"
              required
              placeholder="e.g. 1994261122334"
              value={nidNumber}
              onChange={(e) => setNidNumber(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label htmlFor="seller-trade-license" className="block text-xs font-semibold text-slate-700 mb-1">Trade License (Optional)</label>
            <input
              id="seller-trade-license"
              placeholder="e.g. TRAD/DNCC/55120"
              value={tradeLicenseNumber}
              onChange={(e) => setTradeLicenseNumber(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label htmlFor="seller-phone" className="block text-xs font-semibold text-slate-700 mb-1">Business Phone (BD) *</label>
            <input
              id="seller-phone"
              required
              placeholder="017XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label htmlFor="seller-division" className="block text-xs font-semibold text-slate-700 mb-1">Division *</label>
            <select
              id="seller-division"
              value={division}
              onChange={(e) => {
                setDivision(e.target.value);
                const d = BANGLADESH_DIVISIONS.find((x) => x.name === e.target.value);
                if (d) setDistrict(d.districts[0].name);
              }}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm bg-white"
            >
              {BANGLADESH_DIVISIONS.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="seller-district" className="block text-xs font-semibold text-slate-700 mb-1">District *</label>
            <select
              id="seller-district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm bg-white"
            >
              {divObj.districts.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="seller-payout-method" className="block text-xs font-semibold text-slate-700 mb-1">Payout Method *</label>
            <select
              id="seller-payout-method"
              value={bankOrMfsType}
              onChange={(e) => {
                setBankOrMfsType(e.target.value as any);
                setFormError('');
              }}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm bg-white"
            >
              <option value="bkash">bKash Merchant / Personal</option>
              <option value="nagad">Nagad</option>
              <option value="bank">Bangladesh Bank Transfer</option>
            </select>
          </div>
          <div>
            <label htmlFor="seller-account-number" className="block text-xs font-semibold text-slate-700 mb-1">
              {payoutMeta.label}
            </label>
            <input
              id="seller-account-number"
              required
              placeholder={payoutMeta.placeholder}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm"
            />
            <p className="text-[11px] text-slate-500 mt-1">{payoutMeta.hint}</p>
          </div>
          <div>
            <label htmlFor="seller-account-holder" className="block text-xs font-semibold text-slate-700 mb-1">Account Holder Name *</label>
            <input
              id="seller-account-holder"
              required
              placeholder="Full name on bank or MFS account"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="seller-pickup-address" className="block text-xs font-semibold text-slate-700 mb-1">Pickup Warehouse Address *</label>
            <input
              id="seller-pickup-address"
              required
              placeholder="House, Road, Area, Thana"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="seller-description" className="block text-xs font-semibold text-slate-700 mb-1">Store Description &amp; Categories *</label>
            <textarea
              id="seller-description"
              required
              rows={3}
              placeholder="Describe the authentic products and categories you plan to sell on NOVARA (min 10 characters)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] disabled:opacity-60 text-white text-sm font-bold cursor-pointer"
        >
          {loading ? 'Submitting...' : 'Submit Seller Application'}
        </button>
      </form>
    </div>
  );
}
