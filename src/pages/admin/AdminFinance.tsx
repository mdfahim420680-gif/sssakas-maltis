import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { DollarSign, Loader2, Percent, Plus } from 'lucide-react';
import { apiRequest, formatBDT } from '../../lib/api';
import { pushToast } from '../../store/uiSlice';
import {
  ADMIN_INPUT_CLASS,
  ADMIN_SELECT_CLASS,
  ADMIN_TEXTAREA_CLASS,
  AdminDialog,
  FormField,
  FormSection,
} from '../../components/admin/AdminDialog';

interface CommissionRuleItem {
  _id: string;
  name: string;
  ratePercent: number;
  isDefault?: boolean;
  active: boolean;
  categoryId?: { _id: string; name: string };
  storeId?: { _id: string; name: string };
}

interface PayoutItem {
  _id: string;
  payoutNumber: string;
  status: string;
  amount: number;
  method: string;
  accountNumber: string;
  settlementReference?: string;
  storeId?: { name: string };
}

interface LedgerItem {
  _id: string;
  description: string;
  entryType: string;
  bucket: string;
  amount: number;
  storeId?: { name: string };
}

interface OptionItem {
  _id: string;
  name: string;
}

export function AdminFinancePage() {
  const dispatch = useDispatch();
  const [rules, setRules] = useState<CommissionRuleItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [categories, setCategories] = useState<OptionItem[]>([]);
  const [stores, setStores] = useState<OptionItem[]>([]);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [newRule, setNewRule] = useState({
    name: '',
    scope: 'global',
    categoryId: '',
    storeId: '',
    ratePercent: 8,
  });
  const [payoutModal, setPayoutModal] = useState<{ payout: PayoutItem; status: string } | null>(null);
  const [settlementRef, setSettlementRef] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  const load = () => {
    apiRequest<{
      commissionRules: CommissionRuleItem[];
      payouts: PayoutItem[];
      ledgerEntries: LedgerItem[];
      categories: OptionItem[];
      stores: OptionItem[];
    }>('/api/admin/finance')
      .then((res) => {
        setRules(res.commissionRules || []);
        setPayouts(res.payouts || []);
        setLedger(res.ledgerEntries || []);
        setCategories(res.categories || []);
        setStores(res.stores || []);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Load failed';
        dispatch(pushToast({ type: 'error', title: 'Failed to load finance data', message }));
      });
  };
  useEffect(load, []);

  const addCommissionRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRule) return;
    setSavingRule(true);
    setRuleError(null);
    try {
      await apiRequest('/api/admin/finance/commission-rules', {
        method: 'POST',
        body: JSON.stringify({
          name: newRule.name,
          scope: newRule.scope,
          categoryId: newRule.scope === 'category' ? newRule.categoryId : undefined,
          storeId: newRule.scope === 'seller' ? newRule.storeId : undefined,
          ratePercent: Number(newRule.ratePercent),
        }),
      });
      dispatch(pushToast({ type: 'success', title: 'Commission rule created' }));
      setNewRule({ name: '', scope: 'global', categoryId: '', storeId: '', ratePercent: 8 });
      setRuleModalOpen(false);
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setRuleError(message);
      dispatch(pushToast({ type: 'error', title: 'Failed', message }));
    } finally {
      setSavingRule(false);
    }
  };

  const toggleRuleActive = async (rule: CommissionRuleItem) => {
    try {
      await apiRequest(`/api/admin/finance/commission-rules/${rule._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !rule.active }),
      });
      dispatch(pushToast({ type: 'success', title: `Rule ${!rule.active ? 'activated' : 'disabled'}` }));
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Update failed';
      dispatch(pushToast({ type: 'error', title: 'Failed', message }));
    }
  };

  const submitPayoutDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutModal || submittingPayout) return;
    setSubmittingPayout(true);
    setPayoutError(null);
    try {
      await apiRequest(`/api/admin/finance/payouts/${payoutModal.payout._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: payoutModal.status,
          settlementReference: settlementRef,
          reviewNote,
        }),
      });
      dispatch(pushToast({ type: 'success', title: `Payout ${payoutModal.status}` }));
      setPayoutModal(null);
      setSettlementRef('');
      setReviewNote('');
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payout action failed';
      setPayoutError(message);
      dispatch(pushToast({ type: 'error', title: 'Payout action failed', message }));
    } finally {
      setSubmittingPayout(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-4 shadow-2xs">
        <div>
          <h1 className="text-lg font-extrabold text-[#0B1F4B]">Seller Payout Requests</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Completing a payout requires entering a verified Bangladesh bank/bKash/Nagad settlement reference ID.
          </p>
        </div>

        {payouts.length === 0 ? (
          <div className="py-8 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 space-y-1.5">
            <DollarSign className="w-6 h-6 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-500">No seller payout requests queued.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payouts.map((p) => (
              <div
                key={p._id}
                className="p-4 rounded-xl border border-slate-200/90 hover:border-slate-300 transition-colors flex flex-wrap items-center justify-between gap-4 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num font-bold text-[#0B1F4B]">{p.payoutNumber}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                        p.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : p.status === 'rejected'
                            ? 'bg-red-50 text-[#EF3E36]'
                            : 'bg-blue-50 text-[#0D63F3]'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <p className="text-slate-700 mt-1">
                    Store: <strong>{p.storeId?.name}</strong> · Amount:{' '}
                    <strong className="text-[#0D63F3] tabular-nums">{formatBDT(p.amount)}</strong> ·{' '}
                    {p.method.toUpperCase()} ({p.accountNumber})
                  </p>
                  {p.settlementReference && (
                    <p className="text-emerald-700 font-mono-num font-semibold mt-0.5">
                      Settlement Ref: {p.settlementReference}
                    </p>
                  )}
                </div>

                {p.status !== 'completed' && p.status !== 'rejected' && (
                  <div className="flex flex-wrap gap-2">
                    {p.status === 'requested' && (
                      <button
                        type="button"
                        onClick={() => {
                          setPayoutError(null);
                          setPayoutModal({ payout: p, status: 'approved' });
                          setReviewNote('');
                        }}
                        className="px-3 h-8 rounded-lg border border-blue-200 text-[#0D63F3] hover:bg-blue-50 font-bold transition-colors"
                      >
                        Approve
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setPayoutError(null);
                        setPayoutModal({ payout: p, status: 'completed' });
                        setSettlementRef('');
                        setReviewNote('');
                      }}
                      className="px-3 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors"
                    >
                      Mark Settled
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPayoutError(null);
                        setPayoutModal({ payout: p, status: 'rejected' });
                        setReviewNote('');
                      }}
                      className="px-3 h-8 rounded-lg border border-red-200 text-[#EF3E36] hover:bg-red-50 font-bold transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-[#0B1F4B]">Commission Rules ({rules.length})</h2>
              <p className="text-[11px] text-slate-500">Global, category, and seller commission tiers</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRuleError(null);
                setRuleModalOpen(true);
              }}
              className="px-3.5 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Commission Rule</span>
            </button>
          </div>

          <div className="space-y-2 text-xs">
            {rules.map((r) => {
              const scopeLabel = r.storeId ? 'SELLER' : r.categoryId ? 'CATEGORY' : r.isDefault ? 'GLOBAL' : 'CUSTOM';
              return (
                <div
                  key={r._id}
                  className="flex justify-between items-center gap-2 p-3 rounded-xl border border-slate-200/80 bg-slate-50/50"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{r.name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {scopeLabel} {r.categoryId?.name || r.storeId?.name ? `· ${r.categoryId?.name || r.storeId?.name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-extrabold text-[#0D63F3] tabular-nums">{r.ratePercent}%</span>
                    <button
                      type="button"
                      onClick={() => toggleRuleActive(r)}
                      className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] transition-colors ${
                        r.active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {r.active ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-3 shadow-2xs">
          <h2 className="text-base font-extrabold text-[#0B1F4B]">Financial Ledger Audit</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto text-xs pr-1">
            {ledger.length === 0 ? (
              <p className="text-slate-500 py-4">No financial ledger entries recorded yet.</p>
            ) : (
              ledger.map((l) => (
                <div key={l._id} className="flex justify-between gap-3 py-2.5 border-b border-slate-100">
                  <div>
                    <p className="font-bold text-slate-800">{l.description}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {l.storeId?.name} · {l.entryType} ({l.bucket})
                    </p>
                  </div>
                  <span
                    className={`font-bold tabular-nums shrink-0 ${
                      l.amount >= 0 ? 'text-emerald-700' : 'text-[#EF3E36]'
                    }`}
                  >
                    {l.amount >= 0 ? '+' : ''}
                    {formatBDT(l.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <AdminDialog
        open={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        title="Add Commission Rule"
        subtitle="Set marketplace platform fee rate globally, per category, or per seller store."
        badge="Finance"
        size="md"
        isSubmitting={savingRule}
        error={ruleError}
        footer={
          <>
            <button
              type="button"
              disabled={savingRule}
              onClick={() => setRuleModalOpen(false)}
              className="px-4 h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="commission-rule-form"
              disabled={savingRule}
              className="px-5 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-60"
            >
              {savingRule && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Commission Rule</span>
            </button>
          </>
        }
      >
        <form id="commission-rule-form" onSubmit={addCommissionRule} className="space-y-4 text-xs">
          <FormSection
            title="Rule Configuration"
            description="Overrides apply in precedence: Seller > Category > Global default."
            icon={<Percent className="w-3.5 h-3.5" />}
          >
            <FormField label="Rule Name" htmlFor="rule-name" required>
              <input
                id="rule-name"
                required
                placeholder="e.g. Electronics 6% Tier"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                className={ADMIN_INPUT_CLASS}
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <FormField label="Scope" htmlFor="rule-scope" required>
                <select
                  id="rule-scope"
                  value={newRule.scope}
                  onChange={(e) => setNewRule({ ...newRule, scope: e.target.value })}
                  className={ADMIN_SELECT_CLASS}
                >
                  <option value="global">Global Default</option>
                  <option value="category">Category Override</option>
                  <option value="seller">Seller Override</option>
                </select>
              </FormField>
              <FormField label="Commission Rate (%)" htmlFor="rule-rate" required>
                <input
                  id="rule-rate"
                  type="number"
                  min={0}
                  max={50}
                  step="0.5"
                  value={newRule.ratePercent}
                  onChange={(e) => setNewRule({ ...newRule, ratePercent: Number(e.target.value) })}
                  className={`${ADMIN_INPUT_CLASS} font-mono-num`}
                />
              </FormField>
            </div>

            {newRule.scope === 'category' && (
              <FormField label="Target Category" htmlFor="rule-cat" required>
                <select
                  id="rule-cat"
                  required
                  value={newRule.categoryId}
                  onChange={(e) => setNewRule({ ...newRule, categoryId: e.target.value })}
                  className={ADMIN_SELECT_CLASS}
                >
                  <option value="">Select Category...</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            {newRule.scope === 'seller' && (
              <FormField label="Target Seller Store" htmlFor="rule-store" required>
                <select
                  id="rule-store"
                  required
                  value={newRule.storeId}
                  onChange={(e) => setNewRule({ ...newRule, storeId: e.target.value })}
                  className={ADMIN_SELECT_CLASS}
                >
                  <option value="">Select Store...</option>
                  {stores.map((st) => (
                    <option key={st._id} value={st._id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
          </FormSection>
        </form>
      </AdminDialog>

      <AdminDialog
        open={Boolean(payoutModal)}
        onClose={() => setPayoutModal(null)}
        title={
          payoutModal
            ? `Payout ${payoutModal.payout.payoutNumber}: ${payoutModal.status.toUpperCase()}`
            : 'Payout Settlement'
        }
        subtitle={
          payoutModal
            ? `Store: ${payoutModal.payout.storeId?.name || 'Seller'} · ${payoutModal.payout.method.toUpperCase()}`
            : undefined
        }
        badge="Payout Settlement"
        size="md"
        isSubmitting={submittingPayout}
        error={payoutError}
        footer={
          <>
            <button
              type="button"
              disabled={submittingPayout}
              onClick={() => setPayoutModal(null)}
              className="px-4 h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="payout-decision-form"
              disabled={submittingPayout}
              className={`px-5 h-9 rounded-xl text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-60 ${
                payoutModal?.status === 'rejected'
                  ? 'bg-[#EF3E36] hover:bg-red-700'
                  : 'bg-[#0D63F3] hover:bg-[#0A52CC]'
              }`}
            >
              {submittingPayout && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirm Payout Action</span>
            </button>
          </>
        }
      >
        {payoutModal && (
          <form id="payout-decision-form" onSubmit={submitPayoutDecision} className="space-y-4 text-xs">
            <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-semibold text-slate-500">Destination Account</p>
                <p className="font-bold text-[#0B1F4B] mt-0.5">
                  {payoutModal.payout.method.toUpperCase()} ·{' '}
                  <span className="font-mono-num">{payoutModal.payout.accountNumber}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold text-slate-500">Settlement Amount</p>
                <p className="font-extrabold text-[#0D63F3] text-sm tabular-nums mt-0.5">
                  {formatBDT(payoutModal.payout.amount)}
                </p>
              </div>
            </div>

            <FormSection title="Settlement Verification" icon={<DollarSign className="w-3.5 h-3.5" />}>
              {payoutModal.status === 'completed' && (
                <FormField
                  label="Verified Bank / bKash / Nagad Settlement Reference ID"
                  htmlFor="payout-ref"
                  required
                >
                  <input
                    id="payout-ref"
                    required
                    placeholder="e.g. BKASH-TXN-894210"
                    value={settlementRef}
                    onChange={(e) => setSettlementRef(e.target.value)}
                    className={`${ADMIN_INPUT_CLASS} font-mono-num`}
                  />
                </FormField>
              )}

              <FormField label="Admin Review Note" htmlFor="payout-note" optional>
                <textarea
                  id="payout-note"
                  rows={2}
                  placeholder="Optional internal audit note or rejection reason..."
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  className={ADMIN_TEXTAREA_CLASS}
                />
              </FormField>
            </FormSection>
          </form>
        )}
      </AdminDialog>
    </div>
  );
}
