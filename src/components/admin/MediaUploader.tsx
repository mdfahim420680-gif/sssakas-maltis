import React, { useId, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { getAuthToken } from '../../lib/api';

export type UploadMediaFolder = 'products' | 'stores' | 'banners' | 'ads' | 'categories' | 'brands';

const ACCEPTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function uploadImageFile(
  file: File,
  folder: UploadMediaFolder,
  onProgress?: (percent: number) => void
): Promise<{ url: string; publicId: string }> {
  if (!ACCEPTED_MIME.has(file.type)) {
    return Promise.reject(new Error('Unsupported format. Upload JPG, PNG, WebP, or AVIF image.'));
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Promise.reject(new Error('File exceeds 5MB upload limit.'));
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.withCredentials = true;

    const token = getAuthToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) {
        onProgress(Math.min(99, Math.round((evt.loaded / evt.total) * 100)));
      }
    };

    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText || '{}') as {
          success?: boolean;
          error?: string;
          media?: { url: string; publicId: string };
        };
        if (xhr.status >= 200 && xhr.status < 300 && parsed.success && parsed.media?.url) {
          if (onProgress) onProgress(100);
          resolve(parsed.media);
        } else {
          reject(new Error(parsed.error || `Upload failed (${xhr.status})`));
        }
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error while uploading image'));
    };

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    xhr.send(formData);
  });
}

interface SingleMediaUploaderProps {
  folder: UploadMediaFolder;
  value: string;
  onChange: (url: string) => void;
  label?: string;
  helperText?: string;
  aspectClass?: string;
  required?: boolean;
  allowRemove?: boolean;
  fit?: 'cover' | 'contain';
}

export function SingleMediaUploader({
  folder,
  value,
  onChange,
  label = 'Upload Image',
  helperText = 'PNG, JPG, WebP or AVIF up to 5MB',
  aspectClass = 'h-40',
  required = false,
  allowRemove = true,
  fit = 'cover',
}: SingleMediaUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const processFile = async (file: File) => {
    setError(null);
    setUploading(true);
    setProgress(5);
    try {
      const media = await uploadImageFile(file, folder, setProgress);
      onChange(media.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-xs font-bold text-slate-700">
          {label} {required && <span className="text-[#EF3E36]">*</span>}
        </label>
        <div className="flex items-center gap-2">
          {value && (
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="text-[11px] font-bold text-[#0D63F3] hover:underline inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Replace
            </button>
          )}
          {value && allowRemove && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-[11px] font-bold text-slate-500 hover:text-[#EF3E36] inline-flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Remove
            </button>
          )}
        </div>
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void processFile(f);
        }}
      />

      {value ? (
        <div
          className={`relative group rounded-xl border border-slate-200/90 bg-slate-50 overflow-hidden ${aspectClass}`}
        >
          <img
            src={value}
            alt={label}
            className={`w-full h-full ${fit === 'contain' ? 'object-contain p-3' : 'object-cover'}`}
          />
          <div className="absolute inset-0 bg-[#071636]/45 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center justify-center gap-2 p-3">
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="px-3.5 h-8 rounded-xl bg-white text-slate-900 text-xs font-bold inline-flex items-center gap-1.5 shadow-md hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D63F3]"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#0D63F3]" />
              Replace Image
            </button>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-white/92 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 p-4">
              <Loader2 className="w-5 h-5 animate-spin text-[#0D63F3]" />
              <div className="w-full max-w-[180px] h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-[#0D63F3] transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[11px] font-bold text-[#0B1F4B] tabular-nums">Uploading {progress}%</span>
            </div>
          )}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label={`Upload ${label}`}
          onClick={() => !uploading && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void processFile(f);
          }}
          className={`${aspectClass} rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center px-4 cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#0D63F3]/20 focus-visible:border-[#0D63F3] ${
            dragging
              ? 'border-[#0D63F3] bg-blue-50/70'
              : 'border-slate-300/90 bg-slate-50/50 hover:border-[#0D63F3]/70 hover:bg-blue-50/20'
          }`}
        >
          {uploading ? (
            <div className="w-full max-w-[200px] space-y-2 flex flex-col items-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#0D63F3]" />
              <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-[#0D63F3] transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs font-bold text-[#0B1F4B] tabular-nums">Uploading {progress}%</p>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-[#0D63F3] flex items-center justify-center mb-2">
                <UploadCloud className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-800">Click to upload or drag &amp; drop</p>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm leading-snug">{helperText}</p>
            </>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-[11px] font-semibold text-[#EF3E36] flex items-center gap-1 pt-0.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

interface MultiMediaUploaderProps {
  folder: UploadMediaFolder;
  images: string[];
  onChange: (nextImages: string[]) => void;
  label?: string;
  maxImages?: number;
}

export function MultiMediaUploader({
  folder,
  images,
  onChange,
  label = 'Product Gallery Images',
  maxImages = 8,
}: MultiMediaUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const remaining = Math.max(0, maxImages - images.length);
    const files = Array.from(fileList).slice(0, remaining);
    if (files.length === 0) {
      setError(`Maximum ${maxImages} images allowed.`);
      return;
    }

    setUploadingCount(files.length);
    const uploadedUrls: string[] = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        const res = await uploadImageFile(file, folder);
        uploadedUrls.push(res.url);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'Upload failed');
      }
    }

    if (uploadedUrls.length > 0) {
      const merged = [...images];
      for (const u of uploadedUrls) {
        if (!merged.includes(u)) merged.push(u);
      }
      onChange(merged);
    }
    if (errors.length > 0) setError(errors[0]);
    setUploadingCount(0);
    if (inputRef.current) inputRef.current.value = '';
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  };

  const setPrimary = (index: number) => {
    if (index === 0 || index >= images.length) return;
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.unshift(item);
    onChange(next);
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-xs font-bold text-slate-700">
          {label} <span className="text-slate-400 font-semibold tabular-nums">({images.length}/{maxImages})</span>
        </label>
        <button
          type="button"
          disabled={uploadingCount > 0 || images.length >= maxImages}
          onClick={() => inputRef.current?.click()}
          className="px-3 h-8 rounded-xl bg-blue-50 border border-blue-200/70 text-[#0D63F3] hover:bg-blue-100/80 text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          Upload Images
        </button>
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        onChange={(e) => {
          void handleFiles(e.target.files);
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-3 transition-colors ${
          dragging ? 'border-[#0D63F3] bg-blue-50/60' : 'border-slate-200 bg-slate-50/50'
        }`}
      >
        {images.length === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full py-7 flex flex-col items-center justify-center text-center rounded-lg hover:bg-white/60 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-[#0D63F3] flex items-center justify-center mb-2">
              <ImageIcon className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800">Drop product photos here or click to upload</span>
            <span className="text-[11px] text-slate-500 mt-0.5">
              First image becomes the primary storefront thumbnail · Max 5MB each
            </span>
          </button>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {images.map((url, idx) => (
              <div
                key={`${url}-${idx}`}
                className={`relative rounded-xl border bg-white overflow-hidden group transition-all ${
                  idx === 0 ? 'border-[#0D63F3] ring-2 ring-[#0D63F3]/15' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
                  <img src={url} alt={`Product image ${idx + 1}`} className="w-full h-full object-contain p-1.5" />
                </div>
                {idx === 0 && (
                  <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-[#0D63F3] text-white text-[9px] font-extrabold uppercase tracking-wider shadow-xs">
                    Primary
                  </span>
                )}
                <div className="p-1.5 border-t border-slate-100 bg-white flex items-center justify-between gap-1">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveImage(idx, -1)}
                      aria-label={`Move image ${idx + 1} left`}
                      className="p-1 rounded-md hover:bg-slate-100 text-slate-600 disabled:opacity-30"
                    >
                      <ArrowLeft className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === images.length - 1}
                      onClick={() => moveImage(idx, 1)}
                      aria-label={`Move image ${idx + 1} right`}
                      className="p-1 rounded-md hover:bg-slate-100 text-slate-600 disabled:opacity-30"
                    >
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => setPrimary(idx)}
                        title="Set as primary"
                        aria-label={`Set image ${idx + 1} as primary`}
                        className="p-1 rounded-md hover:bg-blue-50 text-[#0D63F3]"
                      >
                        <Star className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      title="Remove image"
                      aria-label={`Remove image ${idx + 1}`}
                      className="p-1 rounded-md hover:bg-red-50 text-[#EF3E36]"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {uploadingCount > 0 && (
          <div className="mt-2.5 flex items-center justify-center gap-2 text-xs font-bold text-[#0D63F3]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Uploading {uploadingCount} image{uploadingCount > 1 ? 's' : ''}...</span>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-[11px] font-semibold text-[#EF3E36] flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
