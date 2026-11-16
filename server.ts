import express from 'express';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import { env, getIntegrationStatus } from './server/config/env';
import {
  connectDatabase,
  disconnectDatabase,
  getDatabaseMode,
  isDatabaseConnected,
} from './server/config/db';
import { ensureSeedData } from './server/services/seedService';

import authRoutes from './server/routes/auth';
import catalogRoutes from './server/routes/catalog';
import cartRoutes from './server/routes/cart';
import orderRoutes from './server/routes/orders';
import sellerRoutes from './server/routes/seller';
import adminRoutes from './server/routes/admin';
import uploadRoutes from './server/routes/upload';
import seoRoutes from './server/routes/seo';

async function bootstrap() {
  let dbError: string | null = null;
  try {
    await connectDatabase();
    await ensureSeedData();
  } catch (err) {
    dbError = err instanceof Error ? err.message : 'MongoDB connection failed';
    if (env.isProd) {
      throw err;
    }
    console.error(`[NOVARA] BLOCKED: ${dbError}`);
  }

  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false, // Configured permissively for Vite/Google Fonts/iFrame preview
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Rate limiting on auth and checkout endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/super-admin-login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth/forgot-password', authLimiter);

  // Serve generated/uploaded static images reliably
  app.use('/images', express.static(path.resolve(process.cwd(), 'public/images')));
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'public/uploads')));

  // Health check
  app.get('/api/health', (_req, res) => {
    const connected = isDatabaseConnected();
    res.status(connected ? 200 : 500).json({
      ok: connected,
      service: 'novara-marketplace',
      databaseMode: getDatabaseMode(),
      error: connected ? undefined : dbError || 'MongoDB Atlas is not connected',
      integrations: getIntegrationStatus(),
      timestamp: new Date().toISOString(),
    });
  });

  // Fail closed when database is unconfigured/unavailable (never serve mock/fake data).
  // Use 500 (not 503) so upstream reverse proxies with error_page 503 interceptors do not replace JSON errors with HTML.
  app.use('/api', (_req, res, next) => {
    if (!isDatabaseConnected()) {
      res.status(500).json({
        success: false,
        error: dbError || 'MongoDB Atlas connection is unavailable. Configure MONGODB_URI.',
      });
      return;
    }
    next();
  });

  // Mount modular REST API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/catalog', catalogRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/seller', sellerRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/', seoRoutes);

  // Ensure unmatched /api/* routes return structured JSON 404 instead of SPA HTML fallback
  app.use('/api', (_req, res) => {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found',
    });
  });

  // API error handler
  app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[API Error]', err);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  });

  const distDir = path.resolve(process.cwd(), 'dist');

  if (!env.isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`[NOVARA] Server running on http://0.0.0.0:${env.port} (${env.nodeEnv})`);
  });

  const shutdown = async () => {
    console.log('[NOVARA] Shutting down gracefully...');
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('[NOVARA] Fatal bootstrap error:', err);
  process.exit(1);
});
