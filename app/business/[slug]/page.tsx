'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation'; // This import remains as per your original code
import { supabase } from '@/lib/supabaseClient'; // This import remains as per your original code
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
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto relative p-6">
                <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{modalTitle}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        aria-label="Close modal"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Image Gallery */}
                {images.length > 0 ? (
                    <div className="mb-6">
                        <div className="relative h-96 mb-4 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                            <img
                                src={images[currentImageIndex]}
                                alt={`${modalTitle} image ${currentImageIndex + 1}`}
                                className="w-full h-full object-contain" // object-contain to prevent cropping, object-cover to fill
                                onError={(e) => { e.currentTarget.src = 'https://placehold.co/600x400?text=Image+Not+Available'; e.currentTarget.onerror = null; }}
                            />
                            {images.length > 1 && (
                                <>
                                    <button
                                        onClick={() => setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75 z-10"
                                    >
                                        <ChevronLeft size={24} />
                                    </button>
                                    <button
                                        onClick={() => setCurrentImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75 z-10"
                                    >
                                        <ChevronRight size={24} />
                                    </button>
                                </>
                            )}
                        </div>
                        {images.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 justify-center">
                                {images.map((img: string, index: number) => (
                                    <button
                                        key={index} // Using index here is fine for thumbnails if order doesn't change during modal life
                                        onClick={() => setCurrentImageIndex(index)}
                                        className={`w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden border-2 ${
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
                    <div className="w-full h-60 bg-gray-100 dark:bg-gray-700 flex items-center justify-center rounded-xl mb-6">
                        <span className="text-gray-500 dark:text-gray-400 italic">No Images Available</span>
                    </div>
                )}

                {/* Item Details */}
                <div className="space-y-4 text-gray-800 dark:text-gray-200">
                    {/* Price for Car Listings */}
                    {type === 'car' && (item as CarListing).price && (
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <DollarSign size={20} className="text-gray-500" />
                            <span className="text-gray-700 dark:text-gray-300">Price: ${(item as CarListing).price}</span>
                        </div>
                    )}

                    {/* Price for Menu and Retail Items */}
                    {(type === 'menu' || type === 'retail') && (item as MenuItem | RetailItem).price && (
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <DollarSign size={20} className="text-gray-500" />
                            <span className="text-gray-700 dark:text-gray-300">Price: ${(item as MenuItem | RetailItem).price}</span>
                        </div>
                    )}

                    {/* Car Specific Details */}
                    {type === 'car' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            {(item as CarListing).year && (
                                <div className="flex items-center gap-2">
                                    <Calendar size={20} className="text-gray-500" />
                                    <span className="text-gray-700 dark:text-gray-300">Year: {(item as CarListing).year}</span>
                                </div>
                            )}
                            {(item as CarListing).mileage && (
                                <div className="flex items-center gap-2">
                                    <Gauge size={20} className="text-gray-500" />
                                    <span className="text-gray-700 dark:text-gray-300">Mileage: {(item as CarListing).mileage}</span>
                                </div>
                            )}
                            {(item as CarListing).condition && (
                                <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                                    <HeartHandshake size={20} className="text-gray-500" />
                                    <span className="text-gray-700 dark:text-gray-300">Condition: {(item as CarListing).condition}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Retail Item Category */}
                    {type === 'retail' && (item as RetailItem).category && (
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <Tag size={20} className="text-gray-500" />
                            <span className="text-gray-700 dark:text-gray-300">Category: {(item as RetailItem).category}</span>
                        </div>
                    )}

                    {/* Description */}
                    {(item as any).description && ( // description is common to all types
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <h3 className="text-lg font-semibold mb-2">Description</h3>
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

    // Add new state for detailed view of individual item cards
    const [selectedItemForDetails, setSelectedItemForDetails] = useState<{
        type: 'menu' | 'car' | 'retail';
        item: MenuItem | CarListing | RetailItem;
    } | null>(null);

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
                    .eq('business_status', 'approved')
                    .eq('status', 'active')
                    .single();

                if (businessError || !businessData) {
                    setBusiness(null);
                } else {
                    setBusiness(businessData as BusinessType);

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


                    const [carRes, menuRes, retailRes] = await Promise.all([
                        supabase.from('dealerships').select('*').eq('business_id', businessData.id),
                        supabase.from('menu_items').select('*').eq('business_id', businessData.id),
                        supabase.from('retail_items').select('*').eq('business_id', businessData.id),
                    ]);

                    if (carRes.error) {
                        console.error('Error fetching car listings:', carRes.error);
                        setCarListings([]);
                    } else {
                        setCarListings((carRes.data || []).map((item: any) => ({
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
                        setMenu((menuRes.data || []).map((item: any) => ({
                            id: item.id,
                            name: item.name || '',
                            description: item.description || '',
                            price: item.price?.toString() ?? '',
                            category: item.category,
                            // Handle image_url or images array from DB for menu items
                            images: item.image_url
                                ? processDbImages(item.image_url, 'restaurant-menu') // Assuming image_url is a single path or JSON string
                                : processDbImages(item.images, 'restaurant-menu'), // Fallback if images array exists
                        })));
                    }

                    if (retailRes.error) {
                        console.error('Error fetching retail items:', retailRes.error);
                        setRetailItems([]);
                    } else {
                        setRetailItems((retailRes.data || []).map((item: any) => ({
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
                        const favorites = JSON.parse(localStorage.getItem('favoriteBusinesses') || '[]');
                        setIsFavorited(favorites.includes(businessData.slug));
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


    // Derive business type flags from category
    const isRestaurant = business?.category?.toLowerCase().includes('restaurant') || business?.category?.toLowerCase().includes('food');
    const isDealership = business?.category?.toLowerCase().includes('dealership') || business?.category?.toLowerCase().includes('auto') || business?.category?.toLowerCase().includes('car');
    const isRetail = business?.category?.toLowerCase().includes('retail') || business?.category?.toLowerCase().includes('store') || business?.category?.toLowerCase().includes('shop');


    // Carousel handlers for main business gallery
    const nextImage = () => setSelectedIndex((prevIndex) => (prevIndex + 1) % (business?.images?.length || 1));
    const prevImage = () =>
        setSelectedIndex((prevIndex) => (prevIndex - 1 + (business?.images?.length || 1)) % (business?.images?.length || 1));
    const toggleFavorite = () => {
        if (!business) return;
        let favorites = JSON.parse(localStorage.getItem('favoriteBusinesses') || '[]');
        if (favorites.includes(business.slug)) {
            favorites = favorites.filter((s: string) => s !== business.slug);
        } else {
            favorites.push(business.slug);
        }
        localStorage.setItem('favoriteBusinesses', JSON.stringify(favorites));
        setIsFavorited(!isFavorited);
    };
    const handleShare = () => {
        if (!business) return;
        if (navigator.share) {
            navigator.share({
                title: business.business_name,
                text: business.description,
                url: window.location.href,
            });
        } else {
            const dummyTextArea = document.createElement('textarea');
            dummyTextArea.value = window.location.href;
            document.body.appendChild(dummyTextArea);
            dummyTextArea.select();
            alert(`URL copied to clipboard!`);
            document.body.removeChild(dummyTextArea); // Clean up
        }
    };
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

    return (
        <motion.div initial="hidden" animate="visible" className="relative p-4 bg-gray-100 dark:bg-gray-900 min-h-screen font-inter">
            {/* Modals for Menu, Cars, Retail (Added new) */}
            {showMenuModal && (
                <Modal title="Our Menu" onClose={() => setShowMenuModal(false)}>
                    {menu.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {menu.map((item) => (
                                <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden flex flex-col">
                                    {item.images && item.images.length > 0 && item.images[0] && (
                                        <div className="w-full h-48 relative flex-shrink-0">
                                            <img
                                                src={item.images[0]}
                                                alt={item.name}
                                                className="w-full h-full object-cover"
                                                onError={(e) => { e.currentTarget.src = 'https://placehold.co/80x80/cccccc/333333?text=Menu+Item'; e.currentTarget.onerror = null; }}
                                            />
                                        </div>
                                    )}
                                    <div className="p-4 flex flex-col flex-grow">
                                        <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{item.name}</h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{item.description}</p>
                                        {item.price && <p className="text-blue-600 dark:text-blue-400 font-bold mt-1">{item.price}</p>}
                                        <div className="mt-auto pt-3">
                                            <button
                                                onClick={() => setSelectedItemForDetails({ type: 'menu', item: item })}
                                                className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm"
                                            >
                                                <Eye size={18} />
                                                View Details
                                            </button>
                                        </div>
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
                                            <div className="mt-auto pt-3">
                                                <button
                                                    onClick={() => setSelectedItemForDetails({ type: 'car', item: item })}
                                                    className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm"
                                                >
                                                    <Eye size={18} />
                                                    View Details
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
                                <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden flex flex-col">
                                    {item.images?.[0] && (
                                        <div className="w-full h-48 relative flex-shrink-0">
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
                                        <div className="mt-auto pt-3">
                                            <button
                                                onClick={() => setSelectedItemForDetails({ type: 'retail', item: item })}
                                                className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm"
                                            >
                                                <Eye size={18} />
                                                View Details
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

            <motion.div className="bg-gray-50 dark:bg-gray-800 rounded-xl max-w-4xl mx-auto shadow-lg p-4 sm:p-6 space-y-6">
                {/* Header */}
                <div className="flex justify-between items-start flex-col sm:flex-row">
                    <div className="flex items-center gap-4 mb-4 sm:mb-0">
                        {business.logo_url && (
                            <div className="w-20 sm:w-24 h-20 sm:h-24 flex-shrink-0">
                                <img
                                    src={business.logo_url}
                                    alt="Business Logo"
                                    className="rounded-full object-contain w-full h-full shadow-md border border-gray-200 dark:border-gray-700"
                                    onError={(e) => { e.currentTarget.src = 'https://placehold.co/80x80/cccccc/333333?text=Logo'; e.currentTarget.onerror = null; }}
                                />
                            </div>
                        )}
                        <div className="text-left flex-1">
                            <h1 className="text-2xl sm:text-3xl font-bold text-green-700 dark:text-green-400">{business.business_name}</h1>
                            <p className="text-gray-500 dark:text-gray-400 italic">{business.category}</p>
                        </div>
                    </div>
                    <div className="flex gap-4 items-center">
                        <button className="bg-[#ede7f6] dark:bg-gray-700 px-4 py-2 rounded-full text-md flex items-center gap-2 hover:bg-[#dcd1f2] dark:hover:bg-gray-600 transition-colors duration-200 shadow-md" onClick={handleShare}>
                            <FaShareAlt size={18} /> Share
                        </button>
                        <button onClick={toggleFavorite} className={cn(
                            "bg-white dark:bg-gray-700 rounded-full p-2 sm:p-3 shadow-md z-10",
                            "transition-colors duration-300",
                            isFavorited
                                ? "text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50"
                                : "text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-red-500"
                        )}>
                            {isFavorited ? <FaHeart size={24} /> : <FaRegHeart size={24} />}
                        </button>
                    </div>
                </div>

                {/* Business Actions */}
                <div className="flex flex-wrap gap-4 mt-6">
                    {business.phone && (
                        <a
                            href={`tel:${business.phone}`}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <FaPhone className="h-5 w-5 mr-2" />
                            Call
                        </a>
                    )}
                    {business.website && (
                        <a
                            href={business.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <FaGlobe className="h-5 w-5 mr-2" />
                            Visit Website
                        </a>
                    )}
                    {business.email && (
                        <a
                            href={`mailto:${business.email}`}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <FaEnvelope className="h-5 w-5 mr-2" />
                            Email
                        </a>
                    )}
                </div>

                {/* Gallery Carousel */}
                <motion.div>
                    {business.images?.length ? (
                        <div className="relative rounded-xl overflow-hidden w-full aspect-video flex items-center justify-center group">
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
                    ) : (
                        <div className="w-full h-60 bg-gray-200 dark:bg-gray-700 flex items-center justify-center rounded-xl">
                            <span className="text-gray-500 dark:text-gray-400 italic">No Images Available</span>
                        </div>
                    )}
                </motion.div>
                {/* Description */}
                <motion.div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-md">
                    <h2 className="text-xl font-semibold text-[#333] dark:text-gray-100 mb-4">Description</h2>
                    <p className="text-[#444] dark:text-gray-300 leading-relaxed whitespace-pre-line">{business.description}</p>
                </motion.div>
                {/* Hours */}
                <motion.div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-md">
                    <h2 className="text-xl font-semibold text-[#333] dark:text-gray-100 mb-4">Hours</h2>
                    {business.hours && typeof business.hours === 'object' ? (
                        <div className="text-sm text-[#555] dark:text-gray-400 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                            {Object.entries(business.hours || {}).map(([day, hours]) => (
                                <p key={day} className="flex justify-between"><strong className="capitalize">{day}:</strong> <span>{hours || 'Closed'}</span></p>
                            ))}
                        </div>
                    ) : business.hours ? (
                        <p className="text-sm text-[#555] dark:text-gray-400">{business.hours}</p>
                    ) : (
                        <p className="text-sm text-[#aaa] dark:text-gray-500 italic">Hours not provided</p>
                    )}
                </motion.div>
                {/* Contact */}
                <motion.div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-md space-y-3">
                    <h2 className="text-xl font-semibold text-[#333] dark:text-gray-100">Contact</h2>
                    {business.phone && (<p className="flex items-center gap-2 text-sm text-[#444] dark:text-gray-300"><FaPhone className="text-green-500 dark:text-green-400" size={16} /><a href={`tel:${business.phone}`} className="text-blue-500 dark:text-blue-400 hover:underline">{business.phone}</a></p>)}
                    {business.whatsapp && (<p className="flex items-center gap-2 text-sm text-[#444] dark:text-gray-300"><FaWhatsapp className="text-green-500 dark:text-green-400" size={16} /><a href={`https://wa.me/${business.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 dark:text-blue-400 hover:underline">WhatsApp: {business.whatsapp}</a></p>)}
                    {business.email && (<p className="flex items-center gap-2 text-sm text-[#444] dark:text-gray-300"><FaEnvelope size={16} /><a href={`mailto:${business.email}`} className="text-blue-500 dark:text-blue-400 hover:underline">{business.email}</a></p>)}
                    {business.website && (<p className="flex items-center gap-2 text-sm text-[#444] dark:text-gray-300"><FaGlobe size={16} /><a href={business.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 dark:text-blue-400 hover:underline">Website</a></p>)}
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
                {/* Socials */}
                <motion.div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-md">
                    <h2 className="text-xl font-semibold text-[#333] dark:text-gray-100">Socials</h2>
                    <ul className="list-none space-y-2">
                        {business.instagram && (<li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><FaInstagram className="text-blue-500 dark:text-blue-400" size={18} /><a href={business.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 dark:hover:text-blue-400 hover:underline">Instagram</a></li>)}
                        {business.facebook && (<li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><FaFacebook className="text-blue-600 dark:text-blue-400" size={18} /><a href={business.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline">Facebook</a></li>)}
                        {business.tiktok && (<li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><FaTiktok className="text-black dark:text-gray-100" size={18} /><a href={business.tiktok} target="_blank" rel="noopener noreferrer" className="hover:text-gray-800 dark:hover:text-gray-200 hover:underline">TikTok</a></li>)}
                        {business.twitter && (<li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><FaTwitter className="text-blue-400 dark:text-blue-300" size={18} /><a href={business.twitter} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 dark:hover:text-blue-300 hover:underline">Twitter</a></li>)}
                    </ul>
                </motion.div>
                {/* === ALL ITEMS SECTION AT THE BOTTOM === */}
                {(menu.length > 0 || carListings.length > 0 || retailItems.length > 0) && (
                    <motion.div className="mt-10 bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-lg space-y-10">
                        {/* Menu */}
                        {menu.length > 0 && (
                            <div>
                                <h2 className="text-xl font-semibold text-[#333] dark:text-gray-100 mb-4 flex items-center gap-2">
                                    <ClipboardListIcon size={20} /> Menu
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {menu.map((item) => (
                                        <div key={item.id} className="flex flex-col bg-gray-100 dark:bg-gray-700 rounded-lg p-3 shadow-sm relative">
                                            {item.images && item.images.length > 0 && item.images[0] && (
                                                <div className="w-full h-48 relative flex-shrink-0 mb-3">
                                                    <img
                                                        src={item.images[0]}
                                                        alt={item.name}
                                                        className="w-full h-full object-cover rounded-md"
                                                        onError={(e) => {
                                                            console.error('Image failed to load:', item.images[0]);
                                                            e.currentTarget.src = 'https://placehold.co/80x80/cccccc/333333?text=Menu+Item';
                                                            e.currentTarget.onerror = null;
                                                        }}
                                                    />
                                                </div>
                                            )}
                                            <div className="flex flex-col flex-grow">
                                                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{item.name}</h3>
                                                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{item.description}</p>
                                                {item.price && <p className="text-blue-600 dark:text-blue-400 font-bold mt-1">{item.price}</p>}
                                                <div className="mt-auto pt-3">
                                                    <button
                                                        onClick={() => setSelectedItemForDetails({ type: 'menu', item: item })}
                                                        className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm"
                                                    >
                                                        <Eye size={18} />
                                                        View Details
                                                    </button>
                                                </div>
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
                                    {carListings.map((car) => (
                                        <div key={car.id} className="bg-gray-100 dark:bg-gray-700 rounded-lg shadow-sm overflow-hidden relative flex flex-col">
                                            {car.images && car.images.length > 0 && car.images[0] && (
                                                <div className="w-full h-48 relative flex-shrink-0 mb-3">
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
                                                <div className="mt-auto pt-3">
                                                    <button
                                                        onClick={() => setSelectedItemForDetails({ type: 'car', item: car })}
                                                        className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm"
                                                    >
                                                        <Eye size={18} />
                                                        View Details
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
                                    {retailItems.map((item) => (
                                        <div key={item.id} className="bg-gray-100 dark:bg-gray-700 rounded-lg shadow-sm overflow-hidden relative flex flex-col">
                                            {item.images?.[0] && (
                                                <div className="w-full h-48 relative flex-shrink-0 mb-3">
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
                                                <div className="mt-auto pt-3">
                                                    <button
                                                        onClick={() => setSelectedItemForDetails({ type: 'retail', item: item })}
                                                        className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm"
                                                    >
                                                        <Eye size={18} />
                                                        View Details
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
            </motion.div>
        </motion.div>
    );
};

export default BusinessProfilePage;