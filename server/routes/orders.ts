import crypto from 'crypto';
import { Router } from 'express';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { ParentOrder, PaymentTransaction, ReturnRequest, SubOrder } from '../models/Order';
import { checkoutSchema, returnRequestSchema } from '../../shared/validation';
import { placeAuthoritativeOrder, transitionSubOrderStatus } from '../services/orderService';
import {
  initiatePaymentGateway,
  processVerifiedPaymentWebhook,
  verifyWebhookSignature,
} from '../services/paymentService';
import { PlatformSettings } from '../models/Cms';

const router = Router();

router.post('/checkout', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid checkout input' });
      return;
    }

    const result = await placeAuthoritativeOrder({
      customerId: req.user!._id,
      address: parsed.data.address,
      deliverySpeed: parsed.data.deliverySpeed,
      paymentMethod: parsed.data.paymentMethod,
      couponCode: parsed.data.couponCode,
      idempotencyKey: parsed.data.idempotencyKey,
      notes: parsed.data.notes,
    });

    const paymentInit = await initiatePaymentGateway({
      parentOrderId: String(result.parentOrder._id),
      gateway: parsed.data.paymentMethod,
    });

    res.status(result.deduplicated ? 200 : 201).json({
      success: true,
      deduplicated: result.deduplicated,
      parentOrder: result.parentOrder,
      subOrders: result.subOrders,
      payment: paymentInit,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'Checkout failed' });
  }
});

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const parentOrders = await ParentOrder.find({ customerId: req.user!._id })
    .sort({ createdAt: -1 })
    .lean();
  const subOrders = await SubOrder.find({ customerId: req.user!._id })
    .sort({ createdAt: -1 })
    .lean();

  const subsByParent = new Map<string, any[]>();
  for (const s of subOrders) {
    const k = String(s.parentOrderId);
    const arr = subsByParent.get(k) || [];
    arr.push(s);
    subsByParent.set(k, arr);
  }

  res.json({
    success: true,
    orders: parentOrders.map((p) => ({
      ...p,
      subOrders: subsByParent.get(String(p._id)) || [],
    })),
  });
});

router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  const parentOrder = await ParentOrder.findOne({
    _id: req.params.id,
    customerId: req.user!._id,
  }).lean();
  if (!parentOrder) {
    res.status(404).json({ success: false, error: 'Order not found' });
    return;
  }

  const [subOrders, paymentTransaction, returns] = await Promise.all([
    SubOrder.find({ parentOrderId: parentOrder._id }).lean(),
    PaymentTransaction.findOne({ parentOrderId: parentOrder._id }).lean(),
    ReturnRequest.find({ parentOrderId: parentOrder._id }).lean(),
  ]);

  res.json({
    success: true,
    parentOrder,
    subOrders,
    paymentTransaction,
    returns,
  });
});

router.post('/suborders/:subOrderId/cancel', requireAuth, async (req: AuthRequest, res) => {
  try {
    const sub = await SubOrder.findOne({ _id: req.params.subOrderId, customerId: req.user!._id });
    if (!sub) {
      res.status(404).json({ success: false, error: 'Suborder not found' });
      return;
    }

    const reason = String(req.body.reason || 'Cancelled by customer');
    const nextStatus =
      sub.status === 'pending' || sub.status === 'confirmed' ? 'cancelled' : 'cancellation_requested';

    const updated = await transitionSubOrderStatus({
      subOrderId: String(sub._id),
      nextStatus,
      actorUserId: req.user!._id,
      note: reason,
    });
    res.json({ success: true, subOrder: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'Cancel failed' });
  }
});

router.post('/returns', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = returnRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid return request' });
      return;
    }

    const sub = await SubOrder.findOne({ _id: parsed.data.subOrderId, customerId: req.user!._id });
    if (!sub) {
      res.status(404).json({ success: false, error: 'Suborder not found' });
      return;
    }
    if (sub.status !== 'delivered') {
      res.status(400).json({ success: false, error: 'Returns can only be requested for delivered suborders' });
      return;
    }

    const settings = await PlatformSettings.findOne({ key: 'global' }).lean();
    const windowDays = settings?.returnWindowDays ?? 7;
    const deliveredAt = sub.shipment?.deliveredAt || sub.updatedAt;
    const daysSince = (Date.now() - new Date(deliveredAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > windowDays) {
      res.status(400).json({
        success: false,
        error: `Return window of ${windowDays} days has expired for this delivery.`,
      });
      return;
    }

    const existing = await ReturnRequest.findOne({ subOrderId: sub._id });
    if (existing) {
      res.status(409).json({ success: false, error: 'Return request already submitted for this suborder' });
      return;
    }

    const returnNumber = `RET-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const ret = await ReturnRequest.create({
      returnNumber,
      subOrderId: sub._id,
      parentOrderId: sub.parentOrderId,
      customerId: req.user!._id,
      storeId: sub.storeId,
      reason: parsed.data.reason,
      details: parsed.data.details,
      evidenceImages: parsed.data.evidenceImages,
      requestedAmount: Math.min(parsed.data.requestedAmount || sub.subtotal, sub.subtotal),
      status: 'requested',
    });

    await transitionSubOrderStatus({
      subOrderId: String(sub._id),
      nextStatus: 'return_requested',
      actorUserId: req.user!._id,
      note: `Return ${returnNumber} requested (${parsed.data.reason})`,
    });

    res.status(201).json({ success: true, returnRequest: ret });
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'Return request failed' });
  }
});

// Signed webhook endpoint with replay protection
router.post('/payments/webhook/:gateway', async (req, res) => {
  try {
    const gateway = req.params.gateway as 'bkash' | 'nagad' | 'card';
    if (!['bkash', 'nagad', 'card'].includes(gateway)) {
      res.status(400).json({ success: false, error: 'Unsupported gateway' });
      return;
    }

    const rawBody = JSON.stringify(req.body);
    const sig = req.headers['x-webhook-signature'] as string | undefined;
    const verified = verifyWebhookSignature({ gateway, rawBody, signatureHeader: sig });
    if (!verified) {
      res.status(401).json({ success: false, error: 'Invalid or missing webhook signature' });
      return;
    }

    const result = await processVerifiedPaymentWebhook({
      gatewayTransactionId: String(req.body.gatewayTransactionId || ''),
      webhookEventId: String(req.body.eventId || ''),
      status: req.body.status === 'verified' ? 'verified' : 'failed',
      paidAmount: Number(req.body.amount || 0),
      providerPayload: req.body,
    });

    res.json({ success: true, deduplicated: result.deduplicated });
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'Webhook failed' });
  }
});

export default router;
