import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import {
  calculateAuthoritativeOrderQuote,
  canTransitionSuborderStatus,
  OrderStatus,
  QuoteLineInput,
} from '../../shared/pricing';
import { validateBangladeshAddressHierarchy } from '../../shared/bangladeshGeo';
import { CanonicalProduct, SellerOffer } from '../models/Catalog';
import { CommissionRule, Store } from '../models/Seller';
import { Cart, ParentOrder, PaymentTransaction, SubOrder } from '../models/Order';
import { FinancialLedgerEntry } from '../models/Finance';
import { Coupon, PlatformSettings } from '../models/Cms';
import { Notification } from '../models/Engagement';
import { User } from '../models/User';

export async function resolveCommissionPercentForOffer(
  storeId: Types.ObjectId,
  categoryId: Types.ObjectId,
  storeOverride?: number
): Promise<number> {
  if (typeof storeOverride === 'number' && storeOverride >= 0) {
    return storeOverride;
  }
  const storeRule = await CommissionRule.findOne({ storeId, active: true }).lean();
  if (storeRule) return storeRule.ratePercent;

  const catRule = await CommissionRule.findOne({ categoryId, active: true }).lean();
  if (catRule) return catRule.ratePercent;

  const defaultRule = await CommissionRule.findOne({ isDefault: true, active: true }).lean();
  if (defaultRule) return defaultRule.ratePercent;

  const settings = await PlatformSettings.findOne({ key: 'global' }).lean();
  return settings?.defaultCommissionPercent ?? 8;
}

export async function buildCartQuoteFromServer(params: {
  items: Array<{ offerId: string; quantity: number }>;
  division?: string;
  district?: string;
  upazila?: string;
  deliverySpeed?: 'standard' | 'express';
  couponCode?: string;
}) {
  const settings = await PlatformSettings.findOne({ key: 'global' }).lean();
  const freeThreshold = settings?.freeDeliveryThreshold ?? 999;

  let zone: 'dhaka_metro' | 'dhaka_suburb' | 'major_city' | 'nationwide' = 'dhaka_metro';
  if (params.division && params.district && params.upazila) {
    const check = validateBangladeshAddressHierarchy(params.division, params.district, params.upazila);
    if (check.valid && check.zone) zone = check.zone;
  }

  const now = new Date();
  const quoteLines: QuoteLineInput[] = [];
  const hydratedItems: Array<{
    offerId: string;
    productId: string;
    productTitle: string;
    productSlug: string;
    productImage: string;
    variantSku: string;
    variantLabel: string;
    storeId: string;
    storeName: string;
    storeSlug: string;
    unitPrice: number;
    compareAtPrice?: number;
    quantity: number;
    stock: number;
    maxPurchaseQty: number;
    commissionRatePercent: number;
    deliveryEstimateDays: string;
  }> = [];

  for (const reqItem of params.items) {
    if (!mongoose.Types.ObjectId.isValid(reqItem.offerId)) continue;
    const offer = await SellerOffer.findById(reqItem.offerId)
      .populate('productId')
      .populate('storeId')
      .lean();
    if (!offer || !offer.isActive) continue;
    const product = offer.productId as any;
    const store = offer.storeId as any;
    if (!product || product.moderationStatus !== 'published') continue;
    if (!store || store.status !== 'active') continue;

    const variant = product.variants?.find((v: any) => v.sku === offer.variantSku);
    const flashActive =
      offer.flashSalePrice &&
      offer.flashSaleStart &&
      offer.flashSaleEnd &&
      new Date(offer.flashSaleStart) <= now &&
      new Date(offer.flashSaleEnd) >= now;
    const unitPrice = flashActive ? offer.flashSalePrice! : offer.price;
    const commissionRatePercent = await resolveCommissionPercentForOffer(
      store._id,
      product.categoryId,
      store.commissionOverridePercent
    );

    const safeQty = Math.max(1, Math.min(reqItem.quantity, offer.stock, offer.maxPurchaseQty || 10));

    quoteLines.push({
      offerId: String(offer._id),
      storeId: String(store._id),
      storeName: store.name,
      productId: String(product._id),
      productTitle: product.title,
      variantSku: offer.variantSku,
      categoryId: String(product.categoryId),
      unitPrice,
      compareAtPrice: offer.compareAtPrice,
      quantity: safeQty,
      sellerShippingBaseDhaka: offer.shippingFeeDhaka,
      sellerShippingNationwide: offer.shippingFeeNationwide,
      freeShippingThreshold: offer.freeShippingThreshold,
      commissionRatePercent,
    });

    hydratedItems.push({
      offerId: String(offer._id),
      productId: String(product._id),
      productTitle: product.title,
      productSlug: product.slug,
      productImage: variant?.imageUrl || product.images?.[0] || '',
      variantSku: offer.variantSku,
      variantLabel: variant?.label || offer.variantSku,
      storeId: String(store._id),
      storeName: store.name,
      storeSlug: store.slug,
      unitPrice,
      compareAtPrice: offer.compareAtPrice,
      quantity: reqItem.quantity,
      stock: offer.stock,
      maxPurchaseQty: offer.maxPurchaseQty || 5,
      commissionRatePercent,
      deliveryEstimateDays: offer.deliveryEstimateDays,
    });
  }

  let appliedCoupon: {
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    maxDiscountAmount?: number;
    minOrderAmount: number;
  } | null = null;
  let couponError: string | undefined;

  if (params.couponCode?.trim()) {
    const c = await Coupon.findOne({
      code: params.couponCode.trim().toUpperCase(),
      active: true,
      startAt: { $lte: now },
      endAt: { $gte: now },
    }).lean();
    if (!c) {
      couponError = 'Coupon code is invalid or expired';
    } else if (c.usedCount >= c.usageLimit) {
      couponError = 'Coupon usage limit reached';
    } else {
      appliedCoupon = {
        code: c.code,
        discountType: c.discountType,
        discountValue: c.discountValue,
        maxDiscountAmount: c.maxDiscountAmount,
        minOrderAmount: c.minOrderAmount,
      };
    }
  }

  const quote =
    quoteLines.length > 0
      ? calculateAuthoritativeOrderQuote({
          lines: quoteLines,
          zone,
          deliverySpeed: params.deliverySpeed || 'standard',
          freeDeliveryGlobalThreshold: freeThreshold,
          coupon: appliedCoupon,
        })
      : {
          itemsSubtotal: 0,
          shippingTotal: 0,
          couponDiscountTotal: 0,
          platformCommissionTotal: 0,
          grandTotal: 0,
          sellerGroups: [],
        };

  if (appliedCoupon && quote.itemsSubtotal < appliedCoupon.minOrderAmount) {
    couponError = `Minimum order of ৳${appliedCoupon.minOrderAmount} required for coupon ${appliedCoupon.code}`;
  }

  return {
    items: hydratedItems,
    quote,
    appliedCoupon: appliedCoupon && !couponError ? appliedCoupon.code : undefined,
    couponError,
  };
}

export async function placeAuthoritativeOrder(params: {
  customerId: Types.ObjectId;
  address: {
    fullName: string;
    phone: string;
    alternatePhone?: string;
    division: string;
    district: string;
    upazila: string;
    unionOrArea: string;
    streetAddress: string;
    postalCode: string;
    deliveryInstructions?: string;
  };
  deliverySpeed: 'standard' | 'express';
  paymentMethod: 'cod' | 'bkash' | 'nagad' | 'card';
  couponCode?: string;
  idempotencyKey: string;
  notes?: string;
}) {
  // 1. Idempotency check
  const existingOrder = await ParentOrder.findOne({ idempotencyKey: params.idempotencyKey }).lean();
  if (existingOrder) {
    const subOrders = await SubOrder.find({ parentOrderId: existingOrder._id }).lean();
    const tx = await PaymentTransaction.findOne({ parentOrderId: existingOrder._id }).lean();
    return { parentOrder: existingOrder, subOrders, paymentTransaction: tx, deduplicated: true };
  }

  // 2. Validate geographic hierarchy
  const geo = validateBangladeshAddressHierarchy(
    params.address.division,
    params.address.district,
    params.address.upazila
  );
  if (!geo.valid || !geo.zone) {
    throw new Error(geo.reason || 'Invalid Bangladesh delivery address');
  }

  // 3. Load customer cart from server DB (never trust client prices or items)
  const cart = await Cart.findOne({ userId: params.customerId });
  if (!cart || cart.items.length === 0) {
    throw new Error('Your cart is empty');
  }

  const now = new Date();
  const quoteLines: QuoteLineInput[] = [];
  const itemMetaMap = new Map<
    string,
    {
      productSlug: string;
      productImage: string;
      variantLabel: string;
      sellerUserId: Types.ObjectId;
      deliveryEstimateDays: string;
    }
  >();

  for (const cartItem of cart.items) {
    const offer = await SellerOffer.findById(cartItem.offerId)
      .populate('productId')
      .populate('storeId')
      .lean();

    if (!offer || !offer.isActive) {
      throw new Error('One or more items in your cart are no longer available');
    }
    const product = offer.productId as any;
    const store = offer.storeId as any;

    if (!product || product.moderationStatus !== 'published') {
      throw new Error(`Product "${product?.title || 'Unknown'}" is currently unavailable`);
    }
    if (!store || store.status !== 'active') {
      throw new Error(`Seller "${store?.name || 'Store'}" is currently suspended`);
    }
    if (cartItem.quantity > offer.stock) {
      throw new Error(
        `Insufficient stock for "${product.title}" (${offer.variantSku}) from ${store.name}. Available: ${offer.stock}`
      );
    }
    if (cartItem.quantity > (offer.maxPurchaseQty || 5)) {
      throw new Error(
        `Maximum purchase limit per order for "${product.title}" is ${offer.maxPurchaseQty || 5}`
      );
    }

    const flashActive =
      offer.flashSalePrice &&
      offer.flashSaleStart &&
      offer.flashSaleEnd &&
      new Date(offer.flashSaleStart) <= now &&
      new Date(offer.flashSaleEnd) >= now;
    const unitPrice = flashActive ? offer.flashSalePrice! : offer.price;

    const commissionRatePercent = await resolveCommissionPercentForOffer(
      store._id,
      product.categoryId,
      store.commissionOverridePercent
    );

    const variant = product.variants?.find((v: any) => v.sku === offer.variantSku);

    quoteLines.push({
      offerId: String(offer._id),
      storeId: String(store._id),
      storeName: store.name,
      productId: String(product._id),
      productTitle: product.title,
      variantSku: offer.variantSku,
      categoryId: String(product.categoryId),
      unitPrice,
      compareAtPrice: offer.compareAtPrice,
      quantity: cartItem.quantity,
      sellerShippingBaseDhaka: offer.shippingFeeDhaka,
      sellerShippingNationwide: offer.shippingFeeNationwide,
      freeShippingThreshold: offer.freeShippingThreshold,
      commissionRatePercent,
    });

    itemMetaMap.set(String(offer._id), {
      productSlug: product.slug,
      productImage: variant?.imageUrl || product.images?.[0] || '',
      variantLabel: variant?.label || offer.variantSku,
      sellerUserId: store.ownerUserId,
      deliveryEstimateDays: offer.deliveryEstimateDays,
    });
  }

  // 4. Validate coupon on server
  let couponDoc: any = null;
  if (params.couponCode?.trim()) {
    couponDoc = await Coupon.findOne({
      code: params.couponCode.trim().toUpperCase(),
      active: true,
      startAt: { $lte: now },
      endAt: { $gte: now },
    });
    if (!couponDoc || couponDoc.usedCount >= couponDoc.usageLimit) {
      throw new Error('Coupon code is invalid, expired, or exhausted');
    }
  }

  const settings = await PlatformSettings.findOne({ key: 'global' }).lean();
  const quote = calculateAuthoritativeOrderQuote({
    lines: quoteLines,
    zone: geo.zone,
    deliverySpeed: params.deliverySpeed,
    freeDeliveryGlobalThreshold: settings?.freeDeliveryThreshold ?? 999,
    coupon: couponDoc
      ? {
          code: couponDoc.code,
          discountType: couponDoc.discountType,
          discountValue: couponDoc.discountValue,
          maxDiscountAmount: couponDoc.maxDiscountAmount,
          minOrderAmount: couponDoc.minOrderAmount,
        }
      : null,
  });

  if (couponDoc && quote.itemsSubtotal < couponDoc.minOrderAmount) {
    throw new Error(`Minimum subtotal of ৳${couponDoc.minOrderAmount} required for coupon ${couponDoc.code}`);
  }

  // 5. Atomic conditional inventory reservation/decrement (concurrency-safe!)
  const decremented: Array<{ offerId: string; quantity: number; productId: string }> = [];
  try {
    for (const line of quoteLines) {
      const updated = await SellerOffer.findOneAndUpdate(
        {
          _id: line.offerId,
          isActive: true,
          stock: { $gte: line.quantity },
        },
        {
          $inc: { stock: -line.quantity },
        },
        { new: true }
      );
      if (!updated) {
        throw new Error(`Out of stock for "${line.productTitle}" (${line.variantSku}) during checkout`);
      }
      decremented.push({ offerId: line.offerId, quantity: line.quantity, productId: line.productId });
    }
  } catch (err) {
    // Rollback any already-decremented offers immediately
    for (const d of decremented) {
      await SellerOffer.updateOne({ _id: d.offerId }, { $inc: { stock: d.quantity } });
    }
    throw err;
  }

  // 6. Create ParentOrder, Seller-specific SubOrders, PaymentTransaction, and Ledger entries
  const orderNumber = `NVR-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  const parentOrder = await ParentOrder.create({
    orderNumber,
    customerId: params.customerId,
    idempotencyKey: params.idempotencyKey,
    shippingAddress: params.address,
    deliverySpeed: params.deliverySpeed,
    paymentMethod: params.paymentMethod,
    paymentStatus: params.paymentMethod === 'cod' ? 'unpaid' : 'pending_verification',
    couponCode: couponDoc ? couponDoc.code : undefined,
    itemsSubtotal: quote.itemsSubtotal,
    shippingTotal: quote.shippingTotal,
    couponDiscountTotal: quote.couponDiscountTotal,
    platformCommissionTotal: quote.platformCommissionTotal,
    grandTotal: quote.grandTotal,
    notes: params.notes,
  });

  const subOrders: any[] = [];
  let idx = 1;
  for (const group of quote.sellerGroups) {
    const firstMeta = itemMetaMap.get(group.items[0].offerId)!;
    const subOrderNumber = `${orderNumber}-S${idx++}`;
    const initialStatus: OrderStatus = params.paymentMethod === 'cod' ? 'confirmed' : 'pending';

    const sub = await SubOrder.create({
      subOrderNumber,
      parentOrderId: parentOrder._id,
      customerId: params.customerId,
      storeId: group.storeId,
      storeName: group.storeName,
      sellerUserId: firstMeta.sellerUserId,
      items: group.items.map((i) => {
        const meta = itemMetaMap.get(i.offerId)!;
        return {
          offerId: i.offerId,
          productId: i.productId,
          productTitle: i.productTitle,
          productSlug: meta.productSlug,
          productImage: meta.productImage,
          variantSku: i.variantSku,
          variantLabel: meta.variantLabel,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          lineTotal: i.lineTotal,
          commissionRatePercent: i.commissionRatePercent,
          commissionAmount: i.itemCommission,
        };
      }),
      subtotal: group.subtotal,
      shippingFee: group.shippingFee,
      couponDiscountShare: group.couponDiscountShare,
      commissionAmount: group.commissionAmount,
      sellerNetPayable: group.sellerNetPayable,
      status: initialStatus,
      settlementStatus: 'pending',
      shipment: {
        estimatedDelivery: firstMeta.deliveryEstimateDays,
      },
      timeline: [
        {
          status: initialStatus,
          note:
            params.paymentMethod === 'cod'
              ? 'Order placed with Cash on Delivery'
              : `Awaiting ${params.paymentMethod.toUpperCase()} payment verification`,
          actorUserId: params.customerId,
          timestamp: new Date(),
        },
      ],
    });

    subOrders.push(sub);

    // Record traceable immutable pending ledger entries
    await FinancialLedgerEntry.create([
      {
        entryKey: `gross:${sub._id}`,
        storeId: group.storeId,
        subOrderId: sub._id,
        parentOrderId: parentOrder._id,
        entryType: 'order_gross_sale',
        bucket: 'pending',
        amount: group.subtotal + group.shippingFee,
        description: `Gross sale for suborder ${subOrderNumber}`,
        createdByUserId: params.customerId,
      },
      {
        entryKey: `comm:${sub._id}`,
        storeId: group.storeId,
        subOrderId: sub._id,
        parentOrderId: parentOrder._id,
        entryType: 'platform_commission',
        bucket: 'platform_revenue',
        amount: group.commissionAmount,
        description: `Platform commission for suborder ${subOrderNumber}`,
        createdByUserId: params.customerId,
      },
      {
        entryKey: `net:${sub._id}`,
        storeId: group.storeId,
        subOrderId: sub._id,
        parentOrderId: parentOrder._id,
        entryType: 'seller_net_credit',
        bucket: 'pending',
        amount: group.sellerNetPayable,
        description: `Pending seller net payable for suborder ${subOrderNumber}`,
        createdByUserId: params.customerId,
      },
    ]);

    // Notify seller of new suborder
    await Notification.create({
      recipientUserId: firstMeta.sellerUserId,
      recipientRoleScope: 'seller',
      type: 'new_order',
      title: `New Order ${subOrderNumber}`,
      message: `You received a new order worth ৳${group.subtotal} from ${params.address.district}.`,
      link: `/seller/orders`,
    });
  }

  // Increment totalSold & coupon usage
  for (const d of decremented) {
    await CanonicalProduct.updateOne({ _id: d.productId }, { $inc: { totalSold: d.quantity } });
  }
  if (couponDoc) {
    await Coupon.updateOne({ _id: couponDoc._id }, { $inc: { usedCount: 1 } });
  }

  const gatewayTx = await PaymentTransaction.create({
    parentOrderId: parentOrder._id,
    customerId: params.customerId,
    gateway: params.paymentMethod,
    gatewayTransactionId: `${params.paymentMethod.toUpperCase()}-${orderNumber}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    idempotencyKey: `pay:${params.idempotencyKey}`,
    amount: quote.grandTotal,
    currency: 'BDT',
    status: params.paymentMethod === 'cod' ? 'pending' : 'initiated',
  });

  // Notify customer
  await Notification.create({
    recipientUserId: params.customerId,
    recipientRoleScope: 'customer',
    type: 'order_placed',
    title: `Order ${orderNumber} Placed`,
    message: `Your order of ৳${quote.grandTotal} has been received across ${subOrders.length} seller(s).`,
    link: `/orders/${parentOrder._id}`,
  });

  // Clear customer cart
  await Cart.updateOne({ userId: params.customerId }, { $set: { items: [] } });

  return { parentOrder, subOrders, paymentTransaction: gatewayTx, deduplicated: false };
}

export async function transitionSubOrderStatus(params: {
  subOrderId: string;
  nextStatus: OrderStatus;
  actorUserId: Types.ObjectId;
  note?: string;
  courierName?: string;
  trackingNumber?: string;
}) {
  const sub = await SubOrder.findById(params.subOrderId);
  if (!sub) throw new Error('Suborder not found');

  if (!canTransitionSuborderStatus(sub.status, params.nextStatus)) {
    throw new Error(`Invalid status transition from "${sub.status}" to "${params.nextStatus}"`);
  }

  sub.status = params.nextStatus;
  if (params.courierName || params.trackingNumber) {
    sub.shipment = {
      ...sub.shipment,
      courierName: params.courierName || sub.shipment?.courierName,
      trackingNumber: params.trackingNumber || sub.shipment?.trackingNumber,
      shippedAt: params.nextStatus === 'shipped' ? new Date() : sub.shipment?.shippedAt,
      deliveredAt: params.nextStatus === 'delivered' ? new Date() : sub.shipment?.deliveredAt,
    };
  } else if (params.nextStatus === 'delivered') {
    sub.shipment = { ...sub.shipment, deliveredAt: new Date() };
  }

  sub.timeline.push({
    status: params.nextStatus,
    note: params.note || `Status updated to ${params.nextStatus}`,
    actorUserId: params.actorUserId,
    timestamp: new Date(),
  });

  // Restore inventory once on cancellation
  if (params.nextStatus === 'cancelled' && !sub.inventoryRestored) {
    for (const item of sub.items) {
      await SellerOffer.updateOne({ _id: item.offerId }, { $inc: { stock: item.quantity } });
    }
    sub.inventoryRestored = true;
    sub.settlementStatus = 'reversed';

    await FinancialLedgerEntry.updateOne(
      { entryKey: `cancel_rev:${sub._id}` },
      {
        $setOnInsert: {
          entryKey: `cancel_rev:${sub._id}`,
          storeId: sub.storeId,
          subOrderId: sub._id,
          parentOrderId: sub.parentOrderId,
          entryType: 'cancellation_reversal',
          bucket: 'reversed',
          amount: -sub.sellerNetPayable,
          description: `Cancelled suborder ${sub.subOrderNumber} earnings reversed`,
          createdByUserId: params.actorUserId,
        },
      },
      { upsert: true }
    );
  }

  // When delivered, move seller net payable from pending -> eligible (idempotent via unique entryKey)
  if (params.nextStatus === 'delivered' && sub.settlementStatus === 'pending') {
    sub.settlementStatus = 'eligible';
    await FinancialLedgerEntry.updateOne(
      { entryKey: `eligible:${sub._id}` },
      {
        $setOnInsert: {
          entryKey: `eligible:${sub._id}`,
          storeId: sub.storeId,
          subOrderId: sub._id,
          parentOrderId: sub.parentOrderId,
          entryType: 'seller_net_credit',
          bucket: 'eligible',
          amount: sub.sellerNetPayable,
          description: `Suborder ${sub.subOrderNumber} delivered — eligible for payout`,
          createdByUserId: params.actorUserId,
        },
      },
      { upsert: true }
    );

    // If COD, mark ParentOrder paid on delivery if all suborders delivered
    const parent = await ParentOrder.findById(sub.parentOrderId);
    if (parent && parent.paymentMethod === 'cod') {
      const siblingSubs = await SubOrder.find({ parentOrderId: parent._id });
      if (siblingSubs.every((s) => s.status === 'delivered' || s.status === 'cancelled')) {
        parent.paymentStatus = 'paid';
        await parent.save();
        await PaymentTransaction.updateOne(
          { parentOrderId: parent._id },
          { $set: { status: 'verified', verifiedAt: new Date() } }
        );
      }
    }
  }

  await sub.save();

  await Notification.create({
    recipientUserId: sub.customerId,
    recipientRoleScope: 'customer',
    type: 'order_update',
    title: `Order ${sub.subOrderNumber} is ${params.nextStatus.replace(/_/g, ' ')}`,
    message: params.note || `Your shipment from ${sub.storeName} is now ${params.nextStatus}.`,
    link: `/orders/${sub.parentOrderId}`,
  });

  return sub;
}

export async function getSellerFinancialSummary(storeId: Types.ObjectId) {
  const entries = await FinancialLedgerEntry.find({ storeId }).sort({ createdAt: -1 }).lean();

  let grossSales = 0;
  let totalCommission = 0;
  let pendingEarnings = 0;
  let eligibleCredits = 0;
  let heldBalance = 0;
  let paidOut = 0;
  let refundAdjustments = 0;

  for (const e of entries) {
    if (e.entryType === 'order_gross_sale') grossSales += e.amount;
    if (e.entryType === 'platform_commission') totalCommission += e.amount;
    if (e.entryType === 'refund_debit' || e.entryType === 'cancellation_reversal') {
      refundAdjustments += Math.abs(e.amount);
    }
    if (e.bucket === 'pending' && e.entryType === 'seller_net_credit') pendingEarnings += e.amount;
    if (e.bucket === 'eligible') eligibleCredits += e.amount;
    if (e.bucket === 'held') heldBalance += e.amount;
    if (e.bucket === 'paid_out') paidOut += Math.abs(e.amount);
  }

  // Subtract reversed cancellations from pending if suborder was cancelled before delivery
  const cancelledSubIds = new Set(
    entries.filter((e) => e.entryType === 'cancellation_reversal').map((e) => String(e.subOrderId))
  );
  const cancelledPendingSum = entries
    .filter(
      (e) =>
        e.bucket === 'pending' &&
        e.entryType === 'seller_net_credit' &&
        cancelledSubIds.has(String(e.subOrderId))
    )
    .reduce((s, e) => s + e.amount, 0);

  // Subtract already delivered from pending
  const deliveredSubIds = new Set(
    entries
      .filter((e) => e.bucket === 'eligible' && e.entryType === 'seller_net_credit')
      .map((e) => String(e.subOrderId))
  );
  const deliveredPendingSum = entries
    .filter(
      (e) =>
        e.bucket === 'pending' &&
        e.entryType === 'seller_net_credit' &&
        deliveredSubIds.has(String(e.subOrderId))
    )
    .reduce((s, e) => s + e.amount, 0);

  const activePending = Math.max(0, pendingEarnings - cancelledPendingSum - deliveredPendingSum);
  // Available eligible payout = eligible credits minus holds minus completed payouts
  const availableEligiblePayout = Math.max(0, eligibleCredits - heldBalance - paidOut);

  return {
    grossSales,
    refundAdjustedSales: Math.max(0, grossSales - refundAdjustments),
    totalCommission,
    refundAdjustments,
    pendingEarnings: activePending,
    heldBalance: Math.max(0, heldBalance),
    eligiblePayout: availableEligiblePayout,
    completedPayout: paidOut,
    recentEntries: entries.slice(0, 50),
  };
}
