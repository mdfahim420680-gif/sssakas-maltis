import React, { useEffect, useId, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Calendar, Image as ImageIcon, Link2, Loader2, SlidersHorizontal, Smartphone } from 'lucide-react';
import {
  ADMIN_INPUT_CLASS,
  AdminDialog,
  FormField,
  FormSection,
  ToggleSwitchCard,
} from './AdminDialog';
import { SingleMediaUploader } from './MediaUploader';
import { BannerRecord } from '../../../shared/bannerStyle';
import { apiRequest } from '../../lib/api';
import { pushToast } from '../../store/uiSlice';

interface HeroSlideModalProps {
  open: boolean;
  onClose: () => void;
  slide: BannerRecord | null;
  nextOrder?: number;
  onSaved: () => void;
}

export function HeroSlideModal({ open, onClose, slide, nextOrder = 1, onSaved }: HeroSlideModalProps) {
  const dispatch = useDispatch();
  const isEdit = Boolean(slide?._id);

  const linkId = useId();
  const orderId = useId();
  const startId = useId();
  const endId = useId();

  const [imageUrl, setImageUrl] = useState('');
  const [mobileImageUrl, setMobileImageUrl] = useState('');
  const [showMobileUpload, setShowMobileUpload] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [displayOrder, setDisplayOrder] = useState(1);
  const [active, setActive] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDirty(false);
    if (slide) {
      setImageUrl(slide.imageUrl || '');
      setMobileImageUrl(slide.mobileImageUrl || '');
      setShowMobileUpload(Boolean(slide.mobileImageUrl));
      setLinkUrl(slide.linkUrl || '');
      setDisplayOrder(slide.displayOrder ?? 1);
      setActive(slide.active ?? true);
      setStartDate(slide.startDate ? String(slide.startDate).slice(0, 10) : '');
      setEndDate(slide.endDate ? String(slide.endDate).slice(0, 10) : '');
    } else {
      setImageUrl('');
      setMobileImageUrl('');
      setShowMobileUpload(false);
      setLinkUrl('');
      setDisplayOrder(nextOrder);
      setActive(true);
      setStartDate('');
      setEndDate('');
    }
  }, [open, slide, nextOrder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!imageUrl.trim()) {
      setError('Please upload a hero slide image.');
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError('End date cannot be earlier than start date.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        position: 'hero_slide' as const,
        imageUrl: imageUrl.trim(),
        mobileImageUrl: mobileImageUrl.trim(),
        linkUrl: linkUrl.trim(),
        displayOrder: Number(displayOrder) || 0,
        active,
        gradientTheme: slide?.gradientTheme || 'sky',
        title: slide?.title || '',
        subtitle: slide?.subtitle || '',
        highlightText: slide?.highlightText || '',
        ctaText: slide?.ctaText || '',
        startDate: startDate || null,
        endDate: endDate || null,
      };

      if (isEdit && slide?._id) {
        await apiRequest(`/api/admin/banners/${slide._id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        dispatch(pushToast({ type: 'success', title: 'Hero slide updated' }));
      } else {
        await apiRequest('/api/admin/banners', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        dispatch(pushToast({ type: 'success', title: 'Hero slide published' }));
      }
      setDirty(false);
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save hero slide');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Hero Slide' : 'Add Hero Slide'}
      subtitle="Upload full-bleed carousel artwork for the homepage hero slider. Destination link is optional."
      badge="Hero Carousel"
      size="lg"
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
            form="hero-slide-form"
            disabled={saving}
            className="px-5 h-9 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isEdit ? 'Save Hero Slide' : 'Publish Hero Slide'}</span>
          </button>
        </>
      }
    >
      <form id="hero-slide-form" onSubmit={handleSubmit} className="space-y-4">
        <FormSection
          title="Hero Slide Artwork"
          description="Rendered edge-to-edge on the storefront hero slider."
          icon={<ImageIcon className="w-4 h-4" />}
          action={
            <button
              type="button"
              onClick={() => setShowMobileUpload((v) => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-bold text-slate-700 transition-colors"
            >
              <Smartphone className="w-3 h-3 text-[#0D63F3]" />
              <span>{showMobileUpload ? 'Hide Mobile Image' : 'Add Mobile Crop'}</span>
            </button>
          }
        >
          <SingleMediaUploader
            folder="banners"
            label="Desktop Hero Image"
            required
            allowRemove={false}
            aspectClass="h-40 sm:h-44 w-full"
            helperText="Recommended 1200×420px (~3:1 landscape) · JPG, PNG, WebP, or AVIF up to 5MB"
            value={imageUrl}
            onChange={(url) => {
              setImageUrl(url);
              setDirty(true);
            }}
          />

          {showMobileUpload && (
            <div className="pt-2 border-t border-slate-100">
              <SingleMediaUploader
                folder="banners"
                label="Mobile Override Image (Optional)"
                aspectClass="h-36"
                helperText="Shown on small mobile viewports when provided; otherwise desktop slide scales automatically."
                value={mobileImageUrl}
                onChange={(url) => {
                  setMobileImageUrl(url);
                  setDirty(true);
                }}
              />
            </div>
          )}
        </FormSection>

        <FormSection
          title="Destination, Ordering & Schedule"
          description="Control click destination, carousel sequence, visibility, and optional campaign dates."
          icon={<SlidersHorizontal className="w-4 h-4" />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-start">
            <FormField
              label="Destination Link"
              htmlFor={linkId}
              optional
              hint="Internal route (e.g. /category/electronics) or full https:// URL. Leave blank for image-only."
              className="sm:col-span-8"
            >
              <div className="relative">
                <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  id={linkId}
                  type="text"
                  value={linkUrl}
                  onChange={(e) => {
                    setLinkUrl(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="/category/electronics"
                  className={`${ADMIN_INPUT_CLASS} pl-9`}
                />
              </div>
            </FormField>

            <FormField label="Sort Order" htmlFor={orderId} hint="Lower shows first" className="sm:col-span-4">
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
                className={`${ADMIN_INPUT_CLASS} font-mono-num`}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormField label="Start Date" htmlFor={startId} optional>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  id={startId}
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDirty(true);
                  }}
                  className={`${ADMIN_INPUT_CLASS} pl-9`}
                />
              </div>
            </FormField>

            <FormField label="End Date" htmlFor={endId} optional>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  id={endId}
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDirty(true);
                  }}
                  className={`${ADMIN_INPUT_CLASS} pl-9`}
                />
              </div>
            </FormField>
          </div>

          <ToggleSwitchCard
            label="Slide Active on Storefront"
            description="When paused, this slide is hidden from the public homepage hero carousel."
            checked={active}
            onChange={(checked) => {
              setActive(checked);
              setDirty(true);
            }}
          />
        </FormSection>
      </form>
    </AdminDialog>
  );
}
