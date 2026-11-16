import mongoose, { Schema, Document, Types } from 'mongoose';

export type SellerApplicationStatus =
  | 'draft'
  | 'pending'
  | 'additional_info_required'
  | 'approved'
  | 'rejected'
  | 'suspended';

export interface ISellerApplication extends Document {
  userId: Types.ObjectId;
  storeName: string;
  bnStoreName?: string;
  businessType: 'individual' | 'sole_proprietorship' | 'limited_company';
  nidNumber: string;
  tradeLicenseNumber?: string;
  phone: string;
  division: string;
  district: string;
  pickupAddress: string;
  bankOrMfsType: 'bkash' | 'nagad' | 'bank';
  accountNumber: string;
  accountHolderName: string;
  description: string;
  status: SellerApplicationStatus;
  reviewNotes?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  statusHistory: Array<{
    status: SellerApplicationStatus;
    note?: string;
    changedBy: Types.ObjectId;
    changedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const SellerApplicationSchema = new Schema<ISellerApplication>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    storeName: { type: String, required: true, trim: true },
    bnStoreName: { type: String, trim: true },
    businessType: {
      type: String,
      enum: ['individual', 'sole_proprietorship', 'limited_company'],
      required: true,
    },
    nidNumber: { type: String, required: true },
    tradeLicenseNumber: { type: String },
    phone: { type: String, required: true },
    division: { type: String, required: true },
    district: { type: String, required: true },
    pickupAddress: { type: String, required: true },
    bankOrMfsType: { type: String, enum: ['bkash', 'nagad', 'bank'], required: true },
    accountNumber: { type: String, required: true },
    accountHolderName: { type: String, required: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ['draft', 'pending', 'additional_info_required', 'approved', 'rejected', 'suspended'],
      default: 'pending',
      index: true,
    },
    reviewNotes: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    statusHistory: [
      {
        status: { type: String, required: true },
        note: { type: String },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const SellerApplication = mongoose.model<ISellerApplication>(
  'SellerApplication',
  SellerApplicationSchema
);

export interface IStore extends Document {
  ownerUserId: Types.ObjectId;
  name: string;
  bnName?: string;
  slug: string;
  logoUrl?: string;
  bannerUrl?: string;
  description: string;
  verified: boolean;
  isFeatured: boolean;
  status: 'active' | 'suspended';
  division: string;
  district: string;
  pickupAddress: string;
  supportPhone: string;
  ratingAvg: number;
  ratingCount: number;
  productCount: number;
  commissionOverridePercent?: number;
  payoutAccount: {
    method: 'bkash' | 'nagad' | 'bank';
    accountNumber: string;
    accountHolderName: string;
  };
  shippingDefaults: {
    dhakaFee: number;
    nationwideFee: number;
    freeShippingThreshold: number;
    handlingDays: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const StoreSchema = new Schema<IStore>(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    bnName: { type: String, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    logoUrl: { type: String },
    bannerUrl: { type: String },
    description: { type: String, default: '' },
    verified: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false, index: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
    division: { type: String, required: true },
    district: { type: String, required: true },
    pickupAddress: { type: String, required: true },
    supportPhone: { type: String, required: true },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    productCount: { type: Number, default: 0 },
    commissionOverridePercent: { type: Number, min: 0, max: 50 },
    payoutAccount: {
      method: { type: String, enum: ['bkash', 'nagad', 'bank'], required: true },
      accountNumber: { type: String, required: true },
      accountHolderName: { type: String, required: true },
    },
    shippingDefaults: {
      dhakaFee: { type: Number, default: 60 },
      nationwideFee: { type: Number, default: 120 },
      freeShippingThreshold: { type: Number, default: 999 },
      handlingDays: { type: String, default: '2-4 Days' },
    },
  },
  { timestamps: true }
);

export const Store = mongoose.model<IStore>('Store', StoreSchema);

export interface ICommissionRule extends Document {
  categoryId?: Types.ObjectId;
  storeId?: Types.ObjectId;
  name: string;
  ratePercent: number;
  isDefault: boolean;
  active: boolean;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CommissionRuleSchema = new Schema<ICommissionRule>(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', index: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', index: true },
    name: { type: String, required: true },
    ratePercent: { type: Number, required: true, min: 0, max: 50 },
    isDefault: { type: Boolean, default: false },
    active: { type: Boolean, default: true, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const CommissionRule = mongoose.model<ICommissionRule>('CommissionRule', CommissionRuleSchema);
