import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Eye, Loader2, Search, ShieldCheck, Store } from 'lucide-react';
import { apiRequest, formatBDT } from '../../lib/api';
import { pushToast } from '../../store/uiSlice';
import { RootState } from '../../store';
import {
  ADMIN_INPUT_COMPACT_CLASS,
  ADMIN_SELECT_COMPACT_CLASS,
  ADMIN_TEXTAREA_CLASS,
  AdminDialog,
  FormField,
  FormSection,
} from '../../components/admin/AdminDialog';

const ROLES = [
  'customer',
  'seller',
  'admin',
  'super_admin',
  'catalog_manager',
  'order_manager',
  'finance_manager',
  'support_agent',
  'content_manager',
];

export function AdminUsersPage() {
  const currentUser = useSelector((s: RootState) => s.auth.user);
  const dispatch = useDispatch();
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = (query = q) => {
    setLoading(true);
    apiRequest(`/api/admin/users?q=${encodeURIComponent(query)}`)
      .then((res) => setUsers(res.users || []))
      .catch((err: any) => dispatch(pushToast({ type: 'error', title: 'Error', message: err.message })))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load('');
  }, []);

  const updateStatus = async (userId: string, status: string) => {
    try {
      await apiRequest(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      dispatch(pushToast({ type: 'success', title: 'User status updated' }));
      load();
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Update failed', message: err.message }));
    }
  };

  const updateRole = async (userId: string, role: string) => {
    try {
      await apiRequest(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      dispatch(pushToast({ type: 'success', title: 'User role updated' }));
      load();
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Role update failed', message: err.message }));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-5 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-[#0B1F4B]">User Management &amp; Scoped RBAC</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage account status and assign staff permissions (Super Admin required for role changes)
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(q);
          }}
          className="flex gap-2"
        >
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, phone..."
              className={`${ADMIN_INPUT_COMPACT_CLASS} pl-8 w-56`}
            />
          </div>
          <button
            type="submit"
            className="px-4 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold shadow-xs transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500 py-4">Loading users...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pr-3">Name &amp; Contact</th>
                <th className="py-2.5 pr-3">Role</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 pr-3">
                    <p className="font-bold text-slate-900">{u.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {u.email} {u.phone ? `· ${u.phone}` : ''}
                    </p>
                  </td>
                  <td className="py-3 pr-3">
                    {currentUser?.role === 'super_admin' && u._id !== currentUser?._id ? (
                      <select
                        aria-label={`Role for ${u.email}`}
                        value={u.role}
                        onChange={(e) => updateRole(u._id, e.target.value)}
                        className={`${ADMIN_SELECT_COMPACT_CLASS} w-44`}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-bold text-slate-700 text-[11px]">
                        {u.role}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                        u.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                          : 'bg-red-50 text-[#EF3E36] border border-red-200/70'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      {u.status !== 'active' && (
                        <button
                          type="button"
                          onClick={() => updateStatus(u._id, 'active')}
                          className="px-2.5 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors"
                        >
                          Activate
                        </button>
                      )}
                      {u.status === 'active' && u._id !== currentUser?._id && (
                        <button
                          type="button"
                          onClick={() => updateStatus(u._id, 'suspended')}
                          className="px-2.5 h-7 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 font-bold text-[11px] transition-colors"
                        >
                          Suspend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AdminSellersPage() {
  const dispatch = useDispatch();
  const [applications, setApplications] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [decisionModal, setDecisionModal] = useState<{ app: any; status: string } | null>(null);
  const [note, setNote] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [sellerDetail, setSellerDetail] = useState<any>(null);

  const load = () => {
    apiRequest('/api/admin/sellers')
      .then((res) => {
        setApplications(res.applications || []);
        setStores(res.stores || []);
      })
      .catch((err: any) => dispatch(pushToast({ type: 'error', title: 'Failed to load sellers', message: err.message })));
  };
  useEffect(load, []);

  const openSellerDetail = async (storeId: string) => {
    try {
      const res = await apiRequest(`/api/admin/sellers/${storeId}`);
      setSellerDetail(res);
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Unable to load store details', message: err.message }));
    }
  };

  const submitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionModal || submittingDecision) return;
    setSubmittingDecision(true);
    setDecisionError(null);
    try {
      await apiRequest(`/api/admin/sellers/applications/${decisionModal.app._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: decisionModal.status, note }),
      });
      dispatch(pushToast({ type: 'success', title: `Application marked ${decisionModal.status}` }));
      setDecisionModal(null);
      setNote('');
      load();
    } catch (err: any) {
      setDecisionError(err.message || 'Action failed');
      dispatch(pushToast({ type: 'error', title: 'Action failed', message: err.message }));
    } finally {
      setSubmittingDecision(false);
    }
  };

  const toggleStore = async (store: any) => {
    const nextStatus = store.status === 'active' ? 'suspended' : 'active';
    try {
      await apiRequest(`/api/admin/sellers/stores/${store._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, isFeatured: store.isFeatured }),
      });
      dispatch(pushToast({ type: 'success', title: `Store ${nextStatus}` }));
      load();
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Failed', message: err.message }));
    }
  };

  const toggleFeatured = async (store: any) => {
    try {
      await apiRequest(`/api/admin/sellers/stores/${store._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: store.status, isFeatured: !store.isFeatured }),
      });
      dispatch(pushToast({ type: 'success', title: 'Store featured flag updated' }));
      load();
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Failed', message: err.message }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-4 shadow-2xs">
        <div>
          <h1 className="text-lg font-extrabold text-[#0B1F4B]">Seller Onboarding &amp; KYC Applications</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Verify seller identity, payout accounts, and store activation requests
          </p>
        </div>

        {applications.length === 0 ? (
          <div className="py-8 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 space-y-1.5">
            <Store className="w-6 h-6 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-500">No seller applications submitted yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((a) => (
              <div
                key={a._id}
                className="p-4 rounded-xl border border-slate-200/90 hover:border-slate-300 transition-colors flex flex-wrap items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#0B1F4B]">{a.storeName}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                        a.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700'
                          : a.status === 'rejected'
                            ? 'bg-red-50 text-[#EF3E36]'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {a.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-slate-600">
                    Applicant: <strong className="text-slate-800">{a.userId?.name || 'User'}</strong> ({a.userId?.email}) · Phone: {a.phone}
                  </p>
                  <p className="text-slate-500">
                    Location: {a.district}, {a.division} · Payout: {a.bankOrMfsType?.toUpperCase()} ({a.accountNumber})
                  </p>
                  {a.reviewNotes && <p className="text-amber-700 font-medium">Review Note: {a.reviewNotes}</p>}
                </div>

                <div className="flex flex-wrap gap-2">
                  {a.status !== 'approved' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setDecisionError(null);
                          setDecisionModal({ app: a, status: 'approved' });
                          setNote('Verified store KYC details. Welcome to NOVARA Seller Center.');
                        }}
                        className="px-3.5 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors"
                      >
                        Approve &amp; Create Store
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDecisionError(null);
                          setDecisionModal({ app: a, status: 'additional_info_required' });
                          setNote('');
                        }}
                        className="px-3 h-8 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50 font-bold transition-colors"
                      >
                        Request Info
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDecisionError(null);
                          setDecisionModal({ app: a, status: 'rejected' });
                          setNote('');
                        }}
                        className="px-3 h-8 rounded-lg border border-red-200 text-[#EF3E36] hover:bg-red-50 font-bold transition-colors"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-4 shadow-2xs">
        <h2 className="text-base font-extrabold text-[#0B1F4B]">
          Active &amp; Verified Marketplace Stores ({stores.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pr-3">Store</th>
                <th className="py-2.5 pr-3">Owner</th>
                <th className="py-2.5 pr-3">Location</th>
                <th className="py-2.5 pr-3">Products</th>
                <th className="py-2.5 pr-3">Orders</th>
                <th className="py-2.5 pr-3">Revenue</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 pr-3">Featured</th>
                <th className="py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stores.map((st) => (
                <tr key={st._id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 pr-3 font-bold text-slate-900">
                    <span className="inline-flex items-center gap-1.5">
                      {st.verified && <ShieldCheck className="w-3.5 h-3.5 text-[#0D63F3] shrink-0" />}
                      {st.name}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-slate-600">{st.ownerUserId?.email}</td>
                  <td className="py-3 pr-3 text-slate-600">{st.district}, {st.division}</td>
                  <td className="py-3 pr-3 font-bold tabular-nums">{st.realProductCount ?? st.productCount ?? 0}</td>
                  <td className="py-3 pr-3 font-bold tabular-nums">{st.ordersCount ?? 0}</td>
                  <td className="py-3 pr-3 font-bold text-[#0D63F3] tabular-nums">{formatBDT(st.totalRevenue ?? 0)}</td>
                  <td className="py-3 pr-3">
                    <span
                      className={`px-2 py-0.5 rounded-full uppercase font-bold text-[10px] ${
                        st.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-[#EF3E36]'
                      }`}
                    >
                      {st.status}
                    </span>
                  </td>
                  <td className="py-3 pr-3">
                    <button
                      type="button"
                      onClick={() => toggleFeatured(st)}
                      className={`px-2 py-0.5 rounded font-bold text-[11px] transition-colors ${
                        st.isFeatured ? 'bg-blue-50 text-[#0D63F3]' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {st.isFeatured ? 'Featured' : 'Standard'}
                    </button>
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openSellerDetail(st._id)}
                        className="px-2.5 h-7 rounded-lg border border-slate-200 text-slate-700 font-bold text-[11px] inline-flex items-center gap-1 hover:border-[#0D63F3] hover:text-[#0D63F3] transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        Details
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStore(st)}
                        className={`px-3 h-7 rounded-lg font-bold text-[11px] transition-colors ${
                          st.status === 'active'
                            ? 'border border-red-200 text-[#EF3E36] hover:bg-red-50'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {st.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AdminDialog
        open={Boolean(decisionModal)}
        onClose={() => setDecisionModal(null)}
        title={
          decisionModal
            ? `Confirm Decision: ${decisionModal.status.replace(/_/g, ' ').toUpperCase()}`
            : 'Seller KYC Decision'
        }
        subtitle={decisionModal ? `Application for ${decisionModal.app.storeName}` : undefined}
        badge="Seller KYC"
        size="md"
        isSubmitting={submittingDecision}
        error={decisionError}
        footer={
          <>
            <button
              type="button"
              disabled={submittingDecision}
              onClick={() => setDecisionModal(null)}
              className="px-4 h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="seller-decision-form"
              disabled={submittingDecision}
              className={`px-5 h-9 rounded-xl text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-60 ${
                decisionModal?.status === 'rejected'
                  ? 'bg-[#EF3E36] hover:bg-red-700'
                  : 'bg-[#0D63F3] hover:bg-[#0A52CC]'
              }`}
            >
              {submittingDecision && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirm Decision</span>
            </button>
          </>
        }
      >
        {decisionModal && (
          <form id="seller-decision-form" onSubmit={submitDecision} className="space-y-4 text-xs">
            <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 space-y-1">
              <p className="font-bold text-[#0B1F4B]">{decisionModal.app.storeName}</p>
              <p className="text-slate-500">
                {decisionModal.app.userId?.name || 'Applicant'} · {decisionModal.app.district}, {decisionModal.app.division}
              </p>
            </div>

            <FormSection title="Applicant Notification Note">
              <FormField label="Review Notes (sent to applicant)" htmlFor="kyc-review-note" required>
                <textarea
                  id="kyc-review-note"
                  required
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Provide clear KYC verification feedback or onboarding welcome message..."
                  className={ADMIN_TEXTAREA_CLASS}
                />
              </FormField>
            </FormSection>
          </form>
        )}
      </AdminDialog>

      <AdminDialog
        open={Boolean(sellerDetail)}
        onClose={() => setSellerDetail(null)}
        title={`Seller Store: ${sellerDetail?.store?.name || ''}`}
        subtitle={
          sellerDetail?.store?.ownerUserId?.email
            ? `Owner: ${sellerDetail.store.ownerUserId.name} (${sellerDetail.store.ownerUserId.email})`
            : undefined
        }
        badge="Seller Store"
        size="lg"
        footer={
          <button
            type="button"
            onClick={() => setSellerDetail(null)}
            className="px-4 h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        }
      >
        {sellerDetail && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 space-y-1">
                <p className="text-[11px] font-semibold text-slate-500">Pickup &amp; Location</p>
                <p className="font-bold text-[#0B1F4B]">
                  {sellerDetail.store.pickupAddress || `${sellerDetail.store.district}, ${sellerDetail.store.division}`}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 space-y-1">
                <p className="text-[11px] font-semibold text-slate-500">Payout Account</p>
                <p className="font-bold text-[#0B1F4B]">
                  {sellerDetail.store.payoutAccount?.method?.toUpperCase() || 'Not set'} ·{' '}
                  <span className="font-mono-num">{sellerDetail.store.payoutAccount?.accountNumber || '—'}</span>
                </p>
              </div>
            </div>

            <FormSection title={`Recent Products (${sellerDetail.products?.length || 0})`}>
              <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 pr-1">
                {(sellerDetail.products || []).length === 0 ? (
                  <p className="text-slate-500 py-2">No products listed by this store yet.</p>
                ) : (
                  (sellerDetail.products || []).map((p: any) => (
                    <div key={p._id} className="flex justify-between items-center gap-2 py-2">
                      <span className="font-semibold text-slate-800 truncate">{p.title}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold uppercase text-slate-600 shrink-0">
                        {p.moderationStatus}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </FormSection>

            <FormSection title={`Recent Suborders (${sellerDetail.subOrders?.length || 0})`}>
              <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 pr-1">
                {(sellerDetail.subOrders || []).length === 0 ? (
                  <p className="text-slate-500 py-2">No suborders fulfilled yet.</p>
                ) : (
                  (sellerDetail.subOrders || []).map((so: any) => (
                    <div key={so._id} className="flex justify-between items-center py-2">
                      <span className="font-mono-num font-bold text-[#0B1F4B]">{so.subOrderNumber}</span>
                      <span className="font-bold text-[#0D63F3] tabular-nums">{formatBDT(so.subtotal)}</span>
                    </div>
                  ))
                )}
              </div>
            </FormSection>
          </div>
        )}
      </AdminDialog>
    </div>
  );
}
