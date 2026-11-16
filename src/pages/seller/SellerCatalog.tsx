import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Upload } from 'lucide-react';
import { apiRequest, formatBDT } from '../../lib/api';
import { pushToast } from '../../store/uiSlice';

export function SellerProductsPage() {
  const [offers, setOffers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, { price: number; stock: number; isActive: boolean }>>({});
  const dispatch = useDispatch();

  const load = () => {
    setLoading(true);
    Promise.all([apiRequest('/api/seller/offers'), apiRequest('/api/seller/products')])
      .then(([offersRes, productsRes]) => {
        setOffers(offersRes.offers || []);
        setProducts(productsRes.products || []);
        const map: Record<string, any> = {};
        for (const o of offersRes.offers || []) {
          map[o._id] = { price: o.price, stock: o.stock, isActive: o.isActive };
        }
        setEdits(map);
      })
      .catch((err: any) => dispatch(pushToast({ type: 'error', title: 'Failed to load catalog', message: err.message })))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const submitForReview = async (productId: string) => {
    try {
      await apiRequest(`/api/seller/products/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify({ moderationStatus: 'pending_review' }),
      });
      dispatch(pushToast({ type: 'success', title: 'Submitted for Admin Review' }));
      load();
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Submission Failed', message: err.message }));
    }
  };

  const saveOffer = async (offerId: string) => {
    try {
      await apiRequest(`/api/seller/offers/${offerId}`, {
        method: 'PATCH',
        body: JSON.stringify(edits[offerId]),
      });
      dispatch(pushToast({ type: 'success', title: 'Inventory & Offer Updated' }));
      load();
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Update Failed', message: err.message }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h1 className="text-lg font-extrabold text-slate-900">Your Store Offers &amp; Isolated Inventory</h1>
        {loading ? (
          <p className="text-xs text-slate-500">Loading offers...</p>
        ) : offers.length === 0 ? (
        <p className="text-xs text-slate-500">You have not listed any offers yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">Product &amp; SKU</th>
                <th className="py-2 pr-3">Moderation</th>
                <th className="py-2 pr-3">Price (৳)</th>
                <th className="py-2 pr-3">Stock</th>
                <th className="py-2 pr-3">Active</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {offers.map((o) => {
                const ed = edits[o._id] || { price: o.price, stock: o.stock, isActive: o.isActive };
                return (
                  <tr key={o._id}>
                    <td className="py-3 pr-3">
                      <p className="font-bold text-slate-900">{o.productId?.title}</p>
                      <p className="text-[11px] text-slate-500 font-mono-num">{o.variantSku}</p>
                    </td>
                    <td className="py-3 pr-3 uppercase font-semibold text-slate-600">
                      {o.productId?.moderationStatus?.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        type="number"
                        value={ed.price}
                        onChange={(e) =>
                          setEdits({ ...edits, [o._id]: { ...ed, price: Number(e.target.value) } })
                        }
                        className="w-24 h-8 px-2 rounded border border-slate-300 tabular-nums"
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        type="number"
                        min={0}
                        value={ed.stock}
                        onChange={(e) =>
                          setEdits({ ...edits, [o._id]: { ...ed, stock: Number(e.target.value) } })
                        }
                        className="w-20 h-8 px-2 rounded border border-slate-300 tabular-nums"
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        type="checkbox"
                        checked={ed.isActive}
                        onChange={(e) =>
                          setEdits({ ...edits, [o._id]: { ...ed, isActive: e.target.checked } })
                        }
                      />
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => saveOffer(o._id)}
                        className="px-3 py-1.5 rounded-lg bg-[#0D63F3] text-white font-bold"
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-extrabold text-slate-900">Your Submitted Products &amp; Moderation Status</h2>
        {products.length === 0 ? (
          <p className="text-xs text-slate-500">No canonical product submissions yet.</p>
        ) : (
          <div className="space-y-2.5">
            {products.map((p) => (
              <div key={p._id} className="p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-slate-900">{p.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {p.categoryId?.name || 'Category'} · {p.brandId?.name || 'Brand'}
                  </p>
                  {p.moderationNotes && <p className="text-[11px] text-amber-700 mt-0.5">Note: {p.moderationNotes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-slate-100 font-bold uppercase text-[10px]">
                    {p.moderationStatus?.replace(/_/g, ' ')}
                  </span>
                  {(p.moderationStatus === 'draft' || p.moderationStatus === 'rejected') && (
                    <button
                      type="button"
                      onClick={() => submitForReview(p._id)}
                      className="px-3 py-1.5 rounded-lg bg-[#0D63F3] text-white font-bold"
                    >
                      Submit for Review
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function SellerAddProductPage() {
  const dispatch = useDispatch();
  const [mode, setMode] = useState<'attach' | 'new'>('attach');
  const [canonicalList, setCanonicalList] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);

  // Attach Offer state
  const [selectedProdId, setSelectedProdId] = useState('');
  const [selectedSku, setSelectedSku] = useState('');
  const [offerPrice, setOfferPrice] = useState(1999);
  const [offerCompare, setOfferCompare] = useState(2999);
  const [offerStock, setOfferStock] = useState(20);
  const [offerNote, setOfferNote] = useState('');

  // New Canonical Product state
  const [title, setTitle] = useState('');
  const [bnTitle, setBnTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [sku, setSku] = useState('');
  const [variantLabel, setVariantLabel] = useState('Standard');
  const [imageUrl, setImageUrl] = useState('/images/prod_earbuds_pro_1794726984024.jpg');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    Promise.all([
      apiRequest('/api/seller/catalog/canonical'),
      apiRequest('/api/catalog/categories'),
      apiRequest('/api/catalog/brands'),
    ])
      .then(([c, cats, brs]) => {
        setCanonicalList(c.products || []);
        if (c.products?.[0]) {
          setSelectedProdId(c.products[0]._id);
          setSelectedSku(c.products[0].variants?.[0]?.sku || '');
        }
        setCategories(cats.categories || []);
        if (cats.categories?.[0]) setCategoryId(cats.categories[0]._id);
        setBrands(brs.brands || []);
        if (brs.brands?.[0]) setBrandId(brs.brands[0]._id);
      })
      .catch((err: any) => dispatch(pushToast({ type: 'error', title: 'Failed to load catalog options', message: err.message })));
  }, []);

  const selectedCanonical = canonicalList.find((p) => p._id === selectedProdId);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'products');
      const res = await apiRequest<{ media: { url: string } }>('/api/upload', {
        method: 'POST',
        body: fd,
      });
      setImageUrl(res.media.url);
      dispatch(pushToast({ type: 'success', title: 'Image Uploaded' }));
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Upload Failed', message: err.message }));
    } finally {
      setUploading(false);
    }
  };

  const handleAttachOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/seller/offers', {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedProdId,
          variantSku: selectedSku,
          price: Number(offerPrice),
          compareAtPrice: offerCompare ? Number(offerCompare) : undefined,
          stock: Number(offerStock),
          offerNote,
        }),
      });
      dispatch(pushToast({ type: 'success', title: 'Seller Offer Published' }));
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Offer Failed', message: err.message }));
    }
  };

  const handleCreateProduct = async (e: React.FormEvent, targetStatus: 'draft' | 'pending_review' = 'pending_review') => {
    e.preventDefault();
    try {
      await apiRequest('/api/seller/products', {
        method: 'POST',
        body: JSON.stringify({
          moderationStatus: targetStatus,
          product: {
            title,
            bnTitle,
            description,
            categoryId,
            brandId,
            images: [imageUrl],
            variants: [{ sku, label: variantLabel }],
          },
          offer: {
            variantSku: sku,
            price: Number(offerPrice),
            compareAtPrice: offerCompare ? Number(offerCompare) : undefined,
            stock: Number(offerStock),
            offerNote,
          },
        }),
      });
      dispatch(
        pushToast({
          type: 'success',
          title: targetStatus === 'draft' ? 'Saved as Draft' : 'Submitted for Moderation',
          message:
            targetStatus === 'draft'
              ? 'Product saved as draft. Submit it for review when ready.'
              : 'New canonical product created and queued for Admin approval.',
        })
      );
      setTitle('');
      setDescription('');
      setSku('');
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Creation Failed', message: err.message }));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-extrabold text-slate-900">Add Product or Attach Seller Offer</h1>
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('attach')}
            className={`px-3.5 py-1.5 rounded-lg ${mode === 'attach' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600'}`}
          >
            Attach Offer to Canonical Product
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`px-3.5 py-1.5 rounded-lg ${mode === 'new' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600'}`}
          >
            Submit New Canonical Product
          </button>
        </div>
      </div>

      {mode === 'attach' ? (
        <form onSubmit={handleAttachOffer} className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Canonical Product</label>
            <select
              value={selectedProdId}
              onChange={(e) => {
                setSelectedProdId(e.target.value);
                const p = canonicalList.find((x) => x._id === e.target.value);
                if (p?.variants?.[0]) setSelectedSku(p.variants[0].sku);
              }}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm bg-white"
            >
              {canonicalList.map((p) => (
                <option key={p._id} value={p._id}>{p.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Variant SKU</label>
            <select
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm bg-white"
            >
              {(selectedCanonical?.variants || []).map((v: any) => (
                <option key={v.sku} value={v.sku}>{v.label} ({v.sku})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Your Price (৳)</label>
              <input type="number" required value={offerPrice} onChange={(e) => setOfferPrice(Number(e.target.value))} className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Compare-At Price (৳)</label>
              <input type="number" value={offerCompare} onChange={(e) => setOfferCompare(Number(e.target.value))} className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Your Stock</label>
              <input type="number" required min={0} value={offerStock} onChange={(e) => setOfferStock(Number(e.target.value))} className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm" />
            </div>
          </div>

          <input
            placeholder="Offer note (e.g. Official Warranty Card Included)"
            value={offerNote}
            onChange={(e) => setOfferNote(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm"
          />

          <button type="submit" className="px-6 py-2.5 rounded-xl bg-[#0D63F3] text-white text-xs font-bold">
            Save My Seller Offer
          </button>
        </form>
      ) : (
        <form onSubmit={handleCreateProduct} className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Product Title (English) *</label>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Product Title (বাংলা)</label>
              <input value={bnTitle} onChange={(e) => setBnTitle(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm bg-white">
                {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Brand *</label>
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm bg-white">
                {brands.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Variant SKU *</label>
              <input required placeholder="e.g. NV-2026-BLK" value={sku} onChange={(e) => setSku(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Variant Label *</label>
              <input required value={variantLabel} onChange={(e) => setVariantLabel(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product Description *</label>
            <textarea required minLength={10} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 text-sm" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold cursor-pointer hover:bg-slate-50">
              <Upload className="w-4 h-4 text-[#0D63F3]" />
              {uploading ? 'Uploading...' : 'Upload Product Photo'}
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
            <span className="text-xs text-slate-500 truncate max-w-xs">{imageUrl}</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Price (৳)</label>
              <input type="number" required value={offerPrice} onChange={(e) => setOfferPrice(Number(e.target.value))} className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Compare-At (৳)</label>
              <input type="number" value={offerCompare} onChange={(e) => setOfferCompare(Number(e.target.value))} className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Stock</label>
              <input type="number" required min={0} value={offerStock} onChange={(e) => setOfferStock(Number(e.target.value))} className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm" />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className="px-6 py-2.5 rounded-xl bg-[#0D63F3] text-white text-xs font-bold">
              Submit Product for Admin Approval
            </button>
            <button
              type="button"
              onClick={(e) => handleCreateProduct(e as any, 'draft')}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50"
            >
              Save as Draft
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
