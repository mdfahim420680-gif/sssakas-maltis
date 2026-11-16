import React, { useEffect, useId, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Calendar,
  Layers,
  Loader2,
  Monitor,
  Palette,
  Plus,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Type,
} from 'lucide-react';
import {
  ADMIN_INPUT_COMPACT_CLASS,
  ADMIN_SELECT_COMPACT_CLASS,
  AdminDialog,
  FormField,
  FormSection,
  ToggleSwitchCard,
} from './AdminDialog';
import { SingleMediaUploader } from './MediaUploader';
import { DynamicBannerRenderer } from '../ui/DynamicBannerRenderer';
import {
  BANNER_THEME_PRESETS,
  BannerAlignH,
  BannerAlignV,
  BannerContentWidth,
  BannerCtaRadius,
  BannerCtaSize,
  BannerForegroundSize,
  BannerGradientType,
  BannerHeadingSize,
  BannerHeadingWeight,
  BannerHeightPreset,
  BannerHoverEffect,
  BannerImageRepeat,
  BannerImageSize,
  BannerLineHeight,
  BannerOverlayMode,
  BannerPaddingPreset,
  BannerPosition,
  BannerRecord,
  BannerShadowPreset,
  BannerStyleConfig,
  BannerWidthMode,
  createDefaultBannerStyleConfig,
  mergeBannerStyleConfig,
} from '../../../shared/bannerStyle';
import { apiRequest } from '../../lib/api';
import { pushToast } from '../../store/uiSlice';

interface BannerStudioModalProps {
  open: boolean;
  onClose: () => void;
  banner: BannerRecord | null;
  defaultPosition?: Exclude<BannerPosition, 'hero_slide'>;
  nextOrder?: number;
  onSaved: () => void;
}

type StudioTab = 'background' | 'overlay' | 'typography' | 'cta_mobile';
type PreviewDevice = 'desktop' | 'tablet' | 'mobile';

const RADIUS_PRESETS = [0, 8, 16, 24, 32];
const ANGLE_PRESETS = [0, 45, 90, 135, 180, 270];
const CUSTOM_HEIGHT_REGEX = /^\d{2,4}(px|rem|em|vh|%)$/;

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const id = useId();
  const safeHex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#0D63F3';
  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="block text-[11px] font-bold text-slate-700 truncate">
        {label}
      </label>
      <div className="flex items-center gap-2 h-9 px-2 rounded-xl border border-slate-200/90 hover:border-slate-300 focus-within:border-[#0D63F3] focus-within:ring-3 focus-within:ring-[#0D63F3]/12 bg-white min-w-0 transition-all">
        <input
          type="color"
          value={safeHex}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} color picker`}
          className="w-6 h-6 rounded-md border-0 bg-transparent cursor-pointer shrink-0 p-0"
        />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 text-xs font-mono-num text-slate-800 outline-none bg-transparent"
        />
      </div>
    </div>
  );
}

export function BannerStudioModal({
  open,
  onClose,
  banner,
  defaultPosition = 'promo_trio',
  nextOrder = 1,
  onSaved,
}: BannerStudioModalProps) {
  const dispatch = useDispatch();
  const isEdit = Boolean(banner?._id);

  const slotId = useId();
  const campaignId = useId();
  const orderId = useId();
  const startId = useId();
  const endId = useId();
  const titleId = useId();

  const [activeTab, setActiveTab] = useState<StudioTab>('background');
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop');

  const [position, setPosition] = useState<Exclude<BannerPosition, 'hero_slide'>>(defaultPosition);
  const [campaignName, setCampaignName] = useState('');
  const [title, setTitle] = useState('');
  const [highlightText, setHighlightText] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [ctaText, setCtaText] = useState('Shop Now');
  const [linkUrl, setLinkUrl] = useState('/search?discounted=true');
  const [imageUrl, setImageUrl] = useState('');
  const [mobileImageUrl, setMobileImageUrl] = useState('');
  const [gradientTheme, setGradientTheme] = useState('sky');
  const [displayOrder, setDisplayOrder] = useState(1);
  const [active, setActive] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [styleConfig, setStyleConfig] = useState<BannerStyleConfig>(() => createDefaultBannerStyleConfig('sky'));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDirty(false);
    setActiveTab('background');
    setPreviewDevice('desktop');

    if (banner) {
      const pos: Exclude<BannerPosition, 'hero_slide'> =
        banner.position === 'category_top' || banner.position === 'seasonal_strip'
          ? banner.position
          : 'promo_trio';
      const theme = banner.gradientTheme || 'sky';
      setPosition(pos);
      setCampaignName(banner.campaignName || '');
      setTitle(banner.title || '');
      setHighlightText(banner.highlightText || '');
      setSubtitle(banner.subtitle || '');
      setCtaText(banner.ctaText || '');
      setLinkUrl(banner.linkUrl || '');
      setImageUrl(banner.imageUrl || '');
      setMobileImageUrl(banner.mobileImageUrl || '');
      setGradientTheme(theme);
      setDisplayOrder(banner.displayOrder ?? 1);
      setActive(banner.active ?? true);
      setStartDate(banner.startDate ? String(banner.startDate).slice(0, 10) : '');
      setEndDate(banner.endDate ? String(banner.endDate).slice(0, 10) : '');
      setStyleConfig(mergeBannerStyleConfig(theme, banner.styleConfig));
    } else {
      setPosition(defaultPosition);
      setCampaignName('');
      setTitle('');
      setHighlightText('Up to 40% OFF');
      setSubtitle('Limited-time marketplace deals across verified sellers.');
      setCtaText('Shop Now');
      setLinkUrl('/search?discounted=true');
      setImageUrl('');
      setMobileImageUrl('');
      setGradientTheme('indigo');
      setDisplayOrder(nextOrder);
      setActive(true);
      setStartDate('');
      setEndDate('');
      setStyleConfig(createDefaultBannerStyleConfig('indigo'));
    }
  }, [open, banner, defaultPosition, nextOrder]);

  const updateStyle = (patch: Partial<BannerStyleConfig>) => {
    setStyleConfig((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const applyThemePreset = (themeKey: string) => {
    const preset = BANNER_THEME_PRESETS[themeKey];
    if (!preset) return;
    setGradientTheme(themeKey);
    updateStyle({
      solidColor: preset.solidColor,
      gradientAngle: preset.gradientAngle,
      gradientStops: preset.gradientStops.map((s) => ({ ...s })),
      textColor: preset.textColor,
      subtitleColor: preset.subtitleColor,
      highlightColor: preset.highlightColor,
      ctaBgColor: preset.ctaBgColor,
      ctaTextColor: preset.ctaTextColor,
      ctaHoverBgColor: preset.ctaHoverBgColor,
      ctaHoverTextColor: preset.ctaHoverTextColor,
    });
  };

  const customHeightInvalid =
    styleConfig.heightPreset === 'custom' &&
    Boolean(styleConfig.customHeight.trim()) &&
    !CUSTOM_HEIGHT_REGEX.test(styleConfig.customHeight.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (title.trim().length < 2) {
      setError('Banner headline must be at least 2 characters.');
      setActiveTab('typography');
      return;
    }

    if (customHeightInvalid) {
      setError('Custom height must use units like 240px, 18rem, or 40vh.');
      setActiveTab('overlay');
      return;
    }

    if (startDate && endDate && endDate < startDate) {
      setError('Schedule end date cannot be earlier than start date.');
      return;
    }

    const needsBgImage =
      styleConfig.backgroundMode === 'image' ||
      styleConfig.backgroundMode === 'image_overlay' ||
      styleConfig.backgroundMode === 'image_gradient_overlay';

    if (needsBgImage && !imageUrl.trim() && !styleConfig.foregroundImageUrl.trim()) {
      setError('Upload a background image or switch background mode to Solid / Gradient.');
      setActiveTab('background');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        position,
        campaignName: campaignName.trim(),
        title: title.trim(),
        highlightText: highlightText.trim(),
        subtitle: subtitle.trim(),
        ctaText: ctaText.trim(),
        linkUrl: linkUrl.trim(),
        imageUrl: imageUrl.trim(),
        mobileImageUrl: mobileImageUrl.trim(),
        gradientTheme,
        displayOrder: Number(displayOrder) || 0,
        active,
        startDate: startDate || null,
        endDate: endDate || null,
        styleConfig,
      };

      if (isEdit && banner?._id) {
        await apiRequest(`/api/admin/banners/${banner._id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        dispatch(pushToast({ type: 'success', title: 'Dynamic banner updated' }));
      } else {
        await apiRequest('/api/admin/banners', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        dispatch(pushToast({ type: 'success', title: 'Dynamic banner published' }));
      }
      setDirty(false);
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save banner');
    } finally {
      setSaving(false);
    }
  };

  const previewBanner: BannerRecord = {
    _id: banner?._id || 'preview',
    position,
    campaignName,
    title: title || 'Weekend Flash Electronics',
    highlightText,
    subtitle,
    ctaText,
    linkUrl,
    imageUrl,
    mobileImageUrl,
    gradientTheme,
    displayOrder,
    active,
    styleConfig,
  };

  const tabs: Array<{ id: StudioTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'background', label: 'Background & Media', icon: Palette },
    { id: 'overlay', label: 'Overlay & Layout', icon: Layers },
    { id: 'typography', label: 'Content & Type', icon: Type },
    { id: 'cta_mobile', label: 'CTA, Visual & Mobile', icon: Sparkles },
  ];

  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Banner: ${banner?.title || 'Campaign'}` : 'Create Dynamic Banner'}
      subtitle="Design gradients, overlays, typography, CTA styling, and responsive rules with live storefront preview."
      badge="Banner Studio"
      size="2xl"
      isDirty={dirty}
      isSubmitting={saving}
      error={error}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="banner-studio-form"
            disabled={saving}
            className="px-5 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isEdit ? 'Save Banner Changes' : 'Publish Dynamic Banner'}</span>
          </button>
        </>
      }
    >
      <form id="banner-studio-form" onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left 7 cols: Configuration Studio */}
        <div className="xl:col-span-7 space-y-4">
          {/* Placement & Campaign Header */}
          <FormSection
            title="Placement & Campaign Schedule"
            icon={<SlidersHorizontal className="w-4 h-4" />}
            action={
              <ToggleSwitchCard
                label="Live on Storefront"
                checked={active}
                onChange={(val) => {
                  setActive(val);
                  setDirty(true);
                }}
                className="!py-1 !px-2.5"
              />
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
              <FormField label="Placement Slot" htmlFor={slotId} required className="sm:col-span-5">
                <select
                  id={slotId}
                  value={position}
                  onChange={(e) => {
                    setPosition(e.target.value as Exclude<BannerPosition, 'hero_slide'>);
                    setDirty(true);
                  }}
                  className={ADMIN_SELECT_COMPACT_CLASS}
                >
                  <option value="promo_trio">Homepage Promo Trio</option>
                  <option value="category_top">Category Top Strip</option>
                  <option value="seasonal_strip">Seasonal Full-Width Strip</option>
                </select>
              </FormField>

              <FormField label="Campaign Label" htmlFor={campaignId} optional className="sm:col-span-5">
                <input
                  id={campaignId}
                  value={campaignName}
                  onChange={(e) => {
                    setCampaignName(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="e.g. Eid Tech Campaign"
                  className={ADMIN_INPUT_COMPACT_CLASS}
                />
              </FormField>

              <FormField label="Order" htmlFor={orderId} className="sm:col-span-2">
                <input
                  id={orderId}
                  type="number"
                  min={0}
                  max={1000}
                  value={displayOrder}
                  onChange={(e) => {
                    setDisplayOrder(Number(e.target.value));
                    setDirty(true);
                  }}
                  className={`${ADMIN_INPUT_COMPACT_CLASS} font-mono-num`}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Schedule Start" htmlFor={startId} optional>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    id={startId}
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDirty(true);
                    }}
                    className={`${ADMIN_INPUT_COMPACT_CLASS} pl-8`}
                  />
                </div>
              </FormField>
              <FormField label="Schedule End" htmlFor={endId} optional>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    id={endId}
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDirty(true);
                    }}
                    className={`${ADMIN_INPUT_COMPACT_CLASS} pl-8`}
                  />
                </div>
              </FormField>
            </div>
          </FormSection>

          {/* Studio Tab Workspace */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div role="tablist" aria-label="Banner design controls" className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-200 bg-slate-50/80">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-3 text-[11px] font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? 'border-[#0D63F3] text-[#0D63F3] bg-white'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs">
              {activeTab === 'background' && (
                <>
                  <div className="space-y-1.5">
                    <span className="block text-xs font-bold text-slate-700">NOVARA Color Theme Presets</span>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {Object.entries(BANNER_THEME_PRESETS).map(([key, preset]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => applyThemePreset(key)}
                          className={`p-2 rounded-xl border text-left transition-all ${
                            gradientTheme === key
                              ? 'border-[#0D63F3] bg-blue-50/30 ring-2 ring-[#0D63F3]/20'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div
                            className="h-5 rounded-md mb-1.5 border border-black/5"
                            style={{
                              background: `linear-gradient(${preset.gradientAngle}deg, ${preset.gradientStops[0].color}, ${preset.gradientStops[1].color})`,
                            }}
                          />
                          <span className="block text-[10px] font-bold text-slate-700 truncate">{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="block text-xs font-bold text-slate-700">Background Mode</span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                      {(
                        [
                          { id: 'solid', label: 'Solid Color' },
                          { id: 'gradient', label: 'Gradient' },
                          { id: 'image', label: 'Image Only' },
                          { id: 'image_overlay', label: 'Image + Tint' },
                          { id: 'image_gradient_overlay', label: 'Img + Scrim' },
                        ] as const
                      ).map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => {
                            const patch: Partial<BannerStyleConfig> = { backgroundMode: mode.id };
                            if (mode.id === 'image_overlay' && styleConfig.overlayMode === 'none') {
                              patch.overlayMode = 'solid';
                            } else if (mode.id === 'image_gradient_overlay' && styleConfig.overlayMode === 'none') {
                              patch.overlayMode = 'gradient';
                            }
                            updateStyle(patch);
                          }}
                          className={`h-9 px-2 rounded-xl border text-[11px] font-bold transition-colors whitespace-nowrap ${
                            styleConfig.backgroundMode === mode.id
                              ? 'border-[#0D63F3] bg-blue-50 text-[#0D63F3]'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {styleConfig.backgroundMode === 'solid' && (
                    <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
                      <div className="max-w-xs">
                        <ColorField
                          label="Solid Background Color"
                          value={styleConfig.solidColor}
                          onChange={(hex) => updateStyle({ solidColor: hex })}
                        />
                      </div>
                    </div>
                  )}

                  {styleConfig.backgroundMode === 'gradient' && (
                    <div className="space-y-3.5 p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <FormField label="Gradient Type">
                          <select
                            value={styleConfig.gradientType}
                            onChange={(e) => updateStyle({ gradientType: e.target.value as BannerGradientType })}
                            className={ADMIN_SELECT_COMPACT_CLASS}
                          >
                            <option value="linear">Linear Gradient</option>
                            <option value="radial">Radial Gradient</option>
                          </select>
                        </FormField>

                        {styleConfig.gradientType === 'linear' && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-700">Angle</span>
                              <span className="text-[11px] font-mono-num font-bold text-[#0D63F3]">
                                {styleConfig.gradientAngle}°
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={360}
                              value={styleConfig.gradientAngle}
                              onChange={(e) => updateStyle({ gradientAngle: Number(e.target.value) })}
                              className="w-full accent-[#0D63F3]"
                            />
                            <div className="flex flex-wrap gap-1">
                              {ANGLE_PRESETS.map((deg) => (
                                <button
                                  key={deg}
                                  type="button"
                                  onClick={() => updateStyle({ gradientAngle: deg })}
                                  className={`px-2 py-0.5 rounded-md border text-[10px] font-mono-num font-bold transition-colors ${
                                    styleConfig.gradientAngle === deg
                                      ? 'border-[#0D63F3] bg-blue-50 text-[#0D63F3]'
                                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                  }`}
                                >
                                  {deg}°
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">
                            Color Stops ({styleConfig.gradientStops.length}/4)
                          </span>
                          {styleConfig.gradientStops.length < 4 && (
                            <button
                              type="button"
                              onClick={() =>
                                updateStyle({
                                  gradientStops: [
                                    ...styleConfig.gradientStops,
                                    { color: '#0D63F3', position: 65 },
                                  ],
                                })
                              }
                              className="text-[11px] font-bold text-[#0D63F3] hover:underline inline-flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Add Stop
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {styleConfig.gradientStops.map((stop, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                                  Stop {idx + 1}
                                </span>
                                {styleConfig.gradientStops.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateStyle({
                                        gradientStops: styleConfig.gradientStops.filter((_, sIdx) => sIdx !== idx),
                                      })
                                    }
                                    aria-label={`Remove color stop ${idx + 1}`}
                                    className="text-slate-400 hover:text-[#EF3E36]"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={/^#[0-9a-fA-F]{6}$/.test(stop.color) ? stop.color : '#0D63F3'}
                                  onChange={(e) => {
                                    const next = [...styleConfig.gradientStops];
                                    next[idx] = { ...stop, color: e.target.value };
                                    updateStyle({ gradientStops: next });
                                  }}
                                  aria-label={`Stop ${idx + 1} color`}
                                  className="w-7 h-7 rounded cursor-pointer border-0 p-0 shrink-0"
                                />
                                <input
                                  type="text"
                                  value={stop.color}
                                  onChange={(e) => {
                                    const next = [...styleConfig.gradientStops];
                                    next[idx] = { ...stop, color: e.target.value };
                                    updateStyle({ gradientStops: next });
                                  }}
                                  className="flex-1 min-w-0 h-8 px-2 rounded-lg border border-slate-200 font-mono-num text-[11px]"
                                />
                                <div className="flex items-center gap-1 shrink-0">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={stop.position}
                                    onChange={(e) => {
                                      const next = [...styleConfig.gradientStops];
                                      next[idx] = { ...stop, position: Number(e.target.value) };
                                      updateStyle({ gradientStops: next });
                                    }}
                                    aria-label={`Stop ${idx + 1} position`}
                                    className="w-13 h-8 px-1.5 rounded-lg border border-slate-200 font-mono-num text-[11px] text-right"
                                  />
                                  <span className="text-[10px] text-slate-400">%</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {(styleConfig.backgroundMode === 'image' ||
                    styleConfig.backgroundMode === 'image_overlay' ||
                    styleConfig.backgroundMode === 'image_gradient_overlay') && (
                    <div className="space-y-3.5 p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <SingleMediaUploader
                          folder="banners"
                          label="Background Image"
                          aspectClass="h-36"
                          value={imageUrl}
                          onChange={(url) => {
                            setImageUrl(url);
                            setDirty(true);
                          }}
                        />
                        <SingleMediaUploader
                          folder="banners"
                          label="Mobile Background (Optional)"
                          aspectClass="h-36"
                          helperText="Used only on mobile screens"
                          value={mobileImageUrl}
                          onChange={(url) => {
                            setMobileImageUrl(url);
                            setDirty(true);
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <FormField label="Focal Position">
                          <select
                            value={styleConfig.imagePosition}
                            onChange={(e) =>
                              updateStyle({
                                imagePosition: e.target.value as BannerStyleConfig['imagePosition'],
                              })
                            }
                            className={ADMIN_SELECT_COMPACT_CLASS}
                          >
                            <option value="center">Center</option>
                            <option value="top">Top</option>
                            <option value="bottom">Bottom</option>
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                            <option value="custom">Custom X / Y %</option>
                          </select>
                        </FormField>
                        <FormField label="Image Fit">
                          <select
                            value={styleConfig.imageSize}
                            onChange={(e) => updateStyle({ imageSize: e.target.value as BannerImageSize })}
                            className={ADMIN_SELECT_COMPACT_CLASS}
                          >
                            <option value="cover">Cover (Fill Box)</option>
                            <option value="contain">Contain (Fit Inside)</option>
                            <option value="auto">Original Size</option>
                          </select>
                        </FormField>
                        <FormField label="Repeat">
                          <select
                            value={styleConfig.imageRepeat}
                            onChange={(e) => updateStyle({ imageRepeat: e.target.value as BannerImageRepeat })}
                            className={ADMIN_SELECT_COMPACT_CLASS}
                          >
                            <option value="no-repeat">No Repeat</option>
                            <option value="repeat">Tile Repeat</option>
                            <option value="repeat-x">Repeat X</option>
                            <option value="repeat-y">Repeat Y</option>
                          </select>
                        </FormField>
                      </div>

                      {styleConfig.imagePosition === 'custom' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="flex justify-between text-[11px] font-bold text-slate-700">
                              <span>Focal X</span>
                              <span className="font-mono-num">{styleConfig.imagePosX}%</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={styleConfig.imagePosX}
                              onChange={(e) => updateStyle({ imagePosX: Number(e.target.value) })}
                              className="w-full accent-[#0D63F3]"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-[11px] font-bold text-slate-700">
                              <span>Focal Y</span>
                              <span className="font-mono-num">{styleConfig.imagePosY}%</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={styleConfig.imagePosY}
                              onChange={(e) => updateStyle({ imagePosY: Number(e.target.value) })}
                              className="w-full accent-[#0D63F3]"
                            />
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex justify-between text-[11px] font-bold text-slate-700">
                            <span>Subtle Zoom</span>
                            <span className="font-mono-num">{styleConfig.imageScale.toFixed(2)}×</span>
                          </div>
                          <input
                            type="range"
                            min={0.8}
                            max={1.5}
                            step={0.05}
                            value={styleConfig.imageScale}
                            onChange={(e) => updateStyle({ imageScale: Number(e.target.value) })}
                            className="w-full accent-[#0D63F3]"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-[11px] font-bold text-slate-700">
                            <span>Rotation</span>
                            <span className="font-mono-num">{styleConfig.imageRotation}°</span>
                          </div>
                          <input
                            type="range"
                            min={-15}
                            max={15}
                            step={1}
                            value={styleConfig.imageRotation}
                            onChange={(e) => updateStyle({ imageRotation: Number(e.target.value) })}
                            className="w-full accent-[#0D63F3]"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'overlay' && (
                <>
                  <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                      <FormField label="Overlay Layer">
                        <select
                          value={styleConfig.overlayMode}
                          onChange={(e) => updateStyle({ overlayMode: e.target.value as BannerOverlayMode })}
                          className={ADMIN_SELECT_COMPACT_CLASS}
                        >
                          <option value="none">No Overlay</option>
                          <option value="solid">Solid Tint Overlay</option>
                          <option value="gradient">Directional Gradient Scrim</option>
                        </select>
                      </FormField>

                      {styleConfig.overlayMode !== 'none' && (
                        <>
                          <ColorField
                            label="Overlay Color"
                            value={styleConfig.overlayColor}
                            onChange={(hex) => updateStyle({ overlayColor: hex })}
                          />
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[11px] font-bold text-slate-700">
                              <span>Opacity</span>
                              <span className="font-mono-num text-[#0D63F3]">{styleConfig.overlayOpacity}%</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={styleConfig.overlayOpacity}
                              onChange={(e) => updateStyle({ overlayOpacity: Number(e.target.value) })}
                              className="w-full accent-[#0D63F3] mt-1.5"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {styleConfig.overlayMode === 'gradient' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <ColorField
                          label="Fade To Secondary Color"
                          value={styleConfig.overlaySecondaryColor}
                          onChange={(hex) => updateStyle({ overlaySecondaryColor: hex })}
                        />
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px] font-bold text-slate-700">
                            <span>Scrim Angle</span>
                            <span className="font-mono-num">{styleConfig.overlayAngle}°</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={360}
                            value={styleConfig.overlayAngle}
                            onChange={(e) => updateStyle({ overlayAngle: Number(e.target.value) })}
                            className="w-full accent-[#0D63F3] mt-1.5"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FormField label="Height Preset">
                      <select
                        value={styleConfig.heightPreset}
                        onChange={(e) => updateStyle({ heightPreset: e.target.value as BannerHeightPreset })}
                        className={ADMIN_SELECT_COMPACT_CLASS}
                      >
                        <option value="sm">Compact (SM)</option>
                        <option value="md">Standard (MD)</option>
                        <option value="lg">Tall (LG)</option>
                        <option value="full">Hero Height</option>
                        <option value="custom">Custom CSS Height</option>
                      </select>
                    </FormField>

                    {styleConfig.heightPreset === 'custom' && (
                      <FormField
                        label="Custom Height"
                        error={customHeightInvalid ? 'Use units like 240px or 18rem' : null}
                      >
                        <input
                          value={styleConfig.customHeight}
                          onChange={(e) => updateStyle({ customHeight: e.target.value })}
                          placeholder="e.g. 240px"
                          className={`${ADMIN_INPUT_COMPACT_CLASS} font-mono-num`}
                        />
                      </FormField>
                    )}

                    <FormField label="Width Mode">
                      <select
                        value={styleConfig.widthMode}
                        onChange={(e) => updateStyle({ widthMode: e.target.value as BannerWidthMode })}
                        className={ADMIN_SELECT_COMPACT_CLASS}
                      >
                        <option value="container">Container Grid</option>
                        <option value="full">Full Container Bleed</option>
                      </select>
                    </FormField>

                    <FormField label="Inner Padding">
                      <select
                        value={styleConfig.paddingPreset}
                        onChange={(e) => updateStyle({ paddingPreset: e.target.value as BannerPaddingPreset })}
                        className={ADMIN_SELECT_COMPACT_CLASS}
                      >
                        <option value="compact">Compact</option>
                        <option value="normal">Balanced</option>
                        <option value="spacious">Spacious</option>
                      </select>
                    </FormField>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-700">
                        <span>Corner Radius</span>
                        <span className="font-mono-num text-[#0D63F3]">{styleConfig.borderRadius}px</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={48}
                        value={styleConfig.borderRadius}
                        onChange={(e) => updateStyle({ borderRadius: Number(e.target.value) })}
                        className="w-full accent-[#0D63F3]"
                      />
                      <div className="flex flex-wrap gap-1">
                        {RADIUS_PRESETS.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => updateStyle({ borderRadius: r })}
                            className={`px-1.5 py-0.5 rounded-md border text-[10px] font-mono-num font-bold ${
                              styleConfig.borderRadius === r
                                ? 'border-[#0D63F3] bg-blue-50 text-[#0D63F3]'
                                : 'border-slate-200 bg-white text-slate-600'
                            }`}
                          >
                            {r}px
                          </button>
                        ))}
                      </div>
                    </div>

                    <FormField label="Card Elevation">
                      <select
                        value={styleConfig.shadow}
                        onChange={(e) => updateStyle({ shadow: e.target.value as BannerShadowPreset })}
                        className={ADMIN_SELECT_COMPACT_CLASS}
                      >
                        <option value="none">Flat (No Shadow)</option>
                        <option value="sm">Subtle Shadow</option>
                        <option value="md">Elevated Medium</option>
                        <option value="lg">Deep Card Shadow</option>
                      </select>
                    </FormField>

                    <FormField label="Hover Interaction">
                      <select
                        value={styleConfig.hoverEffect}
                        onChange={(e) => updateStyle({ hoverEffect: e.target.value as BannerHoverEffect })}
                        className={ADMIN_SELECT_COMPACT_CLASS}
                      >
                        <option value="none">None</option>
                        <option value="lift">Subtle Lift</option>
                        <option value="zoom_bg">Zoom Background</option>
                        <option value="shine">Gloss Shine Sweep</option>
                      </select>
                    </FormField>
                  </div>
                </>
              )}

              {activeTab === 'typography' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Eyebrow / Kicker Label" optional>
                      <input
                        value={styleConfig.eyebrow}
                        onChange={(e) => updateStyle({ eyebrow: e.target.value })}
                        placeholder="e.g. LIMITED EDITION"
                        className={ADMIN_INPUT_COMPACT_CLASS}
                      />
                    </FormField>
                    <FormField label="Main Headline" htmlFor={titleId} required>
                      <input
                        id={titleId}
                        required
                        value={title}
                        onChange={(e) => {
                          setTitle(e.target.value);
                          setDirty(true);
                        }}
                        placeholder="e.g. Mega Electronics Deals"
                        className={ADMIN_INPUT_COMPACT_CLASS}
                      />
                    </FormField>
                    <FormField label="Highlight / Offer Callout" optional>
                      <input
                        value={highlightText}
                        onChange={(e) => {
                          setHighlightText(e.target.value);
                          setDirty(true);
                        }}
                        placeholder="e.g. Up to 45% OFF"
                        className={ADMIN_INPUT_COMPACT_CLASS}
                      />
                    </FormField>
                    <FormField label="Subtitle / Description" optional>
                      <input
                        value={subtitle}
                        onChange={(e) => {
                          setSubtitle(e.target.value);
                          setDirty(true);
                        }}
                        placeholder="Short persuasive copy"
                        className={ADMIN_INPUT_COMPACT_CLASS}
                      />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
                    <ColorField
                      label="Headline Color"
                      value={styleConfig.textColor}
                      onChange={(hex) => updateStyle({ textColor: hex })}
                    />
                    <ColorField
                      label="Highlight / Eyebrow Color"
                      value={styleConfig.highlightColor}
                      onChange={(hex) => updateStyle({ highlightColor: hex })}
                    />
                    <ColorField
                      label="Subtitle Color"
                      value={styleConfig.subtitleColor}
                      onChange={(hex) => updateStyle({ subtitleColor: hex })}
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <FormField label="Heading Size">
                      <select
                        value={styleConfig.headingSize}
                        onChange={(e) => updateStyle({ headingSize: e.target.value as BannerHeadingSize })}
                        className={ADMIN_SELECT_COMPACT_CLASS}
                      >
                        <option value="sm">Small</option>
                        <option value="md">Medium</option>
                        <option value="lg">Large</option>
                        <option value="xl">Extra Large</option>
                      </select>
                    </FormField>
                    <FormField label="Weight">
                      <select
                        value={styleConfig.headingWeight}
                        onChange={(e) => updateStyle({ headingWeight: e.target.value as BannerHeadingWeight })}
                        className={ADMIN_SELECT_COMPACT_CLASS}
                      >
                        <option value="semibold">Semibold</option>
                        <option value="bold">Bold</option>
                        <option value="extrabold">Extra Bold</option>
                        <option value="black">Black</option>
                      </select>
                    </FormField>
                    <FormField label="Line Height">
                      <select
                        value={styleConfig.lineHeight}
                        onChange={(e) => updateStyle({ lineHeight: e.target.value as BannerLineHeight })}
                        className={ADMIN_SELECT_COMPACT_CLASS}
                      >
                        <option value="tight">Tight</option>
                        <option value="normal">Normal</option>
                        <option value="relaxed">Relaxed</option>
                      </select>
                    </FormField>
                    <FormField label="Text Max Width">
                      <select
                        value={styleConfig.maxContentWidth}
                        onChange={(e) => updateStyle({ maxContentWidth: e.target.value as BannerContentWidth })}
                        className={ADMIN_SELECT_COMPACT_CLASS}
                      >
                        <option value="sm">Narrow</option>
                        <option value="md">Balanced</option>
                        <option value="lg">Wide</option>
                      </select>
                    </FormField>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Horizontal Text Alignment">
                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            { id: 'left', icon: AlignLeft, label: 'Left' },
                            { id: 'center', icon: AlignCenter, label: 'Center' },
                            { id: 'right', icon: AlignRight, label: 'Right' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => updateStyle({ alignHorizontal: opt.id as BannerAlignH })}
                            className={`h-9 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1 transition-colors ${
                              styleConfig.alignHorizontal === opt.id
                                ? 'border-[#0D63F3] bg-blue-50 text-[#0D63F3]'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <opt.icon className="w-3.5 h-3.5" />
                            <span>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </FormField>
                    <FormField label="Vertical Alignment">
                      <select
                        value={styleConfig.alignVertical}
                        onChange={(e) => updateStyle({ alignVertical: e.target.value as BannerAlignV })}
                        className={ADMIN_SELECT_COMPACT_CLASS}
                      >
                        <option value="top">Top</option>
                        <option value="center">Middle</option>
                        <option value="bottom">Bottom</option>
                      </select>
                    </FormField>
                  </div>
                </>
              )}

              {activeTab === 'cta_mobile' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="CTA Button Label" hint="Leave blank to make the whole card clickable">
                      <input
                        value={ctaText}
                        onChange={(e) => {
                          setCtaText(e.target.value);
                          setDirty(true);
                        }}
                        placeholder="e.g. Shop Now"
                        className={ADMIN_INPUT_COMPACT_CLASS}
                      />
                    </FormField>
                    <FormField label="Destination Link URL" optional>
                      <input
                        value={linkUrl}
                        onChange={(e) => {
                          setLinkUrl(e.target.value);
                          setDirty(true);
                        }}
                        placeholder="/category/electronics or https://..."
                        className={ADMIN_INPUT_COMPACT_CLASS}
                      />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
                    <ColorField
                      label="CTA Fill"
                      value={styleConfig.ctaBgColor}
                      onChange={(hex) => updateStyle({ ctaBgColor: hex })}
                    />
                    <ColorField
                      label="CTA Text"
                      value={styleConfig.ctaTextColor}
                      onChange={(hex) => updateStyle({ ctaTextColor: hex })}
                    />
                    <ColorField
                      label="CTA Hover Fill"
                      value={styleConfig.ctaHoverBgColor}
                      onChange={(hex) => updateStyle({ ctaHoverBgColor: hex })}
                    />
                    <ColorField
                      label="CTA Border"
                      value={styleConfig.ctaBorderColor}
                      onChange={(hex) => updateStyle({ ctaBorderColor: hex })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="CTA Corner Shape">
                      <select
                        value={styleConfig.ctaRadius}
                        onChange={(e) => updateStyle({ ctaRadius: e.target.value as BannerCtaRadius })}
                        className={ADMIN_SELECT_COMPACT_CLASS}
                      >
                        <option value="md">Rounded (8px)</option>
                        <option value="xl">Soft Card (12px)</option>
                        <option value="full">Pill Button</option>
                      </select>
                    </FormField>
                    <FormField label="CTA Size">
                      <select
                        value={styleConfig.ctaSize}
                        onChange={(e) => updateStyle({ ctaSize: e.target.value as BannerCtaSize })}
                        className={ADMIN_SELECT_COMPACT_CLASS}
                      >
                        <option value="sm">Compact</option>
                        <option value="md">Standard</option>
                        <option value="lg">Large</option>
                      </select>
                    </FormField>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-3">
                    <SingleMediaUploader
                      folder="banners"
                      label="Optional Foreground Product / Visual Cutout"
                      aspectClass="h-32"
                      fit="contain"
                      helperText="Displayed alongside copy (e.g. featured product cutout in Promo Trio)"
                      value={styleConfig.foregroundImageUrl}
                      onChange={(url) => updateStyle({ foregroundImageUrl: url })}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Visual Side">
                        <select
                          value={styleConfig.foregroundPosition}
                          onChange={(e) =>
                            updateStyle({ foregroundPosition: e.target.value as 'right' | 'left' })
                          }
                          className={ADMIN_SELECT_COMPACT_CLASS}
                        >
                          <option value="right">Right Side</option>
                          <option value="left">Left Side</option>
                        </select>
                      </FormField>
                      <FormField label="Visual Size">
                        <select
                          value={styleConfig.foregroundSize}
                          onChange={(e) => updateStyle({ foregroundSize: e.target.value as BannerForegroundSize })}
                          className={ADMIN_SELECT_COMPACT_CLASS}
                        >
                          <option value="sm">Small (96px)</option>
                          <option value="md">Medium (128px)</option>
                          <option value="lg">Large (144px)</option>
                        </select>
                      </FormField>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2.5">
                    <p className="text-[11px] font-extrabold text-[#0B1F4B] uppercase tracking-wider">
                      Responsive Mobile Overrides
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <FormField label="Mobile Height">
                        <select
                          value={styleConfig.mobileHeightPreset}
                          onChange={(e) =>
                            updateStyle({
                              mobileHeightPreset: e.target.value as BannerStyleConfig['mobileHeightPreset'],
                            })
                          }
                          className={ADMIN_SELECT_COMPACT_CLASS}
                        >
                          <option value="inherit">Inherit Desktop</option>
                          <option value="sm">Compact</option>
                          <option value="md">Standard</option>
                          <option value="lg">Tall</option>
                        </select>
                      </FormField>
                      <FormField label="Mobile Alignment">
                        <select
                          value={styleConfig.mobileAlignHorizontal}
                          onChange={(e) =>
                            updateStyle({
                              mobileAlignHorizontal: e.target.value as BannerStyleConfig['mobileAlignHorizontal'],
                            })
                          }
                          className={ADMIN_SELECT_COMPACT_CLASS}
                        >
                          <option value="inherit">Inherit Desktop</option>
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </FormField>
                      <FormField label="Mobile Heading">
                        <select
                          value={styleConfig.mobileHeadingSize}
                          onChange={(e) =>
                            updateStyle({
                              mobileHeadingSize: e.target.value as BannerStyleConfig['mobileHeadingSize'],
                            })
                          }
                          className={ADMIN_SELECT_COMPACT_CLASS}
                        >
                          <option value="inherit">Inherit Desktop</option>
                          <option value="sm">Small</option>
                          <option value="md">Medium</option>
                          <option value="lg">Large</option>
                        </select>
                      </FormField>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right 5 cols: Sticky Live Interactive Preview */}
        <div className="xl:col-span-5 xl:sticky xl:top-1 space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-3 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-extrabold text-[#0B1F4B]">Live Storefront Preview</h3>
                <p className="text-[11px] text-slate-500">Real-time WYSIWYG output using storefront renderer</p>
              </div>
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100">
                {(
                  [
                    { id: 'desktop', icon: Monitor, label: 'Desktop' },
                    { id: 'tablet', icon: Tablet, label: 'Tablet' },
                    { id: 'mobile', icon: Smartphone, label: 'Mobile' },
                  ] as const
                ).map((dev) => (
                  <button
                    key={dev.id}
                    type="button"
                    onClick={() => setPreviewDevice(dev.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
                      previewDevice === dev.id
                        ? 'bg-white text-[#0D63F3] shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <dev.icon className="w-3.5 h-3.5" />
                    <span>{dev.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-[#F4F7FB] border border-slate-200/80 p-3 sm:p-4 flex justify-center overflow-hidden">
              <div
                className={`w-full transition-all duration-200 ${
                  previewDevice === 'mobile'
                    ? 'max-w-[340px]'
                    : previewDevice === 'tablet'
                      ? 'max-w-[500px]'
                      : 'w-full'
                }`}
              >
                <DynamicBannerRenderer
                  banner={previewBanner}
                  previewViewport={previewDevice}
                  disableNavigation
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">Slot</span>
                <span className="font-bold text-slate-800 capitalize">{position.replace(/_/g, ' ')}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">Mode</span>
                <span className="font-bold text-slate-800 capitalize">
                  {styleConfig.backgroundMode.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">Overlay</span>
                <span className="font-bold text-slate-800 capitalize">
                  {styleConfig.overlayMode === 'none'
                    ? 'None'
                    : `${styleConfig.overlayMode} (${styleConfig.overlayOpacity}%)`}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">Radius</span>
                <span className="font-bold font-mono-num text-slate-800">{styleConfig.borderRadius}px</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </AdminDialog>
  );
}
