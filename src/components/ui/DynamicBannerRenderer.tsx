import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  BannerRecord,
  buildGradientCss,
  buildOverlayCss,
  mergeBannerStyleConfig,
  resolveBannerMinHeight,
  resolveBannerShadowClass,
  resolveImageObjectPosition,
  resolvePaddingClass,
} from '../../../shared/bannerStyle';
import { ImageWithFallback } from './ImageWithFallback';

interface DynamicBannerRendererProps {
  banner: BannerRecord;
  previewViewport?: 'desktop' | 'tablet' | 'mobile';
  disableNavigation?: boolean;
  className?: string;
}

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

export function DynamicBannerRenderer({
  banner,
  previewViewport,
  disableNavigation = false,
  className = '',
}: DynamicBannerRendererProps) {
  const [ctaHovered, setCtaHovered] = useState(false);
  const [cardHovered, setCardHovered] = useState(false);

  const isMobile = previewViewport === 'mobile';
  const style = mergeBannerStyleConfig(banner.gradientTheme, banner.styleConfig);
  const hasExplicitStyle = Boolean(banner.styleConfig && Object.keys(banner.styleConfig).length > 0);

  const bgImageSrc =
    isMobile && banner.mobileImageUrl?.trim() ? banner.mobileImageUrl.trim() : banner.imageUrl?.trim();

  const useBackgroundImage =
    style.backgroundMode === 'image' ||
    style.backgroundMode === 'image_overlay' ||
    style.backgroundMode === 'image_gradient_overlay';

  const foregroundSrc =
    style.foregroundImageUrl?.trim() ||
    (!hasExplicitStyle && banner.position === 'promo_trio' ? banner.imageUrl : '');

  const minHeight = resolveBannerMinHeight(style, banner.position, isMobile);
  const shadowClass = resolveBannerShadowClass(style.shadow);
  const paddingClass = resolvePaddingClass(style.paddingPreset);

  const overlayCss =
    style.backgroundMode === 'image_overlay' || style.backgroundMode === 'image_gradient_overlay'
      ? buildOverlayCss({
          ...style,
          overlayMode:
            style.overlayMode === 'none'
              ? style.backgroundMode === 'image_gradient_overlay'
                ? 'gradient'
                : 'solid'
              : style.overlayMode,
        })
      : buildOverlayCss(style);

  const effectiveAlignH =
    isMobile && style.mobileAlignHorizontal !== 'inherit'
      ? style.mobileAlignHorizontal
      : style.alignHorizontal;

  const effectiveHeadingSize =
    isMobile && style.mobileHeadingSize !== 'inherit'
      ? style.mobileHeadingSize
      : style.headingSize;

  const horizontalClass =
    effectiveAlignH === 'center'
      ? 'items-center text-center mx-auto'
      : effectiveAlignH === 'right'
        ? 'items-end text-right ml-auto'
        : 'items-start text-left';

  const verticalClass =
    style.alignVertical === 'top'
      ? 'justify-start'
      : style.alignVertical === 'bottom'
        ? 'justify-end'
        : 'justify-center';

  const headingSizeClass =
    effectiveHeadingSize === 'xl'
      ? 'text-2xl sm:text-3xl'
      : effectiveHeadingSize === 'lg'
        ? 'text-xl sm:text-2xl'
        : effectiveHeadingSize === 'sm'
          ? 'text-base sm:text-lg'
          : 'text-lg sm:text-xl';

  const headingWeightClass =
    style.headingWeight === 'black'
      ? 'font-black'
      : style.headingWeight === 'bold'
        ? 'font-bold'
        : style.headingWeight === 'semibold'
          ? 'font-semibold'
          : 'font-extrabold';

  const lineHeightClass =
    style.lineHeight === 'relaxed'
      ? 'leading-relaxed'
      : style.lineHeight === 'normal'
        ? 'leading-snug'
        : 'leading-tight';

  const contentWidthClass =
    style.maxContentWidth === 'sm'
      ? 'max-w-[260px]'
      : style.maxContentWidth === 'lg'
        ? 'max-w-xl'
        : 'max-w-md';

  const ctaRadiusClass =
    style.ctaRadius === 'full' ? 'rounded-full' : style.ctaRadius === 'xl' ? 'rounded-xl' : 'rounded-lg';

  const ctaSizeClass =
    style.ctaSize === 'lg'
      ? 'px-5 py-2.5 text-sm'
      : style.ctaSize === 'sm'
        ? 'px-3.5 py-1.5 text-[11px]'
        : 'px-4 py-2 text-xs';

  const fgSizeClass =
    style.foregroundSize === 'lg'
      ? 'w-32 h-32 sm:w-36 sm:h-36'
      : style.foregroundSize === 'sm'
        ? 'w-20 h-20 sm:w-24 sm:h-24'
        : 'w-28 h-28 sm:w-32 sm:h-32';

  const containerBackgroundStyle: React.CSSProperties = {
    minHeight,
    borderRadius: `${style.borderRadius}px`,
    backgroundColor: style.backgroundMode === 'solid' ? style.solidColor : undefined,
    backgroundImage: style.backgroundMode === 'gradient' ? buildGradientCss(style) : undefined,
    transform:
      style.hoverEffect === 'lift' && cardHovered ? 'translateY(-3px)' : undefined,
    transition: 'transform 220ms ease, box-shadow 220ms ease',
  };

  const bgImageTransformParts: string[] = [];
  if (style.imageScale !== 1) bgImageTransformParts.push(`scale(${style.imageScale})`);
  if (style.imageRotation !== 0) bgImageTransformParts.push(`rotate(${style.imageRotation}deg)`);
  if (style.hoverEffect === 'zoom_bg' && cardHovered) {
    bgImageTransformParts.push('scale(1.06)');
  }

  const hasLink = Boolean(banner.linkUrl && banner.linkUrl.trim());
  const ctaLabel = banner.ctaText?.trim() || '';

  const renderCta = () => {
    if (!hasLink || !ctaLabel) return null;
    const ctaStyles: React.CSSProperties = {
      backgroundColor: ctaHovered ? style.ctaHoverBgColor : style.ctaBgColor,
      color: ctaHovered ? style.ctaHoverTextColor : style.ctaTextColor,
      borderColor: style.ctaBorderColor || 'transparent',
      borderWidth: style.ctaBorderColor && style.ctaBorderColor !== 'transparent' ? '1px' : undefined,
    };

    if (disableNavigation) {
      return (
        <span
          onMouseEnter={() => setCtaHovered(true)}
          onMouseLeave={() => setCtaHovered(false)}
          style={ctaStyles}
          className={`inline-flex items-center gap-1.5 mt-3.5 font-bold shadow-xs transition-colors ${ctaRadiusClass} ${ctaSizeClass}`}
        >
          <span>{ctaLabel}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      );
    }

    if (isExternalUrl(banner.linkUrl || '')) {
      return (
        <a
          href={banner.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={() => setCtaHovered(true)}
          onMouseLeave={() => setCtaHovered(false)}
          style={ctaStyles}
          className={`inline-flex items-center gap-1.5 mt-3.5 font-bold shadow-xs transition-colors ${ctaRadiusClass} ${ctaSizeClass}`}
        >
          <span>{ctaLabel}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      );
    }

    return (
      <Link
        to={banner.linkUrl || '/'}
        onMouseEnter={() => setCtaHovered(true)}
        onMouseLeave={() => setCtaHovered(false)}
        style={ctaStyles}
        className={`inline-flex items-center gap-1.5 mt-3.5 font-bold shadow-xs transition-colors ${ctaRadiusClass} ${ctaSizeClass}`}
      >
        <span>{ctaLabel}</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    );
  };

  const innerContent = (
    <div
      onMouseEnter={() => setCardHovered(true)}
      onMouseLeave={() => setCardHovered(false)}
      style={containerBackgroundStyle}
      className={`relative overflow-hidden flex ${paddingClass} ${shadowClass} ${
        style.foregroundPosition === 'left' ? 'flex-row-reverse' : 'flex-row'
      } items-center justify-between gap-4 ${className}`}
    >
      {/* Background Image Layer */}
      {useBackgroundImage && bgImageSrc && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none transition-transform duration-300"
          style={{
            backgroundImage: `url("${bgImageSrc}")`,
            backgroundPosition: resolveImageObjectPosition(style),
            backgroundSize: style.imageSize,
            backgroundRepeat: style.imageRepeat,
            transform: bgImageTransformParts.length > 0 ? bgImageTransformParts.join(' ') : undefined,
          }}
        />
      )}

      {/* Overlay Layer */}
      {overlayCss && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ background: overlayCss }}
        />
      )}

      {/* Subtle Shine Hover */}
      {style.hoverEffect === 'shine' && cardHovered && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-white/15 to-transparent"
        />
      )}

      {/* Text Content Column */}
      <div className={`relative z-10 flex flex-col flex-1 min-w-0 ${horizontalClass} ${verticalClass} ${contentWidthClass}`}>
        {style.eyebrow && (
          <span
            style={{ color: style.highlightColor }}
            className="text-[11px] font-extrabold uppercase tracking-wider mb-1"
          >
            {style.eyebrow}
          </span>
        )}
        {banner.title && (
          <h3
            style={{ color: style.textColor }}
            className={`${headingSizeClass} ${headingWeightClass} ${lineHeightClass}`}
          >
            {banner.title}
          </h3>
        )}
        {banner.highlightText && (
          <p style={{ color: style.highlightColor }} className="text-sm sm:text-base font-bold mt-1">
            {banner.highlightText}
          </p>
        )}
        {(banner.subtitle || style.description) && (
          <p style={{ color: style.subtitleColor }} className="text-xs sm:text-sm font-medium mt-1.5 line-clamp-2">
            {banner.subtitle || style.description}
          </p>
        )}
        {renderCta()}
      </div>

      {/* Optional Foreground Image / Product Cutout */}
      {foregroundSrc && (
        <div
          className={`relative z-10 ${fgSizeClass} rounded-xl overflow-hidden bg-white/20 shrink-0 shadow-sm border border-white/20`}
        >
          <ImageWithFallback src={foregroundSrc} alt={banner.title || 'Banner visual'} className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );

  // If banner has a link but NO CTA button text, make entire banner clickable cleanly
  if (hasLink && !ctaLabel && !disableNavigation) {
    if (isExternalUrl(banner.linkUrl || '')) {
      return (
        <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" className="block">
          {innerContent}
        </a>
      );
    }
    return (
      <Link to={banner.linkUrl || '/'} className="block">
        {innerContent}
      </Link>
    );
  }

  return innerContent;
}
