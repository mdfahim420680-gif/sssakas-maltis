import crypto from 'crypto';
import mongoose from 'mongoose';
import { Router } from 'express';
import { AuthRequest, recordAuditLog, requireAdmin, requireAuth, requireRole } from '../middleware/auth';
import { User } from '../models/User';
import { CommissionRule, SellerApplication, Store } from '../models/Seller';
import { Brand, CanonicalProduct, Category, SellerOffer } from '../models/Catalog';
import { ParentOrder, PaymentTransaction, ReturnRequest, SubOrder } from '../models/Order';
import { FinancialLedgerEntry, PayoutRequest } from '../models/Finance';
import {
  Advertisement,
  AuditLog,
  Banner,
  CmsSection,
  Coupon,
  PlatformSettings,
  Promotion,
  SearchAnalyticsLog,
  SearchMapping,
} from '../models/Cms';
import { Notification, Review, ReviewReport, SupportTicket } from '../models/Engagement';
import { transitionSubOrderStatus } from '../services/orderService';
import { buildNormalizedSearchText } from '../services/catalogService';
import { getIntegrationStatus } from '../config/env';
import { getDatabaseMode } from '../config/db';
import {
  buildCsvReport,
  buildOrderStatusDistribution,
  buildSalesTimeSeries,
  computeGrowthPercent,
  resolveDateWindow,
} from '../services/adminAnalytics';
import {
  adInputSchema,
  adUpdateSchema,
  bannerInputSchema,
  bannerUpdateSchema,
  brandInputSchema,
  canonicalProductSchema,
  categoryInputSchema,
  commissionRuleInputSchema,
  couponInputSchema,
  couponUpdateSchema,
  heroSliderConfigSchema,
  platformSettingsInputSchema,
  promotionInputSchema,
  promotionUpdateSchema,
  searchMappingInputSchema,
  sellerOfferSchema,
} from '../../shared/validation';
import { normalizeHeroSliderConfig } from '../../shared/bannerStyle';

const router = Router();
router.use(requireAuth, requireAdmin);

function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return base || `item-${crypto.randomBytes(3).toString('hex')}`;
}

function handleMongoError(err: any, res: any, duplicateMessage = 'A record with this unique value already exists') {
  if (err && (err.code === 11000 || err.code === 11001)) {
    res.status(409).json({ success: false, error: duplicateMessage });
    return;
  }
  res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'Request failed' });
}

// 1. Admin Dashboard Overview (Real DB metrics, time-series, distributions, leaderboards)
router.get('/dashboard', async (req: AuthRequest, res) => {
  const win = resolveDateWindow(req.query.range);
  const currentRangeMatch = win.currentStart
    ? { createdAt: { $gte: win.currentStart, $lte: win.currentEnd } }
    : {};
  const previousRangeMatch =
    win.previousStart && win.previousEnd
      ? { createdAt: { $gte: win.previousStart, $lte: win.previousEnd } }
      : null;

  const [
    usersCount,
    customerCount,
    storesCount,
    pendingSellersCount,
    productsCount,
    pendingProductsCount,
    ordersCount,
    deliveredOrdersCount,
    revenueAgg,
    pendingPayoutsCount,
    openReturnsCount,
    openTicketsCount,
    openOrdersCount,
    searchQueriesCount,
    recentParentOrders,
    recentLogs,
    currentOrdersRaw,
    previousOrdersRaw,
    currentCustomerCount,
    prevCustomerCount,
    currentProductCount,
    prevProductCount,
    currentStoreCount,
    prevStoreCount,
    subOrderStatusAgg,
    topProductsRaw,
    topProductSoldAgg,
    storesRaw,
    storeSalesAgg,
    featuredBanner,
    unreadNotifications,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'customer' }),
    Store.countDocuments({ status: 'active' }),
    SellerApplication.countDocuments({ status: { $in: ['pending', 'additional_info_required'] } }),
    CanonicalProduct.countDocuments(),
    CanonicalProduct.countDocuments({ moderationStatus: 'pending_review' }),
    ParentOrder.countDocuments(),
    SubOrder.countDocuments({ status: 'delivered' }),
    ParentOrder.aggregate([
      { $group: { _id: null, gmv: { $sum: '$grandTotal' }, commission: { $sum: '$platformCommissionTotal' } } },
    ]),
    PayoutRequest.countDocuments({ status: { $in: ['requested', 'approved'] } }),
    ReturnRequest.countDocuments({
      status: { $in: ['requested', 'seller_approved', 'seller_disputed', 'admin_review', 'item_received', 'refund_approved'] },
    }),
    SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
    SubOrder.countDocuments({ status: { $in: ['pending', 'confirmed', 'processing', 'packed', 'shipped'] } }),
    SearchAnalyticsLog.countDocuments(),
    ParentOrder.find()
      .populate('customerId', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    AuditLog.find().sort({ createdAt: -1 }).limit(10).lean(),
    ParentOrder.find(currentRangeMatch).select('createdAt grandTotal platformCommissionTotal').lean(),
    previousRangeMatch
      ? ParentOrder.find(previousRangeMatch).select('createdAt grandTotal platformCommissionTotal').lean()
      : Promise.resolve([]),
    win.currentStart ? User.countDocuments({ role: 'customer', ...currentRangeMatch }) : Promise.resolve(0),
    previousRangeMatch ? User.countDocuments({ role: 'customer', ...previousRangeMatch }) : Promise.resolve(0),
    win.currentStart ? CanonicalProduct.countDocuments(currentRangeMatch) : Promise.resolve(0),
    previousRangeMatch ? CanonicalProduct.countDocuments(previousRangeMatch) : Promise.resolve(0),
    win.currentStart ? Store.countDocuments({ status: 'active', ...currentRangeMatch }) : Promise.resolve(0),
    previousRangeMatch ? Store.countDocuments({ status: 'active', ...previousRangeMatch }) : Promise.resolve(0),
    SubOrder.aggregate([
      ...(win.currentStart ? [{ $match: currentRangeMatch }] : []),
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    CanonicalProduct.find({ moderationStatus: 'published' })
      .sort({ totalSold: -1, ratingAvg: -1 })
      .limit(5)
      .lean(),
    SubOrder.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          unitsSold: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.lineTotal' },
          avgPrice: { $avg: '$items.unitPrice' },
        },
      },
      { $sort: { revenue: -1, unitsSold: -1 } },
      { $limit: 5 },
    ]),
    Store.find({ status: 'active' }).sort({ ratingAvg: -1, ratingCount: -1 }).limit(5).lean(),
    SubOrder.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$storeId',
          ordersCount: { $sum: 1 },
          totalRevenue: { $sum: '$subtotal' },
        },
      },
    ]),
    Banner.findOne({ position: 'hero_slide', active: true }).sort({ displayOrder: 1 }).lean(),
    req.user ? Notification.countDocuments({ recipientUserId: req.user._id, read: false }) : Promise.resolve(0),
  ]);

  // Enrich recentOrders with suborder items & primary seller
  const recentParentIds = recentParentOrders.map((p) => p._id);
  const recentSubs =
    recentParentIds.length > 0
      ? await SubOrder.find({ parentOrderId: { $in: recentParentIds } }).lean()
      : [];
  const subsByParent = new Map<string, any[]>();
  for (const s of recentSubs) {
    const key = String(s.parentOrderId);
    const list = subsByParent.get(key) || [];
    list.push(s);
    subsByParent.set(key, list);
  }

  const recentOrders = recentParentOrders.map((po: any) => {
    const subs = subsByParent.get(String(po._id)) || [];
    const firstSub = subs[0];
    const firstItem = firstSub?.items?.[0];
    const extraItemsCount = subs.reduce((sum, s) => sum + (s.items?.length || 0), 0) - 1;
    const customerName = po.customerId?.name || po.shippingAddress?.fullName || 'Customer';
    const status = firstSub?.status || (po.paymentStatus === 'paid' ? 'delivered' : 'pending');
    return {
      ...po,
      customerName,
      productSummary: firstItem
        ? `${firstItem.productTitle}${extraItemsCount > 0 ? ` (+${extraItemsCount})` : ''}`
        : 'Marketplace Order',
      sellerName: subs.length > 1 ? `${firstSub?.storeName} +${subs.length - 1}` : firstSub?.storeName || 'NOVARA Store',
      status,
    };
  });

  // Sales time series & real period comparisons
  const salesSeries = buildSalesTimeSeries({
    currentOrders: currentOrdersRaw,
    previousOrders: previousOrdersRaw,
    window: win,
  });

  const currentRangeRevenue = currentOrdersRaw.reduce((s, o) => s + Number(o.grandTotal || 0), 0);
  const previousRangeRevenue = previousOrdersRaw.reduce((s, o) => s + Number(o.grandTotal || 0), 0);
  const currentRangeCommission = currentOrdersRaw.reduce((s, o) => s + Number(o.platformCommissionTotal || 0), 0);
  const previousRangeCommission = previousOrdersRaw.reduce((s, o) => s + Number(o.platformCommissionTotal || 0), 0);

  const comparisons = {
    orders: win.currentStart ? computeGrowthPercent(currentOrdersRaw.length, previousOrdersRaw.length) : null,
    sales: win.currentStart ? computeGrowthPercent(currentRangeRevenue, previousRangeRevenue) : null,
    customers: win.currentStart ? computeGrowthPercent(currentCustomerCount, prevCustomerCount) : null,
    sellers: win.currentStart ? computeGrowthPercent(currentStoreCount, prevStoreCount) : null,
    products: win.currentStart ? computeGrowthPercent(currentProductCount, prevProductCount) : null,
    commission: win.currentStart ? computeGrowthPercent(currentRangeCommission, previousRangeCommission) : null,
  };

  // Top Selling Products (combine real SubOrder sales with CanonicalProduct catalog)
  const soldStatsMap = new Map<string, { unitsSold: number; revenue: number }>();
  for (const row of topProductSoldAgg) {
    soldStatsMap.set(String(row._id), { unitsSold: row.unitsSold || 0, revenue: row.revenue || 0 });
  }
  const prodIdsForOffers = topProductsRaw.map((p) => p._id);
  const topProductOffers = await SellerOffer.find({ productId: { $in: prodIdsForOffers }, isActive: true })
    .sort({ price: 1 })
    .lean();
  const minPriceByProduct = new Map<string, number>();
  for (const off of topProductOffers) {
    const pid = String(off.productId);
    if (!minPriceByProduct.has(pid)) minPriceByProduct.set(pid, off.price);
  }

  const topSellingProducts = topProductsRaw.map((p: any) => {
    const orderStat = soldStatsMap.get(String(p._id));
    const unitPrice = minPriceByProduct.get(String(p._id)) || 0;
    return {
      _id: String(p._id),
      title: p.title,
      slug: p.slug,
      image: p.images?.[0] || '',
      price: unitPrice,
      revenue: orderStat?.revenue || unitPrice * (p.totalSold || 0),
      soldCount: Math.max(orderStat?.unitsSold || 0, p.totalSold || 0),
      ratingAvg: p.ratingAvg || 0,
    };
  });

  // Top Sellers with real revenue & product counts
  const storeSalesMap = new Map<string, { ordersCount: number; totalRevenue: number }>();
  for (const row of storeSalesAgg) {
    storeSalesMap.set(String(row._id), {
      ordersCount: row.ordersCount || 0,
      totalRevenue: row.totalRevenue || 0,
    });
  }
  const storeProductCounts = await CanonicalProduct.aggregate([
    { $match: { moderationStatus: 'published' } },
    { $group: { _id: '$createdByStoreId', count: { $sum: 1 } } },
  ]);
  const storeProdMap = new Map<string, number>();
  for (const row of storeProductCounts) {
    if (row._id) storeProdMap.set(String(row._id), row.count || 0);
  }

  const topSellers = storesRaw.map((st: any) => {
    const stSales = storeSalesMap.get(String(st._id));
    return {
      _id: String(st._id),
      name: st.name,
      slug: st.slug,
      verified: Boolean(st.verified),
      ratingAvg: st.ratingAvg || 0,
      ratingCount: st.ratingCount || 0,
      productCount: storeProdMap.get(String(st._id)) || st.productCount || 0,
      ordersCount: stSales?.ordersCount || 0,
      totalRevenue: stSales?.totalRevenue || 0,
    };
  });

  const orderStatusDistribution = buildOrderStatusDistribution(subOrderStatusAgg);

  // Recent activities synthesized from real AuditLogs + recent orders
  const recentActivities = [
    ...recentLogs.slice(0, 6).map((l: any) => ({
      id: String(l._id),
      type: l.targetType || 'System',
      title: String(l.action || 'admin_action').replace(/_/g, ' '),
      subtitle: `${l.actorEmail}`,
      createdAt: l.createdAt,
    })),
    ...recentOrders.slice(0, 3).map((o: any) => ({
      id: `ord-${o._id}`,
      type: 'Order',
      title: `Order #${o.orderNumber} placed`,
      subtitle: `${o.customerName} · ৳${o.grandTotal}`,
      createdAt: o.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  res.json({
    success: true,
    range: win.range,
    databaseMode: getDatabaseMode(),
    metrics: {
      usersCount,
      customerCount,
      storesCount,
      pendingSellersCount,
      productsCount,
      pendingProductsCount,
      ordersCount,
      deliveredOrdersCount,
      totalGmv: revenueAgg[0]?.gmv || 0,
      totalCommission: revenueAgg[0]?.commission || 0,
      rangeGmv: currentRangeRevenue,
      rangeOrdersCount: currentOrdersRaw.length,
      pendingPayoutsCount,
      openReturnsCount,
      openTicketsCount,
      openOrdersCount,
      searchQueriesCount,
    },
    comparisons,
    salesSeries,
    orderStatusDistribution,
    topSellingProducts,
    topSellers,
    recentOrders,
    recentLogs,
    recentActivities,
    featuredBanner,
    badgeCounts: {
      orders: openOrdersCount,
      sellers: pendingSellersCount,
      pendingProducts: pendingProductsCount,
      returns: openReturnsCount,
      tickets: openTicketsCount,
      payouts: pendingPayoutsCount,
    },
    unreadNotifications,
    integrations: getIntegrationStatus(),
  });
});

// 1b. Dedicated Analytics Endpoint
router.get('/analytics', async (req, res) => {
  const win = resolveDateWindow(req.query.range);
  const rangeMatch = win.currentStart
    ? { createdAt: { $gte: win.currentStart, $lte: win.currentEnd } }
    : {};

  const [
    ordersInRange,
    prevOrdersInRange,
    paymentBreakdown,
    subStatusAgg,
    categoryRevAgg,
    topCoupons,
    topSellersAgg,
  ] = await Promise.all([
    ParentOrder.find(rangeMatch).select('createdAt grandTotal platformCommissionTotal couponDiscountTotal').lean(),
    win.previousStart && win.previousEnd
      ? ParentOrder.find({ createdAt: { $gte: win.previousStart, $lte: win.previousEnd } })
          .select('createdAt grandTotal')
          .lean()
      : Promise.resolve([]),
    ParentOrder.aggregate([
      ...(win.currentStart ? [{ $match: rangeMatch }] : []),
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalAmount: { $sum: '$grandTotal' },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]),
    SubOrder.aggregate([
      ...(win.currentStart ? [{ $match: rangeMatch }] : []),
      { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$subtotal' } } },
    ]),
    SubOrder.aggregate([
      ...(win.currentStart ? [{ $match: rangeMatch }] : []),
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'canonicalproducts',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'prod',
        },
      },
      { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'categories',
          localField: 'prod.categoryId',
          foreignField: '_id',
          as: 'cat',
        },
      },
      { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$cat.name',
          revenue: { $sum: '$items.lineTotal' },
          units: { $sum: '$items.quantity' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 8 },
    ]),
    Coupon.find({ usedCount: { $gt: 0 } }).sort({ usedCount: -1 }).limit(6).lean(),
    SubOrder.aggregate([
      ...(win.currentStart ? [{ $match: rangeMatch }] : []),
      { $match: { status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$storeName',
          ordersCount: { $sum: 1 },
          revenue: { $sum: '$subtotal' },
          commission: { $sum: '$commissionAmount' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 8 },
    ]),
  ]);

  const salesSeries = buildSalesTimeSeries({
    currentOrders: ordersInRange,
    previousOrders: prevOrdersInRange,
    window: win,
  });

  const totalRevenue = ordersInRange.reduce((s, o) => s + (o.grandTotal || 0), 0);
  const totalCommission = ordersInRange.reduce((s, o) => s + (o.platformCommissionTotal || 0), 0);
  const totalDiscount = ordersInRange.reduce((s, o) => s + (o.couponDiscountTotal || 0), 0);
  const avgOrderValue = ordersInRange.length > 0 ? Math.round(totalRevenue / ordersInRange.length) : 0;

  res.json({
    success: true,
    range: win.range,
    summary: {
      ordersCount: ordersInRange.length,
      totalRevenue,
      totalCommission,
      totalDiscount,
      avgOrderValue,
    },
    salesSeries,
    orderStatusDistribution: buildOrderStatusDistribution(subStatusAgg),
    paymentBreakdown,
    categoryRevenue: categoryRevAgg.map((c) => ({ name: c._id || 'Uncategorized', revenue: c.revenue, units: c.units })),
    topCoupons,
    topSellers: topSellersAgg.map((s) => ({
      storeName: s._id || 'Store',
      ordersCount: s.ordersCount,
      revenue: s.revenue,
      commission: s.commission,
    })),
  });
});

// 1c. Global Admin Search
router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    res.json({ success: true, orders: [], products: [], sellers: [], users: [], coupons: [] });
    return;
  }
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [orders, products, sellers, users, coupons] = await Promise.all([
    ParentOrder.find({
      $or: [
        { orderNumber: rx },
        { 'shippingAddress.fullName': rx },
        { 'shippingAddress.phone': rx },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    CanonicalProduct.find({ $or: [{ title: rx }, { bnTitle: rx }, { slug: rx }, { 'variants.sku': rx }] })
      .select('title slug images moderationStatus')
      .limit(5)
      .lean(),
    Store.find({ $or: [{ name: rx }, { slug: rx }, { district: rx }] })
      .select('name slug status verified district')
      .limit(5)
      .lean(),
    User.find({ $or: [{ name: rx }, { email: rx }, { phone: rx }] })
      .select('name email role status')
      .limit(5)
      .lean(),
    Coupon.find({ $or: [{ code: rx }, { title: rx }] })
      .select('code title discountType discountValue active')
      .limit(5)
      .lean(),
  ]);

  res.json({ success: true, orders, products, sellers, users, coupons });
});

// 1d. Real CSV Report Export
router.get('/reports/export', async (req, res) => {
  const type = String(req.query.type || 'orders').toLowerCase();
  const win = resolveDateWindow(req.query.range);
  const rangeMatch = win.currentStart
    ? { createdAt: { $gte: win.currentStart, $lte: win.currentEnd } }
    : {};

  let csv = '';
  let filename = `novara-${type}-report.csv`;

  if (type === 'products') {
    const products = await CanonicalProduct.find()
      .populate('categoryId', 'name')
      .populate('brandId', 'name')
      .populate('createdByStoreId', 'name')
      .sort({ totalSold: -1 })
      .lean();
    csv = buildCsvReport(
      ['Product ID', 'Title', 'Category', 'Brand', 'Store', 'Status', 'Total Sold', 'Rating', 'Created At'],
      products.map((p: any) => [
        String(p._id),
        p.title,
        p.categoryId?.name || '',
        p.brandId?.name || '',
        p.createdByStoreId?.name || '',
        p.moderationStatus,
        p.totalSold || 0,
        p.ratingAvg || 0,
        new Date(p.createdAt).toISOString(),
      ])
    );
  } else if (type === 'sellers') {
    const stores = await Store.find().populate('ownerUserId', 'name email').sort({ createdAt: -1 }).lean();
    csv = buildCsvReport(
      ['Store ID', 'Store Name', 'Owner Email', 'Location', 'Status', 'Verified', 'Rating', 'Products'],
      stores.map((s: any) => [
        String(s._id),
        s.name,
        s.ownerUserId?.email || '',
        `${s.district}, ${s.division}`,
        s.status,
        s.verified ? 'Yes' : 'No',
        s.ratingAvg || 0,
        s.productCount || 0,
      ])
    );
  } else {
    const orders = await ParentOrder.find(rangeMatch)
      .populate('customerId', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();
    csv = buildCsvReport(
      ['Order Number', 'Customer', 'Phone', 'Division', 'Method', 'Payment Status', 'Subtotal (BDT)', 'Shipping (BDT)', 'Discount (BDT)', 'Commission (BDT)', 'Grand Total (BDT)', 'Date'],
      orders.map((o: any) => [
        o.orderNumber,
        o.customerId?.name || o.shippingAddress?.fullName || '',
        o.customerId?.phone || o.shippingAddress?.phone || '',
        o.shippingAddress?.division || '',
        o.paymentMethod,
        o.paymentStatus,
        o.itemsSubtotal,
        o.shippingTotal,
        o.couponDiscountTotal,
        o.platformCommissionTotal,
        o.grandTotal,
        new Date(o.createdAt).toISOString(),
      ])
    );
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// 1e. Admin Notifications
router.get('/notifications', async (req: AuthRequest, res) => {
  const notifications = await Notification.find({ recipientUserId: req.user!._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
  const unreadCount = await Notification.countDocuments({ recipientUserId: req.user!._id, read: false });
  res.json({ success: true, notifications, unreadCount });
});

router.patch('/notifications/read', async (req: AuthRequest, res) => {
  await Notification.updateMany({ recipientUserId: req.user!._id, read: false }, { $set: { read: true } });
  res.json({ success: true });
});

// 2. User Management & Scoped Roles + Customer Management
router.get('/users', requireRole('super_admin', 'admin'), async (req, res) => {
  const q = String(req.query.q || '').trim();
  const role = String(req.query.role || '').trim();
  const filter: Record<string, any> = {};
  if (role) filter.role = role;
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(150).lean();
  res.json({ success: true, users });
});

router.get('/customers', requireRole('super_admin', 'admin', 'support_agent', 'order_manager'), async (req, res) => {
  const q = String(req.query.q || '').trim();
  const filter: Record<string, any> = { role: 'customer' };
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const customers = await User.find(filter).sort({ createdAt: -1 }).limit(150).lean();
  const customerIds = customers.map((c) => c._id);
  const orderStats =
    customerIds.length > 0
      ? await ParentOrder.aggregate([
          { $match: { customerId: { $in: customerIds } } },
          {
            $group: {
              _id: '$customerId',
              ordersCount: { $sum: 1 },
              totalSpent: { $sum: '$grandTotal' },
              lastOrderAt: { $max: '$createdAt' },
            },
          },
        ])
      : [];
  const statsMap = new Map<string, { ordersCount: number; totalSpent: number; lastOrderAt?: Date }>();
  for (const row of orderStats) {
    statsMap.set(String(row._id), {
      ordersCount: row.ordersCount || 0,
      totalSpent: row.totalSpent || 0,
      lastOrderAt: row.lastOrderAt,
    });
  }

  res.json({
    success: true,
    customers: customers.map((c) => {
      const st = statsMap.get(String(c._id));
      return {
        ...c,
        ordersCount: st?.ordersCount || 0,
        totalSpent: st?.totalSpent || 0,
        lastOrderAt: st?.lastOrderAt || null,
      };
    }),
  });
});

router.get('/customers/:id', requireRole('super_admin', 'admin', 'support_agent', 'order_manager'), async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid customer ID' });
    return;
  }
  const customer = await User.findById(req.params.id).lean();
  if (!customer) {
    res.status(404).json({ success: false, error: 'Customer not found' });
    return;
  }
  const orders = await ParentOrder.find({ customerId: customer._id }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ success: true, customer, orders });
});

router.patch('/users/:id/status', requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid user ID' });
    return;
  }
  const status = req.body.status;
  if (!['active', 'suspended', 'banned'].includes(status)) {
    res.status(400).json({ success: false, error: 'Invalid status' });
    return;
  }
  if (req.params.id === String(req.user!._id) && status !== 'active') {
    res.status(400).json({ success: false, error: 'You cannot suspend or ban your own account' });
    return;
  }
  const targetUser = await User.findById(req.params.id);
  if (!targetUser) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }
  if (targetUser.role === 'super_admin' && req.user!.role !== 'super_admin') {
    res.status(403).json({ success: false, error: 'Only a Super Admin can modify another Super Admin account' });
    return;
  }
  targetUser.status = status;
  await targetUser.save();

  await recordAuditLog({
    req,
    action: 'user_status_changed',
    targetType: 'User',
    targetId: req.params.id,
    details: { status },
  });
  res.json({ success: true, user: targetUser });
});

router.patch('/users/:id/role', requireRole('super_admin'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid user ID' });
    return;
  }
  const role = req.body.role;
  const permissions = Array.isArray(req.body.permissions) ? req.body.permissions : [];
  const allowed = [
    'customer',
    'seller',
    'admin',
    'super_admin',
    'catalog_manager',
    'order_manager',
    'finance_manager',
    'support_agent',
    'content_manager',
  ];
  if (!allowed.includes(role)) {
    res.status(400).json({ success: false, error: 'Invalid role' });
    return;
  }
  if (req.params.id === String(req.user!._id) && role !== 'super_admin') {
    res.status(400).json({ success: false, error: 'Super Admin cannot self-demote from this panel' });
    return;
  }
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { role, permissions } }, { new: true });
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }
  await recordAuditLog({
    req,
    action: 'user_role_updated',
    targetType: 'User',
    targetId: req.params.id,
    details: { role, permissions },
  });
  res.json({ success: true, user });
});

// 3. Seller Management (Applications + Stores + Detail)
router.get('/sellers', requireRole('super_admin', 'admin'), async (_req, res) => {
  const [applications, stores, productCounts, orderStats] = await Promise.all([
    SellerApplication.find().populate('userId', 'name email phone').sort({ createdAt: -1 }).lean(),
    Store.find().populate('ownerUserId', 'name email phone').sort({ createdAt: -1 }).lean(),
    CanonicalProduct.aggregate([
      { $match: { moderationStatus: 'published' } },
      { $group: { _id: '$createdByStoreId', count: { $sum: 1 } } },
    ]),
    SubOrder.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: '$storeId', ordersCount: { $sum: 1 }, totalRevenue: { $sum: '$subtotal' } } },
    ]),
  ]);

  const prodCountMap = new Map<string, number>();
  for (const r of productCounts) if (r._id) prodCountMap.set(String(r._id), r.count || 0);
  const orderStatMap = new Map<string, { ordersCount: number; totalRevenue: number }>();
  for (const r of orderStats) if (r._id) orderStatMap.set(String(r._id), { ordersCount: r.ordersCount || 0, totalRevenue: r.totalRevenue || 0 });

  res.json({
    success: true,
    applications,
    stores: stores.map((st: any) => {
      const ord = orderStatMap.get(String(st._id));
      return {
        ...st,
        realProductCount: prodCountMap.get(String(st._id)) ?? st.productCount ?? 0,
        ordersCount: ord?.ordersCount || 0,
        totalRevenue: ord?.totalRevenue || 0,
      };
    }),
  });
});

router.get('/sellers/:id', requireRole('super_admin', 'admin'), async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid store ID' });
    return;
  }
  const store = await Store.findById(req.params.id).populate('ownerUserId', 'name email phone status').lean();
  if (!store) {
    res.status(404).json({ success: false, error: 'Store not found' });
    return;
  }
  const [products, subOrders, application] = await Promise.all([
    CanonicalProduct.find({ createdByStoreId: store._id }).sort({ createdAt: -1 }).limit(30).lean(),
    SubOrder.find({ storeId: store._id }).sort({ createdAt: -1 }).limit(30).lean(),
    SellerApplication.findOne({ userId: (store.ownerUserId as any)?._id || store.ownerUserId }).lean(),
  ]);
  res.json({ success: true, store, products, subOrders, application });
});

router.patch('/sellers/applications/:id', requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid application ID' });
    return;
  }
  const appDoc = await SellerApplication.findById(req.params.id);
  if (!appDoc) {
    res.status(404).json({ success: false, error: 'Application not found' });
    return;
  }
  const { status, note } = req.body;
  if (!['approved', 'rejected', 'additional_info_required', 'suspended'].includes(status)) {
    res.status(400).json({ success: false, error: 'Invalid decision status' });
    return;
  }
  if (appDoc.status === 'approved' && (status === 'rejected' || status === 'additional_info_required')) {
    res.status(409).json({
      success: false,
      error: 'Approved seller applications cannot be moved back to rejected/info-required; suspend the store instead.',
    });
    return;
  }

  if (status === 'approved') {
    const applicant = await User.findById(appDoc.userId);
    if (!applicant || applicant.status !== 'active') {
      res.status(400).json({
        success: false,
        error: 'Cannot approve seller application for a suspended or missing user account.',
      });
      return;
    }
    if (applicant.role === 'customer') {
      applicant.role = 'seller';
      await applicant.save();
    }
  }

  appDoc.status = status;
  appDoc.reviewNotes = note;
  appDoc.reviewedBy = req.user!._id;
  appDoc.reviewedAt = new Date();
  appDoc.statusHistory.push({
    status,
    note,
    changedBy: req.user!._id,
    changedAt: new Date(),
  });
  await appDoc.save();

  if (status === 'approved') {
    const baseSlug = appDoc.storeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const existingStore = await Store.findOne({ ownerUserId: appDoc.userId });
    if (!existingStore) {
      await Store.create({
        ownerUserId: appDoc.userId,
        name: appDoc.storeName,
        bnName: appDoc.bnStoreName,
        slug: `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`,
        description: appDoc.description,
        verified: true,
        status: 'active',
        division: appDoc.division,
        district: appDoc.district,
        pickupAddress: appDoc.pickupAddress,
        supportPhone: appDoc.phone,
        payoutAccount: {
          method: appDoc.bankOrMfsType,
          accountNumber: appDoc.accountNumber,
          accountHolderName: appDoc.accountHolderName,
        },
      });
    } else {
      existingStore.status = 'active';
      await existingStore.save();
    }
  } else if (status === 'suspended') {
    await Store.updateOne({ ownerUserId: appDoc.userId }, { $set: { status: 'suspended' } });
  }

  await Notification.create({
    recipientUserId: appDoc.userId,
    recipientRoleScope: 'customer',
    type: 'seller_application_update',
    title: `Seller Application ${status.replace(/_/g, ' ').toUpperCase()}`,
    message: note || `Your store application for "${appDoc.storeName}" is now ${status}.`,
    link: status === 'approved' ? '/seller' : '/become-a-seller',
  });

  await recordAuditLog({
    req,
    action: `seller_application_${status}`,
    targetType: 'SellerApplication',
    targetId: String(appDoc._id),
    details: { storeName: appDoc.storeName, note },
  });

  res.json({ success: true, application: appDoc });
});

router.patch('/sellers/stores/:id/status', requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid store ID' });
    return;
  }
  const updates: Record<string, any> = {};
  if (req.body.status !== undefined) {
    if (!['active', 'suspended'].includes(req.body.status)) {
      res.status(400).json({ success: false, error: 'Invalid store status' });
      return;
    }
    updates.status = req.body.status;
  }
  if (req.body.isFeatured !== undefined) {
    updates.isFeatured = Boolean(req.body.isFeatured);
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ success: false, error: 'No valid fields provided to update' });
    return;
  }

  const store = await Store.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
  if (!store) {
    res.status(404).json({ success: false, error: 'Store not found' });
    return;
  }
  await recordAuditLog({
    req,
    action: 'store_status_updated',
    targetType: 'Store',
    targetId: req.params.id,
    details: updates,
  });
  res.json({ success: true, store });
});

// 4. Product & Catalog Moderation + Admin CRUD + Categories & Brands
router.get('/catalog/products', requireRole('super_admin', 'admin', 'catalog_manager'), async (req, res) => {
  const q = String(req.query.q || '').trim();
  const categoryId = String(req.query.categoryId || '').trim();
  const brandId = String(req.query.brandId || '').trim();
  const status = String(req.query.status || '').trim();
  const filter: Record<string, any> = {};
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: rx }, { bnTitle: rx }, { slug: rx }, { 'variants.sku': rx }];
  }
  if (categoryId && isValidObjectId(categoryId)) filter.categoryId = categoryId;
  if (brandId && isValidObjectId(brandId)) filter.brandId = brandId;
  if (status) filter.moderationStatus = status;

  const [products, offers, categories, brands, stores, catCounts, brandCounts] = await Promise.all([
    CanonicalProduct.find(filter)
      .populate('categoryId', 'name slug')
      .populate('brandId', 'name slug')
      .populate('createdByStoreId', 'name slug')
      .sort({ createdAt: -1 })
      .lean(),
    SellerOffer.find().populate('storeId', 'name').populate('productId', 'title').limit(300).lean(),
    Category.find().sort({ displayOrder: 1, name: 1 }).lean(),
    Brand.find().sort({ displayOrder: 1, name: 1 }).lean(),
    Store.find({ status: 'active' }).select('name ownerUserId').sort({ name: 1 }).lean(),
    CanonicalProduct.aggregate([{ $group: { _id: '$categoryId', count: { $sum: 1 } } }]),
    CanonicalProduct.aggregate([{ $group: { _id: '$brandId', count: { $sum: 1 } } }]),
  ]);

  const catCountMap = new Map(catCounts.map((c) => [String(c._id), c.count as number]));
  const brandCountMap = new Map(brandCounts.map((b) => [String(b._id), b.count as number]));

  res.json({
    success: true,
    products,
    offers,
    categories: categories.map((c) => ({ ...c, productCount: catCountMap.get(String(c._id)) || 0 })),
    brands: brands.map((b) => ({ ...b, productCount: brandCountMap.get(String(b._id)) || 0 })),
    stores,
  });
});

router.get('/catalog/products/:id', requireRole('super_admin', 'admin', 'catalog_manager'), async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid product ID' });
    return;
  }
  const product = await CanonicalProduct.findById(req.params.id)
    .populate('categoryId', 'name slug')
    .populate('brandId', 'name slug')
    .populate('createdByStoreId', 'name slug')
    .lean();
  if (!product) {
    res.status(404).json({ success: false, error: 'Product not found' });
    return;
  }
  const offers = await SellerOffer.find({ productId: product._id }).populate('storeId', 'name slug').lean();
  res.json({ success: true, product, offers });
});

router.post('/catalog/products', requireRole('super_admin', 'admin', 'catalog_manager'), async (req: AuthRequest, res) => {
  try {
    const prodParsed = canonicalProductSchema.safeParse(req.body.product || req.body);
    if (!prodParsed.success) {
      res.status(400).json({ success: false, error: prodParsed.error.issues[0]?.message || 'Invalid product data' });
      return;
    }

    const [cat, brand] = await Promise.all([
      Category.findById(prodParsed.data.categoryId).lean(),
      Brand.findById(prodParsed.data.brandId).lean(),
    ]);
    if (!cat || !brand) {
      res.status(400).json({ success: false, error: 'Valid category and brand are required' });
      return;
    }

    const requestedStoreId = req.body.storeId;
    const store = requestedStoreId
      ? await Store.findById(requestedStoreId).lean()
      : await Store.findOne({ status: 'active' }).sort({ createdAt: 1 }).lean();
    if (!store) {
      res.status(400).json({ success: false, error: 'At least one active seller store is required to attach an offer' });
      return;
    }

    const offerInput = req.body.offer;
    let validatedOffer: any = null;
    if (offerInput) {
      const offerParsed = sellerOfferSchema.safeParse({
        ...offerInput,
        productId: 'pending',
        variantSku: offerInput.variantSku || prodParsed.data.variants[0].sku,
      });
      if (!offerParsed.success) {
        res.status(400).json({ success: false, error: offerParsed.error.issues[0]?.message || 'Invalid offer pricing/stock' });
        return;
      }
      validatedOffer = offerParsed.data;
    }

    const customSlug = prodParsed.data.slug?.trim();
    const slug = customSlug
      ? slugify(customSlug)
      : `${slugify(prodParsed.data.title)}-${crypto.randomBytes(2).toString('hex')}`;
    const moderationStatus = ['draft', 'pending_review', 'approved', 'published'].includes(req.body.moderationStatus)
      ? req.body.moderationStatus
      : 'published';

    const subCategoryId =
      prodParsed.data.subCategoryId && isValidObjectId(prodParsed.data.subCategoryId)
        ? prodParsed.data.subCategoryId
        : undefined;

    const product = await CanonicalProduct.create({
      ...prodParsed.data,
      subCategoryId,
      slug,
      createdByUserId: req.user!._id,
      createdByStoreId: store._id,
      moderationStatus,
      isTrending: Boolean(req.body.isTrending),
      isFlashSaleCandidate: Boolean(req.body.isFlashSaleCandidate),
      isSponsored: Boolean(req.body.isSponsored ?? prodParsed.data.isSponsored),
      searchNormalizedText: buildNormalizedSearchText({
        title: prodParsed.data.title,
        bnTitle: prodParsed.data.bnTitle,
        keywords: prodParsed.data.keywords,
        brandName: brand.name,
        categoryName: cat.name,
        variants: prodParsed.data.variants,
      }),
    });

    if (validatedOffer) {
      const discountPercent =
        validatedOffer.compareAtPrice && validatedOffer.compareAtPrice > validatedOffer.price
          ? Math.round(((validatedOffer.compareAtPrice - validatedOffer.price) / validatedOffer.compareAtPrice) * 100)
          : 0;
      await SellerOffer.create({
        ...validatedOffer,
        productId: product._id,
        storeId: store._id,
        sellerUserId: store.ownerUserId,
        discountPercent,
      });
    }

    const publishedCount = await CanonicalProduct.countDocuments({
      createdByStoreId: store._id,
      moderationStatus: 'published',
    });
    await Store.updateOne({ _id: store._id }, { $set: { productCount: publishedCount } });

    await recordAuditLog({
      req,
      action: 'admin_product_created',
      targetType: 'CanonicalProduct',
      targetId: String(product._id),
      details: { title: product.title, storeId: String(store._id) },
    });

    res.status(201).json({ success: true, product });
  } catch (err) {
    handleMongoError(err, res, 'A product with this slug already exists');
  }
});

router.patch('/catalog/products/:id', requireRole('super_admin', 'admin', 'catalog_manager'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid product ID' });
    return;
  }
  const existing = await CanonicalProduct.findById(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Product not found' });
    return;
  }

  const updates: Record<string, any> = {};
  if (req.body.title !== undefined) {
    const t = String(req.body.title).trim();
    if (t.length < 3) {
      res.status(400).json({ success: false, error: 'Product title must be at least 3 characters' });
      return;
    }
    updates.title = t;
  }
  if (req.body.bnTitle !== undefined) updates.bnTitle = String(req.body.bnTitle).trim();
  if (req.body.description !== undefined) {
    const d = String(req.body.description).trim();
    if (d.length < 10) {
      res.status(400).json({ success: false, error: 'Description must be at least 10 characters' });
      return;
    }
    updates.description = d;
  }
  if (req.body.slug !== undefined && String(req.body.slug).trim()) {
    const candidateSlug = slugify(String(req.body.slug));
    const collision = await CanonicalProduct.exists({ slug: candidateSlug, _id: { $ne: existing._id } });
    if (collision) {
      res.status(409).json({ success: false, error: 'A product with this slug already exists' });
      return;
    }
    updates.slug = candidateSlug;
  }
  if (req.body.categoryId !== undefined && isValidObjectId(req.body.categoryId)) {
    updates.categoryId = req.body.categoryId;
  }
  if (req.body.subCategoryId !== undefined) {
    updates.subCategoryId =
      req.body.subCategoryId && isValidObjectId(String(req.body.subCategoryId))
        ? req.body.subCategoryId
        : null;
  }
  if (req.body.brandId !== undefined && isValidObjectId(req.body.brandId)) {
    updates.brandId = req.body.brandId;
  }
  if (req.body.videoUrl !== undefined) updates.videoUrl = String(req.body.videoUrl).trim();
  if (req.body.warranty !== undefined) updates.warranty = String(req.body.warranty).trim();
  if (req.body.returnPolicyDays !== undefined) updates.returnPolicyDays = Math.max(0, Math.min(30, Number(req.body.returnPolicyDays)));
  if (req.body.weightGrams !== undefined && Number(req.body.weightGrams) > 0) updates.weightGrams = Number(req.body.weightGrams);
  if (req.body.modelName !== undefined) updates.modelName = String(req.body.modelName).trim();
  if (Array.isArray(req.body.keywords)) updates.keywords = req.body.keywords.map((k: unknown) => String(k).trim()).filter(Boolean);
  if (Array.isArray(req.body.specifications)) {
    updates.specifications = req.body.specifications.filter((s: any) => s?.key && s?.value);
  }
  if (Array.isArray(req.body.variants) && req.body.variants.length > 0) {
    updates.variants = req.body.variants.filter((v: any) => v?.sku && v?.label);
  }
  if (Array.isArray(req.body.images) && req.body.images.length > 0) updates.images = req.body.images;
  if (req.body.moderationStatus !== undefined) {
    const allowed = ['draft', 'pending_review', 'approved', 'published', 'rejected', 'suspended', 'archived', 'unpublished'];
    if (!allowed.includes(req.body.moderationStatus)) {
      res.status(400).json({ success: false, error: 'Invalid moderation status' });
      return;
    }
    updates.moderationStatus = req.body.moderationStatus;
  }
  if (req.body.isTrending !== undefined) updates.isTrending = Boolean(req.body.isTrending);
  if (req.body.isFlashSaleCandidate !== undefined) updates.isFlashSaleCandidate = Boolean(req.body.isFlashSaleCandidate);
  if (req.body.isSponsored !== undefined) updates.isSponsored = Boolean(req.body.isSponsored);

  const mergedCategoryId = updates.categoryId || existing.categoryId;
  const mergedBrandId = updates.brandId || existing.brandId;
  const [cat, brand] = await Promise.all([
    Category.findById(mergedCategoryId).lean(),
    Brand.findById(mergedBrandId).lean(),
  ]);
  updates.searchNormalizedText = buildNormalizedSearchText({
    title: updates.title ?? existing.title,
    bnTitle: updates.bnTitle ?? existing.bnTitle,
    keywords: updates.keywords ?? existing.keywords,
    brandName: brand?.name,
    categoryName: cat?.name,
    variants: updates.variants ?? existing.variants,
  });

  const product = await CanonicalProduct.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });

  // Optional primary offer price/stock update when passed from Admin Product Edit
  if (req.body.offer && typeof req.body.offer === 'object') {
    const offerId = req.body.offer._id;
    const price = Number(req.body.offer.price);
    const compareAtPrice = req.body.offer.compareAtPrice ? Number(req.body.offer.compareAtPrice) : undefined;
    const stock = Number(req.body.offer.stock);
    if (Number.isFinite(price) && price > 0 && Number.isFinite(stock) && stock >= 0) {
      const discountPercent =
        compareAtPrice && compareAtPrice > price
          ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
          : 0;
      const offerQuery = offerId && isValidObjectId(offerId) ? { _id: offerId, productId: existing._id } : { productId: existing._id };
      const offerSet: Record<string, any> = {
        price,
        stock,
        discountPercent,
        isActive: req.body.offer.isActive ?? true,
      };
      if (req.body.offer.deliveryEstimateDays !== undefined) {
        offerSet.deliveryEstimateDays = String(req.body.offer.deliveryEstimateDays).trim() || '2-4 Days';
      }
      if (req.body.offer.shippingFeeDhaka !== undefined && Number.isFinite(Number(req.body.offer.shippingFeeDhaka))) {
        offerSet.shippingFeeDhaka = Math.max(0, Number(req.body.offer.shippingFeeDhaka));
      }
      if (req.body.offer.shippingFeeNationwide !== undefined && Number.isFinite(Number(req.body.offer.shippingFeeNationwide))) {
        offerSet.shippingFeeNationwide = Math.max(0, Number(req.body.offer.shippingFeeNationwide));
      }
      const offerUpdate: Record<string, any> = { $set: offerSet };
      if (compareAtPrice !== undefined) {
        offerUpdate.$set.compareAtPrice = compareAtPrice;
      } else {
        offerUpdate.$unset = { compareAtPrice: 1 };
      }
      const updatedOffer = await SellerOffer.findOneAndUpdate(offerQuery, offerUpdate, { new: true });
      if (!updatedOffer) {
        const store = existing.createdByStoreId
          ? await Store.findById(existing.createdByStoreId).lean()
          : await Store.findOne({ status: 'active' }).sort({ createdAt: 1 }).lean();
        if (store) {
          const variantSku =
            String(req.body.offer.variantSku || '').trim() ||
            (Array.isArray(updates.variants) && updates.variants[0]?.sku) ||
            existing.variants?.[0]?.sku ||
            'DEFAULT';
          await SellerOffer.create({
            productId: existing._id,
            storeId: store._id,
            sellerUserId: store.ownerUserId,
            variantSku,
            price,
            ...(compareAtPrice !== undefined ? { compareAtPrice } : {}),
            stock,
            discountPercent,
            isActive: req.body.offer.isActive ?? true,
            deliveryEstimateDays:
              req.body.offer.deliveryEstimateDays !== undefined
                ? String(req.body.offer.deliveryEstimateDays).trim() || '2-4 Days'
                : '2-4 Days',
            shippingFeeDhaka:
              req.body.offer.shippingFeeDhaka !== undefined &&
              Number.isFinite(Number(req.body.offer.shippingFeeDhaka))
                ? Math.max(0, Number(req.body.offer.shippingFeeDhaka))
                : 60,
            shippingFeeNationwide:
              req.body.offer.shippingFeeNationwide !== undefined &&
              Number.isFinite(Number(req.body.offer.shippingFeeNationwide))
                ? Math.max(0, Number(req.body.offer.shippingFeeNationwide))
                : 120,
          });
        }
      }
    }
  }

  if (updates.moderationStatus !== undefined && product?.createdByStoreId) {
    const publishedCount = await CanonicalProduct.countDocuments({
      createdByStoreId: product.createdByStoreId,
      moderationStatus: 'published',
    });
    await Store.updateOne({ _id: product.createdByStoreId }, { $set: { productCount: publishedCount } });
  }
  await recordAuditLog({
    req,
    action: 'admin_product_updated',
    targetType: 'CanonicalProduct',
    targetId: req.params.id,
    details: updates,
  });
  res.json({ success: true, product });
});

router.delete('/catalog/products/:id', requireRole('super_admin', 'admin', 'catalog_manager'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid product ID' });
    return;
  }
  const product = await CanonicalProduct.findById(req.params.id);
  if (!product) {
    res.status(404).json({ success: false, error: 'Product not found' });
    return;
  }
  const hasOrders = await SubOrder.exists({ 'items.productId': product._id });
  if (hasOrders) {
    res.status(409).json({
      success: false,
      error: 'Cannot delete a product that has historical orders; suspend or archive it instead.',
    });
    return;
  }
  await SellerOffer.deleteMany({ productId: product._id });
  await CanonicalProduct.deleteOne({ _id: product._id });
  if (product.createdByStoreId) {
    const publishedCount = await CanonicalProduct.countDocuments({
      createdByStoreId: product.createdByStoreId,
      moderationStatus: 'published',
    });
    await Store.updateOne({ _id: product.createdByStoreId }, { $set: { productCount: publishedCount } });
  }
  await recordAuditLog({
    req,
    action: 'admin_product_deleted',
    targetType: 'CanonicalProduct',
    targetId: req.params.id,
    details: { title: product.title },
  });
  res.json({ success: true });
});

router.patch(
  '/catalog/products/:id/moderation',
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthRequest, res) => {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ success: false, error: 'Invalid product ID' });
      return;
    }
    const status = req.body.moderationStatus;
    const allowed = ['draft', 'pending_review', 'approved', 'published', 'rejected', 'suspended', 'archived', 'unpublished'];
    if (!allowed.includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid moderation status' });
      return;
    }

    const updates: Record<string, any> = { moderationStatus: status };
    if (req.body.moderationNotes !== undefined) updates.moderationNotes = String(req.body.moderationNotes);
    if (req.body.isTrending !== undefined) updates.isTrending = Boolean(req.body.isTrending);
    if (req.body.isFlashSaleCandidate !== undefined) {
      updates.isFlashSaleCandidate = Boolean(req.body.isFlashSaleCandidate);
    }

    const product = await CanonicalProduct.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    if (product.createdByStoreId) {
      const publishedCount = await CanonicalProduct.countDocuments({
        createdByStoreId: product.createdByStoreId,
        moderationStatus: 'published',
      });
      await Store.updateOne({ _id: product.createdByStoreId }, { $set: { productCount: publishedCount } });
    }

    if (product.createdByUserId && String(product.createdByUserId) !== String(req.user!._id)) {
      await Notification.create({
        recipientUserId: product.createdByUserId,
        recipientRoleScope: 'seller',
        type: 'product_moderation',
        title: `Product "${product.title}" is now ${status.replace(/_/g, ' ').toUpperCase()}`,
        message:
          req.body.moderationNotes ||
          (status === 'published'
            ? 'Your product passed moderation and is now live on the marketplace.'
            : `Your product moderation status was updated to ${status.replace(/_/g, ' ')}.`),
        link: status === 'published' ? `/product/${product.slug}` : '/seller/products',
      });
    }

    await recordAuditLog({
      req,
      action: 'product_moderation_updated',
      targetType: 'CanonicalProduct',
      targetId: req.params.id,
      details: updates,
    });
    res.json({ success: true, product });
  }
);

router.get('/catalog/categories', requireRole('super_admin', 'admin', 'catalog_manager'), async (_req, res) => {
  const [categories, counts] = await Promise.all([
    Category.find().sort({ displayOrder: 1, name: 1 }).lean(),
    CanonicalProduct.aggregate([{ $group: { _id: '$categoryId', count: { $sum: 1 } } }]),
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count as number]));
  res.json({
    success: true,
    categories: categories.map((c) => ({ ...c, productCount: countMap.get(String(c._id)) || 0 })),
  });
});

router.post('/catalog/categories', requireRole('super_admin', 'admin', 'catalog_manager'), async (req: AuthRequest, res) => {
  const parsed = categoryInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid category data' });
    return;
  }
  try {
    let parentId: string | null = null;
    if (parsed.data.parentId) {
      if (!isValidObjectId(parsed.data.parentId)) {
        res.status(400).json({ success: false, error: 'Invalid parent category ID' });
        return;
      }
      const parentExists = await Category.exists({ _id: parsed.data.parentId });
      if (!parentExists) {
        res.status(404).json({ success: false, error: 'Parent category not found' });
        return;
      }
      parentId = parsed.data.parentId;
    }

    const slug = slugify(parsed.data.slug || parsed.data.name);
    const cat = await Category.create({
      ...parsed.data,
      parentId,
      bnName: parsed.data.bnName || parsed.data.name,
      slug,
    });
    await recordAuditLog({ req, action: 'category_created', targetType: 'Category', targetId: String(cat._id) });
    res.status(201).json({ success: true, category: cat });
  } catch (err) {
    handleMongoError(err, res, 'A category with this slug already exists');
  }
});

router.put('/catalog/categories/:id', requireRole('super_admin', 'admin', 'catalog_manager'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid category ID' });
    return;
  }
  const parsed = categoryInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid category update' });
    return;
  }
  try {
    const updates: Record<string, any> = { ...parsed.data };
    if (parsed.data.parentId !== undefined) {
      if (!parsed.data.parentId) {
        updates.parentId = null;
      } else {
        if (!isValidObjectId(parsed.data.parentId) || parsed.data.parentId === req.params.id) {
          res.status(400).json({ success: false, error: 'Category cannot be its own parent' });
          return;
        }
        // Prevent circular hierarchy by walking ancestor chain
        let cursor: string | null = parsed.data.parentId;
        const visited = new Set<string>([req.params.id]);
        while (cursor) {
          if (visited.has(cursor)) {
            res.status(400).json({ success: false, error: 'Circular parent category relationship is not allowed' });
            return;
          }
          visited.add(cursor);
          const anc: { parentId?: unknown } | null = await Category.findById(cursor).select('parentId').lean();
          if (!anc) {
            res.status(404).json({ success: false, error: 'Parent category not found' });
            return;
          }
          cursor = anc.parentId ? String(anc.parentId) : null;
        }
        updates.parentId = parsed.data.parentId;
      }
    }
    if (parsed.data.slug !== undefined) {
      updates.slug = slugify(parsed.data.slug || parsed.data.name || 'category');
    }
    const category = await Category.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!category) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }
    await recordAuditLog({ req, action: 'category_updated', targetType: 'Category', targetId: req.params.id, details: updates });
    res.json({ success: true, category });
  } catch (err) {
    handleMongoError(err, res, 'A category with this slug already exists');
  }
});

router.patch('/catalog/categories/:id', requireRole('super_admin', 'admin', 'catalog_manager'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid category ID' });
    return;
  }
  const updates: Record<string, any> = {};
  if (req.body.active !== undefined) updates.active = Boolean(req.body.active);
  if (req.body.isFeatured !== undefined) updates.isFeatured = Boolean(req.body.isFeatured);
  if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
  if (req.body.bnName !== undefined) updates.bnName = String(req.body.bnName).trim();
  if (req.body.displayOrder !== undefined) updates.displayOrder = Number(req.body.displayOrder);
  if (req.body.iconName !== undefined) updates.iconName = String(req.body.iconName).trim();
  if (req.body.imageUrl !== undefined) updates.imageUrl = String(req.body.imageUrl).trim();
  if (req.body.accentBg !== undefined) updates.accentBg = String(req.body.accentBg).trim();
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ success: false, error: 'No valid category fields provided' });
    return;
  }
  const category = await Category.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
  if (!category) {
    res.status(404).json({ success: false, error: 'Category not found' });
    return;
  }
  await recordAuditLog({ req, action: 'category_updated', targetType: 'Category', targetId: req.params.id, details: updates });
  res.json({ success: true, category });
});

router.delete('/catalog/categories/:id', requireRole('super_admin', 'admin', 'catalog_manager'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid category ID' });
    return;
  }
  const [hasProducts, hasChildren] = await Promise.all([
    CanonicalProduct.exists({ categoryId: req.params.id }),
    Category.exists({ parentId: req.params.id }),
  ]);
  if (hasProducts) {
    res.status(409).json({
      success: false,
      error: 'Cannot delete a category that has assigned products. Reassign products or deactivate it instead.',
    });
    return;
  }
  if (hasChildren) {
    res.status(409).json({
      success: false,
      error: 'Cannot delete a category that has child subcategories. Reassign or delete child categories first.',
    });
    return;
  }
  const deleted = await Category.deleteOne({ _id: req.params.id });
  if (!deleted.deletedCount) {
    res.status(404).json({ success: false, error: 'Category not found' });
    return;
  }
  await recordAuditLog({ req, action: 'category_deleted', targetType: 'Category', targetId: req.params.id });
  res.json({ success: true });
});

router.get('/catalog/brands', requireRole('super_admin', 'admin', 'catalog_manager'), async (_req, res) => {
  const [brands, counts] = await Promise.all([
    Brand.find().sort({ displayOrder: 1, name: 1 }).lean(),
    CanonicalProduct.aggregate([{ $group: { _id: '$brandId', count: { $sum: 1 } } }]),
  ]);
  const countMap = new Map(counts.map((b) => [String(b._id), b.count as number]));
  res.json({
    success: true,
    brands: brands.map((b) => ({ ...b, productCount: countMap.get(String(b._id)) || 0 })),
  });
});

router.post('/catalog/brands', requireRole('super_admin', 'admin', 'catalog_manager'), async (req: AuthRequest, res) => {
  const parsed = brandInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid brand data' });
    return;
  }
  try {
    const slug = slugify(parsed.data.slug || parsed.data.name);
    const brand = await Brand.create({
      ...parsed.data,
      logoText: parsed.data.logoText || parsed.data.name,
      slug,
    });
    await recordAuditLog({ req, action: 'brand_created', targetType: 'Brand', targetId: String(brand._id) });
    res.status(201).json({ success: true, brand });
  } catch (err) {
    handleMongoError(err, res, 'A brand with this slug already exists');
  }
});

router.put('/catalog/brands/:id', requireRole('super_admin', 'admin', 'catalog_manager'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid brand ID' });
    return;
  }
  const parsed = brandInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid brand update' });
    return;
  }
  try {
    const updates: Record<string, any> = { ...parsed.data };
    if (parsed.data.slug !== undefined) {
      updates.slug = slugify(parsed.data.slug || parsed.data.name || 'brand');
    }
    const brand = await Brand.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!brand) {
      res.status(404).json({ success: false, error: 'Brand not found' });
      return;
    }
    await recordAuditLog({ req, action: 'brand_updated', targetType: 'Brand', targetId: req.params.id, details: updates });
    res.json({ success: true, brand });
  } catch (err) {
    handleMongoError(err, res, 'A brand with this slug already exists');
  }
});

router.patch('/catalog/brands/:id', requireRole('super_admin', 'admin', 'catalog_manager'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid brand ID' });
    return;
  }
  const updates: Record<string, any> = {};
  if (req.body.active !== undefined) updates.active = Boolean(req.body.active);
  if (req.body.isPopular !== undefined) updates.isPopular = Boolean(req.body.isPopular);
  if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
  if (req.body.logoText !== undefined) updates.logoText = String(req.body.logoText).trim();
  if (req.body.logoUrl !== undefined) updates.logoUrl = String(req.body.logoUrl).trim();
  if (req.body.displayOrder !== undefined) updates.displayOrder = Number(req.body.displayOrder);
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ success: false, error: 'No valid brand fields provided' });
    return;
  }
  const brand = await Brand.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
  if (!brand) {
    res.status(404).json({ success: false, error: 'Brand not found' });
    return;
  }
  await recordAuditLog({ req, action: 'brand_updated', targetType: 'Brand', targetId: req.params.id, details: updates });
  res.json({ success: true, brand });
});

router.delete('/catalog/brands/:id', requireRole('super_admin', 'admin', 'catalog_manager'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid brand ID' });
    return;
  }
  const hasProducts = await CanonicalProduct.exists({ brandId: req.params.id });
  if (hasProducts) {
    res.status(409).json({
      success: false,
      error: 'Cannot delete a brand that has assigned products. Reassign products or deactivate it instead.',
    });
    return;
  }
  const deleted = await Brand.deleteOne({ _id: req.params.id });
  if (!deleted.deletedCount) {
    res.status(404).json({ success: false, error: 'Brand not found' });
    return;
  }
  await recordAuditLog({ req, action: 'brand_deleted', targetType: 'Brand', targetId: req.params.id });
  res.json({ success: true });
});

// 5. Order & Payment Management
router.get('/orders', requireRole('super_admin', 'admin', 'order_manager'), async (req, res) => {
  const q = String(req.query.q || '').trim();
  const status = String(req.query.status || '').trim();
  const subFilter: Record<string, any> = {};
  if (status) subFilter.status = status;
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    subFilter.$or = [{ subOrderNumber: rx }, { storeName: rx }, { 'items.productTitle': rx }];
  }

  const parentFilter: Record<string, any> = {};
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    parentFilter.$or = [{ orderNumber: rx }, { 'shippingAddress.fullName': rx }, { 'shippingAddress.phone': rx }];
  }

  const [parentOrders, subOrders, transactions] = await Promise.all([
    ParentOrder.find(parentFilter).populate('customerId', 'name email phone').sort({ createdAt: -1 }).limit(150).lean(),
    SubOrder.find(subFilter).populate('customerId', 'name email phone').sort({ createdAt: -1 }).limit(200).lean(),
    PaymentTransaction.find().sort({ createdAt: -1 }).limit(150).lean(),
  ]);
  res.json({ success: true, parentOrders, subOrders, transactions });
});

router.get('/orders/:id', requireRole('super_admin', 'admin', 'order_manager'), async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid order ID' });
    return;
  }
  const parentOrder = await ParentOrder.findById(req.params.id).populate('customerId', 'name email phone').lean();
  if (!parentOrder) {
    res.status(404).json({ success: false, error: 'Order not found' });
    return;
  }
  const [subOrders, paymentTransaction, returns] = await Promise.all([
    SubOrder.find({ parentOrderId: parentOrder._id }).lean(),
    PaymentTransaction.findOne({ parentOrderId: parentOrder._id }).lean(),
    ReturnRequest.find({ parentOrderId: parentOrder._id }).lean(),
  ]);
  res.json({ success: true, parentOrder, subOrders, paymentTransaction, returns });
});

router.patch('/orders/suborders/:id/status', requireRole('super_admin', 'admin', 'order_manager'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid suborder ID' });
    return;
  }
  try {
    const updated = await transitionSubOrderStatus({
      subOrderId: req.params.id,
      nextStatus: req.body.status,
      actorUserId: req.user!._id,
      note: req.body.note || 'Updated by Platform Admin',
      courierName: req.body.courierName,
      trackingNumber: req.body.trackingNumber,
    });
    await recordAuditLog({
      req,
      action: 'admin_suborder_status_updated',
      targetType: 'SubOrder',
      targetId: req.params.id,
      details: { status: req.body.status },
    });
    res.json({ success: true, subOrder: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update status';
    res.status(msg === 'Suborder not found' ? 404 : 400).json({ success: false, error: msg });
  }
});

// 6. Financial Management: Commission Rules, Ledger, Payout Approvals
router.get('/finance', requireRole('super_admin', 'admin', 'finance_manager'), async (_req, res) => {
  const [commissionRules, payouts, ledgerEntries, categories, stores] = await Promise.all([
    CommissionRule.find().populate('categoryId', 'name').populate('storeId', 'name').sort({ createdAt: -1 }).lean(),
    PayoutRequest.find().populate('storeId', 'name slug').sort({ createdAt: -1 }).lean(),
    FinancialLedgerEntry.find().populate('storeId', 'name').sort({ createdAt: -1 }).limit(100).lean(),
    Category.find({ active: true }).select('name').sort({ name: 1 }).lean(),
    Store.find({ status: 'active' }).select('name').sort({ name: 1 }).lean(),
  ]);
  res.json({ success: true, commissionRules, payouts, ledgerEntries, categories, stores });
});

router.post('/finance/commission-rules', requireRole('super_admin', 'admin', 'finance_manager'), async (req: AuthRequest, res) => {
  const parsed = commissionRuleInputSchema.safeParse({
    name: req.body.name,
    scope: req.body.scope,
    categoryId: req.body.categoryId || undefined,
    storeId: req.body.storeId || undefined,
    ratePercent: Number(req.body.ratePercent),
  });
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid commission rule' });
    return;
  }

  const { name, scope, categoryId, storeId, ratePercent } = parsed.data;
  const rulePayload: Record<string, any> = {
    name,
    ratePercent,
    isDefault: scope === 'global',
    active: true,
    updatedBy: req.user!._id,
  };

  if (scope === 'category') {
    if (!categoryId || !isValidObjectId(categoryId)) {
      res.status(400).json({ success: false, error: 'Invalid categoryId' });
      return;
    }
    const categoryExists = await Category.exists({ _id: categoryId });
    if (!categoryExists) {
      res.status(404).json({ success: false, error: 'Target category not found' });
      return;
    }
    await CommissionRule.updateMany({ categoryId, active: true }, { $set: { active: false } });
    rulePayload.categoryId = categoryId;
  } else if (scope === 'seller') {
    if (!storeId || !isValidObjectId(storeId)) {
      res.status(400).json({ success: false, error: 'Invalid storeId' });
      return;
    }
    const storeExists = await Store.exists({ _id: storeId });
    if (!storeExists) {
      res.status(404).json({ success: false, error: 'Target store not found' });
      return;
    }
    await CommissionRule.updateMany({ storeId, active: true }, { $set: { active: false } });
    rulePayload.storeId = storeId;
  } else {
    await CommissionRule.updateMany({ isDefault: true, active: true }, { $set: { active: false } });
  }

  const rule = await CommissionRule.create(rulePayload);
  await recordAuditLog({
    req,
    action: 'commission_rule_created',
    targetType: 'CommissionRule',
    targetId: String(rule._id),
    details: { name, scope, ratePercent },
  });
  res.status(201).json({ success: true, rule });
});

router.patch('/finance/commission-rules/:id', requireRole('super_admin', 'admin', 'finance_manager'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid commission rule ID' });
    return;
  }
  const active = Boolean(req.body.active);
  const existing = await CommissionRule.findById(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Commission rule not found' });
    return;
  }
  if (active) {
    if (existing.isDefault) {
      await CommissionRule.updateMany({ _id: { $ne: existing._id }, isDefault: true, active: true }, { $set: { active: false } });
    } else if (existing.categoryId) {
      await CommissionRule.updateMany({ _id: { $ne: existing._id }, categoryId: existing.categoryId, active: true }, { $set: { active: false } });
    } else if (existing.storeId) {
      await CommissionRule.updateMany({ _id: { $ne: existing._id }, storeId: existing.storeId, active: true }, { $set: { active: false } });
    }
  }
  existing.active = active;
  existing.updatedBy = req.user!._id;
  await existing.save();

  await recordAuditLog({
    req,
    action: 'commission_rule_updated',
    targetType: 'CommissionRule',
    targetId: String(existing._id),
    details: { active },
  });
  res.json({ success: true, rule: existing });
});

router.patch('/finance/payouts/:id', requireRole('super_admin', 'admin', 'finance_manager'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid payout request ID' });
    return;
  }
  const payout = await PayoutRequest.findById(req.params.id);
  if (!payout) {
    res.status(404).json({ success: false, error: 'Payout request not found' });
    return;
  }

  const nextStatus = req.body.status;
  if (!['approved', 'completed', 'rejected'].includes(nextStatus)) {
    res.status(400).json({ success: false, error: 'Invalid payout decision' });
    return;
  }
  if (payout.status === 'completed' || payout.status === 'rejected') {
    res.status(409).json({ success: false, error: `Payout already finalized as ${payout.status}` });
    return;
  }

  if (nextStatus === 'completed' && !String(req.body.settlementReference || '').trim()) {
    res.status(400).json({
      success: false,
      error: 'A verified bank/MFS settlement reference ID is required to complete a payout.',
    });
    return;
  }

  payout.status = nextStatus;
  payout.reviewedByAdminId = req.user!._id;
  payout.reviewedAt = new Date();
  payout.reviewNote = req.body.reviewNote;

  if (nextStatus === 'completed') {
    payout.settlementReference = String(req.body.settlementReference).trim();
    payout.completedAt = new Date();
    // Release hold and record paid_out entry idempotently
    await FinancialLedgerEntry.updateOne(
      { entryKey: `payout_paid:${payout._id}` },
      {
        $setOnInsert: {
          entryKey: `payout_paid:${payout._id}`,
          storeId: payout.storeId,
          payoutRequestId: payout._id,
          entryType: 'payout_settled',
          bucket: 'paid_out',
          amount: payout.amount,
          description: `Payout ${payout.payoutNumber} settled (Ref: ${payout.settlementReference})`,
          createdByUserId: req.user!._id,
        },
      },
      { upsert: true }
    );
    await FinancialLedgerEntry.updateOne(
      { entryKey: `payout_hold_release:${payout._id}` },
      {
        $setOnInsert: {
          entryKey: `payout_hold_release:${payout._id}`,
          storeId: payout.storeId,
          payoutRequestId: payout._id,
          entryType: 'payout_rejected_release',
          bucket: 'held',
          amount: -payout.amount,
          description: `Released hold upon settlement of ${payout.payoutNumber}`,
          createdByUserId: req.user!._id,
        },
      },
      { upsert: true }
    );
  } else if (nextStatus === 'rejected') {
    await FinancialLedgerEntry.updateOne(
      { entryKey: `payout_hold_release:${payout._id}` },
      {
        $setOnInsert: {
          entryKey: `payout_hold_release:${payout._id}`,
          storeId: payout.storeId,
          payoutRequestId: payout._id,
          entryType: 'payout_rejected_release',
          bucket: 'held',
          amount: -payout.amount,
          description: `Released hold upon rejection of ${payout.payoutNumber}`,
          createdByUserId: req.user!._id,
        },
      },
      { upsert: true }
    );
  }

  await payout.save();
  await Notification.create({
    recipientUserId: payout.sellerUserId,
    recipientRoleScope: 'seller',
    type: 'payout_update',
    title: `Payout ${payout.payoutNumber} ${nextStatus.toUpperCase()}`,
    message:
      nextStatus === 'completed'
        ? `৳${payout.amount} transferred via ${payout.method.toUpperCase()} (Ref: ${payout.settlementReference}).`
        : `Payout status updated to ${nextStatus}.`,
    link: '/seller/finance',
  });

  await recordAuditLog({
    req,
    action: `payout_${nextStatus}`,
    targetType: 'PayoutRequest',
    targetId: String(payout._id),
    details: { amount: payout.amount, ref: payout.settlementReference },
  });

  res.json({ success: true, payout });
});

// 7. Returns & Refunds Management
router.get('/returns', requireRole('super_admin', 'admin', 'order_manager', 'finance_manager'), async (_req, res) => {
  const returns = await ReturnRequest.find()
    .populate('storeId', 'name')
    .populate('customerId', 'name email')
    .populate('subOrderId', 'subOrderNumber subtotal status')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, returns });
});

router.patch('/returns/:id', requireRole('super_admin', 'admin', 'finance_manager'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid return request ID' });
    return;
  }
  const ret = await ReturnRequest.findById(req.params.id);
  if (!ret) {
    res.status(404).json({ success: false, error: 'Return request not found' });
    return;
  }

  const allowedStatuses = [
    'requested',
    'seller_approved',
    'seller_disputed',
    'admin_review',
    'return_in_transit',
    'item_received',
    'refund_approved',
    'refund_executed',
    'rejected',
  ];
  const { status, approvedAmount, adminResolutionNote, refundReferenceId } = req.body;
  if (!allowedStatuses.includes(status)) {
    res.status(400).json({ success: false, error: 'Invalid return status' });
    return;
  }
  if (ret.status === 'refund_executed' || ret.status === 'rejected') {
    res.status(409).json({ success: false, error: `Return already finalized as ${ret.status}` });
    return;
  }

  let parsedAmount = ret.approvedAmount;
  if (approvedAmount !== undefined && approvedAmount !== '') {
    const n = Number(approvedAmount);
    if (!Number.isFinite(n) || n < 0 || n > ret.requestedAmount) {
      res.status(400).json({
        success: false,
        error: `Approved amount must be between ৳0 and ৳${ret.requestedAmount}`,
      });
      return;
    }
    parsedAmount = n;
  }

  if (status === 'refund_executed') {
    const sub = await SubOrder.findById(ret.subOrderId);
    if (!sub) {
      res.status(404).json({ success: false, error: 'Associated suborder not found' });
      return;
    }

    if (sub.status !== 'refunded') {
      try {
        await transitionSubOrderStatus({
          subOrderId: String(sub._id),
          nextStatus: 'refunded',
          actorUserId: req.user!._id,
          note: `Refund executed (Ref: ${String(refundReferenceId || 'ADMIN-REF').trim()})`,
        });
      } catch (err) {
        res.status(400).json({
          success: false,
          error: err instanceof Error ? err.message : 'Unable to transition suborder to refunded',
        });
        return;
      }
    }

    await SubOrder.updateOne({ _id: sub._id }, { $set: { settlementStatus: 'reversed' } });

    const debit = parsedAmount ?? ret.requestedAmount;
    await FinancialLedgerEntry.updateOne(
      { entryKey: `refund:${ret._id}` },
      {
        $setOnInsert: {
          entryKey: `refund:${ret._id}`,
          storeId: ret.storeId,
          subOrderId: ret.subOrderId,
          parentOrderId: ret.parentOrderId,
          entryType: 'refund_debit',
          bucket: 'eligible',
          amount: -debit,
          description: `Refund adjustment for ${ret.returnNumber}`,
          createdByUserId: req.user!._id,
        },
      },
      { upsert: true }
    );

    const siblingSubs = await SubOrder.find({ parentOrderId: ret.parentOrderId }).lean();
    const activeSubs = siblingSubs.filter((s) => s.status !== 'cancelled');
    const allRefunded = activeSubs.length > 0 && activeSubs.every((s) => s.status === 'refunded');
    await ParentOrder.updateOne(
      { _id: ret.parentOrderId },
      { $set: { paymentStatus: allRefunded ? 'refunded' : 'partially_refunded' } }
    );
    if (allRefunded) {
      await PaymentTransaction.updateOne(
        { parentOrderId: ret.parentOrderId },
        { $set: { status: 'refunded' } }
      );
    }
  }

  ret.status = status;
  ret.handledByAdminId = req.user!._id;
  if (parsedAmount !== undefined) ret.approvedAmount = parsedAmount;
  if (adminResolutionNote !== undefined) ret.adminResolutionNote = String(adminResolutionNote);
  if (refundReferenceId !== undefined) ret.refundReferenceId = String(refundReferenceId);
  await ret.save();

  await Notification.create({
    recipientUserId: ret.customerId,
    recipientRoleScope: 'customer',
    type: 'return_update',
    title: `Return ${ret.returnNumber}: ${status.replace(/_/g, ' ').toUpperCase()}`,
    message:
      adminResolutionNote ||
      (status === 'refund_executed'
        ? `Your refund of ৳${parsedAmount ?? ret.requestedAmount} has been executed.`
        : `Return status updated to ${status.replace(/_/g, ' ')}.`),
    link: `/orders/${ret.parentOrderId}`,
  });

  await recordAuditLog({
    req,
    action: 'return_status_updated',
    targetType: 'ReturnRequest',
    targetId: String(ret._id),
    details: { status, approvedAmount: parsedAmount },
  });
  res.json({ success: true, returnRequest: ret });
});

// 8. Dedicated Homepage CMS Management
router.get('/cms', requireRole('super_admin', 'admin', 'content_manager'), async (_req, res) => {
  const sections = await CmsSection.find().sort({ displayOrder: 1 }).lean();
  res.json({ success: true, sections });
});

router.put('/cms/:id', requireRole('super_admin', 'admin', 'content_manager'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid CMS section ID' });
    return;
  }
  const title = String(req.body.title || '').trim();
  if (!title) {
    res.status(400).json({ success: false, error: 'Section title is required' });
    return;
  }
  const section = await CmsSection.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        title,
        subtitle: req.body.subtitle !== undefined ? String(req.body.subtitle) : undefined,
        visible: Boolean(req.body.visible),
        displayOrder: Number(req.body.displayOrder || 0),
        config: req.body.config && typeof req.body.config === 'object' ? req.body.config : {},
      },
    },
    { new: true }
  );
  if (!section) {
    res.status(404).json({ success: false, error: 'CMS section not found' });
    return;
  }
  await recordAuditLog({ req, action: 'cms_section_updated', targetType: 'CmsSection', targetId: req.params.id });
  res.json({ success: true, section });
});

// 9. Dedicated Banner & Hero Slider Management
router.get('/banners/slider-settings', requireRole('super_admin', 'admin', 'content_manager'), async (_req, res) => {
  const section = await CmsSection.findOne({ key: 'hero_slider' }).lean();
  res.json({
    success: true,
    sliderSettings: normalizeHeroSliderConfig((section?.config as Record<string, unknown> | undefined) || null),
  });
});

router.put('/banners/slider-settings', requireRole('super_admin', 'admin', 'content_manager'), async (req: AuthRequest, res) => {
  const parsed = heroSliderConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid slider settings' });
    return;
  }
  const section = await CmsSection.findOneAndUpdate(
    { key: 'hero_slider' },
    {
      $set: {
        key: 'hero_slider',
        title: 'Hero Slider Configuration',
        subtitle: 'Controls homepage hero carousel autoplay, transitions, and navigation',
        sectionType: 'hero_slider',
        visible: true,
        displayOrder: 0,
        config: parsed.data,
      },
    },
    { new: true, upsert: true }
  );
  await recordAuditLog({
    req,
    action: 'hero_slider_settings_updated',
    targetType: 'CmsSection',
    targetId: String(section._id),
    details: parsed.data,
  });
  res.json({ success: true, sliderSettings: normalizeHeroSliderConfig(parsed.data) });
});

router.get('/banners', requireRole('super_admin', 'admin', 'content_manager'), async (_req, res) => {
  const [banners, sliderSection] = await Promise.all([
    Banner.find().sort({ position: 1, displayOrder: 1 }).lean(),
    CmsSection.findOne({ key: 'hero_slider' }).lean(),
  ]);
  res.json({
    success: true,
    banners,
    sliderSettings: normalizeHeroSliderConfig((sliderSection?.config as Record<string, unknown> | undefined) || null),
  });
});

router.post('/banners', requireRole('super_admin', 'admin', 'content_manager'), async (req: AuthRequest, res) => {
  const parsed = bannerInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid banner data' });
    return;
  }
  try {
    const createPayload: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(parsed.data)) {
      if (val !== null && val !== undefined) createPayload[key] = val;
    }
    const banner = await Banner.create(createPayload);
    await recordAuditLog({ req, action: 'banner_created', targetType: 'Banner', targetId: String(banner._id) });
    res.status(201).json({ success: true, banner });
  } catch (err) {
    handleMongoError(err, res, 'Unable to create banner');
  }
});

router.put('/banners/:id', requireRole('super_admin', 'admin', 'content_manager'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid banner ID' });
    return;
  }
  const parsed = bannerUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid banner update' });
    return;
  }
  try {
    const setFields: Record<string, unknown> = {};
    const unsetFields: Record<string, 1> = {};
    for (const [key, val] of Object.entries(parsed.data)) {
      if (val === undefined) continue;
      if (val === null) {
        unsetFields[key] = 1;
      } else {
        setFields[key] = val;
      }
    }
    const updateDoc: Record<string, unknown> = {};
    if (Object.keys(setFields).length > 0) updateDoc.$set = setFields;
    if (Object.keys(unsetFields).length > 0) updateDoc.$unset = unsetFields;

    const banner = await Banner.findByIdAndUpdate(req.params.id, updateDoc, { new: true });
    if (!banner) {
      res.status(404).json({ success: false, error: 'Banner not found' });
      return;
    }
    await recordAuditLog({ req, action: 'banner_updated', targetType: 'Banner', targetId: req.params.id });
    res.json({ success: true, banner });
  } catch (err) {
    handleMongoError(err, res, 'Unable to update banner');
  }
});

router.delete('/banners/:id', requireRole('super_admin', 'admin', 'content_manager'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid banner ID' });
    return;
  }
  const deleted = await Banner.deleteOne({ _id: req.params.id });
  if (!deleted.deletedCount) {
    res.status(404).json({ success: false, error: 'Banner not found' });
    return;
  }
  await recordAuditLog({ req, action: 'banner_deleted', targetType: 'Banner', targetId: req.params.id });
  res.json({ success: true });
});

// 10. Dedicated Advertisement & Sponsored Placement Management
router.get('/ads', requireRole('super_admin', 'admin', 'content_manager'), async (_req, res) => {
  const ads = await Advertisement.find().sort({ priority: -1, createdAt: -1 }).lean();
  res.json({ success: true, ads });
});

router.post('/ads', requireRole('super_admin', 'admin', 'content_manager'), async (req: AuthRequest, res) => {
  const parsed = adInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid advertisement data' });
    return;
  }
  const createPayload: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(parsed.data)) {
    if (val === null || val === undefined) continue;
    if ((key === 'targetProductId' || key === 'targetStoreId') && typeof val === 'string') {
      if (!val) continue;
      if (!isValidObjectId(val)) {
        res.status(400).json({ success: false, error: `Invalid ${key}` });
        return;
      }
    }
    createPayload[key] = val;
  }
  const ad = await Advertisement.create(createPayload);
  await recordAuditLog({ req, action: 'advertisement_created', targetType: 'Advertisement', targetId: String(ad._id) });
  res.status(201).json({ success: true, ad });
});

router.put('/ads/:id', requireRole('super_admin', 'admin', 'content_manager'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid advertisement ID' });
    return;
  }
  const parsed = adUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid advertisement update' });
    return;
  }
  const setFields: Record<string, unknown> = {};
  const unsetFields: Record<string, 1> = {};
  for (const [key, val] of Object.entries(parsed.data)) {
    if (val === undefined) continue;
    if (key === 'targetProductId' || key === 'targetStoreId') {
      if (val === null || val === '') {
        unsetFields[key] = 1;
      } else if (typeof val === 'string' && isValidObjectId(val)) {
        setFields[key] = val;
      } else {
        res.status(400).json({ success: false, error: `Invalid ${key}` });
        return;
      }
      continue;
    }
    if (val === null) {
      unsetFields[key] = 1;
    } else {
      setFields[key] = val;
    }
  }
  const updateDoc: Record<string, unknown> = {};
  if (Object.keys(setFields).length > 0) updateDoc.$set = setFields;
  if (Object.keys(unsetFields).length > 0) updateDoc.$unset = unsetFields;

  const ad = await Advertisement.findByIdAndUpdate(req.params.id, updateDoc, { new: true });
  if (!ad) {
    res.status(404).json({ success: false, error: 'Advertisement not found' });
    return;
  }
  await recordAuditLog({ req, action: 'advertisement_updated', targetType: 'Advertisement', targetId: req.params.id });
  res.json({ success: true, ad });
});

router.delete('/ads/:id', requireRole('super_admin', 'admin', 'content_manager'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid advertisement ID' });
    return;
  }
  const deleted = await Advertisement.deleteOne({ _id: req.params.id });
  if (!deleted.deletedCount) {
    res.status(404).json({ success: false, error: 'Advertisement not found' });
    return;
  }
  await recordAuditLog({ req, action: 'advertisement_deleted', targetType: 'Advertisement', targetId: req.params.id });
  res.json({ success: true });
});

// 11. Promotions & Coupons
router.get('/promotions', requireRole('super_admin', 'admin', 'content_manager'), async (_req, res) => {
  const [promotions, coupons] = await Promise.all([
    Promotion.find().populate('productIds', 'title slug').sort({ createdAt: -1 }).lean(),
    Coupon.find().sort({ createdAt: -1 }).lean(),
  ]);
  res.json({ success: true, promotions, coupons });
});

router.post('/promotions', requireRole('super_admin', 'admin', 'content_manager'), async (req: AuthRequest, res) => {
  const parsed = promotionInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid promotion data' });
    return;
  }
  try {
    const slug = slugify(parsed.data.slug || parsed.data.name);
    const promo = await Promotion.create({ ...parsed.data, slug });
    await recordAuditLog({ req, action: 'promotion_created', targetType: 'Promotion', targetId: String(promo._id) });
    res.status(201).json({ success: true, promotion: promo });
  } catch (err) {
    handleMongoError(err, res, 'A promotion with this slug already exists');
  }
});

router.patch('/promotions/:id', requireRole('super_admin', 'admin', 'content_manager'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid promotion ID' });
    return;
  }
  const parsed = promotionUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid promotion update' });
    return;
  }
  const promotion = await Promotion.findByIdAndUpdate(req.params.id, { $set: parsed.data }, { new: true });
  if (!promotion) {
    res.status(404).json({ success: false, error: 'Promotion not found' });
    return;
  }
  await recordAuditLog({ req, action: 'promotion_updated', targetType: 'Promotion', targetId: req.params.id });
  res.json({ success: true, promotion });
});

router.delete('/promotions/:id', requireRole('super_admin', 'admin', 'content_manager'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid promotion ID' });
    return;
  }
  const deleted = await Promotion.deleteOne({ _id: req.params.id });
  if (!deleted.deletedCount) {
    res.status(404).json({ success: false, error: 'Promotion not found' });
    return;
  }
  await recordAuditLog({ req, action: 'promotion_deleted', targetType: 'Promotion', targetId: req.params.id });
  res.json({ success: true });
});

router.post('/coupons', requireRole('super_admin', 'admin', 'content_manager'), async (req: AuthRequest, res) => {
  const parsed = couponInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid coupon data' });
    return;
  }
  try {
    const coupon = await Coupon.create(parsed.data);
    await recordAuditLog({ req, action: 'coupon_created', targetType: 'Coupon', targetId: String(coupon._id) });
    res.status(201).json({ success: true, coupon });
  } catch (err) {
    handleMongoError(err, res, 'A coupon with this code already exists');
  }
});

router.patch('/coupons/:id', requireRole('super_admin', 'admin', 'content_manager'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid coupon ID' });
    return;
  }
  const parsed = couponUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid coupon update' });
    return;
  }
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, { $set: parsed.data }, { new: true });
    if (!coupon) {
      res.status(404).json({ success: false, error: 'Coupon not found' });
      return;
    }
    await recordAuditLog({ req, action: 'coupon_updated', targetType: 'Coupon', targetId: req.params.id });
    res.json({ success: true, coupon });
  } catch (err) {
    handleMongoError(err, res, 'A coupon with this code already exists');
  }
});

router.delete('/coupons/:id', requireRole('super_admin', 'admin', 'content_manager'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid coupon ID' });
    return;
  }
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) {
    res.status(404).json({ success: false, error: 'Coupon not found' });
    return;
  }
  if (coupon.usedCount > 0) {
    res.status(409).json({
      success: false,
      error: 'Cannot delete a coupon that has already been redeemed in orders; disable it instead.',
    });
    return;
  }
  await Coupon.deleteOne({ _id: coupon._id });
  await recordAuditLog({ req, action: 'coupon_deleted', targetType: 'Coupon', targetId: req.params.id });
  res.json({ success: true });
});

// 12. Search Management & Analytics
router.get(
  '/search-management',
  requireRole('super_admin', 'admin', 'catalog_manager', 'content_manager'),
  async (_req, res) => {
    const [mappings, zeroResults, topQueries] = await Promise.all([
      SearchMapping.find().sort({ term: 1 }).lean(),
      SearchAnalyticsLog.aggregate([
        { $match: { resultCount: 0 } },
        { $group: { _id: '$normalizedQuery', count: { $sum: 1 }, lastSearched: { $max: '$searchedAt' } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      SearchAnalyticsLog.aggregate([
        { $group: { _id: '$normalizedQuery', count: { $sum: 1 }, avgResults: { $avg: '$resultCount' } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
    ]);
    res.json({ success: true, mappings, zeroResults, topQueries });
  }
);

router.post(
  '/search-management/mappings',
  requireRole('super_admin', 'admin', 'catalog_manager', 'content_manager'),
  async (req: AuthRequest, res) => {
    const parsed = searchMappingInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid search mapping' });
      return;
    }
    try {
      const mapping = await SearchMapping.create(parsed.data);
      await recordAuditLog({ req, action: 'search_mapping_created', targetType: 'SearchMapping', targetId: String(mapping._id) });
      res.status(201).json({ success: true, mapping });
    } catch (err) {
      handleMongoError(err, res, 'A search synonym mapping for this primary term already exists');
    }
  }
);

// 13. Reviews Moderation
router.get('/reviews', requireRole('super_admin', 'admin', 'catalog_manager', 'support_agent'), async (_req, res) => {
  const [reviews, reports] = await Promise.all([
    Review.find().populate('productId', 'title').sort({ createdAt: -1 }).limit(60).lean(),
    ReviewReport.find().populate('reviewId').sort({ createdAt: -1 }).lean(),
  ]);
  res.json({ success: true, reviews, reports });
});

router.patch('/reviews/:id', requireRole('super_admin', 'admin', 'catalog_manager', 'support_agent'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid review ID' });
    return;
  }
  const moderationStatus = req.body.moderationStatus;
  if (!['published', 'flagged', 'hidden'].includes(moderationStatus)) {
    res.status(400).json({ success: false, error: 'Invalid review moderation status' });
    return;
  }
  const review = await Review.findByIdAndUpdate(
    req.params.id,
    { $set: { moderationStatus } },
    { new: true }
  );
  if (!review) {
    res.status(404).json({ success: false, error: 'Review not found' });
    return;
  }

  // Recompute product rating summary from currently published reviews
  const stats = await Review.aggregate([
    { $match: { productId: review.productId, moderationStatus: 'published' } },
    { $group: { _id: '$productId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await CanonicalProduct.updateOne(
    { _id: review.productId },
    {
      $set: {
        ratingAvg: stats[0] ? Math.round(stats[0].avg * 10) / 10 : 0,
        ratingCount: stats[0]?.count || 0,
      },
    }
  );

  await recordAuditLog({
    req,
    action: 'review_moderated',
    targetType: 'Review',
    targetId: req.params.id,
    details: { moderationStatus },
  });
  res.json({ success: true, review });
});

// 14. Support Management
router.get('/support', requireRole('super_admin', 'admin', 'support_agent'), async (_req, res) => {
  const tickets = await SupportTicket.find()
    .populate('creatorUserId', 'name email role')
    .sort({ updatedAt: -1 })
    .lean();
  res.json({ success: true, tickets });
});

router.post('/support/:id/reply', requireRole('super_admin', 'admin', 'support_agent'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid ticket ID' });
    return;
  }
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) {
    res.status(404).json({ success: false, error: 'Ticket not found' });
    return;
  }
  if (req.body.status && !['open', 'in_progress', 'waiting_user', 'resolved', 'closed'].includes(req.body.status)) {
    res.status(400).json({ success: false, error: 'Invalid support ticket status' });
    return;
  }
  if (req.body.body) {
    ticket.messages.push({
      senderUserId: req.user!._id,
      senderName: req.user!.name,
      senderRole: req.user!.role,
      body: String(req.body.body),
      attachments: [],
      sentAt: new Date(),
    });
  }
  if (req.body.status) ticket.status = req.body.status;
  if (req.body.resolutionNotes) ticket.resolutionNotes = req.body.resolutionNotes;
  ticket.assignedStaffId = req.user!._id;
  await ticket.save();

  await recordAuditLog({
    req,
    action: 'support_ticket_updated',
    targetType: 'SupportTicket',
    targetId: String(ticket._id),
    details: { status: ticket.status },
  });
  res.json({ success: true, ticket });
});

// 15. Audit Logs & Platform Settings
router.get('/audit-logs', requireRole('super_admin', 'admin'), async (_req, res) => {
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(120).lean();
  res.json({ success: true, logs });
});

router.get('/settings', requireRole('super_admin', 'admin'), async (_req, res) => {
  const settings = await PlatformSettings.findOne({ key: 'global' }).lean();
  res.json({ success: true, settings, integrations: getIntegrationStatus() });
});

router.put('/settings', requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
  const parsed = platformSettingsInputSchema.safeParse({
    freeDeliveryThreshold: Number(req.body.freeDeliveryThreshold),
    defaultCommissionPercent: Number(req.body.defaultCommissionPercent),
    minPayoutAmount: Number(req.body.minPayoutAmount),
    returnWindowDays: Number(req.body.returnWindowDays),
    requireProductModeration: req.body.requireProductModeration,
    sellerSubscriptionRequired: req.body.sellerSubscriptionRequired,
    enabledPaymentMethods: req.body.enabledPaymentMethods,
    announcementText: req.body.announcementText,
    supportEmail: req.body.supportEmail,
    supportPhone: req.body.supportPhone,
  });
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid platform settings' });
    return;
  }
  const settings = await PlatformSettings.findOneAndUpdate(
    { key: 'global' },
    { $set: parsed.data },
    { new: true, upsert: true }
  );
  await recordAuditLog({ req, action: 'platform_settings_updated', targetType: 'PlatformSettings' });
  res.json({ success: true, settings });
});

export default router;
