import dotenv from 'dotenv';

const isTestEnv =
  process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT);

if (!isTestEnv) {
  const loaded = dotenv.config();
  if (loaded.parsed) {
    for (const [key, value] of Object.entries(loaded.parsed)) {
      if (value !== '' && value !== undefined) {
        process.env[key] = value;
      }
    }
  }
}

const isProd = process.env.NODE_ENV === 'production';

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd,
  port: Number(process.env.PORT || 3000),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  mongodbUri: process.env.MONGODB_URI || '',
  atlasSearchEnabled: process.env.MONGODB_ATLAS_SEARCH_ENABLED === 'true',
  jwtSecret:
    process.env.JWT_SECRET ||
    (isProd ? '' : 'novara-dev-jwt-secret-change-in-production-9f8e7d6c5b4a'),
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'novara_session',
  superAdminEmail: (process.env.SUPER_ADMIN_EMAIL || 'superadmin@novara.com.bd').trim().toLowerCase(),
  superAdminBootstrapPassword:
    process.env.SUPER_ADMIN_BOOTSTRAP_PASSWORD || process.env.SUPER_ADMIN_PASSWORD || '',
  devSeedDemoPassword: process.env.DEV_SEED_DEMO_PASSWORD || '',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  googleOAuth: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
  },
  facebookOAuth: {
    appId: process.env.FACEBOOK_APP_ID || '',
    appSecret: process.env.FACEBOOK_APP_SECRET || '',
    callbackUrl: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:3000/api/auth/facebook/callback',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'NOVARA Marketplace <no-reply@novara.com.bd>',
  },
  payments: {
    bkash: {
      appKey: process.env.BKASH_APP_KEY || '',
      appSecret: process.env.BKASH_APP_SECRET || '',
      username: process.env.BKASH_USERNAME || '',
      password: process.env.BKASH_PASSWORD || '',
      baseUrl: process.env.BKASH_BASE_URL || 'https://tokenized.sandbox.bka.sh/v1.2.0-beta',
      webhookSecret: process.env.BKASH_WEBHOOK_SECRET || '',
    },
    nagad: {
      merchantId: process.env.NAGAD_MERCHANT_ID || '',
      privateKey: process.env.NAGAD_MERCHANT_PRIVATE_KEY || '',
      publicKey: process.env.NAGAD_PG_PUBLIC_KEY || '',
      baseUrl: process.env.NAGAD_BASE_URL || 'https://sandbox.mynagad.com:10080/remote-payment-gateway-1.0',
      webhookSecret: process.env.NAGAD_WEBHOOK_SECRET || '',
    },
    sslcommerz: {
      storeId: process.env.SSLCOMMERZ_STORE_ID || '',
      storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD || '',
      isLive: process.env.SSLCOMMERZ_IS_LIVE === 'true',
    },
  },
};

export function getIntegrationStatus() {
  return {
    mongodbAtlas: Boolean(env.mongodbUri),
    atlasSearch: env.atlasSearchEnabled,
    cloudinary: Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret),
    googleOAuth: Boolean(env.googleOAuth.clientId && env.googleOAuth.clientSecret),
    facebookOAuth: Boolean(env.facebookOAuth.appId && env.facebookOAuth.appSecret),
    transactionalEmail: Boolean(env.smtp.host && env.smtp.user && env.smtp.pass),
    bkash: Boolean(env.payments.bkash.appKey && env.payments.bkash.appSecret),
    nagad: Boolean(env.payments.nagad.merchantId && env.payments.nagad.privateKey),
    sslcommerz: Boolean(env.payments.sslcommerz.storeId && env.payments.sslcommerz.storePassword),
  };
}
