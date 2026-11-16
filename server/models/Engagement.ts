import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IReview extends Document {
  productId: Types.ObjectId;
  subOrderId: Types.ObjectId;
  storeId: Types.ObjectId;
  customerId: Types.ObjectId;
  customerName: string;
  rating: number;
  title?: string;
  comment: string;
  images: string[];
  verifiedPurchase: boolean;
  moderationStatus: 'published' | 'flagged' | 'hidden';
  sellerReply?: {
    text: string;
    repliedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'CanonicalProduct', required: true, index: true },
    subOrderId: { type: Schema.Types.ObjectId, ref: 'SubOrder', required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    customerName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String },
    comment: { type: String, required: true },
    images: { type: [String], default: [] },
    verifiedPurchase: { type: Boolean, default: true },
    moderationStatus: {
      type: String,
      enum: ['published', 'flagged', 'hidden'],
      default: 'published',
      index: true,
    },
    sellerReply: {
      text: { type: String },
      repliedAt: { type: Date },
    },
  },
  { timestamps: true }
);

// Prevent duplicate reviews for the same product in the same suborder
ReviewSchema.index({ customerId: 1, productId: 1, subOrderId: 1 }, { unique: true });

export const Review = mongoose.model<IReview>('Review', ReviewSchema);

export interface IReviewReport extends Document {
  reviewId: Types.ObjectId;
  reportedByUserId: Types.ObjectId;
  reason: string;
  status: 'open' | 'resolved' | 'dismissed';
  resolvedByAdminId?: Types.ObjectId;
  createdAt: Date;
}

const ReviewReportSchema = new Schema<IReviewReport>(
  {
    reviewId: { type: Schema.Types.ObjectId, ref: 'Review', required: true, index: true },
    reportedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open' },
    resolvedByAdminId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const ReviewReport = mongoose.model<IReviewReport>('ReviewReport', ReviewReportSchema);

export interface INotification extends Document {
  recipientUserId: Types.ObjectId;
  recipientRoleScope: 'customer' | 'seller' | 'admin';
  type: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  emailStatus?: 'not_sent' | 'sent' | 'logged_dev' | 'failed';
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipientRoleScope: { type: String, enum: ['customer', 'seller', 'admin'], required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String },
    read: { type: Boolean, default: false, index: true },
    emailStatus: {
      type: String,
      enum: ['not_sent', 'sent', 'logged_dev', 'failed'],
      default: 'not_sent',
    },
  },
  { timestamps: true }
);

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);

export interface ISupportTicket extends Document {
  ticketNumber: string;
  creatorUserId: Types.ObjectId;
  creatorRole: 'customer' | 'seller';
  subject: string;
  category: 'order' | 'payment' | 'return' | 'seller_issue' | 'account' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  relatedOrderNumber?: string;
  assignedStaffId?: Types.ObjectId;
  status: 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
  messages: Array<{
    senderUserId: Types.ObjectId;
    senderName: string;
    senderRole: string;
    body: string;
    attachments: string[];
    sentAt: Date;
  }>;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    ticketNumber: { type: String, required: true, unique: true, index: true },
    creatorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    creatorRole: { type: String, enum: ['customer', 'seller'], required: true },
    subject: { type: String, required: true },
    category: {
      type: String,
      enum: ['order', 'payment', 'return', 'seller_issue', 'account', 'general'],
      required: true,
    },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium', index: true },
    relatedOrderNumber: { type: String },
    assignedStaffId: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'waiting_user', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    messages: [
      {
        senderUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        senderName: { type: String, required: true },
        senderRole: { type: String, required: true },
        body: { type: String, required: true },
        attachments: { type: [String], default: [] },
        sentAt: { type: Date, default: Date.now },
      },
    ],
    resolutionNotes: { type: String },
  },
  { timestamps: true }
);

export const SupportTicket = mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema);

export interface INewsletterSubscriber extends Document {
  email: string;
  subscribedAt: Date;
  active: boolean;
}

const NewsletterSubscriberSchema = new Schema<INewsletterSubscriber>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  subscribedAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
});

export const NewsletterSubscriber = mongoose.model<INewsletterSubscriber>(
  'NewsletterSubscriber',
  NewsletterSubscriberSchema
);
