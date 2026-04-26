'use client';

import { createPortal } from 'react-dom';
import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation'; // This import remains as per your original code
import { supabase } from '@/lib/supabaseClient'; // This import remains as per your original code
import toast from 'react-hot-toast';
import {
    FaInstagram, FaFacebook, FaTiktok, FaGlobe,
    FaShareAlt, FaArrowLeft, FaArrowRight,
    FaPhone, FaEnvelope, FaMapPin,
    FaWhatsapp, FaDirections,
    FaHeart, FaRegHeart, FaCommentDots
} from 'react-icons/fa'; // These imports remain as per your original code
import { FaXTwitter } from 'react-icons/fa6';
import { motion, AnimatePresence } from 'framer-motion'; // This import remains as per your original code
import Script from 'next/script'; // This import remains as per your original code
import Image from 'next/image'; // Added for Image component

import {
    Car, Calendar, Gauge, HeartHandshake,
    Store as StoreIcon,
    ClipboardList as ClipboardListIcon,
    Home, MapPin,
    X, DollarSign, Eye, ChevronLeft, ChevronRight, ChevronDown, Tag, QrCode, Copy, Check, Megaphone, Menu,
    Phone, Mail, Globe, MessageCircle, MessageSquare, Share2, Instagram, Facebook, Twitter, Music2, Navigation,
    Search, Plus,
} from 'lucide-react'; // These imports remain as per your original code

import { cn } from '@/lib/utils'; // This import remains as per your original code
import { getMainCategory } from '@/utils/businessCategories';
import { Playfair_Display, DM_Sans } from 'next/font/google';
import ReportButton from '@/components/ReportButton';
import BusinessCommunityPostsModal, { type BusinessCommunityPostRow } from '@/components/BusinessCommunityPostsModal';

const restaurantHeading = Playfair_Display({ subsets: ['latin'], display: 'swap' });
const restaurantBody = DM_Sans({ subsets: ['latin'], display: 'swap' });

/** Default non-restaurant contact strip (gradient bar) */
const CONTACT_STRIP_CHIP =
  'flex items-center justify-center h-10 px-4 rounded-xl bg-white/10 text-white ring-1 ring-white/20 transition-colors duration-200 hover:bg-white/20 active:scale-[0.98] [&_path]:fill-white';

/** Restaurant: outlined circular icon controls on cream (matches page palette) */
const RESTAURANT_ICON_RING =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#1A472A]/18 bg-white text-[#1A472A] shadow-sm transition hover:border-[#1A472A]/30 hover:bg-[#1A472A]/[0.04] active:scale-[0.98] [&_svg]:stroke-[#1A472A]';

/** Retail mobile storefront (Bagisto-style) */
const RETAIL_HERO_PANEL_BG = '#d4dde8';
const RETAIL_PROMO_STRIP_BG = '#ebe3f4';

/** iBid-style featured color blocks — background only; titles come from real products. */
const IBID_BLOCK_BACKGROUNDS = ['#0d9488', '#ca8a04', '#dc2626', '#2563eb'] as const;

const IBID_PRIMARY_BLUE = '#2563eb';

/** Retail subcategories that use the Bagisto-style storefront (`business.subcategory`). */
function isRetailBagistoSubcategory(sub: string | null | undefined): boolean {
    const s = String(sub || '').trim().toLowerCase();
    return (
        s === 'beauty supply' ||
        s === 'clothing store' ||
        s === 'jewelry store' ||
        s === 'jewerly store'
    );
}

/** Prefix with $ when the value has no currency symbol (avoids "$$12" if data already includes "$"). */
function formatPriceWithCurrency(raw: string | number | undefined | null): string {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    if (/[$€£¥₹]/.test(s.slice(0, 4)) || /(^|\s)(USD|EUR|GBP|CAD|AUD)(\s|$)/i.test(s)) return s;
    return `$${s}`;
}

function sanitizeHexColor(value: string | null | undefined, fallback: string): string {
    const v = String(value || '').trim();
    const normalized = v.startsWith('#') ? v : v ? `#${v}` : '';
    return /^#[0-9a-fA-F]{6}$/i.test(normalized) ? `#${normalized.slice(1).toLowerCase()}` : fallback;
}

/** Returns normalized #rrggbb or null if unset/invalid (dashboard may omit #). */
function tryHexColor6(value: string | null | undefined): string | null {
    const v = String(value || '').trim();
    const normalized = v.startsWith('#') ? v : v ? `#${v}` : '';
    return /^#[0-9a-fA-F]{6}$/i.test(normalized) ? `#${normalized.slice(1).toLowerCase()}` : null;
}

function hexToRgba(hex: string, alpha: number): string {
    const h = sanitizeHexColor(hex, '#0c1f3c').replace(/^#/, '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function buildSlugBackground(primary: string, secondary: string, useGradient: boolean): string {
    return useGradient ? `linear-gradient(90deg, ${primary}, ${secondary})` : primary;
}

// Types
interface BusinessType {
    id: string;
    business_name: string;
    category: string;
    subcategory?: string | null;
    moderation_status?: 'on_hold' | 'active' | 'rejected';
    lifecycle_status?: 'unclaimed' | 'trial' | 'active' | 'expired' | 'archived';
    status?: string;
    is_archived?: boolean;
    address: {
        street?: string;
        city?: string;
        state?: string;
        zip?: string;
    };
    hours: string | Record<string, string>;
    description: string;
    whatsapp?: string;
    phone?: string;
    email?: string;
    website?: string;
    logo_url?: string;
    images?: string[];
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    twitter?: string;
    slug: string;
    tags?: string[];
    owner_id?: string | null;
    slug_primary_color?: string | null;
    slug_secondary_color?: string | null;
    slug_use_gradient?: boolean | null;
    slug_retail_search_accent_color?: string | null;
    slug_view_detail_button_color?: string | null;
    slug_sidebar_menu_button_color?: string | null;
    isrestaurant?: boolean | null;
}

// Add window callback type
declare global {
    interface Window {
        initMapCallback?: () => void;
    }
}

interface MenuItem {
    id: string;
    name: string;
    description: string;
    price?: string | number;
    images: string[]; // This will store full URLs
    image_url?: string | null; // Keep for original fetching, but convert to 'images'
    category?: string;
}

interface CarListing {
    id: string;
    title: string;
    price: string;
    year: string;
    mileage: string;
    condition: string;
    images: string[]; // This will store full URLs
    description?: string; // Add description to car listing for detailed view
}

interface RetailItem {
    id: string;
    name: string;
    price: string;
    description: string;
    images: string[]; // This will store full URLs
    category: string;
}

interface RealEstateListing {
    id: string;
    title: string;
    price: string;
    propertyType: string;
    address: string;
    description: string;
    images: string[];
}

interface ModalProps {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}

// Reusable Modal Component – portal so always in view
const Modal = ({ title, onClose, children }: ModalProps) => {
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);
    const content = (
        <div className="fixed inset-0 z-[9999] bg-black/75 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative p-6" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">{title}</h2>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    aria-label="Close modal"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <div className="modal-content">
                    {children}
                </div>
            </div>
        </div>
    );
    return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};

// --- NEW DetailedViewModal Component ---
interface DetailedViewModalProps {
    item: MenuItem | CarListing | RetailItem | RealEstateListing;
    type: 'menu' | 'car' | 'retail' | 'real_estate';
    onClose: () => void;
}

const DetailedViewModal = ({ item, type, onClose }: DetailedViewModalProps) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Ensure images are always an array of strings (URLs)
    const images: string[] = item.images && Array.isArray(item.images) ? item.images : [];

    // Determine the title dynamically based on item type
    const modalTitle =
        type === 'menu' ? (item as MenuItem).name :
        type === 'car' ? (item as CarListing).title :
        type === 'real_estate' ? (item as RealEstateListing).title :
        (item as RetailItem).name;

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    const content = (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={modalTitle}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto relative p-4 sm:p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-3">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{modalTitle}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        aria-label="Close modal"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Image Gallery */}
                {images.length > 0 ? (
                    <div className="mb-4">
                        <div className="relative h-60 sm:h-72 mb-3 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                            <img
                                src={images[currentImageIndex]}
                                alt={`${modalTitle} image ${currentImageIndex + 1}`}
                                className="w-full h-full object-contain"
                                onError={(e) => { e.currentTarget.src = 'https://placehold.co/600x400?text=Image+Not+Available'; e.currentTarget.onerror = null; }}
                            />
                            {images.length > 1 && (
                                <>
                                    <button
                                        onClick={() => setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 z-10"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    <button
                                        onClick={() => setCurrentImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 z-10"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </>
                            )}
                        </div>
                        {images.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-1 justify-center">
                                {images.map((img: string, index: number) => (
                                    <button
                                        key={index} // Using index here is fine for thumbnails if order doesn't change during modal life
                                        onClick={() => setCurrentImageIndex(index)}
                                        className={`w-16 h-16 flex-shrink-0 rounded-md overflow-hidden border-2 ${
                                            currentImageIndex === index ? 'border-[#b91c1c]' : 'border-transparent'
                                        }`}
                                    >
                                        <img
                                            src={img}
                                            alt={`Thumbnail ${index + 1}`}
                                            className="w-full h-full object-cover"
                                            onError={(e) => { e.currentTarget.src = 'https://placehold.co/80x80?text=Thumb'; e.currentTarget.onerror = null; }}
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="w-full h-48 bg-gray-100 dark:bg-gray-700 flex items-center justify-center rounded-xl mb-4">
                        <span className="text-gray-500 dark:text-gray-400 italic">No Images Available</span>
                    </div>
                )}

                {/* Item Details */}
                <div className="space-y-3 text-gray-800 dark:text-gray-200 text-sm">
                    {/* Price for Car Listings */}
                    {type === 'car' && (item as CarListing).price && (
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <DollarSign size={18} className="text-gray-500" />
                            <span className="text-gray-700 dark:text-gray-300">
                                Price: {formatPriceWithCurrency((item as CarListing).price)}
                            </span>
                        </div>
                    )}

                    {/* Price for Menu, Retail, and Real Estate Items */}
                    {(type === 'menu' || type === 'retail' || type === 'real_estate') && (item as MenuItem | RetailItem | RealEstateListing).price && (
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <DollarSign size={18} className="text-gray-500" />
                            <span className="text-gray-700 dark:text-gray-300">
                                Price: {formatPriceWithCurrency((item as MenuItem | RetailItem | RealEstateListing).price)}
                            </span>
                        </div>
                    )}

                    {/* Car Specific Details */}
                    {type === 'car' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            {(item as CarListing).year && (
                                <div className="flex items-center gap-2">
                                    <Calendar size={18} className="text-gray-500" />
                                    <span className="text-gray-700 dark:text-gray-300">Year: {(item as CarListing).year}</span>
                                </div>
                            )}
                            {(item as CarListing).mileage && (
                                <div className="flex items-center gap-2">
                                    <Gauge size={18} className="text-gray-500" />
                                    <span className="text-gray-700 dark:text-gray-300">Mileage: {(item as CarListing).mileage}</span>
                                </div>
                            )}
                            {(item as CarListing).condition && (
                                <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                                    <HeartHandshake size={18} className="text-gray-500" />
                                    <span className="text-gray-700 dark:text-gray-300">Condition: {(item as CarListing).condition}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Retail Item Category */}
                    {type === 'retail' && (item as RetailItem).category && (
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <Tag size={18} className="text-gray-500" />
                            <span className="text-gray-700 dark:text-gray-300">Category: {(item as RetailItem).category}</span>
                        </div>
                    )}

                    {/* Real Estate Address */}
                    {type === 'real_estate' && (item as RealEstateListing).address && (
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <MapPin size={18} className="text-gray-500" />
                            <span className="text-gray-700 dark:text-gray-300">{(item as RealEstateListing).address}</span>
                        </div>
                    )}

                    {/* Real Estate Property Type */}
                    {type === 'real_estate' && (item as RealEstateListing).propertyType && (
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <Home size={18} className="text-gray-500" />
                            <span className="text-gray-700 dark:text-gray-300">Type: {(item as RealEstateListing).propertyType}</span>
                        </div>
                    )}

                    {/* Description */}
                    {(item as any).description && ( // description is common to all types
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <h3 className="text-base font-semibold mb-2">Description</h3>
                            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{(item as any).description}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
    return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};


const BusinessMap = ({ address }: { address: BusinessType['address'] }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const fullAddress = `${address.street || ''}, ${address.city || ''}, ${address.state || ''} ${address.zip || ''}`;
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mapInitialized, setMapInitialized] = useState(false);
    const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    const initMap = useCallback(() => {
        if (!window.google || !mapRef.current || mapInitialized) return;
        if (!address.street || !address.city || !address.state) {
            setError("Missing complete address information for map.");
            setIsLoaded(true);
            return;
        }
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: fullAddress }, (results, status) => {
            if (status === window.google.maps.GeocoderStatus.OK && results && results.length > 0) {
                const location = results[0].geometry.location;
                const map = new window.google.maps.Map(mapRef.current!, {
                    center: location,
                    zoom: 15,
                    mapTypeId: 'roadmap',
                });

                // Create standard marker
                new window.google.maps.Marker({
                    map,
                    position: location,
                    title: fullAddress,
                });

                setMapInitialized(true);
            } else {
                setError('Could not find location on map: ' + status);
            }
            setIsLoaded(true);
        });
    }, [fullAddress, mapInitialized, address.street, address.city, address.state]);

    useEffect(() => {
        if (window.google && !mapInitialized) {
            setIsLoaded(true);
            initMap();
        } else if (!GOOGLE_MAPS_API_KEY) {
            setError("Google Maps API Key is missing. Map cannot be loaded.");
            setIsLoaded(true);
        }
    }, [isLoaded, initMap, mapInitialized, GOOGLE_MAPS_API_KEY]);

    // Add global callback for Google Maps
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.initMapCallback = () => {
                setIsLoaded(true);
                initMap();
            };
        }
        return () => {
            if (typeof window !== 'undefined') {
                delete window.initMapCallback;
            }
        };
    }, [initMap]);

    return (
        <div className="w-full">
            {GOOGLE_MAPS_API_KEY && !isLoaded && (
                <Script
                    src={`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMapCallback`}
                    strategy="afterInteractive"
                    async
                    defer
                    onError={() => { setError('Failed to load Google Maps script.'); setIsLoaded(true); }}
                />
            )}
            <div
                ref={mapRef}
                className={cn(
                    "w-full h-[200px] sm:h-[250px] rounded-none sm:rounded-b-xl",
                    "overflow-hidden",
                    "transition-all duration-300",
                    !isLoaded ? "opacity-0" : "opacity-100"
                )}
            >
                {!isLoaded && !error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                        <div className="w-[80px] h-[80px] rounded-full bg-gray-300 dark:bg-gray-700 animate-spin" />
                    </div>
                )}
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center text-center bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded-xl p-4">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};

const BusinessProfilePage = () => {
    const params = useParams();
    const slug = typeof params?.slug === 'string' ? params.slug : '';

    const [business, setBusiness] = useState<BusinessType | null>(null);
    const [menu, setMenu] = useState<MenuItem[]>([]);
    const [carListings, setCarListings] = useState<CarListing[]>([]);
    const [retailItems, setRetailItems] = useState<RetailItem[]>([]);
    const [realEstateListings, setRealEstateListings] = useState<RealEstateListing[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isFavorited, setIsFavorited] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

    // Modal visibility states (Added new)
    const [showMenuModal, setShowMenuModal] = useState(false);
    const [showCarsModal, setShowCarsModal] = useState(false);
    const [showHours, setShowHours] = useState(false);
    const [showQrModal, setShowQrModal] = useState(false);
    const [qrCopied, setQrCopied] = useState(false);
    const [communityPosts, setCommunityPosts] = useState<BusinessCommunityPostRow[]>([]);
    const [communityCommentCounts, setCommunityCommentCounts] = useState<Record<string, number>>({});
    const [communityPostsLoading, setCommunityPostsLoading] = useState(false);
    const [showCommunityModal, setShowCommunityModal] = useState(false);
    const [slugSidebarMenuOpen, setSlugSidebarMenuOpen] = useState(false);
    /** Portal target ready (avoids SSR/hydration issues; keeps drawer `fixed` to viewport). */
    const [slugSidebarPortalReady, setSlugSidebarPortalReady] = useState(false);
    const [retailShopSearchQuery, setRetailShopSearchQuery] = useState('');
    /** Hide header/strip product search after scrolling down; show again near top of page. */
    const [showRetailStickyProductSearch, setShowRetailStickyProductSearch] = useState(true);
    const [retailCategoryFilter, setRetailCategoryFilter] = useState<string | null>(null);
    const [dealershipPriceFilter, setDealershipPriceFilter] = useState<
        'all' | 'under_10000' | 'under_20000' | 'under_30000' | 'above_30000'
    >('all');
    const DEALERSHIP_LISTINGS_PER_PAGE = 4;
    const [dealershipListingsPage, setDealershipListingsPage] = useState(1);

    const ITEMS_PER_BATCH = 6;
    const [visibleMenuCount, setVisibleMenuCount] = useState(ITEMS_PER_BATCH);
    const [visibleCarCount, setVisibleCarCount] = useState(ITEMS_PER_BATCH);
    const [visibleRetailCount, setVisibleRetailCount] = useState(ITEMS_PER_BATCH);
    const [visibleRealEstateCount, setVisibleRealEstateCount] = useState(ITEMS_PER_BATCH);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const loadMoreTimerRef = useRef<number | null>(null);
    const touchStartXRef = useRef<number | null>(null);
    const touchEndXRef = useRef<number | null>(null);
    /** Open dealership menu only on tap, not after a swipe/drag on the burger icon */
    const dealershipBurgerPointerOrigin = useRef<{ x: number; y: number } | null>(null);
    const dealershipBurgerPointerCancelled = useRef(false);

    // Add new state for detailed view of individual item cards
    const [selectedItemForDetails, setSelectedItemForDetails] = useState<{
        type: 'menu' | 'car' | 'retail' | 'real_estate';
        item: MenuItem | CarListing | RetailItem | RealEstateListing;
    } | null>(null);

    const webBusinessUrl = useMemo(() => {
        if (!slug) return '';
        if (typeof window !== 'undefined') return `${window.location.origin}/business/${slug}`;
        return `https://hanar.net/business/${slug}`;
    }, [slug]);
    const qrTargetUrl = useMemo(() => {
        if (!webBusinessUrl) return '';
        return `${webBusinessUrl}${webBusinessUrl.includes('?') ? '&' : '?'}open_app=1`;
    }, [webBusinessUrl]);
    const qrImageUrl = useMemo(() => {
        if (!qrTargetUrl) return '';
        return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(qrTargetUrl)}`;
    }, [qrTargetUrl]);

    useEffect(() => {
        setVisibleMenuCount(ITEMS_PER_BATCH);
        setVisibleCarCount(ITEMS_PER_BATCH);
        setVisibleRetailCount(ITEMS_PER_BATCH);
        setVisibleRealEstateCount(ITEMS_PER_BATCH);
    }, [menu.length, carListings.length, retailItems.length, realEstateListings.length]);

    useEffect(() => {
        setSlugSidebarPortalReady(true);
    }, []);

    useEffect(() => {
        setSlugSidebarMenuOpen(false);
        setRetailShopSearchQuery('');
        setShowRetailStickyProductSearch(true);
        setRetailCategoryFilter(null);
        setDealershipPriceFilter('all');
        setDealershipListingsPage(1);
    }, [slug]);

    useEffect(() => {
        setDealershipListingsPage(1);
    }, [dealershipPriceFilter]);

    useEffect(() => {
        if (!slugSidebarMenuOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [slugSidebarMenuOpen]);

    const hasMoreItems =
        visibleMenuCount < menu.length ||
        visibleCarCount < carListings.length ||
        visibleRetailCount < retailItems.length ||
        visibleRealEstateCount < realEstateListings.length;

    useEffect(() => {
        if (!hasMoreItems || !loadMoreRef.current) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries[0]?.isIntersecting) return;
                if (loadMoreTimerRef.current) {
                    window.clearTimeout(loadMoreTimerRef.current);
                }
                loadMoreTimerRef.current = window.setTimeout(() => {
                    setIsLoadingMore(true);
                }, 200);
                setVisibleMenuCount((prev) => Math.min(prev + ITEMS_PER_BATCH, menu.length));
                setVisibleCarCount((prev) => Math.min(prev + ITEMS_PER_BATCH, carListings.length));
                setVisibleRetailCount((prev) => Math.min(prev + ITEMS_PER_BATCH, retailItems.length));
                setVisibleRealEstateCount((prev) => Math.min(prev + ITEMS_PER_BATCH, realEstateListings.length));
                window.setTimeout(() => {
                    if (loadMoreTimerRef.current) {
                        window.clearTimeout(loadMoreTimerRef.current);
                        loadMoreTimerRef.current = null;
                    }
                    setIsLoadingMore(false);
                }, 500);
            },
            { rootMargin: '200px' }
        );
        observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [hasMoreItems, menu.length, carListings.length, retailItems.length, realEstateListings.length]);

    useEffect(() => {
        if (!business?.slug) return;
        let cancelled = false;
        (async () => {
            setCommunityPostsLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const params = new URLSearchParams({ businessSlug: business.slug });
                if (user?.id) params.set('viewerUserId', user.id);
                const res = await fetch(`/api/community/posts?${params.toString()}`);
                const json = await res.json();
                if (cancelled || !res.ok) return;
                setCommunityPosts(json.posts || []);
                setCommunityCommentCounts(json.commentCounts || {});
            } catch {
                if (!cancelled) {
                    setCommunityPosts([]);
                    setCommunityCommentCounts({});
                }
            } finally {
                if (!cancelled) setCommunityPostsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [business?.slug]);

    // Delete functions (UNCHANGED)
    const deleteMenuItem = async (itemId: string) => {
        if (!business) return;
        if (!confirm('Are you sure you want to delete this menu item?')) return;
        setDeleteLoading(itemId);
        try {
            const { error } = await supabase
                .from('menu_items')
                .delete()
                .eq('id', itemId)
                .eq('business_id', business.id);

            if (error) throw error;
            setMenu(prev => prev.filter(item => item.id !== itemId));
        } catch (error) {
            console.error('Error deleting menu item:', error);
            alert('Failed to delete menu item');
        } finally {
            setDeleteLoading(null);
        }
    };

    const deleteCarListing = async (itemId: string) => {
        if (!business) return;
        if (!confirm('Are you sure you want to delete this car listing? This will also delete all associated images.')) return;
        setDeleteLoading(itemId);
        try {
            // First, get the car listing to access its images
            const { data: carListing, error: fetchError } = await supabase
                .from('dealerships')
                .select('images')
                .eq('id', itemId)
                .single();

            if (fetchError) throw fetchError;

            // Delete images from storage if they exist
            if (carListing?.images) {
                const images = Array.isArray(carListing.images)
                    ? carListing.images
                    : typeof carListing.images === 'string'
                        ? JSON.parse(carListing.images)
                        : [];

                // Delete each image from storage
                const deletePromises = images.map(async (imagePath: string) => {
                    // Extract relative path if it's a full URL
                    const parts = imagePath.split('/storage/v1/object/public/car-listings/');
                    const relativePath = parts.length > 1 ? parts[1] : imagePath; // Use full path if split fails or it's already relative

                    if (!relativePath || relativePath.startsWith('http')) return; // Skip if empty or already full URL
                    const { error: storageError } = await supabase
                        .storage
                        .from('car-listings')
                        .remove([relativePath]);

                    if (storageError) {
                        console.error('Error deleting image from storage:', storageError);
                    }
                });

                await Promise.all(deletePromises);
            }

            // Delete the car listing from the database
            const { error: deleteError } = await supabase
                .from('dealerships')
                .delete()
                .eq('id', itemId)
                .eq('business_id', business.id);

            if (deleteError) throw deleteError;

            // Update local state
            setCarListings(prev => prev.filter(item => item.id !== itemId));
        } catch (error) {
            console.error('Error deleting car listing:', error);
            alert('Failed to delete car listing');
        } finally {
            setDeleteLoading(null);
        }
    };

    const deleteRetailItem = async (itemId: string) => {
        if (!business) return;
        if (!confirm('Are you sure you want to delete this retail item?')) return;
        setDeleteLoading(itemId);
        try {
            const { error } = await supabase
                .from('retail_items')
                .delete()
                .eq('id', itemId)
                .eq('business_id', business.id);

            if (error) throw error;
            setRetailItems(prev => prev.filter(item => item.id !== itemId));
        } catch (error) {
            console.error('Error deleting retail item:', error);
            alert('Failed to delete retail item');
        } finally {
            setDeleteLoading(null);
        }
    };

    // Fetch business and related data
    useEffect(() => {
        if (!slug) { setLoading(false); return; }
        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: businessData, error: businessError } = await supabase
                    .from('businesses')
                    .select('*')
                    .eq('slug', slug)
                    .in('moderation_status', ['active', 'on_hold'])
                    .eq('is_archived', false)
                    .neq('lifecycle_status', 'archived')
                    .single();

                if (businessError || !businessData) {
                    setBusiness(null);
                } else {
                    // Unclaimed imported businesses (on_hold + no owner) must not appear publicly
                    if (businessData.moderation_status === 'on_hold' && !businessData.owner_id) {
                        setBusiness(null);
                        setLoading(false);
                        return;
                    }
                    // On-hold businesses: show only to owner
                    if (businessData.moderation_status === 'on_hold' && businessData.owner_id) {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user?.id !== businessData.owner_id) {
                            setBusiness(null);
                            setLoading(false);
                            return;
                        }
                    }

                    // Helper to get full public URL for storage paths
                    const getPublicStorageUrl = (bucket: string, path: string | null): string | null => {
                        if (!path) return null;
                        if (path.startsWith('http')) return path; // Already a full URL
                        // This assumes your Supabase project URL is available as an env var
                        // Ensure process.env.NEXT_PUBLIC_SUPABASE_URL is correctly configured
                        return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
                    };

                    // Function to process images from DB, ensuring they are always full URLs in an array
                    const processDbImages = (imagesData: string | string[] | null, bucketName: string): string[] => {
                        if (!imagesData) return [];
                        let imagesArray: string[] = [];
                        if (typeof imagesData === 'string') {
                            try {
                                const parsed = JSON.parse(imagesData);
                                imagesArray = Array.isArray(parsed) ? parsed : [imagesData];
                            } catch (e) {
                                imagesArray = [imagesData]; // Treat as single string path if not JSON
                            }
                        } else if (Array.isArray(imagesData)) {
                            imagesArray = imagesData;
                        }

                        // Convert all paths to full public URLs
                        return imagesArray
                            .map(path => getPublicStorageUrl(bucketName, path))
                            .filter((url): url is string => url !== null);
                    };


                    const normalizedAddress = (() => {
                        if (typeof businessData.address === 'string') {
                            try {
                                const parsed = JSON.parse(businessData.address);
                                return typeof parsed === 'object' && parsed ? parsed : {};
                            } catch {
                                return {};
                            }
                        }
                        return typeof businessData.address === 'object' && businessData.address
                            ? businessData.address
                            : {};
                    })();

                    const normalizedBusiness: BusinessType = {
                        ...(businessData as BusinessType),
                        address: normalizedAddress,
                        images: processDbImages(businessData.images, 'business-uploads'),
                        logo_url: getPublicStorageUrl('business-uploads', businessData.logo_url || null) || businessData.logo_url,
                    };

                    setBusiness(normalizedBusiness);

                    // Track view (internal count; not shown to public)
                    fetch('/api/track-view', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'business', id: businessData.id }),
                    }).catch(() => {});

                    const [carRes, menuRes, retailRes, realEstateRes] = await Promise.all([
                        supabase.from('dealerships').select('*').eq('business_id', businessData.id),
                        supabase.from('menu_items').select('*').eq('business_id', businessData.id),
                        supabase.from('retail_items').select('*').eq('business_id', businessData.id),
                        supabase.from('real_estate_listings').select('*').eq('business_id', businessData.id),
                    ]);

                    if (carRes.error) {
                        console.error('Error fetching car listings:', carRes.error);
                        setCarListings([]);
                    } else {
                        const sortedCarData = (carRes.data || []).slice().sort((a: any, b: any) => {
                            const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
                            const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
                            return bTime - aTime;
                        });
                        setCarListings(sortedCarData.map((item: any) => ({
                            id: item.id,
                            title: item.title || item.name,
                            price: item.price?.toString() ?? '',
                            year: item.year,
                            mileage: item.mileage,
                            condition: item.condition,
                            description: item.description, // Ensure description is fetched for detailed view
                            images: processDbImages(item.images, 'car-listings'),
                        })));
                    }

                    if (menuRes.error) {
                        console.error('Error fetching menu items:', menuRes.error);
                        setMenu([]);
                    } else {
                        const sortedMenuData = (menuRes.data || []).slice().sort((a: any, b: any) => {
                            const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
                            const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
                            return bTime - aTime;
                        });

                        const menuItemIds = sortedMenuData.map((item: any) => item.id).filter(Boolean);
                        let menuPhotosById: Record<string, string[]> = {};
                        if (menuItemIds.length > 0) {
                            const { data: menuPhotos, error: menuPhotosError } = await supabase
                                .from('menu_item_photos')
                                .select('menu_item_id, storage_path, sort_order')
                                .in('menu_item_id', menuItemIds)
                                .order('sort_order', { ascending: true });

                            if (menuPhotosError) {
                                console.error('Error fetching menu item photos:', menuPhotosError);
                            } else if (menuPhotos && menuPhotos.length > 0) {
                                menuPhotosById = menuPhotos.reduce((acc: Record<string, string[]>, photo: any) => {
                                    if (!acc[photo.menu_item_id]) acc[photo.menu_item_id] = [];
                                    acc[photo.menu_item_id].push(photo.storage_path);
                                    return acc;
                                }, {});
                            }
                        }

                        setMenu(sortedMenuData.map((item: any) => {
                            const photoPaths = menuPhotosById[item.id] || [];
                            const photoUrls = photoPaths
                                .map((path) => getPublicStorageUrl('restaurant-menu', path))
                                .filter((url): url is string => Boolean(url));

                            const fallbackImages = item.image_url
                                ? processDbImages(item.image_url, 'restaurant-menu')
                                : processDbImages(item.images, 'restaurant-menu');

                            return {
                                id: item.id,
                                name: item.name || '',
                                description: item.description || '',
                                price: item.price?.toString() ?? '',
                                category: item.category,
                                images: photoUrls.length ? photoUrls : fallbackImages,
                            };
                        }));
                    }

                    if (retailRes.error) {
                        console.error('Error fetching retail items:', retailRes.error);
                        setRetailItems([]);
                    } else {
                        const sortedRetailData = (retailRes.data || []).slice().sort((a: any, b: any) => {
                            const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
                            const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
                            return bTime - aTime;
                        });
                        setRetailItems(sortedRetailData.map((item: any) => ({
                            id: item.id,
                            name: item.name || '',
                            price: item.price?.toString() ?? '',
                            description: item.description || '',
                            category: item.category,
                            images: processDbImages(item.images, 'retail-items'),
                        })));
                    }

                    if (realEstateRes.error) {
                        console.error('Error fetching real estate listings:', realEstateRes.error);
                        setRealEstateListings([]);
                    } else {
                        const sortedRealEstateData = (realEstateRes.data || []).slice().sort((a: any, b: any) => {
                            const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
                            const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
                            return bTime - aTime;
                        });
                        setRealEstateListings(sortedRealEstateData.map((item: any) => ({
                            id: item.id,
                            title: item.title || '',
                            price: item.price != null ? String(item.price) : '',
                            propertyType: item.property_type || '',
                            address: item.address || '',
                            description: item.description || '',
                            images: processDbImages(item.images, 'real-estate-listings'),
                        })));
                    }

                    if (typeof window !== 'undefined') {
                        document.title = `${businessData.business_name} - Hanar`;
                    }

                    const { data: { user } } = await supabase.auth.getUser();
                    if (user && businessData?.id) {
                        const { data: favoriteRow, error: favoriteError } = await supabase
                            .from('business_favorites')
                            .select('id')
                            .eq('user_id', user.id)
                            .eq('business_id', businessData.id)
                            .maybeSingle();
                        if (favoriteError) {
                            console.error('Failed to load favorite status:', favoriteError);
                            setIsFavorited(false);
                        } else {
                            setIsFavorited(Boolean(favoriteRow?.id));
                        }
                    } else {
                        setIsFavorited(false);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch business data:", err);
                setBusiness(null);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [slug]);


    const formatBusinessCategory = (value?: string | null) => {
        const normalized = (value || '').trim().toLowerCase();
        if (!normalized) return '';
        if (normalized === 'something_else' || normalized === 'other') return '';
        if (normalized === 'retails') return 'Retail';
        return value || '';
    };

    // Derive business type flags from main category (Dealership, Food, Retail, Real Estate, Services)
    const mainCat = (business?.category || '').toLowerCase();
    const isRestaurant =
        business?.isrestaurant === true
        || mainCat === 'food'
        || (business?.category || '').toLowerCase().includes('restaurant')
        || (business?.category || '').toLowerCase().includes('food');
    const isDealership = mainCat === 'dealership' || business?.category?.toLowerCase().includes('auto') || business?.category?.toLowerCase().includes('car');
    const isRetail = mainCat === 'retail'
        || business?.category?.toLowerCase().includes('store')
        || business?.category?.toLowerCase().includes('shop')
        || business?.category?.toLowerCase().includes('other')
        || business?.category?.toLowerCase().includes('something_else');
    const displayCategory = formatBusinessCategory(business?.subcategory || business?.category);

    const isRetailShopPage =
        !isDealership &&
        !isRestaurant &&
        getMainCategory(business?.category) === 'Retail' &&
        retailItems.length > 0 &&
        isRetailBagistoSubcategory(business?.subcategory);

    const isRetailBaselPage =
        !isDealership &&
        !isRestaurant &&
        getMainCategory(business?.category) === 'Retail' &&
        retailItems.length > 0 &&
        !isRetailBagistoSubcategory(business?.subcategory);

    const retailCategoryChips = useMemo(() => {
        const map = new Map<string, { label: string; image?: string }>();
        retailItems.forEach((item) => {
            const c = (item.category || '').trim();
            if (!c) return;
            const key = c.toLowerCase();
            if (!map.has(key)) {
                map.set(key, { label: c, image: item.images?.[0] });
            }
        });
        return Array.from(map.values());
    }, [retailItems]);

    const retailShopSearchFiltered = useMemo(() => {
        const q = retailShopSearchQuery.trim().toLowerCase();
        if (!q) return retailItems;
        return retailItems.filter(
            (i) =>
                i.name.toLowerCase().includes(q) ||
                (i.description || '').toLowerCase().includes(q) ||
                (i.category || '').toLowerCase().includes(q)
        );
    }, [retailItems, retailShopSearchQuery]);

    const retailShopProducts = useMemo(() => {
        let list = retailShopSearchFiltered;
        if (retailCategoryFilter) {
            const f = retailCategoryFilter.trim().toLowerCase();
            list = list.filter((i) => (i.category || '').trim().toLowerCase() === f);
        }
        return list;
    }, [retailShopSearchFiltered, retailCategoryFilter]);

    const retailBaselFeaturedCategoryLabel = retailCategoryChips[0]?.label ?? business?.business_name ?? 'Shop';

    /** Basel storefront: non-overlapping preview rows (Latest → promo blocks → phone grid). */
    const retailBaselPreviewLatest = useMemo(() => retailShopProducts.slice(0, 4), [retailShopProducts]);
    const retailBaselPreviewBlocks = useMemo(() => retailShopProducts.slice(4, 8), [retailShopProducts]);
    const retailBaselPhoneGridItems = useMemo(() => retailShopProducts.slice(8, 12), [retailShopProducts]);

    useEffect(() => {
        const labels = new Set(retailCategoryChips.map((c) => c.label.trim().toLowerCase()));
        if (retailCategoryFilter != null && !labels.has(retailCategoryFilter.trim().toLowerCase())) {
            setRetailCategoryFilter(null);
        }
    }, [retailCategoryChips, retailCategoryFilter]);

    const retailHeroImage =
        business?.images?.[selectedIndex] ||
        business?.images?.[0] ||
        retailItems[0]?.images?.[0] ||
        'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1400&q=80';

    const retailPromoStripText = useMemo(() => {
        const desc = (business?.description || '').trim();
        if (desc.length >= 24) {
            const line = desc.split('\n')[0]?.trim();
            if (line && line.length <= 120) return line.toUpperCase();
        }
        return 'Get UPTO 40% OFF on your 1st order SHOP NOW';
    }, [business?.description]);


    // Carousel handlers for main business gallery
    const nextImage = () => setSelectedIndex((prevIndex) => (prevIndex + 1) % (business?.images?.length || 1));
    const prevImage = () =>
        setSelectedIndex((prevIndex) => (prevIndex - 1 + (business?.images?.length || 1)) % (business?.images?.length || 1));
    const handleGalleryTouchStart = (event: React.TouchEvent) => {
        touchStartXRef.current = event.touches[0]?.clientX ?? null;
        touchEndXRef.current = touchStartXRef.current;
    };
    const handleGalleryTouchMove = (event: React.TouchEvent) => {
        touchEndXRef.current = event.touches[0]?.clientX ?? touchEndXRef.current;
    };
    const handleGalleryTouchEnd = () => {
        if (touchStartXRef.current === null || touchEndXRef.current === null) return;
        const deltaX = touchStartXRef.current - touchEndXRef.current;
        if (Math.abs(deltaX) > 50) {
            if (deltaX > 0) {
                nextImage();
            } else {
                prevImage();
            }
        }
        touchStartXRef.current = null;
        touchEndXRef.current = null;
    };
    const toggleFavorite = async () => {
        if (!business) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error('Login required to favorite businesses.');
                return;
            }

            if (isFavorited) {
                const { error } = await supabase
                    .from('business_favorites')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('business_id', business.id);
                if (error) throw error;
                setIsFavorited(false);
            } else {
                const { error } = await supabase
                    .from('business_favorites')
                    .insert({ user_id: user.id, business_id: business.id });
                if (error) throw error;
                setIsFavorited(true);
            }
        } catch (err: any) {
            toast.error(err?.message || 'Failed to update favorite');
        }
    };
    const fallbackShare = (message: string, url: string) => {
        const mailto = `mailto:?subject=${encodeURIComponent(message)}&body=${encodeURIComponent(url)}`;
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const sms = `sms:${isIOS ? '&' : '?'}body=${encodeURIComponent(`${message} ${url}`)}`;
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(url).catch(() => {});
        }
        if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            window.location.href = sms;
        } else {
            window.location.href = mailto;
        }
    };
    const handleShare = () => {
        if (!business) return;
        const url = window.location.href;
        const text = business.description;
        if (navigator.share) {
            navigator.share({
                title: business.business_name,
                text,
                url,
            });
        } else {
            fallbackShare(business.business_name, url);
        }
    };
    const handleItemShare = (itemLabel: string) => {
        if (!business) return;
        const url = window.location.href;
        const text = `${itemLabel} at ${business.business_name}`;
        if (navigator.share) {
            navigator.share({
                title: business.business_name,
                text,
                url,
            });
        } else {
            fallbackShare(text, url);
        }
    };
    const formatMenuCategory = useCallback((rawCategory?: string) => {
        const normalized = (rawCategory || '').trim().toLowerCase();
        if (!normalized) return 'Other';
        if (['appetizer', 'appetizers', 'starter', 'starters'].includes(normalized)) return 'Appetizers';
        if (['main', 'mains', 'main course', 'main courses', 'entree', 'entrees'].includes(normalized)) return 'Mains';
        if (['side', 'sides'].includes(normalized)) return 'Sides';
        if (['dessert', 'desserts', 'sweet', 'sweets'].includes(normalized)) return 'Desserts';
        if (['drink', 'drinks', 'beverage', 'beverages'].includes(normalized)) return 'Drinks';
        if (['special', 'specials'].includes(normalized)) return 'Specials';
        return normalized
            .split(/[\s-]+/)
            .map((word) => (word ? `${word[0].toUpperCase()}${word.slice(1)}` : ''))
            .join(' ');
    }, []);

    const groupMenuItems = useCallback((items: MenuItem[]) => {
        const groups: Record<string, MenuItem[]> = {};
        items.forEach((item) => {
            const key = formatMenuCategory(item.category);
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
        });
        const categoryOrder = ['Appetizers', 'Mains', 'Sides', 'Desserts', 'Drinks', 'Specials', 'Other'];
        return Object.entries(groups)
            .sort(([a], [b]) => {
                const aIndex = categoryOrder.indexOf(a);
                const bIndex = categoryOrder.indexOf(b);
                if (aIndex !== -1 || bIndex !== -1) {
                    if (aIndex === -1) return 1;
                    if (bIndex === -1) return -1;
                    return aIndex - bIndex;
                }
                return a.localeCompare(b);
            })
            .map(([category, items]) => ({
                category,
                items: items.slice().sort((a, b) => a.name.localeCompare(b.name)),
            }));
    }, [formatMenuCategory]);
    const groupedMenu = useMemo(() => groupMenuItems(menu), [menu, groupMenuItems]);
    const groupedVisibleMenu = useMemo(
        () => groupMenuItems(menu.slice(0, visibleMenuCount)),
        [menu, visibleMenuCount, groupMenuItems]
    );
    const dealershipPriceFilters = [
        { id: 'under_10000', label: 'Under $10,000' },
        { id: 'under_20000', label: 'Under $20,000' },
        { id: 'under_30000', label: 'Under $30,000' },
        { id: 'above_30000', label: 'Above $30,000' },
    ] as const;
    const parseListingPrice = useCallback((value: string | number | undefined) => {
        const numeric = Number(String(value ?? '').replace(/[^\d.]/g, ''));
        return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
    }, []);
    const formatMileage = useCallback((value?: string) => {
        const numeric = Number(String(value ?? '').replace(/[^\d.]/g, ''));
        if (Number.isFinite(numeric) && numeric > 0) return `${numeric.toLocaleString()} Miles`;
        return value || 'Mileage N/A';
    }, []);
    const filteredDealershipCars = useMemo(() => {
        const withPrice = carListings
            .map((car) => ({ car, numericPrice: parseListingPrice(car.price) }))
            .sort((a, b) => a.numericPrice - b.numericPrice);
        if (dealershipPriceFilter === 'all') {
            return withPrice.map((entry) => entry.car);
        }
        return withPrice
            .filter((entry) => {
                if (dealershipPriceFilter === 'under_10000') return entry.numericPrice < 10000;
                if (dealershipPriceFilter === 'under_20000') return entry.numericPrice < 20000;
                if (dealershipPriceFilter === 'under_30000') return entry.numericPrice < 30000;
                return entry.numericPrice >= 30000;
            })
            .map((entry) => entry.car);
    }, [carListings, dealershipPriceFilter, parseListingPrice]);

    const dealershipTotalPages = useMemo(() => {
        const len = filteredDealershipCars.length;
        if (len === 0) return 0;
        return Math.ceil(len / DEALERSHIP_LISTINGS_PER_PAGE);
    }, [filteredDealershipCars]);

    const dealershipPageCars = useMemo(() => {
        if (dealershipTotalPages === 0) return [];
        const page = Math.min(Math.max(1, dealershipListingsPage), dealershipTotalPages);
        const start = (page - 1) * DEALERSHIP_LISTINGS_PER_PAGE;
        return filteredDealershipCars.slice(start, start + DEALERSHIP_LISTINGS_PER_PAGE);
    }, [filteredDealershipCars, dealershipListingsPage, dealershipTotalPages]);

    useEffect(() => {
        if (dealershipTotalPages === 0) return;
        const clamped = Math.min(Math.max(1, dealershipListingsPage), dealershipTotalPages);
        if (clamped !== dealershipListingsPage) setDealershipListingsPage(clamped);
    }, [dealershipTotalPages, dealershipListingsPage]);

    useEffect(() => {
        if (!isRetailShopPage && !isRetailBaselPage) {
            setShowRetailStickyProductSearch(true);
            return;
        }
        const SCROLL_PX = 56;
        const onScroll = () => {
            const y = typeof window !== 'undefined' ? window.scrollY || document.documentElement.scrollTop : 0;
            setShowRetailStickyProductSearch(y < SCROLL_PX);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [isRetailShopPage, isRetailBaselPage]);

    const getMapUrl = (address: BusinessType['address']) => {
        const { street, city, state, zip } = address;
        const fullAddress = `${street || ''}, ${city || ''}, ${state || ''} ${zip || ''}`;
        const encodedAddress = encodeURIComponent(fullAddress);
        const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
        return isIOS
            ? `https://maps.apple.com/?daddr=${encodedAddress}`
            : `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`; // Corrected Google Maps URL
    };

    if (loading) return (<div className="min-h-screen flex justify-center items-center bg-gray-100 dark:bg-gray-900"><div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-500 dark:border-indigo-400 text-indigo-500 dark:text-indigo-400" /></div>);
    if (!business) return (<div className="min-h-screen flex justify-center items-center text-red-500 dark:text-red-400 text-lg bg-gray-100 dark:bg-gray-900">Business not found or not published yet.</div>);

    const parsedHoursFromString = typeof business.hours === 'string' ? (() => {
        try {
            const parsed = JSON.parse(business.hours);
            return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : null;
        } catch {
            return null;
        }
    })() : null;
    const normalizedHours = typeof business.hours === 'object' && business.hours
        ? (business.hours as Record<string, string>)
        : parsedHoursFromString;
    const fallbackHoursText = typeof business.hours === 'string' && !parsedHoursFromString ? business.hours : null;
    const todayKey = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const todayHours = normalizedHours?.[todayKey] || fallbackHoursText || 'Closed';
    const hoursEntries = normalizedHours ? Object.entries(normalizedHours) : [];
    const hasHours = hoursEntries.length > 0 || Boolean(fallbackHoursText);
    const hasSocials = Boolean(business.instagram || business.facebook || business.tiktok || business.twitter);
    const slugPrimaryColor = sanitizeHexColor(business.slug_primary_color, '#0c1f3c');
    const slugSecondaryColor = sanitizeHexColor(business.slug_secondary_color, '#6b1515');
    const slugUseGradient = business.slug_use_gradient !== false;
    const slugBrandBackground = buildSlugBackground(slugPrimaryColor, slugSecondaryColor, slugUseGradient);
    /**
     * Optional dedicated retail header/search hex; when unset, use the same brand gradient (or solid primary)
     * as menu buttons so primary/secondary edits show on the bar and search CTAs.
     */
    const retailSearchAccentOverride = tryHexColor6(business.slug_retail_search_accent_color);
    const retailSearchAccentSolid = retailSearchAccentOverride ?? slugPrimaryColor;
    const retailSearchBarStyle: CSSProperties = retailSearchAccentOverride
        ? { backgroundColor: retailSearchAccentOverride }
        : { background: slugBrandBackground };
    const retailSearchCtaStyle: { background: string } = retailSearchAccentOverride
        ? { background: retailSearchAccentOverride }
        : { background: slugBrandBackground };
    /** Basel second header row (search strip): light tint from dashboard retail accent / primary. */
    const baselRetailSearchStripBg = hexToRgba(retailSearchAccentSolid, 0.14);
    const viewDetailButtonStyle: { background: string } = business.slug_view_detail_button_color
        ? { background: sanitizeHexColor(business.slug_view_detail_button_color, '#0c1f3c') }
        : { background: slugBrandBackground };
    const sidebarMenuButtonStyle: { background: string } = business.slug_sidebar_menu_button_color
        ? { background: sanitizeHexColor(business.slug_sidebar_menu_button_color, '#0c1f3c') }
        : { background: slugBrandBackground };
    const dealershipMenuActionClassName =
        'inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 [&_path]:fill-white [&_svg]:stroke-white [&_svg]:text-white';

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            className={cn(
                'relative px-0 pt-0 pb-4 min-h-screen overflow-x-clip lg:mx-auto',
                isRetailBaselPage ? 'lg:max-w-[90rem]' : 'lg:max-w-5xl',
                isRetailShopPage || isRetailBaselPage
                    ? 'bg-white font-inter text-neutral-900'
                    : isRestaurant
                      ? 'bg-[#FCF8F1]'
                      : 'font-inter bg-gray-100 dark:bg-gray-900'
            )}
        >
            <svg width={0} height={0} className="pointer-events-none absolute overflow-hidden opacity-0" aria-hidden>
                <defs>
                    <linearGradient id="businessSocialBlueGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#0c1f3c" />
                        <stop offset="50%" stopColor="#1f4f8f" />
                        <stop offset="100%" stopColor="#0c1f3c" />
                    </linearGradient>
                </defs>
            </svg>
            {/* Hanar logo + business name */}
            {isRetailShopPage ? (
                <div className="sticky top-0 z-30 border-b border-white/15 shadow-sm" style={retailSearchBarStyle}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2.5 sm:gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-2 sm:min-w-[12rem]">
                            <Link
                                href="/businesses"
                                className="inline-block shrink-0 rounded-lg bg-white/10 px-1.5 py-0.5 ring-1 ring-white/20 transition hover:bg-white/15"
                                aria-label="Back to Hanar"
                            >
                                <img src="/hanar.logo.png" alt="Hanar" className="h-7 w-auto max-w-[5.5rem] object-contain sm:h-8 sm:max-w-[7rem]" />
                            </Link>
                            {business.logo_url ? (
                                <img
                                    src={business.logo_url}
                                    alt=""
                                    className="h-8 w-8 shrink-0 rounded object-cover sm:h-9 sm:w-9"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                            ) : null}
                            <h1
                                className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold tracking-tight text-white sm:text-sm"
                                data-no-translate
                            >
                                {business.business_name}
                            </h1>
                        </div>
                        <div
                            className={cn(
                                'hidden min-w-0 overflow-hidden sm:flex',
                                'transition-[max-width,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                                showRetailStickyProductSearch
                                    ? 'max-w-md flex-1 opacity-100 md:max-w-lg'
                                    : 'max-w-0 flex-none opacity-0 pointer-events-none'
                            )}
                            aria-hidden={!showRetailStickyProductSearch}
                        >
                            <div className="flex min-w-0 w-full max-w-md flex-1 items-center gap-2 rounded-full border border-zinc-200/90 bg-white px-3 py-2 shadow-sm md:min-w-[14rem]">
                                <input
                                    id="retail-header-search-desktop"
                                    type="search"
                                    value={retailShopSearchQuery}
                                    onChange={(e) => setRetailShopSearchQuery(e.target.value)}
                                    placeholder="Search products"
                                    className="min-w-0 flex-1 bg-white text-sm text-neutral-900 outline-none placeholder:text-zinc-400"
                                    aria-label="Search products"
                                    tabIndex={showRetailStickyProductSearch ? 0 : -1}
                                />
                            </div>
                        </div>
                        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-2.5">
                            {!communityPostsLoading && communityPosts.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setShowCommunityModal(true)}
                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/25 transition hover:bg-white/20 sm:h-10 sm:w-10"
                                    aria-label="Community announcements"
                                >
                                    <Megaphone size={18} aria-hidden />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={toggleFavorite}
                                className={cn(
                                    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/25 transition hover:bg-white/20 sm:h-10 sm:w-10',
                                    isFavorited ? 'text-rose-300' : 'text-white'
                                )}
                                aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                            >
                                {isFavorited ? <FaHeart size={18} /> : <FaRegHeart size={18} />}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowQrModal(true)}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/25 transition hover:bg-white/20 sm:h-10 sm:w-10"
                                aria-label="Show business QR code"
                            >
                                <QrCode size={18} aria-hidden />
                            </button>
                            <button
                                type="button"
                                onPointerDown={(e) => {
                                    dealershipBurgerPointerOrigin.current = { x: e.clientX, y: e.clientY };
                                    dealershipBurgerPointerCancelled.current = false;
                                }}
                                onPointerMove={(e) => {
                                    if (!dealershipBurgerPointerOrigin.current) return;
                                    const dx = e.clientX - dealershipBurgerPointerOrigin.current.x;
                                    const dy = e.clientY - dealershipBurgerPointerOrigin.current.y;
                                    if (Math.hypot(dx, dy) > 12) dealershipBurgerPointerCancelled.current = true;
                                }}
                                onPointerUp={() => {
                                    dealershipBurgerPointerOrigin.current = null;
                                }}
                                onPointerCancel={() => {
                                    dealershipBurgerPointerOrigin.current = null;
                                    dealershipBurgerPointerCancelled.current = true;
                                }}
                                onClick={() => {
                                    if (dealershipBurgerPointerCancelled.current) {
                                        dealershipBurgerPointerCancelled.current = false;
                                        return;
                                    }
                                    setSlugSidebarMenuOpen(true);
                                }}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/25 transition hover:bg-white/20 sm:h-10 sm:w-10"
                                aria-label="Open menu"
                            >
                                <Menu size={20} strokeWidth={1.75} aria-hidden />
                            </button>
                        </div>
                    </div>
                    <div
                        className={cn(
                            'grid overflow-hidden transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] sm:hidden',
                            showRetailStickyProductSearch ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                        )}
                        aria-hidden={!showRetailStickyProductSearch}
                    >
                        <div className="min-h-0">
                            <div
                                className={cn(
                                    'border-t border-white/10 px-3 pb-2.5 pt-2 transition-opacity duration-300 ease-out',
                                    showRetailStickyProductSearch ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                )}
                            >
                                <div className="flex items-center gap-2 rounded-full border border-zinc-200/90 bg-white px-3 py-2 shadow-sm">
                                    <input
                                        id="retail-header-search-mobile"
                                        type="search"
                                        value={retailShopSearchQuery}
                                        onChange={(e) => setRetailShopSearchQuery(e.target.value)}
                                        placeholder="Search products"
                                        className="min-w-0 flex-1 bg-white text-sm text-neutral-900 outline-none placeholder:text-zinc-400"
                                        aria-label="Search products"
                                        tabIndex={showRetailStickyProductSearch ? 0 : -1}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : isRetailBaselPage ? (
                <div id="basel-top" className="sticky top-0 z-30 shadow-md">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4" style={retailSearchBarStyle}>
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                            <Link
                                href="/businesses"
                                className="inline-block shrink-0 rounded-lg bg-white/10 px-2 py-1 ring-1 ring-white/20 transition hover:bg-white/15"
                                aria-label="Back to Hanar"
                            >
                                <img src="/hanar.logo.png" alt="Hanar" className="h-8 w-auto max-w-[7rem] object-contain" />
                            </Link>
                            {business.logo_url ? (
                                <img
                                    src={business.logo_url}
                                    alt=""
                                    className="h-9 w-9 shrink-0 rounded object-cover"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                            ) : null}
                            <span className="min-w-0 truncate text-sm font-semibold text-white sm:text-base" data-no-translate>{business.business_name}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
                            {!communityPostsLoading && communityPosts.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setShowCommunityModal(true)}
                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/25 transition hover:bg-white/20"
                                    aria-label="Community announcements"
                                >
                                    <Megaphone size={18} aria-hidden />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={toggleFavorite}
                                className={cn(
                                    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/25 transition hover:bg-white/20',
                                    isFavorited ? 'text-rose-300' : 'text-white'
                                )}
                                aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                            >
                                {isFavorited ? <FaHeart size={18} /> : <FaRegHeart size={18} />}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowQrModal(true)}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/25 transition hover:bg-white/20"
                                aria-label="Show business QR code"
                            >
                                <QrCode size={18} />
                            </button>
                            <button
                                type="button"
                                onPointerDown={(e) => {
                                    dealershipBurgerPointerOrigin.current = { x: e.clientX, y: e.clientY };
                                    dealershipBurgerPointerCancelled.current = false;
                                }}
                                onPointerMove={(e) => {
                                    if (!dealershipBurgerPointerOrigin.current) return;
                                    const dx = e.clientX - dealershipBurgerPointerOrigin.current.x;
                                    const dy = e.clientY - dealershipBurgerPointerOrigin.current.y;
                                    if (Math.hypot(dx, dy) > 12) dealershipBurgerPointerCancelled.current = true;
                                }}
                                onPointerUp={() => {
                                    dealershipBurgerPointerOrigin.current = null;
                                }}
                                onPointerCancel={() => {
                                    dealershipBurgerPointerOrigin.current = null;
                                    dealershipBurgerPointerCancelled.current = true;
                                }}
                                onClick={() => {
                                    if (dealershipBurgerPointerCancelled.current) {
                                        dealershipBurgerPointerCancelled.current = false;
                                        return;
                                    }
                                    setSlugSidebarMenuOpen(true);
                                }}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/25 transition hover:bg-white/20"
                                aria-label="Open menu"
                            >
                                <Menu size={20} strokeWidth={1.75} aria-hidden />
                            </button>
                        </div>
                    </div>
                    <div
                        className={cn(
                            'grid overflow-hidden transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                            showRetailStickyProductSearch ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                        )}
                        aria-hidden={!showRetailStickyProductSearch}
                    >
                        <div className="min-h-0">
                            <div
                                className={cn(
                                    'border-t border-white/15 px-3 py-2.5 transition-opacity duration-300 ease-out sm:px-4',
                                    showRetailStickyProductSearch ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                )}
                                style={{ backgroundColor: baselRetailSearchStripBg }}
                            >
                                <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                                    {retailCategoryChips.length > 0 && (
                                        <>
                                            <label className="sr-only" htmlFor="basel-category-select">
                                                Category
                                            </label>
                                            <select
                                                id="basel-category-select"
                                                value={retailCategoryFilter ?? ''}
                                                onChange={(e) => setRetailCategoryFilter(e.target.value || null)}
                                                className="w-full shrink-0 rounded border bg-white px-2 py-2 text-xs text-neutral-800 sm:max-w-[11rem] sm:text-sm"
                                                style={{ borderColor: retailSearchAccentSolid }}
                                                tabIndex={showRetailStickyProductSearch ? 0 : -1}
                                            >
                                                <option value="">All categories</option>
                                                {retailCategoryChips.map((c) => (
                                                    <option key={c.label} value={c.label}>
                                                        {c.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </>
                                    )}
                                    <div
                                        className="flex min-w-0 flex-1 items-center gap-2 rounded border bg-white px-3 py-2"
                                        style={{ borderColor: retailSearchAccentSolid }}
                                    >
                                        <Search className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                                        <input
                                            type="search"
                                            value={retailShopSearchQuery}
                                            onChange={(e) => setRetailShopSearchQuery(e.target.value)}
                                            placeholder="Search products..."
                                            className="min-w-0 flex-1 bg-white text-sm text-neutral-800 outline-none placeholder:text-zinc-400"
                                            aria-label="Search products"
                                            tabIndex={showRetailStickyProductSearch ? 0 : -1}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => document.getElementById('basel-latest')?.scrollIntoView({ behavior: 'smooth' })}
                                        className="inline-flex shrink-0 items-center justify-center rounded px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                                        style={retailSearchCtaStyle}
                                        tabIndex={showRetailStickyProductSearch ? 0 : -1}
                                    >
                                        Search
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
            <div
                className="sticky top-0 z-30 mb-0 px-4 py-3 border-b border-white/15 dark:border-white/10 shadow-[inset_0_1px_0_rgba(130,170,230,0.22)] dark:shadow-[inset_0_1px_0_rgba(180,70,80,0.16)] backdrop-blur-sm"
                style={{ background: slugBrandBackground }}
            >
                <div className="flex items-center justify-between gap-3 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <Link href="/businesses" className="inline-block rounded-lg bg-white/10 px-2 py-1 ring-1 ring-white/20 transition hover:bg-white/15 shrink-0" aria-label="Back to Hanar">
                            <img src="/hanar.logo.png" alt="Hanar" className="h-8 w-auto object-contain" />
                        </Link>
                        {business.logo_url ? (
                            <img
                                src={business.logo_url}
                                alt={`${business.business_name} logo`}
                                className="h-8 w-8 shrink-0 rounded-sm object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                        ) : null}
                        <span className="min-w-0 truncate text-sm sm:text-base font-semibold text-white" data-no-translate>
                            {business.business_name}
                        </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5 sm:gap-4">
                        {!communityPostsLoading && communityPosts.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowCommunityModal(true)}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/25 transition hover:bg-white/20"
                                aria-label="Community announcements"
                            >
                                <Megaphone size={18} aria-hidden />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={toggleFavorite}
                            className={cn(
                                'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/25 transition hover:bg-white/20',
                                isFavorited ? 'text-rose-300' : 'text-white'
                            )}
                            aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                        >
                            {isFavorited ? <FaHeart size={18} /> : <FaRegHeart size={18} />}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowQrModal(true)}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/25 transition hover:bg-white/20"
                            aria-label="Show business QR code"
                        >
                            <QrCode size={18} />
                        </button>
                        {isDealership && (
                            <button
                                type="button"
                                onPointerDown={(e) => {
                                    dealershipBurgerPointerOrigin.current = { x: e.clientX, y: e.clientY };
                                    dealershipBurgerPointerCancelled.current = false;
                                }}
                                onPointerMove={(e) => {
                                    if (!dealershipBurgerPointerOrigin.current) return;
                                    const dx = e.clientX - dealershipBurgerPointerOrigin.current.x;
                                    const dy = e.clientY - dealershipBurgerPointerOrigin.current.y;
                                    if (Math.hypot(dx, dy) > 12) dealershipBurgerPointerCancelled.current = true;
                                }}
                                onPointerUp={() => {
                                    dealershipBurgerPointerOrigin.current = null;
                                }}
                                onPointerCancel={() => {
                                    dealershipBurgerPointerOrigin.current = null;
                                    dealershipBurgerPointerCancelled.current = true;
                                }}
                                onClick={() => {
                                    if (dealershipBurgerPointerCancelled.current) {
                                        dealershipBurgerPointerCancelled.current = false;
                                        return;
                                    }
                                    setSlugSidebarMenuOpen(true);
                                }}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/25 transition hover:bg-white/20"
                                aria-label="Open dealership menu"
                            >
                                <Menu size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
            )}
            {showCommunityModal && business && (
                <BusinessCommunityPostsModal
                    open={showCommunityModal}
                    onClose={() => setShowCommunityModal(false)}
                    businessSlug={business.slug}
                    businessName={business.business_name}
                    businessOwnerId={business.owner_id ?? null}
                    posts={communityPosts}
                    commentCounts={communityCommentCounts}
                    onPostsChange={setCommunityPosts}
                    onCommentCountsChange={setCommunityCommentCounts}
                />
            )}

            {showQrModal && (
                <div
                    className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/70 p-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md sm:p-6 sm:pt-[max(1.25rem,env(safe-area-inset-top))]"
                    onClick={() => setShowQrModal(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Business QR code"
                >
                    <div
                        className="relative z-[1] w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-gray-900"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Scan to open this business</h3>
                            <button
                                type="button"
                                onClick={() => setShowQrModal(false)}
                                className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                                aria-label="Close QR"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="mx-auto w-full max-w-[16rem] rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-gray-800">
                            {qrImageUrl ? (
                                <img src={qrImageUrl} alt="Business QR code" className="h-full w-full object-contain" />
                            ) : (
                                <div className="flex h-64 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                                    QR unavailable
                                </div>
                            )}
                        </div>
                        <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
                            Scanning opens this business page link in browser. If your device has the app with app links enabled, it should open in-app.
                        </p>
                        <div className="mt-3 flex gap-2">
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!qrTargetUrl) return;
                                    try {
                                        await navigator.clipboard.writeText(qrTargetUrl);
                                        setQrCopied(true);
                                        window.setTimeout(() => setQrCopied(false), 1500);
                                    } catch {}
                                }}
                                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-gray-800"
                            >
                                {qrCopied ? <Check size={15} /> : <Copy size={15} />}
                                {qrCopied ? 'Copied' : 'Copy link'}
                            </button>
                            <a
                                href={qrTargetUrl || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex flex-1 items-center justify-center rounded-lg bg-gradient-to-r from-[#0c1f3c] to-[#6b1515] px-3 py-2 text-sm font-semibold text-white transition hover:from-[#0a192f] hover:to-[#5a1212]"
                            >
                                Open link
                            </a>
                        </div>
                    </div>
                </div>
            )}
            {/* Modals for Menu and Cars */}
            {showMenuModal && (
                <Modal title="Our Menu" onClose={() => setShowMenuModal(false)}>
                    {menu.length > 0 ? (
                        <div className="space-y-8">
                            {groupedMenu.map((group) => (
                                <div key={group.category}>
                                    <h3 className="text-lg font-semibold text-orange-600 dark:text-orange-400 mb-3">
                                        {group.category}
                                    </h3>
                                    <div className="divide-y divide-dashed divide-gray-200 dark:divide-gray-700">
                                        {group.items.map((item) => (
                                            <div key={item.id} className="py-3">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
                                                        {item.description && (
                                                            <p className="text-sm text-gray-600 dark:text-gray-300">{item.description}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {item.price && (
                                                            <span className="text-sm font-semibold text-[#8b2020] dark:text-red-300">
                                                                {formatPriceWithCurrency(item.price)}
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={() => setSelectedItemForDetails({ type: 'menu', item: item })}
                                                            className="rounded-md px-3 py-1.5 text-sm text-white transition hover:brightness-110"
                                                            style={viewDetailButtonStyle}
                                                        >
                                                            Details
                                                        </button>
                                                        <button
                                                            onClick={() => handleItemShare(item.name)}
                                                            className="px-2.5 py-1.5 text-sm bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] text-white rounded-md hover:from-[#1e40af] hover:to-[#2563eb] transition-colors border border-[#60a5fa] dark:from-[#1e3a8a] dark:to-[#1d4ed8] dark:hover:from-[#1e3a8a] dark:hover:to-[#1e40af]"
                                                        >
                                                            <FaShareAlt size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400 italic">No menu items available for this business.</p>
                    )}
                </Modal>
            )}

            {showCarsModal && (
                <Modal
                    title="Car Listings"
                    onClose={() => setShowCarsModal(false)}
                >
                    <div className="space-y-4">
                        {carListings.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {carListings.map((item) => (
                                    <div key={item.id} className="bg-white dark:bg-gray-800 shadow-sm overflow-hidden flex flex-col">
                                        {item.images && item.images.length > 0 && item.images[0] && (
                                            <div className="w-full h-48 relative flex-shrink-0">
                                                <img
                                                    src={item.images[0]}
                                                    alt={item.title}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => { e.currentTarget.src = 'https://placehold.co/300x200/cccccc/333333?text=Car+Image'; e.currentTarget.onerror = null; }}
                                                />
                                            </div>
                                        )}
                                        <div className="p-2.5 flex flex-col flex-grow">
                                            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{item.title}</h3>
                                            <div className="text-sm text-gray-600 dark:text-gray-300 mt-2 space-y-1">
                                                <p className="flex items-center gap-1"><Calendar size={14} /> Year: {item.year}</p>
                                                <p className="flex items-center gap-1"><Gauge size={14} /> Mileage: {item.mileage}</p>
                                                <p className="flex items-center gap-1"><HeartHandshake size={14} /> Condition: {item.condition}</p>
                                            </div>
                                            <p className="text-[#b91c1c] dark:text-red-400 font-bold mt-2">
                                                {formatPriceWithCurrency(item.price)}
                                            </p>
                                            <div className="mt-auto pt-3 flex gap-2">
                                                <button
                                                    onClick={() => setSelectedItemForDetails({ type: 'car', item: item })}
                                                    className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium text-white shadow-sm transition hover:brightness-110"
                                                    style={viewDetailButtonStyle}
                                                >
                                                    <Eye size={18} />
                                                    View Details
                                                </button>
                                                <button
                                                    onClick={() => handleItemShare(item.title)}
                                                    className="px-3 py-2.5 bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] text-white rounded-lg hover:from-[#1e40af] hover:to-[#2563eb] transition-colors flex items-center justify-center gap-2 font-medium shadow-sm border border-[#60a5fa] dark:from-[#1e3a8a] dark:to-[#1d4ed8] dark:hover:from-[#1e3a8a] dark:hover:to-[#1e40af]"
                                                >
                                                    <FaShareAlt size={16} />
                                                    Share
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <div className="text-gray-500 mb-4">
                                    <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">No Car Listings Available</h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    This business hasn't added any car listings yet.
                                </p>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {selectedItemForDetails && (
                <DetailedViewModal
                    item={selectedItemForDetails.item}
                    type={selectedItemForDetails.type}
                    onClose={() => setSelectedItemForDetails(null)}
                />
            )}

            {(isDealership || isRetailBaselPage || isRetailShopPage) &&
                slugSidebarPortalReady &&
                createPortal(
                    <>
                        <div
                            role="presentation"
                            onClick={() => setSlugSidebarMenuOpen(false)}
                            className={`fixed inset-0 z-[100] bg-black/50 transition-opacity duration-300 ${
                                slugSidebarMenuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
                            }`}
                            aria-hidden={!slugSidebarMenuOpen}
                        />
                        <aside
                            role="dialog"
                            aria-modal="true"
                            aria-label={isRetailBaselPage || isRetailShopPage ? 'Shop menu' : 'Dealership menu'}
                            className={cn(
                                'fixed top-0 right-0 z-[110] flex h-[100dvh] max-h-[100dvh] min-h-0 w-[min(100vw-1.25rem,22rem)] flex-col overflow-y-auto overscroll-contain border-l border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] shadow-[-12px_0_42px_-12px_rgba(2,6,23,0.45)] dark:border-slate-700 dark:bg-slate-900',
                                slugSidebarMenuOpen ? 'flex' : 'hidden'
                            )}
                            aria-hidden={!slugSidebarMenuOpen}
                        >
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300">
                                {isRetailBaselPage || isRetailShopPage ? 'Menu' : 'Dealership Menu'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setSlugSidebarMenuOpen(false)}
                                className="rounded-md border border-slate-300 p-1 text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                aria-label="Close menu"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowCommunityModal(true);
                                    setSlugSidebarMenuOpen(false);
                                }}
                                className={dealershipMenuActionClassName}
                                style={sidebarMenuButtonStyle}
                            >
                                <Megaphone size={13} />
                                Announcements
                            </button>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">About</p>
                                {displayCategory ? (
                                    <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{displayCategory}</p>
                                ) : null}
                                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">
                                    {business.description || 'No description provided yet.'}
                                </p>
                            </div>

                            <div className="flex flex-col gap-2">
                                {business.phone && (
                                    <a
                                        href={`tel:${business.phone}`}
                                        className={dealershipMenuActionClassName}
                                        style={sidebarMenuButtonStyle}
                                    >
                                        <FaPhone size={13} />
                                        Call
                                    </a>
                                )}
                                {business.owner_id && (
                                    <Link
                                        href={`/messages?targetType=business&targetId=${encodeURIComponent(business.id)}`}
                                        className={dealershipMenuActionClassName}
                                        style={sidebarMenuButtonStyle}
                                        onClick={() => setSlugSidebarMenuOpen(false)}
                                    >
                                        <FaCommentDots size={13} />
                                        DM Owner
                                    </Link>
                                )}
                                {business.email && (
                                    <a
                                        href={`mailto:${business.email}`}
                                        className={dealershipMenuActionClassName}
                                        style={sidebarMenuButtonStyle}
                                    >
                                        <FaEnvelope size={13} />
                                        Email
                                    </a>
                                )}
                                {business.whatsapp && (
                                    <a
                                        href={business.whatsapp.startsWith('http') ? business.whatsapp : `https://wa.me/${String(business.whatsapp).replace(/[^\d]/g, '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={dealershipMenuActionClassName}
                                        style={sidebarMenuButtonStyle}
                                    >
                                        <FaWhatsapp size={13} />
                                        WhatsApp
                                    </a>
                                )}
                                {business.website && (
                                    <a
                                        href={/^https?:\/\//i.test(business.website) ? business.website : `https://${business.website}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={dealershipMenuActionClassName}
                                        style={sidebarMenuButtonStyle}
                                    >
                                        <FaGlobe size={13} />
                                        External link
                                    </a>
                                )}
                                <button
                                    type="button"
                                    onClick={toggleFavorite}
                                    className={dealershipMenuActionClassName}
                                    style={sidebarMenuButtonStyle}
                                >
                                    {isFavorited ? <FaHeart size={13} /> : <FaRegHeart size={13} />}
                                    {isFavorited ? 'Unfavorite' : 'Favorite'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleShare}
                                    className={dealershipMenuActionClassName}
                                    style={sidebarMenuButtonStyle}
                                >
                                    <FaShareAlt size={13} />
                                    Share
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowQrModal(true)}
                                    className={dealershipMenuActionClassName}
                                    style={sidebarMenuButtonStyle}
                                >
                                    <QrCode size={13} />
                                    QR Code
                                </button>
                                {business.address?.street && (
                                    <button
                                        type="button"
                                        onClick={() => window.open(getMapUrl(business.address), '_blank')}
                                        className={dealershipMenuActionClassName}
                                        style={sidebarMenuButtonStyle}
                                    >
                                        <FaDirections size={13} />
                                        Directions
                                    </button>
                                )}
                                <ReportButton
                                    entityType="business"
                                    entityId={business.id}
                                    entityTitle={business.business_name}
                                    variant="pill"
                                    style={sidebarMenuButtonStyle}
                                    className="!w-full !justify-center !gap-1.5 !rounded-md !border-0 !bg-transparent !px-3 !py-2 !text-xs !font-semibold !uppercase !tracking-wide !text-white hover:!brightness-110 [&_svg]:!stroke-white [&_svg]:!text-white"
                                />
                            </div>

                            {hasSocials && (
                                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Social Media</p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        {business.instagram && (
                                            <a
                                                href={business.instagram}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                                aria-label="Instagram"
                                            >
                                                <FaInstagram size={14} />
                                                Instagram
                                            </a>
                                        )}
                                        {business.facebook && (
                                            <a
                                                href={business.facebook}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                                aria-label="Facebook"
                                            >
                                                <FaFacebook size={14} />
                                                Facebook
                                            </a>
                                        )}
                                        {business.tiktok && (
                                            <a
                                                href={business.tiktok}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                                aria-label="TikTok"
                                            >
                                                <FaTiktok size={14} />
                                                TikTok
                                            </a>
                                        )}
                                        {business.twitter && (
                                            <a
                                                href={business.twitter}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                                aria-label="X"
                                            >
                                                <FaXTwitter size={14} />
                                                X
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            {menu.length > 0 && (
                                <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">More Sections</p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowMenuModal(true);
                                            setSlugSidebarMenuOpen(false);
                                        }}
                                        className={cn(
                                            dealershipMenuActionClassName,
                                            'justify-start text-left normal-case text-sm font-medium'
                                        )}
                                        style={sidebarMenuButtonStyle}
                                    >
                                        <ClipboardListIcon size={15} />
                                        Menu
                                    </button>
                                </div>
                            )}
                        </div>
                    </aside>
                    </>,
                    document.body
                )}

            {isDealership ? (
                <motion.div className="w-full bg-[#e6e6eb] pb-6 dark:bg-slate-900">
                    <div className="border-b border-slate-300 bg-white px-4 py-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-line">
                            {business.description || 'No description provided yet.'}
                        </p>
                        {business.phone && (
                            <div className="mt-1.5">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">Sales:</p>
                                <a href={`tel:${business.phone}`} className="mt-0.5 inline-block text-3xl font-black leading-none">
                                    {business.phone}
                                </a>
                            </div>
                        )}
                    </div>

                    <div className="relative border-b border-slate-300 bg-black dark:border-slate-700" onTouchStart={handleGalleryTouchStart} onTouchMove={handleGalleryTouchMove} onTouchEnd={handleGalleryTouchEnd}>
                        {business.images?.length ? (
                            <div className="relative aspect-[16/9] w-full">
                                <img
                                    src={business.images[selectedIndex]}
                                    alt={`Slide ${selectedIndex + 1}`}
                                    className="h-full w-full object-cover"
                                    onError={(e) => { e.currentTarget.src = 'https://placehold.co/960x540/444444/ffffff?text=Image+Unavailable'; e.currentTarget.onerror = null; }}
                                />
                                {business.images.length > 1 && (
                                    <>
                                        <button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white transition hover:bg-black/65" aria-label="Previous image">
                                            <FaArrowLeft size={18} />
                                        </button>
                                        <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white transition hover:bg-black/65" aria-label="Next image">
                                            <FaArrowRight size={18} />
                                        </button>
                                        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
                                            {business.images.map((_, index) => (
                                                <button
                                                    key={index}
                                                    type="button"
                                                    onClick={() => setSelectedIndex(index)}
                                                    className={cn('h-2.5 w-2.5 rounded-full transition', selectedIndex === index ? 'bg-black' : 'bg-white/80')}
                                                    aria-label={`Go to image ${index + 1}`}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="flex aspect-[16/9] w-full items-center justify-center bg-slate-700 text-sm text-white/85">
                                No gallery images yet
                            </div>
                        )}
                    </div>

                    <section className="mx-3 mt-3 border border-slate-600 bg-[#1f2228] p-2.5 shadow-md">
                        <h2
                            className="border px-3 py-2 text-center text-xl font-medium uppercase tracking-wide text-white"
                            style={{ background: slugBrandBackground, borderColor: slugPrimaryColor }}
                        >
                            Search by Price
                        </h2>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            {dealershipPriceFilters.map((filterOption) => (
                                <button
                                    key={filterOption.id}
                                    type="button"
                                    onClick={() => setDealershipPriceFilter(filterOption.id)}
                                    className={cn(
                                        'rounded-sm border border-slate-500 bg-[#2e3138] px-2 py-3 text-base font-medium text-white transition hover:bg-[#3a3e46]',
                                        dealershipPriceFilter === filterOption.id && 'border-transparent text-white'
                                    )}
                                    style={dealershipPriceFilter === filterOption.id ? { background: slugBrandBackground } : undefined}
                                >
                                    {filterOption.label}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => setDealershipPriceFilter('all')}
                            className={cn(
                                'mt-2 w-full rounded-sm border border-slate-500 bg-[#2e3138] px-2 py-3 text-base font-medium text-white transition hover:bg-[#3a3e46]',
                                dealershipPriceFilter === 'all' && 'border-transparent text-white'
                            )}
                            style={dealershipPriceFilter === 'all' ? { background: slugBrandBackground } : undefined}
                        >
                            All Cars
                        </button>
                    </section>

                    <section className="mx-3 mt-4 border border-slate-500 bg-[#22252c] p-2.5">
                        {filteredDealershipCars.length > 0 ? (
                            <>
                                <div className="relative min-h-[10rem] overflow-hidden sm:min-h-[11rem]">
                                    <AnimatePresence mode="wait" initial={false}>
                                        <motion.div
                                            key={dealershipListingsPage}
                                            role="list"
                                            className="grid grid-cols-2 gap-2"
                                            initial={{ opacity: 0, x: 36 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -36 }}
                                            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                                        >
                                            {dealershipPageCars.map((car) => (
                                                <article
                                                    key={car.id}
                                                    className="overflow-hidden border border-slate-600 bg-[#15181d] text-white"
                                                >
                                                    <div className="aspect-[4/3] w-full bg-slate-700">
                                                        {car.images?.[0] ? (
                                                            <img
                                                                src={car.images[0]}
                                                                alt={car.title}
                                                                className="h-full w-full object-cover"
                                                                onError={(e) => { e.currentTarget.src = 'https://placehold.co/320x240/444444/ffffff?text=Car'; e.currentTarget.onerror = null; }}
                                                            />
                                                        ) : null}
                                                    </div>
                                                    <div className="p-2 text-center">
                                                        <h3 className="line-clamp-2 text-sm font-bold uppercase">{car.title}</h3>
                                                        <p className="mt-1 text-[13px] text-slate-200">{formatMileage(car.mileage)}</p>
                                                        <p className="mt-0.5 text-[13px] font-semibold text-red-300">
                                                            {formatPriceWithCurrency(car.price)}
                                                        </p>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedItemForDetails({ type: 'car', item: car })}
                                                            className="mt-2 w-full rounded-sm px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
                                                            style={viewDetailButtonStyle}
                                                        >
                                                            View Details
                                                        </button>
                                                    </div>
                                                </article>
                                            ))}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                                {dealershipTotalPages >= 1 ? (
                                    <nav
                                        className="mt-3 flex flex-wrap items-center justify-center gap-1.5 border-t border-slate-600/80 pt-3"
                                        aria-label="Inventory pages"
                                    >
                                        {Array.from({ length: dealershipTotalPages }, (_, i) => i + 1).map((num) => {
                                            const isActive =
                                                num === Math.min(Math.max(1, dealershipListingsPage), dealershipTotalPages);
                                            return (
                                                <button
                                                    key={num}
                                                    type="button"
                                                    onClick={() => setDealershipListingsPage(num)}
                                                    className={cn(
                                                        'min-w-[2.35rem] rounded-md px-2.5 py-1.5 text-sm font-semibold transition active:scale-[0.97]',
                                                        isActive
                                                            ? 'text-white shadow-md ring-1 ring-white/25'
                                                            : 'border border-slate-600 bg-[#2e3138] text-slate-200 hover:bg-[#3a3e46]'
                                                    )}
                                                    style={isActive ? viewDetailButtonStyle : undefined}
                                                    aria-current={isActive ? 'page' : undefined}
                                                    aria-label={`Page ${num}`}
                                                >
                                                    {num}
                                                </button>
                                            );
                                        })}
                                    </nav>
                                ) : null}
                            </>
                        ) : (
                            <p className="px-3 py-6 text-center text-sm text-slate-200">No cars found in this price range.</p>
                        )}
                    </section>

                    {business.address?.street && (
                        <section className="mx-3 mt-4 overflow-hidden border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
                            <div className="px-3 pb-2 pt-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const mapUrl = getMapUrl(business.address);
                                        window.open(mapUrl, '_blank');
                                    }}
                                    className="flex w-full items-center justify-center gap-2 px-3 py-2 text-sm font-bold text-white transition hover:brightness-110"
                                    style={viewDetailButtonStyle}
                                >
                                    <FaDirections size={16} />
                                    <span>
                                        Get Directions
                                        {business.address?.street || business.address?.city || business.address?.state || business.address?.zip
                                            ? ` · ${[business.address?.street, business.address?.city, business.address?.state, business.address?.zip].filter(Boolean).join(', ')}`
                                            : ''}
                                    </span>
                                </button>
                            </div>
                            <div className="w-full overflow-hidden border-t border-slate-200 dark:border-slate-700">
                                <BusinessMap address={business.address} />
                            </div>
                        </section>
                    )}
                </motion.div>
            ) : isRestaurant ? (
                <motion.div
                    initial="hidden"
                    animate="visible"
                    className={cn(
                        'w-full space-y-0 pb-10 backdrop-blur lg:px-6 lg:pt-4',
                        restaurantBody.className,
                        'bg-[#FCF8F1] text-stone-800'
                    )}
                >
                    {business.moderation_status !== 'active' && (
                        <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            Your business is currently pending approval. You can still view and edit your business profile and online
                            shop, but it will not be visible to other users until it has been approved.
                        </div>
                    )}
                    <div className="relative left-1/2 -translate-x-1/2 w-screen max-w-none lg:static lg:left-0 lg:translate-x-0 lg:w-full lg:overflow-hidden">
                        <div className="border-b border-[#1A472A]/12 bg-[#FCF8F1] px-4 py-4">
                            <p
                                className={cn(
                                    restaurantHeading.className,
                                    'mb-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#1A472A]/70'
                                )}
                            >
                                Connect
                            </p>
                            <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2.5">
                                {business.phone && (
                                    <a href={`tel:${business.phone}`} aria-label="Call" className={RESTAURANT_ICON_RING}>
                                        <Phone className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                                    </a>
                                )}
                                {business.whatsapp && (
                                    <a
                                        href={`https://wa.me/${business.whatsapp}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label="WhatsApp"
                                        className={RESTAURANT_ICON_RING}
                                    >
                                        <MessageCircle className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                                    </a>
                                )}
                                {business.email && (
                                    <a href={`mailto:${business.email}`} aria-label="Email" className={RESTAURANT_ICON_RING}>
                                        <Mail className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                                    </a>
                                )}
                                {business.website && (
                                    <a
                                        href={/^https?:\/\//i.test(business.website) ? business.website : `https://${business.website}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label="Website"
                                        className={RESTAURANT_ICON_RING}
                                    >
                                        <Globe className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                                    </a>
                                )}
                                {business.owner_id && (
                                    <Link
                                        href={`/messages?targetType=business&targetId=${encodeURIComponent(business.id)}`}
                                        aria-label="Message business"
                                        className={RESTAURANT_ICON_RING}
                                    >
                                        <MessageSquare className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                                    </Link>
                                )}
                                <button
                                    type="button"
                                    onClick={handleShare}
                                    aria-label="Share"
                                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 text-white shadow-md transition hover:brightness-110 [&_svg]:stroke-white"
                                    style={viewDetailButtonStyle}
                                >
                                    <Share2 className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                                </button>
                                <ReportButton
                                    entityType="business"
                                    entityId={business.id}
                                    entityTitle={business.business_name}
                                    variant="icon"
                                    className={cn(
                                        RESTAURANT_ICON_RING,
                                        'hover:!border-rose-300 hover:!bg-rose-50 [&_svg]:!stroke-rose-600'
                                    )}
                                />
                            </div>
                        </div>
                    </div>

                    <motion.div className="border-t border-[#1A472A]/10 bg-[#FCF8F1]">
                        <div className="p-6 sm:p-8">
                            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                                {business.logo_url && (
                                    <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-[#1A472A]/15 bg-white shadow-sm">
                                        <img
                                            src={business.logo_url}
                                            alt="Business logo"
                                            className="h-full w-full object-contain p-2"
                                            onError={(e) => {
                                                e.currentTarget.src = 'https://placehold.co/120x120/e8e4dc/1A472A?text=Logo';
                                                e.currentTarget.onerror = null;
                                            }}
                                        />
                                    </div>
                                )}
                                <div className="min-w-0 flex-1 text-center sm:text-left">
                                    <h1
                                        className={cn(restaurantHeading.className, 'text-3xl text-[#1A472A] sm:text-4xl')}
                                        data-no-translate
                                    >
                                        {business.business_name}
                                    </h1>
                                    {displayCategory ? (
                                        <p className="mt-1 text-sm italic text-stone-600">{displayCategory}</p>
                                    ) : null}
                                    <p className="mt-3 whitespace-pre-line leading-relaxed text-stone-700">
                                        {business.description || ' '}
                                    </p>
                                    {(hasHours || hasSocials) && (
                                        <>
                                            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 border-t border-[#1A472A]/10 pt-5 sm:justify-start">
                                                {hasHours && (
                                                    <>
                                                        <span className="inline-flex items-center gap-2 text-xs font-medium text-[#1A472A]">
                                                            <span className="h-2 w-2 rounded-full bg-[#1A472A]/70" />
                                                            Today: <span className="font-semibold">{todayHours}</span>
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowHours((prev) => !prev)}
                                                            className="rounded-md bg-[#1A472A]/10 p-1 text-[#1A472A] transition hover:bg-[#1A472A]/15"
                                                            aria-label={showHours ? 'Hide hours' : 'View all hours'}
                                                        >
                                                            <ChevronDown size={16} className={cn('transition-transform', showHours && 'rotate-180')} />
                                                        </button>
                                                    </>
                                                )}
                                                {hasSocials && (
                                                    <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                                                        {business.instagram && (
                                                            <a
                                                                href={business.instagram}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className={RESTAURANT_ICON_RING}
                                                                aria-label="Instagram"
                                                            >
                                                                <Instagram className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                                                            </a>
                                                        )}
                                                        {business.facebook && (
                                                            <a
                                                                href={business.facebook}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className={RESTAURANT_ICON_RING}
                                                                aria-label="Facebook"
                                                            >
                                                                <Facebook className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                                                            </a>
                                                        )}
                                                        {business.tiktok && (
                                                            <a
                                                                href={business.tiktok}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className={RESTAURANT_ICON_RING}
                                                                aria-label="TikTok"
                                                            >
                                                                <Music2 className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                                                            </a>
                                                        )}
                                                        {business.twitter && (
                                                            <a
                                                                href={business.twitter}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className={RESTAURANT_ICON_RING}
                                                                aria-label="X or Twitter"
                                                            >
                                                                <Twitter className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {hasHours && showHours && (
                                                <div className="mt-4 overflow-hidden rounded-xl border border-[#1A472A]/15 bg-white">
                                                    {normalizedHours ? (
                                                        <div className="divide-y divide-[#1A472A]/10">
                                                            {hoursEntries.map(([day, hours]) => {
                                                                const isToday = day.toLowerCase() === todayKey;
                                                                return (
                                                                    <div
                                                                        key={day}
                                                                        className={cn(
                                                                            'flex items-center justify-between px-3 py-2 text-sm',
                                                                            isToday
                                                                                ? 'bg-[#1A472A]/6 text-[#1A472A]'
                                                                                : 'text-stone-700'
                                                                        )}
                                                                    >
                                                                        <span className="font-medium capitalize">{day}</span>
                                                                        <span className={isToday ? 'font-semibold' : 'text-stone-600'}>
                                                                            {hours || 'Closed'}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : fallbackHoursText ? (
                                                        <div className="px-3 py-2 text-sm text-stone-600">{fallbackHoursText}</div>
                                                    ) : (
                                                        <div className="px-3 py-2 text-sm italic text-stone-400">Hours not provided</div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {menu.length > 0 && (
                        <section className="px-4 py-12 sm:px-8" id="restaurant-menu">
                            <div className="mx-auto max-w-5xl">
                                <h2 className={cn(restaurantHeading.className, 'mb-2 text-center text-3xl text-[#1A472A] sm:text-4xl')}>
                                    Our menu
                                </h2>
                                <p className="mx-auto mb-10 max-w-lg text-center text-sm text-stone-600">
                                    Signature dishes and seasonal favorites.
                                </p>
                                {groupedVisibleMenu.map((group) => (
                                    <div key={group.category} className="mb-12">
                                        <h3
                                            className={cn(
                                                restaurantHeading.className,
                                                'mb-6 text-center text-xl text-[#1A472A] sm:text-2xl'
                                            )}
                                        >
                                            {group.category}
                                        </h3>
                                        <div className="grid grid-cols-1 gap-0 md:grid-cols-2 md:gap-x-12">
                                            {group.items.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="flex gap-3 border-b border-[#1A472A]/12 py-4 first:pt-0"
                                                >
                                                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#1A472A]/8 ring-1 ring-[#1A472A]/10">
                                                        {item.images?.[0] ? (
                                                            <img
                                                                src={item.images[0]}
                                                                alt=""
                                                                className="h-full w-full object-cover"
                                                                onError={(e) => {
                                                                    e.currentTarget.style.display = 'none';
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="flex h-full w-full items-center justify-center text-[10px] text-[#1A472A]/40">
                                                                Hanar
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className={cn(restaurantHeading.className, 'text-base font-semibold text-[#1A472A]')}>
                                                            {item.name}
                                                        </p>
                                                        {item.description ? (
                                                            <p className="mt-0.5 text-sm leading-snug text-stone-600">{item.description}</p>
                                                        ) : null}
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedItemForDetails({ type: 'menu', item })}
                                                                className="rounded-full border border-[#1A472A]/25 bg-white px-3 py-1 text-xs font-semibold text-[#1A472A] transition hover:bg-[#1A472A]/5"
                                                            >
                                                                Details
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleItemShare(item.name)}
                                                                className="rounded-full px-3 py-1 text-xs font-semibold text-white transition hover:brightness-110"
                                                                style={viewDetailButtonStyle}
                                                            >
                                                                Share
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {item.price ? (
                                                        <div className="shrink-0 text-right">
                                                            <span className={cn(restaurantHeading.className, 'text-lg font-semibold text-[#1A472A]')}>
                                                                {formatPriceWithCurrency(item.price)}
                                                            </span>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {business.images && business.images.length > 0 && (
                        <section className="py-10">
                            <h2
                                className={cn(
                                    restaurantHeading.className,
                                    'mb-8 text-center text-3xl text-[#1A472A] sm:text-4xl'
                                )}
                            >
                                Our culture
                            </h2>
                            <div className="-mx-2 flex gap-4 overflow-x-auto px-4 pb-4 pt-2 [scrollbar-width:thin]">
                                {business.images.map((src, i) => (
                                    <div
                                        key={`${src}-${i}`}
                                        className={cn(
                                            'shrink-0 snap-center overflow-hidden rounded-2xl shadow-lg ring-1 ring-[#1A472A]/10',
                                            i % 3 === 1
                                                ? 'h-64 w-[min(72vw,22rem)] -translate-y-2'
                                                : 'h-52 w-[min(58vw,17rem)]'
                                        )}
                                    >
                                        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {business.address?.street && (
                        <motion.div className="mx-4 mt-2 overflow-hidden rounded-2xl border border-[#1A472A]/15 bg-white shadow-sm sm:mx-6">
                            <div className="w-full">
                                <div className="flex justify-center px-0 pb-2 pt-4 sm:px-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const mapUrl = getMapUrl(business.address);
                                            window.open(mapUrl, '_blank');
                                        }}
                                        className={cn(
                                            restaurantHeading.className,
                                            'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 sm:w-auto [&_svg]:stroke-white'
                                        )}
                                        style={viewDetailButtonStyle}
                                    >
                                        <Navigation className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                                        <span>
                                            Get directions
                                            {business.address?.street ||
                                            business.address?.city ||
                                            business.address?.state ||
                                            business.address?.zip
                                                ? ` · ${[business.address?.street, business.address?.city, business.address?.state, business.address?.zip].filter(Boolean).join(', ')}`
                                                : ''}
                                        </span>
                                    </button>
                                </div>
                                <div className="relative w-full overflow-hidden">
                                    <BusinessMap address={business.address} />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    <footer className="mt-10 border-t border-[#1A472A]/12 bg-[#FCF8F1] px-4 py-10 sm:px-8">
                        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <h3 className={cn(restaurantHeading.className, 'mb-3 text-lg text-[#1A472A]')}>Contact</h3>
                                <ul className="space-y-3 text-sm text-stone-700">
                                    {business.phone && (
                                        <li className="flex items-start gap-3">
                                            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#1A472A]/18 bg-white text-[#1A472A] shadow-sm">
                                                <Phone className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                                            </span>
                                            <a href={`tel:${business.phone}`} className="pt-1 text-stone-700 hover:text-[#1A472A] hover:underline">
                                                {business.phone}
                                            </a>
                                        </li>
                                    )}
                                    {business.address?.street && (
                                        <li className="flex items-start gap-3">
                                            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#1A472A]/18 bg-white text-[#1A472A] shadow-sm">
                                                <MapPin className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                                            </span>
                                            <span className="pt-1 text-stone-700">
                                                {[business.address.street, business.address.city, business.address.state, business.address.zip]
                                                    .filter(Boolean)
                                                    .join(', ')}
                                            </span>
                                        </li>
                                    )}
                                    {business.email && (
                                        <li className="flex items-start gap-3">
                                            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#1A472A]/18 bg-white text-[#1A472A] shadow-sm">
                                                <Mail className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                                            </span>
                                            <a href={`mailto:${business.email}`} className="pt-1 text-stone-700 hover:text-[#1A472A] hover:underline">
                                                {business.email}
                                            </a>
                                        </li>
                                    )}
                                </ul>
                            </div>
                            <div>
                                <h3 className={cn(restaurantHeading.className, 'mb-3 text-lg text-[#1A472A]')}>Visit</h3>
                                <ul className="space-y-2 text-sm text-stone-700">
                                    {hasHours && (
                                        <li>
                                            <button
                                                type="button"
                                                onClick={() => setShowHours(true)}
                                                className="text-left hover:underline"
                                            >
                                                Hours
                                            </button>
                                        </li>
                                    )}
                                    {business.address?.street && (
                                        <li>
                                            <button
                                                type="button"
                                                onClick={() => window.open(getMapUrl(business.address), '_blank')}
                                                className="text-left hover:underline"
                                            >
                                                Directions
                                            </button>
                                        </li>
                                    )}
                                    {menu.length > 0 && (
                                        <li>
                                            <a href="#restaurant-menu" className="hover:underline">
                                                Menu
                                            </a>
                                        </li>
                                    )}
                                </ul>
                            </div>
                            <div>
                                <h3 className={cn(restaurantHeading.className, 'mb-3 text-lg text-[#1A472A]')}>Services</h3>
                                <ul className="space-y-2 text-sm text-stone-700">
                                    {business.owner_id && (
                                        <li>
                                            <Link
                                                href={`/messages?targetType=business&targetId=${encodeURIComponent(business.id)}`}
                                                className="hover:underline"
                                            >
                                                Message the team
                                            </Link>
                                        </li>
                                    )}
                                    <li>
                                        <button type="button" onClick={handleShare} className="text-left hover:underline">
                                            Share this page
                                        </button>
                                    </li>
                                </ul>
                            </div>
                            <div>
                                <h3 className={cn(restaurantHeading.className, 'mb-3 text-lg text-[#1A472A]')}>Follow</h3>
                                <ul className="space-y-2 text-sm text-stone-700">
                                    {business.instagram && (
                                        <li>
                                            <a href={business.instagram} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                Instagram
                                            </a>
                                        </li>
                                    )}
                                    {business.facebook && (
                                        <li>
                                            <a href={business.facebook} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                Facebook
                                            </a>
                                        </li>
                                    )}
                                    {business.tiktok && (
                                        <li>
                                            <a href={business.tiktok} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                TikTok
                                            </a>
                                        </li>
                                    )}
                                    {business.twitter && (
                                        <li>
                                            <a href={business.twitter} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                X
                                            </a>
                                        </li>
                                    )}
                                    {!business.instagram &&
                                        !business.facebook &&
                                        !business.tiktok &&
                                        !business.twitter && <li className="text-stone-500">Add social links from your dashboard</li>}
                                </ul>
                            </div>
                        </div>
                        <p className="mx-auto mt-8 max-w-5xl border-t border-[#1A472A]/10 pt-6 text-center text-xs text-stone-500" data-no-translate>
                            © {new Date().getFullYear()} {business.business_name} · Listed on Hanar
                        </p>
                    </footer>

                    {(carListings.length > 0 || retailItems.length > 0 || realEstateListings.length > 0) && (
                        <motion.div className="mt-4 border-t border-[#1A472A]/12 bg-[#FCF8F1] p-4 sm:p-6">
                            {carListings.length > 0 && (
                                <div className="mb-10">
                                    <h2
                                        className={cn(
                                            restaurantHeading.className,
                                            'mb-4 text-2xl text-[#1A472A]'
                                        )}
                                    >
                                        More from this business
                                    </h2>
                                    <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-[#1A472A]">
                                        <Car size={20} /> Vehicles
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {carListings.slice(0, visibleCarCount).map((car) => (
                                            <div
                                                key={car.id}
                                                className="overflow-hidden rounded-xl border border-[#1A472A]/15 bg-white shadow-sm"
                                            >
                                                {car.images && car.images.length > 0 && car.images[0] && (
                                                    <div className="relative h-24 w-full shrink-0 sm:h-28">
                                                        <img
                                                            src={car.images[0]}
                                                            alt={car.title}
                                                            className="h-full w-full object-cover"
                                                            onError={(e) => {
                                                                e.currentTarget.src =
                                                                    'https://placehold.co/300x200/cccccc/333333?text=Car+Image';
                                                                e.currentTarget.onerror = null;
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                                <div className="flex flex-grow flex-col p-2.5">
                                                    <h3 className="line-clamp-1 text-sm font-semibold text-[#1A472A]">{car.title}</h3>
                                                    <p className="mt-1 text-sm font-bold text-[#8b2020]">
                                                        {formatPriceWithCurrency(car.price)}
                                                    </p>
                                                    <div className="mt-auto flex gap-1.5 pt-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedItemForDetails({ type: 'car', item: car })}
                                                            className="flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                                                            style={viewDetailButtonStyle}
                                                        >
                                                            Details
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleItemShare(car.title)}
                                                            className="inline-flex items-center justify-center rounded-md border border-[#1A472A]/25 bg-white px-2 py-1.5 text-[#1A472A]"
                                                        >
                                                            <FaShareAlt size={13} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {retailItems.length > 0 && (
                                <div className="mb-10">
                                    <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-[#1A472A]">
                                        <StoreIcon size={20} /> Retail
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {retailItems.slice(0, visibleRetailCount).map((item) => (
                                            <div
                                                key={item.id}
                                                className="overflow-hidden rounded-xl border border-[#1A472A]/15 bg-white shadow-sm"
                                            >
                                                {item.images?.[0] && (
                                                    <div className="relative h-24 w-full shrink-0 sm:h-28">
                                                        <img
                                                            src={item.images[0]}
                                                            alt={item.name}
                                                            className="h-full w-full object-cover"
                                                            onError={(e) => {
                                                                e.currentTarget.src =
                                                                    'https://placehold.co/300x200/cccccc/333333?text=Retail+Item';
                                                                e.currentTarget.onerror = null;
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                                <div className="flex flex-grow flex-col p-2.5">
                                                    <h3 className="line-clamp-1 text-sm font-semibold text-[#1A472A]">{item.name}</h3>
                                                    <p className="mt-1 text-sm font-bold text-[#8b2020]">
                                                        {formatPriceWithCurrency(item.price)}
                                                    </p>
                                                    <div className="mt-auto flex gap-1.5 pt-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedItemForDetails({ type: 'retail', item })}
                                                            className="flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                                                            style={viewDetailButtonStyle}
                                                        >
                                                            Details
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleItemShare(item.name)}
                                                            className="inline-flex items-center justify-center rounded-md border border-[#1A472A]/25 bg-white px-2 py-1.5 text-[#1A472A]"
                                                        >
                                                            <FaShareAlt size={13} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {realEstateListings.length > 0 && (
                                <div>
                                    <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-[#1A472A]">
                                        <Home size={20} /> Real estate
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {realEstateListings.slice(0, visibleRealEstateCount).map((item) => (
                                            <div
                                                key={item.id}
                                                className="overflow-hidden rounded-xl border border-[#1A472A]/15 bg-white shadow-sm"
                                            >
                                                {item.images?.[0] && (
                                                    <div className="relative h-24 w-full shrink-0 sm:h-28">
                                                        <img
                                                            src={item.images[0]}
                                                            alt={item.title}
                                                            className="h-full w-full object-cover"
                                                            onError={(e) => {
                                                                e.currentTarget.src =
                                                                    'https://placehold.co/300x200/cccccc/333333?text=Property';
                                                                e.currentTarget.onerror = null;
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                                <div className="flex flex-grow flex-col p-2.5">
                                                    <h3 className="line-clamp-1 text-sm font-semibold text-[#1A472A]">{item.title}</h3>
                                                    <p className="mt-1 font-bold text-[#8b2020]">
                                                        {item.price ? formatPriceWithCurrency(item.price) : ''}
                                                    </p>
                                                    <div className="mt-auto flex gap-1.5 pt-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedItemForDetails({ type: 'real_estate', item })}
                                                            className="flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                                                            style={viewDetailButtonStyle}
                                                        >
                                                            Details
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleItemShare(item.title)}
                                                            className="inline-flex items-center justify-center rounded-md border border-[#1A472A]/25 bg-white px-2 py-1.5 text-[#1A472A]"
                                                        >
                                                            <FaShareAlt size={13} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {hasMoreItems && (
                        <div className="w-full">
                            {isLoadingMore && (
                                <div className="flex justify-center py-4" aria-live="polite">
                                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1A472A]/20 border-t-[#1A472A]" />
                                </div>
                            )}
                            <div ref={loadMoreRef} className="h-8 w-full" aria-hidden="true" />
                        </div>
                    )}
                </motion.div>
            ) : isRetailShopPage ? (
                <motion.div className="w-full space-y-0 bg-white pb-0 font-inter text-neutral-900">
                    {business.moderation_status !== 'active' && (
                        <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            Your business is currently pending approval. You can still view and edit your business profile and online
                            shop, but it will not be visible to other users until it has been approved.
                        </div>
                    )}

                    <section
                        className="px-4 pb-6 pt-5 sm:px-6"
                        style={{ backgroundColor: RETAIL_HERO_PANEL_BG }}
                    >
                        <div className="mx-auto flex max-w-lg flex-col gap-5 sm:max-w-none sm:flex-row sm:items-center sm:gap-6 lg:max-w-4xl">
                            <div className="min-w-0 flex-1 space-y-3">
                                <p
                                    className={cn(restaurantHeading.className, 'text-3xl font-bold leading-tight sm:text-4xl')}
                                    style={{ color: retailSearchAccentSolid }}
                                >
                                    Get Ready
                                </p>
                                <p
                                    className={cn(restaurantHeading.className, 'text-lg sm:text-xl')}
                                    style={{ color: retailSearchAccentSolid }}
                                >
                                    For New Collection
                                </p>
                                <button
                                    type="button"
                                    onClick={() =>
                                        document.getElementById('retail-categories')?.scrollIntoView({ behavior: 'smooth' })
                                    }
                                    className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
                                    style={viewDetailButtonStyle}
                                >
                                    View Collections
                                    <ChevronRight size={18} strokeWidth={2} aria-hidden />
                                </button>
                            </div>
                            <div className="relative min-h-[220px] flex-1 overflow-hidden rounded-2xl sm:min-h-[260px]">
                                <img
                                    src={retailHeroImage}
                                    alt=""
                                    className="h-full w-full object-cover object-top"
                                />
                            </div>
                        </div>
                    </section>

                    <div
                        className="px-3 py-3 text-center"
                        style={{ backgroundColor: RETAIL_PROMO_STRIP_BG }}
                    >
                        <p
                            className={cn(
                                restaurantHeading.className,
                                'mx-auto max-w-3xl text-[11px] font-semibold uppercase leading-snug tracking-wide text-neutral-900 sm:text-xs'
                            )}
                        >
                            {retailPromoStripText}
                        </p>
                    </div>

                    {retailCategoryChips.length > 0 && (
                    <section id="retail-categories" className="border-t border-neutral-100 bg-white px-2 py-5">
                        <div className="flex gap-4 overflow-x-auto pb-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {retailCategoryChips.map((chip) => {
                                const active = retailCategoryFilter === chip.label;
                                return (
                                    <button
                                        key={chip.label}
                                        type="button"
                                        onClick={() => {
                                            setRetailCategoryFilter((prev) => (prev === chip.label ? null : chip.label));
                                            document.getElementById('retail-all-products')?.scrollIntoView({ behavior: 'smooth' });
                                        }}
                                        className="flex w-[4.5rem] shrink-0 flex-col items-center gap-2 text-center"
                                    >
                                        <span
                                            className={cn(
                                                'flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-neutral-100 transition',
                                                !active && 'border-neutral-200'
                                            )}
                                            style={
                                                active
                                                    ? { borderColor: retailSearchAccentSolid, boxShadow: `0 0 0 3px ${retailSearchAccentSolid}40` }
                                                    : undefined
                                            }
                                        >
                                            {chip.image ? (
                                                <img src={chip.image} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                                <StoreIcon size={22} className="text-neutral-400" aria-hidden />
                                            )}
                                        </span>
                                        <span className="line-clamp-2 w-full text-[11px] font-medium leading-tight text-neutral-800">
                                            {chip.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                    )}

                    <section id="retail-new-products" className="border-t border-neutral-100 bg-white px-4 py-5">
                        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 sm:max-w-4xl">
                            <h2 className="text-base font-bold text-neutral-900">New Products</h2>
                            <button
                                type="button"
                                onClick={() =>
                                    document.getElementById('retail-all-products')?.scrollIntoView({ behavior: 'smooth' })
                                }
                                className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-50"
                            >
                                View All
                            </button>
                        </div>
                        <div className="mx-auto mt-4 grid max-w-lg grid-cols-2 gap-3 sm:max-w-4xl sm:gap-4">
                            {retailShopProducts.slice(0, 4).map((item) => (
                                <button
                                    key={`new-${item.id}`}
                                    type="button"
                                    onClick={() => setSelectedItemForDetails({ type: 'retail', item })}
                                    className="flex flex-col overflow-hidden rounded-xl bg-white text-left shadow-sm ring-1 ring-neutral-100 transition hover:ring-neutral-200"
                                >
                                    <div className="aspect-[3/4] w-full overflow-hidden bg-neutral-100">
                                        {item.images?.[0] ? (
                                            <img
                                                src={item.images[0]}
                                                alt=""
                                                className="h-full w-full object-cover"
                                                onError={(e) => {
                                                    e.currentTarget.src =
                                                        'https://placehold.co/400x520/e8e8e8/666666?text=Product';
                                                    e.currentTarget.onerror = null;
                                                }}
                                            />
                                        ) : null}
                                    </div>
                                    <span className="line-clamp-2 px-2 py-2.5 text-xs font-medium text-neutral-900 sm:text-sm">
                                        {item.name}
                                    </span>
                                    {item.price ? (
                                        <span className="px-2 pb-2 text-xs font-semibold text-neutral-700">
                                            {formatPriceWithCurrency(item.price)}
                                        </span>
                                    ) : null}
                                </button>
                            ))}
                        </div>
                    </section>

                    <section id="retail-about" className="border-t border-neutral-100 bg-neutral-50 px-4 py-8">
                        <div className="mx-auto flex max-w-lg flex-col gap-3 sm:max-w-2xl">
                            <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-900">About</h2>
                            <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-600">
                                {business.description || ' '}
                            </p>
                            <ReportButton
                                entityType="business"
                                entityId={business.id}
                                entityTitle={business.business_name}
                                variant="text"
                                className="self-start text-sm text-neutral-500 hover:text-rose-600"
                            />
                        </div>
                    </section>

                    <section id="retail-all-products" className="border-t border-neutral-100 bg-white px-4 py-6">
                        <div className="mx-auto max-w-lg sm:max-w-4xl">
                            <h2 className="mb-4 text-base font-bold text-neutral-900">
                                {retailCategoryFilter ? `Shop · ${retailCategoryFilter}` : 'All products'}
                            </h2>
                            {retailShopProducts.length > 4 ? (
                                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                    {retailShopProducts
                                        .slice(4)
                                        .slice(0, visibleRetailCount)
                                        .map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setSelectedItemForDetails({ type: 'retail', item })}
                                            className="flex flex-col overflow-hidden rounded-xl bg-white text-left shadow-sm ring-1 ring-neutral-100 transition hover:ring-neutral-200"
                                        >
                                            <div className="aspect-[3/4] w-full overflow-hidden bg-neutral-100">
                                                {item.images?.[0] ? (
                                                    <img
                                                        src={item.images[0]}
                                                        alt=""
                                                        className="h-full w-full object-cover"
                                                        onError={(e) => {
                                                            e.currentTarget.src =
                                                                'https://placehold.co/400x520/e8e8e8/666666?text=Product';
                                                            e.currentTarget.onerror = null;
                                                        }}
                                                    />
                                                ) : null}
                                            </div>
                                            <span className="line-clamp-2 px-2 py-2 text-xs font-medium text-neutral-900 sm:text-sm">
                                                {item.name}
                                            </span>
                                            {item.price ? (
                                                <span className="px-2 pb-2 text-xs font-semibold text-neutral-700">
                                                    {formatPriceWithCurrency(item.price)}
                                                </span>
                                            ) : null}
                                        </button>
                                    ))}
                                </div>
                            ) : retailShopProducts.length > 0 ? (
                                <p className="text-center text-sm text-neutral-500">
                                    All products are shown in New Products above.
                                </p>
                            ) : (
                                <p className="text-center text-sm text-neutral-500">No products match your search or filter.</p>
                            )}
                        </div>
                    </section>

                    {business.address?.street && (
                        <section className="border-t border-neutral-100 px-4 py-6">
                            <div className="mx-auto max-w-lg overflow-hidden rounded-xl border border-neutral-200 bg-white sm:max-w-4xl">
                                <div className="px-3 pb-2 pt-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const mapUrl = getMapUrl(business.address);
                                            window.open(mapUrl, '_blank');
                                        }}
                                        className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition hover:brightness-110"
                                        style={retailSearchCtaStyle}
                                    >
                                        <FaDirections size={16} />
                                        <span>
                                            Get directions
                                            {business.address?.street ||
                                            business.address?.city ||
                                            business.address?.state ||
                                            business.address?.zip
                                                ? ` · ${[business.address?.street, business.address?.city, business.address?.state, business.address?.zip].filter(Boolean).join(', ')}`
                                                : ''}
                                        </span>
                                    </button>
                                </div>
                                <div className="w-full overflow-hidden border-t border-neutral-200">
                                    <BusinessMap address={business.address} />
                                </div>
                            </div>
                        </section>
                    )}

                    {hasMoreItems && (
                        <div className="w-full px-4">
                            {isLoadingMore && (
                                <div className="flex justify-center py-4" aria-live="polite">
                                    <div
                                        className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-200"
                                        style={{ borderTopColor: retailSearchAccentSolid }}
                                    />
                                </div>
                            )}
                            <div ref={loadMoreRef} className="h-8 w-full" aria-hidden="true" />
                        </div>
                    )}

                    <footer className="mt-2 bg-black py-6 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white">Made with love</p>
                        <p className="mt-2 text-[10px] text-neutral-500" data-no-translate>
                            © {new Date().getFullYear()} {business.business_name} · Listed on Hanar
                        </p>
                    </footer>
                </motion.div>
            ) : isRetailBaselPage ? (
                <motion.div className="w-full space-y-0 bg-white pb-8 font-inter text-neutral-900">
                    {business.moderation_status !== 'active' && (
                        <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            Your business is currently pending approval. You can still view and edit your business profile and online
                            shop, but it will not be visible to other users until it has been approved.
                        </div>
                    )}

                    <section className="border-b border-zinc-200 bg-white">
                        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-8 gap-y-6 px-4 py-8 lg:px-6">
                            {business.phone?.trim() && (
                                <a
                                    href={`tel:${business.phone}`}
                                    className="flex max-w-xs min-w-[220px] gap-3 rounded-lg p-1 transition hover:bg-zinc-50"
                                >
                                    <span
                                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2"
                                        style={{ borderColor: IBID_PRIMARY_BLUE, color: IBID_PRIMARY_BLUE }}
                                    >
                                        <Phone size={22} strokeWidth={1.5} aria-hidden />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-neutral-900">Phone</p>
                                        <p className="mt-0.5 text-xs leading-snug text-neutral-600">{business.phone}</p>
                                    </div>
                                </a>
                            )}
                            {business.email?.trim() && (
                                <a
                                    href={`mailto:${business.email}`}
                                    className="flex max-w-xs min-w-[220px] gap-3 rounded-lg p-1 transition hover:bg-zinc-50"
                                >
                                    <span
                                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2"
                                        style={{ borderColor: IBID_PRIMARY_BLUE, color: IBID_PRIMARY_BLUE }}
                                    >
                                        <Mail size={22} strokeWidth={1.5} aria-hidden />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-neutral-900">Email</p>
                                        <p className="mt-0.5 break-all text-xs leading-snug text-neutral-600">{business.email}</p>
                                    </div>
                                </a>
                            )}
                            {business.whatsapp?.trim() && (
                                <a
                                    href={
                                        /^https?:\/\//i.test(String(business.whatsapp))
                                            ? String(business.whatsapp)
                                            : `https://wa.me/${String(business.whatsapp).replace(/\D/g, '')}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex max-w-xs min-w-[220px] gap-3 rounded-lg p-1 transition hover:bg-zinc-50"
                                >
                                    <span
                                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2"
                                        style={{ borderColor: IBID_PRIMARY_BLUE, color: IBID_PRIMARY_BLUE }}
                                    >
                                        <FaWhatsapp size={22} className="text-[#25D366]" aria-hidden />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-neutral-900">WhatsApp</p>
                                        <p className="mt-0.5 text-xs leading-snug text-neutral-600">Message on WhatsApp</p>
                                    </div>
                                </a>
                            )}
                            {business.owner_id && (
                                <Link
                                    href={`/messages?targetType=business&targetId=${encodeURIComponent(business.id)}`}
                                    className="flex max-w-xs min-w-[220px] gap-3 rounded-lg p-1 transition hover:bg-zinc-50"
                                >
                                    <span
                                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2"
                                        style={{ borderColor: IBID_PRIMARY_BLUE, color: IBID_PRIMARY_BLUE }}
                                    >
                                        <MessageSquare size={22} strokeWidth={1.5} aria-hidden />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-neutral-900">Message owner</p>
                                        <p className="mt-0.5 text-xs leading-snug text-neutral-600">Direct message on Hanar</p>
                                    </div>
                                </Link>
                            )}
                            {business.website?.trim() && (
                                <a
                                    href={/^https?:\/\//i.test(business.website) ? business.website : `https://${business.website}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex max-w-xs min-w-[220px] gap-3 rounded-lg p-1 transition hover:bg-zinc-50"
                                >
                                    <span
                                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2"
                                        style={{ borderColor: IBID_PRIMARY_BLUE, color: IBID_PRIMARY_BLUE }}
                                    >
                                        <Globe size={22} strokeWidth={1.5} aria-hidden />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-neutral-900">Website</p>
                                        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-neutral-600">{business.website}</p>
                                    </div>
                                </a>
                            )}
                            {business.address?.street?.trim() && (
                                <a
                                    href={getMapUrl(business.address)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex max-w-xs min-w-[220px] gap-3 rounded-lg p-1 transition hover:bg-zinc-50"
                                >
                                    <span
                                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2"
                                        style={{ borderColor: IBID_PRIMARY_BLUE, color: IBID_PRIMARY_BLUE }}
                                    >
                                        <MapPin size={22} strokeWidth={1.5} aria-hidden />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-neutral-900">Location</p>
                                        <p className="mt-0.5 line-clamp-3 text-xs leading-snug text-neutral-600">
                                            {[business.address.street, business.address.city, business.address.state, business.address.zip]
                                                .filter(Boolean)
                                                .join(', ')}
                                        </p>
                                    </div>
                                </a>
                            )}
                            {business.instagram?.trim() && (
                                <a
                                    href={business.instagram}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex max-w-xs min-w-[220px] gap-3 rounded-lg p-1 transition hover:bg-zinc-50"
                                >
                                    <span
                                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2"
                                        style={{ borderColor: IBID_PRIMARY_BLUE, color: IBID_PRIMARY_BLUE }}
                                    >
                                        <Instagram size={22} strokeWidth={1.5} aria-hidden />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-neutral-900">Instagram</p>
                                        <p className="mt-0.5 text-xs leading-snug text-neutral-600">Follow us</p>
                                    </div>
                                </a>
                            )}
                            {business.facebook?.trim() && (
                                <a
                                    href={business.facebook}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex max-w-xs min-w-[220px] gap-3 rounded-lg p-1 transition hover:bg-zinc-50"
                                >
                                    <span
                                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2"
                                        style={{ borderColor: IBID_PRIMARY_BLUE, color: IBID_PRIMARY_BLUE }}
                                    >
                                        <Facebook size={22} strokeWidth={1.5} aria-hidden />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-neutral-900">Facebook</p>
                                        <p className="mt-0.5 text-xs leading-snug text-neutral-600">Connect</p>
                                    </div>
                                </a>
                            )}
                        </div>
                        {![
                            business.phone?.trim(),
                            business.email?.trim(),
                            business.whatsapp?.trim(),
                            business.owner_id,
                            business.website?.trim(),
                            business.address?.street?.trim(),
                            business.instagram?.trim(),
                            business.facebook?.trim(),
                        ].some(Boolean) && (
                            <p className="px-4 pb-6 text-center text-sm text-neutral-500">No contact details provided yet.</p>
                        )}
                    </section>

                    <section
                        id="basel-latest"
                        className="mx-auto max-w-6xl scroll-mt-28 px-4 py-10 lg:px-6"
                    >
                        <h2 className="mb-6 text-center text-sm font-bold uppercase tracking-[0.2em] text-neutral-900 md:text-base">
                            Latest products
                        </h2>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {retailBaselPreviewLatest.length === 0 && (
                                <p className="col-span-full py-6 text-center text-sm text-neutral-500">
                                    No listings match your search.
                                </p>
                            )}
                            {retailBaselPreviewLatest.map((item) => (
                                <button
                                    key={`latest-${item.id}`}
                                    type="button"
                                    onClick={() => setSelectedItemForDetails({ type: 'retail', item })}
                                    className="relative flex flex-col overflow-hidden rounded border border-zinc-200 bg-white text-left shadow-sm transition hover:shadow-md"
                                >
                                    <span
                                        className="absolute left-2 top-2 z-[1] flex h-7 w-7 items-center justify-center rounded-full text-white shadow"
                                        style={{ backgroundColor: IBID_PRIMARY_BLUE }}
                                        aria-hidden
                                    >
                                        <Plus size={16} strokeWidth={2.5} />
                                    </span>
                                    <div className="aspect-square w-full bg-zinc-50 p-4">
                                        {item.images?.[0] ? (
                                            <img
                                                src={item.images[0]}
                                                alt=""
                                                className="h-full w-full object-contain"
                                                onError={(e) => {
                                                    e.currentTarget.src =
                                                        'https://placehold.co/400x400/f4f4f5/71717a?text=Item';
                                                    e.currentTarget.onerror = null;
                                                }}
                                            />
                                        ) : (
                                            <div className="flex h-full items-center justify-center text-xs text-zinc-400">No image</div>
                                        )}
                                    </div>
                                    <div className="border-t border-zinc-100 px-3 py-3">
                                        <p className="line-clamp-2 text-sm font-bold text-neutral-900">{item.name}</p>
                                        <p className="mt-1 text-xs text-neutral-500">
                                            Price:{' '}
                                            <span className="font-semibold text-neutral-800">
                                                {formatPriceWithCurrency(item.price)}
                                            </span>
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>

                    {retailBaselPreviewBlocks.length > 0 && (
                    <section className="mx-auto max-w-6xl px-4 pb-10 lg:px-6">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                            {retailBaselPreviewBlocks.map((item, idx) => (
                                    <div
                                        key={item.id}
                                        className="relative flex min-h-[200px] flex-col justify-between overflow-hidden rounded p-6 text-white sm:min-h-[220px]"
                                        style={{ backgroundColor: IBID_BLOCK_BACKGROUNDS[idx % IBID_BLOCK_BACKGROUNDS.length] }}
                                    >
                                        <div className="relative z-[1] max-w-[60%]">
                                            <h3 className="text-xl font-bold uppercase leading-tight tracking-wide sm:text-2xl">
                                                {item.name.toUpperCase().slice(0, 40)}
                                            </h3>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedItemForDetails({ type: 'retail', item })}
                                                className="mt-4 inline-flex rounded border-2 border-white px-5 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-white/10"
                                            >
                                                View more
                                            </button>
                                        </div>
                                        {item.images?.[0] && (
                                            <div
                                                className={cn(
                                                    'pointer-events-none absolute bottom-0 right-0 h-36 w-36 sm:h-44 sm:w-44',
                                                    idx === 0 && 'translate-y-2',
                                                    idx === 2 && '-translate-y-2'
                                                )}
                                            >
                                                <img src={item.images[0]} alt="" className="h-full w-full object-contain drop-shadow-lg" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    </section>
                    )}

                    <section className="mx-auto max-w-6xl px-4 pb-10 lg:px-6">
                        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:gap-6">
                            <div
                                className={cn(
                                    'flex flex-col justify-between rounded p-8 text-white',
                                    retailBaselPhoneGridItems.length > 0 ? 'lg:col-span-4' : 'lg:col-span-12'
                                )}
                                style={{ backgroundColor: IBID_PRIMARY_BLUE, minHeight: '280px' }}
                            >
                                <div>
                                    <h3 className="text-2xl font-bold uppercase tracking-wide">
                                        {retailBaselFeaturedCategoryLabel}
                                    </h3>
                                    <p className="mt-2 text-sm text-white/90">
                                        {retailCategoryChips[0]?.label
                                            ? retailItems.filter(
                                                  (i) =>
                                                      (i.category || '').trim().toLowerCase() ===
                                                      retailCategoryChips[0].label.trim().toLowerCase()
                                              ).length
                                            : retailItems.length}{' '}
                                        {retailCategoryChips[0]?.label ? 'items in this category' : 'products'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => document.getElementById('basel-latest')?.scrollIntoView({ behavior: 'smooth' })}
                                    className="mt-6 w-full rounded-full border-2 border-white py-3 text-center text-sm font-bold uppercase tracking-widest text-white transition hover:bg-white/10 sm:w-auto sm:self-start sm:px-8"
                                >
                                    View all items
                                </button>
                            </div>
                            {retailBaselPhoneGridItems.length > 0 && (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-8">
                                {retailBaselPhoneGridItems.map((item) => (
                                    <button
                                        key={`phone-${item.id}`}
                                        type="button"
                                        onClick={() => setSelectedItemForDetails({ type: 'retail', item })}
                                        className="flex gap-3 overflow-hidden rounded border border-zinc-200 bg-white p-3 text-left shadow-sm transition hover:shadow-md"
                                    >
                                        <span className="h-24 w-24 shrink-0 overflow-hidden rounded bg-zinc-50">
                                            {item.images?.[0] ? (
                                                <img src={item.images[0]} alt="" className="h-full w-full object-contain p-1" />
                                            ) : null}
                                        </span>
                                        <span className="flex min-w-0 flex-1 flex-col justify-center">
                                            <span className="line-clamp-2 text-sm font-semibold text-neutral-900">{item.name}</span>
                                            <span className="mt-1 text-sm font-bold text-neutral-800">
                                                {formatPriceWithCurrency(item.price)}
                                            </span>
                                        </span>
                                        <span
                                            className="flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full text-white"
                                            style={{ backgroundColor: IBID_PRIMARY_BLUE }}
                                            aria-hidden
                                        >
                                            <Plus size={16} strokeWidth={2.5} />
                                        </span>
                                    </button>
                                ))}
                            </div>
                            )}
                        </div>
                    </section>

                    <section id="basel-about" className="mx-auto max-w-6xl border-t border-zinc-200 px-3 py-10 sm:px-4">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-900">About</h2>
                        <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-neutral-600">
                            {business.description || ' '}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-4">
                            <ReportButton
                                entityType="business"
                                entityId={business.id}
                                entityTitle={business.business_name}
                                variant="text"
                                className="text-sm text-neutral-500 hover:text-rose-600"
                            />
                            <button
                                type="button"
                                onClick={handleShare}
                                className="text-sm font-medium hover:underline"
                                style={{ color: retailSearchAccentSolid }}
                            >
                                Share this shop
                            </button>
                        </div>
                    </section>

                    {business.address?.street && (
                        <section className="mx-auto max-w-6xl px-3 pb-8 sm:px-4">
                            <div className="overflow-hidden rounded-lg border border-zinc-200">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const mapUrl = getMapUrl(business.address);
                                        window.open(mapUrl, '_blank');
                                    }}
                                    className="flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white transition hover:brightness-110"
                                    style={retailSearchCtaStyle}
                                >
                                    <FaDirections size={16} />
                                    Get directions
                                </button>
                                <div className="h-[200px] w-full sm:h-[240px]">
                                    <BusinessMap address={business.address} />
                                </div>
                            </div>
                        </section>
                    )}

                    {hasMoreItems && (
                        <div className="w-full px-4">
                            {isLoadingMore && (
                                <div className="flex justify-center py-4" aria-live="polite">
                                    <div
                                        className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200"
                                        style={{ borderTopColor: retailSearchAccentSolid }}
                                    />
                                </div>
                            )}
                            <div ref={loadMoreRef} className="h-8 w-full" aria-hidden="true" />
                        </div>
                    )}

                    <footer className="mt-6 border-t border-zinc-200 bg-zinc-50 py-6 text-center text-xs text-zinc-500" data-no-translate>
                        © {new Date().getFullYear()} {business.business_name} · Hanar
                    </footer>
                </motion.div>
            ) : (
                <motion.div className="w-full space-y-0 bg-gray-100 dark:bg-slate-900/80 backdrop-blur lg:px-6 lg:pt-4">
                {business.moderation_status !== 'active' && (
                    <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        Your business is currently pending approval. You can still view and edit your business profile and online
                        shop, but it will not be visible to other users until it has been approved.
                    </div>
                )}
                {/* Gallery + action bar - full width, buttons directly under gallery */}
                <div className="relative left-1/2 -translate-x-1/2 w-screen max-w-none lg:static lg:left-0 lg:translate-x-0 lg:w-full lg:overflow-hidden">
                    {business.images?.length ? (
                        <div
                            className="relative overflow-hidden w-full aspect-video lg:aspect-auto lg:h-[420px] flex items-center justify-center group bg-black/5 dark:bg-black/20"
                            onTouchStart={handleGalleryTouchStart}
                            onTouchMove={handleGalleryTouchMove}
                            onTouchEnd={handleGalleryTouchEnd}
                        >
                            <img
                                src={business.images[selectedIndex]}
                                alt={`Slide ${selectedIndex + 1}`}
                                className="w-full h-full object-cover transition-transform duration-500"
                                onError={(e) => { e.currentTarget.src = 'https://placehold.co/600x400/cccccc/333333?text=Image+Not+Available'; e.currentTarget.onerror = null; }}
                            />
                            {business.images.length > 1 && (<>
                                <button onClick={prevImage} className="absolute top-1/2 left-4 transform -translate-y-1/2 bg-white/50 dark:bg-gray-800/50 hover:bg-white/70 dark:hover:bg-gray-700/70 text-gray-800 dark:text-gray-200 rounded-full shadow p-2 opacity-0 group-hover:opacity-100 transition-opacity"><FaArrowLeft size={20} /></button>
                                <button onClick={nextImage} className="absolute top-1/2 right-4 transform -translate-y-1/2 bg-white/50 dark:bg-gray-800/50 hover:bg-white/70 dark:hover:bg-gray-700/70 text-gray-800 dark:text-gray-200 rounded-full shadow p-2 opacity-0 group-hover:opacity-100 transition-opacity"><FaArrowRight size={20} /></button>
                                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-2">
                                    {business.images.map((_, index) => (
                                        <div key={index} className={cn(
                                            "w-3 h-3 rounded-full transition-colors duration-300 cursor-pointer",
                                            selectedIndex === index
                                                ? "bg-[#b91c1c] dark:bg-red-500"
                                                : "bg-gray-300 dark:bg-gray-600"
                                        )} onClick={() => setSelectedIndex(index)} />
                                    ))}
                                </div>
                            </>)}
                        </div>
                    ) : null}
                    {/* Action bar - dark blue gradient strip, white icons */}
                    <div
                        className="flex flex-wrap items-center justify-center gap-2 px-4 py-3 border-t border-white/15 shadow-[inset_0_1px_0_rgba(130,170,230,0.2)] dark:shadow-[inset_0_1px_0_rgba(100,140,200,0.12)]"
                        style={{ background: slugBrandBackground }}
                    >
                        {business.phone && (
                            <a href={`tel:${business.phone}`} aria-label="Call" className={CONTACT_STRIP_CHIP}>
                                <FaPhone size={18} className="shrink-0" />
                            </a>
                        )}
                        {business.whatsapp && (
                            <a href={`https://wa.me/${business.whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className={CONTACT_STRIP_CHIP}>
                                <FaWhatsapp size={20} className="shrink-0" />
                            </a>
                        )}
                        {business.email && (
                            <a href={`mailto:${business.email}`} aria-label="Email" className={CONTACT_STRIP_CHIP}>
                                <FaEnvelope size={18} className="shrink-0" />
                            </a>
                        )}
                        {business.website && (
                            <a href={business.website} target="_blank" rel="noopener noreferrer" aria-label="External link" className={CONTACT_STRIP_CHIP}>
                                <FaGlobe size={18} className="shrink-0" />
                            </a>
                        )}
                        {business.owner_id && (
                            <Link
                                href={`/messages?targetType=business&targetId=${encodeURIComponent(business.id)}`}
                                aria-label="Message business"
                                className={CONTACT_STRIP_CHIP}
                            >
                                <FaCommentDots size={18} className="shrink-0" />
                            </Link>
                        )}
                        <button
                            type="button"
                            onClick={handleShare}
                            aria-label="Share"
                            className={cn(CONTACT_STRIP_CHIP, 'border-0 cursor-pointer')}
                        >
                            <FaShareAlt size={18} className="shrink-0" />
                        </button>
                        {business && (
                            <ReportButton
                                entityType="business"
                                entityId={business.id}
                                entityTitle={business.business_name}
                                variant="icon"
                                className="flex items-center justify-center h-10 w-10 rounded-xl bg-white/10 !text-white ring-1 ring-white/20 transition !rounded-xl hover:bg-white/20 hover:!bg-red-500/40 hover:!text-red-100 [&_svg]:stroke-white"
                            />
                        )}
                    </div>
                </div>
                {/* Name + Description - scrolls away with page */}
                <motion.div className="border-t border-b border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900">
                    <div className="p-4 sm:p-6 bg-white dark:bg-slate-900">
                        <div className="flex w-full items-center gap-4">
                            {business.logo_url && (
                                <div className="w-24 sm:w-28 h-24 sm:h-28 flex-shrink-0 overflow-hidden shadow-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-gray-900">
                                    <img
                                        src={business.logo_url}
                                        alt="Business Logo"
                                        className="object-contain w-full h-full p-2"
                                        onError={(e) => { e.currentTarget.src = 'https://placehold.co/120x120/cccccc/333333?text=Logo'; e.currentTarget.onerror = null; }}
                                    />
                                </div>
                            )}
                            <div className="min-w-0 flex-1 text-left">
                                <h1
                                    className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100"
                                    data-no-translate
                                >
                                    {business.business_name}
                                </h1>
                                {displayCategory ? (
                                  <p className="text-sm font-normal text-gray-500 dark:text-gray-400 italic">{displayCategory}</p>
                                ) : null}
                            </div>
                        </div>
                        <p className="mt-2 font-normal text-[#444] dark:text-gray-300 leading-relaxed whitespace-pre-line">
                            {business.description}
                        </p>
                        {(hasHours || hasSocials) && (
                            <>
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600 flex flex-wrap items-center gap-2">
                                {hasHours && (
                                    <>
                                        <span className="inline-flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                            Today: <span className="font-semibold">{todayHours}</span>
                                        </span>
                                        <button
                                            onClick={() => setShowHours((prev) => !prev)}
                                            className="p-1 rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 transition-colors"
                                            aria-label={showHours ? 'Hide hours' : 'View all hours'}
                                        >
                                            <ChevronDown size={16} className={cn('transition-transform', showHours && 'rotate-180')} />
                                        </button>
                                    </>
                                )}
                                {hasSocials && (
                                    <span className="inline-flex items-center gap-8 rounded-lg bg-gray-100 dark:bg-gray-700 px-5 py-2">
                                        {business.instagram && (<a href={business.instagram} target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-80 [&_path]:fill-[url(#businessSocialBlueGradient)]" aria-label="Instagram"><FaInstagram size={18} /></a>)}
                                        {business.facebook && (<a href={business.facebook} target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-80 [&_path]:fill-[url(#businessSocialBlueGradient)]" aria-label="Facebook"><FaFacebook size={18} /></a>)}
                                        {business.tiktok && (<a href={business.tiktok} target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-80 [&_path]:fill-[url(#businessSocialBlueGradient)]" aria-label="TikTok"><FaTiktok size={18} /></a>)}
                                        {business.twitter && (<a href={business.twitter} target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-80 [&_path]:fill-[url(#businessSocialBlueGradient)]" aria-label="X"><FaXTwitter size={18} /></a>)}
                                    </span>
                                )}
                            </div>
                            {hasHours && showHours && (
                                    <div className="mt-4 border border-slate-300 dark:border-slate-600 overflow-hidden bg-white dark:bg-gray-800 rounded-lg">
                                        {normalizedHours ? (
                                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                                {hoursEntries.map(([day, hours]) => {
                                                    const isToday = day.toLowerCase() === todayKey;
                                                    return (
                                                        <div
                                                            key={day}
                                                            className={`flex items-center justify-between px-3 py-2 text-sm ${
                                                                isToday
                                                                    ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-200'
                                                                    : 'text-gray-700 dark:text-gray-300'
                                                            }`}
                                                        >
                                                            <span className="capitalize font-medium">{day}</span>
                                                            <span className={`${isToday ? 'font-semibold' : 'text-gray-600 dark:text-gray-400'}`}>
                                                                {hours || 'Closed'}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : fallbackHoursText ? (
                                            <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">{fallbackHoursText}</div>
                                        ) : (
                                            <div className="px-3 py-2 text-sm text-gray-400 italic">Hours not provided</div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </motion.div>
                {/* Address / map — menu & listings follow below */}
                {business.address?.street && (
                    <motion.div className="rounded-b-xl border-2 border-t-0 border-slate-300 dark:border-slate-600 bg-white p-0 shadow-sm dark:bg-slate-900/90 overflow-hidden">
                        <div className="w-full">
                            <div className="flex justify-center px-0 pb-2 pt-3 sm:px-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const mapUrl = getMapUrl(business.address);
                                        window.open(mapUrl, '_blank');
                                    }}
                                    className="flex w-full items-center justify-center gap-2 rounded-none px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 sm:w-auto sm:rounded"
                                    style={viewDetailButtonStyle}
                                >
                                    <FaDirections size={16} />
                                    <span>
                                        Get Directions
                                        {business.address?.street || business.address?.city || business.address?.state || business.address?.zip
                                            ? ` · ${[business.address?.street, business.address?.city, business.address?.state, business.address?.zip].filter(Boolean).join(', ')}`
                                            : ''}
                                    </span>
                                </button>
                            </div>
                            <div className="relative w-full overflow-hidden sm:rounded-b-xl">
                                <BusinessMap address={business.address} />
                            </div>
                        </div>
                    </motion.div>
                )}
                {/* === Shop: menu & listings (under address map) === */}
                {(menu.length > 0 || carListings.length > 0 || retailItems.length > 0 || realEstateListings.length > 0) && (
                    <motion.div className="mt-4 border-b border-slate-300 dark:border-slate-600 p-4 sm:p-6 space-y-10 bg-white dark:bg-gray-800">
                        {/* Menu */}
                        {menu.length > 0 && (
                            <div>
                                <h2 className="text-xl font-semibold text-[#333] dark:text-gray-100 mb-4 flex items-center gap-2">
                                    <ClipboardListIcon size={20} /> Menu
                                </h2>
                                <div className="space-y-8">
                                    {groupedVisibleMenu.map((group) => (
                                        <div key={group.category}>
                                            <div className="flex items-center justify-between border-b border-dashed border-slate-300/70 dark:border-slate-500/70 pb-2 mb-3">
                                                <h3 className="text-lg font-semibold text-orange-600 dark:text-orange-400">
                                                    {group.category}
                                                </h3>
                                                <span className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                                    Menu
                                                </span>
                                            </div>
                                            <div className="divide-y divide-dashed divide-slate-200 dark:divide-slate-600">
                                                {group.items.map((item) => (
                                                    <div key={item.id} className="py-3">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="min-w-0">
                                                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                                                    {item.name}
                                                                </p>
                                                                {item.description && (
                                                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                                                        {item.description}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                {item.price && (
                                                                    <span className="text-sm font-semibold text-[#8b2020] dark:text-red-300">
                                                                        {formatPriceWithCurrency(item.price)}
                                                                    </span>
                                                                )}
                                                                <button
                                                                    onClick={() => setSelectedItemForDetails({ type: 'menu', item: item })}
                                                                    className="rounded-md px-3 py-1.5 text-sm text-white transition hover:brightness-110"
                                                                    style={viewDetailButtonStyle}
                                                                >
                                                                    Details
                                                                </button>
                                                                <button
                                                                    onClick={() => handleItemShare(item.name)}
                                                                    className="px-2.5 py-1.5 text-sm bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] text-white rounded-md hover:from-[#1e40af] hover:to-[#2563eb] transition-colors border border-[#60a5fa] dark:from-[#1e3a8a] dark:to-[#1d4ed8] dark:hover:from-[#1e3a8a] dark:hover:to-[#1e40af]"
                                                                >
                                                                    <FaShareAlt size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* Car Listings */}
                        {carListings.length > 0 && (
                            <div>
                                <h2 className="mb-4">
                                    <span className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#0c1f3c] via-[#153a5c] to-[#0c1f3c] px-3 py-2 text-xl font-semibold text-white shadow-sm dark:from-[#061018] dark:via-[#0d2844] dark:to-[#061018]">
                                        <Car size={20} /> Car Listings
                                    </span>
                                </h2>
                                <div className="grid grid-cols-2 gap-3">
                                    {carListings.slice(0, visibleCarCount).map((car) => (
                                        <div
                                            key={car.id}
                                            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-600 dark:bg-gray-800"
                                        >
                                            {car.images && car.images.length > 0 && car.images[0] && (
                                                <div className="w-full h-24 sm:h-28 relative flex-shrink-0 mb-2">
                                                    <img
                                                        src={car.images[0]}
                                                        alt={car.title}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => { e.currentTarget.src = 'https://placehold.co/300x200/cccccc/333333?text=Car+Image'; e.currentTarget.onerror = null; }}
                                                    />
                                                </div>
                                            )}
                                            <div className="p-2.5 flex flex-col flex-grow">
                                                <h3 className="line-clamp-1 font-semibold text-sm text-slate-900 dark:text-slate-100">{car.title}</h3>
                                                <p className="mt-1 text-sm font-bold text-red-600 dark:text-red-300">
                                                    {formatPriceWithCurrency(car.price)}
                                                </p>
                                                <div className="mt-1.5 flex flex-wrap gap-1">
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-200"><Calendar size={11} /> {car.year}</span>
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-200"><Gauge size={11} /> {car.mileage}</span>
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-200"><HeartHandshake size={11} /> {car.condition}</span>
                                                </div>
                                                <div className="mt-auto pt-2 flex gap-1.5">
                                                    <button
                                                        onClick={() => setSelectedItemForDetails({ type: 'car', item: car })}
                                                        className="flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                                                        style={viewDetailButtonStyle}
                                                    >
                                                        <Eye size={14} />
                                                        Details
                                                    </button>
                                                    <button
                                                        onClick={() => handleItemShare(car.title)}
                                                        className="inline-flex items-center justify-center rounded-md border border-[#60a5fa] bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] px-2 py-1.5 text-white transition-colors hover:from-[#1e40af] hover:to-[#2563eb] dark:from-[#1e3a8a] dark:to-[#1d4ed8]"
                                                    >
                                                        <FaShareAlt size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* Retail Items */}
                        {retailItems.length > 0 && (
                            <div>
                                <h2 className="text-xl font-semibold text-[#333] dark:text-gray-100 mb-4 flex items-center gap-2">
                                    <StoreIcon size={20} /> Retail Items
                                </h2>
                                <div className="grid grid-cols-2 gap-3">
                                    {retailItems.slice(0, visibleRetailCount).map((item) => (
                                        <div
                                            key={item.id}
                                            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-600 dark:bg-gray-800"
                                        >
                                            {item.images?.[0] && (
                                                <div className="w-full h-24 sm:h-28 relative flex-shrink-0 mb-2">
                                                    <img
                                                        src={item.images[0]}
                                                        alt={item.name}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => { e.currentTarget.src = 'https://placehold.co/300x200/cccccc/333333?text=Retail+Item'; e.currentTarget.onerror = null; }}
                                                    />
                                                </div>
                                            )}
                                            <div className="p-2.5 flex flex-col flex-grow">
                                                <h3 className="line-clamp-1 font-semibold text-sm text-slate-900 dark:text-slate-100">{item.name}</h3>
                                                <p className="mt-1 text-sm font-bold text-red-600 dark:text-red-300">
                                                    {formatPriceWithCurrency(item.price)}
                                                </p>
                                                <div className="mt-1.5 inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-200">
                                                    {item.category}
                                                </div>
                                                <p className="mt-1.5 line-clamp-1 text-[11px] text-slate-600 dark:text-slate-300">
                                                    {item.description}
                                                </p>
                                                <div className="mt-auto pt-2 flex gap-1.5">
                                                    <button
                                                        onClick={() => setSelectedItemForDetails({ type: 'retail', item: item })}
                                                        className="flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                                                        style={viewDetailButtonStyle}
                                                    >
                                                        <Eye size={14} />
                                                        Details
                                                    </button>
                                                    <button
                                                        onClick={() => handleItemShare(item.name)}
                                                        className="inline-flex items-center justify-center rounded-md border border-[#60a5fa] bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] px-2 py-1.5 text-white transition-colors hover:from-[#1e40af] hover:to-[#2563eb] dark:from-[#1e3a8a] dark:to-[#1d4ed8]"
                                                    >
                                                        <FaShareAlt size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* Real Estate Listings */}
                        {realEstateListings.length > 0 && (
                            <div className="rounded-xl border-2 border-slate-300 dark:border-slate-600 p-4 sm:p-6 bg-slate-50 dark:bg-slate-900/80 shadow-sm">
                                <h2 className="text-xl font-semibold text-[#333] dark:text-gray-100 mb-4 flex items-center gap-2">
                                    <Home size={20} /> Real Estate
                                </h2>
                                <div className="grid grid-cols-2 gap-3">
                                    {realEstateListings.slice(0, visibleRealEstateCount).map((item) => (
                                        <div
                                            key={item.id}
                                            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-600 dark:bg-gray-800"
                                        >
                                            {item.images?.[0] && (
                                                <div className="w-full h-24 sm:h-28 relative flex-shrink-0 mb-2">
                                                    <img
                                                        src={item.images[0]}
                                                        alt={item.title}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => { e.currentTarget.src = 'https://placehold.co/300x200/cccccc/333333?text=Property'; e.currentTarget.onerror = null; }}
                                                    />
                                                </div>
                                            )}
                                            <div className="p-2.5 flex flex-col flex-grow">
                                                <h3 className="line-clamp-1 font-semibold text-sm text-slate-900 dark:text-slate-100">{item.title}</h3>
                                                <p className="mt-1 font-bold text-red-600 dark:text-red-300">
                                                    {item.price ? formatPriceWithCurrency(item.price) : ''}
                                                </p>
                                                {item.address && <p className="mt-1 line-clamp-1 text-[11px] text-slate-600 dark:text-slate-300">{item.address}</p>}
                                                <p className="mt-1 line-clamp-1 text-[11px] text-slate-600 dark:text-slate-300">{item.description}</p>
                                                <div className="mt-auto pt-2 flex gap-1.5">
                                                    <button
                                                        onClick={() => setSelectedItemForDetails({ type: 'real_estate', item })}
                                                        className="flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                                                        style={viewDetailButtonStyle}
                                                    >
                                                        <Eye size={14} />
                                                        Details
                                                    </button>
                                                    <button
                                                        onClick={() => handleItemShare(item.title)}
                                                        className="inline-flex items-center justify-center rounded-md border border-[#60a5fa] bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] px-2 py-1.5 text-white transition-colors hover:from-[#1e40af] hover:to-[#2563eb] dark:from-[#1e3a8a] dark:to-[#1d4ed8]"
                                                    >
                                                        <FaShareAlt size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
                {/* === END ITEMS SECTION === */}
                {hasMoreItems && (
                    <div className="w-full">
                        {isLoadingMore && (
                            <div className="flex justify-center py-4" aria-live="polite">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500 dark:border-gray-600 dark:border-t-indigo-400" />
                            </div>
                        )}
                        <div ref={loadMoreRef} className="h-8 w-full" aria-hidden="true" />
                    </div>
                )}
            </motion.div>
            )}

        </motion.div>
    );
};
export default BusinessProfilePage;
