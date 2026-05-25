'use client';

import { createPortal } from 'react-dom';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation'; // This import remains as per your original code
import { supabase } from '@/lib/supabaseClient'; // This import remains as per your original code
import toast from 'react-hot-toast';
import {
    FaInstagram, FaFacebook, FaTiktok, FaGlobe,
    FaShareAlt, FaArrowLeft, FaArrowRight,
    FaPhone, FaEnvelope, FaMapPin,
    FaWhatsapp,
    FaHeart, FaRegHeart, FaCommentDots
} from 'react-icons/fa'; // These imports remain as per your original code
import { FaXTwitter } from 'react-icons/fa6';
import { motion } from 'framer-motion'; // This import remains as per your original code
import Script from 'next/script'; // This import remains as per your original code
import BusinessMap from '@/components/BusinessMap';
import Image from 'next/image'; // Added for Image component

import {
    Car, Calendar, Gauge, HeartHandshake,
    Store as StoreIcon,
    ClipboardList as ClipboardListIcon,
    Home, MapPin,
    X, DollarSign, Eye, ChevronLeft, ChevronRight, ChevronDown, Tag, QrCode, Copy, Check, Megaphone, Search,
} from 'lucide-react'; // These imports remain as per your original code

import { cn } from '@/lib/utils'; // This import remains as per your original code
import { setBusinessesEnteredFromBusinessSlug } from '@/lib/businessesDirectoryNav';
import ReportButton from '@/components/ReportButton';
import BusinessCommunityPostsModal, { type BusinessCommunityPostRow } from '@/components/BusinessCommunityPostsModal';
import BusinessClaimModal, { type UserClaimInfo } from '@/components/BusinessClaimModal';
import { BusinessDescriptionText } from '@/components/BusinessDescriptionText';
import { isClaimableBusiness, showBusinessClaimUi } from '@/lib/businessClaim';
import { ContactHrefLink } from '@/components/ContactHrefLink';
import { buildMailtoHref, buildTelHref } from '@/lib/openContactUrl';

/** Contact strip on transparent bar (all business slug pages) */
const CONTACT_STRIP_CHIP =
  'flex items-center justify-center h-10 px-4 rounded-xl bg-transparent text-slate-700 ring-1 ring-slate-300/70 transition-colors duration-200 hover:bg-white/40 active:scale-[0.98] dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-white/5';

const CONTACT_REPORT_BUTTON_CLASS =
  'flex items-center justify-center h-10 w-10 rounded-xl bg-transparent !text-slate-600 ring-1 ring-slate-300/70 transition !rounded-xl hover:bg-white/40 hover:!text-red-600 dark:!text-slate-200 dark:ring-slate-600 dark:hover:bg-white/5 dark:hover:!text-red-400 [&_svg]:stroke-current';

/** Grey share button with blue icon — menu & listing item rows */
const ITEM_SHARE_BUTTON_CLASS =
  'inline-flex items-center justify-center rounded-md border border-slate-300 bg-slate-200 text-[#2563eb] transition-colors hover:bg-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-[#3b82f6] dark:hover:bg-slate-600';

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
    admin_added_at?: string | null;
    claim_status?: 'unclaimed' | 'pending' | 'claimed' | 'rejected' | null;
    slug_primary_color?: string | null;
    slug_secondary_color?: string | null;
    slug_use_gradient?: boolean | null;
    slug_retail_search_accent_color?: string | null;
    slug_view_detail_button_color?: string | null;
    slug_sidebar_menu_button_color?: string | null;
    isrestaurant?: boolean | null;
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

type CarInventorySort =
    | 'default'
    | 'price_asc'
    | 'price_desc'
    | 'mileage_asc'
    | 'mileage_desc'
    | 'year_desc'
    | 'year_asc'
    | 'title_asc'
    | 'title_desc';

const CAR_INVENTORY_SORT_OPTIONS: { value: CarInventorySort; label: string }[] = [
    { value: 'default', label: 'Default order' },
    { value: 'price_asc', label: 'Price: low to high' },
    { value: 'price_desc', label: 'Price: high to low' },
    { value: 'mileage_asc', label: 'Mileage: low to high' },
    { value: 'mileage_desc', label: 'Mileage: high to low' },
    { value: 'year_desc', label: 'Year: newest first' },
    { value: 'year_asc', label: 'Year: oldest first' },
    { value: 'title_asc', label: 'Name: A–Z' },
    { value: 'title_desc', label: 'Name: Z–A' },
];

function parseCarNumeric(value: string | number | undefined): number {
    const numeric = Number(String(value ?? '').replace(/[^\d.]/g, ''));
    return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
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

function MenuAccordionTrigger({
    expanded,
    onToggle,
    itemCount,
    categoryCount,
}: {
    expanded: boolean;
    onToggle: () => void;
    itemCount: number;
    categoryCount: number;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className={cn(
                'group flex w-full flex-col gap-3 rounded-xl border-2 p-4 text-left shadow-md transition-all',
                'border-orange-300 bg-gradient-to-br from-orange-50 via-amber-50 to-white',
                'hover:border-orange-400 hover:shadow-lg active:scale-[0.995]',
                'dark:border-orange-500/50 dark:from-orange-950/50 dark:via-amber-950/30 dark:to-gray-800',
                expanded && 'rounded-b-none border-b-0 shadow-sm ring-2 ring-orange-300/50 dark:ring-orange-500/40'
            )}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse menu' : 'Expand menu'}
        >
            <div className="flex w-full items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-md ring-4 ring-orange-100 dark:from-orange-600 dark:to-amber-700 dark:ring-orange-900/60">
                        <ClipboardListIcon size={24} strokeWidth={2} />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold leading-tight text-slate-900 dark:text-white sm:text-xl">
                            {expanded ? 'Our Menu' : 'View Our Menu'}
                        </h2>
                        <p className="mt-0.5 text-sm font-medium text-slate-600 dark:text-slate-300">
                            {itemCount} {itemCount === 1 ? 'item' : 'items'}
                            {categoryCount > 0 ? ` · ${categoryCount} ${categoryCount === 1 ? 'category' : 'categories'}` : ''}
                        </p>
                    </div>
                </div>
                <span className="flex shrink-0 flex-col items-center gap-1">
                    <span
                        className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-full border-2 border-orange-400 bg-white shadow-sm transition-all dark:border-orange-500/60 dark:bg-gray-900',
                            expanded ? 'rotate-180 bg-orange-50 dark:bg-orange-950/40' : 'group-hover:scale-110 group-hover:border-orange-500'
                        )}
                    >
                        <ChevronDown size={22} className="text-orange-600 dark:text-orange-400" strokeWidth={2.5} />
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300">
                        {expanded ? 'Hide' : 'Expand'}
                    </span>
                </span>
            </div>
            {!expanded && (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-orange-300/80 bg-orange-100/60 px-3 py-2 dark:border-orange-500/40 dark:bg-orange-950/30">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-orange-500" aria-hidden />
                    <span className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                        Tap to browse the full menu
                    </span>
                </div>
            )}
        </button>
    );
}

function RetailItemsGrid({
    items,
    visibleCount,
    viewDetailButtonStyle,
    onDetails,
    onShare,
}: {
    items: RetailItem[];
    visibleCount: number;
    viewDetailButtonStyle: { background: string };
    onDetails: (item: RetailItem) => void;
    onShare: (name: string) => void;
}) {
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {items.slice(0, visibleCount).map((item) => (
                <div
                    key={item.id}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-600 dark:bg-gray-800"
                >
                    {item.images?.[0] ? (
                        <div className="relative mb-2 h-28 w-full flex-shrink-0 sm:h-32">
                            <img
                                src={item.images[0]}
                                alt={item.name}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                    e.currentTarget.src = 'https://placehold.co/300x200/cccccc/333333?text=Retail+Item';
                                    e.currentTarget.onerror = null;
                                }}
                            />
                        </div>
                    ) : null}
                    <div className="flex flex-grow flex-col p-2.5">
                        <h3 className="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{item.name}</h3>
                        <p className="mt-1 text-sm font-bold text-red-600 dark:text-red-300">
                            {formatPriceWithCurrency(item.price)}
                        </p>
                        {item.category ? (
                            <div className="mt-1.5 inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-200">
                                {item.category}
                            </div>
                        ) : null}
                        {item.description ? (
                            <p className="mt-1.5 line-clamp-2 text-[11px] text-slate-600 dark:text-slate-300">{item.description}</p>
                        ) : null}
                        <div className="mt-auto flex gap-1.5 pt-2">
                            <button
                                type="button"
                                onClick={() => onDetails(item)}
                                className="flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                                style={viewDetailButtonStyle}
                            >
                                <Eye size={14} />
                                Details
                            </button>
                            <button
                                type="button"
                                onClick={() => onShare(item.name)}
                                className={cn(ITEM_SHARE_BUTTON_CLASS, 'px-2 py-1.5')}
                            >
                                <FaShareAlt size={13} />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

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

/** Link to the directory without a large Hanar mark — matches other header icon chips. */
function BusinessesDirectoryLink({ className }: { className?: string }) {
    return (
        <Link
            href="/businesses"
            onClick={() => setBusinessesEnteredFromBusinessSlug()}
            className={cn(
                'inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2 text-white ring-1 ring-white/25 transition hover:bg-white/20 sm:h-10 sm:gap-1.5 sm:px-2.5',
                className
            )}
            aria-label="Browse all businesses"
        >
            <ChevronLeft className="h-[18px] w-[18px] shrink-0 opacity-90" strokeWidth={2.25} aria-hidden />
            <span className="hidden text-xs font-semibold tracking-tight text-white/95 sm:inline sm:text-sm">All businesses</span>
        </Link>
    );
}

const BusinessProfilePage = () => {
    const params = useParams();
    const slugParam = typeof params?.slug === 'string' ? params.slug : '';
    const slug = (() => {
        try {
            return decodeURIComponent(slugParam);
        } catch {
            return slugParam;
        }
    })();

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
    const [showMenu, setShowMenu] = useState(false);
    const [showQrModal, setShowQrModal] = useState(false);
    const [qrCopied, setQrCopied] = useState(false);
    const [communityPosts, setCommunityPosts] = useState<BusinessCommunityPostRow[]>([]);
    const [communityCommentCounts, setCommunityCommentCounts] = useState<Record<string, number>>({});
    const [communityPostsLoading, setCommunityPostsLoading] = useState(false);
    const [showCommunityModal, setShowCommunityModal] = useState(false);
    const [showClaimModal, setShowClaimModal] = useState(false);
    const [userClaim, setUserClaim] = useState<UserClaimInfo>(null);
    const [storeSearchQuery, setStoreSearchQuery] = useState('');
    const [storeCategoryFilter, setStoreCategoryFilter] = useState('');
    const [carSearchQuery, setCarSearchQuery] = useState('');
    const [carSort, setCarSort] = useState<CarInventorySort>('default');

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

    const storeCategoryOptions = useMemo(() => {
        const map = new Map<string, string>();
        retailItems.forEach((item) => {
            const label = (item.category || '').trim();
            if (!label) return;
            const key = label.toLowerCase();
            if (!map.has(key)) map.set(key, label);
        });
        return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    }, [retailItems]);

    const filteredRetailItems = useMemo(() => {
        let list = retailItems;
        if (storeCategoryFilter) {
            const categoryKey = storeCategoryFilter.trim().toLowerCase();
            list = list.filter((item) => (item.category || '').trim().toLowerCase() === categoryKey);
        }
        const q = storeSearchQuery.trim().toLowerCase();
        if (!q) return list;
        return list.filter(
            (item) =>
                item.name.toLowerCase().includes(q) ||
                (item.description || '').toLowerCase().includes(q) ||
                (item.category || '').toLowerCase().includes(q) ||
                String(item.price || '').toLowerCase().includes(q)
        );
    }, [retailItems, storeSearchQuery, storeCategoryFilter]);

    const filteredCarListings = useMemo(() => {
        let list = carListings;

        const q = carSearchQuery.trim().toLowerCase();
        if (q) {
            list = list.filter(
                (car) =>
                    car.title.toLowerCase().includes(q) ||
                    (car.description || '').toLowerCase().includes(q) ||
                    String(car.year || '').toLowerCase().includes(q) ||
                    String(car.mileage || '').toLowerCase().includes(q) ||
                    String(car.condition || '').toLowerCase().includes(q) ||
                    String(car.price || '').toLowerCase().includes(q)
            );
        }

        if (carSort === 'default') return list;

        const sorted = [...list];
        sorted.sort((a, b) => {
            switch (carSort) {
                case 'price_asc':
                    return parseCarNumeric(a.price) - parseCarNumeric(b.price);
                case 'price_desc':
                    return parseCarNumeric(b.price) - parseCarNumeric(a.price);
                case 'mileage_asc':
                    return parseCarNumeric(a.mileage) - parseCarNumeric(b.mileage);
                case 'mileage_desc':
                    return parseCarNumeric(b.mileage) - parseCarNumeric(a.mileage);
                case 'year_desc':
                    return parseCarNumeric(b.year) - parseCarNumeric(a.year);
                case 'year_asc':
                    return parseCarNumeric(a.year) - parseCarNumeric(b.year);
                case 'title_asc':
                    return a.title.localeCompare(b.title);
                case 'title_desc':
                    return b.title.localeCompare(a.title);
                default:
                    return 0;
            }
        });
        return sorted;
    }, [carListings, carSearchQuery, carSort]);

    useEffect(() => {
        setVisibleMenuCount(ITEMS_PER_BATCH);
        setVisibleCarCount(ITEMS_PER_BATCH);
        setVisibleRetailCount(ITEMS_PER_BATCH);
        setVisibleRealEstateCount(ITEMS_PER_BATCH);
        setShowMenu(false);
    }, [menu.length, carListings.length, retailItems.length, realEstateListings.length]);

    useEffect(() => {
        setVisibleRetailCount(ITEMS_PER_BATCH);
    }, [storeSearchQuery, storeCategoryFilter]);

    useEffect(() => {
        setVisibleCarCount(ITEMS_PER_BATCH);
    }, [carSearchQuery, carSort]);

    useEffect(() => {
        if (!storeCategoryFilter) return;
        const labels = new Set(storeCategoryOptions.map((c) => c.trim().toLowerCase()));
        if (!labels.has(storeCategoryFilter.trim().toLowerCase())) {
            setStoreCategoryFilter('');
        }
    }, [storeCategoryOptions, storeCategoryFilter]);

    useEffect(() => {
        setStoreSearchQuery('');
        setStoreCategoryFilter('');
        setCarSearchQuery('');
        setCarSort('default');
    }, [slug]);

    const hasMoreItems =
        visibleMenuCount < menu.length ||
        visibleCarCount < filteredCarListings.length ||
        visibleRetailCount < filteredRetailItems.length ||
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
                setVisibleCarCount((prev) => Math.min(prev + ITEMS_PER_BATCH, filteredCarListings.length));
                setVisibleRetailCount((prev) => Math.min(prev + ITEMS_PER_BATCH, filteredRetailItems.length));
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
    }, [hasMoreItems, menu.length, filteredCarListings.length, filteredRetailItems.length, realEstateListings.length, visibleMenuCount, visibleCarCount, visibleRetailCount, showMenu, storeSearchQuery, storeCategoryFilter, carSearchQuery, carSort]);

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
                const createBusinessQuery = () => supabase
                    .from('businesses')
                    .select('*')
                    .in('moderation_status', ['active', 'on_hold'])
                    .eq('is_archived', false)
                    .neq('lifecycle_status', 'archived');

                let { data: businessData, error: businessError } = await createBusinessQuery()
                    .eq('slug', slug)
                    .maybeSingle();

                // Fallback: allow links that use raw business id when slug is missing.
                if (!businessData) {
                    const fallbackRes = await createBusinessQuery()
                        .eq('id', slug)
                        .maybeSingle();
                    businessData = fallbackRes.data;
                    businessError = fallbackRes.error;
                }

                if (businessError || !businessData) {
                    setBusiness(null);
                } else {
                    // On-hold businesses with a real owner: show only to that owner (not admin-added placeholders)
                    if (
                        businessData.moderation_status === 'on_hold' &&
                        businessData.owner_id &&
                        !businessData.admin_added_at
                    ) {
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

                    if (isClaimableBusiness(businessData) && businessData.id) {
                        try {
                            const { data: { session } } = await supabase.auth.getSession();
                            const token = session?.access_token;
                            const claimRes = await fetch(
                                `/api/business/claim?businessId=${encodeURIComponent(businessData.id)}`,
                                token ? { headers: { Authorization: `Bearer ${token}` } } : {}
                            );
                            const claimJson = await claimRes.json();
                            setUserClaim(claimJson.claim ?? null);
                        } catch {
                            setUserClaim(null);
                        }
                    } else {
                        setUserClaim(null);
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

    useEffect(() => {
        if (!business?.id || !isClaimableBusiness(business)) return;
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        if (params.get('claim') === '1') {
            setShowClaimModal(true);
        }
    }, [business?.id, business?.owner_id, business?.admin_added_at, business?.claim_status]);

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
    const menuLoadMoreActive = showMenu && visibleMenuCount < menu.length;
    const retailLoadMoreActive = visibleRetailCount < filteredRetailItems.length;
    const carLoadMoreActive = visibleCarCount < filteredCarListings.length;
    const displayCategory = formatBusinessCategory(business?.subcategory || business?.category);

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
    const formatBusinessAddressLine = (address: BusinessType['address']) =>
        [address?.street, address?.city, address?.state, address?.zip].filter(Boolean).join(', ');

    const getMapUrl = (address: BusinessType['address']) => {
        const fullAddress = formatBusinessAddressLine(address);
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
    const viewDetailButtonStyle: { background: string } = business.slug_view_detail_button_color
        ? { background: sanitizeHexColor(business.slug_view_detail_button_color, '#0c1f3c') }
        : { background: slugBrandBackground };

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            className={cn(
                'relative px-0 pt-0 pb-[max(1rem,env(safe-area-inset-bottom,0px))] min-h-screen overflow-x-clip lg:mx-auto lg:max-w-5xl font-inter bg-gray-100 dark:bg-gray-900'
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
            {showBusinessClaimUi(business, userClaim?.status ?? null) && (
                <div className="sticky top-0 z-40 border-b border-amber-200 bg-amber-50/95 px-3 py-2 shadow-sm dark:border-amber-800/80 dark:bg-amber-950/90">
                    <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
                        <p className="min-w-0 text-xs font-medium text-amber-900 dark:text-amber-100">
                            {userClaim?.status === 'pending'
                                ? 'Unclaimed · claim pending'
                                : userClaim?.status === 'rejected'
                                  ? 'Unclaimed · claim rejected'
                                  : 'Unclaimed listing'}
                        </p>
                        {userClaim?.status === 'pending' ? (
                            <span className="shrink-0 rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
                                Pending
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowClaimModal(true)}
                                className="shrink-0 rounded-md bg-gradient-to-r from-[#0c1f3c] to-[#6b1515] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
                            >
                                Claim
                            </button>
                        )}
                    </div>
                </div>
            )}
            {/* Directory link + business name */}
            <div className="sticky top-0 z-30 mb-0 flex flex-col">
                <div className="min-h-[env(safe-area-inset-top,0px)] w-full shrink-0" aria-hidden />
                <div
                    className="border-b border-white/15 px-4 py-3 shadow-[inset_0_1px_0_rgba(130,170,230,0.22)] backdrop-blur-sm dark:border-white/10 dark:shadow-[inset_0_1px_0_rgba(180,70,80,0.16)]"
                    style={{ background: slugBrandBackground }}
                >
                <div className="flex items-center justify-between gap-3 min-w-0">
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <BusinessesDirectoryLink />
                        {business.logo_url ? (
                            <img
                                src={business.logo_url}
                                alt={`${business.business_name} logo`}
                                className="h-8 w-8 shrink-0 rounded-sm object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                        ) : null}
                        <span className="min-w-0 flex-1 break-words text-sm sm:text-base font-semibold text-white" data-no-translate>
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

                    </div>
                </div>
                </div>
            </div>
            
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
            {showClaimModal && business && (
                <BusinessClaimModal
                    open={showClaimModal}
                    onClose={() => setShowClaimModal(false)}
                    businessId={business.id}
                    businessName={business.business_name}
                    businessSlug={business.slug}
                    listingEmail={business.email}
                    onSubmitted={() => {
                        setUserClaim({ id: '', status: 'pending', created_at: new Date().toISOString() });
                    }}
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
                                                            className={cn(ITEM_SHARE_BUTTON_CLASS, 'px-2.5 py-1.5 text-sm')}
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
                                                    className={cn(ITEM_SHARE_BUTTON_CLASS, 'gap-2 px-3 py-2.5 text-sm font-medium shadow-sm')}
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

            <div className="w-full space-y-0 bg-gray-100 dark:bg-slate-900/80 backdrop-blur lg:px-6 lg:pt-4">
                {business.moderation_status !== 'active' && business.owner_id && (
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
                            <button
                                type="button"
                                onClick={handleShare}
                                aria-label="Share"
                                className="absolute top-3 right-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-black/45 text-white ring-1 ring-white/30 backdrop-blur-sm transition hover:bg-black/55"
                            >
                                <FaShareAlt size={18} />
                            </button>
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
                    {/* Action bar - transparent contact strip */}
                    <div className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-200/70 bg-transparent px-4 py-3 dark:border-slate-600/60">
                        {business.phone && (
                            <ContactHrefLink href={buildTelHref(business.phone)} ariaLabel="Call" className={CONTACT_STRIP_CHIP}>
                                <FaPhone size={18} className="shrink-0" />
                            </ContactHrefLink>
                        )}
                        {business.whatsapp && (
                            <a href={`https://wa.me/${business.whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className={CONTACT_STRIP_CHIP}>
                                <FaWhatsapp size={20} className="shrink-0" />
                            </a>
                        )}
                        {business.email && (
                            <ContactHrefLink href={buildMailtoHref(business.email)} ariaLabel="Email" className={CONTACT_STRIP_CHIP}>
                                <FaEnvelope size={18} className="shrink-0" />
                            </ContactHrefLink>
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
                        {business && (
                            <ReportButton
                                entityType="business"
                                entityId={business.id}
                                entityTitle={business.business_name}
                                variant="icon"
                                className={CONTACT_REPORT_BUTTON_CLASS}
                            />
                        )}
                    </div>
                </div>
                {/* Name + Description - scrolls away with page */}
                <div className="border-t border-b border-slate-300 bg-transparent dark:border-slate-600">
                    <div className="bg-transparent p-4 sm:p-6">
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
                        <BusinessDescriptionText
                            text={business.description}
                            className="mt-2 font-normal text-[#444] dark:text-gray-300 leading-relaxed whitespace-pre-line"
                        />
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
                                    <span className="inline-flex items-center gap-8 rounded-lg bg-transparent px-5 py-2">
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
                </div>
                {isRestaurant && menu.length > 0 && (
                    <div className="border-b border-slate-300 bg-white px-4 py-4 dark:border-slate-600 dark:bg-gray-800 sm:px-6">
                        <MenuAccordionTrigger
                            expanded={showMenu}
                            onToggle={() => setShowMenu((prev) => !prev)}
                            itemCount={menu.length}
                            categoryCount={groupedMenu.length}
                        />
                        {showMenu && (
                        <div className="space-y-8 rounded-b-xl border-2 border-t-0 border-orange-300 bg-white p-4 dark:border-orange-500/50 dark:bg-gray-800 sm:p-6">
                            {groupedVisibleMenu.map((group) => (
                                <div key={group.category}>
                                    <div className="mb-3 flex items-center justify-between border-b border-dashed border-slate-300/70 pb-2 dark:border-slate-500/70">
                                        <h3 className="text-lg font-semibold text-orange-600 dark:text-orange-400">
                                            {group.category}
                                        </h3>
                                    </div>
                                    <div className="divide-y divide-dashed divide-slate-200 dark:divide-slate-600">
                                        {group.items.map((item) => (
                                            <div key={item.id} className="py-3">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-slate-900 dark:text-slate-100">{item.name}</p>
                                                        {item.description ? (
                                                            <p className="text-sm text-slate-600 dark:text-slate-300">{item.description}</p>
                                                        ) : null}
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-3">
                                                        {item.price ? (
                                                            <span className="text-sm font-semibold text-[#8b2020] dark:text-red-300">
                                                                {formatPriceWithCurrency(item.price)}
                                                            </span>
                                                        ) : null}
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedItemForDetails({ type: 'menu', item })}
                                                            className="rounded-md px-3 py-1.5 text-sm text-white transition hover:brightness-110"
                                                            style={viewDetailButtonStyle}
                                                        >
                                                            Details
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleItemShare(item.name)}
                                                            className={cn(ITEM_SHARE_BUTTON_CLASS, 'px-2.5 py-1.5 text-sm')}
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
                        )}
                        {menuLoadMoreActive && (
                            <div className="w-full pt-2">
                                {isLoadingMore && (
                                    <div className="flex justify-center py-4" aria-live="polite">
                                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500 dark:border-gray-600 dark:border-t-indigo-400" />
                                    </div>
                                )}
                                <div ref={loadMoreRef} className="h-8 w-full" aria-hidden="true" />
                            </div>
                        )}
                    </div>
                )}
                {retailItems.length > 0 && (
                    <div className="border-b border-slate-300 bg-white px-4 py-4 dark:border-slate-600 dark:bg-gray-800 sm:p-6">
                        <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold text-[#333] dark:text-gray-100">
                            <StoreIcon size={20} /> Our Store
                        </h2>
                        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                            {storeCategoryOptions.length > 0 ? (
                                <div className="sm:w-44 sm:shrink-0">
                                    <label htmlFor="store-category-filter" className="sr-only">
                                        Filter by category
                                    </label>
                                    <select
                                        id="store-category-filter"
                                        value={storeCategoryFilter}
                                        onChange={(e) => setStoreCategoryFilter(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-3 pr-8 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/80 dark:border-slate-600 dark:bg-gray-900 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/50"
                                    >
                                        <option value="">All categories</option>
                                        {storeCategoryOptions.map((category) => (
                                            <option key={category} value={category}>
                                                {category}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ) : null}
                            <div className="relative min-w-0 flex-1">
                            <Search
                                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                                aria-hidden
                            />
                            <input
                                type="search"
                                value={storeSearchQuery}
                                onChange={(e) => setStoreSearchQuery(e.target.value)}
                                placeholder="Search items in our store..."
                                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/80 dark:border-slate-600 dark:bg-gray-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/50"
                                aria-label="Search items in our store"
                            />
                            {storeSearchQuery ? (
                                <button
                                    type="button"
                                    onClick={() => setStoreSearchQuery('')}
                                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                    aria-label="Clear search"
                                >
                                    <X size={16} />
                                </button>
                            ) : null}
                            </div>
                        </div>
                        {storeSearchQuery.trim() || storeCategoryFilter ? (
                            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                                {filteredRetailItems.length}{' '}
                                {filteredRetailItems.length === 1 ? 'item' : 'items'} found
                                {storeCategoryFilter ? ` in ${storeCategoryFilter}` : ''}
                            </p>
                        ) : null}
                        {filteredRetailItems.length > 0 ? (
                            <RetailItemsGrid
                                items={filteredRetailItems}
                                visibleCount={visibleRetailCount}
                                viewDetailButtonStyle={viewDetailButtonStyle}
                                onDetails={(item) => setSelectedItemForDetails({ type: 'retail', item })}
                                onShare={handleItemShare}
                            />
                        ) : (
                            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                                {storeSearchQuery.trim() && storeCategoryFilter
                                    ? <>No items match &ldquo;{storeSearchQuery.trim()}&rdquo; in {storeCategoryFilter}.</>
                                    : storeSearchQuery.trim()
                                      ? <>No items match &ldquo;{storeSearchQuery.trim()}&rdquo; in our store.</>
                                      : storeCategoryFilter
                                        ? <>No items in {storeCategoryFilter}.</>
                                        : <>No items in our store.</>}
                            </p>
                        )}
                        {retailLoadMoreActive && !menuLoadMoreActive && (
                            <div className="w-full pt-2">
                                {isLoadingMore && (
                                    <div className="flex justify-center py-4" aria-live="polite">
                                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500 dark:border-gray-600 dark:border-t-indigo-400" />
                                    </div>
                                )}
                                <div ref={loadMoreRef} className="h-8 w-full" aria-hidden="true" />
                            </div>
                        )}
                    </div>
                )}
                {carListings.length > 0 && (
                    <div className="border-b border-slate-300 bg-white px-4 py-4 dark:border-slate-600 dark:bg-gray-800 sm:p-6">
                        <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold text-[#333] dark:text-gray-100">
                            <Car size={20} /> Car Listings
                        </h2>
                        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                            <div className="sm:w-48 sm:shrink-0">
                                <label htmlFor="car-sort" className="sr-only">
                                    Sort inventory
                                </label>
                                <select
                                    id="car-sort"
                                    value={carSort}
                                    onChange={(e) => setCarSort(e.target.value as CarInventorySort)}
                                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-3 pr-8 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/80 dark:border-slate-600 dark:bg-gray-900 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/50"
                                >
                                    {CAR_INVENTORY_SORT_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="relative min-w-0 flex-1">
                            <Search
                                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                                aria-hidden
                            />
                            <input
                                type="search"
                                value={carSearchQuery}
                                onChange={(e) => setCarSearchQuery(e.target.value)}
                                placeholder="Search cars in our inventory..."
                                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/80 dark:border-slate-600 dark:bg-gray-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/50"
                                aria-label="Search cars in our inventory"
                            />
                            {carSearchQuery ? (
                                <button
                                    type="button"
                                    onClick={() => setCarSearchQuery('')}
                                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                    aria-label="Clear search"
                                >
                                    <X size={16} />
                                </button>
                            ) : null}
                            </div>
                        </div>
                        {carSearchQuery.trim() ? (
                            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                                {filteredCarListings.length}{' '}
                                {filteredCarListings.length === 1 ? 'car' : 'cars'} found
                            </p>
                        ) : null}
                        {filteredCarListings.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                            {filteredCarListings.slice(0, visibleCarCount).map((car) => (
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
                                                className={cn(ITEM_SHARE_BUTTON_CLASS, 'px-2 py-1.5')}
                                            >
                                                <FaShareAlt size={13} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        ) : (
                            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                                {carSearchQuery.trim()
                                    ? <>No cars match &ldquo;{carSearchQuery.trim()}&rdquo; in our inventory.</>
                                    : <>No cars in our inventory.</>}
                            </p>
                        )}
                        {carLoadMoreActive && !menuLoadMoreActive && !retailLoadMoreActive && (
                            <div className="w-full pt-2">
                                {isLoadingMore && (
                                    <div className="flex justify-center py-4" aria-live="polite">
                                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500 dark:border-gray-600 dark:border-t-indigo-400" />
                                    </div>
                                )}
                                <div ref={loadMoreRef} className="h-8 w-full" aria-hidden="true" />
                            </div>
                        )}
                    </div>
                )}
                {/* Address / map */}
                {business.address?.street && (
                    <div className="rounded-b-xl border-2 border-t-0 border-slate-300 dark:border-slate-600 bg-white p-0 shadow-sm dark:bg-slate-900/90 overflow-hidden pb-[env(safe-area-inset-bottom,0px)]">
                        <div className="w-full">
                            <div className="flex justify-center px-0 pb-2 pt-3 sm:px-3">
                                <div className="flex items-center justify-center gap-2 rounded-none px-3 py-2 text-center text-sm font-medium text-slate-700 dark:text-slate-200 sm:rounded">
                                    <MapPin size={16} className="shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                                    <span data-no-translate>{formatBusinessAddressLine(business.address)}</span>
                                </div>
                            </div>
                            <div className="relative w-full overflow-hidden sm:rounded-b-xl">
                                <BusinessMap
                                    embedded
                                    address={business.address}
                                    businessId={business.id}
                                    businessName={business.business_name}
                                    logoUrl={business.logo_url}
                                />
                            </div>
                        </div>
                    </div>
                )}
                {/* === Shop: menu & listings (under address map) === */}
                {((!isRestaurant && menu.length > 0) || realEstateListings.length > 0) && (
                    <div className="mt-4 border-b border-slate-300 dark:border-slate-600 p-4 sm:p-6 space-y-10 bg-white dark:bg-gray-800">
                        {/* Menu (non-restaurant; restaurants show menu above map) */}
                        {menu.length > 0 && !isRestaurant && (
                            <div>
                                <MenuAccordionTrigger
                                    expanded={showMenu}
                                    onToggle={() => setShowMenu((prev) => !prev)}
                                    itemCount={menu.length}
                                    categoryCount={groupedMenu.length}
                                />
                                {showMenu && (
                                <div className="space-y-8 rounded-b-xl border-2 border-t-0 border-orange-300 bg-orange-50/30 p-4 dark:border-orange-500/50 dark:bg-gray-900/40 sm:p-6">
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
                                                                    className={cn(ITEM_SHARE_BUTTON_CLASS, 'px-2.5 py-1.5 text-sm')}
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
                                )}
                                {menuLoadMoreActive && !isRestaurant && (
                                    <div className="w-full pt-2">
                                        {isLoadingMore && (
                                            <div className="flex justify-center py-4" aria-live="polite">
                                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500 dark:border-gray-600 dark:border-t-indigo-400" />
                                            </div>
                                        )}
                                        <div ref={loadMoreRef} className="h-8 w-full" aria-hidden="true" />
                                    </div>
                                )}
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
                                                        className={cn(ITEM_SHARE_BUTTON_CLASS, 'px-2 py-1.5')}
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
                    </div>
                )}
                {/* === END ITEMS SECTION === */}
                {hasMoreItems && !menuLoadMoreActive && !retailLoadMoreActive && !carLoadMoreActive && (
                    <div className="w-full">
                        {isLoadingMore && (
                            <div className="flex justify-center py-4" aria-live="polite">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500 dark:border-gray-600 dark:border-t-indigo-400" />
                            </div>
                        )}
                        <div ref={loadMoreRef} className="h-8 w-full" aria-hidden="true" />
                    </div>
                )}
            </div>
            

        </motion.div>
    );
};
export default BusinessProfilePage;
