import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { ProductCard, ProductCardItem } from '../components/ui/ProductCard';
import { DynamicBannerRenderer } from '../components/ui/DynamicBannerRenderer';
import { BannerRecord } from '../../shared/bannerStyle';

interface SponsoredAdItem {
  _id: string;
  name: string;
  campaign: string;
  destinationLink: string;
}

interface FilterCategoryItem {
  _id: string;
  name: string;
  bnName: string;
  slug: string;
}

interface FilterNamedItem {
  _id: string;
  name: string;
  slug: string;
}

export function SearchPage() {
  const { slug: routeCategorySlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState<ProductCardItem[]>([]);
  const [sponsoredAds, setSponsoredAds] = useState<SponsoredAdItem[]>([]);
  const [categoryTopBanners, setCategoryTopBanners] = useState<BannerRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<FilterCategoryItem[]>([]);
  const [brands, setBrands] = useState<FilterNamedItem[]>([]);
  const [stores, setStores] = useState<FilterNamedItem[]>([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const q = searchParams.get('q') || '';
  const category = routeCategorySlug || searchParams.get('category') || '';
  const brand = searchParams.get('brand') || '';
  const store = searchParams.get('store') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const minRating = searchParams.get('minRating') || '';
  const discounted = searchParams.get('discounted') || '';
  const sort = searchParams.get('sort') || 'relevance';
  const page = Number(searchParams.get('page') || 1);

  useEffect(() => {
    Promise.all([
      apiRequest<{ categories: FilterCategoryItem[] }>('/api/catalog/categories'),
      apiRequest<{ brands: FilterNamedItem[] }>('/api/catalog/brands'),
      apiRequest<{ stores: FilterNamedItem[] }>('/api/catalog/stores'),
    ])
      .then(([c, b, s]) => {
        setCategories(c.categories || []);
        setBrands(b.brands || []);
        setStores(s.stores || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    if (brand) params.set('brand', brand);
    if (store) params.set('store', store);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (minRating) params.set('minRating', minRating);
    if (discounted) params.set('discounted', discounted);
    if (sort) params.set('sort', sort);
    params.set('page', String(page));
    params.set('limit', '16');

    apiRequest<{
      items: ProductCardItem[];
      sponsoredAds: SponsoredAdItem[];
      categoryTopBanners?: BannerRecord[];
      total: number;
      totalPages: number;
    }>(`/api/catalog/search?${params.toString()}`)
      .then((res) => {
        setItems(res.items || []);
        setSponsoredAds(res.sponsoredAds || []);
        setCategoryTopBanners(res.categoryTopBanners || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 0);
      })
      .catch(() => {
        setItems([]);
        setCategoryTopBanners([]);
      })
      .finally(() => setLoading(false));
  }, [q, category, brand, store, minPrice, maxPrice, minRating, discounted, sort, page]);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    setSearchParams(next);
  };

  const clearAllFilters = () => {
    setSearchParams(q ? { q } : {});
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {category
              ? categories.find((c) => c.slug === category)?.name || 'Category Catalog'
              : q
                ? `Search results for "${q}"`
                : 'Explore NOVARA Marketplace'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">{total} available offers found</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowMobileFilters((v) => !v)}
            className="lg:hidden px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold flex items-center gap-1.5"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
          </button>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            Sort by:
            <select
              value={sort}
              onChange={(e) => updateFilter('sort', e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 outline-none"
            >
              <option value="relevance">Relevance / Best Selling</option>
              <option value="newest">Newest Arrivals</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating">Customer Rating</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sidebar Filters */}
        <aside
          className={`lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-4 space-y-5 ${
            showMobileFilters ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#0D63F3]" /> Filters
            </span>
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[11px] font-semibold text-[#0D63F3] hover:underline"
            >
              Reset All
            </button>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 mb-2">Category</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {categories.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => updateFilter('category', category === c.slug ? '' : c.slug)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex justify-between ${
                    category === c.slug
                      ? 'bg-blue-50 text-[#0D63F3] font-bold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{c.name}</span>
                  <span className="text-[10px] text-slate-400">{c.bnName}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 mb-2">Price Range (৳ BDT)</h3>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Min ৳"
                value={minPrice}
                onChange={(e) => updateFilter('minPrice', e.target.value)}
                className="h-9 px-2.5 rounded-lg border border-slate-300 text-xs outline-none"
              />
              <input
                type="number"
                placeholder="Max ৳"
                value={maxPrice}
                onChange={(e) => updateFilter('maxPrice', e.target.value)}
                className="h-9 px-2.5 rounded-lg border border-slate-300 text-xs outline-none"
              />
            </div>
          </div>

          {/* Brands */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 mb-2">Brand</h3>
            <select
              value={brand}
              onChange={(e) => updateFilter('brand', e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs bg-white outline-none"
            >
              <option value="">All Brands</option>
              {brands.map((b) => (
                <option key={b._id} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Store */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 mb-2">Seller Store</h3>
            <select
              value={store}
              onChange={(e) => updateFilter('store', e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs bg-white outline-none"
            >
              <option value="">All Verified Sellers</option>
              {stores.map((s) => (
                <option key={s._id} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Rating & Discount */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-800">Rating &amp; Deals</h3>
            <select
              value={minRating}
              onChange={(e) => updateFilter('minRating', e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs bg-white outline-none"
            >
              <option value="">Any Rating</option>
              <option value="4.5">4.5 Stars &amp; Up</option>
              <option value="4">4.0 Stars &amp; Up</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={discounted === 'true'}
                onChange={(e) => updateFilter('discounted', e.target.checked ? 'true' : '')}
                className="rounded border-slate-300 text-[#0D63F3]"
              />
              Flash Sale &amp; Discounted Deals Only
            </label>
          </div>
        </aside>

        {/* Results */}
        <div className="lg:col-span-9 space-y-4">
          {/* Category Top Dynamic Banners */}
          {categoryTopBanners.length > 0 && (
            <div className="space-y-3">
              {categoryTopBanners.map((banner) => (
                <DynamicBannerRenderer key={banner._id} banner={banner} />
              ))}
            </div>
          )}

          {/* Sponsored Ad placement */}
          {sponsoredAds.length > 0 && (
            <div className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/70 p-3.5 flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold text-[#0D63F3] uppercase tracking-wider">
                  Sponsored Placement · {sponsoredAds[0].campaign}
                </span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{sponsoredAds[0].name}</p>
              </div>
              <Link
                to={sponsoredAds[0].destinationLink}
                onClick={() => apiRequest(`/api/catalog/ads/${sponsoredAds[0]._id}/click`, { method: 'POST' }).catch(() => {})}
                className="px-4 py-2 rounded-lg bg-[#0D63F3] text-white text-xs font-bold shrink-0"
              >
                View Offer
              </Link>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-72 rounded-xl bg-slate-200/70 animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h2 className="text-base font-bold text-slate-900">No matching products available</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Try searching with English or Bengali keywords (e.g. Earbuds, স্মার্টওয়াচ, Blender, Sneakers) or clearing some filters.
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0D63F3] text-white text-xs font-bold"
              >
                <X className="w-3.5 h-3.5" /> Clear Filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map((p) => (
                  <ProductCard key={p._id} product={p} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pNum = idx + 1;
                    return (
                      <button
                        key={pNum}
                        type="button"
                        onClick={() => updateFilter('page', String(pNum))}
                        className={`w-9 h-9 rounded-lg text-xs font-bold tabular-nums ${
                          pNum === page
                            ? 'bg-[#0D63F3] text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {pNum}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
