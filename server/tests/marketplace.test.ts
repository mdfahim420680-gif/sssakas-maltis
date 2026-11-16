import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_SUBORDER_TRANSITIONS,
  calculateAuthoritativeOrderQuote,
  canSellerTransitionSuborderStatus,
  canTransitionSuborderStatus,
  expandSearchTerms,
  normalizeSearchQuery,
} from '../../shared/pricing';
import { isValidBangladeshPhone, validateBangladeshAddressHierarchy } from '../../shared/bangladeshGeo';
import {
  bannerInputSchema,
  brandInputSchema,
  categoryInputSchema,
  commissionRuleInputSchema,
  couponInputSchema,
  payoutRequestSchema,
  platformSettingsInputSchema,
  sellerApplicationSchema,
  validatePayoutAccountNumber,
} from '../../shared/validation';

test('Bangladesh geographic hierarchy validates Division -> District -> Upazila accurately', () => {
  const valid = validateBangladeshAddressHierarchy('Dhaka', 'Dhaka', 'Dhanmondi');
  assert.equal(valid.valid, true);
  assert.equal(valid.zone, 'dhaka_metro');

  const mismatch = validateBangladeshAddressHierarchy('Dhaka', 'Chattogram', 'Halishahar');
  assert.equal(mismatch.valid, false);

  const upazilaMismatch = validateBangladeshAddressHierarchy('Sylhet', 'Sylhet', 'Dhanmondi');
  assert.equal(upazilaMismatch.valid, false);
});

test('Bangladesh mobile number validator accepts valid local/international formats and rejects invalid ones', () => {
  assert.equal(isValidBangladeshPhone('01711223344'), true);
  assert.equal(isValidBangladeshPhone('+8801812345678'), true);
  assert.equal(isValidBangladeshPhone('01211223344'), false);
  assert.equal(isValidBangladeshPhone('12345'), false);
});

test('Bengali-English search normalization and synonym expansion works across scripts', () => {
  const norm = normalizeSearchQuery('  স্মার্টওয়াচ  SERIES 9  ');
  assert.equal(norm, 'স্মার্টওয়াচ series 9');

  const termsFromBn = expandSearchTerms('ইয়ারবাড');
  assert.ok(termsFromBn.includes('earbuds'));
  assert.ok(termsFromBn.includes('ইয়ারবাড'));

  const termsFromEn = expandSearchTerms('smartwatch');
  assert.ok(termsFromEn.includes('স্মার্টওয়াচ'));
});

test('Authoritative multi-seller order quote calculates subtotals, shipping, coupons, and commissions accurately', () => {
  const quote = calculateAuthoritativeOrderQuote({
    lines: [
      {
        offerId: 'offer-a1',
        storeId: 'store-a',
        storeName: 'TechWorld BD',
        productId: 'prod-1',
        productTitle: 'Earbuds Pro',
        variantSku: 'SKU-1',
        categoryId: 'cat-elec',
        unitPrice: 1999,
        quantity: 1,
        sellerShippingBaseDhaka: 60,
        sellerShippingNationwide: 120,
        freeShippingThreshold: 2500,
        commissionRatePercent: 6,
      },
      {
        offerId: 'offer-b1',
        storeId: 'store-b',
        storeName: 'Fashion Hub',
        productId: 'prod-2',
        productTitle: 'Running Sneakers',
        variantSku: 'SKU-2',
        categoryId: 'cat-fashion',
        unitPrice: 3000,
        quantity: 1,
        sellerShippingBaseDhaka: 60,
        sellerShippingNationwide: 120,
        freeShippingThreshold: 1500,
        commissionRatePercent: 12,
      },
    ],
    zone: 'dhaka_metro',
    deliverySpeed: 'standard',
    coupon: {
      code: 'NOVARA10',
      discountType: 'percentage',
      discountValue: 10,
      maxDiscountAmount: 500,
      minOrderAmount: 1000,
    },
  });

  assert.equal(quote.itemsSubtotal, 4999);
  // Store A subtotal 1999 < 2500 => 60 shipping; Store B subtotal 3000 >= 1500 => 0 shipping
  assert.equal(quote.shippingTotal, 60);
  // 10% of 4999 = 499.9 -> 500
  assert.equal(quote.couponDiscountTotal, 500);
  assert.equal(quote.grandTotal, 4999 + 60 - 500);
  assert.equal(quote.sellerGroups.length, 2);
  // Store A commission: 6% of 1999 = 120; Store B commission: 12% of 3000 = 360
  assert.equal(quote.platformCommissionTotal, 480);
});

test('Order suborder status state machine prevents invalid jumps and enforces seller vs admin permissions', () => {
  assert.equal(canTransitionSuborderStatus('pending', 'confirmed'), true);
  assert.equal(canTransitionSuborderStatus('shipped', 'delivered'), true);
  assert.equal(canTransitionSuborderStatus('delivered', 'cancelled'), false);
  assert.equal(canTransitionSuborderStatus('refunded', 'pending'), false);
  assert.ok(ALLOWED_SUBORDER_TRANSITIONS.return_requested.includes('refunded'));

  // Seller allowed fulfillment transitions
  assert.equal(canSellerTransitionSuborderStatus('confirmed', 'processing'), true);
  assert.equal(canSellerTransitionSuborderStatus('processing', 'packed'), true);
  assert.equal(canSellerTransitionSuborderStatus('packed', 'shipped'), true);
  assert.equal(canSellerTransitionSuborderStatus('shipped', 'delivered'), true);

  // Seller forbidden from customer-only or finance/admin-only transitions
  assert.equal(canSellerTransitionSuborderStatus('delivered', 'return_requested'), false);
  assert.equal(canSellerTransitionSuborderStatus('confirmed', 'cancellation_requested'), false);
  assert.equal(canSellerTransitionSuborderStatus('return_requested', 'refunded'), false);
  assert.equal(canSellerTransitionSuborderStatus('return_requested', 'refund_pending'), false);
});

test('Admin input Zod validation schemas enforce required fields and safe numeric bounds', () => {
  assert.equal(
    commissionRuleInputSchema.safeParse({ name: 'Global 9%', scope: 'global', ratePercent: 9 }).success,
    true
  );
  assert.equal(
    commissionRuleInputSchema.safeParse({ name: 'Missing Cat', scope: 'category', ratePercent: 7 }).success,
    false
  );
  assert.equal(
    commissionRuleInputSchema.safeParse({ name: 'Excessive', scope: 'global', ratePercent: 75 }).success,
    false
  );
  assert.equal(
    categoryInputSchema.safeParse({ name: 'Smart Home' }).success,
    true
  );
  assert.equal(
    brandInputSchema.safeParse({ name: 'Baseus', isPopular: true }).success,
    true
  );
  assert.equal(
    bannerInputSchema.safeParse({
      title: 'Eid Sale',
      linkUrl: '/search',
      imageUrl: '/images/hero.jpg',
      position: 'hero_slide',
    }).success,
    true
  );
  assert.equal(
    couponInputSchema.safeParse({
      code: 'eid2026',
      title: 'Eid Offer',
      discountType: 'fixed',
      discountValue: 200,
      startAt: new Date(),
      endAt: new Date(Date.now() + 86400000),
    }).success,
    true
  );
  assert.equal(
    platformSettingsInputSchema.safeParse({
      freeDeliveryThreshold: 999,
      defaultCommissionPercent: 8,
      minPayoutAmount: 500,
      returnWindowDays: 7,
      announcementText: 'Free delivery over 999',
      supportEmail: 'support@novara.com.bd',
      supportPhone: '+880 9612-000888',
    }).success,
    true
  );
});

test('Seller application & payout account validation enforces method-specific MFS and bank rules', () => {
  // Valid bKash & Nagad formats (including formatted and +880)
  assert.equal(validatePayoutAccountNumber('bkash', '01711223344').valid, true);
  assert.equal(validatePayoutAccountNumber('bkash', '01711-223344').valid, true);
  assert.equal(validatePayoutAccountNumber('nagad', '+8801812345678').valid, true);
  assert.equal(validatePayoutAccountNumber('nagad', '01911 223344').valid, true);

  // Invalid MFS formats rejected with clear errors
  assert.equal(validatePayoutAccountNumber('bkash', '01211223344').valid, false);
  assert.equal(validatePayoutAccountNumber('bkash', '017112233').valid, false);
  assert.equal(validatePayoutAccountNumber('nagad', 'abcdefghij').valid, false);

  // Valid bank accounts (8-24 chars/digits including formatted)
  assert.equal(validatePayoutAccountNumber('bank', '12345678').valid, true);
  assert.equal(validatePayoutAccountNumber('bank', '123456789').valid, true);
  assert.equal(validatePayoutAccountNumber('bank', '101-110-0012345').valid, true);

  // Invalid bank accounts
  assert.equal(validatePayoutAccountNumber('bank', '1234567').valid, false);
  assert.equal(validatePayoutAccountNumber('bank', 'abcdefghij').valid, false);

  const baseApp = {
    storeName: 'Dhaka Tech Traders',
    businessType: 'sole_proprietorship' as const,
    nidNumber: '1994261122334',
    tradeLicenseNumber: '',
    phone: '01711223344',
    division: 'Dhaka',
    district: 'Dhaka',
    pickupAddress: 'House 12, Road 4, Mirpur, Dhaka',
    accountHolderName: 'Tariq Rahman',
    description: 'Verified electronics and accessories merchant in Dhaka.',
  };

  assert.equal(
    sellerApplicationSchema.safeParse({
      ...baseApp,
      bankOrMfsType: 'bkash',
      accountNumber: '01711-223344',
    }).success,
    true
  );

  assert.equal(
    sellerApplicationSchema.safeParse({
      ...baseApp,
      bankOrMfsType: 'bank',
      accountNumber: '123456789',
    }).success,
    true
  );

  const badMfs = sellerApplicationSchema.safeParse({
    ...baseApp,
    bankOrMfsType: 'bkash',
    accountNumber: '0123456789',
  });
  assert.equal(badMfs.success, false);

  assert.equal(
    payoutRequestSchema.safeParse({
      amount: 1000,
      method: 'bank',
      accountNumber: '1011234567890',
      idempotencyKey: 'payout-key-1234',
    }).success,
    true
  );

  assert.equal(
    payoutRequestSchema.safeParse({
      amount: 1000,
      method: 'nagad',
      accountNumber: '0123456789',
      idempotencyKey: 'payout-key-1235',
    }).success,
    false
  );
});
