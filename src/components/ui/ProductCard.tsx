import { Link } from 'react-router-dom';
import { ShoppingCart, Star } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';
import { addItemToCart } from '../../store/cartSlice';
import { pushToast } from '../../store/uiSlice';
import { formatBDT } from '../../lib/api';
import { ImageWithFallback } from './ImageWithFallback';

export interface ProductCardItem {
  _id: string;
  title: string;
  bnTitle?: string;
  slug: string;
  image: string;
  categoryName: string;
  ratingAvg: number;
  ratingCount: number;
  minPrice: number;
  compareAtPrice?: number;
  discountPercent: number;
  totalStock: number;
  offerCount: number;
  bestOfferId: string;
  bestStoreName: string;
}

export function ProductCard({
  product,
  compact = false,
}: {
  product: ProductCardItem;
  compact?: boolean;
}) {
  const dispatch = useDispatch<AppDispatch>();

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await dispatch(
        addItemToCart({ offerId: product.bestOfferId, quantity: 1, openDrawer: true })
      ).unwrap();
      dispatch(
        pushToast({
          type: 'success',
          title: 'Added to Cart',
          message: `${product.title} (${product.bestStoreName})`,
        })
      );
    } catch (err: any) {
      dispatch(
        pushToast({
          type: 'error',
          title: 'Could not add item',
          message: err?.message || 'Stock unavailable',
        })
      );
    }
  };

  return (
    <Link
      to={`/product/${product.slug}`}
      className="group relative flex flex-col bg-white rounded-xl border border-slate-200/80 hover:border-blue-300 hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      {/* Image area matching reference: soft neutral container, top-left red discount tag */}
      <div className={`relative w-full ${compact ? 'aspect-[4/3]' : 'aspect-square'} bg-[#F8FAFC] overflow-hidden`}>
        {product.discountPercent > 0 && (
          <span className="absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-md bg-[#EF3E36] text-white text-[11px] font-bold tabular-nums shadow-sm">
            -{product.discountPercent}%
          </span>
        )}
        <ImageWithFallback
          src={product.image}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
        />
      </div>

      {/* Content area matching reference card structure */}
      <div className={`flex flex-col flex-1 justify-between ${compact ? 'p-3' : 'p-3.5'}`}>
        <div>
          <h3 className="text-[13.5px] font-semibold text-slate-900 line-clamp-2 leading-snug group-hover:text-[#0D63F3] transition-colors">
            {product.title}
          </h3>

          <div className="flex items-center gap-1 mt-1.5 text-xs">
            <div className="flex items-center text-amber-400">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            </div>
            <span className="font-semibold text-slate-700 tabular-nums">
              {product.ratingAvg > 0 ? product.ratingAvg.toFixed(1) : 'New'}
            </span>
            {product.ratingCount > 0 && (
              <span className="text-slate-400 tabular-nums">({product.ratingCount})</span>
            )}
            {product.offerCount > 1 && (
              <span className="ml-auto text-[11px] text-blue-600 font-medium">
                {product.offerCount} sellers
              </span>
            )}
          </div>
        </div>

        <div className="flex items-end justify-between gap-2 mt-3 pt-1">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-[15px] font-bold text-[#EF3E36] tabular-nums">
                {formatBDT(product.minPrice)}
              </span>
              {product.compareAtPrice && product.compareAtPrice > product.minPrice && (
                <span className="text-xs text-slate-400 line-through tabular-nums">
                  {formatBDT(product.compareAtPrice)}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={product.totalStock <= 0}
            aria-label={`Add ${product.title} to cart`}
            className="w-8 h-8 rounded-lg bg-[#0D63F3] hover:bg-[#0A52CC] disabled:bg-slate-300 text-white flex items-center justify-center shrink-0 transition-colors shadow-sm cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Link>
  );
}
