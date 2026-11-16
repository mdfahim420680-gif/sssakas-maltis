import { env } from '../config/env';
import { hashPassword, verifyPassword } from './authService';
import { buildNormalizedSearchText } from './catalogService';
import { User } from '../models/User';
import { Store, SellerApplication, CommissionRule } from '../models/Seller';
import { Category, Brand, CanonicalProduct, SellerOffer } from '../models/Catalog';
import {
  Banner,
  Advertisement,
  CmsSection,
  Promotion,
  Coupon,
  SearchMapping,
  PlatformSettings,
} from '../models/Cms';
import { ParentOrder, SubOrder, PaymentTransaction } from '../models/Order';
import { FinancialLedgerEntry } from '../models/Finance';
import { Review } from '../models/Engagement';
import { EXTRA_INITIAL_PRODUCTS } from './initialCatalogData';

export async function ensureSeedData(): Promise<void> {
  // Idempotent Super Admin bootstrap from server-side environment configuration
  const bootstrapPassword =
    process.env.SUPER_ADMIN_BOOTSTRAP_PASSWORD ||
    process.env.SUPER_ADMIN_PASSWORD ||
    env.superAdminBootstrapPassword;
  const bootstrapEmail = (process.env.SUPER_ADMIN_EMAIL || env.superAdminEmail).toLowerCase().trim();

  let superAdmin = await User.findOne({ email: bootstrapEmail }).select('+passwordHash');
  if (bootstrapPassword) {
    if (!superAdmin) {
      const adminPassHash = await hashPassword(bootstrapPassword);
      superAdmin = await User.create({
        name: 'NOVARA Super Admin',
        email: bootstrapEmail,
        phone: '01700000001',
        passwordHash: adminPassHash,
        role: 'super_admin',
        emailVerified: true,
        status: 'active',
      });
    } else {
      let needsUpdate = false;
      if (superAdmin.role !== 'super_admin') {
        superAdmin.role = 'super_admin';
        needsUpdate = true;
      }
      if (superAdmin.status !== 'active') {
        superAdmin.status = 'active';
        needsUpdate = true;
      }
      if (!superAdmin.emailVerified) {
        superAdmin.emailVerified = true;
        needsUpdate = true;
      }
      const passwordMatches = superAdmin.passwordHash
        ? await verifyPassword(bootstrapPassword, superAdmin.passwordHash)
        : false;
      if (!passwordMatches) {
        superAdmin.passwordHash = await hashPassword(bootstrapPassword);
        needsUpdate = true;
      }
      if (needsUpdate) {
        await superAdmin.save();
      }
    }
  } else if (!superAdmin) {
    const anySuperAdminExists = await User.exists({ role: 'super_admin' });
    if (!anySuperAdminExists) {
      console.warn(
        '[Seed] SUPER_ADMIN_BOOTSTRAP_PASSWORD is not set; skipping super_admin creation.'
      );
    }
  }

  const existingCategories = await Category.countDocuments();
  if (existingCategories === 0) {
    console.log('[Seed] Initializing NOVARA marketplace catalog and CMS...');

  // 1. Platform Settings
  await PlatformSettings.create({
    key: 'global',
    freeDeliveryThreshold: 999,
    defaultCommissionPercent: 8,
    minPayoutAmount: 500,
    returnWindowDays: 7,
    requireProductModeration: true,
    sellerSubscriptionRequired: false,
    enabledPaymentMethods: ['cod', 'bkash', 'nagad', 'card'],
    announcementText: 'Free Delivery on orders over ৳999 | Mega Sale is Live! Up to 70% OFF | Secure Payment',
    supportEmail: 'support@novara.com.bd',
    supportPhone: '+880 9612-000888',
  });

  // 2. Showcase Merchant & Demo Accounts (only when DB catalog is empty; never uses hardcoded default passwords)
  const devDemoPassword = !env.isProd
    ? process.env.DEV_SEED_DEMO_PASSWORD || env.devSeedDemoPassword
    : '';
  const demoPassHash = devDemoPassword ? await hashPassword(devDemoPassword) : undefined;

  async function findOrCreateSeedUser(input: {
    name: string;
    email: string;
    phone: string;
    role: 'customer' | 'seller';
    addresses?: any[];
  }) {
    const existing = await User.findOne({ email: input.email });
    if (existing) return existing;
    return User.create({
      name: input.name,
      email: input.email,
      phone: input.phone,
      // If no DEV_SEED_DEMO_PASSWORD is supplied (or in production), account has no passwordHash and cannot be logged into via password
      passwordHash: demoPassHash || undefined,
      role: input.role,
      emailVerified: true,
      status: demoPassHash ? 'active' : 'suspended',
      addresses: input.addresses || [],
    });
  }

  const customerUser = await findOrCreateSeedUser({
    name: 'Arafat Hossain',
    email: 'customer@novara.com.bd',
    phone: '01711223344',
    role: 'customer',
    addresses: [
      {
        label: 'Home',
        fullName: 'Arafat Hossain',
        phone: '01711223344',
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Dhanmondi',
        unionOrArea: 'Road 9/A',
        streetAddress: 'House 42, Flat 4B, Dhanmondi',
        postalCode: '1209',
        deliveryInstructions: 'Call upon arrival at gate',
        isDefault: true,
      },
    ],
  });

  const seller1User = await findOrCreateSeedUser({
    name: 'Tariq Rahman',
    email: 'techworld@novara.com.bd',
    phone: '01811223344',
    role: 'seller',
  });

  const seller2User = await findOrCreateSeedUser({
    name: 'Nusrat Jahan',
    email: 'fashionhub@novara.com.bd',
    phone: '01911223344',
    role: 'seller',
  });

  const seller3User = await findOrCreateSeedUser({
    name: 'Kamrul Islam',
    email: 'homedecor@novara.com.bd',
    phone: '01611223344',
    role: 'seller',
  });

  const reviewerId = superAdmin?._id || seller1User._id;

  // 3. Approved Seller Stores & Applications
  const store1 = await Store.create({
    ownerUserId: seller1User._id,
    name: 'TechWorld BD',
    bnName: 'টেকওয়ার্ল্ড বিডি',
    slug: 'techworld-bd',
    description: 'Official electronics, audio wearables, and smart gadgets distributor in Dhaka.',
    verified: true,
    isFeatured: true,
    division: 'Dhaka',
    district: 'Dhaka',
    pickupAddress: 'Level 4, Multiplan Center, New Elephant Road, Dhaka',
    supportPhone: '01811223344',
    ratingAvg: 4.8,
    ratingCount: 1240,
    productCount: 48,
    payoutAccount: { method: 'bkash', accountNumber: '01811223344', accountHolderName: 'Tariq Rahman' },
    shippingDefaults: { dhakaFee: 60, nationwideFee: 120, freeShippingThreshold: 1999, handlingDays: '1-2 Days' },
  });

  const store2 = await Store.create({
    ownerUserId: seller2User._id,
    name: 'Fashion Hub',
    bnName: 'ফ্যাশন হাব',
    slug: 'fashion-hub',
    description: 'Curated footwear, lifestyle apparel, and everyday bags across Bangladesh.',
    verified: true,
    isFeatured: true,
    division: 'Dhaka',
    district: 'Dhaka',
    pickupAddress: 'House 18, Road 11, Banani, Dhaka',
    supportPhone: '01911223344',
    ratingAvg: 4.7,
    ratingCount: 860,
    productCount: 36,
    payoutAccount: { method: 'nagad', accountNumber: '01911223344', accountHolderName: 'Nusrat Jahan' },
    shippingDefaults: { dhakaFee: 60, nationwideFee: 110, freeShippingThreshold: 1499, handlingDays: '2-3 Days' },
  });

  const store3 = await Store.create({
    ownerUserId: seller3User._id,
    name: 'Home Decor BD',
    bnName: 'হোম ডেকোর বিডি',
    slug: 'home-decor-bd',
    description: 'Modern kitchen appliances, home living essentials, and smart cookware.',
    verified: true,
    isFeatured: true,
    division: 'Chattogram',
    district: 'Chattogram',
    pickupAddress: 'GEC Circle, CDA Avenue, Chattogram',
    supportPhone: '01611223344',
    ratingAvg: 4.6,
    ratingCount: 540,
    productCount: 29,
    payoutAccount: { method: 'bank', accountNumber: '1042009988112', accountHolderName: 'Kamrul Islam' },
    shippingDefaults: { dhakaFee: 80, nationwideFee: 120, freeShippingThreshold: 1999, handlingDays: '2-4 Days' },
  });

  await SellerApplication.create([
    {
      userId: seller1User._id,
      storeName: 'TechWorld BD',
      businessType: 'sole_proprietorship',
      nidNumber: '1990261234567',
      tradeLicenseNumber: 'TRAD/DSCC/004122',
      phone: '01811223344',
      division: 'Dhaka',
      district: 'Dhaka',
      pickupAddress: 'Multiplan Center, Dhaka',
      bankOrMfsType: 'bkash',
      accountNumber: '01811223344',
      accountHolderName: 'Tariq Rahman',
      description: 'Electronics and smart accessories seller.',
      status: 'approved',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    },
    {
      userId: seller2User._id,
      storeName: 'Fashion Hub',
      businessType: 'limited_company',
      nidNumber: '1993269876543',
      tradeLicenseNumber: 'TRAD/DNCC/008911',
      phone: '01911223344',
      division: 'Dhaka',
      district: 'Dhaka',
      pickupAddress: 'Banani Road 11, Dhaka',
      bankOrMfsType: 'nagad',
      accountNumber: '01911223344',
      accountHolderName: 'Nusrat Jahan',
      description: 'Apparel and sneakers retailer.',
      status: 'approved',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    },
    {
      userId: seller3User._id,
      storeName: 'Home Decor BD',
      businessType: 'sole_proprietorship',
      nidNumber: '1988154433221',
      phone: '01611223344',
      division: 'Chattogram',
      district: 'Chattogram',
      pickupAddress: 'GEC Circle, Chattogram',
      bankOrMfsType: 'bank',
      accountNumber: '1042009988112',
      accountHolderName: 'Kamrul Islam',
      description: 'Kitchen and home appliances retailer.',
      status: 'approved',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    },
  ]);

  // 4. Categories (matching reference sidebar + Shop by Category)
  const catDocs = await Category.create([
    { name: 'Electronics', bnName: 'ইলেকট্রনিক্স', slug: 'electronics', iconName: 'Laptop', imageUrl: '/images/prod_headphones_anc_1794726986073.jpg', accentBg: '#EFF6FF', displayOrder: 1, isFeatured: true },
    { name: "Men's Fashion", bnName: 'ছেলেদের ফ্যাশন', slug: 'mens-fashion', iconName: 'Shirt', imageUrl: '/images/prod_running_sneakers_1794726985680.jpg', accentBg: '#EEF2FF', displayOrder: 2, isFeatured: true },
    { name: "Women's Fashion", bnName: 'মেয়েদের ফ্যাশন', slug: 'womens-fashion', iconName: 'Sparkles', imageUrl: '/images/prod_earbuds_pro_1794726984024.jpg', accentBg: '#FDF2F8', displayOrder: 3, isFeatured: true },
    { name: 'Beauty & Personal Care', bnName: 'সৌন্দর্য ও যত্ন', slug: 'beauty-personal-care', iconName: 'Heart', imageUrl: '/images/prod_smartwatch_s9_1794726984088.jpg', accentBg: '#FFF1F2', displayOrder: 4, isFeatured: true },
    { name: 'Home & Living', bnName: 'হোম ও লিভিং', slug: 'home-living', iconName: 'Home', imageUrl: '/images/prod_blender_pro_1794726984294.jpg', accentBg: '#FFF7ED', displayOrder: 5, isFeatured: true },
    { name: 'Grocery & Food', bnName: 'মুদি ও খাবার', slug: 'grocery-food', iconName: 'ShoppingBasket', imageUrl: '/images/prod_air_fryer_1794726985704.jpg', accentBg: '#F0FDF4', displayOrder: 6, isFeatured: true },
    { name: 'Sports & Fitness', bnName: 'খেলাধুলা ও ফিটনেস', slug: 'sports-fitness', iconName: 'Trophy', imageUrl: '/images/prod_running_sneakers_1794726985680.jpg', accentBg: '#ECFEFF', displayOrder: 7, isFeatured: true },
    { name: 'Mobile & Accessories', bnName: 'মোবাইল ও এক্সেসরিজ', slug: 'mobile-accessories', iconName: 'Smartphone', imageUrl: '/images/prod_smartphone_5g_1794726984953.jpg', accentBg: '#EFF6FF', displayOrder: 8, isFeatured: true },
    { name: 'Computer & Accessories', bnName: 'কম্পিউটার', slug: 'computer-accessories', iconName: 'Monitor', imageUrl: '/images/hero_electronics_sale_1794726983548.jpg', accentBg: '#F8FAFC', displayOrder: 9, isFeatured: false },
    { name: 'Books & Stationery', bnName: 'বই ও স্টেশনারি', slug: 'books-stationery', iconName: 'BookOpen', accentBg: '#FEFCE8', displayOrder: 10, isFeatured: false },
    { name: 'Toys & Games', bnName: 'খেলনা ও গেমস', slug: 'toys-games', iconName: 'Gamepad2', accentBg: '#F5F3FF', displayOrder: 11, isFeatured: false },
  ]);

  const catMap = Object.fromEntries(catDocs.map((c) => [c.slug, c]));

  // Commission Rules
  await CommissionRule.create([
    { name: 'Platform Standard Commission', ratePercent: 8, isDefault: true, active: true },
    { name: 'Electronics & Mobiles Category Rate', categoryId: catMap['electronics']._id, ratePercent: 6, isDefault: false, active: true },
    { name: 'Fashion Category Rate', categoryId: catMap['mens-fashion']._id, ratePercent: 12, isDefault: false, active: true },
  ]);

  // 5. Brands
  const brandDocs = await Brand.create([
    { name: 'Apple', slug: 'apple', logoText: 'Apple', isPopular: true, displayOrder: 1 },
    { name: 'Samsung', slug: 'samsung', logoText: 'SAMSUNG', isPopular: true, displayOrder: 2 },
    { name: 'Xiaomi', slug: 'xiaomi', logoText: 'mi', isPopular: true, displayOrder: 3 },
    { name: 'Nike', slug: 'nike', logoText: 'NIKE', isPopular: true, displayOrder: 4 },
    { name: 'Adidas', slug: 'adidas', logoText: 'adidas', isPopular: true, displayOrder: 5 },
    { name: 'Huawei', slug: 'huawei', logoText: 'HUAWEI', isPopular: true, displayOrder: 6 },
    { name: 'Sony', slug: 'sony', logoText: 'SONY', isPopular: true, displayOrder: 7 },
    { name: 'Realme', slug: 'realme', logoText: 'realme', isPopular: true, displayOrder: 8 },
  ]);
  const brandMap = Object.fromEntries(brandDocs.map((b) => [b.slug, b]));

  // 6. Canonical Products + Variants
  const flashEnd = new Date(Date.now() + 36 * 60 * 60 * 1000);
  const flashStart = new Date(Date.now() - 60 * 60 * 1000);

  const pEarbuds = await CanonicalProduct.create({
    title: 'Wireless Earbuds Pro',
    bnTitle: 'ওয়্যারলেস ইয়ারবাডস প্রো',
    slug: 'wireless-earbuds-pro',
    description:
      'Active noise cancellation wireless earbuds with 32-hour charging case, dual-mic ENC calls, IPX5 sweat resistance, and USB-C fast charging. Official Bangladesh warranty included.',
    categoryId: catMap['electronics']._id,
    brandId: brandMap['xiaomi']._id,
    modelName: 'NV-TWS-PRO',
    images: ['/images/prod_earbuds_pro_1794726984024.jpg', '/images/prod_headphones_anc_1794726986073.jpg'],
    warranty: '1 Year Official Brand Warranty',
    returnPolicyDays: 7,
    weightGrams: 180,
    keywords: ['earbuds', 'tws', 'bluetooth', 'anc', 'ইয়ারবাড', 'হেডফোন'],
    specifications: [
      { key: 'Bluetooth', value: '5.3 Low Latency' },
      { key: 'Battery Life', value: '32 Hours with Case' },
      { key: 'Noise Cancellation', value: '42dB Hybrid ANC' },
      { key: 'Water Resistance', value: 'IPX5' },
    ],
    variants: [
      { sku: 'TWS-PRO-WHT', label: 'Pearl White', color: 'White', imageUrl: '/images/prod_earbuds_pro_1794726984024.jpg' },
      { sku: 'TWS-PRO-BLK', label: 'Matte Black', color: 'Black', imageUrl: '/images/prod_earbuds_pro_1794726984024.jpg' },
    ],
    createdByUserId: seller1User._id,
    createdByStoreId: store1._id,
    moderationStatus: 'published',
    ratingAvg: 4.6,
    ratingCount: 128,
    totalSold: 540,
    isFlashSaleCandidate: true,
    isTrending: true,
    searchNormalizedText: buildNormalizedSearchText({
      title: 'Wireless Earbuds Pro',
      bnTitle: 'ওয়্যারলেস ইয়ারবাডস প্রো',
      keywords: ['earbuds', 'tws', 'ইয়ারবাড'],
      brandName: 'Xiaomi',
      categoryName: 'Electronics',
      variants: [
        { sku: 'TWS-PRO-WHT', label: 'Pearl White' },
        { sku: 'TWS-PRO-BLK', label: 'Matte Black' },
      ],
    }),
  });

  const pWatch = await CanonicalProduct.create({
    title: 'Smart Watch Series 9',
    bnTitle: 'স্মার্টওয়াচ সিরিজ ৯',
    slug: 'smart-watch-series-9',
    description:
      'AMOLED Always-On display smartwatch with Bluetooth calling, SpO2 & heart-rate tracking, 100+ sports modes, and 7-day battery backup.',
    categoryId: catMap['electronics']._id,
    brandId: brandMap['huawei']._id,
    modelName: 'WATCH-S9',
    images: ['/images/prod_smartwatch_s9_1794726984088.jpg'],
    warranty: '1 Year Replacement Warranty',
    returnPolicyDays: 7,
    weightGrams: 220,
    keywords: ['smartwatch', 'watch', 'fitness tracker', 'স্মার্টওয়াচ', 'ঘড়ি'],
    specifications: [
      { key: 'Display', value: '1.96" AMOLED 60Hz' },
      { key: 'Waterproof', value: '5ATM' },
      { key: 'Calling', value: 'Built-in Mic & Speaker' },
    ],
    variants: [
      { sku: 'SW-S9-45-BLK', label: '45mm Midnight Black', color: 'Black', sizeOrStorage: '45mm' },
      { sku: 'SW-S9-41-SLV', label: '41mm Starlight Silver', color: 'Silver', sizeOrStorage: '41mm' },
    ],
    createdByUserId: seller1User._id,
    createdByStoreId: store1._id,
    moderationStatus: 'published',
    ratingAvg: 4.5,
    ratingCount: 94,
    totalSold: 410,
    isFlashSaleCandidate: true,
    isTrending: true,
    searchNormalizedText: buildNormalizedSearchText({
      title: 'Smart Watch Series 9',
      bnTitle: 'স্মার্টওয়াচ সিরিজ ৯',
      keywords: ['smartwatch', 'স্মার্টওয়াচ', 'ঘড়ি'],
      brandName: 'Huawei',
      categoryName: 'Electronics',
      variants: [
        { sku: 'SW-S9-45-BLK', label: '45mm Midnight Black' },
        { sku: 'SW-S9-41-SLV', label: '41mm Starlight Silver' },
      ],
    }),
  });

  const pBlender = await CanonicalProduct.create({
    title: 'Blender 1.5L',
    bnTitle: 'স্টেইনলেস স্টিল ব্লেন্ডার ১.৫ লিটার',
    slug: 'blender-1-5l-stainless',
    description:
      'Heavy-duty 800W copper-motor countertop blender with 1.5L borosilicate glass jar, 5-speed dial, pulse mode, and stainless steel ice-crushing blades.',
    categoryId: catMap['home-living']._id,
    brandId: brandMap['samsung']._id,
    modelName: 'BLD-1500SS',
    images: ['/images/prod_blender_pro_1794726984294.jpg'],
    warranty: '2 Years Motor Warranty',
    returnPolicyDays: 7,
    weightGrams: 2600,
    keywords: ['blender', 'mixer', 'kitchen', 'ব্লেন্ডার', 'মিক্সার'],
    specifications: [
      { key: 'Power', value: '800W Pure Copper Motor' },
      { key: 'Jar Capacity', value: '1.5 Litre Tempered Glass' },
      { key: 'Speed Settings', value: '5 Speeds + Pulse' },
    ],
    variants: [{ sku: 'BLD-15L-SS', label: 'Brushed Steel / 1.5L', color: 'Steel' }],
    createdByUserId: seller3User._id,
    createdByStoreId: store3._id,
    moderationStatus: 'published',
    ratingAvg: 4.7,
    ratingCount: 62,
    totalSold: 315,
    isFlashSaleCandidate: true,
    searchNormalizedText: buildNormalizedSearchText({
      title: 'Blender 1.5L',
      bnTitle: 'স্টেইনলেস স্টিল ব্লেন্ডার ১.৫ লিটার',
      keywords: ['blender', 'ব্লেন্ডার', 'মিক্সার'],
      brandName: 'Samsung',
      categoryName: 'Home & Living',
      variants: [{ sku: 'BLD-15L-SS', label: 'Brushed Steel' }],
    }),
  });

  const pAirFryer = await CanonicalProduct.create({
    title: 'Air Fryer 4.5L',
    bnTitle: 'ডিজিটাল এয়ার ফ্রায়ার ৪.৫ লিটার',
    slug: 'digital-air-fryer-4-5l',
    description:
      'Oil-free healthy cooking with 360-degree rapid air circulation, 8 digital touch presets, non-stick dishwasher-safe basket, and auto shut-off safety.',
    categoryId: catMap['home-living']._id,
    brandId: brandMap['xiaomi']._id,
    modelName: 'AF-4500D',
    images: ['/images/prod_air_fryer_1794726985704.jpg'],
    warranty: '1 Year Service Warranty',
    returnPolicyDays: 7,
    weightGrams: 4200,
    keywords: ['air fryer', 'kitchen appliance', 'এয়ার ফ্রায়ার'],
    specifications: [
      { key: 'Capacity', value: '4.5 Litres' },
      { key: 'Temperature Range', value: '80°C - 200°C' },
      { key: 'Power', value: '1500W' },
    ],
    variants: [{ sku: 'AF-45L-BLK', label: 'Matte Black / 4.5L', color: 'Black' }],
    createdByUserId: seller3User._id,
    createdByStoreId: store3._id,
    moderationStatus: 'published',
    ratingAvg: 4.8,
    ratingCount: 83,
    totalSold: 290,
    isFlashSaleCandidate: true,
    searchNormalizedText: buildNormalizedSearchText({
      title: 'Air Fryer 4.5L',
      bnTitle: 'ডিজিটাল এয়ার ফ্রায়ার ৪.৫ লিটার',
      keywords: ['air fryer', 'এয়ার ফ্রায়ার'],
      brandName: 'Xiaomi',
      categoryName: 'Home & Living',
      variants: [{ sku: 'AF-45L-BLK', label: 'Matte Black' }],
    }),
  });

  const pHeadphones = await CanonicalProduct.create({
    title: 'Studio ANC Wireless Headphones',
    bnTitle: 'স্টুডিও এনসি ওয়্যারলেস হেডফোন',
    slug: 'studio-anc-wireless-headphones',
    description:
      'Over-ear studio acoustic headphones with 40mm dynamic drivers, hybrid active noise cancellation, multipoint Bluetooth, and 50-hour playback.',
    categoryId: catMap['electronics']._id,
    brandId: brandMap['sony']._id,
    modelName: 'WH-NV700',
    images: ['/images/prod_headphones_anc_1794726986073.jpg'],
    warranty: '1 Year Official Warranty',
    returnPolicyDays: 7,
    weightGrams: 340,
    keywords: ['headphones', 'anc', 'audio', 'হেডফোন'],
    specifications: [
      { key: 'Driver Unit', value: '40mm Neodymium' },
      { key: 'Battery', value: '50 Hours (ANC Off)' },
    ],
    variants: [
      { sku: 'HP-ANC-NVY', label: 'Midnight Navy', color: 'Navy' },
      { sku: 'HP-ANC-BLK', label: 'Obsidian Black', color: 'Black' },
    ],
    createdByUserId: seller1User._id,
    createdByStoreId: store1._id,
    moderationStatus: 'published',
    ratingAvg: 4.6,
    ratingCount: 71,
    totalSold: 380,
    isTrending: true,
    isSponsored: true,
    searchNormalizedText: buildNormalizedSearchText({
      title: 'Studio ANC Wireless Headphones',
      bnTitle: 'স্টুডিও এনসি ওয়্যারলেস হেডফোন',
      keywords: ['headphones', 'হেডফোন'],
      brandName: 'Sony',
      categoryName: 'Electronics',
      variants: [{ sku: 'HP-ANC-NVY', label: 'Midnight Navy' }],
    }),
  });

  const pSneakers = await CanonicalProduct.create({
    title: 'Velocity Mesh Running Sneakers',
    bnTitle: 'ভেলোসিটি মেশ রানিং স্নিকার্স',
    slug: 'velocity-mesh-running-sneakers',
    description:
      'Breathable engineered-mesh running shoes with responsive EVA cushioning and high-traction rubber outsole built for city roads and gym sessions.',
    categoryId: catMap['sports-fitness']._id,
    brandId: brandMap['nike']._id,
    modelName: 'VEL-RUN-26',
    images: ['/images/prod_running_sneakers_1794726985680.jpg'],
    warranty: '7 Days Size Exchange',
    returnPolicyDays: 7,
    weightGrams: 680,
    keywords: ['sneakers', 'running shoes', 'sports', 'জুতা', 'স্নিকার্স'],
    specifications: [
      { key: 'Upper Material', value: 'Breathable Engineered Mesh' },
      { key: 'Sole', value: 'Dual-Density EVA + Rubber' },
    ],
    variants: [
      { sku: 'SNK-VEL-41', label: 'Charcoal Mint / EU 41', color: 'Charcoal', sizeOrStorage: '41' },
      { sku: 'SNK-VEL-42', label: 'Charcoal Mint / EU 42', color: 'Charcoal', sizeOrStorage: '42' },
      { sku: 'SNK-VEL-43', label: 'Charcoal Mint / EU 43', color: 'Charcoal', sizeOrStorage: '43' },
    ],
    createdByUserId: seller2User._id,
    createdByStoreId: store2._id,
    moderationStatus: 'published',
    ratingAvg: 4.7,
    ratingCount: 56,
    totalSold: 420,
    isTrending: true,
    searchNormalizedText: buildNormalizedSearchText({
      title: 'Velocity Mesh Running Sneakers',
      bnTitle: 'ভেলোসিটি মেশ রানিং স্নিকার্স',
      keywords: ['sneakers', 'জুতা', 'স্নিকার্স'],
      brandName: 'Nike',
      categoryName: 'Sports & Fitness',
      variants: [{ sku: 'SNK-VEL-42', label: 'EU 42' }],
    }),
  });

  const pSmartphone = await CanonicalProduct.create({
    title: 'Horizon 5G Smartphone (128GB / 256GB)',
    bnTitle: 'হরিজন ৫জি স্মার্টফোন',
    slug: 'horizon-5g-smartphone',
    description:
      '6.7-inch 120Hz AMOLED display, 50MP OIS triple camera, 5000mAh battery with 67W turbo charge, official BTRC-approved Bangladesh unit.',
    categoryId: catMap['mobile-accessories']._id,
    brandId: brandMap['samsung']._id,
    modelName: 'HRZ-5G-2026',
    images: ['/images/prod_smartphone_5g_1794726984953.jpg'],
    warranty: '1 Year Official Brand Warranty',
    returnPolicyDays: 7,
    weightGrams: 410,
    keywords: ['smartphone', '5g phone', 'mobile', 'স্মার্টফোন', 'মোবাইল'],
    specifications: [
      { key: 'Display', value: '6.7" FHD+ 120Hz AMOLED' },
      { key: 'Camera', value: '50MP OIS + 12MP Ultrawide' },
      { key: 'Battery', value: '5000mAh + 67W Fast Charge' },
    ],
    variants: [
      { sku: 'PHN-5G-128-BLU', label: 'Ocean Blue / 128GB', color: 'Ocean Blue', sizeOrStorage: '128GB' },
      { sku: 'PHN-5G-256-BLU', label: 'Ocean Blue / 256GB', color: 'Ocean Blue', sizeOrStorage: '256GB' },
    ],
    createdByUserId: seller1User._id,
    createdByStoreId: store1._id,
    moderationStatus: 'published',
    ratingAvg: 4.7,
    ratingCount: 112,
    totalSold: 365,
    isTrending: true,
    searchNormalizedText: buildNormalizedSearchText({
      title: 'Horizon 5G Smartphone',
      bnTitle: 'হরিজন ৫জি স্মার্টফোন',
      keywords: ['smartphone', 'mobile', 'স্মার্টফোন', 'মোবাইল'],
      brandName: 'Samsung',
      categoryName: 'Mobile & Accessories',
      variants: [
        { sku: 'PHN-5G-128-BLU', label: '128GB' },
        { sku: 'PHN-5G-256-BLU', label: '256GB' },
      ],
    }),
  });

  // 7. Seller Offers (including MULTIPLE sellers offering the same canonical product with isolated stock!)
  const offers = await SellerOffer.create([
    // Earbuds Pro offered by TechWorld BD (primary flash sale) AND Fashion Hub (higher price/alt stock)
    {
      productId: pEarbuds._id,
      storeId: store1._id,
      sellerUserId: seller1User._id,
      variantSku: 'TWS-PRO-WHT',
      price: 2299,
      compareAtPrice: 4999,
      discountPercent: 60,
      flashSalePrice: 1999,
      flashSaleStart: flashStart,
      flashSaleEnd: flashEnd,
      stock: 42,
      maxPurchaseQty: 5,
      deliveryEstimateDays: '1-2 Days (Dhaka)',
      shippingFeeDhaka: 60,
      shippingFeeNationwide: 120,
      offerNote: 'Official Sealed Pack + 1 Year Warranty Card',
      isActive: true,
    },
    {
      productId: pEarbuds._id,
      storeId: store1._id,
      sellerUserId: seller1User._id,
      variantSku: 'TWS-PRO-BLK',
      price: 2199,
      compareAtPrice: 4999,
      discountPercent: 56,
      stock: 18,
      maxPurchaseQty: 5,
      deliveryEstimateDays: '1-2 Days (Dhaka)',
      shippingFeeDhaka: 60,
      shippingFeeNationwide: 120,
      isActive: true,
    },
    {
      productId: pEarbuds._id,
      storeId: store2._id,
      sellerUserId: seller2User._id,
      variantSku: 'TWS-PRO-WHT',
      price: 2350,
      compareAtPrice: 4999,
      discountPercent: 53,
      stock: 15,
      maxPurchaseQty: 3,
      deliveryEstimateDays: '2-3 Days',
      shippingFeeDhaka: 50,
      shippingFeeNationwide: 110,
      offerNote: 'Free protective silicone pouch included',
      isActive: true,
    },

    // Smart Watch Series 9 offered by TechWorld BD & Home Decor BD
    {
      productId: pWatch._id,
      storeId: store1._id,
      sellerUserId: seller1User._id,
      variantSku: 'SW-S9-45-BLK',
      price: 3899,
      compareAtPrice: 6499,
      discountPercent: 45,
      flashSalePrice: 3499,
      flashSaleStart: flashStart,
      flashSaleEnd: flashEnd,
      stock: 28,
      maxPurchaseQty: 3,
      deliveryEstimateDays: '1-2 Days',
      shippingFeeDhaka: 60,
      shippingFeeNationwide: 120,
      isActive: true,
    },
    {
      productId: pWatch._id,
      storeId: store1._id,
      sellerUserId: seller1User._id,
      variantSku: 'SW-S9-41-SLV',
      price: 3699,
      compareAtPrice: 6499,
      discountPercent: 43,
      stock: 14,
      maxPurchaseQty: 3,
      deliveryEstimateDays: '1-2 Days',
      shippingFeeDhaka: 60,
      shippingFeeNationwide: 120,
      isActive: true,
    },
    {
      productId: pWatch._id,
      storeId: store3._id,
      sellerUserId: seller3User._id,
      variantSku: 'SW-S9-45-BLK',
      price: 3750,
      compareAtPrice: 6499,
      discountPercent: 42,
      stock: 11,
      maxPurchaseQty: 3,
      deliveryEstimateDays: '2-4 Days (Chattogram Express)',
      shippingFeeDhaka: 80,
      shippingFeeNationwide: 100,
      isActive: true,
    },

    // Blender 1.5L
    {
      productId: pBlender._id,
      storeId: store3._id,
      sellerUserId: seller3User._id,
      variantSku: 'BLD-15L-SS',
      price: 1799,
      compareAtPrice: 2999,
      discountPercent: 50,
      flashSalePrice: 1499,
      flashSaleStart: flashStart,
      flashSaleEnd: flashEnd,
      stock: 35,
      maxPurchaseQty: 4,
      deliveryEstimateDays: '2-4 Days',
      shippingFeeDhaka: 80,
      shippingFeeNationwide: 120,
      isActive: true,
    },

    // Air Fryer 4.5L
    {
      productId: pAirFryer._id,
      storeId: store3._id,
      sellerUserId: seller3User._id,
      variantSku: 'AF-45L-BLK',
      price: 6499,
      compareAtPrice: 9999,
      discountPercent: 40,
      flashSalePrice: 5999,
      flashSaleStart: flashStart,
      flashSaleEnd: flashEnd,
      stock: 19,
      maxPurchaseQty: 2,
      deliveryEstimateDays: '2-3 Days',
      shippingFeeDhaka: 80,
      shippingFeeNationwide: 130,
      isActive: true,
    },

    // Studio ANC Headphones
    {
      productId: pHeadphones._id,
      storeId: store1._id,
      sellerUserId: seller1User._id,
      variantSku: 'HP-ANC-NVY',
      price: 2499,
      compareAtPrice: 3999,
      discountPercent: 38,
      stock: 25,
      maxPurchaseQty: 4,
      deliveryEstimateDays: '1-2 Days',
      shippingFeeDhaka: 60,
      shippingFeeNationwide: 120,
      isActive: true,
    },
    {
      productId: pHeadphones._id,
      storeId: store1._id,
      sellerUserId: seller1User._id,
      variantSku: 'HP-ANC-BLK',
      price: 2599,
      compareAtPrice: 3999,
      discountPercent: 35,
      stock: 12,
      maxPurchaseQty: 4,
      deliveryEstimateDays: '1-2 Days',
      shippingFeeDhaka: 60,
      shippingFeeNationwide: 120,
      isActive: true,
    },

    // Velocity Running Sneakers
    {
      productId: pSneakers._id,
      storeId: store2._id,
      sellerUserId: seller2User._id,
      variantSku: 'SNK-VEL-41',
      price: 3199,
      compareAtPrice: 5499,
      discountPercent: 42,
      stock: 20,
      maxPurchaseQty: 3,
      deliveryEstimateDays: '2-3 Days',
      shippingFeeDhaka: 60,
      shippingFeeNationwide: 110,
      isActive: true,
    },
    {
      productId: pSneakers._id,
      storeId: store2._id,
      sellerUserId: seller2User._id,
      variantSku: 'SNK-VEL-42',
      price: 3199,
      compareAtPrice: 5499,
      discountPercent: 42,
      stock: 24,
      maxPurchaseQty: 3,
      deliveryEstimateDays: '2-3 Days',
      shippingFeeDhaka: 60,
      shippingFeeNationwide: 110,
      isActive: true,
    },
    {
      productId: pSneakers._id,
      storeId: store2._id,
      sellerUserId: seller2User._id,
      variantSku: 'SNK-VEL-43',
      price: 3299,
      compareAtPrice: 5499,
      discountPercent: 40,
      stock: 10,
      maxPurchaseQty: 3,
      deliveryEstimateDays: '2-3 Days',
      shippingFeeDhaka: 60,
      shippingFeeNationwide: 110,
      isActive: true,
    },

    // Horizon 5G Smartphone offered by TechWorld BD & Fashion Hub (gadget desk)
    {
      productId: pSmartphone._id,
      storeId: store1._id,
      sellerUserId: seller1User._id,
      variantSku: 'PHN-5G-128-BLU',
      price: 14999,
      compareAtPrice: 19999,
      discountPercent: 25,
      stock: 16,
      maxPurchaseQty: 2,
      deliveryEstimateDays: '1-2 Days (Insured)',
      shippingFeeDhaka: 0,
      shippingFeeNationwide: 100,
      isActive: true,
    },
    {
      productId: pSmartphone._id,
      storeId: store1._id,
      sellerUserId: seller1User._id,
      variantSku: 'PHN-5G-256-BLU',
      price: 17499,
      compareAtPrice: 22999,
      discountPercent: 24,
      stock: 9,
      maxPurchaseQty: 2,
      deliveryEstimateDays: '1-2 Days (Insured)',
      shippingFeeDhaka: 0,
      shippingFeeNationwide: 100,
      isActive: true,
    },
  ]);

  // 8. Dynamic Banners
  await Banner.create([
    {
      title: 'Electronics Sale',
      highlightText: 'Up to 50% OFF',
      subtitle: 'Smart Choice. Better Life.',
      ctaText: 'Shop Now',
      linkUrl: '/category/electronics',
      imageUrl: '/images/hero_electronics_sale_1794726983548.jpg',
      gradientTheme: 'sky',
      position: 'hero_slide',
      displayOrder: 1,
      active: true,
      campaignName: 'Electronics Mega Sale',
    },
    {
      title: 'Smart Audio & Wearables',
      highlightText: 'Flash Deals Live',
      subtitle: 'Official Brand Warranty Across Bangladesh.',
      ctaText: 'Explore Deals',
      linkUrl: '/search?q=earbuds',
      imageUrl: '/images/prod_headphones_anc_1794726986073.jpg',
      gradientTheme: 'indigo',
      position: 'hero_slide',
      displayOrder: 2,
      active: true,
      campaignName: 'Audio Week',
    },
    {
      title: 'Fashion Week',
      highlightText: 'Up to 70% OFF',
      subtitle: 'Sneakers & Streetwear',
      ctaText: 'Shop Now',
      linkUrl: '/category/sports-fitness',
      imageUrl: '/images/prod_running_sneakers_1794726985680.jpg',
      gradientTheme: 'purple',
      position: 'promo_trio',
      displayOrder: 1,
      active: true,
      campaignName: 'Fashion Week BD',
    },
    {
      title: 'Home Essentials',
      highlightText: 'Up to 60% OFF',
      subtitle: 'Smart Kitchen Appliances',
      ctaText: 'Shop Now',
      linkUrl: '/category/home-living',
      imageUrl: '/images/prod_blender_pro_1794726984294.jpg',
      gradientTheme: 'mint',
      position: 'promo_trio',
      displayOrder: 2,
      active: true,
      campaignName: 'Home Makeover',
    },
    {
      title: 'Mobile Mania',
      highlightText: 'Big Discount',
      subtitle: 'BTRC Approved 5G Phones',
      ctaText: 'Shop Now',
      linkUrl: '/category/mobile-accessories',
      imageUrl: '/images/prod_smartphone_5g_1794726984953.jpg',
      gradientTheme: 'amber',
      position: 'promo_trio',
      displayOrder: 3,
      active: true,
      campaignName: 'Mobile Mania',
    },
  ]);

  // 9. Dynamic Advertisements & Sponsored Placements
  await Advertisement.create([
    {
      name: 'Sony Studio ANC Sponsored Feature',
      campaign: 'Q4 Audio Spotlight',
      adType: 'sponsored_product',
      placement: 'search_results',
      mediaUrl: '/images/prod_headphones_anc_1794726986073.jpg',
      destinationLink: `/product/${pHeadphones.slug}`,
      targetProductId: pHeadphones._id,
      priority: 10,
      active: true,
    },
    {
      name: 'TechWorld BD Official Store Spotlight',
      campaign: 'Verified Seller Boost',
      adType: 'sponsored_store',
      placement: 'homepage_section',
      destinationLink: `/shop/${store1.slug}`,
      targetStoreId: store1._id,
      priority: 8,
      active: true,
    },
  ]);

  // 10. Dynamic CMS Sections
  await CmsSection.create([
    { key: 'announcement_bar', title: 'Top Announcement', sectionType: 'announcement_bar', visible: true, displayOrder: 1, config: { text: 'Free Delivery on orders over ৳999 | Mega Sale is Live! Up to 70% OFF | Secure Payment' } },
    { key: 'trust_strip', title: 'Trust & Service Strip', sectionType: 'trust_strip', visible: true, displayOrder: 2, config: {} },
    { key: 'flash_sale', title: 'Flash Sale', subtitle: 'Limited Time Offer', sectionType: 'flash_sale', visible: true, displayOrder: 3, config: {} },
    { key: 'shop_by_category', title: 'Shop by Category', sectionType: 'shop_by_category', visible: true, displayOrder: 4, config: { limit: 8 } },
    { key: 'promo_banners', title: 'Promotional Campaigns', sectionType: 'promo_banners', visible: true, displayOrder: 5, config: {} },
    { key: 'top_sellers', title: 'Top Rated Sellers', sectionType: 'top_sellers', visible: true, displayOrder: 6, config: { limit: 3 } },
    { key: 'product_tabs', title: 'Trending Products', sectionType: 'product_tabs', visible: true, displayOrder: 7, config: { defaultTab: 'trending' } },
    { key: 'popular_brands', title: 'Popular Brands', sectionType: 'popular_brands', visible: true, displayOrder: 8, config: { limit: 8 } },
    { key: 'newsletter_app_row', title: 'Value, Newsletter & App', sectionType: 'newsletter_app_row', visible: true, displayOrder: 9, config: {} },
  ]);

  // 11. Flash Sale Promotion & Coupons
  await Promotion.create({
    name: 'NOVARA Flash Sale',
    slug: 'novara-flash-sale',
    type: 'flash_sale',
    startAt: flashStart,
    endAt: flashEnd,
    discountBadgeText: 'Limited Time Offer',
    productIds: [pEarbuds._id, pWatch._id, pBlender._id, pAirFryer._id],
    active: true,
  });

  await Coupon.create([
    {
      code: 'NOVARA10',
      title: '10% Welcome Discount (up to ৳500)',
      discountType: 'percentage',
      discountValue: 10,
      maxDiscountAmount: 500,
      minOrderAmount: 1000,
      usageLimit: 500,
      startAt: flashStart,
      endAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      active: true,
    },
    {
      code: 'DHAKA150',
      title: 'Flat ৳150 OFF on Orders ৳2,000+',
      discountType: 'fixed',
      discountValue: 150,
      minOrderAmount: 2000,
      usageLimit: 300,
      startAt: flashStart,
      endAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      active: true,
    },
  ]);

  // 12. Bengali-English Search Mappings
  await SearchMapping.create([
    { term: 'earbuds', synonyms: ['ইয়ারবাড', 'ব্লুটুথ হেডফোন', 'tws'], languageHint: 'mixed', active: true },
    { term: 'smartwatch', synonyms: ['স্মার্টওয়াচ', 'ঘড়ি', 'হাতের ঘড়ি'], languageHint: 'mixed', active: true },
    { term: 'blender', synonyms: ['ব্লেন্ডার', 'মিক্সার', 'জুসার'], languageHint: 'mixed', active: true },
    { term: 'air fryer', synonyms: ['এয়ার ফ্রায়ার', 'ফ্রায়ার'], languageHint: 'mixed', active: true },
    { term: 'sneakers', synonyms: ['জুতা', 'স্নিকার্স', 'কেডস'], languageHint: 'mixed', active: true },
    { term: 'smartphone', synonyms: ['স্মার্টফোন', 'মোবাইল', 'ফোন'], languageHint: 'mixed', active: true },
  ]);

  // 13. Seed one completed/delivered historical order & verified review for customer@novara.com.bd
  const sampleParent = await ParentOrder.create({
    orderNumber: 'NVR-100421-SEED',
    customerId: customerUser._id,
    idempotencyKey: 'seed-order-100421',
    shippingAddress: {
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
    paymentStatus: 'paid',
    itemsSubtotal: 1999,
    shippingTotal: 0,
    couponDiscountTotal: 0,
    platformCommissionTotal: 120,
    grandTotal: 1999,
  });

  const sampleSub = await SubOrder.create({
    subOrderNumber: 'NVR-100421-SEED-S1',
    parentOrderId: sampleParent._id,
    customerId: customerUser._id,
    storeId: store1._id,
    storeName: store1.name,
    sellerUserId: seller1User._id,
    items: [
      {
        offerId: offers[0]._id,
        productId: pEarbuds._id,
        productTitle: pEarbuds.title,
        productSlug: pEarbuds.slug,
        productImage: pEarbuds.images[0],
        variantSku: 'TWS-PRO-WHT',
        variantLabel: 'Pearl White',
        unitPrice: 1999,
        quantity: 1,
        lineTotal: 1999,
        commissionRatePercent: 6,
        commissionAmount: 120,
      },
    ],
    subtotal: 1999,
    shippingFee: 0,
    couponDiscountShare: 0,
    commissionAmount: 120,
    sellerNetPayable: 1879,
    status: 'delivered',
    settlementStatus: 'eligible',
    shipment: {
      courierName: 'Pathao Courier',
      trackingNumber: 'PTH-BD-889120',
      shippedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      deliveredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      estimatedDelivery: '1-2 Days',
    },
    timeline: [
      { status: 'confirmed', note: 'Order confirmed (COD)', timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) },
      { status: 'shipped', note: 'Dispatched via Pathao Courier', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      { status: 'delivered', note: 'Delivered to customer', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
    ],
  });

  await PaymentTransaction.create({
    parentOrderId: sampleParent._id,
    customerId: customerUser._id,
    gateway: 'cod',
    gatewayTransactionId: 'COD-NVR-100421-SEED',
    idempotencyKey: 'pay:seed-order-100421',
    amount: 1999,
    currency: 'BDT',
    status: 'verified',
    verifiedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  });

  await FinancialLedgerEntry.create([
    {
      entryKey: `gross:${sampleSub._id}`,
      storeId: store1._id,
      subOrderId: sampleSub._id,
      parentOrderId: sampleParent._id,
      entryType: 'order_gross_sale',
      bucket: 'pending',
      amount: 1999,
      description: `Gross sale for ${sampleSub.subOrderNumber}`,
    },
    {
      entryKey: `comm:${sampleSub._id}`,
      storeId: store1._id,
      subOrderId: sampleSub._id,
      parentOrderId: sampleParent._id,
      entryType: 'platform_commission',
      bucket: 'platform_revenue',
      amount: 120,
      description: `Platform commission for ${sampleSub.subOrderNumber}`,
    },
    {
      entryKey: `eligible:${sampleSub._id}`,
      storeId: store1._id,
      subOrderId: sampleSub._id,
      parentOrderId: sampleParent._id,
      entryType: 'seller_net_credit',
      bucket: 'eligible',
      amount: 1879,
      description: `Delivered suborder ${sampleSub.subOrderNumber} eligible for payout`,
    },
  ]);

  await Review.create({
    productId: pEarbuds._id,
    subOrderId: sampleSub._id,
    storeId: store1._id,
    customerId: customerUser._id,
    customerName: customerUser.name,
    rating: 5,
    title: 'Crisp ANC and fast Dhaka delivery',
    comment: 'Received sealed box from TechWorld BD within 24 hours in Dhanmondi. Call clarity and bass are impressive for the price.',
    verifiedPurchase: true,
    moderationStatus: 'published',
  });

    console.log('[Seed] NOVARA base marketplace seeded.');
  }

  // Idempotent 50-product catalog expansion (runs once per database unless initialSeedVersion < 2)
  const settings = await PlatformSettings.findOne({ key: 'global' });
  if (!settings || (settings.initialSeedVersion ?? 0) < 2) {
    await seedExtraInitialProducts();
    if (settings) {
      settings.initialSeedVersion = 2;
      await settings.save();
    }
  }
}

async function seedExtraInitialProducts(): Promise<void> {
  const [cats, brands, stores] = await Promise.all([
    Category.find().lean(),
    Brand.find().lean(),
    Store.find().lean(),
  ]);

  const catBySlug = Object.fromEntries(cats.map((c) => [c.slug, c]));
  const brandBySlug = Object.fromEntries(brands.map((b) => [b.slug, b]));
  const storeBySlug = Object.fromEntries(stores.map((s) => [s.slug, s]));

  let insertedCount = 0;

  for (const item of EXTRA_INITIAL_PRODUCTS) {
    const cat = catBySlug[item.categorySlug];
    const brand = brandBySlug[item.brandSlug];
    const store = storeBySlug[item.storeSlug];
    if (!cat || !brand || !store) continue;

    let product = await CanonicalProduct.findOne({ slug: item.slug });
    if (!product) {
      const searchNormalizedText = buildNormalizedSearchText({
        title: item.title,
        bnTitle: item.bnTitle,
        keywords: item.keywords,
        brandName: brand.name,
        categoryName: cat.name,
        variants: [{ sku: item.variant.sku, label: item.variant.label }],
      });

      product = await CanonicalProduct.create({
        title: item.title,
        bnTitle: item.bnTitle,
        slug: item.slug,
        description: item.description,
        categoryId: cat._id,
        brandId: brand._id,
        modelName: item.modelName,
        images: item.images,
        warranty: item.warranty,
        returnPolicyDays: 7,
        weightGrams: item.weightGrams,
        keywords: item.keywords,
        specifications: item.specifications,
        variants: [item.variant],
        createdByUserId: store.ownerUserId,
        createdByStoreId: store._id,
        moderationStatus: 'published',
        ratingAvg: item.ratingAvg,
        ratingCount: item.ratingCount,
        totalSold: item.totalSold,
        isFlashSaleCandidate: Boolean(item.isFlashSaleCandidate),
        isTrending: Boolean(item.isTrending),
        isSponsored: Boolean(item.isSponsored),
        searchNormalizedText,
      });
      insertedCount++;
    }

    const existingOffer = await SellerOffer.findOne({
      storeId: store._id,
      productId: product._id,
      variantSku: item.variant.sku,
    }).lean();

    if (!existingOffer) {
      const discountPercent =
        item.compareAtPrice > item.price
          ? Math.round(((item.compareAtPrice - item.price) / item.compareAtPrice) * 100)
          : 0;

      await SellerOffer.create({
        productId: product._id,
        storeId: store._id,
        sellerUserId: store.ownerUserId,
        variantSku: item.variant.sku,
        price: item.price,
        compareAtPrice: item.compareAtPrice,
        discountPercent,
        stock: item.stock,
        maxPurchaseQty: item.maxPurchaseQty ?? 5,
        deliveryEstimateDays: item.deliveryEstimateDays,
        shippingFeeDhaka: item.shippingFeeDhaka,
        shippingFeeNationwide: item.shippingFeeNationwide,
        isActive: true,
      });
    }
  }

  // Sync each store's productCount from actual active distinct products
  for (const store of stores) {
    const distinctProducts = await SellerOffer.distinct('productId', {
      storeId: store._id,
      isActive: true,
    });
    await Store.updateOne({ _id: store._id }, { $set: { productCount: distinctProducts.length } });
  }

  if (insertedCount > 0) {
    console.log(`[Seed] Seeded ${insertedCount} additional catalog products (total ${await CanonicalProduct.countDocuments()}).`);
  }
}
