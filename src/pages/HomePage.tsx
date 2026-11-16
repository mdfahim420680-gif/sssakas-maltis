import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Gamepad2,
  Headphones,
  Heart,
  Home,
  Laptop,
  Mail,
  Monitor,
  Package,
  RefreshCw,
  ShieldCheck,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Tag,
  Trophy,
  Truck,
  Zap,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { ProductCard, ProductCardItem } from '../components/ui/ProductCard';
import { ImageWithFallback } from '../components/ui/ImageWithFallback';
import { DynamicBannerRenderer } from '../components/ui/DynamicBannerRenderer';
import {
  BannerRecord,
  HeroSliderConfig,
  normalizeHeroSliderConfig,
} from '../../shared/bannerStyle';
import { pushToast } from '../store/uiSlice';
import { RootState } from '../store';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Laptop,
  Shirt,
  Sparkles,
  Heart,
  Home,
  ShoppingBasket,
  Trophy,
  Smartphone,
  Monitor,
  BookOpen,
  Gamepad2,
  Package,
};

interface HomepagePayload {
  cmsSections: Array<{
    key: string;
    title: string;
    subtitle?: string;
    visible: boolean;
    displayOrder: number;
    config?: Record<string, unknown>;
  }>;
  heroSliderConfig?: HeroSliderConfig;
  heroBanners: BannerRecord[];
  promoBanners: BannerRecord[];
  seasonalBanners?: BannerRecord[];
  categories: Array<{
    _id: string;
    name: string;
    bnName: string;
    slug: string;
    iconName?: string;
    imageUrl?: string;
    accentBg?: string;
    isFeatured: boolean;
  }>;
  brands: Array<{ _id: string; name: string; slug: string; logoText?: string; logoUrl?: string }>;
  topStores: Array<{
    _id: string;
    name: string;
    slug: string;
    verified: boolean;
    ratingAvg: number;
    ratingCount: number;
    productCount: number;
  }>;
  flashSale: {
    name: string;
    endAt: string;
    products: ProductCardItem[];
  };
  trendingProducts: ProductCardItem[];
  bestSellingProducts: ProductCardItem[];
  newArrivals: ProductCardItem[];
  advertisements: Array<{
    _id: string;
    name: string;
    campaign: string;
    adType: string;
    placement: string;
    destinationLink: string;
  }>;
}

function useCountdown(targetIso?: string) {
  const [left, setLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  useEffect(() => {
    if (!targetIso) return;
    const update = () => {
      const diff = Math.max(0, new Date(targetIso).getTime() - Date.now());
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const mins = Math.floor((diff / (1000 * 60)) % 60);
      const secs = Math.floor((diff / 1000) % 60);
      setLeft({ days, hours, mins, secs });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  return left;
}

export function HomePage() {
  const dispatch = useDispatch();
  const language = useSelector((s: RootState) => s.ui.language);
  const [data, setData] = useState<HomepagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [heroIdx, setHeroIdx] = useState(0);
  const [isHeroHovered, setIsHeroHovered] = useState(false);
  const [productTab, setProductTab] = useState<'trending' | 'best_selling' | 'new_arrivals'>('trending');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  const fetchHomepage = () => {
    setLoading(true);
    setLoadError(null);
    apiRequest<HomepagePayload>('/api/catalog/homepage')
      .then((res) => {
        if (!res || typeof res !== 'object') {
          throw new Error('Invalid storefront payload received');
        }
        setData(res);
      })
      .catch((err: unknown) => {
        setData(null);
        setLoadError(err instanceof Error ? err.message : 'Unable to reach the NOVARA catalog service.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHomepage();
  }, []);

  const heroSliderConfig = normalizeHeroSliderConfig(
    (data?.heroSliderConfig as unknown as Record<string, unknown> | undefined) || null
  );
  const heroCount = Array.isArray(data?.heroBanners) ? data.heroBanners.length : 0;

  useEffect(() => {
    if (heroCount > 0 && heroIdx >= heroCount) {
      setHeroIdx(0);
    }
  }, [heroCount, heroIdx]);

  useEffect(() => {
    if (heroCount < 2 || !heroSliderConfig.autoplay) return;
    if (isHeroHovered && heroSliderConfig.pauseOnHover) return;
    const t = setInterval(() => {
      setHeroIdx((prev) => {
        if (heroSliderConfig.loop) return (prev + 1) % heroCount;
        return prev < heroCount - 1 ? prev + 1 : prev;
      });
    }, heroSliderConfig.slideDurationMs);
    return () => clearInterval(t);
  }, [
    heroCount,
    heroSliderConfig.autoplay,
    heroSliderConfig.slideDurationMs,
    heroSliderConfig.pauseOnHover,
    heroSliderConfig.loop,
    isHeroHovered,
  ]);

  const countdown = useCountdown(data?.flashSale?.endAt);

  const getSection = (key: string) =>
    Array.isArray(data?.cmsSections) ? data.cmsSections.find((s) => s.key === key) : undefined;

  const isSectionVisible = (key: string) => {
    if (!Array.isArray(data?.cmsSections) || data.cmsSections.length === 0) return true;
    const sec = getSection(key);
    return sec ? sec.visible : true;
  };

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setSubscribing(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/catalog/newsletter', {
        method: 'POST',
        body: JSON.stringify({ email: newsletterEmail }),
      });
      dispatch(pushToast({ type: 'success', title: 'Subscribed', message: res.message }));
      setNewsletterEmail('');
    } catch (err: unknown) {
      dispatch(
        pushToast({
          type: 'error',
          title: 'Subscription failed',
          message: err instanceof Error ? err.message : 'Unable to subscribe right now.',
        })
      );
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1360px] mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="hidden lg:block lg:col-span-3 h-[380px] rounded-2xl bg-slate-200/70 animate-pulse" />
          <div className="lg:col-span-9 h-[380px] rounded-2xl bg-slate-200/70 animate-pulse" />
        </div>
        <div className="h-20 rounded-2xl bg-slate-200/70 animate-pulse" />
        <div className="h-72 rounded-2xl bg-slate-200/70 animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
        <h1 className="text-lg font-bold text-slate-900">Unable to load storefront</h1>
        <p className="text-sm text-slate-600">{loadError || 'Please refresh to reconnect to the NOVARA catalog.'}</p>
        <button
          type="button"
          onClick={fetchHomepage}
          className="px-5 py-2.5 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold cursor-pointer"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const heroBanners = Array.isArray(data.heroBanners) ? data.heroBanners : [];
  const promoBanners = Array.isArray(data.promoBanners) ? data.promoBanners : [];
  const seasonalBanners = Array.isArray(data.seasonalBanners) ? data.seasonalBanners : [];
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const brands = Array.isArray(data.brands) ? data.brands : [];
  const topStores = Array.isArray(data.topStores) ? data.topStores : [];
  const flashProducts = Array.isArray(data.flashSale?.products) ? data.flashSale.products : [];
  const trendingProducts = Array.isArray(data.trendingProducts) ? data.trendingProducts : [];
  const bestSellingProducts = Array.isArray(data.bestSellingProducts) ? data.bestSellingProducts : [];
  const newArrivals = Array.isArray(data.newArrivals) ? data.newArrivals : [];

  const safeHeroIdx = heroBanners.length > 0 ? Math.min(heroIdx, heroBanners.length - 1) : 0;
  const goPrevHero = () => {
    if (heroBanners.length < 2) return;
    setHeroIdx((prev) => {
      if (heroSliderConfig.loop) return (prev - 1 + heroBanners.length) % heroBanners.length;
      return Math.max(0, prev - 1);
    });
  };
  const goNextHero = () => {
    if (heroBanners.length < 2) return;
    setHeroIdx((prev) => {
      if (heroSliderConfig.loop) return (prev + 1) % heroBanners.length;
      return Math.min(heroBanners.length - 1, prev + 1);
    });
  };

  const tabProducts =
    productTab === 'trending'
      ? trendingProducts
      : productTab === 'best_selling'
        ? bestSellingProducts
        : newArrivals;

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="max-w-[1360px] mx-auto px-4 py-5 space-y-6">
      {/* Row 1: Category Sidebar + Dynamic Hero Banner Carousel */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <aside
          aria-label="Product categories"
          className="hidden lg:flex lg:col-span-3 xl:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex-col py-2.5"
        >
          <div className="flex-1 divide-y divide-slate-100/70">
            {categories.slice(0, 10).map((cat) => {
              const Icon = ICON_MAP[cat.iconName || 'Package'] || Package;
              return (
                <Link
                  key={cat._id}
                  to={`/category/${cat.slug}`}
                  className="flex items-center justify-between px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-blue-50/70 hover:text-[#0D63F3] transition-colors"
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="truncate">{language === 'bn' ? cat.bnName : cat.name}</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                </Link>
              );
            })}
          </div>
          <Link
            to="/search"
            className="mt-1 mx-3 py-2 text-center text-xs font-semibold text-slate-600 hover:text-[#0D63F3] border-t border-slate-100"
          >
            More Categories →
          </Link>
        </aside>

        {/* Hero Banner Carousel */}
        {heroBanners.length > 0 && (
          <div
            onMouseEnter={() => setIsHeroHovered(true)}
            onMouseLeave={() => setIsHeroHovered(false)}
            className="lg:col-span-9 xl:col-span-10 relative rounded-2xl overflow-hidden border border-slate-200/80 min-h-[340px] sm:min-h-[400px] bg-slate-100"
          >
            {heroSliderConfig.transitionType === 'slide' ? (
              <div
                className="flex h-full min-h-[340px] sm:min-h-[400px] transition-transform ease-out"
                style={{
                  transform: `translateX(-${safeHeroIdx * 100}%)`,
                  transitionDuration: `${heroSliderConfig.transitionDurationMs}ms`,
                }}
              >
                {heroBanners.map((slide) => {
                  const isImageOnly =
                    !slide.title?.trim() &&
                    !slide.highlightText?.trim() &&
                    !slide.subtitle?.trim() &&
                    !slide.ctaText?.trim();
                  const hasLink = Boolean(slide.linkUrl && slide.linkUrl.trim());
                  const isExternal = hasLink && /^https?:\/\//i.test(slide.linkUrl!.trim());

                  if (isImageOnly) {
                    const imgEl = (
                      <picture className="block w-full h-full min-h-[340px] sm:min-h-[400px]">
                        {slide.mobileImageUrl?.trim() && (
                          <source media="(max-width: 639px)" srcSet={slide.mobileImageUrl.trim()} />
                        )}
                        <img
                          src={slide.imageUrl}
                          alt={slide.campaignName || 'Featured promotion'}
                          referrerPolicy="no-referrer"
                          className="w-full h-full min-h-[340px] sm:min-h-[400px] max-h-[430px] object-cover block"
                        />
                      </picture>
                    );

                    if (hasLink && isExternal) {
                      return (
                        <a
                          key={slide._id}
                          href={slide.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full shrink-0 block"
                        >
                          {imgEl}
                        </a>
                      );
                    }
                    if (hasLink) {
                      return (
                        <Link key={slide._id} to={slide.linkUrl || '/'} className="w-full shrink-0 block">
                          {imgEl}
                        </Link>
                      );
                    }
                    return (
                      <div key={slide._id} className="w-full shrink-0">
                        {imgEl}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={slide._id}
                      className="w-full shrink-0 relative bg-gradient-to-r from-[#D9EAFF] via-[#EBF4FF] to-[#CBE2FF] min-h-[340px] sm:min-h-[400px] flex items-center"
                    >
                      <picture>
                        {slide.mobileImageUrl?.trim() && (
                          <source media="(max-width: 639px)" srcSet={slide.mobileImageUrl.trim()} />
                        )}
                        <img
                          src={slide.imageUrl}
                          alt={slide.title || 'Featured promotion'}
                          referrerPolicy="no-referrer"
                          className="absolute right-0 top-0 h-full w-full lg:w-[68%] object-cover object-center opacity-95"
                        />
                      </picture>
                      <div className="absolute inset-0 bg-gradient-to-r from-[#DCEBFF] via-[#E5F0FF]/85 lg:via-[#E5F0FF]/65 to-transparent" />

                      <div className="relative z-10 px-14 sm:px-16 py-10 max-w-xl">
                        {slide.title && (
                          <h1 className="text-2xl sm:text-4xl font-extrabold text-[#0B1F4B] tracking-tight leading-tight">
                            {slide.title}
                          </h1>
                        )}
                        {slide.highlightText && (
                          <p className="text-3xl sm:text-5xl font-black text-[#0D63F3] tracking-tight mt-1">
                            {slide.highlightText}
                          </p>
                        )}
                        {slide.subtitle && (
                          <p className="text-sm sm:text-lg font-semibold text-slate-700 mt-3">{slide.subtitle}</p>
                        )}
                        {hasLink && slide.ctaText?.trim() &&
                          (isExternal ? (
                            <a
                              href={slide.linkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-sm font-bold shadow-md transition-colors"
                            >
                              {slide.ctaText}
                              <ArrowRight className="w-4 h-4" />
                            </a>
                          ) : (
                            <Link
                              to={slide.linkUrl || '/'}
                              className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-sm font-bold shadow-md transition-colors"
                            >
                              {slide.ctaText}
                              <ArrowRight className="w-4 h-4" />
                            </Link>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="relative w-full h-full min-h-[340px] sm:min-h-[400px]">
                {heroBanners.map((slide, idx) => {
                  const isActive = idx === safeHeroIdx;
                  const isImageOnly =
                    !slide.title?.trim() &&
                    !slide.highlightText?.trim() &&
                    !slide.subtitle?.trim() &&
                    !slide.ctaText?.trim();
                  const hasLink = Boolean(slide.linkUrl && slide.linkUrl.trim());
                  const isExternal = hasLink && /^https?:\/\//i.test(slide.linkUrl!.trim());

                  const fadeStyle: React.CSSProperties = {
                    transitionDuration: `${heroSliderConfig.transitionDurationMs}ms`,
                  };

                  if (isImageOnly) {
                    const imgEl = (
                      <picture className="block w-full h-full min-h-[340px] sm:min-h-[400px]">
                        {slide.mobileImageUrl?.trim() && (
                          <source media="(max-width: 639px)" srcSet={slide.mobileImageUrl.trim()} />
                        )}
                        <img
                          src={slide.imageUrl}
                          alt={slide.campaignName || 'Featured promotion'}
                          referrerPolicy="no-referrer"
                          className="w-full h-full min-h-[340px] sm:min-h-[400px] max-h-[430px] object-cover block"
                        />
                      </picture>
                    );

                    const wrapperClass = `absolute inset-0 transition-opacity ease-in-out ${
                      isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                    }`;

                    if (hasLink && isExternal) {
                      return (
                        <a
                          key={slide._id}
                          href={slide.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={fadeStyle}
                          className={wrapperClass}
                        >
                          {imgEl}
                        </a>
                      );
                    }
                    if (hasLink) {
                      return (
                        <Link key={slide._id} to={slide.linkUrl || '/'} style={fadeStyle} className={wrapperClass}>
                          {imgEl}
                        </Link>
                      );
                    }
                    return (
                      <div key={slide._id} style={fadeStyle} className={wrapperClass}>
                        {imgEl}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={slide._id}
                      style={fadeStyle}
                      className={`absolute inset-0 bg-gradient-to-r from-[#D9EAFF] via-[#EBF4FF] to-[#CBE2FF] flex items-center transition-opacity ease-in-out ${
                        isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                      }`}
                    >
                      <picture>
                        {slide.mobileImageUrl?.trim() && (
                          <source media="(max-width: 639px)" srcSet={slide.mobileImageUrl.trim()} />
                        )}
                        <img
                          src={slide.imageUrl}
                          alt={slide.title || 'Featured promotion'}
                          referrerPolicy="no-referrer"
                          className="absolute right-0 top-0 h-full w-full lg:w-[68%] object-cover object-center opacity-95"
                        />
                      </picture>
                      <div className="absolute inset-0 bg-gradient-to-r from-[#DCEBFF] via-[#E5F0FF]/85 lg:via-[#E5F0FF]/65 to-transparent" />

                      <div className="relative z-10 px-14 sm:px-16 py-10 max-w-xl">
                        {slide.title && (
                          <h1 className="text-2xl sm:text-4xl font-extrabold text-[#0B1F4B] tracking-tight leading-tight">
                            {slide.title}
                          </h1>
                        )}
                        {slide.highlightText && (
                          <p className="text-3xl sm:text-5xl font-black text-[#0D63F3] tracking-tight mt-1">
                            {slide.highlightText}
                          </p>
                        )}
                        {slide.subtitle && (
                          <p className="text-sm sm:text-lg font-semibold text-slate-700 mt-3">{slide.subtitle}</p>
                        )}
                        {hasLink && slide.ctaText?.trim() &&
                          (isExternal ? (
                            <a
                              href={slide.linkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-sm font-bold shadow-md transition-colors"
                            >
                              {slide.ctaText}
                              <ArrowRight className="w-4 h-4" />
                            </a>
                          ) : (
                            <Link
                              to={slide.linkUrl || '/'}
                              className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-sm font-bold shadow-md transition-colors"
                            >
                              {slide.ctaText}
                              <ArrowRight className="w-4 h-4" />
                            </Link>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Navigation Arrows */}
            {heroBanners.length > 1 && heroSliderConfig.showArrows && (
              <>
                <button
                  type="button"
                  aria-label="Previous hero slide"
                  onClick={goPrevHero}
                  disabled={!heroSliderConfig.loop && safeHeroIdx === 0}
                  className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/90 hover:bg-white text-slate-900 shadow-md flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next hero slide"
                  onClick={goNextHero}
                  disabled={!heroSliderConfig.loop && safeHeroIdx === heroBanners.length - 1}
                  className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/90 hover:bg-white text-slate-900 shadow-md flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </>
            )}

            {/* Dot Indicators */}
            {heroBanners.length > 1 && heroSliderConfig.showDots && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-950/20 backdrop-blur-[2px] px-2.5 py-1.5 rounded-full">
                {heroBanners.map((b, i) => (
                  <button
                    key={b._id}
                    type="button"
                    aria-label={`View banner ${i + 1}${b.title ? `: ${b.title}` : ''}`}
                    onClick={() => setHeroIdx(i)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      i === safeHeroIdx ? 'w-6 bg-[#0D63F3]' : 'w-2 bg-white/85 hover:bg-white'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Row 2: 5-Column Trust & Service Strip */}
      {isSectionVisible('trust_strip') && (
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/70">
          {[
            { icon: Truck, title: 'Fast Delivery', sub: 'Across Bangladesh' },
            { icon: ShieldCheck, title: 'Secure Payment', sub: '100% Secure' },
            { icon: RefreshCw, title: 'Easy Return', sub: '7 Days Return' },
            { icon: Headphones, title: '24/7 Support', sub: 'Always Here' },
            { icon: Award, title: 'Trusted Sellers', sub: 'Top Rated Shops' },
          ].map((item) => (
            <div key={item.title} className="flex items-center gap-3 px-5 py-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0D63F3] flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-900">{item.title}</p>
                <p className="text-[11px] text-slate-500">{item.sub}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Row 3: Flash Sale (Dark countdown box + 4-column product cards) */}
      {isSectionVisible('flash_sale') && flashProducts.length > 0 && (
        <section className="rounded-2xl bg-gradient-to-r from-[#E6F0FF] via-[#F2F7FF] to-[#EBF3FF] border border-blue-200/60 p-5 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            <div className="lg:col-span-3 space-y-4">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xl sm:text-2xl font-extrabold text-[#0B1F4B]">
                  <Zap className="w-6 h-6 text-amber-500 fill-amber-500" />
                  <span>{getSection('flash_sale')?.title || data.flashSale?.name || 'Flash Sale'}</span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-slate-600 mt-1">
                  {getSection('flash_sale')?.subtitle || 'Limited Time Offer'}
                </p>
              </div>

              {/* Countdown */}
              <div className="grid grid-cols-4 gap-2 max-w-[260px]" aria-label="Flash sale countdown">
                {[
                  { label: 'Days', val: pad(countdown.days) },
                  { label: 'Hours', val: pad(countdown.hours) },
                  { label: 'Min', val: pad(countdown.mins) },
                  { label: 'Sec', val: pad(countdown.secs) },
                ].map((unit) => (
                  <div key={unit.label} className="bg-[#0B1F4B] text-white rounded-xl py-2.5 text-center shadow-xs">
                    <span className="block text-base sm:text-lg font-bold font-mono-num leading-none">
                      {unit.val}
                    </span>
                    <span className="block text-[10px] text-slate-300 mt-1">{unit.label}</span>
                  </div>
                ))}
              </div>

              <Link
                to="/search?discounted=true"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold shadow-sm"
              >
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="lg:col-span-9 grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {flashProducts.slice(0, 4).map((prod) => (
                <ProductCard key={prod._id} product={prod} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Row 4: Shop by Category */}
      {isSectionVisible('shop_by_category') && categories.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              {getSection('shop_by_category')?.title || 'Shop by Category'}
            </h2>
            <Link
              to="/search"
              className="text-xs sm:text-sm font-semibold text-[#0D63F3] hover:underline flex items-center gap-1"
            >
              View All Categories <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3.5">
            {categories.filter((c) => c.isFeatured).slice(0, 8).map((cat) => (
              <Link
                key={cat._id}
                to={`/category/${cat.slug}`}
                className="group bg-white rounded-xl border border-slate-200/80 hover:border-blue-300 hover:shadow-sm p-3 flex flex-col items-center text-center transition-all"
              >
                <div
                  className="w-16 h-16 rounded-xl overflow-hidden mb-2.5 flex items-center justify-center"
                  style={{ backgroundColor: cat.accentBg || '#EFF6FF' }}
                >
                  <ImageWithFallback
                    src={cat.imageUrl}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <span className="text-[11.5px] leading-snug font-semibold text-slate-800 group-hover:text-[#0D63F3] line-clamp-2">
                  {language === 'bn' ? cat.bnName : cat.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Row 5: 3 Promotional Campaign Banners */}
      {isSectionVisible('promo_banners') && promoBanners.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {promoBanners.slice(0, 3).map((banner) => (
            <DynamicBannerRenderer key={banner._id} banner={banner} />
          ))}
        </section>
      )}

      {/* Row 5b: Seasonal Strip Dynamic Banners */}
      {isSectionVisible('seasonal_banners') && seasonalBanners.length > 0 && (
        <section className="space-y-4">
          {seasonalBanners.map((banner) => (
            <DynamicBannerRenderer key={banner._id} banner={banner} />
          ))}
        </section>
      )}

      {/* Row 6: Split 50/50 Top Rated Sellers & Trending / Best Selling / New Arrivals */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Left: Top Rated Sellers */}
        {isSectionVisible('top_sellers') && topStores.length > 0 && (
          <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {getSection('top_sellers')?.title || 'Top Rated Sellers'}
                </h2>
              </div>
              <Link to="/shops" className="text-xs font-semibold text-[#0D63F3] hover:underline flex items-center gap-1">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              {topStores.slice(0, 3).map((store, i) => {
                const avatarColors = ['bg-[#0B1F4B]', 'bg-[#E11D48]', 'bg-[#0F172A]'];
                return (
                  <div
                    key={store._id}
                    className="rounded-xl border border-slate-200/90 p-3.5 flex flex-col items-center text-center justify-between hover:border-blue-300 transition-colors"
                  >
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-12 h-12 rounded-full ${avatarColors[i % avatarColors.length]} text-white font-extrabold text-sm flex items-center justify-center mb-2.5`}
                      >
                        {store.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex items-center gap-1 justify-center">
                        <span className="text-xs font-bold text-slate-900 line-clamp-1">{store.name}</span>
                        {store.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#0D63F3] shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-600 mt-1">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span className="font-semibold tabular-nums">{store.ratingAvg.toFixed(1)}</span>
                        <span className="text-slate-400 tabular-nums">({store.ratingCount})</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 tabular-nums">{store.productCount} Products</p>
                    </div>

                    <Link
                      to={`/shop/${store.slug}`}
                      className="w-full mt-3 py-1.5 rounded-lg bg-[#0D63F3] hover:bg-[#0A52CC] text-white text-xs font-bold transition-colors"
                    >
                      Shop Now
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Right: Trending / Best Selling / New Arrivals */}
        {isSectionVisible('product_tabs') && (
          <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-[#EF3E36]" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {getSection('product_tabs')?.title || 'Trending Products'}
                </h2>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {[
                  { id: 'trending', label: 'Trending' },
                  { id: 'best_selling', label: 'Best Selling' },
                  { id: 'new_arrivals', label: 'New Arrivals' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setProductTab(tab.id as any)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      productTab === tab.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <Link to="/search" className="text-xs font-semibold text-[#0D63F3] hover:underline flex items-center gap-1">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {tabProducts.slice(0, 4).map((prod) => (
                <ProductCard key={prod._id} product={prod} compact />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Row 7: Popular Brands */}
      {isSectionVisible('popular_brands') && brands.length > 0 && (
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#0D63F3]" />
              <h2 className="text-lg font-bold text-slate-900">Popular Brands</h2>
            </div>
            <Link to="/search" className="text-xs font-semibold text-[#0D63F3] hover:underline flex items-center gap-1">
              View All Brands <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {brands.slice(0, 8).map((brand) => (
              <Link
                key={brand._id}
                to={`/search?brand=${brand.slug}`}
                className="h-16 bg-white rounded-xl border border-slate-200/80 hover:border-blue-300 hover:shadow-xs flex items-center justify-center px-3 text-sm font-extrabold tracking-wide text-slate-800 hover:text-[#0D63F3] transition-all"
              >
                {brand.logoUrl ? (
                  <img
                    src={brand.logoUrl}
                    alt={brand.name}
                    className="max-h-9 max-w-full object-contain"
                  />
                ) : (
                  brand.logoText || brand.name
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Row 8: Why Shop With Us / Newsletter / Download App */}
      {isSectionVisible('newsletter_app_row') && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-3 rounded-2xl bg-gradient-to-br from-[#EDF5FF] to-white border border-blue-100 p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#0D63F3]/10 text-[#0D63F3] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-1.5">Why Shop With Us?</h3>
              <ul className="space-y-1 text-[11.5px] text-slate-600">
                {['Fast Delivery', 'Secure Payment', 'Easy Return', 'Trusted Sellers', '24/7 Support'].map((pt) => (
                  <li key={pt} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-6 rounded-2xl bg-gradient-to-r from-[#2D77F6] to-[#125BE0] text-white p-6 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold">Subscribe to Our Newsletter</h3>
                <p className="text-xs text-blue-100">Get exclusive offers and latest updates in Bangladesh</p>
              </div>
            </div>
            <form onSubmit={handleNewsletter} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="Enter your email address"
                aria-label="Newsletter email address"
                className="flex-1 h-11 px-4 rounded-xl bg-white text-slate-900 text-sm placeholder:text-slate-400 outline-none"
              />
              <button
                type="submit"
                disabled={subscribing}
                className="h-11 px-6 rounded-xl bg-[#0B1F4B] hover:bg-[#071535] text-white text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                {subscribing ? 'Subscribing...' : 'Subscribe'} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          <div className="lg:col-span-3 rounded-2xl bg-gradient-to-br from-[#EBF3FF] to-white border border-blue-100 p-5 flex flex-col justify-center">
            <h3 className="text-sm font-bold text-slate-900">Shop Mobile-First</h3>
            <p className="text-xs text-slate-600 mt-1">
              Optimized for 4G/3G networks across all 64 districts of Bangladesh.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <Link
                to="/search"
                className="px-3.5 py-2 rounded-lg bg-[#0B1F4B] text-white text-[11px] font-bold hover:bg-slate-800"
              >
                Browse Catalog
              </Link>
              <Link
                to="/become-a-seller"
                className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-[11px] font-bold hover:bg-slate-50"
              >
                Sell on NOVARA
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
