'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Script from 'next/script';
import { cn } from '@/lib/utils';

interface BusinessMapProps {
    address: {
        street: string;
        city: string;
        state: string;
        zip: string;
    };
}

const BusinessMap = ({ address }: BusinessMapProps) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mapInitialized, setMapInitialized] = useState(false);

    const initMap = useCallback(() => {
        if (!window.google || !mapRef.current || mapInitialized) return;
        if (!address.street || !address.city || !address.state) {
            setError("Missing address information.");
            return;
        }

        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: fullAddress }, (results, status) => {
            if (status === 'OK' && results && results.length > 0) {
                const location = results[0].geometry.location;

                const map = new window.google.maps.Map(mapRef.current!, {
                    center: location,
                    zoom: 15,
                    mapTypeId: 'roadmap', // Added for more modern look
                    // Removed:  disableDefaultUI: true, // Consider keeping some UI elements
                    // Added more modern map styles (optional)
                    styles: [
                        {
                            featureType: 'poi',
                            elementType: 'labels.text.fill',
                            stylers: [{ color: '#747474' }],
                        },
                        {
                            featureType: 'poi',
                            elementType: 'labels.text.stroke',
                            stylers: [{ color: '#f5f5f5' }],
                        },
                        {
                            featureType: 'road',
                            elementType: 'geometry',
                            stylers: [{ color: '#ffffff' }],
                        },
                        {
                            featureType: 'road.arterial',
                            elementType: 'geometry',
                            stylers: [{ color: '#fdfcf8' }],
                        },
                        {
                            featureType: 'road.highway',
                            elementType: 'geometry',
                            stylers: [{ color: '#f8f8f8' }],
                        },
                        {
                            featureType: 'road.local',
                            elementType: 'geometry',
                            stylers: [{ color: '#ffffff' }],
                        },
                        {
                            featureType: 'transit',
                            elementType: 'geometry',
                            stylers: [{ color: '#f2f2f2' }],
                        },
                        {
                            featureType: 'water',
                            elementType: 'geometry',
                            stylers: [{ color: '#e0e0e0' }],
                        },
                        {
                            featureType: 'water',
                            elementType: 'labels.text.fill',
                            stylers: [{ color: '#929986' }],
                        },
                        {
                            featureType: 'water',
                            elementType: 'labels.text.stroke',
                            stylers: [{ color: '#f5f5f5' }],
                        },
                    ],
                });

                new window.google.maps.Marker({
                    position: location,
                    map,
                    title: 'Business Location',
                });
                setMapInitialized(true);
            } else {
                setError('Geocoding failed: ' + status);
                console.error('Geocode error:', status);
            }
            setIsLoaded(true);
        });
    }, [fullAddress, mapInitialized]);

    useEffect(() => {
        if (isLoaded && !mapInitialized) {
            initMap();
        }
    }, [isLoaded, initMap, mapInitialized]);

    return (
        <div className="pt-4 px-0">
            <div
                ref={mapRef}
                className={cn(
                    "w-full h-[300px] sm:h-[400px] rounded-xl shadow-lg",
                    "overflow-hidden border border-gray-200", // Added explicit border
                    "transition-all duration-300",  // Add smooth transitions
                    !isLoaded && "opacity-50 animate-pulse",       // Reduce opacity while loading, use simple animation
                )}
            >
                {!isLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                        <div className="w-[100px] h-[100px] rounded-full bg-gray-300 dark:bg-gray-700 animate-spin" />
                    </div>
                )}
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded-xl p-4">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BusinessMap;
