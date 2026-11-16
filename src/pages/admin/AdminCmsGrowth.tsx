import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  Calendar,
  Edit3,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  Link2,
  Loader2,
  Megaphone,
  Palette,
  Plus,
  Search,
  Sliders,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { pushToast } from '../../store/uiSlice';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import {
  ADMIN_INPUT_CLASS,
  ADMIN_INPUT_COMPACT_CLASS,
  ADMIN_SELECT_CLASS,
  ADMIN_SELECT_COMPACT_CLASS,
  AdminDialog,
  ConfirmDialog,
  FormField,
  FormSection,
  ToggleSwitchCard,
} from '../../components/admin/AdminDialog';
import { SingleMediaUploader } from '../../components/admin/MediaUploader';
import { HeroSlideModal } from '../../components/admin/HeroSlideModal';
import { BannerStudioModal } from '../../components/admin/BannerStudioModal';
import {
  BannerRecord,
  DEFAULT_HERO_SLIDER_CONFIG,
  HeroSliderConfig,
  buildGradientCss,
  mergeBannerStyleConfig,
} from '../../../shared/bannerStyle';

interface CmsSectionItem {
  _id: string;
  key: string;
  title: string;
  subtitle?: string;
  sectionType: string;
  visible: boolean;
  displayOrder: number;
  config?: Record<string, unknown>;
}

export function AdminCmsPage() {
  const dispatch = useDispatch();
  const [sections, setSections] = useState<CmsSectionItem[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = () => {
    apiRequest<{ sections: CmsSectionItem[] }>('/api/admin/cms')
      .then((res) => setSections(res.sections || []))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Load failed';
        dispatch(pushToast({ type: 'error', title: 'Failed to load CMS sections', message }));
      });
  };
  useEffect(load, []);

  const updateSection = async (sec: CmsSectionItem) => {
    setSavingId(sec._id);
    try {
      await apiRequest(`/api/admin/cms/${sec._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: sec.title,
          subtitle: sec.subtitle,
          visible: sec.visible,
          displayOrder: Number(sec.displayOrder),
          config: sec.config || {},
        }),
      });
      dispatch(pushToast({ type: 'success', title: `Saved "${sec.title}"` }));
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Update failed';
      dispatch(pushToast({ type: 'error', title: 'Update failed', message }));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold text-[#0B1F4B]">Homepage CMS Sections ({sections.length})</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Reorder, rename, toggle visibility, and live-edit public homepage sections without touching code.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3.5">
        {sections.map((sec, idx) => (
          <div
            key={sec._id}
            className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 space-y-4 hover:border-slate-300 transition-colors"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-[10px] font-extrabold uppercase tracking-wider text-[#0D63F3]">
                  {sec.sectionType.replace(/_/g, ' ')}
                </span>
                <span className="text-[11px] font-mono-num text-slate-400">key: {sec.key}</span>
              </div>
              <ToggleSwitchCard
                label="Visible on Homepage"
                checked={sec.visible}
                onChange={(checked) => {
                  const next = [...sections];
                  next[idx] = { ...sec, visible: checked };
                  setSections(next);
                }}
                className="!py-1 !px-2.5"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <FormField label="Section Title" className="sm:col-span-4">
                <input
                  value={sec.title}
                  onChange={(e) => {
                    const next = [...sections];
                    next[idx] = { ...sec, title: e.target.value };
                    setSections(next);
                  }}
                  placeholder="Section Title"
                  className={ADMIN_INPUT_COMPACT_CLASS}
                />
              </FormField>
              <FormField label="Subtitle" optional className="sm:col-span-5">
                <input
                  value={sec.subtitle || ''}
                  onChange={(e) => {
                    const next = [...sections];
                    next[idx] = { ...sec, subtitle: e.target.value };
                    setSections(next);
                  }}
                  placeholder="Subtitle"
                  className={ADMIN_INPUT_COMPACT_CLASS}
                />
              </FormField>
              <FormField label="Order" className="sm:col-span-1">
                <input
                  type="number"
                  value={sec.displayOrder}
                  onChange={(e) => {
                    const next = [...sections];
                    next[idx] = { ...sec, displayOrder: Number(e.target.value) };
                    setSections(next);
                  }}
                  aria-label="Display order"
                  className={`${ADMIN_INPUT_COMPACT_CLASS} font-mono-num`}
                />
              </FormField>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  disabled={savingId === sec._id}
                  onClick={() => updateSection(sections[idx])}
                  className="w-full h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
                >
                  {savingId === sec._id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Section</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const POSITION_LABELS: Record<string, string> = {
  hero_slide: 'Hero Slide',
  promo_trio: 'Promo Trio',
  category_top: 'Category Strip',
  seasonal_strip: 'Seasonal Strip',
};

export function AdminBannersPage() {
  const dispatch = useDispatch();
  const [banners, setBanners] = useState<BannerRecord[]>([]);
  const [sliderConfig, setSliderConfig] = useState<HeroSliderConfig>(DEFAULT_HERO_SLIDER_CONFIG);
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [heroModal, setHeroModal] = useState<{ open: boolean; slide: BannerRecord | null }>({
    open: false,
    slide: null,
  });
  const [studioModal, setStudioModal] = useState<{ open: boolean; banner: BannerRecord | null }>({
    open: false,
    banner: null,
  });
  const [sliderModalOpen, setSliderModalOpen] = useState(false);
  const [savingSlider, setSavingSlider] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<BannerRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    apiRequest<{ banners: BannerRecord[]; sliderSettings?: HeroSliderConfig }>('/api/admin/banners')
      .then((res) => {
        setBanners(res.banners || []);
        if (res.sliderSettings) setSliderConfig(res.sliderSettings);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unable to fetch banners';
        dispatch(pushToast({ type: 'error', title: 'Failed to load banners', message }));
      });
  };
  useEffect(load, []);

  const toggleBanner = async (b: BannerRecord) => {
    try {
      await apiRequest(`/api/admin/banners/${b._id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !b.active }),
      });
      dispatch(pushToast({ type: 'success', title: b.active ? 'Banner paused' : 'Banner activated' }));
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Update failed';
      dispatch(pushToast({ type: 'error', title: 'Update failed', message }));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/admin/banners/${deleteTarget._id}`, { method: 'DELETE' });
      dispatch(pushToast({ type: 'info', title: 'Banner removed' }));
      setDeleteTarget(null);
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      dispatch(pushToast({ type: 'error', title: 'Delete failed', message }));
    } finally {
      setDeleting(false);
    }
  };

  const saveSliderSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSlider(true);
    try {
      const res = await apiRequest<{ sliderSettings: HeroSliderConfig }>('/api/admin/banners/slider-settings', {
        method: 'PUT',
        body: JSON.stringify(sliderConfig),
      });
      if (res.sliderSettings) setSliderConfig(res.sliderSettings);
      dispatch(pushToast({ type: 'success', title: 'Hero slider settings saved' }));
      setSliderModalOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to save slider settings';
      dispatch(pushToast({ type: 'error', title: 'Save failed', message }));
    } finally {
      setSavingSlider(false);
    }
  };

  const normalizedQ = searchQuery.trim().toLowerCase();
  const matchesFilter = (b: BannerRecord) => {
    if (positionFilter !== 'all' && b.position !== positionFilter) return false;
    if (statusFilter === 'active' && !b.active) return false;
    if (statusFilter === 'paused' && b.active) return false;
    if (!normalizedQ) return true;
    return (
      (b.title || '').toLowerCase().includes(normalizedQ) ||
      (b.campaignName || '').toLowerCase().includes(normalizedQ) ||
      (b.highlightText || '').toLowerCase().includes(normalizedQ) ||
      (b.linkUrl || '').toLowerCase().includes(normalizedQ)
    );
  };

  const sortedBanners = [...banners].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const heroSlides = sortedBanners.filter((b) => b.position === 'hero_slide' && matchesFilter(b));
  const dynamicBanners = sortedBanners.filter((b) => b.position !== 'hero_slide' && matchesFilter(b));

  const totalHeroCount = banners.filter((b) => b.position === 'hero_slide').length;
  const activeHeroCount = banners.filter((b) => b.position === 'hero_slide' && b.active).length;
  const totalDynamicCount = banners.filter((b) => b.position !== 'hero_slide').length;
  const activeDynamicCount = banners.filter((b) => b.position !== 'hero_slide' && b.active).length;

  return (
    <div className="space-y-5">
      {/* Header & Summary */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-[#0B1F4B] tracking-tight">
              Hero Sliders &amp; Dynamic Banners
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Curate full-bleed hero slides, slider behavior, and dynamic campaign placements across the storefront.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSliderModalOpen(true)}
              className="px-3.5 h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Sliders className="w-3.5 h-3.5 text-[#0D63F3]" />
              <span>Slider Settings</span>
            </button>
            <button
              type="button"
              onClick={() => setHeroModal({ open: true, slide: null })}
              className="px-3.5 h-9 rounded-xl border border-[#0D63F3]/40 bg-blue-50/70 text-[#0D63F3] hover:bg-blue-100/80 text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Add Hero Slide</span>
            </button>
            <button
              type="button"
              onClick={() => setStudioModal({ open: true, banner: null })}
              className="px-4 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors whitespace-nowrap"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Create Dynamic Banner</span>
            </button>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-[#F4F7FB] border border-slate-200/70 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Hero Carousel Slides</p>
              <p className="text-lg font-extrabold text-[#0B1F4B] tabular-nums mt-0.5">
                {activeHeroCount} <span className="text-xs font-semibold text-slate-500">/ {totalHeroCount} active</span>
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-100/80 text-[#0D63F3] flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F4F7FB] border border-slate-200/70 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Campaign Banners</p>
              <p className="text-lg font-extrabold text-[#0B1F4B] tabular-nums mt-0.5">
                {activeDynamicCount}{' '}
                <span className="text-xs font-semibold text-slate-500">/ {totalDynamicCount} active</span>
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-100/80 text-indigo-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F4F7FB] border border-slate-200/70 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Slider Playback</p>
              <p className="text-xs font-extrabold text-[#0B1F4B] mt-1">
                {sliderConfig.autoplay ? `Autoplay ${sliderConfig.slideDurationMs / 1000}s` : 'Manual Controls'} ·{' '}
                {sliderConfig.transitionType === 'fade' ? 'Cross Fade' : 'Smooth Slide'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSliderModalOpen(true)}
              className="text-[11px] font-bold text-[#0D63F3] hover:underline shrink-0"
            >
              Configure
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
          <div className="flex flex-wrap gap-1.5 text-xs">
            {[
              { id: 'all', label: `All (${banners.length})` },
              { id: 'hero_slide', label: `Hero Slides (${totalHeroCount})` },
              { id: 'promo_trio', label: 'Promo Trio' },
              { id: 'category_top', label: 'Category Strip' },
              { id: 'seasonal_strip', label: 'Seasonal Strip' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPositionFilter(tab.id)}
                className={`px-3 h-8 rounded-xl font-bold transition-colors whitespace-nowrap ${
                  positionFilter === tab.id
                    ? 'bg-[#0D63F3] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, campaign, link..."
                className={`${ADMIN_INPUT_COMPACT_CLASS} pl-8 w-52`}
              />
            </div>
            <select
              aria-label="Filter banners by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'paused')}
              className={`${ADMIN_SELECT_COMPACT_CLASS} w-32`}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="paused">Paused Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Hero Carousel Slides Gallery */}
      {(positionFilter === 'all' || positionFilter === 'hero_slide') && (
        <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-[#0B1F4B]">
                Hero Carousel Slides ({heroSlides.length})
              </h2>
              <p className="text-[11px] text-slate-500">
                Full-bleed 3:1 desktop slides shown inside the primary homepage hero slider.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setHeroModal({ open: true, slide: null })}
              className="px-3 h-8 rounded-xl border border-blue-200 bg-blue-50/70 text-[#0D63F3] hover:bg-blue-100 text-xs font-bold inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              New Hero Slide
            </button>
          </div>

          {heroSlides.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
              No hero slides match your current filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {heroSlides.map((b) => {
                const displayTitle = b.title?.trim() || `Hero Slide #${b.displayOrder}`;
                return (
                  <article
                    key={b._id}
                    className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden flex flex-col hover:border-blue-300/80 hover:shadow-sm transition-all"
                  >
                    <div className="relative aspect-[3/1] bg-slate-100 overflow-hidden border-b border-slate-100">
                      <ImageWithFallback
                        src={b.imageUrl || ''}
                        alt={displayTitle}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-[#071636]/80 backdrop-blur-xs text-white text-[10px] font-mono-num font-bold">
                        Order #{b.displayOrder}
                      </span>
                      <span
                        className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          b.active ? 'bg-emerald-500 text-white' : 'bg-slate-800/75 text-slate-200'
                        }`}
                      >
                        {b.active ? 'Active' : 'Paused'}
                      </span>
                    </div>

                    <div className="p-3.5 flex-1 flex flex-col justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <p className="font-bold text-slate-900 truncate">{displayTitle}</p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                          <Link2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate font-mono-num">
                            {b.linkUrl?.trim() ? b.linkUrl : 'Visual only (no link)'}
                          </span>
                        </p>
                        {(b.startDate || b.endDate) && (
                          <p className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>
                              {b.startDate ? new Date(b.startDate).toLocaleDateString() : 'Now'} –{' '}
                              {b.endDate ? new Date(b.endDate).toLocaleDateString() : 'Ongoing'}
                            </span>
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => toggleBanner(b)}
                          className={`px-2.5 h-7 rounded-lg font-bold text-[11px] transition-colors ${
                            b.active
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {b.active ? 'Pause' : 'Activate'}
                        </button>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setHeroModal({ open: true, slide: b })}
                            className="px-2.5 h-7 rounded-lg border border-slate-200 text-slate-700 hover:border-[#0D63F3] hover:text-[#0D63F3] font-bold text-[11px] inline-flex items-center gap-1 transition-colors"
                            aria-label={`Edit banner ${displayTitle}`}
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete banner ${displayTitle}`}
                            onClick={() => setDeleteTarget(b)}
                            className="w-7 h-7 rounded-lg border border-red-200/80 text-[#EF3E36] hover:bg-red-50 flex items-center justify-center transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Dynamic Campaign Banners Section */}
      {positionFilter !== 'hero_slide' && (
        <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-[#0B1F4B]">
                Campaign &amp; Promotional Banners ({dynamicBanners.length})
              </h2>
              <p className="text-[11px] text-slate-500">
                Promo Trio, Category Top Strip, and Seasonal Full-Width campaigns designed in Banner Studio.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStudioModal({ open: true, banner: null })}
              className="px-3 h-8 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1"
            >
              <Palette className="w-3.5 h-3.5" />
              Open Studio
            </button>
          </div>

          {dynamicBanners.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
              No dynamic campaign banners match your current filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {dynamicBanners.map((b) => {
                const style = mergeBannerStyleConfig(b.gradientTheme, b.styleConfig);
                const displayTitle = b.title?.trim() || 'Untitled Banner';
                const cardBgStyle: React.CSSProperties =
                  style.backgroundMode === 'solid'
                    ? { backgroundColor: style.solidColor }
                    : style.backgroundMode === 'gradient'
                      ? { backgroundImage: buildGradientCss(style) }
                      : { backgroundColor: style.solidColor || '#0B1F4B' };

                return (
                  <article
                    key={b._id}
                    className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden flex flex-col hover:border-blue-300/80 hover:shadow-sm transition-all"
                  >
                    {/* Miniature Live Visual Strip */}
                    <div
                      className="relative min-h-[112px] p-4 flex items-center justify-between gap-3 overflow-hidden"
                      style={cardBgStyle}
                    >
                      {b.imageUrl &&
                        (style.backgroundMode === 'image' ||
                          style.backgroundMode === 'image_overlay' ||
                          style.backgroundMode === 'image_gradient_overlay') && (
                          <img
                            src={b.imageUrl}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        )}
                      {style.overlayMode !== 'none' && (
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundColor: style.overlayColor,
                            opacity: Math.min(0.85, (style.overlayOpacity ?? 45) / 100),
                          }}
                        />
                      )}

                      <div className="relative z-10 min-w-0 space-y-1 max-w-[75%]">
                        {(style.eyebrow || b.highlightText) && (
                          <span
                            className="inline-block text-[10px] font-extrabold uppercase tracking-wider truncate max-w-full"
                            style={{ color: style.highlightColor }}
                          >
                            {style.eyebrow || b.highlightText}
                          </span>
                        )}
                        <h3 className="text-sm font-black leading-snug line-clamp-1" style={{ color: style.textColor }}>
                          {displayTitle}
                        </h3>
                        {b.subtitle && (
                          <p className="text-[11px] line-clamp-1 opacity-90" style={{ color: style.subtitleColor }}>
                            {b.subtitle}
                          </p>
                        )}
                      </div>

                      {b.ctaText && (
                        <span
                          className="relative z-10 px-2.5 py-1 rounded-lg text-[10px] font-extrabold shrink-0 shadow-xs"
                          style={{
                            backgroundColor: style.ctaBgColor,
                            color: style.ctaTextColor,
                          }}
                        >
                          {b.ctaText}
                        </span>
                      )}
                    </div>

                    {/* Metadata & Actions */}
                    <div className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs bg-white border-t border-slate-100">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#0D63F3] text-[10px] font-extrabold uppercase tracking-wider">
                            {POSITION_LABELS[b.position] || b.position.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[11px] font-mono-num text-slate-500">Order #{b.displayOrder}</span>
                          {b.campaignName && (
                            <span className="text-[11px] font-semibold text-slate-600 truncate">· {b.campaignName}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono-num truncate">
                          {b.linkUrl?.trim() ? b.linkUrl : 'No destination link'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleBanner(b)}
                          className={`px-2.5 h-8 rounded-xl font-bold text-[11px] transition-colors ${
                            b.active
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {b.active ? 'Active' : 'Paused'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setStudioModal({ open: true, banner: b })}
                          className="px-3 h-8 rounded-xl border border-slate-200 text-slate-700 hover:border-[#0D63F3] hover:text-[#0D63F3] font-bold text-[11px] inline-flex items-center gap-1 transition-colors"
                          aria-label={`Edit banner ${displayTitle}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete banner ${displayTitle}`}
                          onClick={() => setDeleteTarget(b)}
                          className="w-8 h-8 rounded-xl border border-red-200/80 text-[#EF3E36] hover:bg-red-50 flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Simplified Hero Slide Modal */}
      <HeroSlideModal
        open={heroModal.open}
        slide={heroModal.slide}
        nextOrder={totalHeroCount + 1}
        onClose={() => setHeroModal({ open: false, slide: null })}
        onSaved={load}
      />

      {/* Full Dynamic Banner Studio Modal */}
      <BannerStudioModal
        open={studioModal.open}
        banner={studioModal.banner}
        nextOrder={banners.length + 1}
        onClose={() => setStudioModal({ open: false, banner: null })}
        onSaved={load}
      />

      {/* Hero Slider Carousel Behavior Modal */}
      <AdminDialog
        open={sliderModalOpen}
        onClose={() => setSliderModalOpen(false)}
        title="Hero Slider Behavior Settings"
        subtitle="Configure autoplay interval, transition style, loop, arrows, and indicator dots on the homepage hero."
        badge="Carousel"
        size="md"
        isSubmitting={savingSlider}
        footer={
          <>
            <button
              type="button"
              onClick={() => setSliderModalOpen(false)}
              className="px-4 h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="slider-settings-form"
              disabled={savingSlider}
              className="px-5 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              {savingSlider && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Slider Settings</span>
            </button>
          </>
        }
      >
        <form id="slider-settings-form" onSubmit={saveSliderSettings} className="space-y-4 text-xs">
          <FormSection title="Timing & Transition" icon={<Sliders className="w-4 h-4" />}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Transition Style">
                <select
                  value={sliderConfig.transitionType}
                  onChange={(e) =>
                    setSliderConfig((prev) => ({
                      ...prev,
                      transitionType: e.target.value === 'fade' ? 'fade' : 'slide',
                    }))
                  }
                  className={ADMIN_SELECT_CLASS}
                >
                  <option value="slide">Smooth Slide</option>
                  <option value="fade">Cross Fade</option>
                </select>
              </FormField>
              <FormField label="Slide Interval (ms)">
                <input
                  type="number"
                  min={2000}
                  max={15000}
                  step={500}
                  value={sliderConfig.slideDurationMs}
                  onChange={(e) =>
                    setSliderConfig((prev) => ({ ...prev, slideDurationMs: Number(e.target.value) }))
                  }
                  className={`${ADMIN_INPUT_CLASS} font-mono-num`}
                />
              </FormField>
              <FormField label="Transition Speed (ms)">
                <input
                  type="number"
                  min={200}
                  max={1500}
                  step={50}
                  value={sliderConfig.transitionDurationMs}
                  onChange={(e) =>
                    setSliderConfig((prev) => ({ ...prev, transitionDurationMs: Number(e.target.value) }))
                  }
                  className={`${ADMIN_INPUT_CLASS} font-mono-num`}
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Playback & Navigation Controls">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(
                [
                  { key: 'autoplay', label: 'Enable Autoplay' },
                  { key: 'pauseOnHover', label: 'Pause on Hover' },
                  { key: 'loop', label: 'Loop Infinitely' },
                  { key: 'showDots', label: 'Show Indicator Dots' },
                  { key: 'showArrows', label: 'Show Prev/Next Arrows' },
                ] as const
              ).map((opt) => (
                <ToggleSwitchCard
                  key={opt.key}
                  label={opt.label}
                  checked={sliderConfig[opt.key]}
                  onChange={(val) =>
                    setSliderConfig((prev) => ({ ...prev, [opt.key]: val }))
                  }
                />
              ))}
            </div>
          </FormSection>
        </form>
      </AdminDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Banner?"
        description="This banner will be permanently removed from all storefront placements."
        confirmLabel="Delete Banner"
        loading={deleting}
      />
    </div>
  );
}

interface AdDoc {
  _id: string;
  name: string;
  campaign: string;
  adType: 'internal_banner' | 'sponsored_product' | 'sponsored_store';
  placement: string;
  mediaUrl?: string;
  destinationLink: string;
  targetProductId?: string;
  targetStoreId?: string;
  priority: number;
  startAt?: string;
  endAt?: string;
  active: boolean;
  impressions?: number;
  clicks?: number;
}

interface ProductOption {
  _id: string;
  title: string;
  slug: string;
}

interface StoreOption {
  _id: string;
  name: string;
  slug: string;
}

export function AdminAdsPage() {
  const dispatch = useDispatch();
  const [ads, setAds] = useState<AdDoc[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    campaign: 'Q4 Bangladesh Marketplace',
    adType: 'internal_banner' as AdDoc['adType'],
    placement: 'homepage_section',
    mediaUrl: '',
    destinationLink: '/category/electronics',
    targetProductId: '',
    targetStoreId: '',
    priority: 10,
    startAt: '',
    endAt: '',
    active: true,
  });

  const [deleteAd, setDeleteAd] = useState<AdDoc | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    apiRequest<{ ads: AdDoc[] }>('/api/admin/ads')
      .then((res) => setAds(res.ads || []))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Load failed';
        dispatch(pushToast({ type: 'error', title: 'Failed to load ads', message }));
      });
  };

  useEffect(() => {
    load();
    Promise.all([
      apiRequest<{ products: ProductOption[] }>('/api/admin/catalog/products').catch(() => ({ products: [] })),
      apiRequest<{ stores: StoreOption[] }>('/api/catalog/stores').catch(() => ({ stores: [] })),
    ]).then(([pRes, sRes]) => {
      setProducts(pRes.products || []);
      setStores(sRes.stores || []);
    });
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormError(null);
    setDirty(false);
    setForm({
      name: '',
      campaign: 'Q4 Bangladesh Marketplace',
      adType: 'internal_banner',
      placement: 'homepage_section',
      mediaUrl: '',
      destinationLink: '/category/electronics',
      targetProductId: '',
      targetStoreId: '',
      priority: 10,
      startAt: '',
      endAt: '',
      active: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (ad: AdDoc) => {
    setEditingId(ad._id);
    setFormError(null);
    setDirty(false);
    setForm({
      name: ad.name || '',
      campaign: ad.campaign || '',
      adType: ad.adType || 'internal_banner',
      placement: ad.placement || 'homepage_section',
      mediaUrl: ad.mediaUrl || '',
      destinationLink: ad.destinationLink || '',
      targetProductId: ad.targetProductId || '',
      targetStoreId: ad.targetStoreId || '',
      priority: ad.priority ?? 1,
      startAt: ad.startAt ? String(ad.startAt).slice(0, 10) : '',
      endAt: ad.endAt ? String(ad.endAt).slice(0, 10) : '',
      active: Boolean(ad.active),
    });
    setModalOpen(true);
  };

  const saveAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (form.startAt && form.endAt && form.endAt < form.startAt) {
      setFormError('End date cannot be earlier than start date.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name.trim(),
        campaign: form.campaign.trim(),
        adType: form.adType,
        placement: form.placement,
        mediaUrl: form.mediaUrl.trim(),
        destinationLink: form.destinationLink.trim(),
        targetProductId: form.adType === 'sponsored_product' ? form.targetProductId || null : null,
        targetStoreId: form.adType === 'sponsored_store' ? form.targetStoreId || null : null,
        priority: Number(form.priority || 1),
        startAt: form.startAt || null,
        endAt: form.endAt || null,
        active: form.active,
      };
      if (editingId) {
        await apiRequest(`/api/admin/ads/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        dispatch(pushToast({ type: 'success', title: 'Ad campaign updated' }));
      } else {
        await apiRequest('/api/admin/ads', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        dispatch(pushToast({ type: 'success', title: 'Advertisement campaign launched' }));
      }
      setDirty(false);
      setModalOpen(false);
      load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleAd = async (ad: AdDoc) => {
    try {
      await apiRequest(`/api/admin/ads/${ad._id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !ad.active }),
      });
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Update failed';
      dispatch(pushToast({ type: 'error', title: 'Update failed', message }));
    }
  };

  const confirmDeleteAd = async () => {
    if (!deleteAd) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/admin/ads/${deleteAd._id}`, { method: 'DELETE' });
      dispatch(pushToast({ type: 'info', title: 'Advertisement deleted' }));
      setDeleteAd(null);
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      dispatch(pushToast({ type: 'error', title: 'Delete failed', message }));
    } finally {
      setDeleting(false);
    }
  };

  const filteredAds = ads.filter((ad) => {
    if (statusFilter === 'active' && !ad.active) return false;
    if (statusFilter === 'paused' && ad.active) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      ad.name.toLowerCase().includes(q) ||
      ad.campaign.toLowerCase().includes(q) ||
      ad.placement.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold text-[#0B1F4B]">
              Advertisement &amp; Sponsored Placements ({filteredAds.length})
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Launch sponsored product slots, store spotlights, and internal banner placements with CTR tracking.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Ad Campaign</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, campaign, placement..."
              className={`${ADMIN_INPUT_COMPACT_CLASS} pl-8`}
            />
          </div>
          <select
            aria-label="Filter ads by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'paused')}
            className={`${ADMIN_SELECT_COMPACT_CLASS} w-36`}
          >
            <option value="all">All Campaigns</option>
            <option value="active">Active Only</option>
            <option value="paused">Paused Only</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 pr-3">Creative &amp; Campaign</th>
                <th className="py-2.5 pr-3">Placement</th>
                <th className="py-2.5 pr-3">Impressions</th>
                <th className="py-2.5 pr-3">Clicks / CTR</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAds.map((ad) => {
                const imps = ad.impressions ?? 0;
                const clicks = ad.clicks ?? 0;
                const ctr = imps > 0 ? ((clicks / imps) * 100).toFixed(1) : '0.0';
                return (
                  <tr key={ad._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-10 rounded-xl bg-slate-100 border border-slate-200/80 overflow-hidden shrink-0">
                          <ImageWithFallback src={ad.mediaUrl || ''} alt={ad.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{ad.name}</p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {ad.campaign} · <span className="capitalize">{ad.adType.replace(/_/g, ' ')}</span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 capitalize font-semibold text-slate-700">
                      {ad.placement.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 pr-3 tabular-nums font-bold text-slate-800">{imps.toLocaleString()}</td>
                    <td className="py-3 pr-3 tabular-nums">
                      <span className="font-bold text-slate-900">{clicks.toLocaleString()}</span>
                      <span className="ml-1.5 text-[10px] font-semibold text-slate-500">({ctr}%)</span>
                    </td>
                    <td className="py-3 pr-3">
                      <button
                        type="button"
                        onClick={() => toggleAd(ad)}
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] transition-colors ${
                          ad.active
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {ad.active ? 'Active' : 'Paused'}
                      </button>
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(ad)}
                          className="px-2.5 h-7 rounded-lg border border-slate-200 text-slate-700 hover:border-[#0D63F3] hover:text-[#0D63F3] font-bold text-[11px] inline-flex items-center gap-1 transition-colors"
                          aria-label={`Edit ad ${ad.name}`}
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteAd(ad)}
                          className="w-7 h-7 rounded-lg border border-red-200 text-[#EF3E36] hover:bg-red-50 inline-flex items-center justify-center transition-colors"
                          aria-label={`Delete ad ${ad.name}`}
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

      <AdminDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? `Edit Ad Campaign: ${form.name}` : 'Create Advertisement Campaign'}
        subtitle="Upload creative media and target a storefront placement, product, or seller store."
        badge="Growth & Ads"
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
              className="px-4 h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="ad-campaign-form"
              disabled={saving}
              className="px-5 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs disabled:opacity-60"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{editingId ? 'Save Ad Campaign' : 'Launch Ad Campaign'}</span>
            </button>
          </>
        }
      >
        <form id="ad-campaign-form" onSubmit={saveAd} className="space-y-4 text-xs">
          <FormSection title="Ad Creative" icon={<ImageIcon className="w-4 h-4" />}>
            <SingleMediaUploader
              folder="ads"
              label="Ad Creative Image"
              aspectClass="h-44"
              helperText="Recommended landscape or square creative matching your placement · Max 5MB"
              value={form.mediaUrl}
              onChange={(url) => {
                setForm((prev) => ({ ...prev, mediaUrl: url }));
                setDirty(true);
              }}
            />
          </FormSection>

          <FormSection title="Campaign & Targeting" icon={<Megaphone className="w-4 h-4" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <FormField label="Placement Title" required>
                <input
                  required
                  value={form.name}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, name: e.target.value }));
                    setDirty(true);
                  }}
                  placeholder="e.g. Anker Audio Spotlight"
                  className={ADMIN_INPUT_CLASS}
                />
              </FormField>
              <FormField label="Campaign Name" required>
                <input
                  required
                  value={form.campaign}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, campaign: e.target.value }));
                    setDirty(true);
                  }}
                  className={ADMIN_INPUT_CLASS}
                />
              </FormField>
              <FormField label="Ad Type">
                <select
                  value={form.adType}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, adType: e.target.value as AdDoc['adType'] }));
                    setDirty(true);
                  }}
                  className={ADMIN_SELECT_CLASS}
                >
                  <option value="internal_banner">Internal Banner</option>
                  <option value="sponsored_product">Sponsored Product</option>
                  <option value="sponsored_store">Sponsored Store</option>
                </select>
              </FormField>
              <FormField label="Placement Slot">
                <select
                  value={form.placement}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, placement: e.target.value }));
                    setDirty(true);
                  }}
                  className={ADMIN_SELECT_CLASS}
                >
                  <option value="homepage_banner">Homepage Banner</option>
                  <option value="homepage_section">Homepage Section</option>
                  <option value="category_page">Category Page</option>
                  <option value="search_results">Search Results</option>
                  <option value="product_listing">Product Listing</option>
                  <option value="seller_storefront">Seller Storefront</option>
                </select>
              </FormField>
            </div>

            {form.adType === 'sponsored_product' && products.length > 0 && (
              <FormField label="Target Product" hint="Selecting a product auto-fills the destination URL">
                <select
                  value={form.targetProductId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    const chosen = products.find((p) => p._id === pid);
                    setForm((prev) => ({
                      ...prev,
                      targetProductId: pid,
                      destinationLink: chosen ? `/product/${chosen.slug}` : prev.destinationLink,
                    }));
                    setDirty(true);
                  }}
                  className={ADMIN_SELECT_CLASS}
                >
                  <option value="">Select Product...</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            {form.adType === 'sponsored_store' && stores.length > 0 && (
              <FormField label="Target Store" hint="Selecting a store auto-fills the destination URL">
                <select
                  value={form.targetStoreId}
                  onChange={(e) => {
                    const sid = e.target.value;
                    const chosen = stores.find((s) => s._id === sid);
                    setForm((prev) => ({
                      ...prev,
                      targetStoreId: sid,
                      destinationLink: chosen ? `/shop/${chosen.slug}` : prev.destinationLink,
                    }));
                    setDirty(true);
                  }}
                  className={ADMIN_SELECT_CLASS}
                >
                  <option value="">Select Store...</option>
                  {stores.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              <FormField label="Destination Link" required className="sm:col-span-9">
                <div className="relative">
                  <ExternalLink className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    required
                    value={form.destinationLink}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, destinationLink: e.target.value }));
                      setDirty(true);
                    }}
                    className={`${ADMIN_INPUT_CLASS} pl-9`}
                  />
                </div>
              </FormField>
              <FormField label="Priority" className="sm:col-span-3">
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={form.priority}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, priority: Number(e.target.value) }));
                    setDirty(true);
                  }}
                  className={`${ADMIN_INPUT_CLASS} font-mono-num`}
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Schedule & Activation" icon={<Calendar className="w-4 h-4" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <FormField label="Start Date" optional>
                <input
                  type="date"
                  value={form.startAt}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, startAt: e.target.value }));
                    setDirty(true);
                  }}
                  className={ADMIN_INPUT_CLASS}
                />
              </FormField>
              <FormField label="End Date" optional>
                <input
                  type="date"
                  value={form.endAt}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, endAt: e.target.value }));
                    setDirty(true);
                  }}
                  className={ADMIN_INPUT_CLASS}
                />
              </FormField>
            </div>
            <ToggleSwitchCard
              label="Campaign Active"
              description="Serve this advertisement immediately inside eligible storefront slots."
              checked={form.active}
              onChange={(checked) => {
                setForm((prev) => ({ ...prev, active: checked }));
                setDirty(true);
              }}
            />
          </FormSection>
        </form>
      </AdminDialog>

      <ConfirmDialog
        open={Boolean(deleteAd)}
        onClose={() => setDeleteAd(null)}
        onConfirm={confirmDeleteAd}
        title="Delete Advertisement?"
        description={`Permanently remove "${deleteAd?.name || ''}" from the marketplace?`}
        confirmLabel="Delete Ad"
        loading={deleting}
      />
    </div>
  );
}

interface CouponDoc {
  _id: string;
  code: string;
  title: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  usageLimit: number;
  usedCount: number;
  startAt: string;
  endAt: string;
  active: boolean;
}

interface PromotionDoc {
  _id: string;
  name: string;
  type: 'flash_sale' | 'seasonal_campaign' | 'category_campaign';
  discountBadgeText: string;
  startAt: string;
  endAt: string;
  productIds: Array<{ _id: string; title: string } | string>;
  active: boolean;
}

export function AdminPromotionsPage() {
  const dispatch = useDispatch();
  const [promotions, setPromotions] = useState<PromotionDoc[]>([]);
  const [coupons, setCoupons] = useState<CouponDoc[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<ProductOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [couponDirty, setCouponDirty] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    title: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 10,
    minOrderAmount: 500,
    maxDiscountAmount: 500,
    usageLimit: 100,
    startAt: '',
    endAt: '',
    active: true,
  });

  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [savingPromo, setSavingPromo] = useState(false);
  const [promoDirty, setPromoDirty] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [prodQuery, setProdQuery] = useState('');
  const [promoForm, setPromoForm] = useState({
    name: '',
    type: 'flash_sale' as PromotionDoc['type'],
    discountBadgeText: 'Up to 40% OFF',
    startAt: '',
    endAt: '',
    productIds: [] as string[],
    active: true,
  });

  const [deleteCoupon, setDeleteCoupon] = useState<CouponDoc | null>(null);
  const [deletePromo, setDeletePromo] = useState<PromotionDoc | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    apiRequest<{ promotions: PromotionDoc[]; coupons: CouponDoc[] }>('/api/admin/promotions')
      .then((res) => {
        setPromotions(res.promotions || []);
        setCoupons(res.coupons || []);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Load failed';
        dispatch(pushToast({ type: 'error', title: 'Failed to load promotions', message }));
      });
  };

  useEffect(() => {
    load();
    apiRequest<{ products: ProductOption[] }>('/api/admin/catalog/products')
      .then((res) => setCatalogProducts(res.products || []))
      .catch(() => {});
  }, []);

  const openCreateCoupon = () => {
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    setEditingCouponId(null);
    setCouponError(null);
    setCouponDirty(false);
    setCouponForm({
      code: '',
      title: '',
      discountType: 'percentage',
      discountValue: 10,
      minOrderAmount: 500,
      maxDiscountAmount: 500,
      usageLimit: 100,
      startAt: now.toISOString().slice(0, 10),
      endAt: end.toISOString().slice(0, 10),
      active: true,
    });
    setCouponModalOpen(true);
  };

  const openEditCoupon = (c: CouponDoc) => {
    setEditingCouponId(c._id);
    setCouponError(null);
    setCouponDirty(false);
    setCouponForm({
      code: c.code,
      title: c.title,
      discountType: c.discountType,
      discountValue: c.discountValue,
      minOrderAmount: c.minOrderAmount,
      maxDiscountAmount: c.maxDiscountAmount ?? 0,
      usageLimit: c.usageLimit,
      startAt: c.startAt ? String(c.startAt).slice(0, 10) : '',
      endAt: c.endAt ? String(c.endAt).slice(0, 10) : '',
      active: Boolean(c.active),
    });
    setCouponModalOpen(true);
  };

  const saveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingCoupon) return;
    if (!couponForm.startAt || !couponForm.endAt) {
      setCouponError('Both start date and end date are required.');
      return;
    }
    if (couponForm.endAt < couponForm.startAt) {
      setCouponError('End date cannot be earlier than start date.');
      return;
    }

    setSavingCoupon(true);
    setCouponError(null);
    try {
      if (editingCouponId) {
        await apiRequest(`/api/admin/coupons/${editingCouponId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: couponForm.title.trim(),
            discountType: couponForm.discountType,
            discountValue: Number(couponForm.discountValue),
            minOrderAmount: Number(couponForm.minOrderAmount),
            maxDiscountAmount: Number(couponForm.maxDiscountAmount),
            usageLimit: Number(couponForm.usageLimit),
            startAt: couponForm.startAt ? new Date(couponForm.startAt) : undefined,
            endAt: couponForm.endAt ? new Date(couponForm.endAt) : undefined,
            active: couponForm.active,
          }),
        });
        dispatch(pushToast({ type: 'success', title: 'Coupon updated' }));
      } else {
        await apiRequest('/api/admin/coupons', {
          method: 'POST',
          body: JSON.stringify({
            code: couponForm.code.trim().toUpperCase(),
            title: couponForm.title.trim(),
            discountType: couponForm.discountType,
            discountValue: Number(couponForm.discountValue),
            minOrderAmount: Number(couponForm.minOrderAmount),
            maxDiscountAmount: Number(couponForm.maxDiscountAmount),
            usageLimit: Number(couponForm.usageLimit),
            startAt: couponForm.startAt ? new Date(couponForm.startAt) : new Date(),
            endAt: couponForm.endAt ? new Date(couponForm.endAt) : new Date(Date.now() + 30 * 86400000),
            active: couponForm.active,
          }),
        });
        dispatch(pushToast({ type: 'success', title: `Coupon ${couponForm.code.toUpperCase()} created` }));
      }
      setCouponDirty(false);
      setCouponModalOpen(false);
      load();
    } catch (err: unknown) {
      setCouponError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingCoupon(false);
    }
  };

  const toggleCoupon = async (c: CouponDoc) => {
    try {
      await apiRequest(`/api/admin/coupons/${c._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !c.active }),
      });
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Update failed';
      dispatch(pushToast({ type: 'error', title: 'Update failed', message }));
    }
  };

  const confirmDeleteCoupon = async () => {
    if (!deleteCoupon) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/admin/coupons/${deleteCoupon._id}`, { method: 'DELETE' });
      dispatch(pushToast({ type: 'info', title: 'Coupon deleted' }));
      setDeleteCoupon(null);
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Delete blocked';
      dispatch(pushToast({ type: 'error', title: 'Delete blocked', message }));
    } finally {
      setDeleting(false);
    }
  };

  const openCreatePromo = () => {
    const now = new Date();
    const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    setEditingPromoId(null);
    setPromoError(null);
    setPromoDirty(false);
    setProdQuery('');
    setPromoForm({
      name: '',
      type: 'flash_sale',
      discountBadgeText: 'Up to 40% OFF',
      startAt: now.toISOString().slice(0, 10),
      endAt: end.toISOString().slice(0, 10),
      productIds: [],
      active: true,
    });
    setPromoModalOpen(true);
  };

  const openEditPromo = (pr: PromotionDoc) => {
    setEditingPromoId(pr._id);
    setPromoError(null);
    setPromoDirty(false);
    setProdQuery('');
    setPromoForm({
      name: pr.name,
      type: pr.type,
      discountBadgeText: pr.discountBadgeText || '',
      startAt: pr.startAt ? String(pr.startAt).slice(0, 10) : '',
      endAt: pr.endAt ? String(pr.endAt).slice(0, 10) : '',
      productIds: (pr.productIds || []).map((p) => (typeof p === 'string' ? p : p._id)),
      active: Boolean(pr.active),
    });
    setPromoModalOpen(true);
  };

  const savePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingPromo) return;
    if (!promoForm.startAt || !promoForm.endAt) {
      setPromoError('Both start date and end date are required.');
      return;
    }
    if (promoForm.endAt < promoForm.startAt) {
      setPromoError('End date cannot be earlier than start date.');
      return;
    }

    setSavingPromo(true);
    setPromoError(null);
    try {
      const payload = {
        name: promoForm.name.trim(),
        type: promoForm.type,
        discountBadgeText: promoForm.discountBadgeText.trim(),
        startAt: promoForm.startAt ? new Date(promoForm.startAt) : new Date(),
        endAt: promoForm.endAt ? new Date(promoForm.endAt) : new Date(Date.now() + 14 * 86400000),
        productIds: promoForm.productIds,
        active: promoForm.active,
      };
      if (editingPromoId) {
        await apiRequest(`/api/admin/promotions/${editingPromoId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        dispatch(pushToast({ type: 'success', title: 'Promotion updated' }));
      } else {
        await apiRequest('/api/admin/promotions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        dispatch(pushToast({ type: 'success', title: 'Promotion campaign created' }));
      }
      setPromoDirty(false);
      setPromoModalOpen(false);
      load();
    } catch (err: unknown) {
      setPromoError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingPromo(false);
    }
  };

  const togglePromotion = async (pr: PromotionDoc) => {
    try {
      await apiRequest(`/api/admin/promotions/${pr._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !pr.active }),
      });
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Update failed';
      dispatch(pushToast({ type: 'error', title: 'Update failed', message }));
    }
  };

  const confirmDeletePromo = async () => {
    if (!deletePromo) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/admin/promotions/${deletePromo._id}`, { method: 'DELETE' });
      dispatch(pushToast({ type: 'info', title: 'Promotion deleted' }));
      setDeletePromo(null);
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      dispatch(pushToast({ type: 'error', title: 'Delete failed', message }));
    } finally {
      setDeleting(false);
    }
  };

  const filteredProducts = catalogProducts.filter((p) => {
    if (!prodQuery.trim()) return true;
    return p.title.toLowerCase().includes(prodQuery.trim().toLowerCase());
  });

  const normalizedQ = searchQuery.trim().toLowerCase();
  const filteredCoupons = coupons.filter(
    (c) =>
      !normalizedQ ||
      c.code.toLowerCase().includes(normalizedQ) ||
      c.title.toLowerCase().includes(normalizedQ)
  );
  const filteredPromotions = promotions.filter(
    (pr) =>
      !normalizedQ ||
      pr.name.toLowerCase().includes(normalizedQ) ||
      (pr.discountBadgeText || '').toLowerCase().includes(normalizedQ)
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-extrabold text-[#0B1F4B]">Marketplace Coupons &amp; Flash Sales</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure promo codes, flash deal countdown events, and participating marketplace products.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search codes or events..."
              className={`${ADMIN_INPUT_COMPACT_CLASS} pl-8 w-48`}
            />
          </div>
          <button
            type="button"
            onClick={openCreateCoupon}
            className="px-3.5 h-9 rounded-xl border border-[#0D63F3]/40 bg-blue-50/70 text-[#0D63F3] hover:bg-blue-100 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Coupon</span>
          </button>
          <button
            type="button"
            onClick={openCreatePromo}
            className="px-4 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Launch Promotion</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-3.5">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <h2 className="text-sm sm:text-base font-extrabold text-[#0B1F4B]">
              Marketplace Coupons ({filteredCoupons.length})
            </h2>
            <span className="text-[11px] font-semibold text-slate-500">
              {coupons.filter((c) => c.active).length} active
            </span>
          </div>
          <div className="space-y-2.5">
            {filteredCoupons.map((c) => (
              <div
                key={c._id}
                className="p-3.5 rounded-xl border border-slate-200/90 hover:border-blue-200 flex items-center justify-between gap-3 text-xs transition-colors"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 font-mono-num font-black text-[#0D63F3]">
                      {c.code}
                    </span>
                    <span className="font-bold text-slate-900 truncate">{c.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 tabular-nums">
                    {c.discountType === 'percentage' ? `${c.discountValue}%` : `৳${c.discountValue}`} off · Min ৳
                    {c.minOrderAmount} · Used {c.usedCount}/{c.usageLimit}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditCoupon(c)}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:border-[#0D63F3] hover:text-[#0D63F3]"
                    aria-label={`Edit coupon ${c.code}`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCoupon(c)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                      c.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {c.active ? 'Active' : 'Disabled'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteCoupon(c)}
                    className="p-1.5 rounded-lg border border-red-200/80 text-[#EF3E36] hover:bg-red-50"
                    aria-label={`Delete coupon ${c.code}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-3.5">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <h2 className="text-sm sm:text-base font-extrabold text-[#0B1F4B]">
              Promotions &amp; Flash Events ({filteredPromotions.length})
            </h2>
            <span className="text-[11px] font-semibold text-slate-500">
              {promotions.filter((p) => p.active).length} active
            </span>
          </div>
          <div className="space-y-2.5">
            {filteredPromotions.map((pr) => (
              <div
                key={pr._id}
                className="p-3.5 rounded-xl border border-slate-200/90 hover:border-blue-200 text-xs space-y-1.5 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-900 truncate">{pr.name}</span>
                    {pr.discountBadgeText && (
                      <span className="px-2 py-0.5 rounded-md bg-red-50 border border-red-100 text-[#EF3E36] font-extrabold text-[10px]">
                        {pr.discountBadgeText}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditPromo(pr)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:border-[#0D63F3] hover:text-[#0D63F3]"
                      aria-label={`Edit promotion ${pr.name}`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePromotion(pr)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                        pr.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {pr.active ? 'Active' : 'Paused'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletePromo(pr)}
                      className="p-1.5 rounded-lg border border-red-200/80 text-[#EF3E36] hover:bg-red-50"
                      aria-label={`Delete promotion ${pr.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  <span className="capitalize font-semibold text-slate-700">{pr.type.replace(/_/g, ' ')}</span> · Ends{' '}
                  {new Date(pr.endAt).toLocaleDateString()} · {pr.productIds?.length || 0} linked products
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create / Edit Coupon Modal */}
      <AdminDialog
        open={couponModalOpen}
        onClose={() => setCouponModalOpen(false)}
        title={editingCouponId ? `Edit Coupon: ${couponForm.code}` : 'Create Marketplace Coupon'}
        subtitle="Define promo code rules, discount caps, minimum spend, and validity window."
        badge="Coupon"
        size="md"
        isDirty={couponDirty}
        isSubmitting={savingCoupon}
        error={couponError}
        footer={
          <>
            <button
              type="button"
              onClick={() => setCouponModalOpen(false)}
              disabled={savingCoupon}
              className="px-4 h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="coupon-editor-form"
              disabled={savingCoupon}
              className="px-5 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs disabled:opacity-60"
            >
              {savingCoupon && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{editingCouponId ? 'Save Coupon' : 'Create Coupon'}</span>
            </button>
          </>
        }
      >
        <form id="coupon-editor-form" onSubmit={saveCoupon} className="space-y-4 text-xs">
          {/* Coupon Preview Banner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#071636] to-[#0D63F3] text-white flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200">Voucher Preview</p>
              <p className="text-sm font-black truncate mt-0.5">
                {couponForm.title.trim() || 'NOVARA Marketplace Discount'}
              </p>
              <p className="text-[11px] text-blue-100 mt-0.5 tabular-nums">
                {couponForm.discountType === 'percentage'
                  ? `${couponForm.discountValue || 0}% OFF${
                      couponForm.maxDiscountAmount > 0 ? ` (up to ৳${couponForm.maxDiscountAmount})` : ''
                    }`
                  : `৳${couponForm.discountValue || 0} OFF`}{' '}
                · Min spend ৳{couponForm.minOrderAmount || 0}
              </p>
            </div>
            <span className="px-3 py-1.5 rounded-xl bg-white/15 border border-white/25 font-mono-num font-black text-xs tracking-wider shrink-0">
              {couponForm.code.trim() || 'CODE'}
            </span>
          </div>

          <FormSection title="Code & Discount Rules" icon={<Tag className="w-4 h-4" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <FormField label="Coupon Code" required hint={editingCouponId ? 'Code cannot be renamed' : 'Uppercase letters & numbers'}>
                <input
                  required
                  disabled={Boolean(editingCouponId)}
                  value={couponForm.code}
                  onChange={(e) => {
                    setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() });
                    setCouponDirty(true);
                  }}
                  placeholder="EID500"
                  className={`${ADMIN_INPUT_CLASS} uppercase font-mono-num font-bold`}
                />
              </FormField>
              <FormField label="Campaign Title" required>
                <input
                  required
                  value={couponForm.title}
                  onChange={(e) => {
                    setCouponForm({ ...couponForm, title: e.target.value });
                    setCouponDirty(true);
                  }}
                  placeholder="Eid Shopping Voucher"
                  className={ADMIN_INPUT_CLASS}
                />
              </FormField>
              <FormField label="Discount Type">
                <select
                  value={couponForm.discountType}
                  onChange={(e) => {
                    setCouponForm({ ...couponForm, discountType: e.target.value as 'percentage' | 'fixed' });
                    setCouponDirty(true);
                  }}
                  className={ADMIN_SELECT_CLASS}
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (৳)</option>
                </select>
              </FormField>
              <FormField label={couponForm.discountType === 'percentage' ? 'Discount (%)' : 'Discount (৳)'} required>
                <input
                  type="number"
                  min={1}
                  required
                  value={couponForm.discountValue}
                  onChange={(e) => {
                    setCouponForm({ ...couponForm, discountValue: Number(e.target.value) });
                    setCouponDirty(true);
                  }}
                  className={`${ADMIN_INPUT_CLASS} font-mono-num`}
                />
              </FormField>
              <FormField label="Min Order Amount (৳)">
                <input
                  type="number"
                  min={0}
                  value={couponForm.minOrderAmount}
                  onChange={(e) => {
                    setCouponForm({ ...couponForm, minOrderAmount: Number(e.target.value) });
                    setCouponDirty(true);
                  }}
                  className={`${ADMIN_INPUT_CLASS} font-mono-num`}
                />
              </FormField>
              <FormField label="Max Discount Cap (৳)" optional>
                <input
                  type="number"
                  min={0}
                  value={couponForm.maxDiscountAmount}
                  onChange={(e) => {
                    setCouponForm({ ...couponForm, maxDiscountAmount: Number(e.target.value) });
                    setCouponDirty(true);
                  }}
                  className={`${ADMIN_INPUT_CLASS} font-mono-num`}
                />
              </FormField>
              <FormField label="Total Usage Limit" required>
                <input
                  type="number"
                  min={1}
                  required
                  value={couponForm.usageLimit}
                  onChange={(e) => {
                    setCouponForm({ ...couponForm, usageLimit: Number(e.target.value) });
                    setCouponDirty(true);
                  }}
                  className={`${ADMIN_INPUT_CLASS} font-mono-num`}
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Validity Window & Activation" icon={<Calendar className="w-4 h-4" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <FormField label="Start Date" required>
                <input
                  type="date"
                  required
                  value={couponForm.startAt}
                  onChange={(e) => {
                    setCouponForm({ ...couponForm, startAt: e.target.value });
                    setCouponDirty(true);
                  }}
                  className={ADMIN_INPUT_CLASS}
                />
              </FormField>
              <FormField label="End Date" required>
                <input
                  type="date"
                  required
                  value={couponForm.endAt}
                  onChange={(e) => {
                    setCouponForm({ ...couponForm, endAt: e.target.value });
                    setCouponDirty(true);
                  }}
                  className={ADMIN_INPUT_CLASS}
                />
              </FormField>
            </div>
            <ToggleSwitchCard
              label="Coupon Active at Checkout"
              description="Allow eligible customers to redeem this code immediately."
              checked={couponForm.active}
              onChange={(checked) => {
                setCouponForm({ ...couponForm, active: checked });
                setCouponDirty(true);
              }}
            />
          </FormSection>
        </form>
      </AdminDialog>

      {/* Create / Edit Promotion Modal */}
      <AdminDialog
        open={promoModalOpen}
        onClose={() => setPromoModalOpen(false)}
        title={editingPromoId ? `Edit Promotion: ${promoForm.name}` : 'Launch Promotion / Flash Sale'}
        subtitle="Schedule flash deals or seasonal campaigns and attach participating marketplace products."
        badge="Promotions"
        size="lg"
        isDirty={promoDirty}
        isSubmitting={savingPromo}
        error={promoError}
        footer={
          <>
            <button
              type="button"
              onClick={() => setPromoModalOpen(false)}
              disabled={savingPromo}
              className="px-4 h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="promo-editor-form"
              disabled={savingPromo}
              className="px-5 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs disabled:opacity-60"
            >
              {savingPromo && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{editingPromoId ? 'Save Promotion' : 'Launch Promotion'}</span>
            </button>
          </>
        }
      >
        <form id="promo-editor-form" onSubmit={savePromo} className="space-y-4 text-xs">
          <FormSection title="Campaign Details & Schedule" icon={<Sparkles className="w-4 h-4" />}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <FormField label="Event Name" required>
                <input
                  required
                  value={promoForm.name}
                  onChange={(e) => {
                    setPromoForm({ ...promoForm, name: e.target.value });
                    setPromoDirty(true);
                  }}
                  placeholder="e.g. Boishakh Flash"
                  className={ADMIN_INPUT_CLASS}
                />
              </FormField>
              <FormField label="Campaign Type">
                <select
                  value={promoForm.type}
                  onChange={(e) => {
                    setPromoForm({ ...promoForm, type: e.target.value as PromotionDoc['type'] });
                    setPromoDirty(true);
                  }}
                  className={ADMIN_SELECT_CLASS}
                >
                  <option value="flash_sale">Flash Sale</option>
                  <option value="seasonal_campaign">Seasonal Campaign</option>
                  <option value="category_campaign">Category Campaign</option>
                </select>
              </FormField>
              <FormField label="Badge Text">
                <input
                  value={promoForm.discountBadgeText}
                  onChange={(e) => {
                    setPromoForm({ ...promoForm, discountBadgeText: e.target.value });
                    setPromoDirty(true);
                  }}
                  placeholder="Up to 40% OFF"
                  className={ADMIN_INPUT_CLASS}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <FormField label="Start Date" required>
                <input
                  type="date"
                  required
                  value={promoForm.startAt}
                  onChange={(e) => {
                    setPromoForm({ ...promoForm, startAt: e.target.value });
                    setPromoDirty(true);
                  }}
                  className={ADMIN_INPUT_CLASS}
                />
              </FormField>
              <FormField label="End Date" required>
                <input
                  type="date"
                  required
                  value={promoForm.endAt}
                  onChange={(e) => {
                    setPromoForm({ ...promoForm, endAt: e.target.value });
                    setPromoDirty(true);
                  }}
                  className={ADMIN_INPUT_CLASS}
                />
              </FormField>
            </div>

            <ToggleSwitchCard
              label="Campaign Active"
              description="Feature this event badge and countdown on participating products."
              checked={promoForm.active}
              onChange={(checked) => {
                setPromoForm({ ...promoForm, active: checked });
                setPromoDirty(true);
              }}
            />
          </FormSection>

          <FormSection
            title={`Participating Products (${promoForm.productIds.length} selected)`}
            icon={<Layers className="w-4 h-4" />}
            action={
              <div className="flex items-center gap-2">
                {filteredProducts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const visibleIds = filteredProducts.map((p) => p._id);
                      const merged = Array.from(new Set([...promoForm.productIds, ...visibleIds]));
                      setPromoForm((prev) => ({ ...prev, productIds: merged }));
                      setPromoDirty(true);
                    }}
                    className="text-[11px] font-bold text-[#0D63F3] hover:underline"
                  >
                    Select Visible
                  </button>
                )}
                {promoForm.productIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPromoForm((prev) => ({ ...prev, productIds: [] }));
                      setPromoDirty(true);
                    }}
                    className="text-[11px] font-bold text-slate-500 hover:text-[#EF3E36]"
                  >
                    Clear All
                  </button>
                )}
              </div>
            }
          >
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                value={prodQuery}
                onChange={(e) => setProdQuery(e.target.value)}
                placeholder="Filter marketplace products..."
                className={`${ADMIN_INPUT_COMPACT_CLASS} pl-8`}
              />
            </div>

            <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-slate-50/40">
              {filteredProducts.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No matching products found.</p>
              ) : (
                filteredProducts.map((p) => {
                  const checked = promoForm.productIds.includes(p._id);
                  return (
                    <label
                      key={p._id}
                      className={`flex items-center justify-between gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                        checked ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setPromoForm((prev) => ({
                              ...prev,
                              productIds: e.target.checked
                                ? [...prev.productIds, p._id]
                                : prev.productIds.filter((id) => id !== p._id),
                            }));
                            setPromoDirty(true);
                          }}
                          className="w-3.5 h-3.5 accent-[#0D63F3] shrink-0"
                        />
                        <span className="font-semibold text-slate-800 truncate">{p.title}</span>
                      </span>
                      {checked && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-[#0D63F3] text-[9px] font-extrabold uppercase shrink-0">
                          Included
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </FormSection>
        </form>
      </AdminDialog>

      <ConfirmDialog
        open={Boolean(deleteCoupon)}
        onClose={() => setDeleteCoupon(null)}
        onConfirm={confirmDeleteCoupon}
        title="Delete Coupon?"
        description={`Delete coupon ${deleteCoupon?.code || ''}? Redeemed coupons cannot be deleted and should be disabled instead.`}
        confirmLabel="Delete Coupon"
        loading={deleting}
      />

      <ConfirmDialog
        open={Boolean(deletePromo)}
        onClose={() => setDeletePromo(null)}
        onConfirm={confirmDeletePromo}
        title="Delete Promotion?"
        description={`Remove promotional event "${deletePromo?.name || ''}"?`}
        confirmLabel="Delete Promotion"
        loading={deleting}
      />
    </div>
  );
}
