import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Loader2, Plus, Search, Settings } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { pushToast } from '../../store/uiSlice';
import {
  ADMIN_INPUT_CLASS,
  ADMIN_INPUT_COMPACT_CLASS,
  ADMIN_SELECT_CLASS,
  AdminDialog,
  FormField,
  FormSection,
} from '../../components/admin/AdminDialog';

interface SearchMappingRow {
  _id: string;
  term: string;
  synonyms: string[];
  languageHint?: string;
}

interface SearchAggRow {
  _id: string;
  count: number;
  avgResults?: number;
}

export function AdminSearchPage() {
  const dispatch = useDispatch();
  const [mappings, setMappings] = useState<SearchMappingRow[]>([]);
  const [zeroResults, setZeroResults] = useState<SearchAggRow[]>([]);
  const [topQueries, setTopQueries] = useState<SearchAggRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ term: '', synonyms: '', languageHint: 'mixed' });

  const load = () => {
    apiRequest<{
      mappings: SearchMappingRow[];
      zeroResults: SearchAggRow[];
      topQueries: SearchAggRow[];
    }>('/api/admin/search-management')
      .then((res) => {
        setMappings(res.mappings || []);
        setZeroResults(res.zeroResults || []);
        setTopQueries(res.topQueries || []);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unable to fetch search data';
        dispatch(pushToast({ type: 'error', title: 'Failed to load search management', message }));
      });
  };
  useEffect(load, []);

  const addMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiRequest('/api/admin/search-management/mappings', {
        method: 'POST',
        body: JSON.stringify({
          term: form.term.trim(),
          synonyms: form.synonyms.split(',').map((s) => s.trim()).filter(Boolean),
          languageHint: form.languageHint,
          active: true,
        }),
      });
      dispatch(pushToast({ type: 'success', title: 'Search synonym mapping saved' }));
      setForm({ term: '', synonyms: '', languageHint: 'mixed' });
      setModalOpen(false);
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setFormError(message);
      dispatch(pushToast({ type: 'error', title: 'Failed', message }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div>
          <h1 className="text-lg font-extrabold text-[#0B1F4B]">Bengali &amp; English Search Synonyms</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Improve zero-result queries by mapping bilingual keywords and local spelling variants
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setModalOpen(true);
          }}
          className="px-4 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Synonym Mapping</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-2 shadow-2xs">
          <h2 className="text-sm font-extrabold text-[#0B1F4B]">Configured Mappings ({mappings.length})</h2>
          {mappings.map((m) => (
            <div key={m._id} className="py-2 border-b border-slate-100 text-xs">
              <p className="font-bold text-slate-900">{m.term}</p>
              <p className="text-slate-500">{(m.synonyms || []).join(', ')}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-2 shadow-2xs">
          <h2 className="text-sm font-extrabold text-[#0B1F4B]">Zero-Result Queries</h2>
          {zeroResults.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">No zero-result queries logged yet.</p>
          ) : (
            zeroResults.map((z) => (
              <div key={z._id} className="flex justify-between py-2 border-b border-slate-100 text-xs">
                <span className="font-semibold text-[#EF3E36]">{z._id}</span>
                <span className="font-bold tabular-nums">{z.count}x</span>
              </div>
            ))
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-2 shadow-2xs">
          <h2 className="text-sm font-extrabold text-[#0B1F4B]">Top Marketplace Searches</h2>
          {topQueries.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">No search logs yet.</p>
          ) : (
            topQueries.map((t) => (
              <div key={t._id} className="flex justify-between py-2 border-b border-slate-100 text-xs">
                <span className="font-semibold text-slate-800">{t._id}</span>
                <span className="text-slate-500 tabular-nums">
                  {t.count}x ({Math.round(t.avgResults || 0)} hits)
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <AdminDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Search Synonym Mapping"
        subtitle="Connect English, Bengali, and Banglish search terms so shoppers always find products."
        badge="Search"
        size="md"
        isSubmitting={saving}
        error={formError}
        footer={
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => setModalOpen(false)}
              className="px-4 h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="search-mapping-form"
              disabled={saving}
              className="px-5 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-60"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Synonym Mapping</span>
            </button>
          </>
        }
      >
        <form id="search-mapping-form" onSubmit={addMapping} className="space-y-4 text-xs">
          <FormSection
            title="Keyword & Equivalents"
            description="Customers searching any comma-separated synonym will match the primary term."
            icon={<Search className="w-3.5 h-3.5" />}
          >
            <FormField label="Primary Term" htmlFor="syn-term" required>
              <input
                id="syn-term"
                required
                placeholder="e.g. মোবাইল or airpods"
                value={form.term}
                onChange={(e) => setForm({ ...form, term: e.target.value })}
                className={ADMIN_INPUT_CLASS}
              />
            </FormField>
            <FormField
              label="Comma-Separated Synonyms"
              htmlFor="syn-list"
              required
              hint="Separate multiple English or Bengali variants with commas"
            >
              <input
                id="syn-list"
                required
                placeholder="e.g. smartphone, ফোন, mobile phone"
                value={form.synonyms}
                onChange={(e) => setForm({ ...form, synonyms: e.target.value })}
                className={ADMIN_INPUT_CLASS}
              />
            </FormField>
            <FormField label="Language Scope" htmlFor="syn-lang">
              <select
                id="syn-lang"
                value={form.languageHint}
                onChange={(e) => setForm({ ...form, languageHint: e.target.value })}
                className={ADMIN_SELECT_CLASS}
              >
                <option value="mixed">Mixed (Bangla + English)</option>
                <option value="bn">Bengali</option>
                <option value="en">English</option>
              </select>
            </FormField>
          </FormSection>
        </form>
      </AdminDialog>
    </div>
  );
}

export function AdminReviewsPage() {
  const dispatch = useDispatch();
  const [reviews, setReviews] = useState<any[]>([]);

  const load = () => {
    apiRequest('/api/admin/reviews')
      .then((res) => setReviews(res.reviews || []))
      .catch((err: any) => dispatch(pushToast({ type: 'error', title: 'Failed to load reviews', message: err.message })));
  };
  useEffect(load, []);

  const moderate = async (id: string, moderationStatus: string) => {
    try {
      await apiRequest(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ moderationStatus }),
      });
      dispatch(pushToast({ type: 'success', title: `Review ${moderationStatus}` }));
      load();
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Moderation failed', message: err.message }));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-4 shadow-2xs">
      <div>
        <h1 className="text-lg font-extrabold text-[#0B1F4B]">Customer Reviews Moderation</h1>
        <p className="text-xs text-slate-500 mt-0.5">Publish verified buyer reviews or flag inappropriate feedback</p>
      </div>
      <div className="space-y-3">
        {reviews.map((r) => (
          <div
            key={r._id}
            className="p-4 rounded-xl border border-slate-200/90 hover:border-slate-300 transition-colors flex flex-wrap items-center justify-between gap-4 text-xs"
          >
            <div>
              <p className="font-bold text-[#0B1F4B]">
                {r.productId?.title || 'Product'} · <span className="text-amber-600">{r.rating}/5 ★</span>
              </p>
              <p className="text-slate-600 mt-1">{r.comment}</p>
              <span
                className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                  r.moderationStatus === 'published'
                    ? 'bg-emerald-50 text-emerald-700'
                    : r.moderationStatus === 'flagged'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {r.moderationStatus}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => moderate(r._id, 'published')}
                className="px-3 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors"
              >
                Publish
              </button>
              <button
                type="button"
                onClick={() => moderate(r._id, 'flagged')}
                className="px-3 h-8 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50 font-bold transition-colors"
              >
                Flag
              </button>
              <button
                type="button"
                onClick={() => moderate(r._id, 'hidden')}
                className="px-3 h-8 rounded-lg border border-red-200 text-[#EF3E36] hover:bg-red-50 font-bold transition-colors"
              >
                Hide
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminSupportPage() {
  const dispatch = useDispatch();
  const [tickets, setTickets] = useState<any[]>([]);
  const [reply, setReply] = useState<Record<string, string>>({});

  const load = () => {
    apiRequest('/api/admin/support')
      .then((res) => setTickets(res.tickets || []))
      .catch((err: any) => dispatch(pushToast({ type: 'error', title: 'Failed to load support tickets', message: err.message })));
  };
  useEffect(load, []);

  const sendReply = async (id: string, status: string) => {
    try {
      await apiRequest(`/api/admin/support/${id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ body: reply[id] || '', status }),
      });
      dispatch(pushToast({ type: 'success', title: 'Ticket updated' }));
      setReply((prev) => ({ ...prev, [id]: '' }));
      load();
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.message }));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-4 shadow-2xs">
      <div>
        <h1 className="text-lg font-extrabold text-[#0B1F4B]">Support Tickets &amp; Escalations</h1>
        <p className="text-xs text-slate-500 mt-0.5">Respond to customer and seller inquiries and resolve tickets</p>
      </div>
      {tickets.length === 0 ? (
        <p className="text-xs text-slate-500 py-4">No support tickets submitted yet.</p>
      ) : (
        <div className="space-y-4">
          {tickets.map((t) => (
            <div key={t._id} className="p-4 rounded-xl border border-slate-200/90 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono-num font-bold text-[#0D63F3] mr-2">{t.ticketNumber}</span>
                  <span className="font-bold text-[#0B1F4B]">{t.subject}</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 font-bold uppercase text-[10px] text-slate-700">
                  {t.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-slate-500">
                From: {t.creatorUserId?.name} ({t.creatorUserId?.email}) · Category: {t.category}
              </p>
              <div className="space-y-1.5 bg-slate-50/90 border border-slate-100 p-3 rounded-xl">
                {(t.messages || []).map((m: any, idx: number) => (
                  <p key={idx} className="text-slate-700">
                    <strong>
                      {m.senderName} ({m.senderRole}):
                    </strong>{' '}
                    {m.body}
                  </p>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  placeholder="Write official support reply..."
                  value={reply[t._id] || ''}
                  onChange={(e) => setReply({ ...reply, [t._id]: e.target.value })}
                  className={`${ADMIN_INPUT_COMPACT_CLASS} flex-1 min-w-[200px]`}
                />
                <button
                  type="button"
                  onClick={() => sendReply(t._id, 'in_progress')}
                  className="px-3.5 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white font-bold transition-colors"
                >
                  Reply
                </button>
                <button
                  type="button"
                  onClick={() => sendReply(t._id, 'resolved')}
                  className="px-3.5 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors"
                >
                  Mark Resolved
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminAuditPage() {
  const dispatch = useDispatch();
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => {
    apiRequest('/api/admin/audit-logs')
      .then((res) => setLogs(res.logs || []))
      .catch((err: any) => dispatch(pushToast({ type: 'error', title: 'Failed to load audit logs', message: err.message })));
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-4 shadow-2xs">
      <div>
        <h1 className="text-lg font-extrabold text-[#0B1F4B]">Immutable Administrative Audit Trail</h1>
        <p className="text-xs text-slate-500 mt-0.5">Chronological record of admin actions across the platform</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-2.5 pr-3">Timestamp</th>
              <th className="py-2.5 pr-3">Actor</th>
              <th className="py-2.5 pr-3">Role</th>
              <th className="py-2.5 pr-3">Action</th>
              <th className="py-2.5">Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((l) => (
              <tr key={l._id} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-2.5 pr-3 text-slate-500 whitespace-nowrap">
                  {new Date(l.createdAt).toLocaleString()}
                </td>
                <td className="py-2.5 pr-3 font-semibold text-slate-800">{l.actorEmail}</td>
                <td className="py-2.5 pr-3 uppercase text-[10px] font-bold text-slate-600">{l.actorRole}</td>
                <td className="py-2.5 pr-3 font-bold text-[#0D63F3]">{l.action}</td>
                <td className="py-2.5 text-slate-600">
                  {l.targetType} {l.targetId ? `(${l.targetId.slice(-6)})` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminSettingsPage() {
  const dispatch = useDispatch();
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest('/api/admin/settings')
      .then((res) => setSettings(res.settings))
      .catch((err: any) => dispatch(pushToast({ type: 'error', title: 'Failed to load settings', message: err.message })));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await apiRequest('/api/admin/settings', { method: 'PUT', body: JSON.stringify(settings) });
      dispatch(pushToast({ type: 'success', title: 'Platform settings updated' }));
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Save failed', message: err.message }));
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-slate-200/90 text-xs text-slate-500">
        Loading settings...
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200/90 px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div>
          <h1 className="text-lg font-extrabold text-[#0B1F4B]">Global Platform Configuration</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Marketplace thresholds, commission defaults, support channels, and announcement bar copy
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-5 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>{saving ? 'Saving...' : 'Save Platform Settings'}</span>
        </button>
      </div>

      <FormSection
        title="Commerce & Marketplace Rules"
        description="Core delivery, commission, payout, and return policy defaults."
        icon={<Settings className="w-3.5 h-3.5" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Free Delivery Threshold (৳)" htmlFor="set-free-del">
            <input
              id="set-free-del"
              type="number"
              value={settings.freeDeliveryThreshold}
              onChange={(e) => setSettings({ ...settings, freeDeliveryThreshold: Number(e.target.value) })}
              className={`${ADMIN_INPUT_CLASS} tabular-nums`}
            />
          </FormField>
          <FormField label="Default Commission (%)" htmlFor="set-comm">
            <input
              id="set-comm"
              type="number"
              value={settings.defaultCommissionPercent}
              onChange={(e) => setSettings({ ...settings, defaultCommissionPercent: Number(e.target.value) })}
              className={`${ADMIN_INPUT_CLASS} tabular-nums`}
            />
          </FormField>
          <FormField label="Minimum Seller Payout (৳)" htmlFor="set-min-payout">
            <input
              id="set-min-payout"
              type="number"
              value={settings.minPayoutAmount}
              onChange={(e) => setSettings({ ...settings, minPayoutAmount: Number(e.target.value) })}
              className={`${ADMIN_INPUT_CLASS} tabular-nums`}
            />
          </FormField>
          <FormField label="Return Window (Days)" htmlFor="set-ret-days">
            <input
              id="set-ret-days"
              type="number"
              value={settings.returnWindowDays}
              onChange={(e) => setSettings({ ...settings, returnWindowDays: Number(e.target.value) })}
              className={`${ADMIN_INPUT_CLASS} tabular-nums`}
            />
          </FormField>
          <FormField label="Support Email" htmlFor="set-email">
            <input
              id="set-email"
              value={settings.supportEmail}
              onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
              className={ADMIN_INPUT_CLASS}
            />
          </FormField>
          <FormField label="Support Phone" htmlFor="set-phone">
            <input
              id="set-phone"
              value={settings.supportPhone}
              onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
              className={ADMIN_INPUT_CLASS}
            />
          </FormField>
          <FormField label="Announcement Bar Copy" htmlFor="set-announce" className="sm:col-span-2">
            <input
              id="set-announce"
              value={settings.announcementText}
              onChange={(e) => setSettings({ ...settings, announcementText: e.target.value })}
              className={ADMIN_INPUT_CLASS}
            />
          </FormField>
        </div>
      </FormSection>
    </form>
  );
}
