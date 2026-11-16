import React, { useEffect, useId, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  FileText,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Loader2,
  Package,
  Plus,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react';
import {
  ADMIN_INPUT_CLASS,
  ADMIN_INPUT_COMPACT_CLASS,
  ADMIN_SELECT_CLASS,
  ADMIN_TEXTAREA_CLASS,
  AdminDialog,
  FormField,
  FormSection,
  ToggleSwitchCard,
} from './AdminDialog';
import { MultiMediaUploader, SingleMediaUploader } from './MediaUploader';
import { apiRequest, formatBDT } from '../../lib/api';
import { pushToast } from '../../store/uiSlice';
import { ImageWithFallback } from '../ui/ImageWithFallback';

interface CategoryOption {
  _id: string;
  name: string;
  parentId?: string | null;
}

interface BrandOption {
  _id: string;
  name: string;
}

interface StoreOption {
  _id: string;
  name: string;
}

interface VariantItem {
  sku: string;
  label: string;
  color?: string;
  sizeOrStorage?: string;
  imageUrl?: string;
}

interface SpecItem {
  key: string;
  value: string;
}

interface ProductEditorContentProps {
  productId: string | null;
  formId?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmittingChange?: (submitting: boolean) => void;
  onErrorChange?: (error: string | null) => void;
  onSaved: () => void;
}

export function ProductEditorContent({
  productId,
  formId = 'admin-product-editor-form',
  onDirtyChange,
  onSubmittingChange,
  onErrorChange,
  onSaved,
}: ProductEditorContentProps) {
  const dispatch = useDispatch();
  const isEdit = Boolean(productId);

  const titleId = useId();
  const descId = useId();
  const categoryId = useId();
  const brandId = useId();
  const storeId = useId();
  const priceId = useId();
  const stockId = useId();

  const [loading, setLoading] = useState(true);
  const [submittingLocal, setSubmittingLocal] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [expandedVariantImage, setExpandedVariantImage] = useState<Record<number, boolean>>({});

  const [form, setForm] = useState({
    title: '',
    bnTitle: '',
    slug: '',
    description: '',
    categoryId: '',
    subCategoryId: '',
    brandId: '',
    storeId: '',
    modelName: '',
    videoUrl: '',
    warranty: '1 Year Official Warranty',
    returnPolicyDays: 7,
    weightGrams: 500,
    moderationStatus: 'published',
    isTrending: false,
    isFlashSaleCandidate: false,
    isSponsored: false,
    keywordsText: '',
    images: [] as string[],
    offerId: '',
    price: 1999,
    compareAtPrice: 2499,
    stock: 25,
    deliveryEstimateDays: '2-4 Days',
    shippingFeeDhaka: 60,
    shippingFeeNationwide: 120,
  });

  const [variants, setVariants] = useState<VariantItem[]>([
    { sku: `NV-${Date.now().toString().slice(-5)}`, label: 'Standard Edition' },
  ]);
  const [specs, setSpecs] = useState<SpecItem[]>([{ key: 'Warranty', value: '1 Year Official' }]);

  const markDirty = () => {
    onDirtyChange?.(true);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setExpandedVariantImage({});
    onErrorChange?.(null);
    onDirtyChange?.(false);

    const metaReq = apiRequest<{
      categories: CategoryOption[];
      brands: BrandOption[];
      stores: StoreOption[];
    }>('/api/admin/catalog/products');

    const prodReq =
      isEdit && productId
        ? apiRequest<{
            product: {
              _id: string;
              title?: string;
              bnTitle?: string;
              slug?: string;
              description?: string;
              categoryId?: { _id: string } | string;
              subCategoryId?: { _id: string } | string | null;
              brandId?: { _id: string } | string;
              createdByStoreId?: { _id: string } | string;
              modelName?: string;
              videoUrl?: string;
              warranty?: string;
              returnPolicyDays?: number;
              weightGrams?: number;
              moderationStatus?: string;
              isTrending?: boolean;
              isFlashSaleCandidate?: boolean;
              isSponsored?: boolean;
              keywords?: string[];
              images?: string[];
              variants?: VariantItem[];
              specifications?: SpecItem[];
            };
            offers: Array<{
              _id: string;
              price?: number;
              compareAtPrice?: number;
              stock?: number;
              deliveryEstimateDays?: string;
              shippingFeeDhaka?: number;
              shippingFeeNationwide?: number;
            }>;
          }>(`/api/admin/catalog/products/${productId}`)
        : Promise.resolve(null);

    Promise.all([metaReq, prodReq])
      .then(([meta, prodData]) => {
        if (cancelled) return;
        const cats = meta.categories || [];
        const brs = meta.brands || [];
        const sts = meta.stores || [];
        setCategories(cats);
        setBrands(brs);
        setStores(sts);

        if (prodData?.product) {
          const p = prodData.product;
          const primaryOffer = prodData.offers?.[0];
          const catId = typeof p.categoryId === 'object' ? p.categoryId?._id || '' : p.categoryId || '';
          const subId =
            p.subCategoryId && typeof p.subCategoryId === 'object'
              ? p.subCategoryId._id || ''
              : (p.subCategoryId as string | null) || '';
          const brId = typeof p.brandId === 'object' ? p.brandId?._id || '' : p.brandId || '';
          const stId =
            typeof p.createdByStoreId === 'object' ? p.createdByStoreId?._id || '' : p.createdByStoreId || '';

          setForm({
            title: p.title || '',
            bnTitle: p.bnTitle || '',
            slug: p.slug || '',
            description: p.description || '',
            categoryId: catId || cats[0]?._id || '',
            subCategoryId: subId,
            brandId: brId || brs[0]?._id || '',
            storeId: stId || sts[0]?._id || '',
            modelName: p.modelName || '',
            videoUrl: p.videoUrl || '',
            warranty: p.warranty || '1 Year Official Warranty',
            returnPolicyDays: p.returnPolicyDays ?? 7,
            weightGrams: p.weightGrams ?? 500,
            moderationStatus: p.moderationStatus || 'published',
            isTrending: Boolean(p.isTrending),
            isFlashSaleCandidate: Boolean(p.isFlashSaleCandidate),
            isSponsored: Boolean(p.isSponsored),
            keywordsText: (p.keywords || []).join(', '),
            images: p.images?.length ? p.images : [],
            offerId: primaryOffer?._id || '',
            price: primaryOffer?.price ?? 1999,
            compareAtPrice: primaryOffer?.compareAtPrice ?? 0,
            stock: primaryOffer?.stock ?? 20,
            deliveryEstimateDays: primaryOffer?.deliveryEstimateDays || '2-4 Days',
            shippingFeeDhaka: primaryOffer?.shippingFeeDhaka ?? 60,
            shippingFeeNationwide: primaryOffer?.shippingFeeNationwide ?? 120,
          });
          setVariants(
            p.variants?.length
              ? p.variants
              : [{ sku: `NV-${Date.now().toString().slice(-5)}`, label: 'Standard Edition' }]
          );
          setSpecs(p.specifications?.length ? p.specifications : [{ key: 'Warranty', value: '1 Year Official' }]);
        } else {
          const rootCats = cats.filter((c) => !c.parentId);
          setForm({
            title: '',
            bnTitle: '',
            slug: '',
            description: '',
            categoryId: rootCats[0]?._id || cats[0]?._id || '',
            subCategoryId: '',
            brandId: brs[0]?._id || '',
            storeId: sts[0]?._id || '',
            modelName: '',
            videoUrl: '',
            warranty: '1 Year Official Warranty',
            returnPolicyDays: 7,
            weightGrams: 500,
            moderationStatus: 'published',
            isTrending: false,
            isFlashSaleCandidate: false,
            isSponsored: false,
            keywordsText: '',
            images: [],
            offerId: '',
            price: 1999,
            compareAtPrice: 2499,
            stock: 25,
            deliveryEstimateDays: '2-4 Days',
            shippingFeeDhaka: 60,
            shippingFeeNationwide: 120,
          });
          setVariants([{ sku: `NV-${Date.now().toString().slice(-5)}`, label: 'Standard Edition' }]);
          setSpecs([{ key: 'Warranty', value: '1 Year Official' }]);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Unable to load product data';
        onErrorChange?.(message);
        dispatch(pushToast({ type: 'error', title: 'Load failed', message }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [productId, isEdit, dispatch]);

  const rootCategories = useMemo(
    () => categories.filter((c) => !c.parentId || c._id === form.categoryId),
    [categories, form.categoryId]
  );

  const subCategories = useMemo(
    () => categories.filter((c) => c.parentId && String(c.parentId) === String(form.categoryId)),
    [categories, form.categoryId]
  );

  const discountPercent =
    form.compareAtPrice > form.price && form.compareAtPrice > 0
      ? Math.round(((form.compareAtPrice - form.price) / form.compareAtPrice) * 100)
      : 0;

  const selectedCatName = categories.find((c) => c._id === form.categoryId)?.name || 'Category';
  const selectedBrandName = brands.find((b) => b._id === form.brandId)?.name || 'Brand';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingLocal) return;
    onErrorChange?.(null);

    if (form.images.length === 0) {
      onErrorChange?.('Upload at least one product image.');
      return;
    }
    const cleanedVariants = variants
      .filter((v) => v.sku.trim() && v.label.trim())
      .map((v) => ({
        sku: v.sku.trim(),
        label: v.label.trim(),
        color: v.color?.trim() || undefined,
        sizeOrStorage: v.sizeOrStorage?.trim() || undefined,
        imageUrl: v.imageUrl?.trim() || undefined,
      }));
    if (cleanedVariants.length === 0) {
      onErrorChange?.('At least one product variant with SKU and label is required.');
      return;
    }

    const cleanedSpecs = specs
      .filter((s) => s.key.trim() && s.value.trim())
      .map((s) => ({ key: s.key.trim(), value: s.value.trim() }));
    const keywords = form.keywordsText
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    setSubmittingLocal(true);
    onSubmittingChange?.(true);
    try {
      const offerPayload = {
        _id: form.offerId || undefined,
        variantSku: cleanedVariants[0].sku,
        price: Number(form.price),
        compareAtPrice: form.compareAtPrice > form.price ? Number(form.compareAtPrice) : undefined,
        stock: Number(form.stock),
        deliveryEstimateDays: form.deliveryEstimateDays.trim() || '2-4 Days',
        shippingFeeDhaka: Number(form.shippingFeeDhaka) || 0,
        shippingFeeNationwide: Number(form.shippingFeeNationwide) || 0,
      };

      if (isEdit && productId) {
        await apiRequest(`/api/admin/catalog/products/${productId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: form.title.trim(),
            bnTitle: form.bnTitle.trim(),
            slug: form.slug.trim() || undefined,
            description: form.description.trim(),
            categoryId: form.categoryId,
            subCategoryId: form.subCategoryId || null,
            brandId: form.brandId,
            modelName: form.modelName.trim(),
            videoUrl: form.videoUrl.trim(),
            warranty: form.warranty.trim(),
            returnPolicyDays: Number(form.returnPolicyDays),
            weightGrams: Number(form.weightGrams),
            moderationStatus: form.moderationStatus,
            isTrending: form.isTrending,
            isFlashSaleCandidate: form.isFlashSaleCandidate,
            isSponsored: form.isSponsored,
            keywords,
            images: form.images,
            variants: cleanedVariants,
            specifications: cleanedSpecs,
            offer: offerPayload,
          }),
        });
        dispatch(pushToast({ type: 'success', title: 'Product updated successfully' }));
      } else {
        await apiRequest('/api/admin/catalog/products', {
          method: 'POST',
          body: JSON.stringify({
            storeId: form.storeId,
            moderationStatus: form.moderationStatus,
            isTrending: form.isTrending,
            isFlashSaleCandidate: form.isFlashSaleCandidate,
            isSponsored: form.isSponsored,
            product: {
              title: form.title.trim(),
              bnTitle: form.bnTitle.trim() || undefined,
              slug: form.slug.trim() || undefined,
              description: form.description.trim(),
              categoryId: form.categoryId,
              subCategoryId: form.subCategoryId || undefined,
              brandId: form.brandId,
              modelName: form.modelName.trim() || undefined,
              videoUrl: form.videoUrl.trim() || undefined,
              warranty: form.warranty.trim(),
              returnPolicyDays: Number(form.returnPolicyDays),
              weightGrams: Number(form.weightGrams),
              isSponsored: form.isSponsored,
              keywords,
              images: form.images,
              variants: cleanedVariants,
              specifications: cleanedSpecs,
            },
            offer: offerPayload,
          }),
        });
        dispatch(pushToast({ type: 'success', title: 'Product created and saved' }));
      }
      onDirtyChange?.(false);
      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to save product';
      onErrorChange?.(message);
      dispatch(pushToast({ type: 'error', title: 'Save failed', message }));
    } finally {
      setSubmittingLocal(false);
      onSubmittingChange?.(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin text-[#0D63F3]" />
        <span>Loading product catalog data...</span>
      </div>
    );
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs items-start">
      {/* Left 8 Cols: Media, Core Details, Variants, Specifications */}
      <div className="lg:col-span-8 space-y-5">
        <FormSection
          title="Product Media Gallery"
          description="Upload up to 8 photos. Reorder thumbnails freely; the first photo is the main storefront image."
          icon={<ImageIcon className="w-4 h-4" />}
        >
          <MultiMediaUploader
            folder="products"
            images={form.images}
            onChange={(nextImages) => {
              setForm((prev) => ({ ...prev, images: nextImages }));
              markDirty();
            }}
          />
        </FormSection>

        <FormSection
          title="Basic Information & SEO"
          description="Core product copy, bilingual title, warranty, and search discovery tags."
          icon={<FileText className="w-4 h-4" />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormField label="Product Title" htmlFor={titleId} required>
              <input
                id={titleId}
                required
                minLength={3}
                value={form.title}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, title: e.target.value }));
                  markDirty();
                }}
                placeholder="e.g. Anker Soundcore Liberty 4 NC"
                className={ADMIN_INPUT_CLASS}
              />
            </FormField>

            <FormField label="Bengali Title (বাংলা)" optional>
              <input
                value={form.bnTitle}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, bnTitle: e.target.value }));
                  markDirty();
                }}
                placeholder="বাংলা নাম (ঐচ্ছিক)"
                className={ADMIN_INPUT_CLASS}
              />
            </FormField>
          </div>

          <FormField
            label="URL Slug"
            optional
            hint="Auto-generated cleanly from product title if left blank."
          >
            <input
              value={form.slug}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, slug: e.target.value }));
                markDirty();
              }}
              placeholder="e.g. anker-soundcore-liberty-4-nc"
              className={`${ADMIN_INPUT_COMPACT_CLASS} font-mono-num`}
            />
          </FormField>

          <FormField label="Full Description" htmlFor={descId} required>
            <textarea
              id={descId}
              required
              minLength={10}
              rows={4}
              value={form.description}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, description: e.target.value }));
                markDirty();
              }}
              placeholder="Highlight key product capabilities, in-the-box contents, and authentic warranty details..."
              className={ADMIN_TEXTAREA_CLASS}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Model Name / Code" optional>
              <input
                value={form.modelName}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, modelName: e.target.value }));
                  markDirty();
                }}
                placeholder="e.g. A3947"
                className={ADMIN_INPUT_COMPACT_CLASS}
              />
            </FormField>
            <FormField label="Warranty">
              <input
                value={form.warranty}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, warranty: e.target.value }));
                  markDirty();
                }}
                className={ADMIN_INPUT_COMPACT_CLASS}
              />
            </FormField>
            <FormField label="Weight (grams)">
              <input
                type="number"
                min={1}
                value={form.weightGrams}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, weightGrams: Number(e.target.value) }));
                  markDirty();
                }}
                className={`${ADMIN_INPUT_COMPACT_CLASS} font-mono-num`}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Search Keywords" optional hint="Comma-separated EN/BN tags">
              <input
                value={form.keywordsText}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, keywordsText: e.target.value }));
                  markDirty();
                }}
                placeholder="earbuds, wireless, anc, ইয়ারবাড"
                className={ADMIN_INPUT_COMPACT_CLASS}
              />
            </FormField>
            <FormField label="Product Video URL" optional>
              <input
                value={form.videoUrl}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, videoUrl: e.target.value }));
                  markDirty();
                }}
                placeholder="https://youtube.com/watch?v=..."
                className={ADMIN_INPUT_COMPACT_CLASS}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection
          title="Product Variants & SKUs"
          description="Define SKU codes, color/storage options, and optional swatch thumbnails."
          icon={<Layers className="w-4 h-4" />}
          action={
            <button
              type="button"
              onClick={() => {
                setVariants((prev) => [
                  ...prev,
                  { sku: `NV-${Date.now().toString().slice(-4)}`, label: 'New Variant' },
                ]);
                markDirty();
              }}
              className="inline-flex items-center gap-1 px-3 h-8 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 hover:border-[#0D63F3] hover:text-[#0D63F3] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Variant
            </button>
          }
        >
          <div className="space-y-3">
            {variants.map((v, idx) => {
              const showImgEditor = Boolean(expandedVariantImage[idx]);
              return (
                <div key={idx} className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/70 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        SKU <span className="text-[#EF3E36]">*</span>
                      </label>
                      <input
                        required
                        placeholder="SKU"
                        value={v.sku}
                        onChange={(e) => {
                          const next = [...variants];
                          next[idx] = { ...v, sku: e.target.value };
                          setVariants(next);
                          markDirty();
                        }}
                        className={`${ADMIN_INPUT_COMPACT_CLASS} font-mono-num`}
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Variant Label <span className="text-[#EF3E36]">*</span>
                      </label>
                      <input
                        required
                        placeholder="e.g. Midnight Black"
                        value={v.label}
                        onChange={(e) => {
                          const next = [...variants];
                          next[idx] = { ...v, label: e.target.value };
                          setVariants(next);
                          markDirty();
                        }}
                        className={ADMIN_INPUT_COMPACT_CLASS}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Color
                      </label>
                      <input
                        placeholder="Black"
                        value={v.color || ''}
                        onChange={(e) => {
                          const next = [...variants];
                          next[idx] = { ...v, color: e.target.value };
                          setVariants(next);
                          markDirty();
                        }}
                        className={ADMIN_INPUT_COMPACT_CLASS}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Size / Cap
                      </label>
                      <input
                        placeholder="256GB"
                        value={v.sizeOrStorage || ''}
                        onChange={(e) => {
                          const next = [...variants];
                          next[idx] = { ...v, sizeOrStorage: e.target.value };
                          setVariants(next);
                          markDirty();
                        }}
                        className={ADMIN_INPUT_COMPACT_CLASS}
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      {variants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setVariants(variants.filter((_, i) => i !== idx));
                            markDirty();
                          }}
                          className="w-9 h-9 rounded-xl border border-red-200 bg-white text-[#EF3E36] flex items-center justify-center hover:bg-red-50 transition-colors"
                          aria-label={`Remove variant ${v.label || idx + 1}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Compact Swatch Toggle Bar */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-2">
                      {v.imageUrl && (
                        <img
                          src={v.imageUrl}
                          alt={v.label}
                          className="w-7 h-7 rounded-lg object-cover border border-slate-200 bg-white"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedVariantImage((prev) => ({ ...prev, [idx]: !prev[idx] }))
                        }
                        className="text-[11px] font-bold text-[#0D63F3] hover:underline inline-flex items-center gap-1"
                      >
                        <ImageIcon className="w-3 h-3" />
                        <span>
                          {showImgEditor
                            ? 'Hide Swatch Uploader'
                            : v.imageUrl
                              ? 'Change Variant Swatch'
                              : 'Add Variant Swatch (Optional)'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {showImgEditor && (
                    <div className="max-w-xs pt-1">
                      <SingleMediaUploader
                        folder="products"
                        label="Variant Thumbnail (Optional)"
                        aspectClass="h-24"
                        fit="contain"
                        helperText="Optional swatch photo"
                        value={v.imageUrl || ''}
                        onChange={(url) => {
                          const next = [...variants];
                          next[idx] = { ...v, imageUrl: url };
                          setVariants(next);
                          markDirty();
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </FormSection>

        <FormSection
          title="Technical Specifications"
          description="Structured attribute pairs shown in the product specification table."
          icon={<ListChecks className="w-4 h-4" />}
          action={
            <button
              type="button"
              onClick={() => {
                setSpecs((prev) => [...prev, { key: '', value: '' }]);
                markDirty();
              }}
              className="inline-flex items-center gap-1 px-3 h-8 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 hover:border-[#0D63F3] hover:text-[#0D63F3] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Spec
            </button>
          }
        >
          <div className="space-y-2.5">
            {specs.map((s, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input
                  placeholder="Attribute (e.g. Battery Life)"
                  value={s.key}
                  onChange={(e) => {
                    const next = [...specs];
                    next[idx] = { ...s, key: e.target.value };
                    setSpecs(next);
                    markDirty();
                  }}
                  className={`sm:col-span-5 ${ADMIN_INPUT_COMPACT_CLASS}`}
                />
                <input
                  placeholder="Value (e.g. Up to 36 Hours)"
                  value={s.value}
                  onChange={(e) => {
                    const next = [...specs];
                    next[idx] = { ...s, value: e.target.value };
                    setSpecs(next);
                    markDirty();
                  }}
                  className={`sm:col-span-6 ${ADMIN_INPUT_COMPACT_CLASS}`}
                />
                <div className="sm:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setSpecs(specs.filter((_, i) => i !== idx));
                      markDirty();
                    }}
                    className="w-9 h-9 rounded-xl border border-red-200 bg-white text-[#EF3E36] flex items-center justify-center hover:bg-red-50 transition-colors"
                    aria-label="Remove spec"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </FormSection>
      </div>

      {/* Right 4 Cols: Live Card Preview, Taxonomy, Merchandising Flags, Offer Pricing */}
      <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-1">
        {/* Live Product Listing Preview */}
        <section className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <span className="text-xs font-extrabold text-[#0B1F4B] inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#0D63F3]" />
              Listing Card Preview
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                form.moderationStatus === 'published'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {form.moderationStatus.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200/70">
            <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
              {form.images[0] ? (
                <ImageWithFallback src={form.images[0]} alt={form.title || 'Product preview'} className="w-full h-full object-contain p-1" />
              ) : (
                <Package className="w-6 h-6 text-slate-300" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                {selectedBrandName} · {selectedCatName}
              </p>
              <p className="text-xs font-extrabold text-slate-900 line-clamp-1">
                {form.title.trim() || 'Untitled Marketplace Product'}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-black font-mono-num text-[#0D63F3] tabular-nums">
                  {formatBDT(Number(form.price) || 0)}
                </span>
                {discountPercent > 0 && (
                  <>
                    <span className="text-[11px] text-slate-400 line-through font-mono-num tabular-nums">
                      {formatBDT(Number(form.compareAtPrice) || 0)}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-red-50 text-[#EF3E36] text-[9px] font-extrabold">
                      -{discountPercent}%
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <FormSection title="Taxonomy & Storefront Flags" icon={<Tag className="w-4 h-4" />}>
          <FormField label="Category" htmlFor={categoryId} required>
            <select
              id={categoryId}
              required
              value={form.categoryId}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, categoryId: e.target.value, subCategoryId: '' }));
                markDirty();
              }}
              className={ADMIN_SELECT_CLASS}
            >
              {rootCategories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>

          {subCategories.length > 0 && (
            <FormField label="Subcategory" optional>
              <select
                value={form.subCategoryId}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, subCategoryId: e.target.value }));
                  markDirty();
                }}
                className={ADMIN_SELECT_CLASS}
              >
                <option value="">None (Root Category Only)</option>
                {subCategories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <FormField label="Brand" htmlFor={brandId} required>
            <select
              id={brandId}
              required
              value={form.brandId}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, brandId: e.target.value }));
                markDirty();
              }}
              className={ADMIN_SELECT_CLASS}
            >
              {brands.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </FormField>

          {!isEdit && (
            <FormField label="Seller Store" htmlFor={storeId} required>
              <select
                id={storeId}
                required
                value={form.storeId}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, storeId: e.target.value }));
                  markDirty();
                }}
                className={ADMIN_SELECT_CLASS}
              >
                {stores.map((st) => (
                  <option key={st._id} value={st._id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <FormField label="Moderation Status">
            <select
              value={form.moderationStatus}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, moderationStatus: e.target.value }));
                markDirty();
              }}
              className={ADMIN_SELECT_CLASS}
            >
              <option value="published">Published (Live)</option>
              <option value="pending_review">Pending Review</option>
              <option value="draft">Draft</option>
              <option value="suspended">Suspended</option>
            </select>
          </FormField>

          <div className="pt-1 space-y-2">
            <ToggleSwitchCard
              label="Feature in Trending Products"
              checked={form.isTrending}
              onChange={(val) => {
                setForm((prev) => ({ ...prev, isTrending: val }));
                markDirty();
              }}
            />
            <ToggleSwitchCard
              label="Eligible for Flash Deals"
              checked={form.isFlashSaleCandidate}
              onChange={(val) => {
                setForm((prev) => ({ ...prev, isFlashSaleCandidate: val }));
                markDirty();
              }}
            />
            <ToggleSwitchCard
              label="Sponsored Listing Boost"
              checked={form.isSponsored}
              onChange={(val) => {
                setForm((prev) => ({ ...prev, isSponsored: val }));
                markDirty();
              }}
            />
          </div>
        </FormSection>

        <FormSection title="Primary Offer Pricing & Shipping">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Selling Price (৳)" htmlFor={priceId} required>
              <input
                id={priceId}
                type="number"
                required
                min={1}
                value={form.price}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, price: Number(e.target.value) }));
                  markDirty();
                }}
                className={`${ADMIN_INPUT_CLASS} font-mono-num font-bold`}
              />
            </FormField>
            <FormField label="Compare-At (৳)">
              <input
                type="number"
                min={0}
                value={form.compareAtPrice}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, compareAtPrice: Number(e.target.value) }));
                  markDirty();
                }}
                className={`${ADMIN_INPUT_CLASS} font-mono-num`}
              />
            </FormField>
          </div>

          {discountPercent > 0 && (
            <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-emerald-800">
                Customer saves {formatBDT(form.compareAtPrice - form.price)}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-extrabold tabular-nums">
                -{discountPercent}% OFF
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Stock Qty" htmlFor={stockId} required>
              <input
                id={stockId}
                type="number"
                required
                min={0}
                value={form.stock}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, stock: Number(e.target.value) }));
                  markDirty();
                }}
                className={`${ADMIN_INPUT_CLASS} font-mono-num`}
              />
            </FormField>
            <FormField label="Return Days">
              <input
                type="number"
                min={0}
                max={30}
                value={form.returnPolicyDays}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, returnPolicyDays: Number(e.target.value) }));
                  markDirty();
                }}
                className={`${ADMIN_INPUT_CLASS} font-mono-num`}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <FormField label="ETA">
              <input
                value={form.deliveryEstimateDays}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, deliveryEstimateDays: e.target.value }));
                  markDirty();
                }}
                placeholder="2-4 Days"
                className={ADMIN_INPUT_COMPACT_CLASS}
              />
            </FormField>
            <FormField label="Dhaka (৳)">
              <input
                type="number"
                min={0}
                value={form.shippingFeeDhaka}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, shippingFeeDhaka: Number(e.target.value) }));
                  markDirty();
                }}
                className={`${ADMIN_INPUT_COMPACT_CLASS} font-mono-num`}
              />
            </FormField>
            <FormField label="Nationwide (৳)">
              <input
                type="number"
                min={0}
                value={form.shippingFeeNationwide}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, shippingFeeNationwide: Number(e.target.value) }));
                  markDirty();
                }}
                className={`${ADMIN_INPUT_COMPACT_CLASS} font-mono-num`}
              />
            </FormField>
          </div>
        </FormSection>
      </div>
    </form>
  );
}

interface ProductEditorModalProps {
  open: boolean;
  productId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ProductEditorModal({ open, productId, onClose, onSaved }: ProductEditorModalProps) {
  const isEdit = Boolean(productId);
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Canonical Product' : 'Create Marketplace Product'}
      subtitle="Configure product gallery, category taxonomy, variants, specs, and primary offer pricing."
      badge="Catalog Editor"
      size="2xl"
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      error={error}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="modal-product-editor-form"
            disabled={isSubmitting}
            className="px-5 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isEdit ? 'Save Product Changes' : 'Publish Product'}</span>
          </button>
        </>
      }
    >
      {open && (
        <ProductEditorContent
          productId={productId}
          formId="modal-product-editor-form"
          onDirtyChange={setIsDirty}
          onSubmittingChange={setIsSubmitting}
          onErrorChange={setError}
          onSaved={() => {
            onSaved();
            onClose();
          }}
        />
      )}
    </AdminDialog>
  );
}
