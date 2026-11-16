import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBanner extends Document {
  title?: string;
  subtitle?: string;
  highlightText?: string;
  ctaText?: string;
  linkUrl?: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  gradientTheme?: string;
  position: 'hero_slide' | 'promo_trio' | 'category_top' | 'seasonal_strip';
  displayOrder: number;
  startDate?: Date;
  endDate?: Date;
  active: boolean;
  campaignName?: string;
  styleConfig?: Record<string, unknown>;
}

const BannerSchema = new Schema<IBanner>(
  {
    title: { type: String, default: '', trim: true },
    subtitle: { type: String, trim: true },
    highlightText: { type: String, trim: true },
    ctaText: { type: String, default: '' },
    linkUrl: { type: String, default: '', trim: true },
    imageUrl: { type: String, default: '' },
    mobileImageUrl: { type: String },
    gradientTheme: { type: String, default: 'sky' },
    position: {
      type: String,
      enum: ['hero_slide', 'promo_trio', 'category_top', 'seasonal_strip'],
      required: true,
      index: true,
    },
    displayOrder: { type: Number, default: 0 },
    startDate: { type: Date },
    endDate: { type: Date },
    active: { type: Boolean, default: true, index: true },
    campaignName: { type: String },
    styleConfig: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const Banner = mongoose.model<IBanner>('Banner', BannerSchema);

export interface IAdvertisement extends Document {
  name: string;
  campaign: string;
  adType: 'internal_banner' | 'sponsored_product' | 'sponsored_store';
  placement:
    | 'homepage_banner'
    | 'homepage_section'
    | 'category_page'
    | 'search_results'
    | 'product_listing'
    | 'seller_storefront';
  mediaUrl?: string;
  destinationLink: string;
  targetProductId?: Types.ObjectId;
  targetStoreId?: Types.ObjectId;
  targetCategorySlug?: string;
  priority: number;
  startAt?: Date;
  endAt?: Date;
  active: boolean;
  impressions: number;
  clicks: number;
}

const AdvertisementSchema = new Schema<IAdvertisement>(
  {
    name: { type: String, required: true },
    campaign: { type: String, required: true },
    adType: {
      type: String,
      enum: ['internal_banner', 'sponsored_product', 'sponsored_store'],
      required: true,
    },
    placement: {
      type: String,
      enum: [
        'homepage_banner',
        'homepage_section',
        'category_page',
        'search_results',
        'product_listing',
        'seller_storefront',
      ],
      required: true,
      index: true,
    },
    mediaUrl: { type: String },
    destinationLink: { type: String, required: true },
    targetProductId: { type: Schema.Types.ObjectId, ref: 'CanonicalProduct' },
    targetStoreId: { type: Schema.Types.ObjectId, ref: 'Store' },
    targetCategorySlug: { type: String },
    priority: { type: Number, default: 1 },
    startAt: { type: Date },
    endAt: { type: Date },
    active: { type: Boolean, default: true, index: true },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Advertisement = mongoose.model<IAdvertisement>('Advertisement', AdvertisementSchema);

export interface ICmsSection extends Document {
  key: string;
  title: string;
  subtitle?: string;
  sectionType:
    | 'announcement_bar'
    | 'trust_strip'
    | 'flash_sale'
    | 'shop_by_category'
    | 'promo_banners'
    | 'top_sellers'
    | 'product_tabs'
    | 'popular_brands'
    | 'newsletter_app_row'
    | 'hero_slider';
  visible: boolean;
  displayOrder: number;
  config: Record<string, unknown>;
}

const CmsSectionSchema = new Schema<ICmsSection>(
  {
    key: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    subtitle: { type: String },
    sectionType: { type: String, required: true },
    visible: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
    config: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const CmsSection = mongoose.model<ICmsSection>('CmsSection', CmsSectionSchema);

export interface IPromotion extends Document {
  name: string;
  slug: string;
  type: 'flash_sale' | 'seasonal_campaign' | 'category_campaign';
  startAt: Date;
  endAt: Date;
  discountBadgeText: string;
  productIds: Types.ObjectId[];
  active: boolean;
}

const PromotionSchema = new Schema<IPromotion>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ['flash_sale', 'seasonal_campaign', 'category_campaign'],
      required: true,
    },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    discountBadgeText: { type: String, default: 'Limited Time Offer' },
    productIds: [{ type: Schema.Types.ObjectId, ref: 'CanonicalProduct' }],
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const Promotion = mongoose.model<IPromotion>('Promotion', PromotionSchema);

export interface ICoupon extends Document {
  code: string;
  title: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount: number;
  usageLimit: number;
  usedCount: number;
  startAt: Date;
  endAt: Date;
  active: boolean;
}

const CouponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    title: { type: String, required: true },
    discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
    discountValue: { type: Number, required: true, min: 1 },
    maxDiscountAmount: { type: Number },
    minOrderAmount: { type: Number, default: 0 },
    usageLimit: { type: Number, default: 1000 },
    usedCount: { type: Number, default: 0 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const Coupon = mongoose.model<ICoupon>('Coupon', CouponSchema);

export interface ISearchMapping extends Document {
  term: string;
  synonyms: string[];
  languageHint: 'en' | 'bn' | 'mixed';
  active: boolean;
}

const SearchMappingSchema = new Schema<ISearchMapping>(
  {
    term: { type: String, required: true, unique: true, trim: true },
    synonyms: { type: [String], default: [] },
    languageHint: { type: String, enum: ['en', 'bn', 'mixed'], default: 'mixed' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const SearchMapping = mongoose.model<ISearchMapping>('SearchMapping', SearchMappingSchema);

export interface ISearchAnalyticsLog extends Document {
  query: string;
  normalizedQuery: string;
  resultCount: number;
  searchedAt: Date;
}

const SearchAnalyticsLogSchema = new Schema<ISearchAnalyticsLog>({
  query: { type: String, required: true },
  normalizedQuery: { type: String, required: true, index: true },
  resultCount: { type: Number, required: true },
  searchedAt: { type: Date, default: Date.now, index: true },
});

export const SearchAnalyticsLog = mongoose.model<ISearchAnalyticsLog>(
  'SearchAnalyticsLog',
  SearchAnalyticsLogSchema
);

export interface IAuditLog extends Document {
  actorUserId: Types.ObjectId;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId?: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorEmail: { type: String, required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true, index: true },
    targetType: { type: String, required: true },
    targetId: { type: String },
    details: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export interface IPlatformSettings extends Document {
  key: string;
  freeDeliveryThreshold: number;
  defaultCommissionPercent: number;
  minPayoutAmount: number;
  returnWindowDays: number;
  requireProductModeration: boolean;
  sellerSubscriptionRequired: boolean;
  enabledPaymentMethods: Array<'cod' | 'bkash' | 'nagad' | 'card'>;
  announcementText: string;
  supportEmail: string;
  supportPhone: string;
  initialSeedVersion?: number;
}

const PlatformSettingsSchema = new Schema<IPlatformSettings>(
  {
    key: { type: String, default: 'global', unique: true },
    freeDeliveryThreshold: { type: Number, default: 999 },
    defaultCommissionPercent: { type: Number, default: 8 },
    minPayoutAmount: { type: Number, default: 500 },
    returnWindowDays: { type: Number, default: 7 },
    requireProductModeration: { type: Boolean, default: true },
    sellerSubscriptionRequired: { type: Boolean, default: false },
    enabledPaymentMethods: {
      type: [String],
      default: ['cod', 'bkash', 'nagad', 'card'],
    },
    announcementText: {
      type: String,
      default: 'Free Delivery on orders over ৳999 | Mega Sale is Live! Up to 70% OFF | Secure Payment',
    },
    supportEmail: { type: String, default: 'support@novara.com.bd' },
    supportPhone: { type: String, default: '+880 9612-000888' },
    initialSeedVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const PlatformSettings = mongoose.model<IPlatformSettings>(
  'PlatformSettings',
  PlatformSettingsSchema
);
