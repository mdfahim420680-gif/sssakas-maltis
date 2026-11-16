import mongoose, { Types } from 'mongoose';
import { CanonicalProduct, SellerOffer, Category, Brand } from '../models/Catalog';
import { Store } from '../models/Seller';
import { SearchMapping, SearchAnalyticsLog } from '../models/Cms';
import { env } from '../config/env';
import { expandSearchTerms, normalizeSearchQuery } from '../../shared/pricing';

export interface ProductCardDto {
  _id: string;
  title: string;
  bnTitle?: string;
  slug: string;
  image: string;
  categoryName: string;
  categorySlug: string;
  brandName: string;
  ratingAvg: number;
  ratingCount: number;
  totalSold: number;
  isFlashSaleCandidate: boolean;
  isTrending: boolean;
  isSponsored: boolean;
  minPrice: number;
  compareAtPrice?: number;
  discountPercent: number;
  totalStock: number;
  offerCount: number;
  bestOfferId: string;
  bestVariantSku: string;
  bestStoreName: string;
  bestStoreSlug: string;
}

export async function attachBestOffersToProducts(products: Array<Record<string, any>>): Promise<ProductCardDto[]> {
  if (products.length === 0) return [];
  const productIds = products.map((p) => p._id);

  const now = new Date();
  const offers = await SellerOffer.find({
    productId: { $in: productIds },
    isActive: true,
    stock: { $gt: 0 },
  })
    .populate('storeId', 'name slug status verified')
    .lean();

  const offersByProduct = new Map<string, any[]>();
  for (const offer of offers) {
    const store = offer.storeId as any;
    if (!store || store.status !== 'active') continue;
    const key = String(offer.productId);
    const list = offersByProduct.get(key) || [];
    list.push(offer);
    offersByProduct.set(key, list);
  }

  const mapped: Array<ProductCardDto | null> = products.map((p) => {
    const pOffers = offersByProduct.get(String(p._id)) || [];
    if (pOffers.length === 0) return null;

    // Compute effective price considering active flash sale
    const scored = pOffers.map((o) => {
      const flashActive =
        o.flashSalePrice &&
        o.flashSaleStart &&
        o.flashSaleEnd &&
        new Date(o.flashSaleStart) <= now &&
        new Date(o.flashSaleEnd) >= now;
      const effectivePrice = Number(flashActive ? o.flashSalePrice : o.price);
      const comparePrice = o.compareAtPrice && o.compareAtPrice > effectivePrice ? o.compareAtPrice : undefined;
      const discountPercent = comparePrice
        ? Math.round(((comparePrice - effectivePrice) / comparePrice) * 100)
        : o.discountPercent || 0;
      return { offer: o, effectivePrice, comparePrice, discountPercent };
    });

    scored.sort((a, b) => a.effectivePrice - b.effectivePrice);
    const best = scored[0];
    const totalStock = pOffers.reduce((s, o) => s + o.stock, 0);
    const uniqueStores = new Set(pOffers.map((o) => String((o.storeId as any)._id)));

    return {
      _id: String(p._id),
      title: p.title,
      bnTitle: p.bnTitle,
      slug: p.slug,
      image: p.images?.[0] || '',
      categoryName: p.categoryId?.name || 'General',
      categorySlug: p.categoryId?.slug || 'general',
      brandName: p.brandId?.name || 'NOVARA',
      ratingAvg: p.ratingAvg || 0,
      ratingCount: p.ratingCount || 0,
      totalSold: p.totalSold || 0,
      isFlashSaleCandidate: Boolean(p.isFlashSaleCandidate),
      isTrending: Boolean(p.isTrending),
      isSponsored: Boolean(p.isSponsored),
      minPrice: best.effectivePrice,
      compareAtPrice: best.comparePrice,
      discountPercent: best.discountPercent,
      totalStock,
      offerCount: uniqueStores.size,
      bestOfferId: String(best.offer._id),
      bestVariantSku: best.offer.variantSku,
      bestStoreName: (best.offer.storeId as any).name,
      bestStoreSlug: (best.offer.storeId as any).slug,
    };
  });

  return mapped.filter((item): item is ProductCardDto => item !== null);
}

export async function searchCatalogProducts(params: {
  q?: string;
  category?: string;
  brand?: string;
  store?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStockOnly?: boolean;
  discountedOnly?: boolean;
  sort?: 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'rating';
  page?: number;
  limit?: number;
  logAnalytics?: boolean;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(48, Math.max(1, params.limit || 20));
  const filter: Record<string, any> = {
    moderationStatus: 'published',
  };

  if (params.category) {
    const cat = await Category.findOne({ slug: params.category.toLowerCase(), active: true }).lean();
    if (cat) {
      const subCats = await Category.find({ parentId: cat._id, active: true }).select('_id').lean();
      const catIds = [cat._id, ...subCats.map((s) => s._id)];
      filter.categoryId = { $in: catIds };
    } else {
      return { items: [], total: 0, page, totalPages: 0 };
    }
  }

  if (params.brand) {
    const br = await Brand.findOne({ slug: params.brand.toLowerCase(), active: true }).lean();
    if (br) {
      filter.brandId = br._id;
    } else {
      return { items: [], total: 0, page, totalPages: 0 };
    }
  }

  if (params.minRating && params.minRating > 0) {
    filter.ratingAvg = { $gte: params.minRating };
  }

  let matchedProductIdsFromAtlas: Types.ObjectId[] | null = null;
  const rawQuery = (params.q || '').trim();

  if (rawQuery) {
    const customMappings = await SearchMapping.find({ active: true }).lean();
    const expandedTerms = expandSearchTerms(
      rawQuery,
      customMappings.map((m) => ({ term: m.term, synonyms: m.synonyms }))
    );

    if (env.atlasSearchEnabled) {
      try {
        const atlasResults = await CanonicalProduct.aggregate([
          {
            $search: {
              index: 'novara_products_search',
              text: {
                query: expandedTerms.join(' '),
                path: ['title', 'bnTitle', 'keywords', 'searchNormalizedText', 'variants.sku'],
                fuzzy: { maxEdits: 1 },
              },
            },
          },
          { $match: { moderationStatus: 'published' } },
          { $limit: 100 },
          { $project: { _id: 1 } },
        ]);
        matchedProductIdsFromAtlas = atlasResults.map((r) => r._id);
      } catch {
        // Fallback to normalized regex search if Atlas Search index is not provisioned yet
        matchedProductIdsFromAtlas = null;
      }
    }

    if (matchedProductIdsFromAtlas !== null) {
      filter._id = { $in: matchedProductIdsFromAtlas };
    } else {
      const regexConditions = expandedTerms.map((term) => {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rx = new RegExp(escaped, 'i');
        return {
          $or: [
            { title: rx },
            { bnTitle: rx },
            { keywords: rx },
            { searchNormalizedText: rx },
            { 'variants.sku': rx },
            { modelName: rx },
          ],
        };
      });
      if (regexConditions.length > 0) {
        filter.$or = regexConditions;
      }
    }
  }

  // If filtering by store slug, narrow to products with active offers from that store
  if (params.store) {
    const st = await Store.findOne({ slug: params.store.toLowerCase(), status: 'active' }).lean();
    if (!st) return { items: [], total: 0, page, totalPages: 0 };
    const storeOfferProductIds = await SellerOffer.distinct('productId', {
      storeId: st._id,
      isActive: true,
      stock: { $gt: 0 },
    });
    filter._id = filter._id
      ? { $in: storeOfferProductIds.filter((id) => (filter._id.$in || [id]).some((x: any) => String(x) === String(id))) }
      : { $in: storeOfferProductIds };
  }

  let sortClause: Record<string, 1 | -1> = { totalSold: -1, ratingAvg: -1 };
  if (params.sort === 'newest') sortClause = { createdAt: -1 };
  else if (params.sort === 'rating') sortClause = { ratingAvg: -1, ratingCount: -1 };

  const candidates = await CanonicalProduct.find(filter)
    .populate('categoryId', 'name slug')
    .populate('brandId', 'name slug')
    .sort(sortClause)
    .lean();

  let cards = await attachBestOffersToProducts(candidates);

  // Apply offer-level filters (price, discount, stock)
  if (params.minPrice !== undefined) {
    cards = cards.filter((c) => c.minPrice >= params.minPrice!);
  }
  if (params.maxPrice !== undefined) {
    cards = cards.filter((c) => c.minPrice <= params.maxPrice!);
  }
  if (params.discountedOnly) {
    cards = cards.filter((c) => c.discountPercent > 0);
  }
  if (params.inStockOnly !== false) {
    cards = cards.filter((c) => c.totalStock > 0);
  }

  if (params.sort === 'price_asc') {
    cards.sort((a, b) => a.minPrice - b.minPrice);
  } else if (params.sort === 'price_desc') {
    cards.sort((a, b) => b.minPrice - a.minPrice);
  }

  if (rawQuery && params.logAnalytics) {
    SearchAnalyticsLog.create({
      query: rawQuery,
      normalizedQuery: normalizeSearchQuery(rawQuery),
      resultCount: cards.length,
    }).catch(() => {});
  }

  const total = cards.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const items = cards.slice(start, start + limit);

  return {
    items,
    total,
    page,
    totalPages,
  };
}

export async function getDynamicProductDetails(slug: string) {
  const product = await CanonicalProduct.findOne({
    slug: slug.toLowerCase(),
    moderationStatus: 'published',
  })
    .populate('categoryId', 'name bnName slug')
    .populate('brandId', 'name slug logoText')
    .lean();

  if (!product) return null;

  // Increment view count asynchronously
  CanonicalProduct.updateOne({ _id: product._id }, { $inc: { viewCount: 1 } }).catch(() => {});

  const now = new Date();
  const rawOffers = await SellerOffer.find({
    productId: product._id,
    isActive: true,
  })
    .populate('storeId', 'name bnName slug verified ratingAvg ratingCount division district shippingDefaults status')
    .sort({ price: 1 })
    .lean();

  const offers = rawOffers
    .filter((o) => {
      const store = o.storeId as any;
      return store && store.status === 'active';
    })
    .map((o) => {
      const store = o.storeId as any;
      const flashActive =
        o.flashSalePrice &&
        o.flashSaleStart &&
        o.flashSaleEnd &&
        new Date(o.flashSaleStart) <= now &&
        new Date(o.flashSaleEnd) >= now;
      const effectivePrice = Number(flashActive ? o.flashSalePrice : o.price);
      const compareAtPrice =
        o.compareAtPrice && o.compareAtPrice > effectivePrice ? o.compareAtPrice : undefined;
      const discountPercent = compareAtPrice
        ? Math.round(((compareAtPrice - effectivePrice) / compareAtPrice) * 100)
        : o.discountPercent || 0;

      return {
        _id: String(o._id),
        variantSku: o.variantSku,
        price: effectivePrice,
        basePrice: o.price,
        compareAtPrice,
        discountPercent,
        isFlashSale: Boolean(flashActive),
        flashSaleEnd: flashActive ? o.flashSaleEnd : undefined,
        stock: o.stock,
        maxPurchaseQty: Math.min(o.maxPurchaseQty || 5, Math.max(1, o.stock)),
        condition: o.condition,
        deliveryEstimateDays: o.deliveryEstimateDays,
        shippingFeeDhaka: o.shippingFeeDhaka,
        shippingFeeNationwide: o.shippingFeeNationwide,
        freeShippingThreshold: o.freeShippingThreshold,
        offerNote: o.offerNote,
        store: {
          _id: String(store._id),
          name: store.name,
          bnName: store.bnName,
          slug: store.slug,
          verified: store.verified,
          ratingAvg: store.ratingAvg,
          ratingCount: store.ratingCount,
          location: `${store.district}, ${store.division}`,
        },
      };
    });

  // Related products in same category
  const relatedRaw = await CanonicalProduct.find({
    _id: { $ne: product._id },
    categoryId: (product.categoryId as any)._id || product.categoryId,
    moderationStatus: 'published',
  })
    .populate('categoryId', 'name slug')
    .populate('brandId', 'name slug')
    .limit(6)
    .lean();

  const relatedProducts = await attachBestOffersToProducts(relatedRaw);

  return {
    product: {
      ...product,
      _id: String(product._id),
    },
    offers,
    relatedProducts,
  };
}

export function buildNormalizedSearchText(input: {
  title: string;
  bnTitle?: string;
  keywords: string[];
  brandName?: string;
  categoryName?: string;
  variants: Array<{ sku: string; label: string }>;
}): string {
  const parts = [
    input.title,
    input.bnTitle || '',
    input.brandName || '',
    input.categoryName || '',
    ...input.keywords,
    ...input.variants.map((v) => `${v.sku} ${v.label}`),
  ];
  return normalizeSearchQuery(parts.join(' '));
}
