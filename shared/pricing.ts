export type DeliveryZone = 'dhaka_metro' | 'dhaka_suburb' | 'major_city' | 'nationwide';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancellation_requested'
  | 'cancelled'
  | 'delivery_failed'
  | 'return_requested'
  | 'returned'
  | 'refund_pending'
  | 'refunded';

export const ALLOWED_SUBORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'processing', 'cancelled', 'cancellation_requested'],
  confirmed: ['processing', 'packed', 'cancelled', 'cancellation_requested'],
  processing: ['packed', 'shipped', 'cancelled', 'cancellation_requested'],
  packed: ['shipped', 'cancelled', 'cancellation_requested'],
  shipped: ['delivered', 'delivery_failed', 'return_requested'],
  delivered: ['return_requested'],
  cancellation_requested: ['cancelled', 'processing'],
  cancelled: ['refund_pending'],
  delivery_failed: ['shipped', 'cancelled', 'return_requested'],
  return_requested: ['returned', 'refund_pending', 'refunded', 'delivered'],
  returned: ['refund_pending', 'refunded'],
  refund_pending: ['refunded'],
  refunded: [],
};

export const SELLER_ALLOWED_TARGET_STATUSES: OrderStatus[] = [
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'delivered',
  'delivery_failed',
  'cancelled',
  'returned',
];

export function canTransitionSuborderStatus(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return (ALLOWED_SUBORDER_TRANSITIONS[from] || []).includes(to);
}

export function canSellerTransitionSuborderStatus(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  if (!SELLER_ALLOWED_TARGET_STATUSES.includes(to)) return false;
  return canTransitionSuborderStatus(from, to);
}

export function normalizeSearchQuery(input: string): string {
  return input
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const TRANSLITERATION_SYNONYMS: Array<[string, string[]]> = [
  ['earbuds', ['ইয়ারবাড', 'ইয়ারবাড', 'earbud', 'tws', 'ব্লুটুথ হেডফোন']],
  ['smartwatch', ['স্মার্টওয়াচ', 'স্মার্ট ওয়াচ', 'ঘড়ি', 'watch', 'স্মার্ট ঘড়ি']],
  ['blender', ['ব্লেন্ডার', 'মিক্সার', 'grinder', 'জুসার']],
  ['air fryer', ['এয়ার ফ্রায়ার', 'এয়ার ফ্রায়ার', 'fryer']],
  ['headphones', ['হেডফোন', 'headphone', 'anc', 'অডিও']],
  ['sneakers', ['জুতা', 'স্নিকার্স', 'shoes', 'running shoe', 'কেডস']],
  ['smartphone', ['স্মার্টফোন', 'মোবাইল', 'phone', 'ফোন', '5g']],
  ['shirt', ['শার্ট', 'পাঞ্জাবি', 'panjabi', 't-shirt', 'টি-শার্ট']],
  ['saree', ['শাড়ি', 'শাড়ি', 'jamdani', 'জামদানি']],
  ['grocery', ['মুদি', 'চাল', 'ডাল', 'তেল', 'tea', 'চা']],
  ['laptop', ['ল্যাপটপ', 'notebook', 'কম্পিউটার']],
];

export function expandSearchTerms(query: string, customMappings: Array<{ term: string; synonyms: string[] }> = []): string[] {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];

  const tokens = new Set<string>([normalized]);
  for (const word of normalized.split(' ')) {
    if (word.length >= 2) tokens.add(word);
  }

  const allMappings = [
    ...TRANSLITERATION_SYNONYMS.map(([term, synonyms]) => ({ term, synonyms })),
    ...customMappings,
  ];

  for (const mapping of allMappings) {
    const normTerm = normalizeSearchQuery(mapping.term);
    const normSyns = mapping.synonyms.map((s) => normalizeSearchQuery(s));
    const matchesTerm = normalized.includes(normTerm) || normTerm.includes(normalized);
    const matchesSyn = normSyns.some((s) => normalized.includes(s) || s.includes(normalized));

    if (matchesTerm || matchesSyn) {
      tokens.add(normTerm);
      for (const s of normSyns) tokens.add(s);
    }
  }

  return Array.from(tokens).filter(Boolean);
}

export interface QuoteLineInput {
  offerId: string;
  storeId: string;
  storeName: string;
  productId: string;
  productTitle: string;
  variantSku: string;
  categoryId: string;
  unitPrice: number;
  compareAtPrice?: number;
  quantity: number;
  sellerShippingBaseDhaka: number;
  sellerShippingNationwide: number;
  freeShippingThreshold?: number;
  commissionRatePercent: number;
}

export interface CouponInput {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount: number;
}

export interface SellerQuoteBreakdown {
  storeId: string;
  storeName: string;
  subtotal: number;
  shippingFee: number;
  couponDiscountShare: number;
  commissionAmount: number;
  sellerNetPayable: number;
  items: Array<QuoteLineInput & { lineTotal: number; itemCommission: number }>;
}

export interface OrderQuoteResult {
  itemsSubtotal: number;
  shippingTotal: number;
  couponDiscountTotal: number;
  platformCommissionTotal: number;
  grandTotal: number;
  sellerGroups: SellerQuoteBreakdown[];
}

export function computeShippingFeeForZone(
  zone: DeliveryZone,
  dhakaBase: number,
  nationwideBase: number,
  deliverySpeed: 'standard' | 'express'
): number {
  let base = nationwideBase;
  if (zone === 'dhaka_metro') base = dhakaBase;
  else if (zone === 'dhaka_suburb') base = Math.round((dhakaBase + nationwideBase) / 2);
  else if (zone === 'major_city') base = Math.max(dhakaBase + 30, nationwideBase - 10);

  if (deliverySpeed === 'express') {
    return base + 60;
  }
  return base;
}

export function calculateAuthoritativeOrderQuote(params: {
  lines: QuoteLineInput[];
  zone: DeliveryZone;
  deliverySpeed: 'standard' | 'express';
  freeDeliveryGlobalThreshold?: number;
  coupon?: CouponInput | null;
}): OrderQuoteResult {
  const { lines, zone, deliverySpeed, freeDeliveryGlobalThreshold = 999, coupon } = params;

  const grouped = new Map<string, QuoteLineInput[]>();
  for (const line of lines) {
    if (line.quantity <= 0 || !Number.isInteger(line.quantity)) {
      throw new Error(`Invalid quantity for SKU ${line.variantSku}`);
    }
    if (line.unitPrice < 0) {
      throw new Error(`Invalid unit price for SKU ${line.variantSku}`);
    }
    const existing = grouped.get(line.storeId) || [];
    existing.push(line);
    grouped.set(line.storeId, existing);
  }

  let itemsSubtotal = 0;
  let shippingTotal = 0;

  const rawGroups = Array.from(grouped.entries()).map(([storeId, storeLines]) => {
    const storeSubtotal = storeLines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    itemsSubtotal += storeSubtotal;

    const first = storeLines[0];
    const storeThreshold = first.freeShippingThreshold ?? freeDeliveryGlobalThreshold;
    const isFreeStandard = deliverySpeed === 'standard' && storeSubtotal >= storeThreshold;

    const shippingFee = isFreeStandard
      ? 0
      : computeShippingFeeForZone(
          zone,
          first.sellerShippingBaseDhaka,
          first.sellerShippingNationwide,
          deliverySpeed
        );

    shippingTotal += shippingFee;

    return {
      storeId,
      storeName: first.storeName,
      subtotal: storeSubtotal,
      shippingFee,
      storeLines,
    };
  });

  // Coupon discount calculation (server-side)
  let couponDiscountTotal = 0;
  if (coupon && itemsSubtotal >= coupon.minOrderAmount) {
    if (coupon.discountType === 'percentage') {
      const raw = Math.round((itemsSubtotal * coupon.discountValue) / 100);
      couponDiscountTotal = coupon.maxDiscountAmount ? Math.min(raw, coupon.maxDiscountAmount) : raw;
    } else {
      couponDiscountTotal = Math.min(coupon.discountValue, itemsSubtotal);
    }
  }

  // Allocate coupon proportionally across seller groups (last group absorbs rounding diff)
  let remainingDiscount = couponDiscountTotal;
  let platformCommissionTotal = 0;

  const sellerGroups: SellerQuoteBreakdown[] = rawGroups.map((g, idx) => {
    let share = 0;
    if (couponDiscountTotal > 0 && itemsSubtotal > 0) {
      if (idx === rawGroups.length - 1) {
        share = remainingDiscount;
      } else {
        share = Math.floor((g.subtotal / itemsSubtotal) * couponDiscountTotal);
        remainingDiscount -= share;
      }
    }

    let groupCommission = 0;
    const items = g.storeLines.map((l) => {
      const lineTotal = l.unitPrice * l.quantity;
      const itemCommission = Math.round((lineTotal * l.commissionRatePercent) / 100);
      groupCommission += itemCommission;
      return { ...l, lineTotal, itemCommission };
    });

    platformCommissionTotal += groupCommission;
    // Seller net payable = item subtotal - platform commission + shipping collected by seller
    // Platform coupon discount is absorbed by platform promotional budget unless seller-funded
    const sellerNetPayable = Math.max(0, g.subtotal - groupCommission + g.shippingFee);

    return {
      storeId: g.storeId,
      storeName: g.storeName,
      subtotal: g.subtotal,
      shippingFee: g.shippingFee,
      couponDiscountShare: share,
      commissionAmount: groupCommission,
      sellerNetPayable,
      items,
    };
  });

  const grandTotal = Math.max(0, itemsSubtotal + shippingTotal - couponDiscountTotal);

  return {
    itemsSubtotal,
    shippingTotal,
    couponDiscountTotal,
    platformCommissionTotal,
    grandTotal,
    sellerGroups,
  };
}
