'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { supabase } from '@/lib/supabaseClient';

function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

type MarketplaceItem = {
  id: string;
  title: string;
  price: string | number;
  location: string;
  category: string;
  condition: string;
  description?: string | null;
  imageUrls: string[] | null;
  lat?: number | null;
  lon?: number | null;
  created_at?: string | null;
  slug: string;
  source: 'retail' | 'dealership';
  business_id?: string | null;
  business_verified?: boolean;
  business_plan?: string | null;
};

type FavoriteItem = {
  key: string;
  id: string;
  source: 'retail' | 'dealership';
  slug: string;
  title: string;
  price: string | number;
  image: string;
  location?: string;
};

const FAVORITE_ITEMS_KEY = 'favoriteMarketplaceItems';

const getStorageUrl = (bucket: string, path?: string | null) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
};

const normalizeImages = (value: unknown, bucket: string): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => getStorageUrl(bucket, String(item))).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => getStorageUrl(bucket, String(item))).filter(Boolean);
      }
      return [getStorageUrl(bucket, value)].filter(Boolean);
    } catch {
      return [getStorageUrl(bucket, value)].filter(Boolean);
    }
  }
  return [];
};

const getFirstImage = (value: string[] | null | undefined) => (value?.[0] || '');

const getPriceValue = (value: string | number) => {
  if (typeof value === 'number') return value;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isNaN(parsed) ? null : parsed;
};

const shuffleInChunks = <T,>(items: T[], chunkSize = 6) => {
  const result: T[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    for (let j = chunk.length - 1; j > 0; j -= 1) {
      const k = Math.floor(Math.random() * (j + 1));
      [chunk[j], chunk[k]] = [chunk[k], chunk[j]];
    }
    result.push(...chunk);
  }
  return result;
};

const planRank: Record<string, number> = {
  premium: 4,
  growth: 3,
  starter: 2,
  free: 1,
  default: 0,
};

const getPlanRank = (value?: string | null) => {
  const key = (value || '').trim().toLowerCase();
  return planRank[key] ?? planRank.default;
};

export default function MarketplacePage() {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [tempCoords, setTempCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [radius, setRadius] = useState(50);
  const [tempRadius, setTempRadius] = useState(50);
  const [zipFallback, setZipFallback] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [tempMinPrice, setTempMinPrice] = useState('');
  const [tempMaxPrice, setTempMaxPrice] = useState('');
  const [sort, setSort] = useState('');
  const [tempSort, setTempSort] = useState('');
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);

  const getUserLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setTempCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => alert('Location access denied.')
    );
  };

  const lookupZipOrCity = async () => {
    if (!zipFallback) return;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(zipFallback)}`);
    const data = await res.json();
    if (data.length > 0) {
      setTempCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
    } else {
      alert('Could not find that ZIP or City.');
    }
  };

  const clearFilters = () => {
    setTempCoords(null);
    setTempRadius(50);
    setTempMinPrice('');
    setTempMaxPrice('');
    setTempSort('');
    setZipFallback('');
    setUserCoords(null);
    setRadius(50);
    setMinPrice('');
    setMaxPrice('');
    setSort('');
    setVisibleCount(6);
  };

  const applyFilters = () => {
    setUserCoords(tempCoords);
    setRadius(tempRadius);
    setMinPrice(tempMinPrice);
    setMaxPrice(tempMaxPrice);
    setSort(tempSort);
    setShowFilters(false);
    setVisibleCount(6);
  };

  useEffect(() => {
    const storedFavorites = localStorage.getItem(FAVORITE_ITEMS_KEY);
    if (storedFavorites) {
      try {
        const parsed = JSON.parse(storedFavorites) as FavoriteItem[];
        setFavoriteItems(parsed);
      } catch {
        setFavoriteItems([]);
      }
    }

    const saved = localStorage.getItem('userCoords');
    if (saved) {
      setUserCoords(JSON.parse(saved));
      setTempCoords(JSON.parse(saved));
    }

    const normalizeRetailItem = (row: any): MarketplaceItem => ({
      id: String(row.id),
      title: row.title || row.name || row.item_name || 'Retail item',
      price: row.price ?? row.amount ?? row.cost ?? '',
      location: row.location || row.city || row.address || '',
      category: row.category || row.type || 'Retail',
      condition: row.condition || row.item_condition || '',
      description: row.description || row.details || null,
      imageUrls: normalizeImages(row.images ?? row.image_url ?? row.image_urls ?? row.photos, 'retail-items'),
      lat: row.lat ?? row.latitude ?? null,
      lon: row.lon ?? row.longitude ?? null,
      created_at: row.created_at || row.createdAt || null,
      slug: row.slug || row.item_slug || row.listing_slug || `retail-${row.id}`,
      source: 'retail',
      business_id: row.business_id || null,
    });

    const normalizeDealershipItem = (row: any): MarketplaceItem => ({
      id: String(row.id),
      title: row.title || row.name || row.vehicle_name || row.model || 'Dealership listing',
      price: row.price ?? row.amount ?? row.cost ?? '',
      location: row.location || row.city || row.address || '',
      category: row.category || row.type || 'Dealership',
      condition: row.condition || row.item_condition || '',
      description: row.description || row.details || row.notes || null,
      imageUrls: normalizeImages(row.images ?? row.image_url ?? row.image_urls ?? row.photos, 'car-listings'),
      lat: row.lat ?? row.latitude ?? null,
      lon: row.lon ?? row.longitude ?? null,
      created_at: row.created_at || row.createdAt || null,
      slug: row.slug || row.item_slug || row.listing_slug || `dealership-${row.id}`,
      source: 'dealership',
      business_id: row.business_id || null,
    });

    const loadItems = async () => {
      const [retailRes, dealershipRes] = await Promise.all([
        supabase.from('retail_items').select('*').order('created_at', { ascending: false }),
        supabase.from('dealerships').select('*').order('created_at', { ascending: false }),
      ]);

      if (retailRes.error || dealershipRes.error) {
        console.error('Failed to load marketplace items', retailRes.error || dealershipRes.error);
        setItems([]);
        return;
      }

      const retail = (retailRes.data || []).map(normalizeRetailItem);
      const dealership = (dealershipRes.data || []).map(normalizeDealershipItem);
      const combined = [...retail, ...dealership].sort(sortByCreatedAt);
      const businessIds = Array.from(
        new Set(combined.map((item) => item.business_id).filter(Boolean) as string[])
      );
      let verifiedMap = new Map<string, boolean>();
      let planMap = new Map<string, string>();
      if (businessIds.length > 0) {
        const { data: businessRows } = await supabase
          .from('businesses')
          .select('id, is_verified, plan')
          .in('id', businessIds);
        verifiedMap = new Map(
          (businessRows || []).map((row: { id: string; is_verified?: boolean | null; plan?: string | null }) => [
            row.id,
            Boolean(row.is_verified),
          ])
        );
        planMap = new Map(
          (businessRows || []).map((row: { id: string; plan?: string | null }) => [row.id, row.plan || ''])
        );
      }
      const withMetadata = combined.map((item) => ({
        ...item,
        business_verified: item.business_id ? verifiedMap.get(item.business_id) || false : false,
        business_plan: item.business_id ? planMap.get(item.business_id) || null : null,
      }));
      const ranked = withMetadata.sort((a, b) => {
        const planDelta = getPlanRank(b.business_plan) - getPlanRank(a.business_plan);
        if (planDelta !== 0) return planDelta;
        return sortByCreatedAt(b, a);
      });
      setItems(shuffleInChunks(ranked, 8));
    };

    loadItems();
  }, []);

  const getFavoriteKey = (item: MarketplaceItem) => `${item.source}:${item.id}`;

  const toggleFavorite = (item: MarketplaceItem) => {
    const key = getFavoriteKey(item);
    setFavoriteItems((prev) => {
      let next: FavoriteItem[];
      if (prev.some((fav) => fav.key === key)) {
        next = prev.filter((fav) => fav.key !== key);
      } else {
        next = [
          ...prev,
          {
            key,
            id: item.id,
            source: item.source,
            slug: item.slug,
            title: item.title,
            price: item.price,
            image: getFirstImage(item.imageUrls) || '/placeholder.jpg',
            location: item.location,
          },
        ];
      }
      localStorage.setItem(FAVORITE_ITEMS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const favoriteKeys = new Set(favoriteItems.map((fav) => fav.key));

  const sortByCreatedAt = (a: MarketplaceItem, b: MarketplaceItem) =>
    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();

  const normalizeToken = (value: string) => value.toLowerCase().trim();
  const tokens = searchTerm
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const synonymMap: Record<string, string[]> = {
    car: ['cars', 'vehicle', 'auto', 'dealership', 'dealer'],
    cars: ['car', 'vehicle', 'auto', 'dealership', 'dealer'],
    vehicle: ['car', 'auto', 'dealership', 'dealer'],
    truck: ['trucks', 'vehicle', 'auto', 'dealership', 'dealer'],
    bike: ['bikes', 'motorcycle', 'motorbike'],
    clothes: ['cloths', 'clothing', 'apparel', 'outfit', 'suit', 'suits'],
    cloths: ['clothes', 'clothing', 'apparel', 'outfit', 'suit', 'suits'],
    suit: ['suits', 'clothes', 'clothing', 'apparel'],
    shoes: ['shoe', 'sneakers', 'boots'],
    phone: ['phones', 'mobile', 'iphone', 'android'],
    laptop: ['laptops', 'computer', 'pc', 'macbook'],
  };

  const expandedTermGroups = tokens.map((token) => {
    const base = normalizeToken(token);
    const synonyms = synonymMap[base] || [];
    return Array.from(new Set([base, ...synonyms.map(normalizeToken)]));
  });

  const expandedTerms = Array.from(new Set(expandedTermGroups.flat()));

  const wantsDealership = expandedTerms.some((t) =>
    ['car', 'cars', 'vehicle', 'auto', 'truck', 'dealer', 'dealership', 'motorcycle'].includes(t)
  );

  const wantsRetail = expandedTerms.some((t) =>
    ['clothes', 'cloths', 'clothing', 'apparel', 'suit', 'suits', 'shoes', 'phone', 'laptop'].includes(t)
  );

  const matchesSearch = (value: string, termList: string[]) =>
    termList.length === 0 ? true : termList.some((t) => value.includes(t));

  const matchesAllGroups = (value: string, groups: string[][]) =>
    groups.length === 0 ? true : groups.every((group) => matchesSearch(value, group));

  let filteredItems = items.filter((item) => {
    const title = (item.title || '').toLowerCase();
    const location = (item.location || '').toLowerCase();
    const category = (item.category || '').toLowerCase();
    const description = (item.description || '').toLowerCase();
    const searchable = `${title} ${category} ${location} ${description}`.trim();
    return matchesAllGroups(searchable, expandedTermGroups);
  });

  if (expandedTerms.length > 0) {
    if (wantsDealership && !wantsRetail) {
      const dealershipItems = filteredItems.filter((item) => item.source === 'dealership');
      if (dealershipItems.length > 0) filteredItems = dealershipItems;
    } else if (wantsRetail && !wantsDealership) {
      const retailItems = filteredItems.filter((item) => item.source === 'retail');
      if (retailItems.length > 0) filteredItems = retailItems;
    }
  }

  if (minPrice) {
    const min = parseFloat(minPrice);
    filteredItems = filteredItems.filter((i) => {
      const value = getPriceValue(i.price);
      return value !== null && value >= min;
    });
  }
  if (maxPrice) {
    const max = parseFloat(maxPrice);
    filteredItems = filteredItems.filter((i) => {
      const value = getPriceValue(i.price);
      return value !== null && value <= max;
    });
  }
  if (userCoords) {
    filteredItems = filteredItems.filter((i) =>
      i.lat && i.lon
        ? getDistanceMiles(userCoords.lat, userCoords.lon, i.lat, i.lon) <= radius
        : true
    );
  }

  if (sort === 'priceLow') {
    filteredItems.sort((a, b) => (getPriceValue(a.price) || 0) - (getPriceValue(b.price) || 0));
  } else if (sort === 'priceHigh') {
    filteredItems.sort((a, b) => (getPriceValue(b.price) || 0) - (getPriceValue(a.price) || 0));
  } else if (sort === 'newest') {
    filteredItems.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  } else if (userCoords) {
    filteredItems.sort((a, b) => {
      const aHasCoords = a.lat != null && a.lon != null;
      const bHasCoords = b.lat != null && b.lon != null;
      if (aHasCoords && bHasCoords) {
        const aDist = getDistanceMiles(userCoords.lat, userCoords.lon, a.lat as number, a.lon as number);
        const bDist = getDistanceMiles(userCoords.lat, userCoords.lon, b.lat as number, b.lon as number);
        if (aDist !== bDist) return aDist - bDist;
      }
      if (aHasCoords && !bHasCoords) return -1;
      if (!aHasCoords && bHasCoords) return 1;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }

  const ItemCard = ({ item }: { item: MarketplaceItem }) => (
    <div key={item.id} className="relative group border rounded-xl overflow-hidden shadow hover:shadow-lg bg-white">
      <Link href={`/marketplace/${item.slug}`}>
        <div className="relative w-full bg-gray-100">
          <img
            src={getFirstImage(item.imageUrls) || '/placeholder.jpg'}
            alt={item.title}
            loading="lazy"
            decoding="async"
            className="w-full h-auto max-h-72 object-contain"
          />
          {item.business_verified && (
            <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white shadow">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-emerald-600 text-[9px] font-bold">
                H
              </span>
              Verified
            </span>
          )}
        </div>
        <div className="p-3 space-y-1">
          <h3 className="font-semibold text-lg">{item.title}</h3>
          <p className="text-green-600 font-medium">
            {getPriceValue(item.price) === null ? item.price : `$${getPriceValue(item.price)}`}
          </p>
          {item.description && (
            <p className="text-sm text-gray-600 line-clamp-2">
              {item.description}
            </p>
          )}
          <p className="text-sm text-gray-500">{item.location}</p>
          <span className={`text-xs inline-block mt-1 px-2 py-1 rounded-full ${item.condition === 'New' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {item.condition}
          </span>
        </div>
      </Link>
      <button onClick={() => toggleFavorite(item)} className="absolute top-3 right-3 text-white bg-black/40 rounded-full p-1 hover:bg-black/60">
        {favoriteKeys.has(getFavoriteKey(item)) ? <FaHeart className="text-red-500" /> : <FaRegHeart className="text-white" />}
      </button>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Filters + Title */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <button type="button" onClick={() => setShowFilters(!showFilters)} className={`text-sm px-3 py-1.5 rounded-md ${showFilters ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
          {showFilters ? 'Hide Filters' : 'Filters'}
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search items, phones, cities..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-2 border rounded-md mb-4 text-sm"
      />

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-gray-50 border rounded-md p-4 mb-6 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" onClick={getUserLocation} className="bg-blue-500 text-white text-sm px-3 py-2 rounded-md">
              📍 Detect Location
            </button>
            <input
              type="text"
              placeholder="ZIP or City"
              value={zipFallback}
              onChange={(e) => setZipFallback(e.target.value)}
              onBlur={lookupZipOrCity}
              className="flex-1 p-2 border rounded-md text-sm"
            />
          </div>

          {tempCoords && (
            <div>
              <label className="block text-sm font-medium mb-1">Radius: {tempRadius} miles</label>
              <input type="range" min="5" max="100" step="5" value={tempRadius} onChange={(e) => setTempRadius(Number(e.target.value))} className="w-full" />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <input type="number" placeholder="Min Price" value={tempMinPrice} onChange={(e) => setTempMinPrice(e.target.value)} className="p-2 border rounded-md text-sm" />
            <input type="number" placeholder="Max Price" value={tempMaxPrice} onChange={(e) => setTempMaxPrice(e.target.value)} className="p-2 border rounded-md text-sm" />
            <select value={tempSort} onChange={(e) => setTempSort(e.target.value)} className="p-2 border rounded-md text-sm">
              <option value="">Sort by</option>
              <option value="newest">Newest</option>
              <option value="priceLow">Price: Low to High</option>
              <option value="priceHigh">Price: High to Low</option>
            </select>
          </div>

          <div className="flex gap-3 mt-3">
            <button type="button" onClick={applyFilters} className="bg-green-600 text-white px-4 py-2 rounded-md text-sm">✅ Apply Filters</button>
            <button type="button" onClick={clearFilters} className="text-red-600 hover:underline text-sm">❌ Clear Filters</button>
          </div>
        </div>
      )}

      {/* Items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {filteredItems.slice(0, visibleCount).map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>

      {/* Empty & Pagination */}
      {filteredItems.length === 0 && (
        <p className="text-center text-gray-500 mt-6">😔 No results found. Try changing your search or filters.</p>
      )}
      {filteredItems.length > visibleCount && (
        <div className="text-center mt-6">
          <button onClick={() => setVisibleCount(visibleCount + 6)} className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 transition">
            Show More
          </button>
        </div>
      )}
    </div>
  );
}
