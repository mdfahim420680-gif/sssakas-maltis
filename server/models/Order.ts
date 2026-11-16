import mongoose, { Schema, Document, Types } from 'mongoose';
import { OrderStatus } from '../../shared/pricing';

export interface ICart extends Document {
  userId: Types.ObjectId;
  items: Array<{
    offerId: Types.ObjectId;
    productId: Types.ObjectId;
    storeId: Types.ObjectId;
    variantSku: string;
    quantity: number;
    addedAt: Date;
  }>;
  updatedAt: Date;
}

const CartSchema = new Schema<ICart>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    items: [
      {
        offerId: { type: Schema.Types.ObjectId, ref: 'SellerOffer', required: true },
        productId: { type: Schema.Types.ObjectId, ref: 'CanonicalProduct', required: true },
        storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
        variantSku: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        addedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const Cart = mongoose.model<ICart>('Cart', CartSchema);

export interface IParentOrder extends Document {
  orderNumber: string;
  customerId: Types.ObjectId;
  idempotencyKey: string;
  shippingAddress: {
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
  paymentStatus: 'unpaid' | 'pending_verification' | 'paid' | 'failed' | 'partially_refunded' | 'refunded';
  couponCode?: string;
  itemsSubtotal: number;
  shippingTotal: number;
  couponDiscountTotal: number;
  platformCommissionTotal: number;
  grandTotal: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ParentOrderSchema = new Schema<IParentOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    shippingAddress: {
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
    },
    deliverySpeed: { type: String, enum: ['standard', 'express'], default: 'standard' },
    paymentMethod: { type: String, enum: ['cod', 'bkash', 'nagad', 'card'], required: true },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'pending_verification', 'paid', 'failed', 'partially_refunded', 'refunded'],
      default: 'unpaid',
      index: true,
    },
    couponCode: { type: String },
    itemsSubtotal: { type: Number, required: true },
    shippingTotal: { type: Number, required: true },
    couponDiscountTotal: { type: Number, default: 0 },
    platformCommissionTotal: { type: Number, required: true },
    grandTotal: { type: Number, required: true },
    notes: { type: String },
  },
  { timestamps: true }
);

export const ParentOrder = mongoose.model<IParentOrder>('ParentOrder', ParentOrderSchema);

export interface ISubOrderItem {
  offerId: Types.ObjectId;
  productId: Types.ObjectId;
  productTitle: string;
  productSlug: string;
  productImage: string;
  variantSku: string;
  variantLabel: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  commissionRatePercent: number;
  commissionAmount: number;
}

export interface ISubOrder extends Document {
  subOrderNumber: string;
  parentOrderId: Types.ObjectId;
  customerId: Types.ObjectId;
  storeId: Types.ObjectId;
  storeName: string;
  sellerUserId: Types.ObjectId;
  items: ISubOrderItem[];
  subtotal: number;
  shippingFee: number;
  couponDiscountShare: number;
  commissionAmount: number;
  sellerNetPayable: number;
  status: OrderStatus;
  inventoryRestored: boolean;
  settlementStatus: 'pending' | 'eligible' | 'held' | 'settled' | 'reversed';
  shipment?: {
    courierName?: string;
    trackingNumber?: string;
    shippedAt?: Date;
    deliveredAt?: Date;
    estimatedDelivery?: string;
  };
  timeline: Array<{
    status: OrderStatus;
    note?: string;
    actorUserId?: Types.ObjectId;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const SubOrderSchema = new Schema<ISubOrder>(
  {
    subOrderNumber: { type: String, required: true, unique: true, index: true },
    parentOrderId: { type: Schema.Types.ObjectId, ref: 'ParentOrder', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    storeName: { type: String, required: true },
    sellerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: [
      {
        offerId: { type: Schema.Types.ObjectId, ref: 'SellerOffer', required: true },
        productId: { type: Schema.Types.ObjectId, ref: 'CanonicalProduct', required: true },
        productTitle: { type: String, required: true },
        productSlug: { type: String, required: true },
        productImage: { type: String, required: true },
        variantSku: { type: String, required: true },
        variantLabel: { type: String, required: true },
        unitPrice: { type: Number, required: true },
        quantity: { type: Number, required: true },
        lineTotal: { type: Number, required: true },
        commissionRatePercent: { type: Number, required: true },
        commissionAmount: { type: Number, required: true },
      },
    ],
    subtotal: { type: Number, required: true },
    shippingFee: { type: Number, required: true },
    couponDiscountShare: { type: Number, default: 0 },
    commissionAmount: { type: Number, required: true },
    sellerNetPayable: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        'pending',
        'confirmed',
        'processing',
        'packed',
        'shipped',
        'delivered',
        'cancellation_requested',
        'cancelled',
        'delivery_failed',
        'return_requested',
        'returned',
        'refund_pending',
        'refunded',
      ],
      default: 'pending',
      index: true,
    },
    inventoryRestored: { type: Boolean, default: false },
    settlementStatus: {
      type: String,
      enum: ['pending', 'eligible', 'held', 'settled', 'reversed'],
      default: 'pending',
      index: true,
    },
    shipment: {
      courierName: { type: String },
      trackingNumber: { type: String },
      shippedAt: { type: Date },
      deliveredAt: { type: Date },
      estimatedDelivery: { type: String },
    },
    timeline: [
      {
        status: { type: String, required: true },
        note: { type: String },
        actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const SubOrder = mongoose.model<ISubOrder>('SubOrder', SubOrderSchema);

export interface IPaymentTransaction extends Document {
  parentOrderId: Types.ObjectId;
  customerId: Types.ObjectId;
  gateway: 'cod' | 'bkash' | 'nagad' | 'card';
  gatewayTransactionId: string;
  idempotencyKey: string;
  amount: number;
  currency: string;
  status: 'initiated' | 'pending' | 'verified' | 'failed' | 'refunded';
  providerPayload?: Record<string, unknown>;
  webhookEventsProcessed: string[];
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    parentOrderId: { type: Schema.Types.ObjectId, ref: 'ParentOrder', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    gateway: { type: String, enum: ['cod', 'bkash', 'nagad', 'card'], required: true },
    gatewayTransactionId: { type: String, required: true, unique: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'BDT' },
    status: {
      type: String,
      enum: ['initiated', 'pending', 'verified', 'failed', 'refunded'],
      default: 'initiated',
      index: true,
    },
    providerPayload: { type: Schema.Types.Mixed },
    webhookEventsProcessed: { type: [String], default: [] },
    verifiedAt: { type: Date },
  },
  { timestamps: true }
);

export const PaymentTransaction = mongoose.model<IPaymentTransaction>(
  'PaymentTransaction',
  PaymentTransactionSchema
);

export interface IReturnRequest extends Document {
  returnNumber: string;
  subOrderId: Types.ObjectId;
  parentOrderId: Types.ObjectId;
  customerId: Types.ObjectId;
  storeId: Types.ObjectId;
  reason: string;
  details: string;
  evidenceImages: string[];
  requestedAmount: number;
  approvedAmount?: number;
  status:
    | 'requested'
    | 'seller_approved'
    | 'seller_disputed'
    | 'admin_review'
    | 'return_in_transit'
    | 'item_received'
    | 'refund_approved'
    | 'refund_executed'
    | 'rejected';
  sellerResponse?: string;
  adminResolutionNote?: string;
  refundReferenceId?: string;
  handledByAdminId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ReturnRequestSchema = new Schema<IReturnRequest>(
  {
    returnNumber: { type: String, required: true, unique: true, index: true },
    subOrderId: { type: Schema.Types.ObjectId, ref: 'SubOrder', required: true, unique: true, index: true },
    parentOrderId: { type: Schema.Types.ObjectId, ref: 'ParentOrder', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    reason: { type: String, required: true },
    details: { type: String, required: true },
    evidenceImages: { type: [String], default: [] },
    requestedAmount: { type: Number, required: true },
    approvedAmount: { type: Number },
    status: {
      type: String,
      enum: [
        'requested',
        'seller_approved',
        'seller_disputed',
        'admin_review',
        'return_in_transit',
        'item_received',
        'refund_approved',
        'refund_executed',
        'rejected',
      ],
      default: 'requested',
      index: true,
    },
    sellerResponse: { type: String },
    adminResolutionNote: { type: String },
    refundReferenceId: { type: String },
    handledByAdminId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const ReturnRequest = mongoose.model<IReturnRequest>('ReturnRequest', ReturnRequestSchema);
