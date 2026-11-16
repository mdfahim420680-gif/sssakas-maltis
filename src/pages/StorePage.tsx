import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, MapPin, Star, Store as StoreIcon } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { ProductCard, ProductCardItem } from '../components/ui/ProductCard';

export function StorePage() {
  const { slug } = useParams();
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<ProductCardItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiRequest(`/api/catalog/stores/${slug}`)
      .then((res) => {
        setStore(res.store);
        setProducts(res.products || []);
      })
      .catch(() => setStore(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <div className="max-w-[1360px] mx-auto px-4 py-10 text-sm text-slate-500">Loading store...</div>;
  }

  if (!store) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 bg-white rounded-2xl border border-slate-200 text-center">
        <h1 className="text-lg font-bold text-slate-900">Store Not Found</h1>
        <Link to="/shops" className="inline-block mt-4 px-4 py-2 rounded-lg bg-[#0D63F3] text-white text-xs font-bold">
          Browse Verified Shops
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1360px] mx-auto px-4 py-6 space-y-6">
      <div className="bg-gradient-to-r from-[#0B1F4B] to-[#173A82] text-white rounded-2xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-xl font-extrabold">
            {store.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold">{store.name}</h1>
              {store.verified && <BadgeCheck className="w-5 h-5 text-sky-300" />}
            </div>
            <p className="text-xs sm:text-sm text-blue-100 mt-1 max-w-2xl">{store.description}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-blue-200">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {store.district}, {store.division}
              </span>
              <span className="flex items-center gap-1 tabular-nums">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                {store.ratingAvg?.toFixed(1)} ({store.ratingCount} ratings)
              </span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Store Catalog ({products.length})</h2>
        {products.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
            No active offers currently listed by this store.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {products.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ShopsDirectoryPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{ stores: any[] }>('/api/catalog/stores')
      .then((res) => setStores(res.stores || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-[1360px] mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-2">
        <StoreIcon className="w-5 h-5 text-[#0D63F3]" />
        <h1 className="text-xl font-bold text-slate-900">Verified Seller Stores in Bangladesh</h1>
      </div>
      {loading ? (
        <div className="text-sm text-slate-500">Loading stores...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((s) => (
            <Link
              key={s._id}
              to={`/shop/${s.slug}`}
              className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-11 h-11 rounded-xl bg-[#0B1F4B] text-white font-bold flex items-center justify-center">
                      {s.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <h2 className="text-sm font-bold text-slate-900">{s.name}</h2>
                        {s.verified && <BadgeCheck className="w-4 h-4 text-[#0D63F3]" />}
                      </div>
                      <p className="text-xs text-slate-500">{s.district}, {s.division}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-600 tabular-nums">★ {s.ratingAvg?.toFixed(1)}</span>
                </div>
                <p className="text-xs text-slate-600 mt-3 line-clamp-2">{s.description}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 tabular-nums">{s.productCount} Products</span>
                <span className="font-bold text-[#0D63F3]">Visit Store →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
