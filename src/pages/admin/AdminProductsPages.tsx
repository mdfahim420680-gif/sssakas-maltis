import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  ArrowLeft,
  Award,
  Edit3,
  Eye,
  Image as ImageIcon,
  Layers,
  Loader2,
  Palette,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { apiRequest, formatBDT } from '../../lib/api';
import { pushToast } from '../../store/uiSlice';
import { RootState } from '../../store';
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
  ToggleSwitchCard,
} from '../../components/admin/AdminDialog';
import { SingleMediaUploader } from '../../components/admin/MediaUploader';
import { ProductEditorContent } from '../../components/admin/ProductEditorModal';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';

interface CategoryDoc {
  _id: string;
  name: string;
  bnName?: string;
  slug: string;
  parentId?: string | null;
  description?: string;
  iconName?: string;
  imageUrl?: string;
  accentBg?: string;
  displayOrder: number;
  active: boolean;
  isFeatured: boolean;
  productCount?: number;
}

interface BrandDoc {
  _id: string;
  name: string;
  slug: string;
  logoText?: string;
  logoUrl?: string;
  displayOrder: number;
  active: boolean;
  isPopular: boolean;
  productCount?: number;
}

const CATEGORY_ICON_OPTIONS = [
  'Laptop',
  'Smartphone',
  'Monitor',
  'Shirt',
  'Sparkles',
  'Heart',
  'Home',
  'ShoppingBasket',
  'Trophy',
  'BookOpen',
  'Gamepad2',
  'Package',
];

const ACCENT_BG_PRESETS = ['#EFF6FF', '#F0FDF4', '#FEF3C7', '#FAF5FF', '#FFF1F2', '#ECFEFF'];

export function AdminCategoriesPage() {
  const dispatch = useDispatch();
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'featured'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    bnName: '',
    slug: '',
    parentId: '',
    description: '',
    iconName: 'Package',
    imageUrl: '',
    accentBg: '#EFF6FF',
    displayOrder: 0,
    isFeatured: true,
    active: true,
  });

  const [deleteCat, setDeleteCat] = useState<CategoryDoc | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    apiRequest<{ categories: CategoryDoc[] }>('/api/admin/catalog/categories')
      .then((res) => setCategories(res.categories || []))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unable to fetch categories';
        dispatch(pushToast({ type: 'error', title: 'Failed to load categories', message }));
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormError(null);
    setDirty(false);
    setForm({
      name: '',
      bnName: '',
      slug: '',
      parentId: '',
      description: '',
      iconName: 'Package',
      imageUrl: '',
      accentBg: '#EFF6FF',
      displayOrder: categories.length + 1,
      isFeatured: true,
      active: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (c: CategoryDoc) => {
    setEditingId(c._id);
    setFormError(null);
    setDirty(false);
    setForm({
      name: c.name,
      bnName: c.bnName || '',
      slug: c.slug || '',
      parentId: c.parentId ? String(c.parentId) : '',
      description: c.description || '',
      iconName: c.iconName || 'Package',
      imageUrl: c.imageUrl || '',
      accentBg: c.accentBg || '#EFF6FF',
      displayOrder: c.displayOrder ?? 0,
      isFeatured: Boolean(c.isFeatured),
      active: Boolean(c.active),
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (form.name.trim().length < 2) {
      setFormError('Category name must be at least 2 characters.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name.trim(),
        bnName: form.bnName.trim() || form.name.trim(),
        slug: form.slug.trim() || undefined,
        parentId: form.parentId ? form.parentId : null,
        description: form.description.trim(),
        iconName: form.iconName || 'Package',
        imageUrl: form.imageUrl.trim(),
        accentBg: form.accentBg || '#EFF6FF',
        displayOrder: Number(form.displayOrder || 0),
        isFeatured: form.isFeatured,
        active: form.active,
      };
      if (editingId) {
        await apiRequest(`/api/admin/catalog/categories/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        dispatch(pushToast({ type: 'success', title: 'Category updated' }));
      } else {
        await apiRequest('/api/admin/catalog/categories', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        dispatch(pushToast({ type: 'success', title: 'Category created' }));
      }
      setDirty(false);
      setModalOpen(false);
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: CategoryDoc) => {
    try {
      await apiRequest(`/api/admin/catalog/categories/${c._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !c.active }),
      });
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed';
      dispatch(pushToast({ type: 'error', title: 'Status update failed', message }));
    }
  };

  const confirmDelete = async () => {
    if (!deleteCat || deleting) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/admin/catalog/categories/${deleteCat._id}`, { method: 'DELETE' });
      dispatch(pushToast({ type: 'info', title: 'Category deleted' }));
      setDeleteCat(null);
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Cannot delete category';
      dispatch(pushToast({ type: 'error', title: 'Delete blocked', message }));
    } finally {
      setDeleting(false);
    }
  };

  const categoryMap = new Map(categories.map((c) => [String(c._id), c.name]));
  const parentOptions = categories.filter((c) => String(c._id) !== String(editingId || ''));
  const filteredCategories = categories.filter((c) => {
    if (statusFilter === 'active' && !c.active) return false;
    if (statusFilter === 'inactive' && c.active) return false;
    if (statusFilter === 'featured' && !c.isFeatured) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.bnName || '').toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q)
    );
  });

  const previewAccent = /^#[0-9a-fA-F]{3,8}$/.test(form.accentBg) ? form.accentBg : '#EFF6FF';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold text-[#0B1F4B]">
              Marketplace Categories ({filteredCategories.length})
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Organize canonical product taxonomy, parent/child hierarchy, and homepage category cards
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search categories..."
                className={`${ADMIN_INPUT_COMPACT_CLASS} pl-8 w-48`}
              />
            </div>
            <select
              aria-label="Filter categories by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className={`${ADMIN_SELECT_COMPACT_CLASS} w-36`}
            >
              <option value="all">All Categories</option>
              <option value="active">Active Only</option>
              <option value="featured">Featured Only</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Category</span>
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-xs text-slate-500 py-4">Loading categories...</p>
        ) : filteredCategories.length === 0 ? (
          <div className="py-10 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 space-y-2">
            <Layers className="w-7 h-7 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No matching categories found</p>
            <p className="text-[11px] text-slate-500">Adjust your search filter or create a new category.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 pr-3">Category</th>
                  <th className="py-2.5 pr-3">Hierarchy / Slug</th>
                  <th className="py-2.5 pr-3">Products</th>
                  <th className="py-2.5 pr-3">Order</th>
                  <th className="py-2.5 pr-3">Status</th>
                  <th className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCategories.map((c) => {
                  const parentName = c.parentId ? categoryMap.get(String(c.parentId)) : null;
                  return (
                    <tr key={c._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl border border-slate-200/80 overflow-hidden shrink-0 flex items-center justify-center"
                            style={{ backgroundColor: c.accentBg || '#EFF6FF' }}
                          >
                            {c.imageUrl ? (
                              <ImageWithFallback src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] font-extrabold text-[#0D63F3]">
                                {c.name.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-slate-900">{c.name}</p>
                              {c.isFeatured && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[#0D63F3] text-[9px] font-bold uppercase tracking-wide">
                                  Featured
                                </span>
                              )}
                            </div>
                            {c.bnName && <p className="text-[11px] text-slate-500">{c.bnName}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-mono-num text-slate-700">{c.slug}</p>
                        {parentName && <p className="text-[10px] text-slate-500">Child of: {parentName}</p>}
                      </td>
                      <td className="py-3 pr-3 font-bold tabular-nums text-slate-800">{c.productCount ?? 0}</td>
                      <td className="py-3 pr-3 tabular-nums text-slate-600">{c.displayOrder}</td>
                      <td className="py-3 pr-3">
                        <button
                          type="button"
                          onClick={() => toggleActive(c)}
                          className={`px-2.5 py-1 rounded-full font-bold text-[10px] transition-colors ${
                            c.active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {c.active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(c)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-[#0D63F3] hover:text-[#0D63F3] hover:bg-blue-50/40 transition-colors"
                            aria-label={`Edit category ${c.name}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteCat(c)}
                            className="p-1.5 rounded-lg border border-red-200 text-[#EF3E36] hover:bg-red-50 transition-colors"
                            aria-label={`Delete category ${c.name}`}
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
        )}
      </div>

      <AdminDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? `Edit Category: ${form.name}` : 'Create Category'}
        subtitle="Configure taxonomy hierarchy, bilingual naming, storefront icon, and thumbnail tile."
        badge="Taxonomy"
        size="xl"
        isDirty={dirty}
        isSubmitting={saving}
        error={formError}
        footer={
          <>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              disabled={saving}
              className="px-4 h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="category-editor-form"
              disabled={saving}
              className="px-5 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-60"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{editingId ? 'Save Category' : 'Create Category'}</span>
            </button>
          </>
        }
      >
        <form id="category-editor-form" onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          <div className="lg:col-span-7 space-y-4">
            <FormSection
              title="Taxonomy & Localization"
              description="Canonical naming, URL routing, and parent category assignment."
              icon={<Layers className="w-3.5 h-3.5" />}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <FormField label="Category Name" htmlFor="cat-name" required>
                  <input
                    id="cat-name"
                    required
                    minLength={2}
                    value={form.name}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, name: e.target.value }));
                      setDirty(true);
                    }}
                    placeholder="e.g. Audio & Headphones"
                    className={ADMIN_INPUT_CLASS}
                  />
                </FormField>
                <FormField label="Bengali Name (বাংলা নাম)" htmlFor="cat-bn" optional>
                  <input
                    id="cat-bn"
                    value={form.bnName}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, bnName: e.target.value }));
                      setDirty(true);
                    }}
                    placeholder="অডিও ও হেডফোন"
                    className={ADMIN_INPUT_CLASS}
                  />
                </FormField>
                <FormField label="URL Slug" htmlFor="cat-slug" optional hint="Leave blank to auto-generate">
                  <input
                    id="cat-slug"
                    value={form.slug}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, slug: e.target.value }));
                      setDirty(true);
                    }}
                    placeholder="audio-headphones"
                    className={`${ADMIN_INPUT_CLASS} font-mono-num`}
                  />
                </FormField>
                <FormField label="Parent Category" htmlFor="cat-parent" optional>
                  <select
                    id="cat-parent"
                    value={form.parentId}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, parentId: e.target.value }));
                      setDirty(true);
                    }}
                    className={ADMIN_SELECT_CLASS}
                  >
                    <option value="">Top-Level (Root)</option>
                    {parentOptions.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Sidebar Icon" htmlFor="cat-icon">
                  <select
                    id="cat-icon"
                    value={form.iconName}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, iconName: e.target.value }));
                      setDirty(true);
                    }}
                    className={ADMIN_SELECT_CLASS}
                  >
                    {CATEGORY_ICON_OPTIONS.map((icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Sort Order" htmlFor="cat-order" hint="Lower numbers appear earlier">
                  <input
                    id="cat-order"
                    type="number"
                    min={0}
                    max={1000}
                    value={form.displayOrder}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, displayOrder: Number(e.target.value) }));
                      setDirty(true);
                    }}
                    className={`${ADMIN_INPUT_CLASS} tabular-nums`}
                  />
                </FormField>
              </div>

              <FormField label="Description" htmlFor="cat-desc" optional>
                <textarea
                  id="cat-desc"
                  rows={2}
                  value={form.description}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, description: e.target.value }));
                    setDirty(true);
                  }}
                  placeholder="Short description shown in category metadata..."
                  className={ADMIN_TEXTAREA_CLASS}
                />
              </FormField>
            </FormSection>

            <FormSection
              title="Storefront Visibility"
              description="Control homepage promotion and catalog status."
              icon={<Sparkles className="w-3.5 h-3.5" />}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ToggleSwitchCard
                  label="Featured on Homepage"
                  description="Highlight inside Shop by Category grid"
                  checked={form.isFeatured}
                  onChange={(checked) => {
                    setForm((prev) => ({ ...prev, isFeatured: checked }));
                    setDirty(true);
                  }}
                />
                <ToggleSwitchCard
                  label="Category Active"
                  description="Visible to customers & sellers"
                  checked={form.active}
                  onChange={(checked) => {
                    setForm((prev) => ({ ...prev, active: checked }));
                    setDirty(true);
                  }}
                />
              </div>
            </FormSection>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <FormSection
              title="Visual Identity & Tile Preview"
              description="Preview how this category renders in the storefront grid."
              icon={<Palette className="w-3.5 h-3.5" />}
            >
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 flex items-center justify-center">
                <div className="w-40 rounded-2xl border border-slate-200/90 bg-white p-3 text-center shadow-2xs space-y-2">
                  <div
                    className="w-20 h-20 mx-auto rounded-2xl overflow-hidden flex items-center justify-center border border-black/5"
                    style={{ backgroundColor: previewAccent }}
                  >
                    {form.imageUrl ? (
                      <ImageWithFallback
                        src={form.imageUrl}
                        alt={form.name || 'Category preview'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-base font-black text-[#0D63F3]">
                        {(form.name || 'CT').slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-[#0B1F4B] truncate">
                      {form.name.trim() || 'Category Name'}
                    </p>
                    {form.bnName.trim() && (
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{form.bnName}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    {form.isFeatured && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[#0D63F3] text-[9px] font-bold uppercase">
                        Featured
                      </span>
                    )}
                    {!form.active && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[9px] font-bold uppercase">
                        Paused
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <SingleMediaUploader
                folder="categories"
                label="Category Thumbnail Image (Optional)"
                aspectClass="h-36"
                helperText="JPG, PNG, WebP, or AVIF up to 5MB"
                value={form.imageUrl}
                onChange={(url) => {
                  setForm((prev) => ({ ...prev, imageUrl: url }));
                  setDirty(true);
                }}
              />

              <FormField label="Tile Accent Background">
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {ACCENT_BG_PRESETS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, accentBg: hex }));
                        setDirty(true);
                      }}
                      aria-label={`Select accent color ${hex}`}
                      className={`w-7 h-7 rounded-lg border transition-all ${
                        form.accentBg === hex
                          ? 'border-[#0D63F3] ring-2 ring-[#0D63F3]/25 scale-105'
                          : 'border-slate-300 hover:border-slate-400'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(form.accentBg) ? form.accentBg : '#EFF6FF'}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, accentBg: e.target.value }));
                      setDirty(true);
                    }}
                    aria-label="Custom category accent color"
                    className="w-8 h-7 rounded-lg border border-slate-200 cursor-pointer bg-white"
                  />
                  <span className="text-[11px] font-mono-num text-slate-500 ml-1">{previewAccent}</span>
                </div>
              </FormField>
            </FormSection>
          </div>
        </form>
      </AdminDialog>

      <ConfirmDialog
        open={Boolean(deleteCat)}
        onClose={() => setDeleteCat(null)}
        onConfirm={confirmDelete}
        title="Delete Category?"
        description={`Remove "${deleteCat?.name || ''}"? Categories with assigned products or child subcategories cannot be deleted until reassigned.`}
        confirmLabel="Delete Category"
        loading={deleting}
      />
    </div>
  );
}

export function AdminBrandsPage() {
  const dispatch = useDispatch();
  const [brands, setBrands] = useState<BrandDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'popular'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    logoText: '',
    logoUrl: '',
    displayOrder: 0,
    isPopular: true,
    active: true,
  });

  const [deleteBrand, setDeleteBrand] = useState<BrandDoc | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    apiRequest<{ brands: BrandDoc[] }>('/api/admin/catalog/brands')
      .then((res) => setBrands(res.brands || []))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unable to fetch brands';
        dispatch(pushToast({ type: 'error', title: 'Failed to load brands', message }));
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormError(null);
    setDirty(false);
    setForm({
      name: '',
      slug: '',
      logoText: '',
      logoUrl: '',
      displayOrder: brands.length + 1,
      isPopular: true,
      active: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (b: BrandDoc) => {
    setEditingId(b._id);
    setFormError(null);
    setDirty(false);
    setForm({
      name: b.name,
      slug: b.slug || '',
      logoText: b.logoText || '',
      logoUrl: b.logoUrl || '',
      displayOrder: b.displayOrder ?? 0,
      isPopular: Boolean(b.isPopular),
      active: Boolean(b.active),
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (form.name.trim().length < 2) {
      setFormError('Brand name must be at least 2 characters.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        logoText: form.logoText.trim() || form.name.trim(),
        logoUrl: form.logoUrl.trim(),
        displayOrder: Number(form.displayOrder || 0),
        isPopular: form.isPopular,
        active: form.active,
      };
      if (editingId) {
        await apiRequest(`/api/admin/catalog/brands/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        dispatch(pushToast({ type: 'success', title: 'Brand updated' }));
      } else {
        await apiRequest('/api/admin/catalog/brands', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        dispatch(pushToast({ type: 'success', title: 'Brand created' }));
      }
      setDirty(false);
      setModalOpen(false);
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (b: BrandDoc) => {
    try {
      await apiRequest(`/api/admin/catalog/brands/${b._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !b.active }),
      });
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed';
      dispatch(pushToast({ type: 'error', title: 'Status update failed', message }));
    }
  };

  const confirmDelete = async () => {
    if (!deleteBrand || deleting) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/admin/catalog/brands/${deleteBrand._id}`, { method: 'DELETE' });
      dispatch(pushToast({ type: 'info', title: 'Brand deleted' }));
      setDeleteBrand(null);
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Cannot delete brand';
      dispatch(pushToast({ type: 'error', title: 'Delete blocked', message }));
    } finally {
      setDeleting(false);
    }
  };

  const filteredBrands = brands.filter((b) => {
    if (statusFilter === 'active' && !b.active) return false;
    if (statusFilter === 'inactive' && b.active) return false;
    if (statusFilter === 'popular' && !b.isPopular) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    return b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold text-[#0B1F4B]">
              Marketplace Brands ({filteredBrands.length})
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage official brands, uploaded brand logos, and popular storefront showcases
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search brands..."
                className={`${ADMIN_INPUT_COMPACT_CLASS} pl-8 w-48`}
              />
            </div>
            <select
              aria-label="Filter brands by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className={`${ADMIN_SELECT_COMPACT_CLASS} w-36`}
            >
              <option value="all">All Brands</option>
              <option value="active">Active Only</option>
              <option value="popular">Popular Only</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Brand</span>
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-xs text-slate-500 py-4">Loading brands...</p>
        ) : filteredBrands.length === 0 ? (
          <div className="py-10 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 space-y-2">
            <Award className="w-7 h-7 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No matching brands found</p>
            <p className="text-[11px] text-slate-500">Adjust your filter or register a new brand.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 pr-3">Brand</th>
                  <th className="py-2.5 pr-3">Slug</th>
                  <th className="py-2.5 pr-3">Products</th>
                  <th className="py-2.5 pr-3">Popular</th>
                  <th className="py-2.5 pr-3">Status</th>
                  <th className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBrands.map((b) => (
                  <tr key={b._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {b.logoUrl ? (
                            <ImageWithFallback src={b.logoUrl} alt={b.name} className="w-full h-full object-contain p-1" />
                          ) : (
                            <span className="text-[10px] font-black text-[#0B1F4B]">
                              {(b.logoText || b.name).slice(0, 3).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{b.name}</p>
                          {b.logoText && <p className="text-[11px] text-slate-500">{b.logoText}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 font-mono-num text-slate-600">{b.slug}</td>
                    <td className="py-3 pr-3 font-bold tabular-nums text-slate-800">{b.productCount ?? 0}</td>
                    <td className="py-3 pr-3">
                      {b.isPopular ? (
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-[#0D63F3] text-[10px] font-bold uppercase">
                          Popular
                        </span>
                      ) : (
                        <span className="text-slate-400">Standard</span>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <button
                        type="button"
                        onClick={() => toggleActive(b)}
                        className={`px-2.5 py-1 rounded-full font-bold text-[10px] transition-colors ${
                          b.active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {b.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(b)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-[#0D63F3] hover:text-[#0D63F3] hover:bg-blue-50/40 transition-colors"
                          aria-label={`Edit brand ${b.name}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteBrand(b)}
                          className="p-1.5 rounded-lg border border-red-200 text-[#EF3E36] hover:bg-red-50 transition-colors"
                          aria-label={`Delete brand ${b.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdminDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? `Edit Brand: ${form.name}` : 'Add Official Brand'}
        subtitle="Upload crisp logo artwork and configure storefront brand showcase placement."
        badge="Brand Registry"
        size="lg"
        isDirty={dirty}
        isSubmitting={saving}
        error={formError}
        footer={
          <>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              disabled={saving}
              className="px-4 h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="brand-editor-form"
              disabled={saving}
              className="px-5 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-60"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{editingId ? 'Save Brand' : 'Create Brand'}</span>
            </button>
          </>
        }
      >
        <form id="brand-editor-form" onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          <div className="lg:col-span-7 space-y-4">
            <FormSection
              title="Brand Details"
              description="Official brand title, badge fallback, and catalog routing slug."
              icon={<Award className="w-3.5 h-3.5" />}
            >
              <FormField label="Brand Name" htmlFor="brand-name" required>
                <input
                  id="brand-name"
                  required
                  minLength={2}
                  value={form.name}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, name: e.target.value }));
                    setDirty(true);
                  }}
                  placeholder="e.g. Samsung Bangladesh"
                  className={ADMIN_INPUT_CLASS}
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <FormField label="Display Badge Text" htmlFor="brand-badge" optional hint="Shown if no image logo">
                  <input
                    id="brand-badge"
                    value={form.logoText}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, logoText: e.target.value }));
                      setDirty(true);
                    }}
                    placeholder="e.g. SAMSUNG"
                    className={ADMIN_INPUT_CLASS}
                  />
                </FormField>
                <FormField label="URL Slug" htmlFor="brand-slug" optional hint="Auto-generated if blank">
                  <input
                    id="brand-slug"
                    value={form.slug}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, slug: e.target.value }));
                      setDirty(true);
                    }}
                    placeholder="samsung-bangladesh"
                    className={`${ADMIN_INPUT_CLASS} font-mono-num`}
                  />
                </FormField>
                <FormField label="Sort Order" htmlFor="brand-order">
                  <input
                    id="brand-order"
                    type="number"
                    min={0}
                    max={1000}
                    value={form.displayOrder}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, displayOrder: Number(e.target.value) }));
                      setDirty(true);
                    }}
                    className={`${ADMIN_INPUT_CLASS} tabular-nums`}
                  />
                </FormField>
              </div>
            </FormSection>

            <FormSection
              title="Storefront Visibility"
              description="Control popular brands carousel and active listing status."
              icon={<Sparkles className="w-3.5 h-3.5" />}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ToggleSwitchCard
                  label="Popular Brand"
                  description="Feature on homepage brand strip"
                  checked={form.isPopular}
                  onChange={(checked) => {
                    setForm((prev) => ({ ...prev, isPopular: checked }));
                    setDirty(true);
                  }}
                />
                <ToggleSwitchCard
                  label="Brand Active"
                  description="Available across storefront filters"
                  checked={form.active}
                  onChange={(checked) => {
                    setForm((prev) => ({ ...prev, active: checked }));
                    setDirty(true);
                  }}
                />
              </div>
            </FormSection>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <FormSection
              title="Logo & Storefront Preview"
              description="Transparent PNG, WebP, or crisp SVG logo."
              icon={<ImageIcon className="w-3.5 h-3.5" />}
            >
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 flex items-center justify-center">
                <div className="w-44 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-center shadow-2xs space-y-2">
                  <div className="h-12 flex items-center justify-center">
                    {form.logoUrl ? (
                      <ImageWithFallback
                        src={form.logoUrl}
                        alt={form.name || 'Brand logo'}
                        className="max-h-11 max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-sm font-black tracking-tight text-[#0B1F4B]">
                        {(form.logoText || form.name || 'BRAND').toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="pt-1 border-t border-slate-100 flex items-center justify-between gap-1 text-[10px]">
                    <span className="font-bold text-slate-700 truncate">{form.name.trim() || 'Official Brand'}</span>
                    {form.isPopular && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[#0D63F3] font-bold uppercase shrink-0">
                        Popular
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <SingleMediaUploader
                folder="brands"
                label="Brand Logo Image (Optional)"
                aspectClass="h-32"
                fit="contain"
                helperText="Transparent PNG or crisp SVG/WebP logo · Max 5MB"
                value={form.logoUrl}
                onChange={(url) => {
                  setForm((prev) => ({ ...prev, logoUrl: url }));
                  setDirty(true);
                }}
              />
            </FormSection>
          </div>
        </form>
      </AdminDialog>

      <ConfirmDialog
        open={Boolean(deleteBrand)}
        onClose={() => setDeleteBrand(null)}
        onConfirm={confirmDelete}
        title="Delete Brand?"
        description={`Remove "${deleteBrand?.name || ''}"? Brands with assigned products cannot be deleted until reassigned.`}
        confirmLabel="Delete Brand"
        loading={deleting}
      />
    </div>
  );
}

export function AdminProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200/90 px-5 py-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/admin/products"
            className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors shrink-0"
            aria-label="Back to products"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-[#0B1F4B] truncate">
                {isEdit ? 'Edit Canonical Product' : 'Create New Marketplace Product'}
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200/70 text-[#0D63F3] text-[10px] font-bold uppercase tracking-wider shrink-0">
                Catalog
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure catalog metadata, variants, specifications, images, and primary offer pricing
            </p>
          </div>
        </div>
        <button
          type="submit"
          form="standalone-product-editor-form"
          disabled={saving}
          className="px-5 h-10 rounded-xl bg-[#0D63F3] text-white text-xs font-bold hover:bg-[#0A52CC] inline-flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>{saving ? 'Saving...' : isEdit ? 'Save Product Changes' : 'Publish Product'}</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800">
          {error}
        </div>
      )}

      <ProductEditorContent
        productId={id || null}
        formId="standalone-product-editor-form"
        onSubmittingChange={setSaving}
        onErrorChange={setError}
        onSaved={() => navigate('/admin/products')}
      />
    </div>
  );
}

interface CustomerRow {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  ordersCount: number;
  totalSpent: number;
  lastOrderAt?: string | null;
  createdAt: string;
}

export function AdminCustomersPage() {
  const dispatch = useDispatch();
  const currentUser = useSelector((s: RootState) => s.auth.user);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<{ customer: CustomerRow; orders: any[] } | null>(null);

  const load = (query = q) => {
    setLoading(true);
    apiRequest<{ customers: CustomerRow[] }>(`/api/admin/customers?q=${encodeURIComponent(query)}`)
      .then((res) => setCustomers(res.customers || []))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unable to fetch customers';
        dispatch(pushToast({ type: 'error', title: 'Failed to load customers', message }));
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load('');
  }, []);

  const openDetail = async (id: string) => {
    try {
      const res = await apiRequest<{ customer: CustomerRow; orders: any[] }>(`/api/admin/customers/${id}`);
      setDetail({ customer: res.customer, orders: res.orders || [] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed';
      dispatch(pushToast({ type: 'error', title: 'Customer lookup failed', message }));
    }
  };

  const toggleStatus = async (c: CustomerRow) => {
    const next = c.status === 'active' ? 'suspended' : 'active';
    try {
      await apiRequest(`/api/admin/users/${c._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      dispatch(pushToast({ type: 'success', title: `Customer ${next}` }));
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Action failed';
      dispatch(pushToast({ type: 'error', title: 'Update failed', message }));
    }
  };

  const canModifyStatus = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-5 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-[#0B1F4B]">Customers Directory ({customers.length})</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View registered customer accounts, lifetime spend, and order history
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
        <p className="text-xs text-slate-500 py-4">Loading customers...</p>
      ) : customers.length === 0 ? (
        <div className="py-10 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 space-y-2">
          <UserCheck className="w-7 h-7 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-700">No customers matched your search</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pr-3">Customer</th>
                <th className="py-2.5 pr-3">Orders</th>
                <th className="py-2.5 pr-3">Total Spent</th>
                <th className="py-2.5 pr-3">Joined</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c._id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 pr-3">
                    <p className="font-bold text-slate-900">{c.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {c.email} {c.phone ? `· ${c.phone}` : ''}
                    </p>
                  </td>
                  <td className="py-3 pr-3 font-bold tabular-nums">{c.ordersCount}</td>
                  <td className="py-3 pr-3 font-bold text-[#0D63F3] tabular-nums">{formatBDT(c.totalSpent)}</td>
                  <td className="py-3 pr-3 text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 pr-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                        c.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                          : 'bg-red-50 text-[#EF3E36] border border-red-200/70'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openDetail(c._id)}
                        className="px-2.5 h-8 rounded-lg border border-slate-200 text-slate-700 font-bold text-[11px] inline-flex items-center gap-1 hover:border-[#0D63F3] hover:text-[#0D63F3] transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        Orders
                      </button>
                      {canModifyStatus && (
                        <button
                          type="button"
                          onClick={() => toggleStatus(c)}
                          className={`px-2.5 h-8 rounded-lg font-bold text-[11px] transition-colors ${
                            c.status === 'active'
                              ? 'border border-amber-300 text-amber-800 hover:bg-amber-50'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          {c.status === 'active' ? 'Suspend' : 'Activate'}
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

      <AdminDialog
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `Customer: ${detail.customer.name}` : 'Customer Profile'}
        subtitle={
          detail
            ? `${detail.customer.email}${detail.customer.phone ? ` · ${detail.customer.phone}` : ''}`
            : undefined
        }
        badge="Customer Profile"
        size="lg"
        footer={
          <button
            type="button"
            onClick={() => setDetail(null)}
            className="px-4 h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        }
      >
        {detail && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white rounded-xl border border-slate-200/90 p-3.5">
                <p className="text-[11px] font-semibold text-slate-500">Total Orders</p>
                <p className="text-lg font-extrabold text-[#0B1F4B] tabular-nums mt-0.5">
                  {detail.orders.length}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/90 p-3.5">
                <p className="text-[11px] font-semibold text-slate-500">Lifetime Spend</p>
                <p className="text-lg font-extrabold text-[#0D63F3] tabular-nums mt-0.5">
                  {formatBDT(
                    detail.customer.totalSpent ??
                      detail.orders.reduce((acc, o) => acc + Number(o.grandTotal || 0), 0)
                  )}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/90 p-3.5">
                <p className="text-[11px] font-semibold text-slate-500">Account Status</p>
                <span
                  className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    detail.customer.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-red-50 text-[#EF3E36]'
                  }`}
                >
                  {detail.customer.status}
                </span>
              </div>
            </div>

            <FormSection title={`Order History (${detail.orders.length})`}>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {detail.orders.length === 0 ? (
                  <p className="text-slate-500 py-3 text-center">This customer has not placed any orders yet.</p>
                ) : (
                  detail.orders.map((o) => (
                    <div
                      key={o._id}
                      className="p-3 rounded-xl border border-slate-200/90 bg-slate-50/50 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-mono-num font-bold text-[#0B1F4B]">#{o.orderNumber}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {new Date(o.createdAt).toLocaleDateString()} · {String(o.paymentMethod || '').toUpperCase()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-[#0D63F3] tabular-nums">{formatBDT(o.grandTotal)}</p>
                        <p className="text-[10px] uppercase font-bold text-slate-500 mt-0.5">{o.paymentStatus}</p>
                      </div>
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
