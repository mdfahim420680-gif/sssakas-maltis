import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Edit3, Eye, Loader2, PackageCheck, Plus, RotateCcw, Search, Trash2, Truck } from 'lucide-react';
import { apiRequest, formatBDT } from '../../lib/api';
import { pushToast } from '../../store/uiSlice';
import { ALLOWED_SUBORDER_TRANSITIONS, OrderStatus } from '../../../shared/pricing';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import {
  ADMIN_INPUT_CLASS,
  ADMIN_INPUT_COMPACT_CLASS,
  ADMIN_SELECT_CLASS,
  ADMIN_SELECT_COMPACT_CLASS,
  ADMIN_TEXTAREA_CLASS,
  AdminDialog,
  ConfirmDialog,
  FormField,
  FormSection,
} from '../../components/admin/AdminDialog';
import { ProductEditorModal } from '../../components/admin/ProductEditorModal';

interface CatalogProductRow {
  _id: string;
  title: string;
  slug: string;
  images?: string[];
  moderationStatus: string;
  isTrending?: boolean;
  isFlashSaleCandidate?: boolean;
  categoryId?: { _id: string; name: string } | string;
  brandId?: { _id: string; name: string } | string;
  createdByStoreId?: { _id: string; name: string } | string;
}

interface CatalogOfferRow {
  _id: string;
  productId?: { _id: string } | string;
  price?: number;
  stock?: number;
}

interface CatalogCategoryOption {
  _id: string;
  name: string;
}

export function AdminCatalogPage() {
  const dispatch = useDispatch();
  const [products, setProducts] = useState<CatalogProductRow[]>([]);
  const [offers, setOffers] = useState<CatalogOfferRow[]>([]);
  const [categories, setCategories] = useState<CatalogCategoryOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteProd, setDeleteProd] = useState<CatalogProductRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editorModal, setEditorModal] = useState<{ open: boolean; productId: string | null }>({
    open: false,
    productId: null,
  });

  const load = () => {
    apiRequest<{
      products: CatalogProductRow[];
      offers: CatalogOfferRow[];
      categories: CatalogCategoryOption[];
    }>('/api/admin/catalog/products')
      .then((res) => {
        setProducts(res.products || []);
        setOffers(res.offers || []);
        setCategories(res.categories || []);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unable to fetch catalog';
        dispatch(pushToast({ type: 'error', title: 'Failed to load catalog', message }));
      });
  };
  useEffect(load, []);

  const updateModeration = async (id: string, patch: Record<string, unknown>) => {
    try {
      await apiRequest(`/api/admin/catalog/products/${id}/moderation`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      dispatch(pushToast({ type: 'success', title: 'Product updated' }));
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Update failed';
      dispatch(pushToast({ type: 'error', title: 'Error', message }));
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteProd || deleting) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/admin/catalog/products/${deleteProd._id}`, { method: 'DELETE' });
      dispatch(pushToast({ type: 'info', title: 'Product deleted' }));
      setDeleteProd(null);
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      dispatch(pushToast({ type: 'error', title: 'Delete blocked', message }));
    } finally {
      setDeleting(false);
    }
  };

  const offerByProdId = new Map<string, { price: number; stock: number; count: number }>();
  for (const off of offers) {
    const pid =
      off.productId && typeof off.productId === 'object'
        ? String(off.productId._id)
        : String(off.productId || '');
    if (!pid) continue;
    const existing = offerByProdId.get(pid);
    if (!existing) {
      offerByProdId.set(pid, { price: off.price || 0, stock: off.stock || 0, count: 1 });
    } else {
      offerByProdId.set(pid, {
        price: Math.min(existing.price, off.price || existing.price),
        stock: existing.stock + (off.stock || 0),
        count: existing.count + 1,
      });
    }
  }

  const filteredProducts = products.filter((p) => {
    const catId = p.categoryId && typeof p.categoryId === 'object' ? p.categoryId._id : p.categoryId;
    if (categoryFilter && String(catId) !== categoryFilter) return false;
    if (statusFilter && p.moderationStatus !== statusFilter) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    const catName = p.categoryId && typeof p.categoryId === 'object' ? p.categoryId.name : '';
    const brandName = p.brandId && typeof p.brandId === 'object' ? p.brandId.name : '';
    return (
      p.title?.toLowerCase().includes(q) ||
      p.slug?.toLowerCase().includes(q) ||
      catName.toLowerCase().includes(q) ||
      brandName.toLowerCase().includes(q)
    );
  });

  const hasFilters = Boolean(searchTerm.trim() || categoryFilter || statusFilter);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold text-[#0B1F4B]">
              Products &amp; Catalog Moderation ({filteredProducts.length})
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Create, edit, approve, suspend, feature, or remove canonical marketplace products
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/categories"
              className="px-3.5 h-9 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 inline-flex items-center hover:bg-slate-50 transition-colors"
            >
              Categories
            </Link>
            <Link
              to="/admin/brands"
              className="px-3.5 h-9 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 inline-flex items-center hover:bg-slate-50 transition-colors"
            >
              Brands
            </Link>
            <button
              type="button"
              onClick={() => setEditorModal({ open: true, productId: null })}
              className="px-4 h-9 rounded-xl bg-[#0D63F3] text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#0A52CC] shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Product</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search title, brand, SKU, category..."
              className={`${ADMIN_INPUT_COMPACT_CLASS} pl-8`}
            />
          </div>
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={`${ADMIN_SELECT_COMPACT_CLASS} w-44`}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`${ADMIN_SELECT_COMPACT_CLASS} w-40`}
          >
            <option value="">All Statuses</option>
            <option value="published">Published</option>
            <option value="pending_review">Pending Review</option>
            <option value="draft">Draft</option>
            <option value="suspended">Suspended</option>
            <option value="rejected">Rejected</option>
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('');
                setStatusFilter('');
              }}
              className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pr-3">Product</th>
                <th className="py-2.5 pr-3">Category / Brand</th>
                <th className="py-2.5 pr-3">Price</th>
                <th className="py-2.5 pr-3">Stock</th>
                <th className="py-2.5 pr-3">Flags</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => {
                const offerStats = offerByProdId.get(String(p._id));
                const catName = p.categoryId && typeof p.categoryId === 'object' ? p.categoryId.name : 'Category';
                const brandName = p.brandId && typeof p.brandId === 'object' ? p.brandId.name : 'Brand';
                const storeName =
                  p.createdByStoreId && typeof p.createdByStoreId === 'object'
                    ? p.createdByStoreId.name
                    : 'Catalog';
                return (
                  <tr key={p._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3 min-w-[210px]">
                        <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/70 overflow-hidden shrink-0">
                          <ImageWithFallback src={p.images?.[0] || ''} alt={p.title} className="object-contain" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate max-w-[240px]">{p.title}</p>
                          <p className="text-[11px] text-slate-500 truncate">Store: {storeName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-slate-600">
                      <p className="font-semibold text-slate-800">{catName}</p>
                      <p className="text-[11px] text-slate-500">{brandName}</p>
                    </td>
                    <td className="py-3 pr-3 font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      {offerStats ? formatBDT(offerStats.price) : '—'}
                    </td>
                    <td className="py-3 pr-3 font-semibold tabular-nums">
                      {offerStats ? `${offerStats.stock} (${offerStats.count} offer${offerStats.count > 1 ? 's' : ''})` : '0'}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            updateModeration(p._id, {
                              moderationStatus: p.moderationStatus,
                              isTrending: !p.isTrending,
                            })
                          }
                          className={`px-2 py-0.5 rounded font-bold text-[10px] transition-colors ${
                            p.isTrending
                              ? 'bg-blue-50 text-[#0D63F3] border border-blue-200/70'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {p.isTrending ? 'Trending' : 'Standard'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateModeration(p._id, {
                              moderationStatus: p.moderationStatus,
                              isFlashSaleCandidate: !p.isFlashSaleCandidate,
                            })
                          }
                          className={`px-2 py-0.5 rounded font-bold text-[10px] transition-colors ${
                            p.isFlashSaleCandidate
                              ? 'bg-red-50 text-[#EF3E36] border border-red-200/70'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {p.isFlashSaleCandidate ? 'Flash' : 'Normal'}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                          p.moderationStatus === 'published'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                            : p.moderationStatus === 'pending_review'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200/70'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {p.moderationStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditorModal({ open: true, productId: p._id })}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:border-[#0D63F3] hover:text-[#0D63F3] hover:bg-blue-50/40 transition-colors"
                          aria-label={`Edit ${p.title}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {p.moderationStatus !== 'published' ? (
                          <button
                            type="button"
                            onClick={() => updateModeration(p._id, { moderationStatus: 'published' })}
                            className="px-2.5 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors"
                          >
                            Approve
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => updateModeration(p._id, { moderationStatus: 'suspended' })}
                            className="px-2.5 h-7 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50 font-bold text-[11px] transition-colors"
                          >
                            Suspend
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteProd(p)}
                          className="p-1.5 rounded-lg border border-red-200 text-[#EF3E36] hover:bg-red-50 transition-colors"
                          aria-label={`Delete ${p.title}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ProductEditorModal
        open={editorModal.open}
        productId={editorModal.productId}
        onClose={() => setEditorModal({ open: false, productId: null })}
        onSaved={load}
      />

      <ConfirmDialog
        open={Boolean(deleteProd)}
        onClose={() => setDeleteProd(null)}
        onConfirm={handleDeleteProduct}
        title="Delete Product?"
        description={`Permanently remove "${deleteProd?.title || ''}" and its active seller offers? Products linked to historical orders cannot be deleted.`}
        confirmLabel="Confirm Delete"
        loading={deleting}
      />
    </div>
  );
}

export function AdminOrdersPage() {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';

  const [q, setQ] = useState(initialQ);
  const [statusFilter, setStatusFilter] = useState('');
  const [parentOrders, setParentOrders] = useState<any[]>([]);
  const [subOrders, setSubOrders] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [nextStatus, setNextStatus] = useState('');
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<any>(null);

  const load = (query = q, status = statusFilter) => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (status) params.set('status', status);
    apiRequest(`/api/admin/orders?${params.toString()}`)
      .then((res) => {
        setParentOrders(res.parentOrders || []);
        setSubOrders(res.subOrders || []);
        setTransactions(res.transactions || []);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unable to fetch orders';
        dispatch(pushToast({ type: 'error', title: 'Failed to load orders', message }));
      });
  };

  useEffect(() => {
    setQ(initialQ);
    load(initialQ, statusFilter);
  }, [initialQ]);

  const submitTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub || !nextStatus || transitioning) return;
    setTransitioning(true);
    setTransitionError(null);
    try {
      await apiRequest(`/api/admin/orders/suborders/${selectedSub._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, courierName, trackingNumber }),
      });
      dispatch(pushToast({ type: 'success', title: `Suborder updated to ${nextStatus}` }));
      setSelectedSub(null);
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Transition failed';
      setTransitionError(message);
      dispatch(pushToast({ type: 'error', title: 'Transition blocked', message }));
    } finally {
      setTransitioning(false);
    }
  };

  const openParentDetail = async (id: string) => {
    try {
      const res = await apiRequest(`/api/admin/orders/${id}`);
      setOrderDetail(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Load failed';
      dispatch(pushToast({ type: 'error', title: 'Unable to open order detail', message }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold text-[#0B1F4B]">Orders &amp; Multi-Vendor Suborders</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {parentOrders.length} parent orders · {subOrders.length} seller suborders · {transactions.length} payment records
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load(q, statusFilter);
            }}
            className="flex flex-wrap gap-2"
          >
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search order #, store, customer..."
                className={`${ADMIN_INPUT_COMPACT_CLASS} pl-8 w-56`}
              />
            </div>
            <select
              aria-label="Filter suborders by status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                load(q, e.target.value);
              }}
              className={`${ADMIN_SELECT_COMPACT_CLASS} w-36`}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="processing">Processing</option>
              <option value="packed">Packed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button
              type="submit"
              className="px-4 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold shadow-xs transition-colors"
            >
              Filter
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pr-3">Suborder #</th>
                <th className="py-2.5 pr-3">Seller Store</th>
                <th className="py-2.5 pr-3">Subtotal</th>
                <th className="py-2.5 pr-3">Commission</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subOrders.map((sub) => {
                const allowed = ALLOWED_SUBORDER_TRANSITIONS[sub.status as OrderStatus] || [];
                return (
                  <tr key={sub._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 pr-3 font-mono-num font-bold text-[#0B1F4B]">{sub.subOrderNumber}</td>
                    <td className="py-3 pr-3 font-semibold text-slate-800">{sub.storeName}</td>
                    <td className="py-3 pr-3 tabular-nums font-bold text-slate-900">{formatBDT(sub.subtotal)}</td>
                    <td className="py-3 pr-3 tabular-nums text-slate-600">{formatBDT(sub.commissionAmount)}</td>
                    <td className="py-3 pr-3">
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0D63F3] font-bold uppercase text-[10px]">
                        {sub.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {allowed.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setTransitionError(null);
                            setSelectedSub(sub);
                            setNextStatus(allowed[0]);
                            setCourierName(sub.shipment?.courierName || 'Steadfast Courier');
                            setTrackingNumber(sub.shipment?.trackingNumber || '');
                          }}
                          className="px-3 h-7 rounded-lg bg-[#0D63F3] hover:bg-[#0A52CC] text-white font-bold text-[11px] transition-colors"
                        >
                          Update Status
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-400">Finalized</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-4 shadow-2xs">
        <h2 className="text-base font-extrabold text-[#0B1F4B]">Parent Orders ({parentOrders.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pr-3">Order #</th>
                <th className="py-2.5 pr-3">Customer</th>
                <th className="py-2.5 pr-3">Grand Total</th>
                <th className="py-2.5 pr-3">Method</th>
                <th className="py-2.5 pr-3">Payment Status</th>
                <th className="py-2.5 text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {parentOrders.slice(0, 30).map((po) => (
                <tr key={po._id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 pr-3 font-mono-num font-bold text-[#0D63F3]">#{po.orderNumber}</td>
                  <td className="py-2.5 pr-3 font-semibold text-slate-800">
                    {po.customerId?.name || po.shippingAddress?.fullName}
                  </td>
                  <td className="py-2.5 pr-3 font-bold tabular-nums text-slate-900">{formatBDT(po.grandTotal)}</td>
                  <td className="py-2.5 pr-3 uppercase font-semibold text-slate-600">{po.paymentMethod}</td>
                  <td className="py-2.5 pr-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 uppercase font-bold text-[10px] text-slate-700">
                      {po.paymentStatus}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => openParentDetail(po._id)}
                      className="inline-flex items-center gap-1 px-2.5 h-7 rounded-lg border border-slate-200 text-slate-700 font-bold text-[11px] hover:border-[#0D63F3] hover:text-[#0D63F3] transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AdminDialog
        open={Boolean(selectedSub)}
        onClose={() => setSelectedSub(null)}
        title={selectedSub ? `Update Suborder ${selectedSub.subOrderNumber}` : 'Update Suborder'}
        subtitle={selectedSub ? `Store: ${selectedSub.storeName} · Current status: ${String(selectedSub.status).replace(/_/g, ' ')}` : undefined}
        badge="Fulfillment"
        size="md"
        isSubmitting={transitioning}
        error={transitionError}
        footer={
          <>
            <button
              type="button"
              disabled={transitioning}
              onClick={() => setSelectedSub(null)}
              className="px-4 h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="suborder-transition-form"
              disabled={transitioning}
              className="px-5 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-60"
            >
              {transitioning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Apply Transition</span>
            </button>
          </>
        }
      >
        {selectedSub && (
          <form id="suborder-transition-form" onSubmit={submitTransition} className="space-y-4 text-xs">
            <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold text-slate-500">Seller Store</p>
                <p className="font-bold text-[#0B1F4B] mt-0.5">{selectedSub.storeName}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold text-slate-500">Suborder Subtotal</p>
                <p className="font-extrabold text-[#0D63F3] tabular-nums mt-0.5">{formatBDT(selectedSub.subtotal)}</p>
              </div>
            </div>

            <FormSection
              title="Fulfillment Transition"
              description="Advance order state and attach optional courier tracking info."
              icon={<Truck className="w-3.5 h-3.5" />}
            >
              <FormField label="Next Valid State" htmlFor="suborder-next-status" required>
                <select
                  id="suborder-next-status"
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value)}
                  className={ADMIN_SELECT_CLASS}
                >
                  {(ALLOWED_SUBORDER_TRANSITIONS[selectedSub.status as OrderStatus] || []).map((st: string) => (
                    <option key={st} value={st}>
                      {st.replace(/_/g, ' ').toUpperCase()}
                    </option>
                  ))}
                </select>
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <FormField label="Courier Partner" htmlFor="suborder-courier" optional>
                  <input
                    id="suborder-courier"
                    placeholder="e.g. Pathao, Steadfast"
                    value={courierName}
                    onChange={(e) => setCourierName(e.target.value)}
                    className={ADMIN_INPUT_CLASS}
                  />
                </FormField>
                <FormField label="Tracking Number" htmlFor="suborder-tracking" optional>
                  <input
                    id="suborder-tracking"
                    placeholder="e.g. TRK-902841"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className={`${ADMIN_INPUT_CLASS} font-mono-num`}
                  />
                </FormField>
              </div>
            </FormSection>
          </form>
        )}
      </AdminDialog>

      <AdminDialog
        open={Boolean(orderDetail)}
        onClose={() => setOrderDetail(null)}
        title={`Order #${orderDetail?.parentOrder?.orderNumber || ''}`}
        subtitle="Customer shipping snapshot, payment summary, and multi-vendor suborder breakdown."
        badge="Order Detail"
        size="lg"
        footer={
          <button
            type="button"
            onClick={() => setOrderDetail(null)}
            className="px-4 h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        }
      >
        {orderDetail && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 space-y-1">
                <p className="text-[11px] font-semibold text-slate-500">Customer &amp; Delivery Address</p>
                <p className="font-bold text-[#0B1F4B]">
                  {orderDetail.parentOrder.customerId?.name || orderDetail.parentOrder.shippingAddress?.fullName}
                </p>
                <p className="text-slate-600 leading-relaxed">
                  {[
                    orderDetail.parentOrder.shippingAddress?.streetAddress,
                    orderDetail.parentOrder.shippingAddress?.unionOrArea,
                    orderDetail.parentOrder.shippingAddress?.upazila,
                    orderDetail.parentOrder.shippingAddress?.district,
                    orderDetail.parentOrder.shippingAddress?.division,
                  ]
                    .filter(Boolean)
                    .join(', ') || 'No address lines provided'}
                </p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 space-y-1">
                <p className="text-[11px] font-semibold text-slate-500">Payment &amp; Grand Total</p>
                <p className="text-lg font-extrabold text-[#0D63F3] tabular-nums">
                  {formatBDT(orderDetail.parentOrder.grandTotal)}
                </p>
                <p className="uppercase font-bold text-[11px] text-slate-700">
                  {orderDetail.parentOrder.paymentMethod} · {orderDetail.parentOrder.paymentStatus}
                </p>
              </div>
            </div>

            <FormSection
              title={`Vendor Suborders (${(orderDetail.subOrders || []).length})`}
              icon={<PackageCheck className="w-3.5 h-3.5" />}
            >
              <div className="space-y-2.5">
                {(orderDetail.subOrders || []).map((s: any) => (
                  <div key={s._id} className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                      <span className="font-mono-num text-[#0B1F4B]">
                        {s.subOrderNumber} <span className="font-sans text-slate-500 font-semibold">({s.storeName})</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-[#0D63F3] uppercase text-[10px]">
                        {String(s.status).replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-200/60">
                      {(s.items || []).map((it: any, idx: number) => (
                        <div key={idx} className="flex justify-between py-1.5 text-slate-700">
                          <span>
                            {it.productTitle} <span className="text-slate-400">× {it.quantity}</span>
                          </span>
                          <span className="font-bold tabular-nums text-slate-900">{formatBDT(it.lineTotal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </FormSection>
          </div>
        )}
      </AdminDialog>
    </div>
  );
}

export function AdminReturnsPage() {
  const dispatch = useDispatch();
  const [returns, setReturns] = useState<any[]>([]);
  const [modalRet, setModalRet] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [decision, setDecision] = useState({
    status: 'refund_approved',
    approvedAmount: 0,
    refundReferenceId: '',
    adminResolutionNote: '',
  });

  const load = () => {
    apiRequest('/api/admin/returns')
      .then((res) => setReturns(res.returns || []))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unable to fetch returns';
        dispatch(pushToast({ type: 'error', title: 'Failed to load returns', message }));
      });
  };
  useEffect(load, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalRet || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiRequest(`/api/admin/returns/${modalRet._id}`, {
        method: 'PATCH',
        body: JSON.stringify(decision),
      });
      dispatch(pushToast({ type: 'success', title: `Return updated to ${decision.status.replace(/_/g, ' ')}` }));
      setModalRet(null);
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setSubmitError(message);
      dispatch(pushToast({ type: 'error', title: 'Error', message }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-5 shadow-2xs">
      <div>
        <h1 className="text-lg font-extrabold text-[#0B1F4B]">Returns, Disputes &amp; Refund Execution</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Review customer claims, inspect seller responses, and execute verified refund settlements
        </p>
      </div>

      {returns.length === 0 ? (
        <div className="py-10 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 space-y-2">
          <RotateCcw className="w-7 h-7 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-700">No return requests open</p>
        </div>
      ) : (
        <div className="space-y-3">
          {returns.map((r) => {
            const finalized = r.status === 'refund_executed' || r.status === 'rejected';
            return (
              <div
                key={r._id}
                className="p-4 rounded-xl border border-slate-200/90 hover:border-slate-300 transition-colors flex flex-wrap items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num font-bold text-[#0B1F4B]">{r.returnNumber}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                        r.status === 'refund_executed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : r.status === 'rejected'
                            ? 'bg-red-50 text-[#EF3E36]'
                            : 'bg-blue-50 text-[#0D63F3]'
                      }`}
                    >
                      {r.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-slate-600">
                    Customer: <strong className="text-slate-800">{r.customerId?.name}</strong> · Store:{' '}
                    <strong className="text-slate-800">{r.storeId?.name}</strong> · Requested:{' '}
                    <strong className="text-[#0B1F4B] tabular-nums">{formatBDT(r.requestedAmount)}</strong>
                    {r.approvedAmount !== undefined && ` · Approved: ${formatBDT(r.approvedAmount)}`}
                  </p>
                  <p className="text-slate-500">Reason: {r.reason}</p>
                  {r.refundReferenceId && (
                    <p className="text-emerald-700 font-mono-num font-semibold">Refund Ref: {r.refundReferenceId}</p>
                  )}
                </div>
                {finalized ? (
                  <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 font-bold uppercase text-[11px]">
                    {r.status.replace(/_/g, ' ')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitError(null);
                      setModalRet(r);
                      setDecision({
                        status: r.status === 'refund_approved' ? 'refund_executed' : 'refund_approved',
                        approvedAmount: r.approvedAmount ?? r.requestedAmount,
                        refundReferenceId: r.refundReferenceId || `REF-${Date.now()}`,
                        adminResolutionNote: r.adminResolutionNote || '',
                      });
                    }}
                    className="px-4 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white font-bold shadow-xs transition-colors"
                  >
                    Resolve / Execute Refund
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AdminDialog
        open={Boolean(modalRet)}
        onClose={() => setModalRet(null)}
        title={modalRet ? `Process Return ${modalRet.returnNumber}` : 'Process Return'}
        subtitle={
          modalRet
            ? `${modalRet.customerId?.name || 'Customer'} · Store: ${modalRet.storeId?.name || 'Seller'}`
            : undefined
        }
        badge="Dispute & Refund"
        size="md"
        isSubmitting={submitting}
        error={submitError}
        footer={
          <>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setModalRet(null)}
              className="px-4 h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="return-resolution-form"
              disabled={submitting}
              className="px-5 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Return Resolution</span>
            </button>
          </>
        }
      >
        {modalRet && (
          <form id="return-resolution-form" onSubmit={submit} className="space-y-4 text-xs">
            <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500">Requested Refund</span>
                <span className="font-extrabold text-[#0D63F3] tabular-nums text-sm">
                  {formatBDT(modalRet.requestedAmount)}
                </span>
              </div>
              <p className="text-slate-600">
                <strong className="text-slate-800">Reason:</strong> {modalRet.reason}
              </p>
            </div>

            <FormSection
              title="Resolution & Refund Ledger"
              description="Executing a refund debits the seller ledger and marks the claim settled."
              icon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              <FormField label="Resolution Status" htmlFor="ret-status" required>
                <select
                  id="ret-status"
                  value={decision.status}
                  onChange={(e) => setDecision({ ...decision, status: e.target.value })}
                  className={ADMIN_SELECT_CLASS}
                >
                  <option value="admin_review">Under Admin Review</option>
                  <option value="item_received">Returned Item Received</option>
                  <option value="refund_approved">Refund Approved</option>
                  <option value="refund_executed">Refund Executed (Debit Seller &amp; Mark Refunded)</option>
                  <option value="rejected">Rejected</option>
                </select>
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <FormField label="Approved Refund Amount (BDT)" htmlFor="ret-amount" required>
                  <input
                    id="ret-amount"
                    type="number"
                    min={0}
                    max={modalRet.requestedAmount}
                    value={decision.approvedAmount}
                    onChange={(e) => setDecision({ ...decision, approvedAmount: Number(e.target.value) })}
                    className={`${ADMIN_INPUT_CLASS} tabular-nums`}
                  />
                </FormField>
                <FormField label="Refund Reference ID" htmlFor="ret-ref" optional>
                  <input
                    id="ret-ref"
                    placeholder="e.g. REF-123456"
                    value={decision.refundReferenceId}
                    onChange={(e) => setDecision({ ...decision, refundReferenceId: e.target.value })}
                    className={`${ADMIN_INPUT_CLASS} font-mono-num`}
                  />
                </FormField>
              </div>

              <FormField label="Admin Resolution Notes" htmlFor="ret-note" optional>
                <textarea
                  id="ret-note"
                  rows={2}
                  placeholder="Internal notes or customer-visible resolution explanation..."
                  value={decision.adminResolutionNote}
                  onChange={(e) => setDecision({ ...decision, adminResolutionNote: e.target.value })}
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
