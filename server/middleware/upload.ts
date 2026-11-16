import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { env, getIntegrationStatus } from '../config/env';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

if (getIntegrationStatus().cloudinary) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
  });
}

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Unsupported file type. Allowed: JPEG, PNG, WebP, AVIF.'));
      return;
    }
    cb(null, true);
  },
});

export interface UploadedMediaResult {
  url: string;
  publicId: string;
  provider: 'cloudinary' | 'local_dev_disk';
  bytes: number;
}

export async function persistUploadedImage(
  file: Express.Multer.File,
  folder: 'products' | 'stores' | 'banners' | 'ads' | 'reviews' | 'returns' | 'categories' | 'brands'
): Promise<UploadedMediaResult> {
  const status = getIntegrationStatus();

  if (status.cloudinary) {
    const result = await new Promise<{ secure_url: string; public_id: string; bytes: number }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `novara/${folder}`,
            resource_type: 'image',
            transformation: [{ quality: 'auto', fetch_format: 'auto' }],
          },
          (err, res) => {
            if (err || !res) {
              reject(err || new Error('Cloudinary upload failed'));
              return;
            }
            resolve(res);
          }
        );
        stream.end(file.buffer);
      }
    );

    return {
      url: result.secure_url,
      publicId: result.public_id,
      provider: 'cloudinary',
      bytes: result.bytes,
    };
  }

  if (env.isProd) {
    throw new Error(
      'Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are required in production.'
    );
  }

  // Non-production local disk upload fallback (never Base64 in DB)
  const uploadDir = path.resolve(process.cwd(), 'public', 'uploads', folder);
  fs.mkdirSync(uploadDir, { recursive: true });
  const ext = file.mimetype === 'image/png' ? '.png' : file.mimetype === 'image/webp' ? '.webp' : '.jpg';
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  const fullPath = path.join(uploadDir, filename);
  fs.writeFileSync(fullPath, file.buffer);

  return {
    url: `/uploads/${folder}/${filename}`,
    publicId: `local/${folder}/${filename}`,
    provider: 'local_dev_disk',
    bytes: file.size,
  };
}

export async function deleteUploadedMedia(publicId: string): Promise<void> {
  if (publicId.startsWith('local/')) {
    const rel = publicId.replace(/^local\//, '');
    const target = path.resolve(process.cwd(), 'public', 'uploads', rel);
    if (fs.existsSync(target)) fs.unlinkSync(target);
    return;
  }
  if (getIntegrationStatus().cloudinary && publicId) {
    await cloudinary.uploader.destroy(publicId);
  }
}
