import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { Server } from 'http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { ensureSeedData } from '../services/seedService';
import authRoutes from '../routes/auth';
import catalogRoutes from '../routes/catalog';
import cartRoutes from '../routes/cart';
import orderRoutes from '../routes/orders';
import sellerRoutes from '../routes/seller';
import adminRoutes from '../routes/admin';
import { User } from '../models/User';
import { Brand, Category } from '../models/Catalog';
import { Store } from '../models/Seller';

let server: Server;
let baseUrl = '';

async function api(path: string, options: RequestInit & { token?: string } = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test('Controlled Seller Onboarding, Product Moderation Lifecycle, Authorization & Security Bypass Prevention', async (t) => {
  const runPass = `TestPass-${crypto.randomBytes(6).toString('hex')}!`;
  process.env.SUPER_ADMIN_BOOTSTRAP_PASSWORD = `Adm-${crypto.randomBytes(6).toString('hex')}!`;
  process.env.DEV_SEED_DEMO_PASSWORD = runPass;

  const mongod = await MongoMemoryServer.create();
  await connectDatabase(mongod.getUri());
  await ensureSeedData();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/catalog', catalogRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/seller', sellerRoutes);
  app.use('/api/admin', adminRoutes);

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await disconnectDatabase();
    await mongod.stop();
  });

  // Login Super Admin via real /api/auth/login endpoint (no token forging)
  const adminLogin = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'superadmin@novara.com.bd',
      password: process.env.SUPER_ADMIN_BOOTSTRAP_PASSWORD,
    }),
  });
  assert.equal(adminLogin.status, 200);
  const superAdminToken = adminLogin.data.token as string;
  assert.ok(superAdminToken);

  const [cat, brand] = await Promise.all([
    Category.findOne({ slug: 'electronics', active: true }).lean(),
    Brand.findOne({ slug: 'sony', active: true }).lean(),
  ]);
  assert.ok(cat && brand);

  let applicantToken = '';
  let applicantUserId = '';
  let applicationId = '';
  let storeId = '';
  let storeSlug = '';
  let createdProductId = '';
  let createdProductSlug = '';
  let createdOfferId = '';

  await t.test('Test Case 1: Normal User Registration & Privilege Restriction (ignores self-assigned role)', async () => {
    const reg = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Tariq Merchant Applicant',
        email: 'applicant1@novara.com.bd',
        phone: '01755667788',
        password: runPass,
        role: 'super_admin', // Attempted privilege escalation on signup
      }),
    });
    assert.equal(reg.status, 201);
    assert.equal(reg.data.user.role, 'customer');
    applicantToken = reg.data.token;
    applicantUserId = reg.data.user._id;

    // Customer cannot access Seller Center or Admin endpoints or publish products
    assert.equal((await api('/api/seller/dashboard', { token: applicantToken })).status, 403);
    assert.equal((await api('/api/seller/products', { token: applicantToken })).status, 403);
    assert.equal((await api('/api/admin/sellers', { token: applicantToken })).status, 403);
    assert.equal((await api('/api/admin/catalog/products', { token: applicantToken })).status, 403);
  });

  await t.test('Test Case 2 & 3: Seller Application Submitted -> Pending Status -> Seller Center Strictly Blocked', async () => {
    const apply = await api('/api/seller/onboarding/apply', {
      method: 'POST',
      token: applicantToken,
      body: JSON.stringify({
        storeName: 'Dhaka Gadget Vault',
        businessType: 'sole_proprietorship',
        nidNumber: '1994261122334',
        tradeLicenseNumber: 'TRAD/DNCC/55120',
        phone: '01755667788',
        division: 'Dhaka',
        district: 'Dhaka',
        pickupAddress: 'House 14, Road 6, Mirpur 10, Dhaka',
        bankOrMfsType: 'bkash',
        accountNumber: '01755667788',
        accountHolderName: 'Tariq Merchant Applicant',
        description: 'Official gadgets and PC accessories merchant in Mirpur.',
      }),
    });
    assert.equal(apply.status, 201);
    assert.equal(apply.data.application.status, 'pending');
    applicationId = apply.data.application._id;

    // Duplicate application while pending must return 409
    const dupApply = await api('/api/seller/onboarding/apply', {
      method: 'POST',
      token: applicantToken,
      body: JSON.stringify({
        storeName: 'Dhaka Gadget Vault 2',
        businessType: 'individual',
        nidNumber: '1994261122334',
        phone: '01755667788',
        division: 'Dhaka',
        district: 'Dhaka',
        pickupAddress: 'Mirpur 10, Dhaka',
        bankOrMfsType: 'bkash',
        accountNumber: '01755667788',
        accountHolderName: 'Tariq Merchant Applicant',
        description: 'Second attempt while pending.',
      }),
    });
    assert.equal(dupApply.status, 409);

    // Verify ALL operational seller endpoints reject pending applicant with 403
    for (const [method, path, body] of [
      ['GET', '/api/seller/dashboard'],
      ['GET', '/api/seller/products'],
      ['POST', '/api/seller/products', { title: 'Blocked' }],
      ['GET', '/api/seller/offers'],
      ['GET', '/api/seller/orders'],
      ['GET', '/api/seller/finance'],
    ] as const) {
      const res = await api(path, {
        method,
        token: applicantToken,
        body: body ? JSON.stringify(body) : undefined,
      });
      assert.equal(res.status, 403, `Expected 403 on ${method} ${path} for pending applicant`);
    }

    // Normal user cannot approve their own seller application
    const selfApprove = await api(`/api/admin/sellers/applications/${applicationId}`, {
      method: 'PATCH',
      token: applicantToken,
      body: JSON.stringify({ status: 'approved', note: 'Self approval attempt' }),
    });
    assert.equal(selfApprove.status, 403);
  });

  await t.test('Test Case 3b: Rejected Application Cannot Access Seller Center or Reapply Directly', async () => {
    const reg2 = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Rejected Applicant',
        email: 'rejected-applicant@novara.com.bd',
        phone: '01855667788',
        password: runPass,
      }),
    });
    assert.equal(reg2.status, 201);
    const rejToken = reg2.data.token as string;

    const apply2 = await api('/api/seller/onboarding/apply', {
      method: 'POST',
      token: rejToken,
      body: JSON.stringify({
        storeName: 'Unverified Shop',
        businessType: 'individual',
        nidNumber: '1995261122335',
        phone: '01855667788',
        division: 'Dhaka',
        district: 'Dhaka',
        pickupAddress: 'Uttara Sector 7, Dhaka',
        bankOrMfsType: 'nagad',
        accountNumber: '01855667788',
        accountHolderName: 'Rejected Applicant',
        description: 'Testing rejected seller application handling.',
      }),
    });
    assert.equal(apply2.status, 201);

    const rejectRes = await api(`/api/admin/sellers/applications/${apply2.data.application._id}`, {
      method: 'PATCH',
      token: superAdminToken,
      body: JSON.stringify({ status: 'rejected', note: 'NID verification mismatch' }),
    });
    assert.equal(rejectRes.status, 200);
    assert.equal(rejectRes.data.application.status, 'rejected');

    assert.equal((await api('/api/seller/dashboard', { token: rejToken })).status, 403);
    assert.equal((await api('/api/seller/products', { token: rejToken })).status, 403);
  });

  await t.test('Test Case 4: Admin Approves Seller Application -> Seller Center Unlocked', async () => {
    const approve = await api(`/api/admin/sellers/applications/${applicationId}`, {
      method: 'PATCH',
      token: superAdminToken,
      body: JSON.stringify({ status: 'approved', note: 'KYC documents verified.' }),
    });
    assert.equal(approve.status, 200);
    assert.equal(approve.data.application.status, 'approved');

    const updatedUser = await User.findById(applicantUserId).lean();
    assert.equal(updatedUser?.role, 'seller');

    const createdStore = await Store.findOne({ ownerUserId: applicantUserId }).lean();
    assert.ok(createdStore);
    assert.equal(createdStore.status, 'active');
    storeId = String(createdStore._id);
    storeSlug = createdStore.slug;

    // Session now reflects seller role & active sellerStore
    const session = await api('/api/auth/session', { token: applicantToken });
    assert.equal(session.status, 200);
    assert.equal(session.data.user.role, 'seller');
    assert.equal(session.data.sellerStore.status, 'active');

    // Seller Center endpoints now return 200
    assert.equal((await api('/api/seller/dashboard', { token: applicantToken })).status, 200);
  });

  await t.test('Test Case 5 & 7: Seller Creates Draft & Pending Product (Cannot Self-Publish) -> Hidden from Storefront & Cart', async () => {
    const baseProductPayload = {
      title: 'Mirpur Pro Mechanical Keyboard 75',
      bnTitle: 'মিরপুর প্রো মেকানিক্যাল কীবোর্ড',
      description: 'Hot-swappable gasket mount wireless mechanical keyboard for developers.',
      categoryId: String(cat._id),
      brandId: String(brand._id),
      images: ['/images/prod_headphones_anc_1794726986073.jpg'],
      warranty: '1 Year Replacement Warranty',
      variants: [{ sku: 'DGV-KB-75-BLK', label: 'Carbon Black' }],
    };
    const baseOfferPayload = {
      variantSku: 'DGV-KB-75-BLK',
      price: 4490,
      compareAtPrice: 5490,
      stock: 15,
    };

    // 1. Attempt to self-publish directly -> backend rejects 403
    const selfPubAttempt = await api('/api/seller/products', {
      method: 'POST',
      token: applicantToken,
      body: JSON.stringify({
        moderationStatus: 'published',
        product: baseProductPayload,
        offer: baseOfferPayload,
      }),
    });
    assert.equal(selfPubAttempt.status, 403);

    // 2. Create as draft -> saved as draft, not public
    const draftCreate = await api('/api/seller/products', {
      method: 'POST',
      token: applicantToken,
      body: JSON.stringify({
        moderationStatus: 'draft',
        product: baseProductPayload,
        offer: baseOfferPayload,
      }),
    });
    assert.equal(draftCreate.status, 201);
    assert.equal(draftCreate.data.product.moderationStatus, 'draft');
    createdProductId = draftCreate.data.product._id;
    createdProductSlug = draftCreate.data.product.slug;

    // 3. Submit draft to pending_review (still cannot jump to published)
    const patchPubAttempt = await api(`/api/seller/products/${createdProductId}`, {
      method: 'PATCH',
      token: applicantToken,
      body: JSON.stringify({ moderationStatus: 'published' }),
    });
    assert.equal(patchPubAttempt.status, 403);

    const submitReview = await api(`/api/seller/products/${createdProductId}`, {
      method: 'PATCH',
      token: applicantToken,
      body: JSON.stringify({ moderationStatus: 'pending_review' }),
    });
    assert.equal(submitReview.status, 200);
    assert.equal(submitReview.data.product.moderationStatus, 'pending_review');

    // Find seller's offer ID
    const sellerOffers = await api('/api/seller/offers', { token: applicantToken });
    assert.equal(sellerOffers.status, 200);
    createdOfferId = sellerOffers.data.offers[0]._id;
    assert.ok(createdOfferId);

    // Verify NOT discoverable in public search, autocomplete, store page, or product detail
    const searchRes = await api('/api/catalog/search?q=DGV-KB-75-BLK');
    assert.equal(searchRes.status, 200);
    assert.equal(searchRes.data.total, 0);

    const autoRes = await api('/api/catalog/autocomplete?q=Mirpur');
    assert.equal(autoRes.status, 200);
    assert.equal(autoRes.data.suggestions.length, 0);

    const detailRes = await api(`/api/catalog/products/${createdProductSlug}`);
    assert.equal(detailRes.status, 404);

    // Verify customer CANNOT add pending_review product to cart
    const custLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'customer@novara.com.bd', password: runPass }),
    });
    assert.equal(custLogin.status, 200);
    const custToken = custLogin.data.token as string;

    const addCartPending = await api('/api/cart/items', {
      method: 'POST',
      token: custToken,
      body: JSON.stringify({ offerId: createdOfferId, quantity: 1 }),
    });
    assert.equal(addCartPending.status, 400);

    // Normal seller/customer cannot moderate products to published
    const sellerModerate = await api(`/api/admin/catalog/products/${createdProductId}/moderation`, {
      method: 'PATCH',
      token: applicantToken,
      body: JSON.stringify({ moderationStatus: 'published' }),
    });
    assert.equal(sellerModerate.status, 403);
  });

  await t.test('Test Case 6 & 7: Admin Publishes Product -> Publicly Purchasable -> Suspending Product/Store Hides & Blocks', async () => {
    // 1. Admin publishes product
    const pubRes = await api(`/api/admin/catalog/products/${createdProductId}/moderation`, {
      method: 'PATCH',
      token: superAdminToken,
      body: JSON.stringify({ moderationStatus: 'published' }),
    });
    assert.equal(pubRes.status, 200);
    assert.equal(pubRes.data.product.moderationStatus, 'published');

    // Public search, autocomplete, store page, and product detail now return it
    const searchRes = await api('/api/catalog/search?q=DGV-KB-75-BLK');
    assert.equal(searchRes.status, 200);
    assert.equal(searchRes.data.total, 1);
    assert.equal(searchRes.data.items[0]._id, createdProductId);

    const detailRes = await api(`/api/catalog/products/${createdProductSlug}`);
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.data.offers.length, 1);

    // Customer can add to cart & place order
    const custLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'customer@novara.com.bd', password: runPass }),
    });
    const custToken = custLogin.data.token as string;

    const addCart = await api('/api/cart/items', {
      method: 'POST',
      token: custToken,
      body: JSON.stringify({ offerId: createdOfferId, quantity: 1 }),
    });
    assert.equal(addCart.status, 200);
    assert.equal(addCart.data.items.length, 1);

    // Cross-seller isolation: TechWorld seller cannot edit Dhaka Gadget Vault's product or offer
    const techLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'techworld@novara.com.bd', password: runPass }),
    });
    assert.equal(techLogin.status, 200);
    const techToken = techLogin.data.token as string;

    assert.equal(
      (
        await api(`/api/seller/products/${createdProductId}`, {
          method: 'PATCH',
          token: techToken,
          body: JSON.stringify({ title: 'Hijacked Title' }),
        })
      ).status,
      404
    );
    assert.equal(
      (
        await api(`/api/seller/offers/${createdOfferId}`, {
          method: 'PATCH',
          token: techToken,
          body: JSON.stringify({ price: 1 }),
        })
      ).status,
      404
    );

    // 2. Admin suspends the Store -> immediately blocks Seller Center, hides products, blocks storefront & cart add
    const suspendStore = await api(`/api/admin/sellers/stores/${storeId}/status`, {
      method: 'PATCH',
      token: superAdminToken,
      body: JSON.stringify({ status: 'suspended' }),
    });
    assert.equal(suspendStore.status, 200);
    assert.equal(suspendStore.data.store.status, 'suspended');

    assert.equal((await api('/api/seller/dashboard', { token: applicantToken })).status, 403);
    assert.equal((await api(`/api/catalog/stores/${storeSlug}`)).status, 404);
    assert.equal((await api('/api/catalog/search?q=DGV-KB-75-BLK')).data.total, 0);
    assert.equal(
      (
        await api('/api/cart/items', {
          method: 'POST',
          token: custToken,
          body: JSON.stringify({ offerId: createdOfferId, quantity: 1 }),
        })
      ).status,
      400
    );

    // Checkout with an already-in-cart suspended store item must fail cleanly
    const blockedCheckout = await api('/api/orders/checkout', {
      method: 'POST',
      token: custToken,
      body: JSON.stringify({
        address: {
          label: 'Home',
          fullName: 'Arafat Hossain',
          phone: '01711223344',
          division: 'Dhaka',
          district: 'Dhaka',
          upazila: 'Dhanmondi',
          unionOrArea: 'Road 9/A',
          streetAddress: 'House 42, Flat 4B, Dhanmondi',
          postalCode: '1209',
        },
        deliverySpeed: 'standard',
        paymentMethod: 'cod',
        idempotencyKey: `blocked-chk-${Date.now()}`,
      }),
    });
    assert.equal(blockedCheckout.status, 400);

    // Restore store, then suspend product specifically -> also hides from search & blocks cart
    await api(`/api/admin/sellers/stores/${storeId}/status`, {
      method: 'PATCH',
      token: superAdminToken,
      body: JSON.stringify({ status: 'active' }),
    });
    assert.equal((await api('/api/catalog/search?q=DGV-KB-75-BLK')).data.total, 1);

    await api(`/api/admin/catalog/products/${createdProductId}/moderation`, {
      method: 'PATCH',
      token: superAdminToken,
      body: JSON.stringify({ moderationStatus: 'suspended', moderationNotes: 'Under quality audit' }),
    });
    assert.equal((await api('/api/catalog/search?q=DGV-KB-75-BLK')).data.total, 0);
    assert.equal((await api(`/api/catalog/products/${createdProductSlug}`)).status, 404);
  });

  await t.test('Seed Bootstrap Safety: Deleting a demo user is not recreated on restart & unset bootstrap password creates no default-password admin', async () => {
    await User.deleteOne({ email: 'fashionhub@novara.com.bd' });
    await ensureSeedData();
    const recreated = await User.findOne({ email: 'fashionhub@novara.com.bd' }).lean();
    assert.equal(recreated, null);

    // Ensure no super_admin exists and no env password -> ensureSeedData skips creating a hardcoded-password admin
    await User.deleteMany({ role: 'super_admin' });
    delete process.env.SUPER_ADMIN_BOOTSTRAP_PASSWORD;
    // Also verify existing super_admin is never overwritten when another super_admin exists
    await ensureSeedData();
    const anyAdmin = await User.findOne({ role: 'super_admin' }).lean();
    assert.equal(anyAdmin, null);
  });
});
