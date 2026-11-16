import crypto from 'crypto';
import { Router } from 'express';
import { AuthRequest, requireApprovedSeller, requireAuth } from '../middleware/auth';
import { SellerApplication, Store } from '../models/Seller';
import { Brand, CanonicalProduct, Category, SellerOffer } from '../models/Catalog';
import { ReturnRequest, SubOrder } from '../models/Order';
import { FinancialLedgerEntry, PayoutRequest } from '../models/Finance';
import { Notification, Review } from '../models/Engagement';
import { PlatformSettings } from '../models/Cms';
import { User } from '../models/User';
import {
  canonicalProductSchema,
  payoutRequestSchema,
  sellerApplicationSchema,
  sellerOfferSchema,
} from '../../shared/validation';
import { canSellerTransitionSuborderStatus, OrderStatus } from '../../shared/pricing';
import { buildNormalizedSearchText } from '../services/catalogService';
import { getSellerFinancialSummary, transitionSubOrderStatus } from '../services/orderService';

const router = Router();

// Onboarding: Customer submits or views their seller application
router.get('/onboarding', requireAuth, async (req: AuthRequest, res) => {
  const application = await SellerApplication.findOne({ userId: req.user!._id })
    .sort({ createdAt: -1 })
    .lean();
  const store = await Store.findOne({ ownerUserId: req.user!._id }).lean();
  res.json({ success: true, application, store });
});

router.post('/onboarding/apply', requireAuth, async (req: AuthRequest, res) => {
  try {
    const existingStore = await Store.findOne({ ownerUserId: req.user!._id });
    if (existingStore) {
      if (existingStore.status !== 'active') {
        res.status(403).json({
          success: false,
          error: 'Your seller store is currently suspended. Contact platform support.',
        });
        return;
      }
      res.status(409).json({ success: false, error: 'You already have an approved seller store' });
      return;
    }

    const latestApp = await SellerApplication.findOne({ userId: req.user!._id }).sort({ createdAt: -1 });
    if (latestApp) {
      if (latestApp.status === 'suspended') {
        res.status(403).json({ success: false, error: 'Your seller application has been suspended.' });
        return;
      }
      if (latestApp.status === 'rejected') {
        res.status(403).json({
          success: false,
          error: 'Your previous seller application was rejected. Contact support to appeal.',
        });
        return;
      }
      if (latestApp.status === 'pending') {
        res.status(409).json({ success: false, error: 'You already have an active seller application under review' });
        return;
      }
    }

    const parsed = sellerApplicationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid application data' });
      return;
    }

    let application;
    if (latestApp && latestApp.status === 'additional_info_required') {
      Object.assign(latestApp, parsed.data);
      latestApp.status = 'pending';
      latestApp.statusHistory.push({
        status: 'pending',
        note: 'Applicant resubmitted updated KYC details',
        changedBy: req.user!._id,
        changedAt: new Date(),
      });
      application = await latestApp.save();
    } else {
      application = await SellerApplication.create({
        userId: req.user!._id,
        ...parsed.data,
        status: 'pending',
        statusHistory: [
          {
            status: 'pending',
            note: 'Application submitted by user',
            changedBy: req.user!._id,
            changedAt: new Date(),
          },
        ],
      });
    }

    // Notify admins
    const admins = await User.find({ role: { $in: ['super_admin', 'admin'] } }).select('_id').lean();
    for (const adm of admins) {
      await Notification.create({
        recipientUserId: adm._id,
        recipientRoleScope: 'admin',
        type: 'seller_application',
        title: `New Seller Application: ${parsed.data.storeName}`,
        message: `${req.user!.name} applied to open store "${parsed.data.storeName}" in ${parsed.data.district}.`,
        link: '/admin/sellers',
      });
    }

    res.status(201).json({ success: true, application });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Application failed' });
  }
});

// All routes below strictly require an APPROVED active seller store
router.use(requireAuth, requireApprovedSeller);

router.get('/dashboard', async (req: AuthRequest, res) => {
  const store = req.store!;
  const [subOrders, offers, finance, returnsCount, pendingOrdersCount] = await Promise.all([
    SubOrder.find({ storeId: store._id }).sort({ createdAt: -1 }).limit(10).lean(),
    SellerOffer.find({ storeId: store._id }).lean(),
    getSellerFinancialSummary(store._id),
    ReturnRequest.countDocuments({ storeId: store._id, status: { $in: ['requested', 'seller_disputed'] } }),
    SubOrder.countDocuments({ storeId: store._id, status: { $in: ['pending', 'confirmed', 'processing'] } }),
  ]);

  const lowStockOffers = offers.filter((o) => o.stock <= 5).length;

  res.json({
    success: true,
    store,
    metrics: {
      grossSales: finance.grossSales,
      refundAdjustedSales: finance.refundAdjustedSales,
      totalCommission: finance.totalCommission,
      eligiblePayout: finance.eligiblePayout,
      pendingEarnings: finance.pendingEarnings,
      activeOffers: offers.filter((o) => o.isActive).length,
      totalOffers: offers.length,
      lowStockOffers,
      pendingOrdersCount,
      returnsCount,
    },
    recentOrders: subOrders,
  });
});

// Catalog search for attaching offers to existing canonical products
router.get('/catalog/canonical', async (req: AuthRequest, res) => {
  const q = String(req.query.q || '').trim();
  const filter: Record<string, any> = { moderationStatus: { $in: ['approved', 'published'] } };
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: rx }, { bnTitle: rx }, { 'variants.sku': rx }];
  }
  const products = await CanonicalProduct.find(filter)
    .populate('categoryId', 'name')
    .populate('brandId', 'name')
    .limit(20)
    .lean();
  res.json({ success: true, products });
});

// Seller's own offers (isolated strictly by storeId)
router.get('/offers', async (req: AuthRequest, res) => {
  const offers = await SellerOffer.find({ storeId: req.store!._id })
    .populate('productId', 'title bnTitle slug images moderationStatus variants')
    .sort({ updatedAt: -1 })
    .lean();
  res.json({ success: true, offers });
});

// Seller's own canonical product submissions (isolated strictly by createdByStoreId)
router.get('/products', async (req: AuthRequest, res) => {
  const products = await CanonicalProduct.find({ createdByStoreId: req.store!._id })
    .populate('categoryId', 'name')
    .populate('brandId', 'name')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, products });
});

// Create a brand new Canonical Product (draft or pending_review only; never self-published) + optional Seller Offer
router.post('/products', async (req: AuthRequest, res) => {
  try {
    const requestedStatus = req.body.moderationStatus ?? req.body.product?.moderationStatus;
    if (requestedStatus !== undefined && !['draft', 'pending_review'].includes(String(requestedStatus))) {
      res.status(403).json({
        success: false,
        error: 'Sellers cannot self-publish or approve products; products must enter draft or pending_review for admin moderation.',
      });
      return;
    }

    const prodParsed = canonicalProductSchema.safeParse(req.body.product || req.body);
    if (!prodParsed.success) {
      res.status(400).json({ success: false, error: prodParsed.error.issues[0]?.message || 'Invalid product' });
      return;
    }

    const [cat, brand] = await Promise.all([
      Category.findById(prodParsed.data.categoryId).lean(),
      Brand.findById(prodParsed.data.brandId).lean(),
    ]);
    if (!cat || !cat.active || !brand || !brand.active) {
      res.status(400).json({ success: false, error: 'Valid active category and brand are required' });
      return;
    }

    const initialOffer = req.body.offer;
    let validatedOfferData: any = null;
    if (initialOffer) {
      const offerParsed = sellerOfferSchema.safeParse({
        ...initialOffer,
        productId: 'pending',
        variantSku: initialOffer.variantSku || prodParsed.data.variants[0].sku,
      });
      if (!offerParsed.success) {
        res.status(400).json({ success: false, error: offerParsed.error.issues[0]?.message || 'Invalid initial offer data' });
        return;
      }
      validatedOfferData = offerParsed.data;
    }

    const baseSlug = prodParsed.data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const slug = `${baseSlug || 'product'}-${crypto.randomBytes(2).toString('hex')}`;
    const moderationStatus = requestedStatus === 'draft' ? 'draft' : 'pending_review';

    const product = await CanonicalProduct.create({
      ...prodParsed.data,
      slug,
      createdByUserId: req.user!._id,
      createdByStoreId: req.store!._id,
      moderationStatus,
      searchNormalizedText: buildNormalizedSearchText({
        title: prodParsed.data.title,
        bnTitle: prodParsed.data.bnTitle,
        keywords: prodParsed.data.keywords,
        brandName: brand.name,
        categoryName: cat.name,
        variants: prodParsed.data.variants,
      }),
    });

    if (validatedOfferData) {
      const discountPercent =
        validatedOfferData.compareAtPrice && validatedOfferData.compareAtPrice > validatedOfferData.price
          ? Math.round(
              ((validatedOfferData.compareAtPrice - validatedOfferData.price) /
                validatedOfferData.compareAtPrice) *
                100
            )
          : 0;

      await SellerOffer.create({
        ...validatedOfferData,
        productId: product._id,
        storeId: req.store!._id,
        sellerUserId: req.user!._id,
        discountPercent,
      });
    }

    res.status(201).json({ success: true, product });
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'Failed to create product' });
  }
});

// Seller can update/resubmit their own draft/rejected product for pending_review (strict ownership & never self-publish)
router.patch('/products/:id', async (req: AuthRequest, res) => {
  const product = await CanonicalProduct.findOne({
    _id: req.params.id,
    createdByStoreId: req.store!._id,
  });
  if (!product) {
    res.status(404).json({ success: false, error: 'Product not found in your store' });
    return;
  }

  if (req.body.moderationStatus !== undefined) {
    if (!['draft', 'pending_review'].includes(String(req.body.moderationStatus))) {
      res.status(403).json({
        success: false,
        error: 'Sellers can only save products as draft or submit them for pending_review.',
      });
      return;
    }
    if (product.moderationStatus === 'suspended') {
      res.status(403).json({
        success: false,
        error: 'Suspended products require administrator review to restore.',
      });
      return;
    }
    product.moderationStatus = req.body.moderationStatus;
  }

  if (req.body.title !== undefined) {
    const cleanTitle = String(req.body.title).trim();
    if (cleanTitle.length < 3) {
      res.status(400).json({ success: false, error: 'Title must be at least 3 characters' });
      return;
    }
    product.title = cleanTitle;
  }
  if (req.body.description !== undefined) {
    const cleanDesc = String(req.body.description).trim();
    if (cleanDesc.length < 10) {
      res.status(400).json({ success: false, error: 'Description must be at least 10 characters' });
      return;
    }
    product.description = cleanDesc;
  }

  await product.save();
  res.json({ success: true, product });
});

// Create or attach a Seller Offer to an existing Canonical Product variant
router.post('/offers', async (req: AuthRequest, res) => {
  try {
    const parsed = sellerOfferSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid offer' });
      return;
    }

    const product = await CanonicalProduct.findById(parsed.data.productId);
    if (!product || !['approved', 'published'].includes(product.moderationStatus)) {
      res.status(404).json({ success: false, error: 'Approved canonical product not found' });
      return;
    }

    const variantExists = product.variants.some((v) => v.sku === parsed.data.variantSku);
    if (!variantExists) {
      res.status(400).json({ success: false, error: `Variant SKU "${parsed.data.variantSku}" does not exist on this product` });
      return;
    }

    const discountPercent =
      parsed.data.compareAtPrice && parsed.data.compareAtPrice > parsed.data.price
        ? Math.round(((parsed.data.compareAtPrice - parsed.data.price) / parsed.data.compareAtPrice) * 100)
        : 0;

    const offer = await SellerOffer.findOneAndUpdate(
      {
        storeId: req.store!._id,
        productId: product._id,
        variantSku: parsed.data.variantSku,
      },
      {
        $set: {
          ...parsed.data,
          storeId: req.store!._id,
          sellerUserId: req.user!._id,
          discountPercent,
        },
      },
      { upsert: true, new: true }
    );

    res.status(201).json({ success: true, offer });
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'Failed to save offer' });
  }
});

// Update Seller's own offer / stock (strict ownership check: storeId === req.store._id)
router.patch('/offers/:offerId', async (req: AuthRequest, res) => {
  const offer = await SellerOffer.findOne({ _id: req.params.offerId, storeId: req.store!._id });
  if (!offer) {
    res.status(404).json({ success: false, error: 'Offer not found in your store' });
    return;
  }

  if (req.body.price !== undefined) {
    const p = Number(req.body.price);
    if (p <= 0) {
      res.status(400).json({ success: false, error: 'Price must be positive' });
      return;
    }
    offer.price = p;
  }
  if (req.body.compareAtPrice !== undefined) {
    offer.compareAtPrice = Number(req.body.compareAtPrice) || undefined;
  }
  if (req.body.stock !== undefined) {
    const s = Math.floor(Number(req.body.stock));
    if (s < 0) {
      res.status(400).json({ success: false, error: 'Stock cannot be negative' });
      return;
    }
    offer.stock = s;
  }
  if (req.body.isActive !== undefined) offer.isActive = Boolean(req.body.isActive);
  if (req.body.deliveryEstimateDays) offer.deliveryEstimateDays = String(req.body.deliveryEstimateDays);

  if (offer.compareAtPrice && offer.compareAtPrice > offer.price) {
    offer.discountPercent = Math.round(((offer.compareAtPrice - offer.price) / offer.compareAtPrice) * 100);
  } else {
    offer.discountPercent = 0;
  }

  await offer.save();
  res.json({ success: true, offer });
});

// Seller Orders (isolated by storeId)
router.get('/orders', async (req: AuthRequest, res) => {
  const status = typeof req.query.status === 'string' && req.query.status !== 'all' ? req.query.status : undefined;
  const filter: Record<string, any> = { storeId: req.store!._id };
  if (status) filter.status = status;

  const subOrders = await SubOrder.find(filter)
    .populate('parentOrderId', 'orderNumber shippingAddress paymentMethod paymentStatus deliverySpeed')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, subOrders });
});

router.patch('/orders/:subOrderId/status', async (req: AuthRequest, res) => {
  try {
    const sub = await SubOrder.findOne({ _id: req.params.subOrderId, storeId: req.store!._id });
    if (!sub) {
      res.status(404).json({ success: false, error: 'Suborder not found in your store' });
      return;
    }

    const nextStatus = req.body.status as OrderStatus;
    if (!canSellerTransitionSuborderStatus(sub.status, nextStatus)) {
      res.status(403).json({
        success: false,
        error: `Sellers are not permitted to transition a suborder from "${sub.status}" to "${nextStatus}"`,
      });
      return;
    }

    const updated = await transitionSubOrderStatus({
      subOrderId: String(sub._id),
      nextStatus,
      actorUserId: req.user!._id,
      note: req.body.note,
      courierName: req.body.courierName,
      trackingNumber: req.body.trackingNumber,
    });
    res.json({ success: true, subOrder: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'Status update failed' });
  }
});

// Seller Returns & Disputes (isolated by storeId)
router.get('/returns', async (req: AuthRequest, res) => {
  const returns = await ReturnRequest.find({ storeId: req.store!._id })
    .populate('subOrderId', 'subOrderNumber subtotal items')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, returns });
});

router.patch('/returns/:id/respond', async (req: AuthRequest, res) => {
  const ret = await ReturnRequest.findOne({ _id: req.params.id, storeId: req.store!._id });
  if (!ret) {
    res.status(404).json({ success: false, error: 'Return request not found in your store' });
    return;
  }
  if (['refund_approved', 'refund_executed', 'rejected'].includes(ret.status)) {
    res.status(409).json({ success: false, error: `Return already finalized as ${ret.status}` });
    return;
  }
  if (!['approve', 'dispute'].includes(req.body.decision)) {
    res.status(400).json({ success: false, error: 'Decision must be approve or dispute' });
    return;
  }
  const decision = req.body.decision === 'approve' ? 'seller_approved' : 'seller_disputed';
  ret.status = decision;
  ret.sellerResponse = String(req.body.response || '');
  await ret.save();
  res.json({ success: true, returnRequest: ret });
});

// Seller Finance, Ledger, and Idempotent Payout Requests
router.get('/finance', async (req: AuthRequest, res) => {
  const [summary, payouts, settings] = await Promise.all([
    getSellerFinancialSummary(req.store!._id),
    PayoutRequest.find({ storeId: req.store!._id }).sort({ createdAt: -1 }).lean(),
    PlatformSettings.findOne({ key: 'global' }).lean(),
  ]);
  res.json({ success: true, ...summary, payouts, minPayoutAmount: settings?.minPayoutAmount ?? 500 });
});

router.post('/finance/payouts', async (req: AuthRequest, res) => {
  try {
    const parsed = payoutRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid payout request' });
      return;
    }

    const settings = await PlatformSettings.findOne({ key: 'global' }).lean();
    const minPayout = settings?.minPayoutAmount ?? 500;
    if (parsed.data.amount < minPayout) {
      res.status(400).json({ success: false, error: `Minimum payout amount is ৳${minPayout}` });
      return;
    }

    const existing = await PayoutRequest.findOne({ idempotencyKey: parsed.data.idempotencyKey });
    if (existing) {
      res.json({ success: true, payout: existing, deduplicated: true });
      return;
    }

    const summary = await getSellerFinancialSummary(req.store!._id);
    if (parsed.data.amount > summary.eligiblePayout) {
      res.status(400).json({
        success: false,
        error: `Requested payout ৳${parsed.data.amount} exceeds your eligible balance of ৳${summary.eligiblePayout}`,
      });
      return;
    }

    const payoutNumber = `PAY-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const payout = await PayoutRequest.create({
      payoutNumber,
      storeId: req.store!._id,
      sellerUserId: req.user!._id,
      idempotencyKey: parsed.data.idempotencyKey,
      amount: parsed.data.amount,
      method: parsed.data.method,
      accountNumber: parsed.data.accountNumber,
      status: 'requested',
    });

    // Place hold on eligible balance immediately so seller cannot double-request the same funds
    await FinancialLedgerEntry.create({
      entryKey: `payout_hold:${payout._id}`,
      storeId: req.store!._id,
      payoutRequestId: payout._id,
      entryType: 'payout_hold',
      bucket: 'held',
      amount: parsed.data.amount,
      description: `Hold for payout request ${payoutNumber}`,
      createdByUserId: req.user!._id,
    });

    res.status(201).json({ success: true, payout });
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'Payout request failed' });
  }
});

// Store Profile & Shipping Settings
router.put('/store', async (req: AuthRequest, res) => {
  const store = req.store!;
  if (req.body.name !== undefined) {
    const cleanName = String(req.body.name).trim();
    if (cleanName.length < 2) {
      res.status(400).json({ success: false, error: 'Store name must be at least 2 characters' });
      return;
    }
    store.name = cleanName;
  }
  if (req.body.bnName !== undefined) store.bnName = String(req.body.bnName).trim();
  if (req.body.description !== undefined) store.description = String(req.body.description).trim();
  if (req.body.logoUrl !== undefined) store.logoUrl = String(req.body.logoUrl);
  if (req.body.bannerUrl !== undefined) store.bannerUrl = String(req.body.bannerUrl);
  if (req.body.supportPhone !== undefined) {
    const cleanPhone = String(req.body.supportPhone).trim();
    if (cleanPhone.length < 6) {
      res.status(400).json({ success: false, error: 'Valid support phone is required' });
      return;
    }
    store.supportPhone = cleanPhone;
  }
  if (req.body.shippingDefaults) {
    const dhakaFee = Number(req.body.shippingDefaults.dhakaFee ?? store.shippingDefaults.dhakaFee);
    const nationwideFee = Number(req.body.shippingDefaults.nationwideFee ?? store.shippingDefaults.nationwideFee);
    const freeShippingThreshold = Number(
      req.body.shippingDefaults.freeShippingThreshold ?? store.shippingDefaults.freeShippingThreshold
    );
    if (dhakaFee < 0 || nationwideFee < 0 || freeShippingThreshold < 0 || Number.isNaN(dhakaFee) || Number.isNaN(nationwideFee)) {
      res.status(400).json({ success: false, error: 'Shipping fees must be valid non-negative numbers' });
      return;
    }
    store.shippingDefaults = {
      dhakaFee,
      nationwideFee,
      freeShippingThreshold,
      handlingDays: String(req.body.shippingDefaults.handlingDays ?? store.shippingDefaults.handlingDays),
    };
  }
  await store.save();
  res.json({ success: true, store });
});

// Seller Reviews & Replies (cannot delete negative reviews)
router.get('/reviews', async (req: AuthRequest, res) => {
  const reviews = await Review.find({ storeId: req.store!._id })
    .populate('productId', 'title slug')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, reviews });
});

router.post('/reviews/:reviewId/reply', async (req: AuthRequest, res) => {
  const text = String(req.body.text || '').trim();
  if (text.length < 2) {
    res.status(400).json({ success: false, error: 'Reply text required' });
    return;
  }
  const review = await Review.findOne({ _id: req.params.reviewId, storeId: req.store!._id });
  if (!review) {
    res.status(404).json({ success: false, error: 'Review not found for your store' });
    return;
  }
  review.sellerReply = { text, repliedAt: new Date() };
  await review.save();
  res.json({ success: true, review });
});

export default router;
