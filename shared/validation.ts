import { z } from 'zod';
import { isValidBangladeshPhone, validateBangladeshAddressHierarchy } from './bangladeshGeo';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Valid email address required').toLowerCase(),
  phone: z
    .string()
    .trim()
    .refine(isValidBangladeshPhone, 'Enter a valid Bangladesh phone number (e.g. 017XXXXXXXX)'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Valid email required').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const addressSchema = z
  .object({
    label: z.string().trim().min(1).max(40).default('Home'),
    fullName: z.string().trim().min(2, 'Recipient name is required').max(80),
    phone: z.string().trim().refine(isValidBangladeshPhone, 'Valid Bangladesh mobile number required'),
    alternatePhone: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || isValidBangladeshPhone(v), 'Invalid alternate phone number'),
    division: z.string().trim().min(2, 'Division is required'),
    district: z.string().trim().min(2, 'District is required'),
    upazila: z.string().trim().min(2, 'Upazila/Thana is required'),
    unionOrArea: z.string().trim().min(2, 'Area / Union / Ward is required').max(100),
    streetAddress: z.string().trim().min(5, 'Detailed house/road address is required').max(250),
    postalCode: z.string().trim().regex(/^\d{4}$/, 'Bangladesh postal code must be 4 digits'),
    deliveryInstructions: z.string().trim().max(200).optional(),
    isDefault: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    const check = validateBangladeshAddressHierarchy(val.division, val.district, val.upazila);
    if (!check.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: check.reason || 'Invalid Bangladesh address hierarchy',
        path: ['upazila'],
      });
    }
  });

export function validatePayoutAccountNumber(
  method: 'bkash' | 'nagad' | 'bank',
  accountNumber: string
): { valid: boolean; normalized: string; error?: string } {
  const trimmed = accountNumber.trim();
  const compact = trimmed.replace(/[\s-]/g, '');

  if (method === 'bkash' || method === 'nagad') {
    const label = method === 'bkash' ? 'bKash' : 'Nagad';
    if (!isValidBangladeshPhone(trimmed)) {
      return {
        valid: false,
        normalized: compact,
        error: `Enter a valid 11-digit Bangladesh ${label} mobile number (e.g. 017XXXXXXXX)`,
      };
    }
    return { valid: true, normalized: compact };
  }

  if (!/^[A-Za-z0-9]{8,24}$/.test(compact) || (compact.match(/\d/g) || []).length < 6) {
    return {
      valid: false,
      normalized: compact,
      error: 'Enter a valid bank account number (8-24 digits/characters, e.g. 1011234567890)',
    };
  }

  return { valid: true, normalized: compact };
}

export const sellerApplicationSchema = z
  .object({
    storeName: z.string().trim().min(3, 'Store name must be at least 3 characters').max(80),
    bnStoreName: z.string().trim().max(80).optional(),
    businessType: z.enum(['individual', 'sole_proprietorship', 'limited_company']),
    nidNumber: z
      .string()
      .trim()
      .transform((v) => v.replace(/[\s-]/g, ''))
      .refine((v) => /^\d{10,17}$/.test(v), 'Valid NID (10-17 digits) required'),
    tradeLicenseNumber: z.string().trim().max(50).optional(),
    phone: z.string().trim().refine(isValidBangladeshPhone, 'Valid Bangladesh phone required'),
    division: z.string().trim().min(2, 'Division is required'),
    district: z.string().trim().min(2, 'District is required'),
    pickupAddress: z.string().trim().min(5, 'Pickup warehouse/store address required').max(250),
    bankOrMfsType: z.enum(['bkash', 'nagad', 'bank']),
    accountNumber: z.string().trim().min(1, 'Account or MFS number is required').max(30),
    accountHolderName: z.string().trim().min(2, 'Account holder name is required').max(80),
    description: z.string().trim().min(10, 'Describe your store and product categories').max(1000),
  })
  .superRefine((val, ctx) => {
    const check = validatePayoutAccountNumber(val.bankOrMfsType, val.accountNumber);
    if (!check.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: check.error || 'Valid account or MFS number required',
        path: ['accountNumber'],
      });
    }
  });

export const canonicalProductSchema = z.object({
  title: z.string().trim().min(3).max(180),
  bnTitle: z.string().trim().max(180).optional(),
  slug: z.string().trim().max(160).optional(),
  description: z.string().trim().min(10).max(5000),
  categoryId: z.string().min(1),
  subCategoryId: z.string().trim().optional(),
  brandId: z.string().min(1),
  modelName: z.string().trim().max(80).optional(),
  images: z.array(z.string().min(1)).min(1, 'At least one product image is required'),
  videoUrl: z.string().trim().optional(),
  warranty: z.string().trim().max(120).default('7 Days Replacement Warranty'),
  returnPolicyDays: z.number().int().min(0).max(30).default(7),
  weightGrams: z.number().positive().default(500),
  keywords: z.array(z.string()).default([]),
  isSponsored: z.boolean().optional(),
  specifications: z
    .array(z.object({ key: z.string().trim().min(1), value: z.string().trim().min(1) }))
    .default([]),
  variants: z
    .array(
      z.object({
        sku: z.string().trim().min(2).max(60),
        label: z.string().trim().min(1).max(80),
        color: z.string().trim().optional(),
        sizeOrStorage: z.string().trim().optional(),
        imageUrl: z.string().trim().optional(),
      })
    )
    .min(1, 'At least one variant is required'),
});

export const sellerOfferSchema = z.object({
  productId: z.string().min(1),
  variantSku: z.string().min(1),
  price: z.number().positive('Price must be greater than 0'),
  compareAtPrice: z.number().positive().optional(),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  maxPurchaseQty: z.number().int().min(1).max(50).default(5),
  condition: z.enum(['new', 'refurbished']).default('new'),
  deliveryEstimateDays: z.string().trim().default('2-4 Days'),
  shippingFeeDhaka: z.number().min(0).default(60),
  shippingFeeNationwide: z.number().min(0).default(120),
  freeShippingThreshold: z.number().min(0).optional(),
  offerNote: z.string().trim().max(200).optional(),
  isActive: z.boolean().default(true),
});

export const checkoutSchema = z.object({
  address: addressSchema,
  deliverySpeed: z.enum(['standard', 'express']).default('standard'),
  paymentMethod: z.enum(['cod', 'bkash', 'nagad', 'card']),
  couponCode: z.string().trim().optional(),
  idempotencyKey: z.string().min(8).max(120),
  notes: z.string().trim().max(300).optional(),
});

export const reviewSchema = z.object({
  productId: z.string().min(1),
  subOrderId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(2).max(100).optional(),
  comment: z.string().trim().min(5, 'Please write at least 5 characters').max(1500),
  images: z.array(z.string()).max(4).default([]),
});

export const returnRequestSchema = z.object({
  subOrderId: z.string().min(1),
  reason: z.enum([
    'damaged_item',
    'wrong_item',
    'defective_not_working',
    'missing_accessories',
    'not_as_described',
    'other',
  ]),
  details: z.string().trim().min(10, 'Provide details about the issue').max(1500),
  evidenceImages: z.array(z.string()).max(5).default([]),
  requestedAmount: z.number().positive().optional(),
});

export const payoutRequestSchema = z
  .object({
    amount: z.number().positive('Amount must be positive'),
    method: z.enum(['bkash', 'nagad', 'bank']),
    accountNumber: z.string().trim().min(1, 'Account or MFS number is required').max(30),
    idempotencyKey: z.string().min(8).max(120),
  })
  .superRefine((val, ctx) => {
    const check = validatePayoutAccountNumber(val.method, val.accountNumber);
    if (!check.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: check.error || 'Valid account or MFS number required',
        path: ['accountNumber'],
      });
    }
  });

export const supportTicketSchema = z.object({
  subject: z.string().trim().min(4).max(140),
  category: z.enum(['order', 'payment', 'return', 'seller_issue', 'account', 'general']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  relatedOrderNumber: z.string().trim().optional(),
  message: z.string().trim().min(10).max(2000),
});

export const commissionRuleInputSchema = z
  .object({
    name: z.string().trim().min(2, 'Rule name is required').max(120),
    scope: z.enum(['global', 'category', 'seller']),
    categoryId: z.string().trim().optional(),
    storeId: z.string().trim().optional(),
    ratePercent: z.number().min(0, 'Rate cannot be negative').max(50, 'Rate cannot exceed 50%'),
  })
  .superRefine((val, ctx) => {
    if (val.scope === 'category' && !val.categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select a target category for a category commission rule',
        path: ['categoryId'],
      });
    }
    if (val.scope === 'seller' && !val.storeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select a target store for a seller commission rule',
        path: ['storeId'],
      });
    }
  });

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, 'Category name is required').max(80),
  bnName: z.string().trim().max(80).optional(),
  slug: z.string().trim().max(100).optional(),
  parentId: z.string().trim().nullable().optional(),
  description: z.string().trim().max(500).optional(),
  iconName: z.string().trim().max(40).optional(),
  imageUrl: z.string().trim().optional(),
  accentBg: z.string().trim().max(20).optional(),
  displayOrder: z.number().int().min(0).max(1000).optional(),
  isFeatured: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const brandInputSchema = z.object({
  name: z.string().trim().min(2, 'Brand name is required').max(80),
  slug: z.string().trim().max(100).optional(),
  logoText: z.string().trim().max(40).optional(),
  logoUrl: z.string().trim().optional(),
  isPopular: z.boolean().optional(),
  displayOrder: z.number().int().min(0).max(1000).optional(),
  active: z.boolean().optional(),
});

export const bannerStyleConfigSchema = z
  .object({
    backgroundMode: z.enum(['solid', 'gradient', 'image', 'image_overlay', 'image_gradient_overlay']).optional(),
    solidColor: z.string().trim().max(40).optional(),
    gradientType: z.enum(['linear', 'radial']).optional(),
    gradientAngle: z.number().min(0).max(360).optional(),
    gradientStops: z
      .array(z.object({ color: z.string().trim().max(40), position: z.number().min(0).max(100) }))
      .min(2)
      .max(4)
      .optional(),
    imagePosition: z.enum(['center', 'top', 'bottom', 'left', 'right', 'custom']).optional(),
    imagePosX: z.number().min(0).max(100).optional(),
    imagePosY: z.number().min(0).max(100).optional(),
    imageSize: z.enum(['cover', 'contain', 'auto']).optional(),
    imageRepeat: z.enum(['no-repeat', 'repeat', 'repeat-x', 'repeat-y']).optional(),
    imageScale: z.number().min(0.8).max(1.5).optional(),
    imageRotation: z.number().min(-15).max(15).optional(),
    overlayMode: z.enum(['none', 'solid', 'gradient']).optional(),
    overlayColor: z.string().trim().max(40).optional(),
    overlaySecondaryColor: z.string().trim().max(40).optional(),
    overlayAngle: z.number().min(0).max(360).optional(),
    overlayOpacity: z.number().min(0).max(100).optional(),
    heightPreset: z.enum(['sm', 'md', 'lg', 'full', 'custom']).optional(),
    customHeight: z.string().trim().max(30).optional(),
    widthMode: z.enum(['container', 'full']).optional(),
    borderRadius: z.number().min(0).max(48).optional(),
    shadow: z.enum(['none', 'sm', 'md', 'lg']).optional(),
    paddingPreset: z.enum(['compact', 'normal', 'spacious']).optional(),
    eyebrow: z.string().trim().max(60).optional(),
    description: z.string().trim().max(300).optional(),
    textColor: z.string().trim().max(40).optional(),
    subtitleColor: z.string().trim().max(40).optional(),
    highlightColor: z.string().trim().max(40).optional(),
    headingSize: z.enum(['sm', 'md', 'lg', 'xl']).optional(),
    headingWeight: z.enum(['semibold', 'bold', 'extrabold', 'black']).optional(),
    lineHeight: z.enum(['tight', 'normal', 'relaxed']).optional(),
    maxContentWidth: z.enum(['sm', 'md', 'lg']).optional(),
    ctaBgColor: z.string().trim().max(40).optional(),
    ctaTextColor: z.string().trim().max(40).optional(),
    ctaHoverBgColor: z.string().trim().max(40).optional(),
    ctaHoverTextColor: z.string().trim().max(40).optional(),
    ctaBorderColor: z.string().trim().max(40).optional(),
    ctaRadius: z.enum(['md', 'xl', 'full']).optional(),
    ctaSize: z.enum(['sm', 'md', 'lg']).optional(),
    alignHorizontal: z.enum(['left', 'center', 'right']).optional(),
    alignVertical: z.enum(['top', 'center', 'bottom']).optional(),
    foregroundImageUrl: z.string().trim().max(500).optional(),
    foregroundPosition: z.enum(['right', 'left']).optional(),
    foregroundSize: z.enum(['sm', 'md', 'lg']).optional(),
    hoverEffect: z.enum(['none', 'lift', 'zoom_bg', 'shine']).optional(),
    mobileHeightPreset: z.enum(['inherit', 'sm', 'md', 'lg', 'full', 'custom']).optional(),
    mobileAlignHorizontal: z.enum(['inherit', 'left', 'center', 'right']).optional(),
    mobileHeadingSize: z.enum(['inherit', 'sm', 'md', 'lg', 'xl']).optional(),
  })
  .optional();

export const heroSliderConfigSchema = z.object({
  autoplay: z.boolean().default(true),
  slideDurationMs: z.number().int().min(2000).max(15000).default(5500),
  transitionType: z.enum(['fade', 'slide']).default('slide'),
  transitionDurationMs: z.number().int().min(200).max(1500).default(500),
  pauseOnHover: z.boolean().default(true),
  loop: z.boolean().default(true),
  showDots: z.boolean().default(true),
  showArrows: z.boolean().default(true),
});

const optionalNullableDate = z
  .union([z.null(), z.literal(''), z.coerce.date()])
  .transform((v) => (v instanceof Date ? v : null))
  .optional();

const bannerBaseShape = {
  title: z.string().trim().max(120).optional(),
  subtitle: z.string().trim().max(200).optional(),
  highlightText: z.string().trim().max(80).optional(),
  ctaText: z.string().trim().max(40).optional(),
  linkUrl: z.string().trim().max(300).optional(),
  imageUrl: z.string().trim().max(500).optional(),
  mobileImageUrl: z.string().trim().max(500).optional(),
  gradientTheme: z.string().trim().max(40),
  position: z.enum(['hero_slide', 'promo_trio', 'category_top', 'seasonal_strip']),
  displayOrder: z.number().int().min(0).max(1000),
  startDate: optionalNullableDate,
  endDate: optionalNullableDate,
  active: z.boolean(),
  campaignName: z.string().trim().max(120).optional(),
  styleConfig: bannerStyleConfigSchema,
};

export const bannerInputSchema = z
  .object({
    ...bannerBaseShape,
    title: bannerBaseShape.title.default(''),
    ctaText: bannerBaseShape.ctaText.default(''),
    linkUrl: bannerBaseShape.linkUrl.default(''),
    imageUrl: bannerBaseShape.imageUrl.default(''),
    gradientTheme: bannerBaseShape.gradientTheme.default('sky'),
    displayOrder: bannerBaseShape.displayOrder.default(1),
    active: bannerBaseShape.active.default(true),
  })
  .superRefine((val, ctx) => {
    if (val.position === 'hero_slide') {
      if (!val.imageUrl || !val.imageUrl.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Hero slide image is required',
          path: ['imageUrl'],
        });
      }
      return;
    }

    if (!val.title || val.title.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Banner title is required (min 2 characters)',
        path: ['title'],
      });
    }

    const bgMode = val.styleConfig?.backgroundMode;
    const needsImage = !bgMode || bgMode === 'image' || bgMode === 'image_overlay' || bgMode === 'image_gradient_overlay';
    if (needsImage && !val.imageUrl?.trim() && !val.styleConfig?.foregroundImageUrl?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Upload a background or foreground banner image',
        path: ['imageUrl'],
      });
    }
  });

export const bannerUpdateSchema = z.object(bannerBaseShape).partial();

const adBaseShape = {
  name: z.string().trim().min(2, 'Advertisement name is required').max(120),
  campaign: z.string().trim().min(2, 'Campaign name is required').max(120),
  adType: z.enum(['internal_banner', 'sponsored_product', 'sponsored_store']),
  placement: z.enum([
    'homepage_banner',
    'homepage_section',
    'category_page',
    'search_results',
    'product_listing',
    'seller_storefront',
  ]),
  mediaUrl: z.string().trim().max(500).optional(),
  destinationLink: z.string().trim().min(1, 'Destination link is required').max(300),
  targetProductId: z.string().trim().nullable().optional(),
  targetStoreId: z.string().trim().nullable().optional(),
  priority: z.number().int().min(0).max(1000),
  startAt: optionalNullableDate,
  endAt: optionalNullableDate,
  active: z.boolean(),
};

export const adInputSchema = z.object({
  ...adBaseShape,
  adType: adBaseShape.adType.default('internal_banner'),
  priority: adBaseShape.priority.default(1),
  active: adBaseShape.active.default(true),
});

export const adUpdateSchema = z.object(adBaseShape).partial();

const couponBaseShape = {
  code: z.string().trim().min(3, 'Coupon code must be at least 3 characters').max(40).toUpperCase(),
  title: z.string().trim().min(3, 'Coupon title is required').max(140),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().positive('Discount value must be greater than 0'),
  maxDiscountAmount: z.number().min(0).optional(),
  minOrderAmount: z.number().min(0),
  usageLimit: z.number().int().min(1),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  active: z.boolean(),
};

export const couponInputSchema = z.object({
  ...couponBaseShape,
  minOrderAmount: couponBaseShape.minOrderAmount.default(0),
  usageLimit: couponBaseShape.usageLimit.default(500),
  active: couponBaseShape.active.default(true),
});

export const couponUpdateSchema = z.object(couponBaseShape).partial();

const promotionBaseShape = {
  name: z.string().trim().min(2, 'Promotion name is required').max(120),
  slug: z.string().trim().max(120).optional(),
  type: z.enum(['flash_sale', 'seasonal_campaign', 'category_campaign']),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  discountBadgeText: z.string().trim().max(80),
  productIds: z.array(z.string()),
  active: z.boolean(),
};

export const promotionInputSchema = z.object({
  ...promotionBaseShape,
  type: promotionBaseShape.type.default('flash_sale'),
  discountBadgeText: promotionBaseShape.discountBadgeText.default('Limited Time Offer'),
  productIds: promotionBaseShape.productIds.default([]),
  active: promotionBaseShape.active.default(true),
});

export const promotionUpdateSchema = z.object(promotionBaseShape).partial();

export const searchMappingInputSchema = z.object({
  term: z.string().trim().min(1, 'Primary term is required').max(80),
  synonyms: z.array(z.string().trim().min(1)).min(1, 'At least one synonym is required'),
  languageHint: z.enum(['en', 'bn', 'mixed']).default('mixed'),
  active: z.boolean().default(true),
});

export const platformSettingsInputSchema = z.object({
  freeDeliveryThreshold: z.number().min(0).max(100000),
  defaultCommissionPercent: z.number().min(0).max(50),
  minPayoutAmount: z.number().min(1).max(100000),
  returnWindowDays: z.number().int().min(1).max(60),
  requireProductModeration: z.boolean().optional(),
  sellerSubscriptionRequired: z.boolean().optional(),
  enabledPaymentMethods: z.array(z.enum(['cod', 'bkash', 'nagad', 'card'])).min(1).optional(),
  announcementText: z.string().trim().min(3).max(300),
  supportEmail: z.string().trim().email('Valid support email required'),
  supportPhone: z.string().trim().min(6).max(30),
});

