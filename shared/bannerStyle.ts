export type BannerPosition = 'hero_slide' | 'promo_trio' | 'category_top' | 'seasonal_strip';

export type BannerBackgroundMode =
  | 'solid'
  | 'gradient'
  | 'image'
  | 'image_overlay'
  | 'image_gradient_overlay';

export type BannerGradientType = 'linear' | 'radial';
export type BannerOverlayMode = 'none' | 'solid' | 'gradient';
export type BannerImageSize = 'cover' | 'contain' | 'auto';
export type BannerImageRepeat = 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
export type BannerHeightPreset = 'sm' | 'md' | 'lg' | 'full' | 'custom';
export type BannerWidthMode = 'container' | 'full';
export type BannerShadowPreset = 'none' | 'sm' | 'md' | 'lg';
export type BannerPaddingPreset = 'compact' | 'normal' | 'spacious';
export type BannerHeadingSize = 'sm' | 'md' | 'lg' | 'xl';
export type BannerHeadingWeight = 'semibold' | 'bold' | 'extrabold' | 'black';
export type BannerLineHeight = 'tight' | 'normal' | 'relaxed';
export type BannerContentWidth = 'sm' | 'md' | 'lg';
export type BannerAlignH = 'left' | 'center' | 'right';
export type BannerAlignV = 'top' | 'center' | 'bottom';
export type BannerHoverEffect = 'none' | 'lift' | 'zoom_bg' | 'shine';
export type BannerCtaRadius = 'md' | 'xl' | 'full';
export type BannerCtaSize = 'sm' | 'md' | 'lg';
export type BannerForegroundSize = 'sm' | 'md' | 'lg';

export interface GradientStop {
  color: string;
  position: number;
}

export interface BannerStyleConfig {
  backgroundMode: BannerBackgroundMode;
  solidColor: string;
  gradientType: BannerGradientType;
  gradientAngle: number;
  gradientStops: GradientStop[];
  imagePosition: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'custom';
  imagePosX: number;
  imagePosY: number;
  imageSize: BannerImageSize;
  imageRepeat: BannerImageRepeat;
  imageScale: number;
  imageRotation: number;
  overlayMode: BannerOverlayMode;
  overlayColor: string;
  overlaySecondaryColor: string;
  overlayAngle: number;
  overlayOpacity: number;
  heightPreset: BannerHeightPreset;
  customHeight: string;
  widthMode: BannerWidthMode;
  borderRadius: number;
  shadow: BannerShadowPreset;
  paddingPreset: BannerPaddingPreset;
  eyebrow: string;
  description: string;
  textColor: string;
  subtitleColor: string;
  highlightColor: string;
  headingSize: BannerHeadingSize;
  headingWeight: BannerHeadingWeight;
  lineHeight: BannerLineHeight;
  maxContentWidth: BannerContentWidth;
  ctaBgColor: string;
  ctaTextColor: string;
  ctaHoverBgColor: string;
  ctaHoverTextColor: string;
  ctaBorderColor: string;
  ctaRadius: BannerCtaRadius;
  ctaSize: BannerCtaSize;
  alignHorizontal: BannerAlignH;
  alignVertical: BannerAlignV;
  foregroundImageUrl: string;
  foregroundPosition: 'right' | 'left';
  foregroundSize: BannerForegroundSize;
  hoverEffect: BannerHoverEffect;
  mobileHeightPreset: BannerHeightPreset | 'inherit';
  mobileAlignHorizontal: BannerAlignH | 'inherit';
  mobileHeadingSize: BannerHeadingSize | 'inherit';
}

export interface HeroSliderConfig {
  autoplay: boolean;
  slideDurationMs: number;
  transitionType: 'fade' | 'slide';
  transitionDurationMs: number;
  pauseOnHover: boolean;
  loop: boolean;
  showDots: boolean;
  showArrows: boolean;
}

export interface BannerRecord {
  _id: string;
  title?: string;
  subtitle?: string;
  highlightText?: string;
  ctaText?: string;
  linkUrl?: string;
  imageUrl: string;
  mobileImageUrl?: string;
  gradientTheme?: string;
  position: BannerPosition;
  displayOrder: number;
  startDate?: string;
  endDate?: string;
  active: boolean;
  campaignName?: string;
  styleConfig?: Partial<BannerStyleConfig>;
}

export const DEFAULT_HERO_SLIDER_CONFIG: HeroSliderConfig = {
  autoplay: true,
  slideDurationMs: 5500,
  transitionType: 'slide',
  transitionDurationMs: 500,
  pauseOnHover: true,
  loop: true,
  showDots: true,
  showArrows: true,
};

export interface ThemeStylePreset {
  label: string;
  solidColor: string;
  gradientAngle: number;
  gradientStops: GradientStop[];
  textColor: string;
  subtitleColor: string;
  highlightColor: string;
  ctaBgColor: string;
  ctaTextColor: string;
  ctaHoverBgColor: string;
  ctaHoverTextColor: string;
}

export const BANNER_THEME_PRESETS: Record<string, ThemeStylePreset> = {
  sky: {
    label: 'Sky Blue',
    solidColor: '#DCEBFF',
    gradientAngle: 120,
    gradientStops: [
      { color: '#DCEBFF', position: 0 },
      { color: '#C2DCFF', position: 100 },
    ],
    textColor: '#0B1F4B',
    subtitleColor: '#334155',
    highlightColor: '#0D63F3',
    ctaBgColor: '#0D63F3',
    ctaTextColor: '#FFFFFF',
    ctaHoverBgColor: '#0A52CC',
    ctaHoverTextColor: '#FFFFFF',
  },
  indigo: {
    label: 'Deep Navy',
    solidColor: '#0B1F4B',
    gradientAngle: 135,
    gradientStops: [
      { color: '#071636', position: 0 },
      { color: '#0D63F3', position: 100 },
    ],
    textColor: '#FFFFFF',
    subtitleColor: '#DBEAFE',
    highlightColor: '#60A5FA',
    ctaBgColor: '#FFFFFF',
    ctaTextColor: '#0B1F4B',
    ctaHoverBgColor: '#EFF6FF',
    ctaHoverTextColor: '#0B1F4B',
  },
  purple: {
    label: 'Royal Purple',
    solidColor: '#2E2157',
    gradientAngle: 120,
    gradientStops: [
      { color: '#2E2157', position: 0 },
      { color: '#4A3685', position: 100 },
    ],
    textColor: '#FFFFFF',
    subtitleColor: '#E9D5FF',
    highlightColor: '#FCD34D',
    ctaBgColor: '#F59E0B',
    ctaTextColor: '#0F172A',
    ctaHoverBgColor: '#D97706',
    ctaHoverTextColor: '#0F172A',
  },
  mint: {
    label: 'Fresh Mint',
    solidColor: '#D4F0E0',
    gradientAngle: 120,
    gradientStops: [
      { color: '#D4F0E0', position: 0 },
      { color: '#BEE6CF', position: 100 },
    ],
    textColor: '#0F172A',
    subtitleColor: '#1E293B',
    highlightColor: '#15803D',
    ctaBgColor: '#16A34A',
    ctaTextColor: '#FFFFFF',
    ctaHoverBgColor: '#15803D',
    ctaHoverTextColor: '#FFFFFF',
  },
  emerald: {
    label: 'Emerald',
    solidColor: '#065F46',
    gradientAngle: 135,
    gradientStops: [
      { color: '#064E3B', position: 0 },
      { color: '#059669', position: 100 },
    ],
    textColor: '#FFFFFF',
    subtitleColor: '#D1FAE5',
    highlightColor: '#6EE7B7',
    ctaBgColor: '#FFFFFF',
    ctaTextColor: '#064E3B',
    ctaHoverBgColor: '#ECFDF5',
    ctaHoverTextColor: '#064E3B',
  },
  amber: {
    label: 'Warm Amber',
    solidColor: '#F9DFAD',
    gradientAngle: 120,
    gradientStops: [
      { color: '#F9DFAD', position: 0 },
      { color: '#F3CA83', position: 100 },
    ],
    textColor: '#0F172A',
    subtitleColor: '#451A03',
    highlightColor: '#92400E',
    ctaBgColor: '#5C3A16',
    ctaTextColor: '#FFFFFF',
    ctaHoverBgColor: '#43290E',
    ctaHoverTextColor: '#FFFFFF',
  },
};

export function createDefaultBannerStyleConfig(theme = 'sky'): BannerStyleConfig {
  const preset = BANNER_THEME_PRESETS[theme] || BANNER_THEME_PRESETS.sky;
  return {
    backgroundMode: 'gradient',
    solidColor: preset.solidColor,
    gradientType: 'linear',
    gradientAngle: preset.gradientAngle,
    gradientStops: preset.gradientStops.map((s) => ({ ...s })),
    imagePosition: 'center',
    imagePosX: 50,
    imagePosY: 50,
    imageSize: 'cover',
    imageRepeat: 'no-repeat',
    imageScale: 1,
    imageRotation: 0,
    overlayMode: 'none',
    overlayColor: '#071636',
    overlaySecondaryColor: '#0D63F3',
    overlayAngle: 90,
    overlayOpacity: 45,
    heightPreset: 'md',
    customHeight: '220px',
    widthMode: 'container',
    borderRadius: 16,
    shadow: 'sm',
    paddingPreset: 'normal',
    eyebrow: '',
    description: '',
    textColor: preset.textColor,
    subtitleColor: preset.subtitleColor,
    highlightColor: preset.highlightColor,
    headingSize: 'md',
    headingWeight: 'extrabold',
    lineHeight: 'tight',
    maxContentWidth: 'md',
    ctaBgColor: preset.ctaBgColor,
    ctaTextColor: preset.ctaTextColor,
    ctaHoverBgColor: preset.ctaHoverBgColor,
    ctaHoverTextColor: preset.ctaHoverTextColor,
    ctaBorderColor: 'transparent',
    ctaRadius: 'md',
    ctaSize: 'md',
    alignHorizontal: 'left',
    alignVertical: 'center',
    foregroundImageUrl: '',
    foregroundPosition: 'right',
    foregroundSize: 'md',
    hoverEffect: 'none',
    mobileHeightPreset: 'inherit',
    mobileAlignHorizontal: 'inherit',
    mobileHeadingSize: 'inherit',
  };
}

export function mergeBannerStyleConfig(
  gradientTheme?: string,
  partial?: Partial<BannerStyleConfig> | null
): BannerStyleConfig {
  const base = createDefaultBannerStyleConfig(gradientTheme || 'sky');
  if (!partial) return base;
  const stops =
    Array.isArray(partial.gradientStops) && partial.gradientStops.length >= 2
      ? partial.gradientStops
          .slice(0, 4)
          .map((s) => ({
            color: typeof s?.color === 'string' && s.color.trim() ? s.color.trim() : '#0D63F3',
            position: clampNumber(Number(s?.position ?? 0), 0, 100),
          }))
      : base.gradientStops;

  return {
    ...base,
    ...partial,
    gradientAngle: clampNumber(Number(partial.gradientAngle ?? base.gradientAngle), 0, 360),
    gradientStops: stops,
    imagePosX: clampNumber(Number(partial.imagePosX ?? base.imagePosX), 0, 100),
    imagePosY: clampNumber(Number(partial.imagePosY ?? base.imagePosY), 0, 100),
    imageScale: clampNumber(Number(partial.imageScale ?? base.imageScale), 0.8, 1.5),
    imageRotation: clampNumber(Number(partial.imageRotation ?? base.imageRotation), -15, 15),
    overlayAngle: clampNumber(Number(partial.overlayAngle ?? base.overlayAngle), 0, 360),
    overlayOpacity: clampNumber(Number(partial.overlayOpacity ?? base.overlayOpacity), 0, 100),
    borderRadius: clampNumber(Number(partial.borderRadius ?? base.borderRadius), 0, 48),
  };
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function buildGradientCss(style: BannerStyleConfig): string {
  const sortedStops = [...style.gradientStops].sort((a, b) => a.position - b.position);
  const stopsText = sortedStops.map((s) => `${s.color} ${clampNumber(s.position, 0, 100)}%`).join(', ');
  if (style.gradientType === 'radial') {
    return `radial-gradient(circle at center, ${stopsText})`;
  }
  return `linear-gradient(${clampNumber(style.gradientAngle, 0, 360)}deg, ${stopsText})`;
}

export function hexToRgba(hex: string, alphaZeroToOne: number): string {
  const cleaned = hex.replace('#', '').trim();
  const alpha = clampNumber(alphaZeroToOne, 0, 1);
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
  }
  return `rgba(7, 22, 54, ${alpha.toFixed(2)})`;
}

export function buildOverlayCss(style: BannerStyleConfig): string | undefined {
  if (style.overlayMode === 'none') return undefined;
  const opacity = clampNumber(style.overlayOpacity, 0, 100) / 100;
  if (opacity <= 0) return undefined;

  if (style.overlayMode === 'solid') {
    return hexToRgba(style.overlayColor, opacity);
  }
  const c1 = hexToRgba(style.overlayColor, opacity);
  const c2 = hexToRgba(style.overlaySecondaryColor || style.overlayColor, Math.max(0.05, opacity * 0.25));
  return `linear-gradient(${clampNumber(style.overlayAngle, 0, 360)}deg, ${c1} 0%, ${c2} 100%)`;
}

export function resolveImageObjectPosition(style: BannerStyleConfig): string {
  if (style.imagePosition === 'custom') {
    return `${clampNumber(style.imagePosX, 0, 100)}% ${clampNumber(style.imagePosY, 0, 100)}%`;
  }
  return style.imagePosition;
}

export function resolveBannerMinHeight(
  style: BannerStyleConfig,
  position: BannerPosition,
  isMobile = false
): string {
  const effectivePreset =
    isMobile && style.mobileHeightPreset !== 'inherit' ? style.mobileHeightPreset : style.heightPreset;

  if (effectivePreset === 'custom' && style.customHeight.trim()) {
    return style.customHeight.trim();
  }

  if (position === 'seasonal_strip') {
    switch (effectivePreset) {
      case 'sm':
        return isMobile ? '130px' : '140px';
      case 'lg':
        return isMobile ? '220px' : '260px';
      case 'full':
        return isMobile ? '260px' : '320px';
      default:
        return isMobile ? '170px' : '195px';
    }
  }

  if (position === 'category_top') {
    switch (effectivePreset) {
      case 'sm':
        return isMobile ? '120px' : '135px';
      case 'lg':
        return isMobile ? '200px' : '230px';
      case 'full':
        return isMobile ? '240px' : '280px';
      default:
        return isMobile ? '155px' : '175px';
    }
  }

  switch (effectivePreset) {
    case 'sm':
      return isMobile ? '145px' : '155px';
    case 'lg':
      return isMobile ? '210px' : '240px';
    case 'full':
      return isMobile ? '250px' : '300px';
    default:
      return isMobile ? '170px' : '185px';
  }
}

export function resolveBannerShadowClass(shadow: BannerShadowPreset): string {
  switch (shadow) {
    case 'none':
      return 'shadow-none';
    case 'sm':
      return 'shadow-xs';
    case 'md':
      return 'shadow-md';
    case 'lg':
      return 'shadow-xl';
  }
}

export function resolvePaddingClass(padding: BannerPaddingPreset): string {
  switch (padding) {
    case 'compact':
      return 'p-4 sm:p-5';
    case 'spacious':
      return 'p-7 sm:p-9';
    default:
      return 'p-5 sm:p-6';
  }
}

export function normalizeHeroSliderConfig(raw?: Record<string, unknown> | null): HeroSliderConfig {
  if (!raw) return { ...DEFAULT_HERO_SLIDER_CONFIG };
  const duration = Number(raw.slideDurationMs);
  const transitionMs = Number(raw.transitionDurationMs);
  return {
    autoplay: raw.autoplay !== undefined ? Boolean(raw.autoplay) : DEFAULT_HERO_SLIDER_CONFIG.autoplay,
    slideDurationMs: Number.isFinite(duration) ? clampNumber(duration, 2000, 15000) : DEFAULT_HERO_SLIDER_CONFIG.slideDurationMs,
    transitionType: raw.transitionType === 'fade' ? 'fade' : 'slide',
    transitionDurationMs: Number.isFinite(transitionMs) ? clampNumber(transitionMs, 200, 1500) : DEFAULT_HERO_SLIDER_CONFIG.transitionDurationMs,
    pauseOnHover: raw.pauseOnHover !== undefined ? Boolean(raw.pauseOnHover) : DEFAULT_HERO_SLIDER_CONFIG.pauseOnHover,
    loop: raw.loop !== undefined ? Boolean(raw.loop) : DEFAULT_HERO_SLIDER_CONFIG.loop,
    showDots: raw.showDots !== undefined ? Boolean(raw.showDots) : DEFAULT_HERO_SLIDER_CONFIG.showDots,
    showArrows: raw.showArrows !== undefined ? Boolean(raw.showArrows) : DEFAULT_HERO_SLIDER_CONFIG.showArrows,
  };
}
