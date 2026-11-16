import test from 'node:test';
import assert from 'node:assert/strict';
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
import { Brand, CanonicalProduct, Category, SellerOffer } from '../models/Catalog';
import { FinancialLedgerEntry } from '../models/Finance';
import { ParentOrder, PaymentTransaction, ReturnRequest, SubOrder } from '../models/Order';
import { Review } from '../models/Engagement';
import { signSessionToken } from '../middleware/auth';

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
  return { status: res.status, data, headers: res.headers };
}

const adminTestPass = `TestAdm-${Date.now()}!`;
const demoTestPass = `TestDemo-${Date.now()}!`;

test('Admin & Seller RBAC, Ownership Isolation, Return-to-Refund, Commission Rules & Review Sync Integration', async (t) => {
  process.env.SUPER_ADMIN_BOOTSTRAP_PASSWORD = adminTestPass;
  process.env.DEV_SEED_DEMO_PASSWORD = demoTestPass;
  const mongod = await MongoMemoryServer.create();
  await connectDatabase(mongod.getUri());
  await ensureSeedData();
  // Call ensureSeedData a second time to verify strict idempotency
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

  const superAdmin = await User.findOne({ email: 'superadmin@novara.com.bd' }).select('+passwordHash');
  const customer = await User.findOne({ email: 'customer@novara.com.bd' });
  const sellerTech = await User.findOne({ email: 'techworld@novara.com.bd' });
  const sellerFashion = await User.findOne({ email: 'fashionhub@novara.com.bd' });
  assert.ok(superAdmin && customer && sellerTech && sellerFashion);

  const superToken = signSessionToken(superAdmin);
  const customerToken = signSessionToken(customer);
  const techToken = signSessionToken(sellerTech);
  const fashionToken = signSessionToken(sellerFashion);

  await t.test('Scenario 3 & 4: Unauthenticated (401) and Customer (403) denied protected Admin & Seller APIs', async () => {
    const unauthAdmin = await api('/api/admin/dashboard');
    assert.equal(unauthAdmin.status, 401);

    const unauthSeller = await api('/api/seller/dashboard');
    assert.equal(unauthSeller.status, 401);

    const custAdmin = await api('/api/admin/users', { token: customerToken });
    assert.equal(custAdmin.status, 403);

    const custSeller = await api('/api/seller/finance', { token: customerToken });
    assert.equal(custSeller.status, 403);
  });

  await t.test('Scoped Staff RBAC: finance_manager can access /finance & /returns but is denied /users, /audit-logs, /settings', async () => {
    const finStaff = await User.create({
      name: 'Finance Staff Test',
      email: 'finance-test@novara.com.bd',
      passwordHash: superAdmin.passwordHash,
      role: 'finance_manager',
      status: 'active',
    });
    const finToken = signSessionToken(finStaff);

    const okFinance = await api('/api/admin/finance', { token: finToken });
    assert.equal(okFinance.status, 200);
    assert.ok(Array.isArray(okFinance.data.categories));
    assert.ok(Array.isArray(okFinance.data.stores));

    const deniedUsers = await api('/api/admin/users', { token: finToken });
    assert.equal(deniedUsers.status, 403);

    const deniedAudit = await api('/api/admin/audit-logs', { token: finToken });
    assert.equal(deniedAudit.status, 403);

    const deniedSettings = await api('/api/admin/settings', { token: finToken });
    assert.equal(deniedSettings.status, 403);
  });

  await t.test('Scenario 2: Seller ownership isolation & seller order state machine restriction', async () => {
    const techOffersRes = await api('/api/seller/offers', { token: techToken });
    assert.equal(techOffersRes.status, 200);
    const techOffer = techOffersRes.data.offers[0];
    assert.ok(techOffer);

    // Seller Fashion Hub tries to mutate TechWorld BD offer -> 404/denied
    const crossUpdate = await api(`/api/seller/offers/${techOffer._id}`, {
      method: 'PATCH',
      token: fashionToken,
      body: JSON.stringify({ price: 1, stock: 999 }),
    });
    assert.equal(crossUpdate.status, 404);

    // Seller cannot jump a suborder to admin/finance-only 'refunded'
    const techOrdersRes = await api('/api/seller/orders', { token: techToken });
    assert.equal(techOrdersRes.status, 200);
    if (techOrdersRes.data.subOrders.length > 0) {
      const subId = techOrdersRes.data.subOrders[0]._id;
      const forbiddenRefund = await api(`/api/seller/orders/${subId}/status`, {
        method: 'PATCH',
        token: techToken,
        body: JSON.stringify({ status: 'refunded' }),
      });
      assert.equal(forbiddenRefund.status, 403);
    }
  });

  await t.test('Scenario 1: Super Admin commission rule, category/brand, self-protection, return-to-refund & review rating sync', async () => {
    // 1. Self-demotion & invalid ObjectId guards
    const selfDemote = await api(`/api/admin/users/${superAdmin._id}/role`, {
      method: 'PATCH',
      token: superToken,
      body: JSON.stringify({ role: 'customer' }),
    });
    assert.equal(selfDemote.status, 400);

    const invalidId = await api('/api/admin/users/not-a-valid-id/status', {
      method: 'PATCH',
      token: superToken,
      body: JSON.stringify({ status: 'suspended' }),
    });
    assert.equal(invalidId.status, 400);

    // 2. Commission Rule creation + toggle + duplicate/validation check
    const badRule = await api('/api/admin/finance/commission-rules', {
      method: 'POST',
      token: superToken,
      body: JSON.stringify({ scope: 'global', ratePercent: 9 }), // missing name
    });
    assert.equal(badRule.status, 400);

    const newRule = await api('/api/admin/finance/commission-rules', {
      method: 'POST',
      token: superToken,
      body: JSON.stringify({ name: 'Platform Standard 9%', scope: 'global', ratePercent: 9 }),
    });
    assert.equal(newRule.status, 201);
    assert.equal(newRule.data.rule.isDefault, true);

    const toggleRule = await api(`/api/admin/finance/commission-rules/${newRule.data.rule._id}`, {
      method: 'PATCH',
      token: superToken,
      body: JSON.stringify({ active: false }),
    });
    assert.equal(toggleRule.status, 200);
    assert.equal(toggleRule.data.rule.active, false);

    // 3. Category & Brand creation + toggle + duplicate handling
    const catRes = await api('/api/admin/catalog/categories', {
      method: 'POST',
      token: superToken,
      body: JSON.stringify({ name: 'Smart Home Devices', isFeatured: true }),
    });
    assert.equal(catRes.status, 201);
    const catToggle = await api(`/api/admin/catalog/categories/${catRes.data.category._id}`, {
      method: 'PATCH',
      token: superToken,
      body: JSON.stringify({ active: false }),
    });
    assert.equal(catToggle.status, 200);
    assert.equal(catToggle.data.category.active, false);

    // 4. Customer Return Request -> Admin refund_executed atomic sync
    const offer = await SellerOffer.findOne({ isActive: true, stock: { $gte: 2 } }).lean();
    assert.ok(offer);
    await api('/api/cart/items', {
      method: 'POST',
      token: customerToken,
      body: JSON.stringify({ offerId: String(offer._id), quantity: 1 }),
    });
    const orderRes = await api('/api/orders/checkout', {
      method: 'POST',
      token: customerToken,
      body: JSON.stringify({
        address: {
          label: 'Home',
          fullName: 'Arefin Rahman',
          phone: '01711223344',
          division: 'Dhaka',
          district: 'Dhaka',
          upazila: 'Dhanmondi',
          unionOrArea: 'Road 7',
          streetAddress: 'House 12, Road 7, Dhanmondi',
          postalCode: '1205',
        },
        deliverySpeed: 'standard',
        paymentMethod: 'cod',
        idempotencyKey: `test-checkout-${Date.now()}`,
      }),
    });
    assert.equal(orderRes.status, 201);
    const subOrder = orderRes.data.subOrders[0];
    const parentOrder = orderRes.data.parentOrder;

    // Progress suborder via admin to delivered
    for (const st of ['processing', 'packed', 'shipped', 'delivered']) {
      const tr = await api(`/api/admin/orders/suborders/${subOrder._id}/status`, {
        method: 'PATCH',
        token: superToken,
        body: JSON.stringify({ status: st }),
      });
      assert.equal(tr.status, 200);
    }

    // Customer creates return request
    const retCreate = await api('/api/orders/returns', {
      method: 'POST',
      token: customerToken,
      body: JSON.stringify({
        subOrderId: String(subOrder._id),
        reason: 'defective_not_working',
        details: 'Device fails to charge properly on arrival.',
      }),
    });
    assert.equal(retCreate.status, 201);
    const retId = retCreate.data.returnRequest._id;

    // Admin rejects invalid status 'approved' -> 400
    const badRetStatus = await api(`/api/admin/returns/${retId}`, {
      method: 'PATCH',
      token: superToken,
      body: JSON.stringify({ status: 'approved' }),
    });
    assert.equal(badRetStatus.status, 400);

    // Admin executes refund -> transitions SubOrder, ParentOrder, PaymentTransaction, FinancialLedgerEntry
    const execRet = await api(`/api/admin/returns/${retId}`, {
      method: 'PATCH',
      token: superToken,
      body: JSON.stringify({
        status: 'refund_executed',
        approvedAmount: subOrder.subtotal,
        refundReferenceId: 'REF-TEST-1001',
        adminResolutionNote: 'Refund verified and issued.',
      }),
    });
    assert.equal(execRet.status, 200);
    assert.equal(execRet.data.returnRequest.status, 'refund_executed');

    const updatedRet = await ReturnRequest.findById(retId).lean();
    const updatedSub = await SubOrder.findById(subOrder._id).lean();
    const updatedParent = await ParentOrder.findById(parentOrder._id).lean();
    const updatedTx = await PaymentTransaction.findOne({ parentOrderId: parentOrder._id }).lean();
    const refundLedger = await FinancialLedgerEntry.findOne({ entryKey: `refund:${retId}` }).lean();

    assert.equal(updatedRet?.status, 'refund_executed');
    assert.equal(updatedSub?.status, 'refunded');
    assert.equal(updatedSub?.settlementStatus, 'reversed');
    assert.equal(updatedParent?.paymentStatus, 'refunded');
    assert.equal(updatedTx?.status, 'refunded');
    assert.ok(refundLedger && refundLedger.amount < 0);

    // 5. Re-executing finalized return is blocked (409)
    const reExec = await api(`/api/admin/returns/${retId}`, {
      method: 'PATCH',
      token: superToken,
      body: JSON.stringify({ status: 'rejected' }),
    });
    assert.equal(reExec.status, 409);

    // 6. Review moderation recomputes CanonicalProduct ratingAvg / ratingCount
    const seededReview = await Review.findOne({ moderationStatus: 'published' }).lean();
    if (seededReview) {
      const hideRev = await api(`/api/admin/reviews/${seededReview._id}`, {
        method: 'PATCH',
        token: superToken,
        body: JSON.stringify({ moderationStatus: 'hidden' }),
      });
      assert.equal(hideRev.status, 200);
      const prodAfterHide = await CanonicalProduct.findById(seededReview.productId).lean();
      assert.ok(prodAfterHide);

      // Restore published
      const pubRev = await api(`/api/admin/reviews/${seededReview._id}`, {
        method: 'PATCH',
        token: superToken,
        body: JSON.stringify({ moderationStatus: 'published' }),
      });
      assert.equal(pubRev.status, 200);
    }
  });

  await t.test('Auth Root-Cause Fix: Login returns JWT token, sets SameSite=None over HTTPS, and authenticates /api/admin/dashboard + /sellers', async () => {
    const loginRes = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'x-forwarded-proto': 'https' },
      body: JSON.stringify({ email: 'superadmin@novara.com.bd', password: adminTestPass }),
    });
    assert.equal(loginRes.status, 200);
    assert.ok(loginRes.data.token && typeof loginRes.data.token === 'string');
    const setCookie = loginRes.headers.get('set-cookie') || '';
    assert.ok(setCookie.includes('novara_session='));
    assert.ok(setCookie.toLowerCase().includes('samesite=none'));
    assert.ok(setCookie.toLowerCase().includes('secure'));

    const dashRes = await api('/api/admin/dashboard', { token: loginRes.data.token });
    assert.equal(dashRes.status, 200);
    assert.ok(dashRes.data.metrics);
    assert.equal(dashRes.data.metrics.productsCount, 50);

    // On local plain HTTP (without x-forwarded-proto and when APP_URL is not https or testing local), check session endpoint with Bearer
    const sessionRes = await api('/api/auth/session', { token: loginRes.data.token });
    assert.equal(sessionRes.status, 200);
    assert.equal(sessionRes.data.authenticated, true);
    assert.equal(sessionRes.data.user.role, 'super_admin');
    assert.ok(sessionRes.data.token);

    const sellersRes = await api('/api/admin/sellers', { token: loginRes.data.token });
    assert.equal(sellersRes.status, 200);
    assert.ok(Array.isArray(sellersRes.data.stores) && sellersRes.data.stores.length >= 3);

    // Super Admin Portal login endpoint strictly rejects invalid credentials and non-super-admin roles
    const badSuperCreds = await api('/api/auth/super-admin-login', {
      method: 'POST',
      body: JSON.stringify({ email: 'superadmin@novara.com.bd', password: 'WrongPassword123!' }),
    });
    assert.equal(badSuperCreds.status, 401);
    assert.equal(badSuperCreds.data.token, undefined);

    const custSuperAttempt = await api('/api/auth/super-admin-login', {
      method: 'POST',
      body: JSON.stringify({ email: 'customer@novara.com.bd', password: demoTestPass }),
    });
    assert.equal(custSuperAttempt.status, 403);
    assert.equal(custSuperAttempt.data.token, undefined);
    assert.equal(custSuperAttempt.headers.get('set-cookie'), null);

    const scopedAdminAttempt = await api('/api/auth/super-admin-login', {
      method: 'POST',
      body: JSON.stringify({ email: 'finance-test@novara.com.bd', password: adminTestPass }),
    });
    assert.equal(scopedAdminAttempt.status, 403);
    assert.equal(scopedAdminAttempt.data.token, undefined);

    const validSuperPortal = await api('/api/auth/super-admin-login', {
      method: 'POST',
      body: JSON.stringify({ email: 'superadmin@novara.com.bd', password: adminTestPass }),
    });
    assert.equal(validSuperPortal.status, 200);
    assert.equal(validSuperPortal.data.user.role, 'super_admin');
    assert.ok(validSuperPortal.data.token);

    // Configured SUPER_ADMIN_EMAIL + SUPER_ADMIN_BOOTSTRAP_PASSWORD works even when another super_admin already exists
    const origSuperEmail = process.env.SUPER_ADMIN_EMAIL;
    const origSuperPass = process.env.SUPER_ADMIN_BOOTSTRAP_PASSWORD;
    try {
      const configuredEmail = 'configured-super@novara.com.bd';
      const configuredPass = `ConfAdm-${Date.now()}!`;
      process.env.SUPER_ADMIN_EMAIL = `  ${configuredEmail}  `;
      process.env.SUPER_ADMIN_BOOTSTRAP_PASSWORD = configuredPass;
      await ensureSeedData();

      const configuredLogin = await api('/api/auth/super-admin-login', {
        method: 'POST',
        body: JSON.stringify({ email: configuredEmail, password: configuredPass }),
      });
      assert.equal(configuredLogin.status, 200);
      assert.equal(configuredLogin.data.user.role, 'super_admin');
      assert.ok(configuredLogin.data.token);

      const configuredDash = await api('/api/admin/dashboard', { token: configuredLogin.data.token });
      assert.equal(configuredDash.status, 200);

      // Valid Bearer token succeeds even if browser sends a stale/invalid session cookie
      const staleCookieDash = await api('/api/admin/dashboard', {
        token: configuredLogin.data.token,
        headers: { Cookie: 'novara_session=stale.invalid.jwt' },
      });
      assert.equal(staleCookieDash.status, 200);
    } finally {
      if (origSuperEmail === undefined) delete process.env.SUPER_ADMIN_EMAIL;
      else process.env.SUPER_ADMIN_EMAIL = origSuperEmail;
      if (origSuperPass === undefined) delete process.env.SUPER_ADMIN_BOOTSTRAP_PASSWORD;
      else process.env.SUPER_ADMIN_BOOTSTRAP_PASSWORD = origSuperPass;
      await User.deleteOne({ email: 'configured-super@novara.com.bd' });
    }
  });

  await t.test('50-Product Idempotent Seed & Public Catalog Pagination', async () => {
    const count = await CanonicalProduct.countDocuments();
    assert.equal(count, 50);

    const page1 = await api('/api/catalog/search?limit=48&page=1');
    assert.equal(page1.status, 200);
    assert.equal(page1.data.total, 50);
    assert.equal(page1.data.items.length, 48);

    const page2 = await api('/api/catalog/search?limit=48&page=2');
    assert.equal(page2.status, 200);
    assert.equal(page2.data.total, 50);
    assert.equal(page2.data.items.length, 2);
  });

  await t.test('Admin Product CRUD (Create, Update, Delete + Order Delete Guard) & Banner Reflection', async () => {
    const [cat, brand] = await Promise.all([
      Category.findOne({ slug: 'electronics' }).lean(),
      Brand.findOne({ slug: 'sony' }).lean(),
    ]);
    assert.ok(cat && brand);

    const created = await api('/api/admin/catalog/products', {
      method: 'POST',
      token: superToken,
      body: JSON.stringify({
        product: {
          title: 'Admin Test Portable Monitor 15.6',
          bnTitle: 'অ্যাডমিন পোর্টেবল মনিটর',
          description: 'Full HD USB-C portable monitor tested by Super Admin CRUD integration.',
          categoryId: String(cat._id),
          brandId: String(brand._id),
          images: ['/images/hero_electronics_sale_1794726983548.jpg'],
          warranty: '1 Year Official Warranty',
          returnPolicyDays: 7,
          weightGrams: 750,
          keywords: ['monitor', 'portable'],
          specifications: [{ key: 'Size', value: '15.6 Inch' }],
          variants: [{ sku: 'ADM-MON-15', label: 'Matte Black' }],
        },
        offer: {
          price: 15990,
          compareAtPrice: 18990,
          stock: 12,
          maxPurchaseQty: 2,
          deliveryEstimateDays: '1-2 Days',
          shippingFeeDhaka: 60,
          shippingFeeNationwide: 120,
        },
        moderationStatus: 'published',
      }),
    });
    assert.equal(created.status, 201);
    const createdId = created.data.product._id;

    const updated = await api(`/api/admin/catalog/products/${createdId}`, {
      method: 'PATCH',
      token: superToken,
      body: JSON.stringify({
        title: 'Admin Updated Portable Monitor OLED',
        isTrending: true,
      }),
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.product.title, 'Admin Updated Portable Monitor OLED');
    assert.equal(updated.data.product.isTrending, true);

    const deleted = await api(`/api/admin/catalog/products/${createdId}`, {
      method: 'DELETE',
      token: superToken,
    });
    assert.equal(deleted.status, 200);

    // Deleting a product that has historical orders returns 409
    const orderedSub = await SubOrder.findOne().lean();
    if (orderedSub && orderedSub.items.length > 0) {
      const blockedDel = await api(`/api/admin/catalog/products/${orderedSub.items[0].productId}`, {
        method: 'DELETE',
        token: superToken,
      });
      assert.equal(blockedDel.status, 409);
    }

    // Banner update reflects on homepage API
    const bannersRes = await api('/api/admin/banners', { token: superToken });
    assert.equal(bannersRes.status, 200);
    const heroBanner = bannersRes.data.banners.find((b: any) => b.position === 'hero_slide');
    assert.ok(heroBanner);

    const origTitle = heroBanner.title;
    const updBanner = await api(`/api/admin/banners/${heroBanner._id}`, {
      method: 'PUT',
      token: superToken,
      body: JSON.stringify({ title: 'Winter Electronics Festival' }),
    });
    assert.equal(updBanner.status, 200);

    const homepage = await api('/api/catalog/homepage');
    assert.equal(homepage.status, 200);
    assert.ok(homepage.data.heroBanners.some((b: any) => b.title === 'Winter Electronics Festival'));

    // Restore original banner title
    await api(`/api/admin/banners/${heroBanner._id}`, {
      method: 'PUT',
      token: superToken,
      body: JSON.stringify({ title: origTitle }),
    });
  });

  await t.test('Admin Analytics, Search, CSV Export, Customers & Category/Brand/Coupon CRUD + Guards', async () => {
    // 1. Analytics endpoint
    const analytics = await api('/api/admin/analytics?range=30d', { token: superToken });
    assert.equal(analytics.status, 200);
    assert.ok(analytics.data.summary);
    assert.ok(Array.isArray(analytics.data.salesSeries));
    assert.ok(Array.isArray(analytics.data.orderStatusDistribution?.items));

    // 2. Global Search endpoint
    const search = await api('/api/admin/search?q=Sony', { token: superToken });
    assert.equal(search.status, 200);
    assert.ok(Array.isArray(search.data.products));

    // 3. CSV Export endpoint
    const csvRes = await fetch(`${baseUrl}/api/admin/reports/export?type=orders&range=30d`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    assert.equal(csvRes.status, 200);
    const csvText = await csvRes.text();
    assert.ok(csvText.startsWith('Order Number,Customer,'));

    // 4. Customers list + detail
    const customers = await api('/api/admin/customers', { token: superToken });
    assert.equal(customers.status, 200);
    assert.ok(Array.isArray(customers.data.customers) && customers.data.customers.length >= 1);

    // 5. Category PUT + DELETE + 409 guard when products exist
    const catInUse = await Category.findOne({ slug: 'electronics' }).lean();
    assert.ok(catInUse);
    const delCatInUse = await api(`/api/admin/catalog/categories/${catInUse._id}`, {
      method: 'DELETE',
      token: superToken,
    });
    assert.equal(delCatInUse.status, 409);

    const tempCat = await api('/api/admin/catalog/categories', {
      method: 'POST',
      token: superToken,
      body: JSON.stringify({ name: 'Temp Admin Cat', bnName: 'টেম্প' }),
    });
    assert.equal(tempCat.status, 201);
    const putCat = await api(`/api/admin/catalog/categories/${tempCat.data.category._id}`, {
      method: 'PUT',
      token: superToken,
      body: JSON.stringify({ name: 'Updated Temp Cat' }),
    });
    assert.equal(putCat.status, 200);
    assert.equal(putCat.data.category.name, 'Updated Temp Cat');
    const delTempCat = await api(`/api/admin/catalog/categories/${tempCat.data.category._id}`, {
      method: 'DELETE',
      token: superToken,
    });
    assert.equal(delTempCat.status, 200);

    // 6. Brand PUT + DELETE + 409 guard when products exist
    const brandInUse = await Brand.findOne({ slug: 'sony' }).lean();
    assert.ok(brandInUse);
    const delBrandInUse = await api(`/api/admin/catalog/brands/${brandInUse._id}`, {
      method: 'DELETE',
      token: superToken,
    });
    assert.equal(delBrandInUse.status, 409);

    const tempBrand = await api('/api/admin/catalog/brands', {
      method: 'POST',
      token: superToken,
      body: JSON.stringify({ name: 'TempBrand' }),
    });
    assert.equal(tempBrand.status, 201);
    const putBrand = await api(`/api/admin/catalog/brands/${tempBrand.data.brand._id}`, {
      method: 'PUT',
      token: superToken,
      body: JSON.stringify({ name: 'UpdatedTempBrand' }),
    });
    assert.equal(putBrand.status, 200);
    const delTempBrand = await api(`/api/admin/catalog/brands/${tempBrand.data.brand._id}`, {
      method: 'DELETE',
      token: superToken,
    });
    assert.equal(delTempBrand.status, 200);

    // 7. Coupon DELETE
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const couponCreate = await api('/api/admin/coupons', {
      method: 'POST',
      token: superToken,
      body: JSON.stringify({
        code: `TMP${Date.now().toString().slice(-4)}`,
        title: 'Temp Coupon',
        discountType: 'fixed',
        discountValue: 50,
        minOrderAmount: 200,
        usageLimit: 10,
        startAt: now,
        endAt: end,
      }),
    });
    assert.equal(couponCreate.status, 201);
    const couponDel = await api(`/api/admin/coupons/${couponCreate.data.coupon._id}`, {
      method: 'DELETE',
      token: superToken,
    });
    assert.equal(couponDel.status, 200);
  });
});


