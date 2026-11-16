import crypto from 'crypto';
import { env, getIntegrationStatus } from '../config/env';
import { ParentOrder, PaymentTransaction, SubOrder } from '../models/Order';
import { Notification } from '../models/Engagement';

export interface GatewayInitiationResult {
  gateway: 'cod' | 'bkash' | 'nagad' | 'card';
  mode: 'cod' | 'live_gateway' | 'configuration_required';
  transactionId: string;
  redirectUrl?: string;
  message: string;
}

export async function initiatePaymentGateway(params: {
  parentOrderId: string;
  gateway: 'cod' | 'bkash' | 'nagad' | 'card';
}): Promise<GatewayInitiationResult> {
  const tx = await PaymentTransaction.findOne({ parentOrderId: params.parentOrderId });
  if (!tx) throw new Error('Payment transaction record not found');

  if (params.gateway === 'cod') {
    return {
      gateway: 'cod',
      mode: 'cod',
      transactionId: tx.gatewayTransactionId,
      message: 'Cash on Delivery confirmed. Order will be paid upon delivery.',
    };
  }

  const integrations = getIntegrationStatus();

  if (params.gateway === 'bkash') {
    if (!integrations.bkash) {
      return {
        gateway: 'bkash',
        mode: 'configuration_required',
        transactionId: tx.gatewayTransactionId,
        message:
          'bKash merchant credentials (BKASH_APP_KEY, BKASH_APP_SECRET) are not configured. Order is saved as pending payment verification.',
      };
    }
    // Real bKash tokenized checkout integration point
    const grantRes = await fetch(`${env.payments.bkash.baseUrl}/tokenized/checkout/token/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        username: env.payments.bkash.username,
        password: env.payments.bkash.password,
      },
      body: JSON.stringify({
        app_key: env.payments.bkash.appKey,
        app_secret: env.payments.bkash.appSecret,
      }),
    });
    const grantData = (await grantRes.json()) as { id_token?: string };
    if (!grantData.id_token) {
      throw new Error('Failed to authenticate with bKash gateway');
    }

    const createRes = await fetch(`${env.payments.bkash.baseUrl}/tokenized/checkout/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: grantData.id_token,
        'X-APP-Key': env.payments.bkash.appKey,
      },
      body: JSON.stringify({
        mode: '0011',
        payerReference: String(tx.customerId),
        callbackURL: `${env.appUrl}/api/orders/payments/bkash/callback`,
        amount: String(tx.amount),
        currency: 'BDT',
        intent: 'sale',
        merchantInvoiceNumber: tx.gatewayTransactionId,
      }),
    });
    const createData = (await createRes.json()) as { bkashURL?: string; paymentID?: string };
    if (!createData.bkashURL) {
      throw new Error('Failed to create bKash payment session');
    }
    tx.providerPayload = { paymentID: createData.paymentID };
    tx.status = 'pending';
    await tx.save();

    return {
      gateway: 'bkash',
      mode: 'live_gateway',
      transactionId: tx.gatewayTransactionId,
      redirectUrl: createData.bkashURL,
      message: 'Redirecting to bKash checkout',
    };
  }

  if (params.gateway === 'nagad' && !integrations.nagad) {
    return {
      gateway: 'nagad',
      mode: 'configuration_required',
      transactionId: tx.gatewayTransactionId,
      message:
        'Nagad merchant keys (NAGAD_MERCHANT_ID, NAGAD_MERCHANT_PRIVATE_KEY) are not configured. Order is saved as pending payment verification.',
    };
  }

  if (params.gateway === 'card' && !integrations.sslcommerz) {
    return {
      gateway: 'card',
      mode: 'configuration_required',
      transactionId: tx.gatewayTransactionId,
      message:
        'SSLCommerz / Card gateway keys (SSLCOMMERZ_STORE_ID, SSLCOMMERZ_STORE_PASSWORD) are not configured. Order is saved as pending payment verification.',
    };
  }

  return {
    gateway: params.gateway,
    mode: 'configuration_required',
    transactionId: tx.gatewayTransactionId,
    message: 'Gateway session awaiting external merchant credentials.',
  };
}

export function verifyWebhookSignature(params: {
  gateway: 'bkash' | 'nagad' | 'card';
  rawBody: string;
  signatureHeader?: string;
}): boolean {
  const secret =
    params.gateway === 'bkash'
      ? env.payments.bkash.webhookSecret
      : params.gateway === 'nagad'
        ? env.payments.nagad.webhookSecret
        : env.payments.sslcommerz.storePassword;

  if (!secret || !params.signatureHeader) return false;
  const expected = crypto.createHmac('sha256', secret).update(params.rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(params.signatureHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function processVerifiedPaymentWebhook(params: {
  gatewayTransactionId: string;
  webhookEventId: string;
  status: 'verified' | 'failed';
  paidAmount: number;
  providerPayload?: Record<string, unknown>;
}) {
  const tx = await PaymentTransaction.findOne({ gatewayTransactionId: params.gatewayTransactionId });
  if (!tx) throw new Error('Transaction not found');

  // Replay & duplicate webhook protection
  if (tx.webhookEventsProcessed.includes(params.webhookEventId)) {
    return { deduplicated: true, transaction: tx };
  }

  if (params.status === 'verified' && Math.round(params.paidAmount) !== Math.round(tx.amount)) {
    throw new Error(`Amount mismatch: expected ৳${tx.amount}, received ৳${params.paidAmount}`);
  }

  tx.webhookEventsProcessed.push(params.webhookEventId);
  tx.providerPayload = { ...(tx.providerPayload || {}), ...(params.providerPayload || {}) };

  if (tx.status === 'verified') {
    // Already verified; do not duplicate financial effects
    await tx.save();
    return { deduplicated: true, transaction: tx };
  }

  tx.status = params.status;
  if (params.status === 'verified') {
    tx.verifiedAt = new Date();
  }
  await tx.save();

  const parentOrder = await ParentOrder.findById(tx.parentOrderId);
  if (parentOrder) {
    parentOrder.paymentStatus = params.status === 'verified' ? 'paid' : 'failed';
    await parentOrder.save();

    if (params.status === 'verified') {
      await SubOrder.updateMany(
        { parentOrderId: parentOrder._id, status: 'pending' },
        {
          $set: { status: 'confirmed' },
          $push: {
            timeline: {
              status: 'confirmed',
              note: `Payment verified via ${tx.gateway.toUpperCase()}`,
              timestamp: new Date(),
            },
          },
        }
      );

      await Notification.create({
        recipientUserId: parentOrder.customerId,
        recipientRoleScope: 'customer',
        type: 'payment_verified',
        title: `Payment Confirmed for ${parentOrder.orderNumber}`,
        message: `Your payment of ৳${tx.amount} via ${tx.gateway.toUpperCase()} has been verified.`,
        link: `/orders/${parentOrder._id}`,
      });
    }
  }

  return { deduplicated: false, transaction: tx };
}
