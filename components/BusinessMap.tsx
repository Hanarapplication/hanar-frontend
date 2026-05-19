'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BUSINESS_EMBED_MAP_SURFACE_CLASS,
  ensureBusinessMapPinStyles,
} from '@/components/businessMapPinStyles';
import {
  createBusinessPinOverlay,
  type BusinessPinOverlayHandle,
} from '@/components/businessMapPinOverlay';
import { openDirections } from '@/lib/directionsUrl';
import { cn } from '@/lib/utils';
import { Navigation } from 'lucide-react';

const EMBED_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

export interface BusinessMapAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface BusinessMapProps {
  address: BusinessMapAddress;
  /** Flush edge-to-edge styling for business slug embeds (no card padding/shadow). */
  embedded?: boolean;
  className?: string;
  businessId?: string;
  businessName?: string;
  logoUrl?: string | null;
  /** In-map directions control (defaults to on for `embedded` maps). */
  showDirectionsButton?: boolean;
}

const EMBEDDED_MAP_HEIGHT_CLASS =
  'min-h-[200px] h-[min(36vh,280px)] sm:min-h-[220px] sm:h-[min(38vh,300px)]';
const DEFAULT_MAP_HEIGHT_CLASS =
  'min-h-[240px] h-[min(44vh,360px)] sm:min-h-[260px] sm:h-[min(46vh,380px)]';

let mapsScriptPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (mapsScriptPromise) return mapsScriptPromise;

  mapsScriptPromise = new Promise((resolve, reject) => {
    const callbackName = '__hanarGoogleMapsReady';
    (window as unknown as Record<string, () => void>)[callbackName] = () => {
      resolve();
      delete (window as unknown as Record<string, unknown>)[callbackName];
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      mapsScriptPromise = null;
      reject(new Error('Failed to load Google Maps'));
    };
    document.head.appendChild(script);
  });

  return mapsScriptPromise;
}

export default function BusinessMap({
  address,
  embedded = false,
  className,
  businessId,
  businessName,
  logoUrl,
  showDirectionsButton,
}: BusinessMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const pinOverlayRef = useRef<BusinessPinOverlayHandle | null>(null);
  const fullAddress = `${address.street || ''}, ${address.city || ''}, ${address.state || ''} ${address.zip || ''}`.trim();
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const showDirections = showDirectionsButton ?? embedded;
  const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    ensureBusinessMapPinStyles();
  }, []);

  const triggerMapResize = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) return;
    window.google.maps.event.trigger(map, 'resize');
    const center = map.getCenter();
    if (center) map.setCenter(center);
    pinOverlayRef.current?.requestDraw();
  }, []);

  const initMap = useCallback(() => {
    if (!window.google?.maps || !mapRef.current || mapInitialized) return;
    if (!address.street || !address.city || !address.state) {
      setError('Missing complete address information for map.');
      setIsLoaded(true);
      return;
    }

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: fullAddress }, (results, status) => {
      if (status === window.google.maps.GeocoderStatus.OK && results?.length) {
        const location = results[0].geometry.location;
        const map = new window.google.maps.Map(mapRef.current!, {
          center: location,
          zoom: 15,
          mapTypeId: 'roadmap',
          gestureHandling: 'greedy',
          disableDefaultUI: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          zoomControl: false,
          rotateControl: false,
          cameraControl: false,
          scaleControl: false,
          clickableIcons: false,
          keyboardShortcuts: false,
          styles: EMBED_MAP_STYLES,
        });

        pinOverlayRef.current?.setMap(null);
        pinOverlayRef.current = null;

        if (businessName || logoUrl) {
          pinOverlayRef.current = createBusinessPinOverlay(
            {
              id: businessId || 'business',
              business_name: businessName || 'Business',
              logo_url: logoUrl || '',
              lat: location.lat(),
              lon: location.lng(),
            },
            map,
            {
              selected: true,
              animationDelayMs: 0,
              animateEntry: true,
              onClick: () => {},
            }
          );
        } else {
          new window.google.maps.Marker({
            map,
            position: location,
            title: fullAddress,
          });
        }

        mapInstanceRef.current = map;
        setDestinationCoords({ lat: location.lat(), lng: location.lng() });
        setMapInitialized(true);
        requestAnimationFrame(() => {
          triggerMapResize();
          window.setTimeout(triggerMapResize, 120);
          window.setTimeout(triggerMapResize, 400);
        });
      } else {
        setError(`Could not find location on map: ${status}`);
      }
      setIsLoaded(true);
    });
  }, [
    address.city,
    address.state,
    address.street,
    businessId,
    businessName,
    fullAddress,
    logoUrl,
    mapInitialized,
    triggerMapResize,
  ]);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setError('Google Maps API Key is missing. Map cannot be loaded.');
      setIsLoaded(true);
      return;
    }

    let cancelled = false;
    loadGoogleMapsScript(GOOGLE_MAPS_API_KEY)
      .then(() => {
        if (!cancelled) initMap();
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load Google Maps.');
          setIsLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [GOOGLE_MAPS_API_KEY, initMap, fullAddress]);

  useEffect(() => {
    if (!mapInitialized || !mapRef.current) return;

    const node = mapRef.current;
    const resizeObserver = new ResizeObserver(() => triggerMapResize());
    resizeObserver.observe(node);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) triggerMapResize();
      },
      { threshold: 0.12 }
    );
    intersectionObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, [mapInitialized, triggerMapResize]);

  useEffect(() => {
    return () => {
      pinOverlayRef.current?.setMap(null);
      pinOverlayRef.current = null;
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    setMapInitialized(false);
    setIsLoaded(false);
    setError(null);
    setDestinationCoords(null);
    pinOverlayRef.current?.setMap(null);
    pinOverlayRef.current = null;
    mapInstanceRef.current = null;
  }, [fullAddress, businessId, businessName, logoUrl]);

  const handleOpenDirections = useCallback(() => {
    openDirections(address, destinationCoords);
  }, [address, destinationCoords]);

  return (
    <div className={cn('w-full', !embedded && 'pt-4', className)}>
      <div
        className={cn(
          'relative w-full overflow-hidden transition-opacity duration-300',
          embedded ? EMBEDDED_MAP_HEIGHT_CLASS : DEFAULT_MAP_HEIGHT_CLASS,
          embedded
            ? 'rounded-none sm:rounded-b-xl'
            : 'rounded-xl border border-gray-200 shadow-lg dark:border-gray-700',
          mapInitialized ? 'opacity-100' : 'opacity-0'
        )}
      >
        <div
          ref={mapRef}
          className={cn(BUSINESS_EMBED_MAP_SURFACE_CLASS, 'absolute inset-0 h-full w-full')}
          aria-hidden={!mapInitialized}
        />
        {!isLoaded && !error && (
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-gray-100 dark:bg-gray-800">
            <div className="h-16 w-16 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600 dark:border-gray-600 dark:border-t-gray-300" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-[1] flex items-center justify-center rounded-xl bg-red-100 p-4 text-center text-red-600 dark:bg-red-900 dark:text-red-300">
            {error}
          </div>
        )}
        {showDirections && mapInitialized && destinationCoords && !error && (
          <button
            type="button"
            onClick={handleOpenDirections}
            className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-lg ring-1 ring-slate-200/90 transition hover:bg-slate-50 active:scale-[0.98] dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-600 dark:hover:bg-slate-800"
            aria-label="Get directions to this business"
          >
            <Navigation className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
            Get directions
          </button>
        )}
      </div>
    </div>
  );
}
