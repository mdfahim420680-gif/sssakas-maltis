import { Router } from 'express';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { Cart } from '../models/Order';
import { SellerOffer } from '../models/Catalog';
import { buildCartQuoteFromServer } from '../services/orderService';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user!._id }).lean();
    const lines = (cart?.items || []).map((i) => ({
      offerId: String(i.offerId),
      quantity: i.quantity,
    }));
    const hydrated = await buildCartQuoteFromServer({ items: lines });
    res.json({ success: true, ...hydrated });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to load cart' });
  }
});

router.post('/items', requireAuth, async (req: AuthRequest, res) => {
  try {
    const offerId = String(req.body.offerId || '');
    const quantity = Math.max(1, Math.floor(Number(req.body.quantity || 1)));

    const offer = await SellerOffer.findById(offerId).populate('productId').populate('storeId');
    if (!offer || !offer.isActive) {
      res.status(404).json({ success: false, error: 'Seller offer unavailable' });
      return;
    }
    const product = offer.productId as any;
    const store = offer.storeId as any;
    if (!product || product.moderationStatus !== 'published' || !store || store.status !== 'active') {
      res.status(400).json({ success: false, error: 'Product or seller is not currently active' });
      return;
    }
    if (offer.stock < 1) {
      res.status(400).json({ success: false, error: 'Item is out of stock' });
      return;
    }

    let cart = await Cart.findOne({ userId: req.user!._id });
    if (!cart) {
      cart = await Cart.create({ userId: req.user!._id, items: [] });
    }

    const existing = cart.items.find((i) => String(i.offerId) === offerId);
    const maxAllowed = Math.min(offer.stock, offer.maxPurchaseQty || 5);
    if (existing) {
      existing.quantity = Math.min(maxAllowed, existing.quantity + quantity);
    } else {
      cart.items.push({
        offerId: offer._id,
        productId: product._id,
        storeId: store._id,
        variantSku: offer.variantSku,
        quantity: Math.min(maxAllowed, quantity),
        addedAt: new Date(),
      });
    }
    await cart.save();

    const hydrated = await buildCartQuoteFromServer({
      items: cart.items.map((i) => ({ offerId: String(i.offerId), quantity: i.quantity })),
    });
    res.json({ success: true, ...hydrated });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to add to cart' });
  }
});

router.patch('/items/:offerId', requireAuth, async (req: AuthRequest, res) => {
  const quantity = Math.floor(Number(req.body.quantity || 1));
  const cart = await Cart.findOne({ userId: req.user!._id });
  if (!cart) {
    res.status(404).json({ success: false, error: 'Cart not found' });
    return;
  }

  if (quantity <= 0) {
    cart.items = cart.items.filter((i) => String(i.offerId) !== req.params.offerId);
  } else {
    const offer = await SellerOffer.findById(req.params.offerId).populate('productId').populate('storeId');
    if (!offer || !offer.isActive) {
      res.status(404).json({ success: false, error: 'Offer not found' });
      return;
    }
    const product = offer.productId as any;
    const store = offer.storeId as any;
    if (!product || product.moderationStatus !== 'published' || !store || store.status !== 'active') {
      res.status(400).json({ success: false, error: 'Product or seller is not currently active' });
      return;
    }
    const maxAllowed = Math.min(offer.stock, offer.maxPurchaseQty || 5);
    const target = cart.items.find((i) => String(i.offerId) === req.params.offerId);
    if (target) {
      target.quantity = Math.max(1, Math.min(maxAllowed, quantity));
    }
  }

  await cart.save();
  const hydrated = await buildCartQuoteFromServer({
    items: cart.items.map((i) => ({ offerId: String(i.offerId), quantity: i.quantity })),
  });
  res.json({ success: true, ...hydrated });
});

router.delete('/items/:offerId', requireAuth, async (req: AuthRequest, res) => {
  const cart = await Cart.findOne({ userId: req.user!._id });
  if (cart) {
    cart.items = cart.items.filter((i) => String(i.offerId) !== req.params.offerId);
    await cart.save();
  }
  const hydrated = await buildCartQuoteFromServer({
    items: (cart?.items || []).map((i) => ({ offerId: String(i.offerId), quantity: i.quantity })),
  });
  res.json({ success: true, ...hydrated });
});

router.post('/merge', requireAuth, async (req: AuthRequest, res) => {
  const guestItems = Array.isArray(req.body.items) ? req.body.items : [];
  let cart = await Cart.findOne({ userId: req.user!._id });
  if (!cart) cart = await Cart.create({ userId: req.user!._id, items: [] });

  for (const g of guestItems) {
    const offerId = String(g.offerId || '');
    const qty = Math.max(1, Math.floor(Number(g.quantity || 1)));
    const offer = await SellerOffer.findById(offerId).populate('productId').populate('storeId');
    if (!offer || !offer.isActive || offer.stock <= 0) continue;
    const product = offer.productId as any;
    const store = offer.storeId as any;
    if (!product || product.moderationStatus !== 'published' || !store || store.status !== 'active') continue;

    const maxAllowed = Math.min(offer.stock, offer.maxPurchaseQty || 5);
    const existing = cart.items.find((i) => String(i.offerId) === offerId);
    if (existing) {
      existing.quantity = Math.min(maxAllowed, Math.max(existing.quantity, qty));
    } else {
      cart.items.push({
        offerId: offer._id,
        productId: product._id,
        storeId: store._id,
        variantSku: offer.variantSku,
        quantity: Math.min(maxAllowed, qty),
        addedAt: new Date(),
      });
    }
  }

  await cart.save();
  const hydrated = await buildCartQuoteFromServer({
    items: cart.items.map((i) => ({ offerId: String(i.offerId), quantity: i.quantity })),
  });
  res.json({ success: true, ...hydrated });
});

router.post('/quote', async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const hydrated = await buildCartQuoteFromServer({
      items,
      division: req.body.division,
      district: req.body.district,
      upazila: req.body.upazila,
      deliverySpeed: req.body.deliverySpeed === 'express' ? 'express' : 'standard',
      couponCode: typeof req.body.couponCode === 'string' ? req.body.couponCode : undefined,
    });
    res.json({ success: true, ...hydrated });
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'Quote failed' });
  }
});

export default router;
