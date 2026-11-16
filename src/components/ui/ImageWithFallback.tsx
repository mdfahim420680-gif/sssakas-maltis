import { useState } from 'react';
import { Package } from 'lucide-react';

interface ImageWithFallbackProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackText?: string;
}

export function ImageWithFallback({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackText,
}: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 text-slate-400 p-3 text-center"
        aria-label={alt}
      >
        <Package className="w-8 h-8 mb-1.5 text-blue-400/80" />
        <span className="text-[11px] font-medium text-slate-500 line-clamp-2">
          {fallbackText || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
      loading="lazy"
    />
  );
}
