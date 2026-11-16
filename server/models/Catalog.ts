import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  bnName: string;
  slug: string;
  parentId?: Types.ObjectId | null;
  description?: string;
  iconName?: string;
  imageUrl?: string;
  accentBg?: string;
  displayOrder: number;
  isFeatured: boolean;
  active: boolean;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    bnName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    description: { type: String, trim: true },
    iconName: { type: String, default: 'Package' },
    imageUrl: { type: String },
    accentBg: { type: String, default: '#EFF6FF' },
    displayOrder: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const Category = mongoose.model<ICategory>('Category', CategorySchema);

export interface IBrand extends Document {
  name: string;
  slug: string;
  logoText?: string;
  logoUrl?: string;
  isPopular: boolean;
  displayOrder: number;
  active: boolean;
}

const BrandSchema = new Schema<IBrand>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    logoText: { type: String },
    logoUrl: { type: String },
    isPopular: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const Brand = mongoose.model<IBrand>('Brand', BrandSchema);

export interface IProductVariant {
  sku: string;
  label: string;
  color?: string;
  sizeOrStorage?: string;
  imageUrl?: string;
}

export type ProductModerationStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'suspended'
  | 'archived'
  | 'unpublished';

export interface ICanonicalProduct extends Document {
  title: string;
  bnTitle?: string;
  slug: string;
  description: string;
  categoryId: Types.ObjectId;
  subCategoryId?: Types.ObjectId;
  brandId: Types.ObjectId;
  modelName?: string;
  images: string[];
  videoUrl?: string;
  warranty: string;
  returnPolicyDays: number;
  weightGrams: number;
  keywords: string[];
  searchNormalizedText: string;
  specifications: Array<{ key: string; value: string }>;
  variants: IProductVariant[];
  createdByUserId: Types.ObjectId;
  createdByStoreId?: Types.ObjectId;
  moderationStatus: ProductModerationStatus;
  moderationNotes?: string;
  ratingAvg: number;
  ratingCount: number;
  totalSold: number;
  viewCount: number;
  isFlashSaleCandidate: boolean;
  isTrending: boolean;
  isSponsored: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CanonicalProductSchema = new Schema<ICanonicalProduct>(
  {
    title: { type: String, required: true, trim: true },
    bnTitle: { type: String, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    description: { type: String, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    subCategoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    brandId: { type: Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
    modelName: { type: String, trim: true },
    images: { type: [String], required: true },
    videoUrl: { type: String },
    warranty: { type: String, default: '7 Days Replacement Warranty' },
    returnPolicyDays: { type: Number, default: 7 },
    weightGrams: { type: Number, default: 500 },
    keywords: { type: [String], default: [] },
    searchNormalizedText: { type: String, index: true },
    specifications: [{ key: { type: String, required: true }, value: { type: String, required: true } }],
    variants: [
      {
        sku: { type: String, required: true },
        label: { type: String, required: true },
        color: { type: String },
        sizeOrStorage: { type: String },
        imageUrl: { type: String },
      },
    ],
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByStoreId: { type: Schema.Types.ObjectId, ref: 'Store' },
    moderationStatus: {
      type: String,
      enum: [
        'draft',
        'pending_review',
        'approved',
        'published',
        'rejected',
        'suspended',
        'archived',
        'unpublished',
      ],
      default: 'pending_review',
      index: true,
    },
    moderationNotes: { type: String },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    totalSold: { type: Number, default: 0, index: true },
    viewCount: { type: Number, default: 0 },
    isFlashSaleCandidate: { type: Boolean, default: false, index: true },
    isTrending: { type: Boolean, default: false, index: true },
    isSponsored: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

CanonicalProductSchema.index({
  title: 'text',
  bnTitle: 'text',
  keywords: 'text',
  searchNormalizedText: 'text',
  'variants.sku': 'text',
});

export const CanonicalProduct = mongoose.model<ICanonicalProduct>(
  'CanonicalProduct',
  CanonicalProductSchema
);

export interface ISellerOffer extends Document {
  productId: Types.ObjectId;
  storeId: Types.ObjectId;
  sellerUserId: Types.ObjectId;
  variantSku: string;
  price: number;
  compareAtPrice?: number;
  discountPercent: number;
  stock: number;
  maxPurchaseQty: number;
  condition: 'new' | 'refurbished';
  deliveryEstimateDays: string;
  shippingFeeDhaka: number;
  shippingFeeNationwide: number;
  freeShippingThreshold?: number;
  offerNote?: string;
  flashSalePrice?: number;
  flashSaleStart?: Date;
  flashSaleEnd?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SellerOfferSchema = new Schema<ISellerOffer>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'CanonicalProduct', required: true, index: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    sellerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    variantSku: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 1 },
    compareAtPrice: { type: Number, min: 1 },
    discountPercent: { type: Number, default: 0, min: 0, max: 95 },
    stock: { type: Number, required: true, min: 0 },
    maxPurchaseQty: { type: Number, default: 5, min: 1 },
    condition: { type: String, enum: ['new', 'refurbished'], default: 'new' },
    deliveryEstimateDays: { type: String, default: '2-4 Days' },
    shippingFeeDhaka: { type: Number, default: 60, min: 0 },
    shippingFeeNationwide: { type: Number, default: 120, min: 0 },
    freeShippingThreshold: { type: Number, min: 0 },
    offerNote: { type: String },
    flashSalePrice: { type: Number, min: 1 },
    flashSaleStart: { type: Date },
    flashSaleEnd: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

// Enforces strict seller inventory isolation: each seller has at most one offer per canonical product + variant SKU
SellerOfferSchema.index({ storeId: 1, productId: 1, variantSku: 1 }, { unique: true });
SellerOfferSchema.index({ productId: 1, variantSku: 1, isActive: 1, price: 1 });

export const SellerOffer = mongoose.model<ISellerOffer>('SellerOffer', SellerOfferSchema);
