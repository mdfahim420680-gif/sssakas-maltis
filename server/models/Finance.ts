import mongoose, { Schema, Document, Types } from 'mongoose';

export type LedgerEntryType =
  | 'order_gross_sale'
  | 'platform_commission'
  | 'seller_net_credit'
  | 'refund_debit'
  | 'cancellation_reversal'
  | 'payout_hold'
  | 'payout_settled'
  | 'payout_rejected_release'
  | 'manual_adjustment';

export interface IFinancialLedgerEntry extends Document {
  entryKey: string; // unique idempotency key per business event
  storeId: Types.ObjectId;
  subOrderId?: Types.ObjectId;
  parentOrderId?: Types.ObjectId;
  payoutRequestId?: Types.ObjectId;
  entryType: LedgerEntryType;
  bucket: 'pending' | 'eligible' | 'held' | 'paid_out' | 'platform_revenue' | 'reversed';
  amount: number; // positive credit or negative debit in BDT
  description: string;
  createdByUserId?: Types.ObjectId;
  createdAt: Date;
}

const FinancialLedgerEntrySchema = new Schema<IFinancialLedgerEntry>(
  {
    entryKey: { type: String, required: true, unique: true, index: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    subOrderId: { type: Schema.Types.ObjectId, ref: 'SubOrder', index: true },
    parentOrderId: { type: Schema.Types.ObjectId, ref: 'ParentOrder' },
    payoutRequestId: { type: Schema.Types.ObjectId, ref: 'PayoutRequest' },
    entryType: {
      type: String,
      enum: [
        'order_gross_sale',
        'platform_commission',
        'seller_net_credit',
        'refund_debit',
        'cancellation_reversal',
        'payout_hold',
        'payout_settled',
        'payout_rejected_release',
        'manual_adjustment',
      ],
      required: true,
    },
    bucket: {
      type: String,
      enum: ['pending', 'eligible', 'held', 'paid_out', 'platform_revenue', 'reversed'],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    description: { type: String, required: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const FinancialLedgerEntry = mongoose.model<IFinancialLedgerEntry>(
  'FinancialLedgerEntry',
  FinancialLedgerEntrySchema
);

export interface IPayoutRequest extends Document {
  payoutNumber: string;
  storeId: Types.ObjectId;
  sellerUserId: Types.ObjectId;
  idempotencyKey: string;
  amount: number;
  method: 'bkash' | 'nagad' | 'bank';
  accountNumber: string;
  status: 'requested' | 'approved' | 'processing' | 'completed' | 'rejected';
  settlementReference?: string;
  reviewedByAdminId?: Types.ObjectId;
  reviewNote?: string;
  reviewedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PayoutRequestSchema = new Schema<IPayoutRequest>(
  {
    payoutNumber: { type: String, required: true, unique: true, index: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    sellerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: ['bkash', 'nagad', 'bank'], required: true },
    accountNumber: { type: String, required: true },
    status: {
      type: String,
      enum: ['requested', 'approved', 'processing', 'completed', 'rejected'],
      default: 'requested',
      index: true,
    },
    settlementReference: { type: String },
    reviewedByAdminId: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewNote: { type: String },
    reviewedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

export const PayoutRequest = mongoose.model<IPayoutRequest>('PayoutRequest', PayoutRequestSchema);
