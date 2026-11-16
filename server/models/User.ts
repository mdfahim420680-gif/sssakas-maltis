import mongoose, { Schema, Document, Types } from 'mongoose';

export type UserRole =
  | 'customer'
  | 'seller'
  | 'admin'
  | 'super_admin'
  | 'catalog_manager'
  | 'order_manager'
  | 'finance_manager'
  | 'support_agent'
  | 'content_manager';

export interface IAddress {
  _id?: Types.ObjectId;
  label: string;
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
  isDefault: boolean;
}

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  passwordHash?: string;
  avatarUrl?: string;
  role: UserRole;
  permissions: string[];
  status: 'active' | 'suspended' | 'banned';
  emailVerified: boolean;
  emailVerificationTokenHash?: string;
  emailVerificationExpiresAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  oauthProviders: {
    googleId?: string;
    facebookId?: string;
  };
  addresses: IAddress[];
  wishlistProductIds: Types.ObjectId[];
  recentlyViewedProductIds: Types.ObjectId[];
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>(
  {
    label: { type: String, required: true, default: 'Home' },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    alternatePhone: { type: String },
    division: { type: String, required: true },
    district: { type: String, required: true },
    upazila: { type: String, required: true },
    unionOrArea: { type: String, required: true },
    streetAddress: { type: String, required: true },
    postalCode: { type: String, required: true },
    deliveryInstructions: { type: String },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, select: false },
    avatarUrl: { type: String },
    role: {
      type: String,
      enum: [
        'customer',
        'seller',
        'admin',
        'super_admin',
        'catalog_manager',
        'order_manager',
        'finance_manager',
        'support_agent',
        'content_manager',
      ],
      default: 'customer',
      index: true,
    },
    permissions: [{ type: String }],
    status: {
      type: String,
      enum: ['active', 'suspended', 'banned'],
      default: 'active',
      index: true,
    },
    emailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpiresAt: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    oauthProviders: {
      googleId: { type: String, sparse: true, index: true },
      facebookId: { type: String, sparse: true, index: true },
    },
    addresses: { type: [AddressSchema], default: [] },
    wishlistProductIds: [{ type: Schema.Types.ObjectId, ref: 'CanonicalProduct' }],
    recentlyViewedProductIds: [{ type: Schema.Types.ObjectId, ref: 'CanonicalProduct' }],
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
