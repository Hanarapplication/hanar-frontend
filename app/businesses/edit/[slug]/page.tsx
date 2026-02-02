'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient'; // Import your Supabase client

import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Trash2, Plus, X, Image as ImageIcon, Link, Facebook, Instagram, Twitter,
  Phone, Mail, Clock, Building, Store, Car, Tag, Calendar, Gauge,
  HeartHandshake, DollarSign, Shirt, Laptop, ClipboardList, Video, MessageSquare, MapPin,
  Clock as ClockIcon, ExternalLink, Hash, Text, Info, List, Factory,
  Car as CarIcon, DollarSign as DollarIcon, Calendar as CalendarIcon, Wrench,
  Package, ShoppingBag
} from 'lucide-react';

/**
 * Global variables (from Canvas environment, if applicable).
 * Note: Supabase client should be configured externally and imported.
 * These are primarily for context if storage paths or other dynamic IDs are needed.
 */
declare const __app_id: string; // Used for identifying the app in storage/database paths
// __firebase_config and __initial_auth_token are NOT used with Supabase.

// --- UUID Generation Fallback ---
/**
 * Generates a UUID (v4). Uses `crypto.randomUUID()` if available, otherwise falls back to a
 * pseudo-random generation.
 * @returns {string} A UUID string.
 */
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments where crypto.randomUUID is not available (e.g., older Node.js)
  // This is a common, simple UUID v4 generation algorithm
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0,
      v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const normalizeNumberString = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[^0-9.]/g, '').trim();
};

const normalizeNumericInput = (value: string, allowDecimal: boolean): string => {
  const normalized = value.replace(/[^0-9.]/g, '');
  if (!allowDecimal) {
    return normalized.replace(/\./g, '');
  }
  const [head, ...rest] = normalized.split('.');
  return rest.length ? `${head}.${rest.join('')}` : head;
};

const SUPABASE_STORAGE_URL_PREFIX =
  `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://halgcyrumpbvlkzagfgy.supabase.co'}/storage/v1/object/public/`;

const normalizeBusinessCategory = (value?: string | null): string => {
  const normalized = (value || '').trim().toLowerCase();
  if (['other', 'something_else'].includes(normalized)) return 'something_else';
  if (['retail', 'retails'].includes(normalized)) return 'Retail';
  if (['restaurant'].includes(normalized)) return 'Restaurant';
  if (['car dealership', 'car_dealership'].includes(normalized)) return 'Car Dealership';
  return value || '';
};

const isRetailCategory = (value?: string | null): boolean => {
  const normalized = normalizeBusinessCategory(value);
  return normalized === 'Retail' || normalized === 'something_else';
};

const extractStoragePath = (value: string, buckets: string[]): string => {
  if (!value) return '';
  if (value.startsWith('http')) {
    for (const bucket of buckets) {
      const prefix = `${SUPABASE_STORAGE_URL_PREFIX}${bucket}/`;
      if (value.startsWith(prefix)) {
        return value.slice(prefix.length);
      }
    }
    return value;
  }
  return value;
};

const formatNumberWithCommas = (value: string | number | null | undefined): string => {
  const normalized = normalizeNumberString(value);
  if (!normalized) return '';
  const [whole, decimal] = normalized.split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimal ? `${withCommas}.${decimal}` : withCommas;
};

const formatCurrencyDisplay = (value: string | number | null | undefined): string => {
  const formatted = formatNumberWithCommas(value);
  return formatted ? `$${formatted}` : '';
};

/**
 * Helper to ensure images arrays are structured with { file: File | null, preview: string, id: string }
 * Each image now gets a unique ID for better management, especially for deletions
 */
interface ImageFileObject {
  id: string;
  file: File | null; // null if it's an existing URL, File if it's a new upload
  preview: string; // URL for display (blob URL for new files, public URL for existing)
  isNew: boolean; // True if it's a newly selected file, false if from DB
}

/**
 * Helper to get the correct public URL for an image, whether it's a new blob or an existing Supabase URL.
 * It intelligently determines the bucket based on the item type.
 * @param {any} image - The image object or string (URL).
 * @param {'menu_item' | 'retail_item' | 'car_listing'} bucketType - The type of item the image belongs to, to determine the correct Supabase bucket.
 * @returns {string} The public URL for the image or a placeholder if invalid.
 */
const getImageUrl = (image: any, bucketType: 'menu_item' | 'retail_item' | 'car_listing' | 'gallery_image') => {

  let bucketName: string;
  switch (bucketType) {
    case 'menu_item':
      bucketName = 'restaurant-menu';
      break;
    case 'car_listing':
      bucketName = 'car-listings';
      break;
    case 'retail_item':
      bucketName = 'retail-items';
      break;
    case 'gallery_image':
      bucketName = 'business-uploads'; // Gallery images go to 'business-uploads'
      break;
    default:
      console.warn("Unknown bucketType provided to getImageUrl:", bucketType);
      return 'https://placehold.co/300x200/cccccc/333333?text=Image+Error'; // Fallback
  }

  // If it's a newly selected file, it will have a 'preview' (blob URL) and 'isNew' flag
  if (image && image.isNew && image.preview) {
    return image.preview;
  }
  const buildPublicUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    if (path.startsWith(`${bucketName}/`)) {
      return `${SUPABASE_STORAGE_URL_PREFIX}${path}`;
    }
    return `${SUPABASE_STORAGE_URL_PREFIX}${bucketName}/${path}`;
  };
  // If it's an existing URL from the DB, it might be a string or an object with 'preview'
  if (typeof image === 'string') {
    return buildPublicUrl(image);
  }
  // If it's an object from DB (like {id, preview, file: null, isNew: false})
  if (image && image.preview) {
    // If image.preview is already a full URL, return as is
    return buildPublicUrl(image.preview);
  }
  // Fallback if no valid image source is found
  return 'https://placehold.co/300x200/cccccc/333333?text=Image+Missing';
};


/**
 * SortableItem component for drag-and-drop functionality using dnd-kit.
 * It wraps its children, allowing them to be dragged and reordered within a SortableContext.
 * @param {object} props - The component props.
 * @param {string} props.id - A unique identifier for the sortable item.
 * @param {React.ReactNode} props.children - The content to be made sortable.
*/
function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute left-2 top-2 z-10 rounded-md border border-slate-200 bg-white/90 px-2 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-200"
        aria-label="Drag to reorder"
      >
        Drag
      </button>
      {children}
    </div>
  );
}

/**
 * CustomModal component to display messages (success/error) to the user.
 * This replaces the browser's native `alert()` for a better user experience.
 * @param {object} props - The component props.
 * @param {boolean} props.isOpen - Controls the visibility of the modal.
 * @param {string} props.title - The title displayed at the top of the modal.
 * @param {string} props.message - The main content message of the modal.
 * @param {function} props.onClose - Callback function to be executed when the modal is closed.
*/
function CustomModal({ isOpen, title, message, onClose, onConfirm, backdropClassName = '' }: { 
  isOpen: boolean; 
  title: string; 
  message: string; 
  onClose: () => void;
  onConfirm: () => void;
  backdropClassName?: string;
}) {
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-50 p-4 font-inter ${backdropClassName}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full transform transition-all duration-300 scale-100 opacity-100 text-gray-800 dark:text-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200">
            <X size={20} />
          </button>
        </div>
        <p className="text-gray-600 dark:text-gray-300 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200 shadow-md"
          >
            No
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200 shadow-md"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper component for consistent styling of input fields.
 * Includes optional icon rendering.
 * @param {object} props - Input field properties.
 * @param {string} props.name - The name attribute for the input.
 * @param {string} props.value - The current value of the input.
 * @param {function} props.onChange - The change handler function.
 * @param {string} props.placeholder - The placeholder text.
 * @param {string} [props.type='text'] - The input type (e.g., 'text', 'number', 'email').
 * @param {React.ComponentType} [props.icon] - Lucide icon component to display inside the input.
 * @param {object} [props] - Any other standard HTML input attributes.
*/
const FormInput = ({ name, value, onChange, placeholder, type = 'text', icon: Icon, ...props }: {
  name: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  type?: string;
  icon?: React.ComponentType<{ size: number; className?: string }>;
  [key: string]: any; // For other props
}) => (
  <div className="relative flex items-center">
    {Icon && <Icon size={18} className="absolute left-3 text-gray-400" />}
    <input
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${Icon ? 'pl-10' : ''}`}
      {...props}
    />
  </div>
);

/**
 * Helper component for consistent styling of textarea fields.
 * Includes optional icon rendering.
 * @param {object} props - Textarea field properties.
 * @param {string} props.name - The name attribute for the textarea.
 * @param {string} props.value - The current value of the textarea.
 * @param {function} props.onChange - The change handler function.
 * @param {string} props.placeholder - The placeholder text.
 * @param {number} [props.rows=2] - The number of visible text lines.
 * @param {React.ComponentType} [props.icon] - Lucide icon component to display inside the textarea.
 * @param {object} [props] - Any other standard HTML textarea attributes.
*/
const FormTextarea = ({ name, value, onChange, placeholder, rows = 2, icon: Icon, ...props }: {
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  rows?: number;
  icon?: React.ComponentType<{ size: number; className?: string }>;
  [key: string]: any; // For other props
}) => (
  <div className="relative flex items-start">
    {Icon && <Icon size={18} className="absolute left-3 top-3 text-gray-400" />}
    <textarea
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${Icon ? 'pl-10' : ''}`}
      {...props}
    />
  </div>
);

/**
 * Interface for a menu item.
 */
interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: string;
  images: ImageFileObject[];
  category: string;
  _isNew: boolean;
  _isDeleted: boolean;
  _isHiding: boolean;
}

/**
 * Interface for a car listing item.
 */
interface CarListingItem {
  id: string;
  title: string;
  price: string;
  year: string;
  mileage: string;
  condition: string;
  description: string;
  images: ImageFileObject[];
  _isNew: boolean;
  _isDeleted: boolean;
  _isHiding: boolean;
}

/**
 * Interface for a retail item.
 */
interface RetailItem {
  id: string;
  name: string;
  price: string;
  category: string;
  description: string;
  images: ImageFileObject[];
  _isNew: boolean;
  _isDeleted: boolean;
  _isHiding: boolean;
}

/**
 * Interface for the main business form data.
 */
interface BusinessForm {
  name: string;
  description: string;
  type: string;
  phone: string;
  email: string;
  website: string;
  logo: File | null; // Corrected type to allow File object for new uploads
  _logoUrl: string | null; // Added for storing existing logo URL from DB
  gallery: any[]; // Original property, but `images` and `_galleryUrls` are used more directly
  _galleryUrls: string[]; // Added for storing existing gallery URLs
  images: ImageFileObject[]; // Added for new gallery images (staged files)
  menu: MenuItem[]; // Typed specifically
  carListings: CarListingItem[]; // Typed specifically
  retailItems: RetailItem[]; // Typed specifically
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  hours: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
    sunday: string;
  };
  socialMedia: { // This object is not used directly for form fields, but remains in interface
    facebook: string;
    instagram: string;
    twitter: string;
    linkedin: string;
    whatsapp?: string;
  };
  // Explicitly defined top-level social media and business info fields used directly in the form
  business_name: string;
  category: string;
  whatsapp: string;
  tiktok: string;
  facebook: string;
  instagram: string;
  twitter: string;
  tags: string[];
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  slug: string; // Added for routing/fetching
}

export default function EditBusinessPage() {
  const { slug } = useParams(); // Get slug from URL parameters
  const router = useRouter(); // Get router instance
  // Configure dnd-kit sensors for pointer (mouse/touch) and keyboard interactions
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  // State to hold all form data
  const [form, setForm] = useState<BusinessForm>({
    name: '',
    description: '',
    type: '',
    phone: '',
    email: '',
    website: '',
    logo: null, // Initialized as null for file input
    _logoUrl: null, // Initialized as null for existing URL
    gallery: [],
    _galleryUrls: [], // Initialized for existing gallery URLs
    images: [], // Initialized for new gallery image files
    menu: [],
    carListings: [],
    retailItems: [],
    address: {
      street: '',
      city: '',
      state: '',
      zip: '',
      country: ''
    },
    hours: {
      monday: '',
      tuesday: '',
      wednesday: '',
      thursday: '',
      friday: '',
      saturday: '',
      sunday: ''
    },
    socialMedia: {
      facebook: '',
      instagram: '',
      twitter: '',
      linkedin: '',
      whatsapp: ''
    },
    // Initialize top-level social media and business info fields
    business_name: '',
    category: '',
    whatsapp: '',
    tiktok: '',
    facebook: '',
    instagram: '',
    twitter: '',
    tags: [],
    isVerified: false,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slug: '', // Initialized for slug
  });
  // State for logo image preview URL (for newly selected file or existing URL)
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  // State for gallery images preview URLs (for newly selected files or existing URLs)
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  // State to indicate if data is currently being saved (for loading spinner)
  const [isSaving, setIsSaving] = useState(false);
  // State for controlling the custom modal's visibility and content
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '' });
  const [categoryChangeModal, setCategoryChangeModal] = useState<{
    isOpen: boolean;
    nextValue: string;
  }>({ isOpen: false, nextValue: '' });
  const [isSubmitting, setSubmitting] = useState(false);

  // Store the original business ID after fetching to use for dynamic content
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false); // State to track auth readiness
  const [userId, setUserId] = useState<string | null>(null); // User ID for Supabase RLS context if needed for paths
  
  // Plan limits from business plan
  const [planLimits, setPlanLimits] = useState<{
    max_gallery_images: number;
    max_menu_items: number;
    max_retail_items: number;
    max_car_listings: number;
  }>({
    max_gallery_images: 5, // Default fallback
    max_menu_items: 0, // Default fallback
    max_retail_items: 0, // Default fallback
    max_car_listings: 0, // Default fallback
  });
  
  // Plan status information
  const [planStatus, setPlanStatus] = useState<{
    plan: string | null;
    plan_expires_at: string | null;
  }>({
    plan: null,
    plan_expires_at: null,
  });
  
  // Plan feature flags
  const [planFeatures, setPlanFeatures] = useState<{
    allow_social_links: boolean;
    allow_whatsapp: boolean;
    allow_promoted: boolean;
    allow_reviews: boolean;
    allow_qr: boolean;
  }>({
    allow_social_links: false,
    allow_whatsapp: false,
    allow_promoted: false,
    allow_reviews: false,
    allow_qr: false,
  });

  // Ref for the logo file input to clear its value programmatically.
  // This is the correct and standard way to declare a ref for an HTMLInputElement.
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Define the available business types for the dropdown
  const businessTypes = [
    { value: 'Restaurant', label: 'Restaurant', icon: '🍽️' },
    { value: 'Car Dealership', label: 'Car Dealership', icon: '🚗' },
    { value: 'Retail', label: 'Retail (Clothing, Electronics, etc.)', icon: '🛍️' },
    { value: 'something_else', label: 'Other / Service', icon: '❓' }, // Ensure 'something_else' is an option
  ];

  // --- Supabase Auth and User ID Effect ---
  useEffect(() => {
    async function checkAuthAndSetUserId() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Supabase auth session error:", error);
          setModal({ isOpen: true, title: 'Authentication Error', message: `Failed to get session: ${error.message}`, onConfirm: () => {} });
        }
        setUserId(session?.user?.id || generateUUID()); // Use Supabase user ID or a random UUID
        setAuthReady(true);
      } catch (e: any) {
        console.error("Auth initialization failed:", e);
        setModal({ isOpen: true, title: 'Auth Error', message: `Auth initialization failed: ${e.message}`, onConfirm: () => {} });
        setUserId(generateUUID()); // Fallback to random UUID if auth entirely fails
        setAuthReady(true);
      }
    }
    checkAuthAndSetUserId();
  }, []); // Run once on component mount

  // --- Data Fetching Effect ---
  useEffect(() => {
    async function fetchBusinessData() {
      if (!slug || !authReady) return; // Don't fetch if slug or auth is not available yet

      try {
        // Fetch main business data from 'businesses' table, including plan limits
        const { data: businessData, error: businessError } = await supabase
          .from('businesses')
          .select('*')
          .eq('slug', slug)
          .single();

        if (businessError) {
          console.error('Error fetching business:', businessError);
          setModal({ isOpen: true, title: 'Error', message: `Failed to load business: ${businessError.message}`, onConfirm: () => {} });
          router.push('/business-dashboard'); // Redirect to business dashboard on error
          return;
        }

        if (!businessData) {
          setModal({ isOpen: true, title: 'Not Found', message: 'Business not found.', onConfirm: () => {} });
          router.push('/business-dashboard');
          return;
        }

        setBusinessId(businessData.id); // Store the Supabase 'id' for the business

        // Set plan limits from business data
        setPlanLimits({
          max_gallery_images: businessData.max_gallery_images ?? 5,
          max_menu_items: businessData.max_menu_items ?? 0,
          max_retail_items: businessData.max_retail_items ?? 0,
          max_car_listings: businessData.max_car_listings ?? 0,
        });
        
        // Set plan status information
        setPlanStatus({
          plan: businessData.plan || 'free',
          plan_expires_at: businessData.plan_expires_at || null,
        });
        
        // Set plan feature flags
        setPlanFeatures({
          allow_social_links: businessData.allow_social_links ?? false,
          allow_whatsapp: businessData.allow_whatsapp ?? false,
          allow_promoted: businessData.allow_promoted ?? false,
          allow_reviews: businessData.allow_reviews ?? false,
          allow_qr: businessData.allow_qr ?? false,
        });

        // Helper to ensure images arrays are structured with { file: File | null, preview: string, id: string }
        // Each image now gets a unique ID for better management, especially for deletions
        const mapImagesToPreviewObjects = (imagesArray: string[] | any[]): ImageFileObject[] => {
          return (imagesArray || []).map((img: any) => {
            if (typeof img === 'string') {
              // For existing URLs from DB, use the URL itself as a stable ID
              return { id: img, file: null, preview: img, isNew: false };
            }
            // If it's already an object, ensure it has an ID, or assign one if missing (for robustness)
            return { id: img.id || (img.file ? generateUUID() : img.preview), file: img.file || null, preview: img.preview || img, isNew: !!img.file };
          });
        };


        const parsedHours = businessData.hours ? JSON.parse(businessData.hours) : {};

        let menuItemsFromDb: MenuItem[] = [];
        if (businessData.category === 'Restaurant' && businessData.id) {
          const { data: menuData, error: menuError } = await supabase
            .from('menu_items')
            .select('*')
            .eq('business_id', businessData.id)
            .order('created_at', { ascending: true }); // Order them for consistency

          if (menuError) {
            console.error('Error fetching menu items:', menuError);
          } else {
            const sortedMenuData = (menuData || []).slice().sort((a: any, b: any) => {
              const aTime = new Date(a.created_at || 0).getTime();
              const bTime = new Date(b.created_at || 0).getTime();
              return bTime - aTime;
            });
            menuItemsFromDb = sortedMenuData.map((item: any) => ({
              id: item.id,
              name: item.name || '',
              description: item.description || '',
              price: item.price !== null && item.price !== undefined ? String(item.price) : '',
              images: item.image_url ? [{
                id: generateUUID(), // Generate new ID for fetched single image
                file: null,
                preview: item.image_url,
                isNew: false
              }] : [],
              category: item.category || '',
              _isNew: false,
              _isDeleted: false,
              _isHiding: false,
            }));

          if (menuItemsFromDb.length > 0) {
            const menuItemIds = menuItemsFromDb.map((item) => item.id).filter(Boolean);
            const { data: menuPhotos, error: menuPhotosError } = await supabase
              .from('menu_item_photos')
              .select('menu_item_id, storage_path, sort_order')
              .in('menu_item_id', menuItemIds)
              .order('sort_order', { ascending: true });

            if (menuPhotosError) {
              console.error('Error fetching menu item photos:', menuPhotosError);
            } else if (menuPhotos && menuPhotos.length > 0) {
              const photosById = menuPhotos.reduce((acc: Record<string, { storage_path: string; sort_order: number }[]>, photo) => {
                if (!acc[photo.menu_item_id]) acc[photo.menu_item_id] = [];
                acc[photo.menu_item_id].push(photo);
                return acc;
              }, {});

              menuItemsFromDb = menuItemsFromDb.map((item) => {
                const photos = photosById[item.id] || [];
                if (!photos.length) return item;
                return {
                  ...item,
                  images: photos.map((photo) => ({
                    id: generateUUID(),
                    file: null,
                    preview: photo.storage_path,
                    isNew: false,
                  })),
                };
              });
            }
          }
          }
        }

        let carListingsFromDb: CarListingItem[] = [];
        if (businessData.category === 'Car Dealership' && businessData.id) {
          const { data: carData, error: carError } = await supabase
            .from('dealerships')
            .select('*')
            .eq('business_id', businessData.id)
            .order('created_at', { ascending: true });

          if (carError) {
            console.error('Error fetching car listings from dealerships table:', carError);
          } else {
            const sortedCarData = (carData || []).slice().sort((a: any, b: any) => {
              const aTime = new Date(a.created_at || 0).getTime();
              const bTime = new Date(b.created_at || 0).getTime();
              return bTime - aTime;
            });
            carListingsFromDb = sortedCarData.map((item: any) => ({
              id: item.id,
              title: item.title || '',
              price: item.price !== null && item.price !== undefined ? String(item.price) : '',
              year: item.year || '',
              mileage: item.mileage || '',
              condition: item.condition || '',
              description: item.description || '',
              images: mapImagesToPreviewObjects(item.images),
              _isNew: false,
              _isDeleted: false,
              _isHiding: false,
            }));
          }
        }

        let retailItemsFromDb: RetailItem[] = [];
        if (isRetailCategory(businessData.category) && businessData.id) {
            const { data: retailData, error: retailError } = await supabase
              .from('retail_items')
              .select('*')
              .eq('business_id', businessData.id)
              .order('created_at', { ascending: true });

            if (retailError) {
                console.error('Error fetching retail items:', retailError);
            } else {
                const sortedRetailData = (retailData || []).slice().sort((a: any, b: any) => {
                  const aTime = new Date(a.created_at || 0).getTime();
                  const bTime = new Date(b.created_at || 0).getTime();
                  return bTime - aTime;
                });
                retailItemsFromDb = sortedRetailData.map((item: any) => ({
                    id: item.id,
                    name: item.name || '',
                    price: item.price !== null && item.price !== undefined ? String(item.price) : '',
                    category: item.category || '',
                    description: item.description || '',
                    images: mapImagesToPreviewObjects(item.images),
                    _isNew: false,
                    _isDeleted: false,
                    _isHiding: false,
                }));
            }

            if (retailItemsFromDb.length > 0) {
              const retailItemIds = retailItemsFromDb.map((item) => item.id).filter(Boolean);
              const { data: retailPhotos, error: retailPhotosError } = await supabase
                .from('retail_item_photos')
                .select('retail_item_id, storage_path, sort_order')
                .in('retail_item_id', retailItemIds)
                .order('sort_order', { ascending: true });

              if (retailPhotosError) {
                console.error('Error fetching retail item photos:', retailPhotosError);
              } else if (retailPhotos && retailPhotos.length > 0) {
                const photosById = retailPhotos.reduce((acc: Record<string, { storage_path: string; sort_order: number }[]>, photo) => {
                  if (!acc[photo.retail_item_id]) acc[photo.retail_item_id] = [];
                  acc[photo.retail_item_id].push(photo);
                  return acc;
                }, {});

                retailItemsFromDb = retailItemsFromDb.map((item) => {
                  const photos = photosById[item.id] || [];
                  if (!photos.length) return item;
                  return {
                    ...item,
                    images: photos.map((photo) => ({
                      id: generateUUID(),
                      file: null,
                      preview: photo.storage_path,
                      isNew: false,
                    })),
                  };
                });
              }
            }
        }

        setForm({
          business_name: businessData.business_name || '',
          description: businessData.description || '',
          category: normalizeBusinessCategory(businessData.category),
          phone: businessData.phone || '',
          email: businessData.email || '',
          whatsapp: businessData.whatsapp || '',
          website: businessData.website || '',
          address: businessData.address || { street: '', city: '', state: '', zip: '', country: '' },
          facebook: businessData.facebook || '',
          instagram: businessData.instagram || '',
          twitter: businessData.twitter || '',
          tiktok: businessData.tiktok || '',
          hours: parsedHours,
          menu: menuItemsFromDb,
          carListings: carListingsFromDb,
          retailItems: retailItemsFromDb,
          logo: null,
          _logoUrl: businessData.logo_url || null,
          images: [],
          _galleryUrls: businessData.images || [],
          slug: businessData.slug || '',
          name: businessData.name || '',
          type: businessData.type || '',
          tags: businessData.tags || [],
          isVerified: businessData.is_verified || false,
          isActive: businessData.is_active || true,
          createdAt: businessData.created_at || new Date().toISOString(),
          updatedAt: businessData.updated_at || new Date().toISOString(),
          gallery: [], // Add missing gallery property
          socialMedia: { // Add missing socialMedia property
            facebook: businessData.facebook || '',
            instagram: businessData.instagram || '',
            twitter: businessData.twitter || '',
            linkedin: '',
            whatsapp: businessData.whatsapp || ''
          }
        });

        setLogoPreview(businessData.logo_url || null);
        // Combine existing URLs and new files for gallery previews
        const existingGalleryPreviews = (businessData.images || []).map((url: string) => url);
        setGalleryPreviews(existingGalleryPreviews);
        console.log('Business data loaded:', businessData);
      } catch (error: any) {
        console.error('Error in fetchBusinessData:', error);
        setModal({ isOpen: true, title: 'Error', message: error.message || 'An unexpected error occurred while loading business data.', onConfirm: () => {} });
        router.push('/business-dashboard');
      }
    }

    if (authReady) {
      fetchBusinessData();
    }
  }, [slug, router, authReady]);


  const applyCategoryChange = (nextCategory: string) => {
    setForm((prevForm: any) => {
      const newForm = { ...prevForm };
      newForm.category = nextCategory;
      if (nextCategory !== 'Restaurant') newForm.menu = [];
      if (nextCategory !== 'Car Dealership') newForm.carListings = [];
      if (!isRetailCategory(nextCategory)) newForm.retailItems = [];
      return newForm;
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'category') {
      const normalizedNext = normalizeBusinessCategory(value);
      const normalizedCurrent = normalizeBusinessCategory(form.category);
      if (normalizedNext === normalizedCurrent) return;
      setCategoryChangeModal({ isOpen: true, nextValue: normalizedNext });
      return;
    }

    if (name.startsWith('address.')) {
      const key = name.split('.')[1] as keyof BusinessForm['address'];
      setForm((prevForm) => ({ ...prevForm, address: { ...prevForm.address, [key]: value } }));
    } else if (name.startsWith('hours.')) {
      const key = name.split('.')[1] as keyof BusinessForm['hours'];
      setForm((prevForm) => ({ ...prevForm, hours: { ...prevForm.hours, [key]: value } }));
    } else {
      // Direct update for top-level form fields
      setForm((prevForm) => ({ ...prevForm, [name]: value }));
    }
  };

  /**
   * Uploads a file to Supabase storage.
   * @param {File} file - The file to upload.
   * @param {'logo' | 'gallery' | 'menu_item' | 'retail_item' | 'car_listing'} fileType - The type of file, influencing the bucket and path.
   * @param {string} [dynamicItemId] - Required for item-specific images (menu, retail, car) to create a unique folder.
   * @returns {Promise<string>} The public URL of the uploaded file.
   */
  async function uploadFile(file: File, fileType: 'logo' | 'gallery' | 'menu_item' | 'retail_item' | 'car_listing', dynamicItemId?: string): Promise<string> {
    if (!businessId) throw new Error("Business ID is missing for file upload context. Cannot upload files.");

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw new Error(`Failed to get user: ${authError.message}`);
    if (!authData?.user) throw new Error("Not logged in");

    const userIdForPath = authData.user.id;

    let bucketName: string;
    let filePath: string;

    switch (fileType) {
      case 'car_listing':
        if (!dynamicItemId) throw new Error("Car Item ID is required for car listing image upload.");
        bucketName = 'car-listings';
        filePath = `${userIdForPath}/car-listings/${dynamicItemId}/${Date.now()}-${file.name}`;
        console.log(`[uploadFile] Attempting to upload to bucket: ${bucketName}, path: ${filePath}`);
        break;
      case 'menu_item':
        if (!dynamicItemId) throw new Error("Menu Item ID is required for menu item image upload.");
        bucketName = 'restaurant-menu';
        filePath = `${userIdForPath}/restaurant_menu/${dynamicItemId}/${Date.now()}-${file.name}`;
        console.log(`[uploadFile] Attempting to upload to bucket: ${bucketName}, path: ${filePath}`);
        break;
      case 'retail_item':
        if (!dynamicItemId) throw new Error("Retail Item ID is required for retail item image upload.");
        bucketName = 'retail-items';
        filePath = `${userIdForPath}/retail-items/${dynamicItemId}/${Date.now()}-${file.name}`;
        console.log(`[uploadFile] Attempting to upload to bucket: ${bucketName}, path: ${filePath}`);
        break;
      case 'logo':
        bucketName = 'business-uploads';
        filePath = `${userIdForPath}/business-uploads/logos/${Date.now()}-${file.name}`;
        console.log(`[uploadFile] Attempting to upload to bucket: ${bucketName}, path: ${filePath}`);
        break;
      case 'gallery':
        bucketName = 'business-uploads';
        filePath = `${userIdForPath}/business-uploads/gallerys/${Date.now()}-${file.name}`;
        console.log(`[uploadFile] Attempting to upload to bucket: ${bucketName}, path: ${filePath}`);
        break;
      default:
        throw new Error(`Unknown file type for upload: ${fileType}`);
    }

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error(`Upload error to ${bucketName}/${filePath}:`, error);
      throw new Error(`Failed to upload ${file.name}: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    if (!publicUrlData?.publicUrl) {
      throw new Error(`Failed to get public URL for ${file.name}`);
    }

    console.log(`[uploadFile] Successfully uploaded ${file.name} to ${publicUrlData.publicUrl}`);
    return publicUrlData.publicUrl;
  }

  const uploadMenuItemImages = async (
    files: File[],
    menuItemId: string,
    startIndex = 0
  ): Promise<string[]> => {
    if (!files.length) return [];

    const bucket = 'restaurant-menu';
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not logged in");
    const uploadedPaths: string[] = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const filePath = `${user.id}/restaurant_menu/${menuItemId}/${Date.now()}-${startIndex + i}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: false });

      if (uploadError) {
        throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
      }

      uploadedPaths.push(filePath);
    }

    return uploadedPaths;
  };

  const uploadRetailItemImages = async (
    files: File[],
    retailItemId: string,
    startIndex = 0
  ): Promise<string[]> => {
    if (!files.length) return [];

    const bucket = 'retail-items';
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not logged in");
    const uploadedPaths: string[] = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const filePath = `${user.id}/retail-items/${retailItemId}/${Date.now()}-${startIndex + i}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: false });

      if (uploadError) {
        throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
      }

      uploadedPaths.push(filePath);
    }

    return uploadedPaths;
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setForm((prevForm) => ({ ...prevForm, logo: file }));
      setLogoPreview(URL.createObjectURL(file));
    } else {
      // If no file selected, revert to existing logo URL or null
      setForm((prevForm) => ({ ...prevForm, logo: null }));
      setLogoPreview(form._logoUrl);
    }
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // Combine existing URLs and new staged files for current count
    const currentCombinedImages = [
      ...(form._galleryUrls || []).map((url: string) => ({ preview: url, file: null, isNew: false, id: url })), // Use URL as ID for existing
      ...(form.images || []).filter((img: ImageFileObject) => img.file instanceof File), // Filter only new files
    ];
    const newTotal = currentCombinedImages.length + files.length;
    const maxAllowed = planLimits.max_gallery_images;

    if (newTotal > maxAllowed) {
      setModal({ isOpen: true, title: 'Upload Limit Exceeded', message: `Your plan allows a maximum of ${maxAllowed} gallery images. You currently have ${currentCombinedImages.length} images and are trying to add ${files.length} more, which would exceed your plan limit.`, onConfirm: () => {} });
      e.target.value = ''; // Clear the file input
      return;
    }

    setForm((prevForm) => {
      const newStagedFiles: ImageFileObject[] = files.map(file => ({ id: generateUUID(), file, preview: URL.createObjectURL(file), isNew: true }));
      return {
        ...prevForm,
        images: [...(prevForm.images || []), ...newStagedFiles]
      };
    });

    // Update gallery previews state (combines existing URLs and new blob URLs)
    const allPreviews = [
      ...form._galleryUrls,
      ...(form.images || []).map((img: ImageFileObject) => img.preview), // Existing staged new images
      ...files.map((file) => URL.createObjectURL(file)) // Newly added files
    ];
    setGalleryPreviews(Array.from(new Set(allPreviews))); // Use Set to ensure uniqueness, though UUIDs should prevent duplicates
  };

  const removeGalleryImage = (index: number, isNewFile: boolean) => {
    setForm((prevForm) => {
      const newForm = { ...prevForm };
      if (isNewFile) {
        // If it's a new file, remove from the 'images' array
        newForm.images = newForm.images.filter((_: ImageFileObject, i: number) => i !== index);
      } else {
        // If it's an existing URL, remove from the '_galleryUrls' array
        newForm._galleryUrls = newForm._galleryUrls.filter((_: string, i: number) => i !== index);
      }

      // Re-calculate all previews
      const allPreviews = [
        ...newForm._galleryUrls,
        ...(newForm.images || []).map((img: ImageFileObject) => img.preview)
      ];
      setGalleryPreviews(Array.from(new Set(allPreviews)));

      return newForm;
    });
  };


  const handleMenuItemChange = (index: number, field: string, value: string | FileList | null) => {
    setForm((prevForm) => {
      const updatedMenu = [...prevForm.menu];
      let updatedItem = { ...updatedMenu[index] };

      if (field === 'images') {
        const newFiles = Array.from(value as FileList || []);
        const currentImages = updatedItem.images || [];
        const newTotal = currentImages.length + newFiles.length;

        if (newTotal > 8) { // Max 8 pictures per item
          setModal({ isOpen: true, title: 'Upload Limit Exceeded', message: `You can upload a maximum of 8 images per menu item. You are trying to add ${newFiles.length} new images, which would exceed the limit.`, onConfirm: () => {} });
          return prevForm;
        }

        const newImageObjects: ImageFileObject[] = newFiles.map(file => ({
          id: generateUUID(),
          file,
          preview: URL.createObjectURL(file),
          isNew: true
        }));
        updatedItem.images = [...currentImages, ...newImageObjects];
      } else {
        (updatedItem as any)[field] = value; // Type assertion for dynamic field update
      }

      updatedMenu[index] = updatedItem;
      return { ...prevForm, menu: updatedMenu };
    });
  };

  const removeMenuItemImage = (itemIndex: number, imageIdToRemove: string) => {
    setForm((prevForm) => {
      const updatedMenu = [...prevForm.menu];
      const updatedImages = updatedMenu[itemIndex].images.filter((img: ImageFileObject) => img.id !== imageIdToRemove);
      updatedMenu[itemIndex] = { ...updatedMenu[itemIndex], images: updatedImages };
      return { ...prevForm, menu: updatedMenu };
    });
  };

  const addMenuItem = () => {
    const currentCount = form.menu.length;
    if (currentCount >= planLimits.max_menu_items) {
      setModal({ 
        isOpen: true, 
        title: 'Plan Limit Reached', 
        message: `Your plan allows a maximum of ${planLimits.max_menu_items} menu items. You currently have ${currentCount} items. Please upgrade your plan to add more items.`, 
        onConfirm: () => {} 
      });
      return;
    }
    
    setForm((prevForm) => ({
      ...prevForm,
      menu: [
        ...prevForm.menu,
        {
          id: generateUUID(),
          name: '',
          price: '',
          description: '',
          images: [],
          category: '', // Initialize category for menu item
          _isNew: true,
          _isDeleted: false,
          _isHiding: false,
        },
      ],
    }));
  };

  // Implemented hard delete with confirmation for menu items
  const removeMenuItem = (index: number) => {
    setDeleteModal({ isOpen: true, type: 'menu', index });
  };

  const handleCarListingChange = (index: number, field: string, value: string | FileList | null) => {
    setForm((prevForm) => {
      const updatedListings = [...prevForm.carListings];
      let updatedItem = { ...updatedListings[index] };

      if (field === 'images') {
        const newFiles = Array.from(value as FileList || []);
        const currentImages = updatedItem.images || [];
        const newTotal = currentImages.length + newFiles.length;

        if (newTotal > 8) { // Max 8 pictures per car
          setModal({ isOpen: true, title: 'Upload Limit Exceeded', message: `You can upload a maximum of 8 images per car listing. You are trying to add ${newFiles.length} new images, which would exceed the limit.`, onConfirm: () => {} });
          return prevForm;
        }

        const newImageObjects: ImageFileObject[] = newFiles.map(file => ({
          id: generateUUID(),
          file,
          preview: URL.createObjectURL(file),
          isNew: true
        }));
        updatedItem.images = [...currentImages, ...newImageObjects];
      } else {
        (updatedItem as any)[field] = value; // Type assertion for dynamic field update
      }
      updatedListings[index] = updatedItem;
      return { ...prevForm, carListings: updatedListings };
    });
  };

  const removeCarListingImage = (itemIndex: number, imageIdToRemove: string) => {
    setForm((prevForm) => {
      const updatedListings = [...prevForm.carListings];
      const updatedImages = updatedListings[itemIndex].images.filter((img: ImageFileObject) => img.id !== imageIdToRemove);
      updatedListings[itemIndex] = { ...updatedListings[itemIndex], images: updatedImages };
      return { ...prevForm, carListings: updatedListings };
    });
  };

  const addCarListing = () => {
    const currentCount = form.carListings.length;
    if (currentCount >= planLimits.max_car_listings) {
      setModal({ 
        isOpen: true, 
        title: 'Plan Limit Reached', 
        message: `Your plan allows a maximum of ${planLimits.max_car_listings} car listings. You currently have ${currentCount} listings. Please upgrade your plan to add more listings.`, 
        onConfirm: () => {} 
      });
      return;
    }
    
    setForm((prevForm) => ({
      ...prevForm,
      carListings: [
        ...prevForm.carListings,
        {
          id: generateUUID(),
          title: '',
          price: '',
          year: '',
          mileage: '',
          condition: '',
          description: '',
          images: [],
          _isNew: true,
          _isDeleted: false,
          _isHiding: false,
        },
      ],
    }));
  };

  // Implemented hard delete with confirmation for car listings
  const removeCarListing = (index: number) => {
    setDeleteModal({ isOpen: true, type: 'car', index });
  };

  const handleRetailItemChange = (index: number, field: string, value: string | FileList | null) => {
    setForm((prevForm) => {
      const updatedItems = [...prevForm.retailItems];
      let updatedItem = { ...updatedItems[index] };

      if (field === 'images') {
        const newFiles = Array.from(value as FileList || []);
        const currentImages = updatedItem.images || [];
        const newTotal = currentImages.length + newFiles.length;

        const maxRetailImages = Math.max(1, planLimits.max_gallery_images || 0);
        if (newTotal > maxRetailImages) {
          setModal({ isOpen: true, title: 'Upload Limit Exceeded', message: `Your plan allows a maximum of ${maxRetailImages} images per retail item. You are trying to add ${newFiles.length} new images, which would exceed the limit.`, onConfirm: () => {} });
          return prevForm;
        }

        // Create new image objects with unique IDs and previews
        const newImageObjects: ImageFileObject[] = newFiles.map(file => ({
          id: generateUUID(),
          file,
          preview: URL.createObjectURL(file),
          isNew: true
        }));

        // Filter out any existing images that are not files (i.e., they are URLs)
        const existingImages = currentImages.filter((img: ImageFileObject) => !img.isNew);
        
        // Combine existing images with new ones
        updatedItem.images = [...existingImages, ...newImageObjects];
      } else {
        (updatedItem as any)[field] = value; // Type assertion for dynamic field update
      }
      updatedItems[index] = updatedItem;
      return { ...prevForm, retailItems: updatedItems };
    });
  };

  const removeRetailItemImage = (itemIndex: number, imageIdToRemove: string) => {
    setForm((prevForm) => {
      const updatedItems = [...prevForm.retailItems];
      const updatedImages = updatedItems[itemIndex].images.filter((img: ImageFileObject) => img.id !== imageIdToRemove);
      updatedItems[itemIndex] = { ...updatedItems[itemIndex], images: updatedImages };
      return { ...prevForm, retailItems: updatedItems };
    });
  };

  const addRetailItem = () => {
    const currentCount = form.retailItems.length;
    if (currentCount >= planLimits.max_retail_items) {
      setModal({ 
        isOpen: true, 
        title: 'Plan Limit Reached', 
        message: `Your plan allows a maximum of ${planLimits.max_retail_items} retail items. You currently have ${currentCount} items. Please upgrade your plan to add more items.`, 
        onConfirm: () => {} 
      });
      return;
    }
    
    setForm((prevForm) => ({
      ...prevForm,
      retailItems: [
        ...prevForm.retailItems,
        {
          id: generateUUID(),
          name: '',
          price: '',
          description: '',
          images: [],
          category: '', // Initialize category for retail item
          _isNew: true,
          _isDeleted: false,
          _isHiding: false,
        },
      ],
    }));
  };

  // Implemented hard delete with confirmation for retail items
  const removeRetailItem = (index: number) => {
    setDeleteModal({ isOpen: true, type: 'retail', index });
  };

  const handleDragEnd = (event: any, listType: 'menu' | 'carListings' | 'retailItems') => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setForm((prevForm) => {
        const currentList = [...prevForm[listType]];
        const oldIndex = currentList.findIndex((item: any) => item.id === active.id);
        const newIndex = currentList.findIndex((item: any) => item.id === over.id);
        const [movedItem] = currentList.splice(oldIndex, 1);
        currentList.splice(newIndex, 0, movedItem);
        return { ...prevForm, [listType]: currentList };
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setIsSaving(true);

    if (!businessId) {
      setModal({ isOpen: true, title: 'Error', message: 'Business ID is missing. Cannot save.', onConfirm: () => {} });
      setIsSaving(false);
      setSubmitting(false);
      return;
    }
    if (form.description.length > 120) {
      setModal({
        isOpen: true,
        title: 'Description Too Long',
        message: 'Please keep the business description at 120 characters or less.',
        onConfirm: () => {},
      });
      setIsSaving(false);
      setSubmitting(false);
      return;
    }

    try {
      // 1. Upload Logo if changed
      let uploadedLogoUrl = form._logoUrl;
      if (form.logo && form.logo instanceof File) {
        console.log('Uploading new logo...');
        uploadedLogoUrl = await uploadFile(form.logo, 'logo');
        console.log('New logo uploaded:', uploadedLogoUrl);
      }

      // 2. Upload new Gallery Images and combine with existing
      console.log('Processing gallery images...');
      // Filter out any images that are not files (i.e., they are existing URLs)
      const newGalleryImageFiles = (form.images || []).filter((img: ImageFileObject) => img.file instanceof File);
      const uploadedNewGalleryImageUrls = await Promise.all(
        newGalleryImageFiles.map(async (img: ImageFileObject) => await uploadFile(img.file as File, 'gallery'))
      );
      console.log('New gallery images uploaded:', uploadedNewGalleryImageUrls);

      // Combine existing gallery URLs (from _galleryUrls) with newly uploaded ones
      const finalGalleryUrls = [
          ...form._galleryUrls.filter((url: string) => typeof url === 'string'), // Ensure only string URLs from initial fetch
          ...uploadedNewGalleryImageUrls
      ].filter((url: string | null) => url !== null); // Filter out any nulls

      console.log('Final gallery URLs:', finalGalleryUrls);


      const updateData: any = {
        business_name: form.business_name,
        description: form.description,
        category: form.category,
        phone: form.phone,
        email: form.email,
        whatsapp: form.whatsapp,
        website: form.website,
        address: form.address,
        facebook: form.facebook,
        instagram: form.instagram,
        twitter: form.twitter,
        tiktok: form.tiktok,
        hours: JSON.stringify(form.hours),
        logo_url: uploadedLogoUrl,
        images: finalGalleryUrls,
        slug: form.slug,
      };

      console.log('Updating main business entry with data:', updateData);
      const { error: updateBusinessError } = await supabase
        .from('businesses')
        .update(updateData)
        .eq('id', businessId);

      if (updateBusinessError) {
        console.error('Failed to update business:', updateBusinessError);
        setModal({ isOpen: true, title: 'Update Error', message: `Failed to update business: ${updateBusinessError.message}`, onConfirm: () => {} });
        setIsSaving(false);
        setSubmitting(false);
        return;
      }
      console.log('Main business entry updated successfully.');


      // 3. Handle Menu Items (separate 'menu_items' table)
      if (form.category === 'Restaurant') {
        const menuItemsToProcess = form.menu || [];
        console.log('Processing menu items for Restaurant category:', menuItemsToProcess);

        // Fetch existing item IDs from DB to determine what to delete
        const { data: existingMenuItems, error: fetchExistingMenuError } = await supabase
          .from('menu_items')
          .select('id')
          .eq('business_id', businessId);

        if (fetchExistingMenuError) {
          console.error('Error fetching existing menu items for deletion check:', fetchExistingMenuError);
          throw new Error(`Failed to check existing menu items: ${fetchExistingMenuError.message}`);
        }

        const existingMenuItemIds = new Set(existingMenuItems.map(item => item.id));
        const currentMenuItemIds = new Set(menuItemsToProcess.map((item: MenuItem) => item.id));

        const idsToDelete = Array.from(existingMenuItemIds).filter(id => !currentMenuItemIds.has(id));

        if (idsToDelete.length > 0) {
          console.log('Menu items to delete from DB:', idsToDelete);
          const { error: deleteError } = await supabase
            .from('menu_items')
            .delete()
            .in('id', idsToDelete); // Use .in for multiple deletions
          if (deleteError) {
            console.error('Error deleting menu items:', deleteError);
            throw new Error(`Failed to delete menu items: ${deleteError.message}`);
          } else {
            console.log('Successfully deleted menu items:', idsToDelete);
          }
        }


        const upsertMenuPromises = menuItemsToProcess.map(async (item: MenuItem) => {
          const menuItemId = item.id;
          console.log(`Processing menu item ${item._isNew ? 'new' : 'existing'}:`, menuItemId, item.name);

          const existingImagePaths = item.images
            .filter((img: ImageFileObject) => !img.isNew)
            .map((img: ImageFileObject) => extractStoragePath(img.preview, ['restaurant_menu', 'restaurant-menu']))
            .filter(Boolean);

          const newImageFiles = item.images
            .filter((img: ImageFileObject) => img.file instanceof File)
            .map((img: ImageFileObject) => img.file as File);

          const uploadedPaths = await uploadMenuItemImages(newImageFiles, menuItemId, existingImagePaths.length);
          const finalImagePaths = [...existingImagePaths, ...uploadedPaths];

          const menuItemData: { [key: string]: any } = {
            business_id: businessId,
            name: item.name || '',
            description: item.description || '',
            price: parseFloat(normalizeNumberString(item.price)) || 0,
            image_url: finalImagePaths[0] || null, // Keep first image for legacy display
            category: item.category || '',
          };

          if (item._isNew) {
            menuItemData.id = menuItemId;
            menuItemData.created_at = new Date().toISOString();
            console.log('Inserting new menu item data:', menuItemData);
            const { error: insertError } = await supabase.from('menu_items').insert([menuItemData]);
            if (insertError) {
              console.error('Error inserting new menu item:', insertError);
              throw new Error(`Failed to insert new menu item: ${insertError.message}`);
            } else {
              console.log('Successfully inserted new menu item:', menuItemId);
            }
          } else {
            console.log('Updating existing menu item data:', menuItemData, 'for ID:', item.id);
            if (item.id) {
              const { error: updateError } = await supabase.from('menu_items').update(menuItemData).eq('id', item.id);
              if (updateError) {
                console.error('Error updating menu item:', updateError);
                throw new Error(`Failed to update menu item: ${updateError.message}`);
              } else {
                console.log('Successfully updated menu item:', item.id);
              }
            }
          }

          const { error: deletePhotosError } = await supabase
            .from('menu_item_photos')
            .delete()
            .eq('menu_item_id', menuItemId);

          if (deletePhotosError) {
            throw new Error(`Failed to reset menu item photos: ${deletePhotosError.message}`);
          }

          if (finalImagePaths.length > 0) {
            const photoRows = finalImagePaths.map((path, idx) => ({
              menu_item_id: menuItemId,
              storage_path: path,
              sort_order: idx,
            }));
            const { error: insertPhotosError } = await supabase.from('menu_item_photos').insert(photoRows);
            if (insertPhotosError) {
              throw new Error(`Failed to save menu item photos: ${insertPhotosError.message}`);
            }
          }
        });
        await Promise.all(upsertMenuPromises);
        console.log('All menu items processed.');
      } else if (isRetailCategory(form.category)) {
        const retailItemsToProcess = form.retailItems || [];
        console.log('Processing retail items:', retailItemsToProcess);

        // Fetch existing item IDs from DB to determine what to delete
        const { data: existingRetailItems, error: fetchExistingRetailError } = await supabase
          .from('retail_items')
          .select('id')
          .eq('business_id', businessId);

        if (fetchExistingRetailError) {
          console.error('Error fetching existing retail items for deletion check:', fetchExistingRetailError);
          throw new Error(`Failed to check existing retail items: ${fetchExistingRetailError.message}`);
        }

        const existingRetailItemIds = new Set(existingRetailItems.map(item => item.id));
        const currentRetailItemIds = new Set(retailItemsToProcess.map((item: RetailItem) => item.id));

        const idsToDelete = Array.from(existingRetailItemIds).filter(id => !currentRetailItemIds.has(id));

        if (idsToDelete.length > 0) {
          console.log('Retail items to delete from DB:', idsToDelete);
          const { error: deleteError } = await supabase
            .from('retail_items')
            .delete()
            .in('id', idsToDelete);
          if (deleteError) {
            console.error('Error deleting retail items:', deleteError);
            throw new Error(`Failed to delete retail items: ${deleteError.message}`);
          } else {
            console.log('Successfully deleted retail items:', idsToDelete);
          }

          const { error: deleteRetailPhotosError } = await supabase
            .from('retail_item_photos')
            .delete()
            .in('retail_item_id', idsToDelete);
          if (deleteRetailPhotosError) {
            console.error('Error deleting retail item photos:', deleteRetailPhotosError);
            throw new Error(`Failed to delete retail item photos: ${deleteRetailPhotosError.message}`);
          }
        }

        const upsertRetailPromises = retailItemsToProcess.map(async (item: RetailItem) => {
          const retailItemId = item.id;
          console.log(`Processing retail item ${item._isNew ? 'new' : 'existing'}:`, retailItemId, item.name);

          const existingImagePaths = item.images
            .filter((img: ImageFileObject) => !img.isNew)
            .map((img: ImageFileObject) => extractStoragePath(img.preview, ['retail-items', 'retail_items']))
            .filter(Boolean);

          const newImageFiles = item.images
            .filter((img: ImageFileObject) => img.file instanceof File)
            .map((img: ImageFileObject) => img.file as File);

          const uploadedPaths = await uploadRetailItemImages(newImageFiles, retailItemId, existingImagePaths.length);
          const finalImagePaths = [...existingImagePaths, ...uploadedPaths];

          const retailItemData: { [key: string]: any } = {
            business_id: businessId,
            name: item.name || '',
            description: item.description || '',
            price: parseFloat(normalizeNumberString(item.price)) || 0,
            category: item.category || '',
            images: finalImagePaths, // Store storage paths in the 'images' array
          };

          if (item._isNew) {
            retailItemData.id = retailItemId;
            retailItemData.created_at = new Date().toISOString();
            console.log('Inserting new retail item data:', retailItemData);
            const { error: insertError } = await supabase.from('retail_items').insert([retailItemData]);
            if (insertError) {
              console.error('Error inserting new retail item:', insertError);
              throw new Error(`Failed to insert new retail item: ${insertError.message}`);
            } else {
              console.log('Successfully inserted new retail item:', retailItemId);
            }
          } else {
            console.log('Updating existing retail item data:', retailItemData, 'for ID:', item.id);
            if (item.id) {
              const { error: updateError } = await supabase.from('retail_items').update(retailItemData).eq('id', item.id);
              if (updateError) {
                console.error('Error updating retail item:', updateError);
                throw new Error(`Failed to update retail item: ${updateError.message}`);
              } else {
                console.log('Successfully updated retail item:', item.id);
              }
            }
          }

          const { error: deleteRetailPhotosError } = await supabase
            .from('retail_item_photos')
            .delete()
            .eq('retail_item_id', retailItemId);

          if (deleteRetailPhotosError) {
            throw new Error(`Failed to reset retail item photos: ${deleteRetailPhotosError.message}`);
          }

          if (finalImagePaths.length > 0) {
            const photoRows = finalImagePaths.map((path, idx) => ({
              retail_item_id: retailItemId,
              storage_path: path,
              sort_order: idx,
            }));
            const { error: insertRetailPhotosError } = await supabase.from('retail_item_photos').insert(photoRows);
            if (insertRetailPhotosError) {
              throw new Error(`Failed to save retail item photos: ${insertRetailPhotosError.message}`);
            }
          }
        });
        await Promise.all(upsertRetailPromises);
        console.log('All retail items processed.');
      } else if (form.category === 'Car Dealership') {
        const carListingsToProcess = form.carListings || [];
        console.log('Processing car listings:', carListingsToProcess);

        // Fetch existing item IDs from DB to determine what to delete
        const { data: existingCarListings, error: fetchExistingCarError } = await supabase
          .from('dealerships')
          .select('id')
          .eq('business_id', businessId);

        if (fetchExistingCarError) {
          console.error('Error fetching existing car listings for deletion check:', fetchExistingCarError);
          throw new Error(`Failed to check existing car listings: ${fetchExistingCarError.message}`);
        }

        const existingCarListingIds = new Set(existingCarListings.map(item => item.id));
        const currentCarListingIds = new Set(carListingsToProcess.map((item: CarListingItem) => item.id));

        const idsToDelete = Array.from(existingCarListingIds).filter(id => !currentCarListingIds.has(id));

        if (idsToDelete.length > 0) {
          console.log('Car listings to delete from DB:', idsToDelete);
          const { error: deleteError } = await supabase
            .from('dealerships')
            .delete()
            .in('id', idsToDelete);
          if (deleteError) {
            console.error('Error deleting car listings:', deleteError);
            throw new Error(`Failed to delete car listings: ${deleteError.message}`);
          } else {
            console.log('Successfully deleted car listings:', idsToDelete);
          }
        }

        const upsertCarPromises = carListingsToProcess.map(async (item: CarListingItem) => {
          const carListingId = item.id;
          console.log(`Processing car listing ${item._isNew ? 'new' : 'existing'}:`, carListingId, item.title);

          const newImageFiles = item.images.filter((img: ImageFileObject) => img.file instanceof File);
          const uploadedNewImagesUrls = await Promise.all(
            newImageFiles.map(async (img: ImageFileObject) => await uploadFile(img.file as File, 'car_listing', carListingId))
          );

          // Get existing image URLs (not new uploads)
          const existingImageUrls = item.images
            .filter((img: ImageFileObject) => !img.isNew)
            .map((img: ImageFileObject) => img.preview)
            .filter(Boolean);

          // Combine existing and new image URLs
          const finalImageUrls = [...existingImageUrls, ...uploadedNewImagesUrls];

          const carListingData: { [key: string]: any } = {
            business_id: businessId,
            title: item.title || '',
            price: parseFloat(normalizeNumberString(item.price)) || 0,
            year: parseInt(normalizeNumberString(item.year), 10) || null,
            mileage: parseFloat(normalizeNumberString(item.mileage)) || null,
            condition: item.condition || '',
            description: item.description || '',
            images: finalImageUrls, // Store all images in the 'images' array
          };

          if (item._isNew) {
            carListingData.id = carListingId;
            carListingData.created_at = new Date().toISOString();
            console.log('Inserting new car listing data:', carListingData);
            const { error: insertError } = await supabase.from('dealerships').insert([carListingData]);
            if (insertError) {
              console.error('Error inserting new car listing:', insertError);
              throw new Error(`Failed to insert new car listing: ${insertError.message}`);
            } else {
              console.log('Successfully inserted new car listing:', carListingId);
            }
          } else {
            console.log('Updating existing car listing data:', carListingData, 'for ID:', item.id);
            if (item.id) {
              const { error: updateError } = await supabase.from('dealerships').update(carListingData).eq('id', item.id);
              if (updateError) {
                console.error('Error updating car listing:', updateError);
                throw new Error(`Failed to update car listing: ${updateError.message}`);
              } else {
                console.log('Successfully updated car listing:', item.id);
              }
            }
          }
        });
        await Promise.all(upsertCarPromises);
        console.log('All car listings processed.');
      } else {
        // If category is not Restaurant, Retail, or Car Dealership, clear associated items
        if (businessId) {
          console.log('Category changed, clearing associated dynamic items for businessId:', businessId);
          // Clear menu items
          const { error: deleteMenuItemsError } = await supabase
            .from('menu_items')
            .delete()
            .eq('business_id', businessId);
          if (deleteMenuItemsError) console.error('Error clearing menu items:', deleteMenuItemsError);
          else console.log('Successfully cleared all menu items for businessId:', businessId);

          // Clear retail items
          const { error: deleteRetailItemsError } = await supabase
            .from('retail_items')
            .delete()
            .eq('business_id', businessId);
          if (deleteRetailItemsError) console.error('Error clearing retail items:', deleteRetailItemsError);
          else console.log('Successfully cleared all retail items for businessId:', businessId);

          // Clear dealership items
          const { error: deleteDealershipItemsError } = await supabase
            .from('dealerships')
            .delete()
            .eq('business_id', businessId);
          if (deleteDealershipItemsError) console.error('Error clearing dealership items:', deleteDealershipItemsError);
          else console.log('Successfully cleared all dealership items for businessId:', businessId);
        }
      }

      router.push(`/business/${slug}`);
    } catch (error: any) {
      console.error('Submission error:', error);
      setModal({ isOpen: true, title: 'Error', message: error.message || 'An unexpected error occurred during submission.', onConfirm: () => {} });
    } finally {
      setIsSaving(false);
      setSubmitting(false);
    }
  };

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'menu' | 'car' | 'retail';
    index: number;
  }>({ isOpen: false, type: 'menu', index: -1 });

  const handleDeleteConfirm = async () => {
    try {
      switch (deleteModal.type) {
        case 'menu': {
          const item = form.menu[deleteModal.index];
          if (!item._isNew) {
            // Delete from database
            const { error } = await supabase
              .from('menu_items')
              .delete()
              .eq('id', item.id);
            
            if (error) {
              console.error('Menu item delete error:', error);
              throw error;
            }
          }
          // Remove from form state
          setForm((prevForm) => {
            const updatedMenu = [...prevForm.menu];
            updatedMenu.splice(deleteModal.index, 1);
            return { ...prevForm, menu: updatedMenu };
          });
          break;
        }
        case 'car': {
          const item = form.carListings[deleteModal.index];
          if (!item._isNew) {
            // Delete from database
            const { error } = await supabase
              .from('dealerships')
              .delete()
              .eq('id', item.id);
            
            if (error) {
              console.error('Car listing delete error:', error);
              throw error;
            }
          }
          // Remove from form state
          setForm((prevForm) => {
            const updatedListings = [...prevForm.carListings];
            updatedListings.splice(deleteModal.index, 1);
            return { ...prevForm, carListings: updatedListings };
          });
          break;
        }
        case 'retail': {
          const item = form.retailItems[deleteModal.index];
          if (!item._isNew) {
            // Delete from database
            const { error } = await supabase
              .from('retail_items')
              .delete()
              .eq('id', item.id);
            
            if (error) {
              console.error('Retail item delete error:', error);
              throw error;
            }
          }
          // Remove from form state
          setForm((prevForm) => {
            const updatedItems = [...prevForm.retailItems];
            updatedItems.splice(deleteModal.index, 1);
            return { ...prevForm, retailItems: updatedItems };
          });
          break;
        }
      }
    } catch (error: any) {
      console.error('Error deleting item:', error);
      setModal({ isOpen: true, title: 'Deletion Error', message: error.message || 'An error occurred during deletion.', onConfirm: () => {} });
    } finally {
      setDeleteModal({ isOpen: false, type: 'menu', index: -1 });
    }
  };

  if (!form.business_name && !businessId && !authReady) { // More robust check for loading
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <div className="text-xl font-semibold">Loading business data...</div>
      </div>
    );
  }

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const descriptionLimit = 120;
  const descriptionCount = form.description.length;
  const isDescriptionTooLong = descriptionCount > descriptionLimit;

  // Combine existing and new gallery images for display, ensuring unique 'id' for each image object
  const combinedGalleryImages: ImageFileObject[] = [
    ...(form._galleryUrls || []).map((url: string) => ({ id: url, preview: url, file: null, isNew: false })),
    ...(form.images || []).map((img: ImageFileObject) => ({ id: img.id, preview: img.preview, file: img.file, isNew: img.isNew })),
  ];


  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 sm:p-6 lg:p-8 font-inter">
      <CustomModal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        onClose={() => setModal({ isOpen: false, title: '', message: '', onConfirm: () => {} })}
        onConfirm={() => {}} // No confirm action for simple info modal
      />

      <CustomModal
        isOpen={categoryChangeModal.isOpen}
        title="Change business category?"
        message="Changing your category will clear any items that don't belong to the new category. Are you sure you want to continue?"
        onClose={() => setCategoryChangeModal({ isOpen: false, nextValue: '' })}
        onConfirm={() => {
          applyCategoryChange(categoryChangeModal.nextValue);
          setCategoryChangeModal({ isOpen: false, nextValue: '' });
        }}
        backdropClassName="backdrop-blur-sm"
      />

      <CustomModal
        isOpen={deleteModal.isOpen}
        title="Confirm Deletion"
        message="Are you sure you want to delete this item?"
        onClose={() => setDeleteModal({ isOpen: false, type: 'menu', index: -1 })}
        onConfirm={handleDeleteConfirm}
      />

      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-blue-600 dark:text-blue-400">Edit Business Details</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Plan Status Section */}
          {planStatus.plan && (
            <section className="p-6 border-2 border-blue-200 dark:border-blue-700 rounded-lg shadow-sm bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                    <Package size={24} className="text-blue-600 dark:text-blue-400" />
                    Current Plan: <span className="text-blue-600 dark:text-blue-400 capitalize">{planStatus.plan}</span>
                  </h2>
                  {planStatus.plan_expires_at && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Expires: <span className="font-medium">{new Date(planStatus.plan_expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/business/plan')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 text-sm font-medium"
                >
                  Upgrade Plan
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Gallery Images</div>
                  <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    {combinedGalleryImages.length} / {planLimits.max_gallery_images}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Menu Items</div>
                  <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    {form.menu.length} / {planLimits.max_menu_items}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Retail Items</div>
                  <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    {form.retailItems.length} / {planLimits.max_retail_items}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Car Listings</div>
                  <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    {form.carListings.length} / {planLimits.max_car_listings}
                  </div>
                </div>
              </div>
              
              {/* Plan Features */}
              <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Plan Features:</div>
                <div className="flex flex-wrap gap-3">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${
                    planFeatures.allow_social_links 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {planFeatures.allow_social_links ? '✓' : '✗'} Social Links
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${
                    planFeatures.allow_whatsapp 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {planFeatures.allow_whatsapp ? '✓' : '✗'} WhatsApp
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${
                    planFeatures.allow_promoted 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {planFeatures.allow_promoted ? '✓' : '✗'} Promoted
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${
                    planFeatures.allow_qr 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {planFeatures.allow_qr ? '✓' : '✗'} QR Code
                  </div>
                  {planStatus.plan && planStatus.plan !== 'free' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                      ✓ Custom Website Link
                    </div>
                  )}
                  {planStatus.plan && (planStatus.plan === 'growth' || planStatus.plan === 'premium') && (
                    <>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                        ✓ Customer Notifications
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                        ✓ Business Analytics
                      </div>
                    </>
                  )}
                  {planStatus.plan && planStatus.plan === 'premium' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                      ✓ Advertising & Promotion
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* General Business Information */}
          <section className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm space-y-4">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Basic Information</h2>
            <FormInput
              name="business_name"
              value={form.business_name}
              onChange={handleChange}
              placeholder="Business Name"
              icon={Building}
            />
            <FormTextarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="A brief description of your business"
              rows={3}
              icon={Info}
            />
            <div className="flex items-center justify-between text-xs">
              <span className={isDescriptionTooLong ? 'text-red-600' : 'text-gray-500 dark:text-gray-400'}>
                {descriptionCount}/{descriptionLimit}
              </span>
              {isDescriptionTooLong && (
                <span className="text-red-600">Description exceeds 120 characters.</span>
              )}
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business Category</label>
              <div className="relative">
                <select
                  id="category"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 pr-10"
                >
                  <option value="" disabled>Select a category</option>
                  {businessTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
            </div>
          </section>

          {/* Contact Information */}
          <section className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm space-y-4">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Contact Information</h2>
            <FormInput name="phone" value={form.phone} onChange={handleChange} placeholder="Phone Number" type="tel" icon={Phone} />
            <FormInput name="email" value={form.email} onChange={handleChange} placeholder="Email Address" type="email" icon={Mail} />
            {planFeatures.allow_whatsapp ? (
              <FormInput name="whatsapp" value={form.whatsapp} onChange={handleChange} placeholder="WhatsApp Number (optional)" type="tel" icon={MessageSquare} />
            ) : (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                  <Info size={18} />
                  <span className="text-sm font-medium">WhatsApp is not available on your current plan. Upgrade to enable this feature.</span>
                </div>
              </div>
            )}
            <FormInput name="website" value={form.website} onChange={handleChange} placeholder="Website URL" type="url" icon={ExternalLink} />
          </section>

          {/* Address */}
          <section className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm space-y-4">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Address</h2>
            <FormInput name="address.street" value={form.address.street} onChange={handleChange} placeholder="Street Address" icon={MapPin} />
            <FormInput name="address.city" value={form.address.city} onChange={handleChange} placeholder="City" />
            <FormInput name="address.state" value={form.address.state} onChange={handleChange} placeholder="State/Province" />
            <FormInput name="address.zip" value={form.address.zip} onChange={handleChange} placeholder="Zip/Postal Code" />
            {/* Added country to address for consistency */}
            <FormInput name="address.country" value={form.address.country} onChange={handleChange} placeholder="Country" />
          </section>

          {/* Social Media */}
          {planFeatures.allow_social_links ? (
            <section className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Social Media</h2>
              <FormInput name="facebook" value={form.facebook} onChange={handleChange} placeholder="Facebook Profile URL" icon={Facebook} />
              <FormInput name="instagram" value={form.instagram} onChange={handleChange} placeholder="Instagram Profile URL" icon={Instagram} />
              <FormInput name="twitter" value={form.twitter} onChange={handleChange} placeholder="Twitter/X Profile URL" icon={Twitter} />
              <FormInput name="tiktok" value={form.tiktok} onChange={handleChange} placeholder="TikTok Profile URL" icon={Video} />
            </section>
          ) : (
            <section className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Social Media</h2>
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                  <Info size={18} />
                  <span className="text-sm font-medium">Social media links are not available on your current plan. Upgrade to enable this feature.</span>
                </div>
              </div>
            </section>
          )}

          {/* Business Hours */}
          <section className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm space-y-4">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Business Hours</h2>
            {daysOfWeek.map(day => (
              <div key={day} className="grid grid-cols-2 gap-4 items-center">
                <label className="text-gray-700 dark:text-gray-300 font-medium flex items-center">
                  <ClockIcon size={18} className="mr-2 text-gray-500" />
                  {day}
                </label>
                <FormInput
                  name={`hours.${day.toLowerCase()}`}
                  value={(form.hours as any)[day.toLowerCase()] || ''} // Type assertion for dynamic access
                  onChange={handleChange}
                  placeholder="e.g., 9:00 AM - 5:00 PM or Closed"
                  type="text"
                />
              </div>
            ))}
          </section>

          {/* Logo Upload */}
          <section className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm space-y-4">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Business Logo</h2>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              ref={fileInputRef} 
              className="block w-full text-sm text-gray-900 dark:text-gray-100
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100 transition duration-200
                dark:file:bg-blue-900 dark:file:text-blue-200 dark:hover:file:bg-blue-800"
            />
            {logoPreview && (
              <div className="mt-4 flex items-center space-x-4">
                <img src={logoPreview} alt="Logo Preview" className="w-24 h-24 object-contain rounded-md border border-gray-300 dark:border-gray-600 p-1" />
                <button
                  type="button"
                  onClick={() => {
                    setLogoPreview(null);
                    setForm((prevForm) => ({ ...prevForm, logo: null, _logoUrl: null }));
                    // Safely clear file input value
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors duration-200"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            )}
          </section>

          {/* Gallery Images Upload */}
          <section className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm space-y-4">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Gallery Images (Max {planLimits.max_gallery_images})
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                ({combinedGalleryImages.length} / {planLimits.max_gallery_images})
              </span>
            </h2>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleGalleryChange}
              className="block w-full text-sm text-gray-900 dark:text-gray-100
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100 transition duration-200
                dark:file:bg-blue-900 dark:file:text-blue-200 dark:hover:file:bg-blue-800"
            />
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {combinedGalleryImages.map((img: ImageFileObject, index: number) => (
                <div key={img.id} className="relative group w-full h-24 sm:h-32 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                  <img
                    src={img.preview}
                    alt={`Gallery Image ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'https://placehold.co/300x200/cccccc/333333?text=Image+Not+Found';
                      e.currentTarget.onerror = null;
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeGalleryImage(index, img.isNew)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    title="Remove image"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Dynamic Sections based on Category */}
          {form.category === 'Restaurant' && (
            <section className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex justify-between items-center">
                <span>
                  Restaurant Menu Items
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                    ({form.menu.length} / {planLimits.max_menu_items})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={addMenuItem}
                  disabled={form.menu.length >= planLimits.max_menu_items}
                  className={`px-3 py-1 rounded-md transition-colors duration-200 flex items-center text-sm ${
                    form.menu.length >= planLimits.max_menu_items
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  <Plus size={16} className="mr-1" /> Add Menu Item
                </button>
              </h2>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => handleDragEnd(event, 'menu')}>
                <SortableContext items={form.menu.map((item: MenuItem) => item.id)} strategy={verticalListSortingStrategy}>
                  {form.menu.length === 0 && (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">No menu items added yet.</p>
                  )}
                  {form.menu.map((item: MenuItem, index: number) => (
                    <SortableItem key={item.id} id={item.id}>
                      <div className={`relative p-4 border rounded-lg mb-4 shadow-sm transition-all duration-300
                          ${item._isHiding ? 'opacity-50 blur-sm pointer-events-none' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'}`}>
                        {!item._isHiding ? (
                          <div>
                            <button
                              type="button"
                              onClick={() => removeMenuItem(index)}
                              className="absolute top-2 right-2 p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors duration-200 z-10"
                              title="Remove menu item"
                            >
                              <X size={24} />
                            </button>
                            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">Menu Item #{index + 1}</h3>
                            <FormInput
                              name="name"
                              value={item.name}
                              onChange={(e) => handleMenuItemChange(index, 'name', e.target.value)}
                              placeholder="Item Name"
                              icon={Text}
                            />
                            <FormTextarea
                              name="description"
                              value={item.description}
                              onChange={(e) => handleMenuItemChange(index, 'description', e.target.value)}
                              placeholder="Item Description"
                              rows={3}
                              icon={Info}
                            />
                            <FormInput
                              name="price"
                              value={formatCurrencyDisplay(item.price)}
                              onChange={(e) => handleMenuItemChange(index, 'price', normalizeNumericInput(e.target.value, true))}
                              placeholder="Price"
                              type="text" // Keep as text to allow flexible input like "10.99"
                              icon={DollarSign}
                            />
                            <FormInput
                              name="category"
                              value={item.category}
                              onChange={(e) => handleMenuItemChange(index, 'category', e.target.value)}
                              placeholder="Menu Category (e.g., Appetizer, Main Course)"
                              icon={Tag}
                            />
                            <div className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                              <p className="line-clamp-2">{item.description}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Item Images (Max 8)</label>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => handleMenuItemChange(index, 'images', e.target.files)}
                                className="block w-full text-sm text-gray-900 dark:text-gray-100
                                  file:mr-4 file:py-2 file:px-4
                                  file:rounded-md file:border-0
                                  file:text-sm file:font-semibold
                                  file:bg-blue-50 file:text-blue-700
                                  hover:file:bg-blue-100 transition duration-200
                                  dark:file:bg-blue-900 dark:file:text-blue-200 dark:hover:file:bg-blue-800"
                              />
                              <div className="mt-3 flex flex-wrap gap-2">
                                {item.images && item.images.map((img: ImageFileObject) => (
                                  <div key={img.id} className="relative group w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden">
                                    <img
                                      src={getImageUrl(img, 'menu_item')}
                                      alt={`Item Image ${img.id}`}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.src = 'https://placehold.co/300x200/cccccc/333333?text=Image+Not+Found';
                                        e.currentTarget.onerror = null;
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeMenuItemImage(index, img.id)}
                                      className="absolute top-0 right-0 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors duration-200"
                                      title="Remove image"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-red-500 font-semibold">
                            This item is marked for deletion.
                            <button
                              type="button"
                              onClick={() => setForm((prevForm) => {
                                const updatedMenu = [...prevForm.menu];
                                updatedMenu[index] = { ...updatedMenu[index], _isDeleted: false, _isHiding: false };
                                return { ...prevForm, menu: updatedMenu };
                              })}
                              className="ml-2 text-blue-600 hover:underline"
                            >
                              Undo
                            </button>
                          </div>
                        )}
                      </div>
                    </SortableItem>
                  ))}
                </SortableContext>
              </DndContext>
            </section>
          )}

          {form.category === 'Car Dealership' && (
            <section className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex justify-between items-center">
                <span>
                  Car Listings
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                    ({form.carListings.length} / {planLimits.max_car_listings})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={addCarListing}
                  disabled={form.carListings.length >= planLimits.max_car_listings}
                  className={`px-3 py-1 rounded-md transition-colors duration-200 flex items-center text-sm ${
                    form.carListings.length >= planLimits.max_car_listings
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  <Plus size={16} className="mr-1" /> Add Car Listing
                </button>
              </h2>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => handleDragEnd(event, 'carListings')}>
                <SortableContext items={form.carListings.map((item: CarListingItem) => item.id)} strategy={verticalListSortingStrategy}>
                  {form.carListings.length === 0 && (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">No car listings added yet.</p>
                  )}
                  {form.carListings.map((item: CarListingItem, index: number) => (
                    <SortableItem key={item.id} id={item.id}>
                      <div className={`relative p-4 border rounded-lg mb-4 shadow-sm transition-all duration-300
                          ${item._isHiding ? 'opacity-50 blur-sm pointer-events-none' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'}`}>
                        {!item._isHiding ? (
                          <>
                            <button
                              type="button"
                              onClick={() => removeCarListing(index)}
                              className="absolute top-2 right-2 p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors duration-200 z-10"
                              title="Remove car listing"
                            >
                              <X size={24} />
                            </button>
                            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">Car #{index + 1}</h3>
                            <FormInput
                              name="title"
                              value={item.title}
                              onChange={(e) => handleCarListingChange(index, 'title', e.target.value)}
                              placeholder="Make & Model (e.g., Honda Civic)"
                              icon={CarIcon}
                            />
                            <FormInput
                              name="price"
                              value={formatCurrencyDisplay(item.price)}
                              onChange={(e) => handleCarListingChange(index, 'price', normalizeNumericInput(e.target.value, true))}
                              placeholder="Price (e.g., $25,000)"
                              type="text" // Keep as text to allow formatting like "$25,000"
                              icon={DollarIcon}
                            />
                            <FormInput
                              name="year"
                              value={item.year}
                              onChange={(e) => handleCarListingChange(index, 'year', e.target.value)}
                              placeholder="Year"
                              type="number"
                              icon={CalendarIcon}
                            />
                            <FormInput
                              name="mileage"
                              value={formatNumberWithCommas(item.mileage)}
                              onChange={(e) => handleCarListingChange(index, 'mileage', normalizeNumericInput(e.target.value, false))}
                              placeholder="Mileage (e.g., 50,000 miles)"
                              type="text" // Keep as text to allow formatting like "50,000 miles"
                              icon={Gauge}
                            />
                            <FormInput
                              name="condition"
                              value={item.condition}
                              onChange={(e) => handleCarListingChange(index, 'condition', e.target.value)}
                              placeholder="Condition (e.g., Used, New, Excellent)"
                              icon={Wrench}
                            />
                            <FormTextarea
                              name="description"
                              value={item.description}
                              onChange={(e) => handleCarListingChange(index, 'description', e.target.value)}
                              placeholder="Full vehicle description"
                              rows={3}
                              icon={Info}
                            />
                            <div className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                              <p className="line-clamp-2">{item.description}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Car Images (Max 8)</label>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => handleCarListingChange(index, 'images', e.target.files)}
                                className="block w-full text-sm text-gray-500
                                  file:mr-4 file:py-2 file:px-4
                                  file:rounded-md file:border-0
                                  file:text-sm file:font-semibold
                                  file:bg-blue-50 file:text-blue-700
                                  hover:file:bg-blue-100"
                              />
                              {item.images && item.images.length > 0 && (
                                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                                  {item.images.map((image: ImageFileObject, imageIndex: number) => (
                                    <div key={image.id || imageIndex} className="relative group">
                                      <img
                                        src={getImageUrl(image, 'car_listing')}
                                        alt={`Car image ${imageIndex + 1}`}
                                        className="w-full h-24 object-cover rounded-lg"
                                        onError={(e) => {
                                          e.currentTarget.src = 'https://placehold.co/300x200/cccccc/333333?text=Image+Not+Found';
                                          e.currentTarget.onerror = null;
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeCarListingImage(index, image.id)}
                                        className="absolute top-1 right-1 p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors duration-200"
                                        title="Remove image"
                                      >
                                        <X size={16} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-8 text-red-500 font-semibold">
                            This item is marked for deletion.
                            <button
                              type="button"
                              onClick={() => setForm((prevForm) => {
                                const updatedListings = [...prevForm.carListings];
                                updatedListings[index] = { ...updatedListings[index], _isDeleted: false, _isHiding: false };
                                return { ...prevForm, carListings: updatedListings };
                              })}
                              className="ml-2 text-blue-600 hover:underline"
                            >
                              Undo
                            </button>
                          </div>
                        )}
                      </div>
                    </SortableItem>
                  ))}
                </SortableContext>
              </DndContext>
            </section>
          )}

          {isRetailCategory(form.category) && (
            <section className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex justify-between items-center">
                <span>
                  Retail Items
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                    ({form.retailItems.length} / {planLimits.max_retail_items})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={addRetailItem}
                  disabled={form.retailItems.length >= planLimits.max_retail_items}
                  className={`px-3 py-1 rounded-md transition-colors duration-200 flex items-center text-sm ${
                    form.retailItems.length >= planLimits.max_retail_items
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  <Plus size={16} className="mr-1" /> Add Retail Item
                </button>
              </h2>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => handleDragEnd(event, 'retailItems')}>
                <SortableContext items={form.retailItems.map((item: RetailItem) => item.id)} strategy={verticalListSortingStrategy}>
                  {form.retailItems.length === 0 && (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">No retail items added yet.</p>
                  )}
                  {form.retailItems.map((item: RetailItem, index: number) => (
                    <SortableItem key={item.id} id={item.id}>
                      <div className={`relative p-4 border rounded-lg mb-4 shadow-sm transition-all duration-300
                          ${item._isHiding ? 'opacity-50 blur-sm pointer-events-none' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'}`}>
                        {!item._isHiding ? (
                          <>
                            <button
                              type="button"
                              onClick={() => removeRetailItem(index)}
                              className="absolute top-2 right-2 p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors duration-200 z-10"
                              title="Remove retail item"
                            >
                              <X size={24} />
                            </button>
                            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">Retail Item #{index + 1}</h3>
                            <FormInput
                              name="name"
                              value={item.name}
                              onChange={(e) => handleRetailItemChange(index, 'name', e.target.value)}
                              placeholder="Product Name"
                              icon={Package}
                            />
                            <FormInput
                              name="price"
                              value={formatCurrencyDisplay(item.price)}
                              onChange={(e) => handleRetailItemChange(index, 'price', normalizeNumericInput(e.target.value, true))}
                              placeholder="Price (e.g., $49.99)"
                              type="text" // Keep as text to allow flexible input like "49.99"
                              icon={DollarIcon}
                            />
                            <FormInput
                              name="category"
                              value={item.category}
                              onChange={(e) => handleRetailItemChange(index, 'category', e.target.value)}
                              placeholder="Product Category (e.g., Electronics, Apparel)"
                              icon={Tag}
                            />
                            <FormTextarea
                              name="description"
                              value={item.description}
                              onChange={(e) => handleRetailItemChange(index, 'description', e.target.value)}
                              placeholder="Product Description"
                              rows={3}
                              icon={Info}
                            />
                            <div className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                              <p className="line-clamp-2">{item.description}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Product Images (Max 8)</label>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => handleRetailItemChange(index, 'images', e.target.files)}
                                className="block w-full text-sm text-gray-900 dark:text-gray-100
                                  file:mr-4 file:py-2 file:px-4
                                  file:rounded-md file:border-0
                                  file:text-sm file:font-semibold
                                  file:bg-blue-50 file:text-blue-700
                                  hover:file:bg-blue-100 transition duration-200
                                  dark:file:bg-blue-900 dark:file:text-blue-200 dark:hover:file:bg-blue-800"
                              />
                              <div className="mt-3 flex flex-wrap gap-2">
                                {item.images && item.images.map((img: ImageFileObject) => (
                                  <div key={img.id} className="relative group w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden">
                                    <img
                                      src={getImageUrl(img, 'retail_item')}
                                      alt={`Retail Image ${img.id}`}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.src = 'https://placehold.co/300x200/cccccc/333333?text=Image+Not+Found';
                                        e.currentTarget.onerror = null;
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeRetailItemImage(index, img.id)}
                                      className="absolute top-0 right-0 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors duration-200"
                                      title="Remove image"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-8 text-red-500 font-semibold">
                            This item is marked for deletion.
                            <button
                              type="button"
                              onClick={() => setForm((prevForm) => {
                                const updatedItems = [...prevForm.retailItems];
                                updatedItems[index] = { ...updatedItems[index], _isDeleted: false, _isHiding: false };
                                return { ...prevForm, retailItems: updatedItems };
                              })}
                              className="ml-2 text-blue-600 hover:underline"
                            >
                              Undo
                            </button>
                          </div>
                        )}
                      </div>
                    </SortableItem>
                  ))}
                </SortableContext>
              </DndContext>
            </section>
          )}

          {/* Submit Button */}
          <div className="flex justify-center">
            <button
              type="submit"
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-300 transform hover:scale-105"
              disabled={isSubmitting}
            >
              {isSaving ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

