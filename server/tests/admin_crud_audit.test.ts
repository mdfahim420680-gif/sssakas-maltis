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
import adminRoutes from '../routes/admin';
import { User } from '../models/User';
import { Brand, CanonicalProduct, Category, SellerOffer } from '../models/Catalog';
import { Advertisement, Banner, CmsSection, Coupon, PlatformSettings, Promotion, SearchMapping } from '../models/Cms';
import { Store } from '../models/Seller';
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
  return { status: res.status, data };
}

const adminPass = `CrudAdm-${Date.now()}!`;
const demoPass = `CrudDemo-${Date.now()}!`;

test('Admin CRUD Data Integrity, Clearing Optional Fields, Partial Updates & Delete Guards', async (t) => {
  process.env.SUPER_ADMIN_BOOTSTRAP_PASSWORD = adminPass;
  process.env.DEV_SEED_DEMO_PASSWORD = demoPass;

  const mongod = await MongoMemoryServer.create();
  await connectDatabase(mongod.getUri());
  await ensureSeedData();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/catalog', catalogRoutes);
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

  const superAdmin = await User.findOne({ email: 'superadmin@novara.com.bd' });
  assert.ok(superAdmin);
  const token = signSessionToken(superAdmin);

  await t.test('Banner & Hero Slide: partial toggle preserves fields & clearing dates/campaign persists', async () => {
    const createRes = await api('/api/admin/banners', {
      method: 'POST',
      token,
      body: JSON.stringify({
        position: 'promo_trio',
        campaignName: 'Eid Mega Deals',
        title: 'Smartphones Under 30K',
        subtitle: 'Verified official warranty',
        highlightText: 'SAVE 25%',
        ctaText: 'Explore Deals',
        linkUrl: '/category/electronics',
        imageUrl: '/images/hero_electronics_sale_1794726983548.jpg',
        gradientTheme: 'sky',
        displayOrder: 2,
        active: true,
        startDate: '2026-11-01',
        endDate: '2026-12-01',
        styleConfig: {
          backgroundMode: 'image_gradient_overlay',
          textColor: '#FFFFFF',
          borderRadius: 20,
        },
      }),
    });
    assert.equal(createRes.status, 201);
    const bannerId = createRes.data.banner._id;

    // Bug 1 Regression Check: partial update { active: false } MUST NOT wipe title, ctaText, linkUrl, imageUrl
    const toggleRes = await api(`/api/admin/banners/${bannerId}`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ active: false }),
    });
    assert.equal(toggleRes.status, 200);
    assert.equal(toggleRes.data.banner.active, false);
    assert.equal(toggleRes.data.banner.title, 'Smartphones Under 30K');
    assert.equal(toggleRes.data.banner.ctaText, 'Explore Deals');
    assert.equal(toggleRes.data.banner.linkUrl, '/category/electronics');
    assert.equal(toggleRes.data.banner.imageUrl, '/images/hero_electronics_sale_1794726983548.jpg');
    assert.equal(toggleRes.data.banner.campaignName, 'Eid Mega Deals');

    // Bug 2 Regression Check: clearing schedule dates and campaignName persists
    const clearRes = await api(`/api/admin/banners/${bannerId}`, {
      method: 'PUT',
      token,
      body: JSON.stringify({
        campaignName: '',
        startDate: null,
        endDate: null,
        title: 'Updated Banner Title',
      }),
    });
    assert.equal(clearRes.status, 200);
    const dbBanner = await Banner.findById(bannerId).lean();
    assert.ok(dbBanner);
    assert.equal(dbBanner.title, 'Updated Banner Title');
    assert.equal(dbBanner.campaignName, '');
    assert.equal(dbBanner.startDate, undefined);
    assert.equal(dbBanner.endDate, undefined);

    const delRes = await api(`/api/admin/banners/${bannerId}`, { method: 'DELETE', token });
    assert.equal(delRes.status, 200);
    assert.equal(await Banner.findById(bannerId), null);
  });

  await t.test('Advertisements: create, clear mediaUrl/targets/dates, delete', async () => {
    const product = await CanonicalProduct.findOne().lean();
    assert.ok(product);

    const createRes = await api('/api/admin/ads', {
      method: 'POST',
      token,
      body: JSON.stringify({
        name: 'Audio Spotlight',
        campaign: 'Winter Tech',
        adType: 'sponsored_product',
        placement: 'homepage_section',
        mediaUrl: '/images/prod_headphones_anc_1794726986073.jpg',
        destinationLink: `/product/${product.slug}`,
        targetProductId: String(product._id),
        priority: 10,
        startAt: '2026-11-10',
        endAt: '2026-12-15',
        active: true,
      }),
    });
    assert.equal(createRes.status, 201);
    const adId = createRes.data.ad._id;

    // Switch to internal_banner and clear mediaUrl, targetProductId, dates
    const updateRes = await api(`/api/admin/ads/${adId}`, {
      method: 'PUT',
      token,
      body: JSON.stringify({
        name: 'Audio Spotlight Updated',
        campaign: 'Winter Tech V2',
        adType: 'internal_banner',
        placement: 'search_results',
        mediaUrl: '',
        destinationLink: '/search?q=audio',
        targetProductId: null,
        targetStoreId: null,
        priority: 5,
        startAt: null,
        endAt: null,
        active: false,
      }),
    });
    assert.equal(updateRes.status, 200);
    const dbAd = await Advertisement.findById(adId).lean();
    assert.ok(dbAd);
    assert.equal(dbAd.name, 'Audio Spotlight Updated');
    assert.equal(dbAd.mediaUrl, '');
    assert.equal(dbAd.targetProductId, undefined);
    assert.equal(dbAd.startAt, undefined);
    assert.equal(dbAd.endAt, undefined);
    assert.equal(dbAd.active, false);

    const delRes = await api(`/api/admin/ads/${adId}`, { method: 'DELETE', token });
    assert.equal(delRes.status, 200);
    assert.equal(await Advertisement.findById(adId), null);
  });

  await t.test('Categories & Brands: create, edit & clear images/description, delete & dependency guard', async () => {
    const catRes = await api('/api/admin/catalog/categories', {
      method: 'POST',
      token,
      body: JSON.stringify({
        name: 'Gaming Gear Test',
        bnName: 'গেমিং',
        description: 'Controllers and headsets',
        imageUrl: '/images/prod_headphones_anc_1794726986073.jpg',
        iconName: 'Gamepad2',
        displayOrder: 9,
        isFeatured: true,
        active: true,
      }),
    });
    assert.equal(catRes.status, 201);
    const catId = catRes.data.category._id;

    const catEdit = await api(`/api/admin/catalog/categories/${catId}`, {
      method: 'PUT',
      token,
      body: JSON.stringify({
        name: 'Gaming Gear Renamed',
        bnName: 'গেমিং প্রো',
        description: '',
        imageUrl: '',
        isFeatured: false,
        active: true,
      }),
    });
    assert.equal(catEdit.status, 200);
    const dbCat = await Category.findById(catId).lean();
    assert.ok(dbCat);
    assert.equal(dbCat.name, 'Gaming Gear Renamed');
    assert.equal(dbCat.description, '');
    assert.equal(dbCat.imageUrl, '');

    const brandRes = await api('/api/admin/catalog/brands', {
      method: 'POST',
      token,
      body: JSON.stringify({
        name: 'NovaSound Test',
        logoText: 'NOVASOUND',
        logoUrl: '/images/prod_earbuds_pro_1794726984024.jpg',
        displayOrder: 7,
        isPopular: true,
        active: true,
      }),
    });
    assert.equal(brandRes.status, 201);
    const brandId = brandRes.data.brand._id;

    const brandEdit = await api(`/api/admin/catalog/brands/${brandId}`, {
      method: 'PUT',
      token,
      body: JSON.stringify({
        name: 'NovaSound Audio',
        logoText: 'NOVASOUND',
        logoUrl: '',
        isPopular: false,
        active: true,
      }),
    });
    assert.equal(brandEdit.status, 200);
    const dbBrand = await Brand.findById(brandId).lean();
    assert.ok(dbBrand);
    assert.equal(dbBrand.name, 'NovaSound Audio');
    assert.equal(dbBrand.logoUrl, '');

    const catDel = await api(`/api/admin/catalog/categories/${catId}`, { method: 'DELETE', token });
    assert.equal(catDel.status, 200);
    const brandDel = await api(`/api/admin/catalog/brands/${brandId}`, { method: 'DELETE', token });
    assert.equal(brandDel.status, 200);
  });

  await t.test('Product: create without offer -> edit creates offer & clears optional fields -> delete', async () => {
    const cat = await Category.findOne({ parentId: null }).lean();
    const brand = await Brand.findOne().lean();
    const store = await Store.findOne({ status: 'active' }).lean();
    assert.ok(cat && brand && store);

    const createProd = await api('/api/admin/catalog/products', {
      method: 'POST',
      token,
      body: JSON.stringify({
        storeId: String(store._id),
        moderationStatus: 'published',
        product: {
          title: 'Zero Offer Audit Product',
          bnTitle: 'অডিট পণ্য',
          description: 'Detailed description for zero-offer product audit check.',
          categoryId: String(cat._id),
          brandId: String(brand._id),
          modelName: 'MOD-100',
          images: ['/images/prod_smartwatch_s9_1794726984088.jpg'],
          variants: [{ sku: 'AUDIT-01', label: 'Default' }],
        },
      }),
    });
    assert.equal(createProd.status, 201);
    const productId = createProd.data.product._id;
    assert.equal(await SellerOffer.countDocuments({ productId }), 0);

    // Edit clears bnTitle & modelName AND sets offer price/stock on a 0-offer product
    const editProd = await api(`/api/admin/catalog/products/${productId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        title: 'Updated Audit Product',
        bnTitle: '',
        modelName: '',
        offer: {
          variantSku: 'AUDIT-01',
          price: 3499,
          compareAtPrice: 4200,
          stock: 15,
          deliveryEstimateDays: '1-3 Days',
          shippingFeeDhaka: 50,
          shippingFeeNationwide: 110,
        },
      }),
    });
    assert.equal(editProd.status, 200);

    const dbProd = await CanonicalProduct.findById(productId).lean();
    assert.ok(dbProd);
    assert.equal(dbProd.title, 'Updated Audit Product');
    assert.equal(dbProd.bnTitle, '');
    assert.equal(dbProd.modelName, '');

    const createdOffer = await SellerOffer.findOne({ productId }).lean();
    assert.ok(createdOffer, 'Primary SellerOffer should be created when editing a 0-offer product');
    assert.equal(createdOffer.price, 3499);
    assert.equal(createdOffer.stock, 15);
    assert.equal(createdOffer.shippingFeeDhaka, 50);

    const delProd = await api(`/api/admin/catalog/products/${productId}`, { method: 'DELETE', token });
    assert.equal(delProd.status, 200);
    assert.equal(await CanonicalProduct.findById(productId), null);
    assert.equal(await SellerOffer.countDocuments({ productId }), 0);
  });

  await t.test('Coupons, Promotions, CMS, Settings & Search Synonyms CRUD round-trip', async () => {
    // Coupon CRUD + 409 guard when usedCount > 0
    const cRes = await api('/api/admin/coupons', {
      method: 'POST',
      token,
      body: JSON.stringify({
        code: 'AUDIT200',
        title: 'Audit Discount',
        discountType: 'fixed',
        discountValue: 200,
        maxDiscountAmount: 0,
        minOrderAmount: 1000,
        usageLimit: 50,
        startAt: '2026-11-01',
        endAt: '2026-12-30',
        active: true,
      }),
    });
    assert.equal(cRes.status, 201);
    const couponId = cRes.data.coupon._id;

    const cEdit = await api(`/api/admin/coupons/${couponId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ title: 'Audit Discount Updated', discountValue: 250, active: false }),
    });
    assert.equal(cEdit.status, 200);
    assert.equal(cEdit.data.coupon.discountValue, 250);
    assert.equal(cEdit.data.coupon.active, false);

    await Coupon.updateOne({ _id: couponId }, { $set: { usedCount: 1 } });
    const blockedDel = await api(`/api/admin/coupons/${couponId}`, { method: 'DELETE', token });
    assert.equal(blockedDel.status, 409);

    await Coupon.updateOne({ _id: couponId }, { $set: { usedCount: 0 } });
    const cDel = await api(`/api/admin/coupons/${couponId}`, { method: 'DELETE', token });
    assert.equal(cDel.status, 200);

    // Promotion CRUD + clearing productIds
    const prod = await CanonicalProduct.findOne().lean();
    assert.ok(prod);
    const pRes = await api('/api/admin/promotions', {
      method: 'POST',
      token,
      body: JSON.stringify({
        name: 'Audit Flash Sale',
        type: 'flash_sale',
        discountBadgeText: '30% OFF',
        startAt: '2026-11-01',
        endAt: '2026-12-10',
        productIds: [String(prod._id)],
        active: true,
      }),
    });
    assert.equal(pRes.status, 201);
    const promoId = pRes.data.promotion._id;

    const pEdit = await api(`/api/admin/promotions/${promoId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ name: 'Audit Flash Updated', productIds: [], active: false }),
    });
    assert.equal(pEdit.status, 200);
    assert.equal(pEdit.data.promotion.productIds.length, 0);

    const pDel = await api(`/api/admin/promotions/${promoId}`, { method: 'DELETE', token });
    assert.equal(pDel.status, 200);

    // Platform Settings round-trip including Mongoose metadata fields
    const getSettings = await api('/api/admin/settings', { token });
    assert.equal(getSettings.status, 200);
    const putSettings = await api('/api/admin/settings', {
      method: 'PUT',
      token,
      body: JSON.stringify({
        ...getSettings.data.settings,
        freeDeliveryThreshold: 1499,
      }),
    });
    assert.equal(putSettings.status, 200);
    assert.equal(putSettings.data.settings.freeDeliveryThreshold, 1499);
    const dbSettings = await PlatformSettings.findOne({ key: 'global' }).lean();
    assert.equal(dbSettings?.freeDeliveryThreshold, 1499);

    // CMS Section update
    const section = await CmsSection.findOne().lean();
    assert.ok(section);
    const cmsUpdate = await api(`/api/admin/cms/${section._id}`, {
      method: 'PUT',
      token,
      body: JSON.stringify({
        title: `${section.title} Edited`,
        subtitle: section.subtitle || 'Updated subtitle',
        visible: !section.visible,
        displayOrder: section.displayOrder,
      }),
    });
    assert.equal(cmsUpdate.status, 200);
    assert.equal(cmsUpdate.data.section.visible, !section.visible);

    // Search Mapping create + list persistence
    const sRes = await api('/api/admin/search-management/mappings', {
      method: 'POST',
      token,
      body: JSON.stringify({
        term: 'auditphone',
        synonyms: ['smartphone', 'mobile'],
        languageHint: 'en',
        active: true,
      }),
    });
    assert.equal(sRes.status, 201);
    const sList = await api('/api/admin/search-management', { token });
    assert.equal(sList.status, 200);
    assert.ok(sList.data.mappings.some((m: { term: string }) => m.term === 'auditphone'));
  });
});
