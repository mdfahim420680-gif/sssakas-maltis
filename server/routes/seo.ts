import { Router } from 'express';
import { env } from '../config/env';
import { CanonicalProduct, Category } from '../models/Catalog';
import { Store } from '../models/Seller';

const router = Router();

router.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /seller\nDisallow: /checkout\nDisallow: /account\nSitemap: ${env.appUrl}/sitemap.xml\n`
  );
});

router.get('/sitemap.xml', async (_req, res) => {
  try {
    const [products, categories, stores] = await Promise.all([
      CanonicalProduct.find({ moderationStatus: 'published' }).select('slug updatedAt').lean(),
      Category.find({ active: true }).select('slug updatedAt').lean(),
      Store.find({ status: 'active' }).select('slug updatedAt').lean(),
    ]);

    const urls = [
      `<url><loc>${env.appUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
      `<url><loc>${env.appUrl}/search</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`,
      ...categories.map(
        (c) => `<url><loc>${env.appUrl}/category/${c.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`
      ),
      ...stores.map(
        (s) => `<url><loc>${env.appUrl}/shop/${s.slug}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`
      ),
      ...products.map(
        (p) =>
          `<url><loc>${env.appUrl}/product/${p.slug}</loc><lastmod>${new Date(p.updatedAt).toISOString()}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>`
      ),
    ];

    res
      .type('application/xml')
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`);
  } catch {
    res.status(500).send('Failed to generate sitemap');
  }
});

export default router;
