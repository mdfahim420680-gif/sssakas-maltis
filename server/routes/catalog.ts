import { Router } from 'express';
import { AuthRequest, optionalAuth, requireAuth } from '../middleware/auth';
import { Brand, CanonicalProduct, Category, SellerOffer } from '../models/Catalog';
import { Store } from '../models/Seller';
import {
  Advertisement,
  Banner,
  CmsSection,
  PlatformSettings,
  Promotion,
} from '../models/Cms';
import { NewsletterSubscriber, Review, ReviewReport } from '../models/Engagement';
import { SubOrder } from '../models/Order';
import {
  attachBestOffersToProducts,
  getDynamicProductDetails,
  searchCatalogProducts,
} from '../services/catalogService';
import { reviewSchema } from '../../shared/validation';
import { getIntegrationStatus } from '../config/env';
import { normalizeHeroSliderConfig } from '../../shared/bannerStyle';

const router = Router();

router.get('/homepage', async (_req, res) => {
  try {
    const now = new Date();
    const scheduleFilter = {
      active: true,
      $and: [
        { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: now } }] },
      ],
    };

    const [
      settings,
      cmsSections,
      banners,
      categories,
      brands,
      topStores,
      flashPromotion,
      ads,
    ] = await Promise.all([
      PlatformSettings.findOne({ key: 'global' }).lean(),
      CmsSection.find().sort({ displayOrder: 1 }).lean(),
      Banner.find(scheduleFilter).sort({ displayOrder: 1 }).lean(),
      Category.find({ active: true, parentId: null }).sort({ displayOrder: 1 }).lean(),
      Brand.find({ active: true, isPopular: true }).sort({ displayOrder: 1 }).limit(8).lean(),
      Store.find({ status: 'active', verified: true })
        .sort({ isFeatured: -1, ratingAvg: -1 })
        .limit(6)
        .lean(),
      Promotion.findOne({
        type: 'flash_sale',
        active: true,
        startAt: { $lte: now },
        endAt: { $gte: now },
      }).lean(),
      Advertisement.find({
        active: true,
        $and: [
          { $or: [{ startAt: { $exists: false } }, { startAt: null }, { startAt: { $lte: now } }] },
          { $or: [{ endAt: { $exists: false } }, { endAt: null }, { endAt: { $gte: now } }] },
        ],
      })
        .sort({ priority: -1 })
        .lean(),
    ]);

    // Flash sale products
    let flashProducts: any[] = [];
    if (flashPromotion && flashPromotion.productIds.length > 0) {
      const rawFlash = await CanonicalProduct.find({
        _id: { $in: flashPromotion.productIds },
        moderationStatus: 'published',
      })
        .populate('categoryId', 'name slug')
        .populate('brandId', 'name slug')
        .lean();
      flashProducts = await attachBestOffersToProducts(rawFlash);
    } else {
      const rawFlash = await CanonicalProduct.find({
        isFlashSaleCandidate: true,
        moderationStatus: 'published',
      })
        .populate('categoryId', 'name slug')
        .populate('brandId', 'name slug')
        .limit(8)
        .lean();
      flashProducts = await attachBestOffersToProducts(rawFlash);
    }

    // Trending, Best Selling, New Arrivals (all real DB queries)
    const [rawTrending, rawBestSelling, rawNewArrivals] = await Promise.all([
      CanonicalProduct.find({ moderationStatus: 'published', isTrending: true })
        .populate('categoryId', 'name slug')
        .populate('brandId', 'name slug')
        .sort({ viewCount: -1, totalSold: -1 })
        .limit(8)
        .lean(),
      CanonicalProduct.find({ moderationStatus: 'published' })
        .populate('categoryId', 'name slug')
        .populate('brandId', 'name slug')
        .sort({ totalSold: -1 })
        .limit(8)
        .lean(),
      CanonicalProduct.find({ moderationStatus: 'published' })
        .populate('categoryId', 'name slug')
        .populate('brandId', 'name slug')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
    ]);

    const [trendingProducts, bestSellingProducts, newArrivals] = await Promise.all([
      attachBestOffersToProducts(rawTrending),
      attachBestOffersToProducts(rawBestSelling),
      attachBestOffersToProducts(rawNewArrivals),
    ]);

    // Increment ad impressions for active homepage ads
    const homepageAdIds = ads.filter((a) => a.placement.startsWith('homepage')).map((a) => a._id);
    if (homepageAdIds.length > 0) {
      Advertisement.updateMany({ _id: { $in: homepageAdIds } }, { $inc: { impressions: 1 } }).catch(() => {});
    }

    const heroSliderSection = cmsSections.find((s) => s.key === 'hero_slider');
    const heroSliderConfig = normalizeHeroSliderConfig(
      (heroSliderSection?.config as Record<string, unknown> | undefined) || null
    );

    res.json({
      success: true,
      settings,
      cmsSections,
      heroSliderConfig,
      heroBanners: banners.filter((b) => b.position === 'hero_slide'),
      promoBanners: banners.filter((b) => b.position === 'promo_trio'),
      seasonalBanners: banners.filter((b) => b.position === 'seasonal_strip'),
      categories,
      brands,
      topStores,
      flashSale: flashPromotion
        ? {
            name: flashPromotion.name,
            endAt: flashPromotion.endAt,
            badgeText: flashPromotion.discountBadgeText,
            products: flashProducts,
          }
        : { name: 'Flash Sale', endAt: new Date(Date.now() + 24 * 60 * 60 * 1000), products: flashProducts },
      trendingProducts,
      bestSellingProducts,
      newArrivals,
      advertisements: ads,
      integrations: getIntegrationStatus(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to load homepage' });
  }
});

router.get('/categories', async (_req, res) => {
  const categories = await Category.find({ active: true }).sort({ displayOrder: 1 }).lean();
  res.json({ success: true, categories });
});

router.get('/brands', async (_req, res) => {
  const brands = await Brand.find({ active: true }).sort({ displayOrder: 1 }).lean();
  res.json({ success: true, brands });
});

router.get('/stores', async (_req, res) => {
  const stores = await Store.find({ status: 'active' }).sort({ ratingAvg: -1 }).lean();
  res.json({ success: true, stores });
});

router.get('/settings', async (_req, res) => {
  const settings = await PlatformSettings.findOne({ key: 'global' })
    .select('supportEmail supportPhone freeDeliveryThreshold announcementText')
    .lean();
  res.json({ success: true, settings });
});

router.get('/search', async (req, res) => {
  try {
    const result = await searchCatalogProducts({
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      brand: typeof req.query.brand === 'string' ? req.query.brand : undefined,
      store: typeof req.query.store === 'string' ? req.query.store : undefined,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      minRating: req.query.minRating ? Number(req.query.minRating) : undefined,
      discountedOnly: req.query.discounted === 'true',
      inStockOnly: req.query.inStock !== 'false',
      sort: (req.query.sort as any) || 'relevance',
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
      logAnalytics: true,
    });

    const now = new Date();
    const [sponsoredAds, categoryTopBanners] = await Promise.all([
      Advertisement.find({
        active: true,
        placement: 'search_results',
      })
        .sort({ priority: -1 })
        .limit(2)
        .lean(),
      Banner.find({
        position: 'category_top',
        active: true,
        $and: [
          { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }] },
          { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: now } }] },
        ],
      })
        .sort({ displayOrder: 1 })
        .limit(2)
        .lean(),
    ]);

    res.json({ success: true, ...result, sponsoredAds, categoryTopBanners });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Search failed' });
  }
});

router.get('/autocomplete', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    res.json({ success: true, suggestions: [] });
    return;
  }
  const result = await searchCatalogProducts({
    q,
    category: typeof req.query.category === 'string' ? req.query.category : undefined,
    limit: 6,
    page: 1,
    logAnalytics: false,
  });
  res.json({
    success: true,
    suggestions: result.items.map((i) => ({
      _id: i._id,
      title: i.title,
      bnTitle: i.bnTitle,
      slug: i.slug,
      image: i.image,
      minPrice: i.minPrice,
      discountPercent: i.discountPercent,
      categoryName: i.categoryName,
    })),
  });
});

router.get('/products/:slug', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const details = await getDynamicProductDetails(req.params.slug);
    if (!details) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    const reviews = await Review.find({
      productId: details.product._id,
      moderationStatus: 'published',
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of reviews) {
      distribution[r.rating] = (distribution[r.rating] || 0) + 1;
    }

    // Determine eligible delivered subOrders for review if user is signed in
    let eligibleSubOrders: Array<{ _id: string; subOrderNumber: string; storeName: string }> = [];
    let recentlyViewed: any[] = [];

    if (req.user) {
      const deliveredSubs = await SubOrder.find({
        customerId: req.user._id,
        status: 'delivered',
        'items.productId': details.product._id,
      }).lean();

      const alreadyReviewedSubIds = new Set(
        (
          await Review.find({
            customerId: req.user._id,
            productId: details.product._id,
          })
            .select('subOrderId')
            .lean()
        ).map((r) => String(r.subOrderId))
      );

      eligibleSubOrders = deliveredSubs
        .filter((s) => !alreadyReviewedSubIds.has(String(s._id)))
        .map((s) => ({
          _id: String(s._id),
          subOrderNumber: s.subOrderNumber,
          storeName: s.storeName,
        }));

      // Update recently viewed
      const pid = details.product._id;
      const prevIds = (req.user.recentlyViewedProductIds || []).filter((id) => String(id) !== pid);
      req.user.recentlyViewedProductIds = [pid as any, ...prevIds].slice(0, 8);
      req.user.save().catch(() => {});

      if (prevIds.length > 0) {
        const rvDocs = await CanonicalProduct.find({
          _id: { $in: prevIds.slice(0, 4) },
          moderationStatus: 'published',
        })
          .populate('categoryId', 'name slug')
          .populate('brandId', 'name slug')
          .lean();
        recentlyViewed = await attachBestOffersToProducts(rvDocs);
      }
    }

    res.json({
      success: true,
      ...details,
      reviews,
      ratingDistribution: distribution,
      eligibleSubOrders,
      recentlyViewed,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to load product' });
  }
});

router.post('/products/:productId/reviews', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = reviewSchema.safeParse({
      ...req.body,
      productId: req.params.productId,
    });
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid review' });
      return;
    }

    // Verify customer actually has a DELIVERED suborder containing this product
    const subOrder = await SubOrder.findOne({
      _id: parsed.data.subOrderId,
      customerId: req.user!._id,
      status: 'delivered',
      'items.productId': parsed.data.productId,
    });

    if (!subOrder) {
      res.status(403).json({
        success: false,
        error: 'Only customers with a delivered purchase of this product can submit a verified review.',
      });
      return;
    }

    const existing = await Review.findOne({
      customerId: req.user!._id,
      productId: parsed.data.productId,
      subOrderId: subOrder._id,
    });
    if (existing) {
      res.status(409).json({ success: false, error: 'You have already reviewed this purchase' });
      return;
    }

    const review = await Review.create({
      productId: parsed.data.productId,
      subOrderId: subOrder._id,
      storeId: subOrder.storeId,
      customerId: req.user!._id,
      customerName: req.user!.name,
      rating: parsed.data.rating,
      title: parsed.data.title,
      comment: parsed.data.comment,
      images: parsed.data.images,
      verifiedPurchase: true,
      moderationStatus: 'published',
    });

    // Recompute product rating from actual published reviews
    const agg = await Review.aggregate([
      { $match: { productId: review.productId, moderationStatus: 'published' } },
      { $group: { _id: '$productId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    if (agg[0]) {
      await CanonicalProduct.updateOne(
        { _id: review.productId },
        { $set: { ratingAvg: Number(agg[0].avg.toFixed(1)), ratingCount: agg[0].count } }
      );
    }

    res.status(201).json({ success: true, review });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to submit review' });
  }
});

router.post('/reviews/:reviewId/report', requireAuth, async (req: AuthRequest, res) => {
  const reason = String(req.body.reason || '').trim();
  if (reason.length < 4) {
    res.status(400).json({ success: false, error: 'Report reason required' });
    return;
  }
  await ReviewReport.create({
    reviewId: req.params.reviewId,
    reportedByUserId: req.user!._id,
    reason,
  });
  res.json({ success: true, message: 'Review reported to moderators' });
});

router.get('/stores/:slug', async (req, res) => {
  const store = await Store.findOne({ slug: req.params.slug.toLowerCase(), status: 'active' }).lean();
  if (!store) {
    res.status(404).json({ success: false, error: 'Store not found' });
    return;
  }
  const products = await searchCatalogProducts({ store: store.slug, limit: 30, page: 1 });
  const storeAds = await Advertisement.find({
    active: true,
    placement: 'seller_storefront',
    targetStoreId: store._id,
  }).lean();
  res.json({ success: true, store, products: products.items, storeAds });
});

router.post('/newsletter', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ success: false, error: 'Enter a valid email address' });
    return;
  }
  await NewsletterSubscriber.updateOne(
    { email },
    { $set: { email, active: true, subscribedAt: new Date() } },
    { upsert: true }
  );
  res.json({ success: true, message: 'Subscribed to NOVARA exclusive offers!' });
});

router.post('/ads/:id/click', async (req, res) => {
  await Advertisement.updateOne({ _id: req.params.id }, { $inc: { clicks: 1 } }).catch(() => {});
  res.json({ success: true });
});

export default router;
