'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation'; // This import remains as per your original code
import { supabase } from '@/lib/supabaseClient'; // This import remains as per your original code
import toast from 'react-hot-toast';
import {
    FaInstagram, FaFacebook, FaTiktok, FaGlobe,
    FaShareAlt, FaArrowLeft, FaArrowRight,
    FaPhone, FaEnvelope, FaMapPin,
    FaWhatsapp, FaTwitter, FaDirections,
    FaHeart, FaRegHeart
} from 'react-icons/fa'; // These imports remain as per your original code
import { motion } from 'framer-motion'; // This import remains as per your original code
import Script from 'next/script'; // This import remains as per your original code
import Image from 'next/image'; // Added for Image component

import {
    Car, Calendar, Gauge, HeartHandshake,
    Store as StoreIcon,
    ClipboardList as ClipboardListIcon,
    X, DollarSign, Eye, ChevronLeft, ChevronRight, Tag // Added Tag for retail item category in modal
} from 'lucide-react'; // These imports remain as per your original code

import { cn } from '@/lib/utils'; // This import remains as per your original code

// Types
interface BusinessType {
    id: string;
    business_name: string;
    category: string;
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
    owner_id: string;
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

interface ModalProps {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}

// Reusable Modal Component
const Modal = ({ title, onClose, children }: ModalProps) => {
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative p-6">
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
};

// --- NEW DetailedViewModal Component ---
interface DetailedViewModalProps {
    item: MenuItem | CarListing | RetailItem; // Union type for item data
    type: 'menu' | 'car' | 'retail';
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
        (item as RetailItem).name;

    useEffect(() => {
        // Prevent scrolling of the background when modal is open
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto relative p-4 sm:p-5">
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
                                            currentImageIndex === index ? 'border-blue-500' : 'border-transparent'
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
                            <span className="text-gray-700 dark:text-gray-300">Price: ${(item as CarListing).price}</span>
                        </div>
                    )}

                    {/* Price for Menu and Retail Items */}
                    {(type === 'menu' || type === 'retail') && (item as MenuItem | RetailItem).price && (
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <DollarSign size={18} className="text-gray-500" />
                            <span className="text-gray-700 dark:text-gray-300">Price: ${(item as MenuItem | RetailItem).price}</span>
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
        <div className="pt-4 px-0">
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
                    "w-full h-[200px] sm:h-[250px] rounded-xl shadow-lg",
                    "overflow-hidden border border-gray-200 dark:border-gray-700",
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
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isFavorited, setIsFavorited] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

    // Modal visibility states (Added new)
    const [showMenuModal, setShowMenuModal] = useState(false);
    const [showCarsModal, setShowCarsModal] = useState(false);
    const [showRetailModal, setShowRetailModal] = useState(false);
    const [showHours, setShowHours] = useState(false);

    const ITEMS_PER_BATCH = 6;
    const [visibleMenuCount, setVisibleMenuCount] = useState(ITEMS_PER_BATCH);
    const [visibleCarCount, setVisibleCarCount] = useState(ITEMS_PER_BATCH);
    const [visibleRetailCount, setVisibleRetailCount] = useState(ITEMS_PER_BATCH);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const loadMoreTimerRef = useRef<number | null>(null);
    const touchStartXRef = useRef<number | null>(null);
    const touchEndXRef = useRef<number | null>(null);

    // Add new state for detailed view of individual item cards
    const [selectedItemForDetails, setSelectedItemForDetails] = useState<{
        type: 'menu' | 'car' | 'retail';
        item: MenuItem | CarListing | RetailItem;
    } | null>(null);

    useEffect(() => {
        setVisibleMenuCount(ITEMS_PER_BATCH);
        setVisibleCarCount(ITEMS_PER_BATCH);
        setVisibleRetailCount(ITEMS_PER_BATCH);
    }, [menu.length, carListings.length, retailItems.length]);

    const hasMoreItems =
        visibleMenuCount < menu.length ||
        visibleCarCount < carListings.length ||
        visibleRetailCount < retailItems.length;

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
    }, [hasMoreItems, menu.length, carListings.length, retailItems.length]);

    // Delete functions (UNCHANGED)
    const deleteMenuItem = async (itemId: string) => {
        if (!business) return;
        if (!confirm('Are you sure you want to delete this menu item?')) return;
        setDeleteLoading(itemId);
        try {
            const { error } = await supabase
                .from('menuitems')
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
                    .in('status', ['active', 'unclaimed'])
                    .eq('is_archived', false)
                    .neq('lifecycle_status', 'archived')
                    .single();

                if (businessError || !businessData) {
                    setBusiness(null);
                } else {

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

                    const [carRes, menuRes, retailRes] = await Promise.all([
                        supabase.from('dealerships').select('*').eq('business_id', businessData.id),
                        supabase.from('menu_items').select('*').eq('business_id', businessData.id),
                        supabase.from('retail_items').select('*').eq('business_id', businessData.id),
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

    // Derive business type flags from category
    const isRestaurant = business?.category?.toLowerCase().includes('restaurant') || business?.category?.toLowerCase().includes('food');
    const isDealership = business?.category?.toLowerCase().includes('dealership') || business?.category?.toLowerCase().includes('auto') || business?.category?.toLowerCase().includes('car');
    const isRetail = business?.category?.toLowerCase().includes('retail')
        || business?.category?.toLowerCase().includes('store')
        || business?.category?.toLowerCase().includes('shop')
        || business?.category?.toLowerCase().includes('other')
        || business?.category?.toLowerCase().includes('something_else');
    const displayCategory = formatBusinessCategory(business?.category);


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
    const hasContactInfo = Boolean(
        business.phone ||
        business.whatsapp ||
        business.email ||
        business.website ||
        business.address?.street
    );

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            className="relative p-4 min-h-screen font-inter bg-yellow-50 dark:bg-gray-900"
        >
            {/* Modals for Menu, Cars, Retail (Added new) */}
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
                                                            <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                                                                ${item.price}
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={() => setSelectedItemForDetails({ type: 'menu', item: item })}
                                                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                                        >
                                                            Details
                                                        </button>
                                                        <button
                                                            onClick={() => handleItemShare(item.name)}
                                                            className="px-2.5 py-1.5 text-sm bg-white text-gray-700 rounded-md hover:bg-gray-100 transition-colors border border-gray-200"
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
                                    <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden flex flex-col">
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
                                        <div className="p-4 flex flex-col flex-grow">
                                            <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{item.title}</h3>
                                            <div className="text-sm text-gray-600 dark:text-gray-300 mt-2 space-y-1">
                                                <p className="flex items-center gap-1"><Calendar size={14} /> Year: {item.year}</p>
                                                <p className="flex items-center gap-1"><Gauge size={14} /> Mileage: {item.mileage}</p>
                                                <p className="flex items-center gap-1"><HeartHandshake size={14} /> Condition: {item.condition}</p>
                                            </div>
                                            <p className="text-blue-600 dark:text-blue-400 font-bold mt-2">${item.price}</p>
                                            <div className="mt-auto pt-3 flex gap-2">
                                                <button
                                                    onClick={() => setSelectedItemForDetails({ type: 'car', item: item })}
                                                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm"
                                                >
                                                    <Eye size={18} />
                                                    View Details
                                                </button>
                                                <button
                                                    onClick={() => handleItemShare(item.title)}
                                                    className="px-3 py-2.5 bg-white text-gray-700 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm border border-gray-200"
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

            {showRetailModal && (
                <Modal title="Retail Items" onClose={() => setShowRetailModal(false)}>
                    {retailItems.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {retailItems.map((item) => (
                                <div key={item.id} className="bg-gray-100 dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden flex flex-col">
                                    {item.images?.[0] && (
                                        <div className="w-full h-48 relative flextake-shrink-0">
                                            <img
                                                src={item.images[0]}
                                                alt={item.name}
                                                className="w-full h-full object-cover"
                                                onError={(e) => { e.currentTarget.src = 'https://placehold.co/300x200/cccccc/333333?text=Retail+Item'; e.currentTarget.onerror = null; }}
                                            />
                                        </div>
                                    )}
                                    <div className="p-4 flex flex-col flex-grow">
                                        <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{item.name}</h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{item.description}</p>
                                        <p className="text-blue-600 dark:text-blue-400 font-bold mt-1">{item.price}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Category: {item.category}</p>
                                        <div className="mt-auto pt-3 flex gap-2">
                                            <button
                                                onClick={() => setSelectedItemForDetails({ type: 'retail', item: item })}
                                                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm"
                                            >
                                                <Eye size={18} />
                                                View Details
                                            </button>
                                            <button
                                                onClick={() => handleItemShare(item.name)}
                                                className="px-3 py-2.5 bg-white text-gray-700 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm border border-gray-200"
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
                        <p className="text-gray-500 dark:text-gray-400 italic">No retail items available for this business.</p>
                    )}
                </Modal>
            )}

            {selectedItemForDetails && (
                <DetailedViewModal
                    item={selectedItemForDetails.item}
                    type={selectedItemForDetails.type}
                    onClose={() => setSelectedItemForDetails(null)}
                />
            )}

            <motion.div className="rounded-2xl max-w-4xl mx-auto p-4 sm:p-6 space-y-6 bg-yellow-50 dark:bg-slate-900/70 backdrop-blur">
                {business.moderation_status !== 'active' && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        Your business is currently pending approval. You can still view and edit your business profile and online
                        shop, but it will not be visible to other users until it has been approved.
                    </div>
                )}
                {/* Name + Description */}
                <motion.div className="sticky top-12 z-20 rounded-xl p-[2px] bg-gradient-to-r from-red-300 via-yellow-300 via-green-300 via-sky-300 to-purple-300">
                    <div className="rounded-[10px] p-4 sm:p-6 bg-white dark:bg-slate-900/70">
                        <div className="relative flex justify-between items-start flex-col sm:flex-row">
                            <div className="flex items-center gap-4 mb-0 sm:mb-0">
                                {business.logo_url && (
                                    <div className="w-24 sm:w-28 h-24 sm:h-28 flex-shrink-0 rounded-xl overflow-hidden shadow-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                                        <img
                                            src={business.logo_url}
                                            alt="Business Logo"
                                            className="object-contain w-full h-full p-2"
                                            onError={(e) => { e.currentTarget.src = 'https://placehold.co/120x120/cccccc/333333?text=Logo'; e.currentTarget.onerror = null; }}
                                        />
                                    </div>
                                )}
                                <div className="text-left flex-1">
                                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">{business.business_name}</h1>
                                    {displayCategory ? (
                                      <p className="text-gray-500 dark:text-gray-400 italic">{displayCategory}</p>
                                    ) : null}
                                </div>
                            </div>
                            <div className="absolute right-0 top-0 flex gap-2 items-center">
                                <button onClick={toggleFavorite} className={cn(
                                    "bg-white dark:bg-gray-700 rounded-full p-2 shadow-md z-10",
                                    "transition-colors duration-300",
                                    isFavorited
                                        ? "text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50"
                                        : "text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-red-500"
                                )}>
                                    {isFavorited ? <FaHeart size={18} /> : <FaRegHeart size={18} />}
                                </button>
                            </div>
                        </div>
                        <p className="mt-2 text-[#444] dark:text-gray-300 leading-relaxed whitespace-pre-line">
                            {business.description}
                        </p>
                    </div>
                </motion.div>
                {/* Contact */}
                {hasContactInfo && (
                <motion.div className="rounded-xl p-4 sm:p-6 shadow-md space-y-3 bg-white dark:bg-slate-900/70 border border-sky-200 dark:border-sky-300/50">
                    <h2 className="text-xl font-semibold text-[#333] dark:text-gray-100">Contact</h2>
                    {business.phone && (<p className="flex items-center gap-2 text-sm text-[#444] dark:text-gray-300"><FaPhone className="text-green-500 dark:text-green-400" size={16} /><a href={`tel:${business.phone}`} className="text-blue-500 dark:text-blue-400 hover:underline">{business.phone}</a></p>)}
                    {business.whatsapp && (<p className="flex items-center gap-2 text-sm text-[#444] dark:text-gray-300"><FaWhatsapp className="text-green-500 dark:text-green-400" size={16} /><a href={`https://wa.me/${business.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 dark:text-blue-400 hover:underline">WhatsApp: {business.whatsapp}</a></p>)}
                    {business.email && (<p className="flex items-center gap-2 text-sm text-[#444] dark:text-gray-300"><FaEnvelope size={16} /><a href={`mailto:${business.email}`} className="text-blue-500 dark:text-blue-400 hover:underline">{business.email}</a></p>)}
                    {business.website && (<p className="flex items-center gap-2 text-sm text-[#444] dark:text-gray-300"><FaGlobe size={16} /><a href={business.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 dark:text-blue-400 hover:underline">Website</a></p>)}
                    <div className="flex items-center">
                        <button
                            className="bg-[#ede7f6] dark:bg-gray-700 px-3 py-1.5 rounded-full text-sm flex items-center gap-2 hover:bg-[#dcd1f2] dark:hover:bg-gray-600 transition-colors duration-200 shadow-md"
                            onClick={handleShare}
                        >
                            <FaShareAlt size={14} /> Share
                        </button>
                    </div>
                    {business.address?.street && (
                        <div className="mt-6">
                            <h3 className="text-lg font-semibold text-[#333] dark:text-gray-100 flex items-center gap-1 mb-2">
                                <FaMapPin size={18} /> Location
                            </h3>
                            <div className="flex items-start gap-2 mb-4">
                                <p className="text-sm text-[#666] dark:text-gray-300">
                                    <a href={getMapUrl(business.address)} target="_blank" rel="noopener noreferrer" className="text-blue-500 dark:text-blue-400 hover:underline">
                                        {business.address.street}, {business.address.city}, {business.address.state} {business.address.zip}
                                    </a>
                                </p>
                                <button
                                    onClick={() => { const mapUrl = getMapUrl(business.address); window.open(mapUrl, '_blank'); }}
                                    className="mt-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded text-sm flex items-center gap-2 whitespace-nowrap"
                                ><FaDirections size={16} /><span>Get Directions</span></button>
                            </div>
                            <hr className="my-4 border-gray-200 dark:border-gray-700" />
                            <div className="w-full"><BusinessMap address={business.address} /></div>
                        </div>
                    )}
                </motion.div>
                )}
                {business.images?.length ? (
                    <motion.div>
                        <div
                            className="relative rounded-xl overflow-hidden w-full aspect-video flex items-center justify-center group bg-white dark:bg-slate-900/70 border border-sky-200 dark:border-sky-300/50"
                            onTouchStart={handleGalleryTouchStart}
                            onTouchMove={handleGalleryTouchMove}
                            onTouchEnd={handleGalleryTouchEnd}
                        >
                            <img
                                src={business.images[selectedIndex]}
                                alt={`Slide ${selectedIndex + 1}`}
                                className="w-full h-full object-contain rounded-xl transition-transform duration-500"
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
                                                ? "bg-blue-500 dark:bg-blue-400"
                                                : "bg-gray-300 dark:bg-gray-600"
                                        )} onClick={() => setSelectedIndex(index)} />
                                    ))}
                                </div>
                            </>)}
                        </div>
                    </motion.div>
                ) : null}
                {/* Socials */}
                {hasSocials && (
                <motion.div className="rounded-xl p-4 sm:p-6 shadow-md bg-sky-50 dark:bg-slate-900/70 border border-sky-200 dark:border-sky-300/50">
                    <h2 className="text-xl font-semibold text-[#333] dark:text-gray-100">Socials</h2>
                    <ul className="list-none space-y-2">
                        {business.instagram && (<li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><FaInstagram className="text-blue-500 dark:text-blue-400" size={18} /><a href={business.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 dark:hover:text-blue-400 hover:underline">Instagram</a></li>)}
                        {business.facebook && (<li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><FaFacebook className="text-blue-600 dark:text-blue-400" size={18} /><a href={business.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline">Facebook</a></li>)}
                        {business.tiktok && (<li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><FaTiktok className="text-black dark:text-gray-100" size={18} /><a href={business.tiktok} target="_blank" rel="noopener noreferrer" className="hover:text-gray-800 dark:hover:text-gray-200 hover:underline">TikTok</a></li>)}
                        {business.twitter && (<li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><FaTwitter className="text-blue-400 dark:text-blue-300" size={18} /><a href={business.twitter} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 dark:hover:text-blue-300 hover:underline">Twitter</a></li>)}
                    </ul>
                </motion.div>
                )}
                {/* Hours */}
                {hasHours && (
                <motion.div className="rounded-xl p-4 sm:p-6 shadow-md bg-sky-50 dark:bg-slate-900/70 border border-sky-200 dark:border-sky-300/50">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-semibold text-[#333] dark:text-gray-100">Hours</h2>
                            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                Today: <span className="font-semibold">{todayHours}</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowHours((prev) => !prev)}
                            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-200 transition-colors"
                        >
                            {showHours ? 'Hide hours' : 'View all hours'}
                        </button>
                    </div>

                    {showHours && (
                        <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
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
                </motion.div>
                )}
                {/* === ALL ITEMS SECTION AT THE BOTTOM === */}
                {(menu.length > 0 || carListings.length > 0 || retailItems.length > 0) && (
                    <motion.div className="mt-10 rounded-xl p-4 sm:p-6 shadow-lg space-y-10 bg-white dark:bg-gray-800 border border-sky-200 dark:border-sky-300/50">
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
                                                                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                                                                        ${item.price}
                                                                    </span>
                                                                )}
                                                                <button
                                                                    onClick={() => setSelectedItemForDetails({ type: 'menu', item: item })}
                                                                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                                                >
                                                                    Details
                                                                </button>
                                                                <button
                                                                    onClick={() => handleItemShare(item.name)}
                                                                    className="px-2.5 py-1.5 text-sm bg-white text-gray-700 rounded-md hover:bg-gray-100 transition-colors border border-gray-200"
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
                                <h2 className="text-xl font-semibold text-[#333] dark:text-gray-100 mb-4 flex items-center gap-2">
                                    <Car size={20} /> Car Listings
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {carListings.slice(0, visibleCarCount).map((car) => (
                                        <div
                                            key={car.id}
                                            className="shadow-md sm:shadow-sm overflow-hidden relative flex flex-col bg-gray-100 dark:bg-gray-700 border border-sky-300 dark:border-sky-300/60 rounded-lg"
                                        >
                                            {car.images && car.images.length > 0 && car.images[0] && (
                                                <div className="w-full h-36 sm:h-48 relative flex-shrink-0 mb-3">
                                                    <img
                                                        src={car.images[0]}
                                                        alt={car.title}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => { e.currentTarget.src = 'https://placehold.co/300x200/cccccc/333333?text=Car+Image'; e.currentTarget.onerror = null; }}
                                                    />
                                                </div>
                                            )}
                                            <div className="p-4 flex flex-col flex-grow">
                                                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{car.title}</h3>
                                                <p className="text-blue-600 dark:text-blue-400 font-bold mt-1">${car.price}</p>
                                                <div className="text-sm text-gray-600 dark:text-gray-300 mt-2 space-y-1">
                                                    <p className="flex items-center gap-1"><Calendar size={14} /> Year: {car.year}</p>
                                                    <p className="flex items-center gap-1"><Gauge size={14} /> Mileage: {car.mileage}</p>
                                                    <p className="flex items-center gap-1"><HeartHandshake size={14} /> Condition: {car.condition}</p>
                                                </div>
                                                <div className="mt-auto pt-3 flex gap-2">
                                                    <button
                                                        onClick={() => setSelectedItemForDetails({ type: 'car', item: car })}
                                                        className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm"
                                                    >
                                                        <Eye size={18} />
                                                        View Details
                                                    </button>
                                                    <button
                                                        onClick={() => handleItemShare(car.title)}
                                                        className="px-3 py-2.5 bg-white text-gray-700 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm border border-gray-200"
                                                    >
                                                        <FaShareAlt size={16} />
                                                        Share
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
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {retailItems.slice(0, visibleRetailCount).map((item) => (
                                        <div
                                            key={item.id}
                                            className="shadow-md sm:shadow-sm overflow-hidden relative flex flex-col bg-white dark:bg-gray-700 border border-sky-300 dark:border-sky-300/60 rounded-lg"
                                        >
                                            {item.images?.[0] && (
                                                <div className="w-full h-36 sm:h-48 relative flex-shrink-0 mb-3">
                                                    <img
                                                        src={item.images[0]}
                                                        alt={item.name}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => { e.currentTarget.src = 'https://placehold.co/300x200/cccccc/333333?text=Retail+Item'; e.currentTarget.onerror = null; }}
                                                    />
                                                </div>
                                            )}
                                            <div className="p-4 flex flex-col flex-grow">
                                                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{item.name}</h3>
                                                <p className="text-blue-600 dark:text-blue-400 font-bold mt-1">{item.price}</p>
                                                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{item.description}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Category: {item.category}</p>
                                                <div className="mt-auto pt-3 flex gap-2">
                                                    <button
                                                        onClick={() => setSelectedItemForDetails({ type: 'retail', item: item })}
                                                        className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm"
                                                    >
                                                        <Eye size={18} />
                                                        View Details
                                                    </button>
                                                    <button
                                                        onClick={() => handleItemShare(item.name)}
                                                        className="px-3 py-2.5 bg-white text-gray-700 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm border border-gray-200"
                                                    >
                                                        <FaShareAlt size={16} />
                                                        Share
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
        </motion.div>
    );
};

export default BusinessProfilePage;