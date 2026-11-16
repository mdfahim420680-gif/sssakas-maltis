import { Router } from 'express';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { persistUploadedImage, uploadMiddleware } from '../middleware/upload';

const router = Router();

const ALLOWED_FOLDERS = new Set([
  'products',
  'stores',
  'banners',
  'ads',
  'reviews',
  'returns',
  'categories',
  'brands',
]);

type UploadFolder = 'products' | 'stores' | 'banners' | 'ads' | 'reviews' | 'returns' | 'categories' | 'brands';

router.post('/', requireAuth, uploadMiddleware.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No image file provided' });
      return;
    }

    const folder = String(req.body.folder || 'products') as UploadFolder;

    if (!ALLOWED_FOLDERS.has(folder)) {
      res.status(400).json({ success: false, error: 'Invalid upload folder' });
      return;
    }

    if ((folder === 'banners' || folder === 'ads') && !['admin', 'super_admin', 'content_manager'].includes(req.user!.role)) {
      res.status(403).json({ success: false, error: 'Admin permission required for banner/ad media' });
      return;
    }
    if ((folder === 'categories' || folder === 'brands') && !['admin', 'super_admin', 'catalog_manager', 'content_manager'].includes(req.user!.role)) {
      res.status(403).json({ success: false, error: 'Catalog or content admin permission required for category/brand media' });
      return;
    }
    if ((folder === 'products' || folder === 'stores') && !['seller', 'admin', 'super_admin', 'catalog_manager'].includes(req.user!.role)) {
      res.status(403).json({ success: false, error: 'Approved seller or admin required for catalog media' });
      return;
    }

    const uploaded = await persistUploadedImage(req.file, folder);
    res.status(201).json({ success: true, media: uploaded });
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'Upload failed' });
  }
});

export default router;
