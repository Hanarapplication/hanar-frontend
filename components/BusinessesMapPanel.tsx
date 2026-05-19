'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { ChevronDown, ChevronUp, MapPin, Navigation, Phone, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { milesToMeters, zoomForRadiusMiles } from '@/lib/businessMapCoords';
import { getDistanceMiles } from '@/lib/geoDistance';
import {
  createBusinessPinOverlay,
  type BusinessPinOverlayHandle,
} from '@/components/businessMapPinOverlay';
import { createUserMapPinOverlay, type UserPinOverlayHandle } from '@/components/userMapPinOverlay';
import { HANAR_AVATAR_URL } from '@/components/Avatar';
import {
  DEFAULT_BUSINESS_MAP_LOGO,
  ensureBusinessMapPinStyles,
} from '@/components/businessMapPinStyles';
import { USA_MAP_BOUNDS } from '@/lib/businessMapCoords';

export type MapViewportMode = 'usa' | 'area' | 'radius';

const MAP_BOUNDS_MAX_MI = 80;
const MAP_COLLAPSED_PIN_LIMIT = 48;
const MAP_FIT_BOUNDS_MAX_PINS = 120;

export type MapPanelBusiness = {
  id: string;
  business_name: string;
  slug: string;
  logo_url: string;
  lat: number;
  lon: number;
  phone?: string | null;
  distanceMi?: number | null;
};

type BusinessesMapPanelProps = {
  businesses: MapPanelBusiness[];
  /** Quick-select chips (e.g. current search/filter matches). Defaults to `businesses`. */
  chipBusinesses?: MapPanelBusiness[];
  totalRegisteredCount?: number;
  matchingCount?: number;
  pendingGeocodeCount?: number;
  geocoding?: boolean;
  userCoords?: { lat: number; lon: number } | null;
  /** Blue-dot location on map (independent of radius search filter). */
  mapUserCoords?: { lat: number; lon: number } | null;
  userAvatarUrl?: string | null;
  onShareMapLocation?: () => void;
  sharingMapLocation?: boolean;
  mapViewCenter?: { lat: number; lon: number } | null;
  mapViewport?: MapViewportMode;
  mapAreaZoom?: number;
  isRadiusMode?: boolean;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  radiusMiles: number;
  minRadiusMiles?: number;
  maxRadiusMiles?: number;
  onRadiusChange: (miles: number) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  getBusinessHref: (biz: MapPanelBusiness) => string;
  labels: {
    showOnMap: string;
    hideMap: string;
    onMap: string;
    tapToExplore: string;
    noLocations: string;
    noLocationsButMatches: string;
    geocodingAddresses: string;
    radius: string;
    miles: string;
    openInMaps: string;
    viewProfile: string;
    call: string;
    shareMyLocation: string;
    myLocationOnMap: string;
    youLabel: string;
  };
};

function computeBounds(points: { lat: number; lon: number }[]) {
  if (points.length === 0) return null;
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLon = points[0].lon;
  let maxLon = points[0].lon;
  for (const p of points.slice(1)) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
  }
  const padLat = Math.max((maxLat - minLat) * 0.08, 0.015);
  const padLon = Math.max((maxLon - minLon) * 0.08, 0.015);
  return {
    minLat: minLat - padLat,
    maxLat: maxLat + padLat,
    minLon: minLon - padLon,
    maxLon: maxLon + padLon,
  };
}

function toPercent(
  lat: number,
  lon: number,
  bounds: NonNullable<ReturnType<typeof computeBounds>>
) {
  const y = bounds.maxLat === bounds.minLat ? 0.5 : (bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat);
  const x = bounds.maxLon === bounds.minLon ? 0.5 : (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
  return { left: `${Math.min(92, Math.max(8, x * 100))}%`, top: `${Math.min(88, Math.max(12, y * 100))}%` };
}

/** Bounds for preview: USA, user + radius, selected area, or business pins. */
function previewBounds(
  businesses: MapPanelBusiness[],
  mapUserCoords: { lat: number; lon: number } | null | undefined,
  userCoords: { lat: number; lon: number } | null | undefined,
  mapViewCenter: { lat: number; lon: number } | null | undefined,
  radiusMiles: number,
  isRadiusMode: boolean,
  mapViewport: MapViewportMode
) {
  if (mapViewport === 'usa') {
    return computeBounds([
      { lat: USA_MAP_BOUNDS.south, lon: USA_MAP_BOUNDS.west },
      { lat: USA_MAP_BOUNDS.north, lon: USA_MAP_BOUNDS.east },
    ]);
  }

  const pts: { lat: number; lon: number }[] = businesses.map((b) => ({ lat: b.lat, lon: b.lon }));
  const youAreHere = mapUserCoords ?? (isRadiusMode && userCoords ? userCoords : null);
  if (youAreHere) {
    pts.push({ lat: youAreHere.lat, lon: youAreHere.lon });
  }
  if (isRadiusMode && userCoords) {
    pts.push({ lat: userCoords.lat, lon: userCoords.lon });
    const latPad = radiusMiles / 69;
    const lonPad = radiusMiles / (69 * Math.max(0.35, Math.cos((userCoords.lat * Math.PI) / 180)));
    pts.push(
      { lat: userCoords.lat + latPad, lon: userCoords.lon },
      { lat: userCoords.lat - latPad, lon: userCoords.lon },
      { lat: userCoords.lat, lon: userCoords.lon + lonPad },
      { lat: userCoords.lat, lon: userCoords.lon - lonPad }
    );
  } else if (mapViewCenter) {
    pts.push({ lat: mapViewCenter.lat, lon: mapViewCenter.lon });
    const latPad = 0.12;
    const lonPad = 0.12;
    pts.push(
      { lat: mapViewCenter.lat + latPad, lon: mapViewCenter.lon },
      { lat: mapViewCenter.lat - latPad, lon: mapViewCenter.lon },
      { lat: mapViewCenter.lat, lon: mapViewCenter.lon + lonPad },
      { lat: mapViewCenter.lat, lon: mapViewCenter.lon - lonPad }
    );
  }
  return computeBounds(pts);
}

export default function BusinessesMapPanel({
  businesses,
  chipBusinesses,
  totalRegisteredCount = 0,
  matchingCount = 0,
  pendingGeocodeCount = 0,
  geocoding = false,
  userCoords,
  mapUserCoords,
  userAvatarUrl,
  onShareMapLocation,
  sharingMapLocation = false,
  mapViewCenter,
  mapViewport = 'usa',
  mapAreaZoom = 10,
  isRadiusMode = false,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
  radiusMiles,
  minRadiusMiles = 5,
  maxRadiusMiles = 100,
  onRadiusChange,
  selectedId,
  onSelect,
  getBusinessHref,
  labels,
}: BusinessesMapPanelProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpandedControlled = expandedProp !== undefined;
  const expanded = isExpandedControlled ? expandedProp : internalExpanded;
  const setExpanded = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof value === 'function' ? value(expanded) : value;
      if (!isExpandedControlled) setInternalExpanded(next);
      onExpandedChange?.(next);
    },
    [expanded, isExpandedControlled, onExpandedChange]
  );
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const pinOverlaysRef = useRef<Map<string, BusinessPinOverlayHandle>>(new Map());
  const knownPinIdsRef = useRef<Set<string>>(new Set());
  const mapListenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const userOverlayRef = useRef<UserPinOverlayHandle | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const chips = chipBusinesses ?? businesses;

  const pinsForView = useMemo(
    () => (expanded ? businesses : businesses.slice(0, MAP_COLLAPSED_PIN_LIMIT)),
    [businesses, expanded]
  );

  const youOnMap = mapUserCoords ?? (isRadiusMode && userCoords ? userCoords : null);
  const youAvatar = userAvatarUrl || HANAR_AVATAR_URL;

  const previewMapBounds = useMemo(
    () =>
      previewBounds(
        pinsForView,
        mapUserCoords,
        userCoords,
        mapViewCenter,
        radiusMiles,
        isRadiusMode,
        mapViewport
      ),
    [pinsForView, mapUserCoords, userCoords, mapViewCenter, radiusMiles, isRadiusMode, mapViewport]
  );

  const selected = useMemo(
    () => businesses.find((b) => b.id === selectedId) ?? pinsForView[0] ?? businesses[0] ?? null,
    [businesses, pinsForView, selectedId]
  );

  const clearMapListeners = useCallback(() => {
    mapListenersRef.current.forEach((listener) => listener.remove());
    mapListenersRef.current = [];
  }, []);

  const requestPinRedraw = useCallback(() => {
    pinOverlaysRef.current.forEach((overlay) => overlay.requestDraw());
    userOverlayRef.current?.requestDraw();
  }, []);

  const ensureMap = useCallback((): google.maps.Map | null => {
    if (!window.google || !mapRef.current) return null;
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
      });
      clearMapListeners();
      const map = mapInstanceRef.current;
      const redraw = () => requestPinRedraw();
      mapListenersRef.current.push(
        map.addListener('idle', redraw),
        map.addListener('tilesloaded', redraw)
      );
    }
    return mapInstanceRef.current;
  }, [clearMapListeners, requestPinRedraw]);

  const applyViewport = useCallback(
    (map: google.maps.Map) => {
      const userLatLng =
        isRadiusMode && userCoords ? { lat: userCoords.lat, lng: userCoords.lon } : null;
      const myLatLng = youOnMap ? { lat: youOnMap.lat, lng: youOnMap.lon } : null;
      const anchor = mapViewCenter;
      const boundsPins = pinsForView;
      const canFitBounds = boundsPins.length > 0 && boundsPins.length <= MAP_FIT_BOUNDS_MAX_PINS;

      const extendBounds = (gBounds: google.maps.LatLngBounds) => {
        boundsPins.forEach((biz) => gBounds.extend({ lat: biz.lat, lng: biz.lon }));
        if (myLatLng) gBounds.extend(myLatLng);
        if (anchor) gBounds.extend({ lat: anchor.lat, lng: anchor.lon });
      };

      if (mapViewport === 'usa') {
        const usaBounds = new window.google.maps.LatLngBounds(
          { lat: USA_MAP_BOUNDS.south, lng: USA_MAP_BOUNDS.west },
          { lat: USA_MAP_BOUNDS.north, lng: USA_MAP_BOUNDS.east }
        );
        map.fitBounds(usaBounds, { top: 36, right: 20, bottom: 48, left: 20 });
      } else if (!userLatLng) {
        if (mapViewport === 'area' && anchor) {
          map.setCenter({ lat: anchor.lat, lng: anchor.lon });
          map.setZoom(mapAreaZoom);
        } else if (boundsPins.length === 0 && myLatLng) {
          map.setCenter(myLatLng);
          map.setZoom(12);
        } else if (boundsPins.length === 0 && anchor) {
          map.setCenter({ lat: anchor.lat, lng: anchor.lon });
          map.setZoom(mapAreaZoom);
        } else if (boundsPins.length === 1) {
          map.setCenter({ lat: boundsPins[0].lat, lng: boundsPins[0].lon });
          map.setZoom(13);
        } else if (mapViewport === 'area' && canFitBounds) {
          const gBounds = new window.google.maps.LatLngBounds();
          extendBounds(gBounds);
          map.fitBounds(gBounds, { top: 40, right: 24, bottom: 56, left: 24 });
        } else if (canFitBounds) {
          const gBounds = new window.google.maps.LatLngBounds();
          extendBounds(gBounds);
          map.fitBounds(gBounds, { top: 40, right: 24, bottom: 56, left: 24 });
        } else if (myLatLng) {
          map.setCenter(myLatLng);
          map.setZoom(12);
        } else if (anchor) {
          map.setCenter({ lat: anchor.lat, lng: anchor.lon });
          map.setZoom(mapAreaZoom);
        }
      } else if (canFitBounds) {
        const gBounds = new window.google.maps.LatLngBounds();
        gBounds.extend(userLatLng);
        boundsPins.forEach((biz) => gBounds.extend({ lat: biz.lat, lng: biz.lon }));
        map.fitBounds(gBounds, { top: 48, right: 32, bottom: 64, left: 32 });
      } else {
        map.setCenter(userLatLng);
        map.setZoom(zoomForRadiusMiles(radiusMiles));
      }
    },
    [pinsForView, mapViewCenter, mapViewport, mapAreaZoom, radiusMiles, isRadiusMode, userCoords, youOnMap]
  );

  const syncUserLocationLayer = useCallback(
    (map: google.maps.Map) => {
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
      if (userOverlayRef.current) {
        userOverlayRef.current.setMap(null);
        userOverlayRef.current = null;
      }

      const markerLatLng = youOnMap ? { lat: youOnMap.lat, lng: youOnMap.lon } : null;
      const radiusCenter =
        isRadiusMode && userCoords ? { lat: userCoords.lat, lng: userCoords.lon } : null;

      if (radiusCenter) {
        circleRef.current = new window.google.maps.Circle({
          map,
          center: radiusCenter,
          radius: milesToMeters(radiusMiles),
          fillColor: '#64748b',
          fillOpacity: 0.06,
          strokeColor: '#64748b',
          strokeOpacity: 0.45,
          strokeWeight: 1,
          clickable: false,
        });
      }

      if (markerLatLng) {
        userOverlayRef.current = createUserMapPinOverlay(youOnMap!.lat, youOnMap!.lon, map, {
          avatarUrl: youAvatar,
          label: labels.youLabel,
        });
      }
    },
    [youOnMap, youAvatar, isRadiusMode, userCoords, radiusMiles, labels.youLabel]
  );

  const syncPins = useCallback(() => {
    const map = ensureMap();
    if (!map) return;

    syncUserLocationLayer(map);

    const overlays = pinOverlaysRef.current;
    const nextIds = new Set(pinsForView.map((p) => p.id));
    const knownIds = knownPinIdsRef.current;

    for (const [id, overlay] of overlays) {
      if (!nextIds.has(id)) {
        overlay.setMap(null);
        overlays.delete(id);
        knownIds.delete(id);
      }
    }

    let newPinCount = 0;
    pinsForView.forEach((biz, index) => {
      const existing = overlays.get(biz.id);
      if (existing) {
        existing.setSelected(selectedId === biz.id);
        return;
      }

      const isNew = !knownIds.has(biz.id);
      if (isNew) newPinCount += 1;

      const overlay = createBusinessPinOverlay(biz, map, {
        selected: selectedId === biz.id,
        animationDelayMs: Math.min(newPinCount * 40, 800),
        animateEntry: isNew,
        onClick: () => onSelect(biz.id),
      });
      overlays.set(biz.id, overlay);
      knownIds.add(biz.id);
    });

    window.google.maps.event.trigger(map, 'resize');
    requestPinRedraw();
  }, [
    ensureMap,
    syncUserLocationLayer,
    pinsForView,
    selectedId,
    onSelect,
    requestPinRedraw,
    youAvatar,
  ]);

  const viewportKey = useMemo(
    () =>
      [
        mapViewport,
        mapViewCenter?.lat,
        mapViewCenter?.lon,
        mapAreaZoom,
        radiusMiles,
        isRadiusMode,
        userCoords?.lat,
        userCoords?.lon,
        youOnMap?.lat,
        youOnMap?.lon,
        expanded,
      ].join('|'),
    [
      mapViewport,
      mapViewCenter,
      mapAreaZoom,
      radiusMiles,
      isRadiusMode,
      userCoords,
      youOnMap,
      expanded,
    ]
  );

  const lastViewportKeyRef = useRef('');

  useEffect(() => {
    if (!expanded || !scriptReady || !apiKey) return;
    syncPins();
  }, [expanded, scriptReady, apiKey, syncPins, pinsForView, selectedId]);

  useEffect(() => {
    if (!expanded || !scriptReady || !apiKey) return;
    const map = ensureMap();
    if (!map) return;

    const viewportChanged = lastViewportKeyRef.current !== viewportKey;
    if (viewportChanged) {
      lastViewportKeyRef.current = viewportKey;
      applyViewport(map);
    }

    const t1 = window.setTimeout(requestPinRedraw, 80);
    const t2 = window.setTimeout(requestPinRedraw, 350);
    const idleListener = map.addListener('idle', () => requestPinRedraw());
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      idleListener.remove();
    };
  }, [
    expanded,
    scriptReady,
    apiKey,
    ensureMap,
    applyViewport,
    viewportKey,
    requestPinRedraw,
  ]);

  useEffect(() => {
    if (!expanded) {
      pinOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
      pinOverlaysRef.current.clear();
      lastViewportKeyRef.current = '';
      clearMapListeners();
      mapInstanceRef.current = null;
    }
  }, [expanded, clearMapListeners]);

  useEffect(() => {
    ensureBusinessMapPinStyles();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.initBusinessesMapPanel = () => setScriptReady(true);
    if (window.google?.maps) setScriptReady(true);
    return () => {
      delete window.initBusinessesMapPanel;
    };
  }, []);

  const resolvingLocations =
    geocoding || (matchingCount > 0 && businesses.length === 0 && pendingGeocodeCount > 0);

  const showPinsLoadingOverlay =
    businesses.length === 0 && matchingCount > 0 && (resolvingLocations || pendingGeocodeCount > 0);

  const showNoAddressOverlay =
    businesses.length === 0 &&
    matchingCount > 0 &&
    !resolvingLocations &&
    pendingGeocodeCount === 0;

  const mapsDirectionsUrl = selected
    ? `https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lon}`
    : null;

  const selectedPhone = selected?.phone?.trim() ?? '';
  const mapActionIconWrap =
    'flex h-6 w-6 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/25 transition group-hover:bg-white/30';
  const mapActionIconWrapMuted = 'flex h-6 w-6 items-center justify-center rounded-full bg-slate-200/80';
  const mapActionClass =
    'group flex min-h-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold leading-tight shadow-sm transition active:scale-[0.97]';

  const showMapSurface = expanded && Boolean(apiKey);

  return (
    <section id="businesses-map-panel" className="relative left-1/2 mb-5 w-screen -translate-x-1/2 px-3">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5 text-left text-slate-800"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            {expanded ? labels.hideMap : labels.showOnMap}
            <span className="text-xs text-slate-500">
              ({pinsForView.length}
              {matchingCount > pinsForView.length ? ` / ${matchingCount}` : ''}
              {!expanded &&
              businesses.length > pinsForView.length &&
              matchingCount <= businesses.length
                ? ` / ${businesses.length}`
                : ''}{' '}
              {labels.onMap}
              {totalRegisteredCount > businesses.length
                ? ` · ${totalRegisteredCount} registered`
                : ''}
              )
            </span>
          </span>
          {expanded ? (
            <ChevronUp className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
          )}
        </button>

        <div
          className={cn(
            'relative bg-slate-100 transition-all duration-300 ease-out',
            expanded ? 'h-[min(52vh,22rem)]' : 'h-32'
          )}
        >
          {apiKey && expanded && (
            <Script
              src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initBusinessesMapPanel`}
              strategy="afterInteractive"
              async
              defer
              onError={() => setMapError('Map failed to load')}
            />
          )}

          {onShareMapLocation && (showMapSurface || !expanded) ? (
            <button
              type="button"
              onClick={onShareMapLocation}
              disabled={sharingMapLocation}
              className="absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-md transition hover:bg-white disabled:opacity-60"
            >
              <Navigation className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden />
              {sharingMapLocation ? '…' : youOnMap ? labels.myLocationOnMap : labels.shareMyLocation}
            </button>
          ) : null}

          {showMapSurface ? (
            <div ref={mapRef} className="absolute inset-0" />
          ) : (
            <div className="absolute inset-0 bg-slate-200/80" aria-hidden={showMapSurface}>
              {previewMapBounds &&
                pinsForView.map((biz, index) => {
                  const pos = toPercent(biz.lat, biz.lon, previewMapBounds);
                  const active = selectedId === biz.id;
                  const logo = biz.logo_url || DEFAULT_BUSINESS_MAP_LOGO;
                  return (
                    <button
                      key={biz.id}
                      type="button"
                      style={{
                        left: pos.left,
                        top: pos.top,
                        animationDelay: `${Math.min(index * 40, 600)}ms`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(biz.id);
                        if (!expanded) setExpanded(true);
                      }}
                      className={cn(
                        'absolute z-10 flex max-w-[88px] -translate-x-1/2 -translate-y-full flex-col items-center gap-0.5 animate-[hanar-pin-drop_0.55s_cubic-bezier(0.34,1.45,0.64,1)_both]',
                        active && 'z-20 scale-105'
                      )}
                      aria-label={biz.business_name}
                    >
                      <span
                        className={cn(
                          'max-w-full truncate rounded-full bg-white/95 px-1.5 py-0.5 text-[9px] font-semibold text-slate-900 shadow',
                          active && 'bg-slate-900 text-white'
                        )}
                      >
                        {biz.business_name}
                      </span>
                      <span
                        className={cn(
                          'h-7 w-7 overflow-hidden rounded-full border-2 border-white bg-slate-200 shadow-md',
                          active && 'border-violet-600 ring-2 ring-violet-300'
                        )}
                      >
                        <img
                          src={logo}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="eager"
                          decoding="async"
                        />
                      </span>
                      <span
                        className={cn(
                          'h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-white',
                          active && 'border-t-violet-600'
                        )}
                        aria-hidden
                      />
                    </button>
                  );
                })}
              {youOnMap && previewMapBounds && (
                <div
                  style={toPercent(youOnMap.lat, youOnMap.lon, previewMapBounds)}
                  className="absolute z-20 flex max-w-[72px] -translate-x-1/2 -translate-y-full flex-col items-center gap-0.5"
                  title={labels.myLocationOnMap}
                >
                  <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow">
                    {labels.youLabel}
                  </span>
                  <span className="h-8 w-8 overflow-hidden rounded-full border-2 border-blue-600 bg-slate-200 shadow-md">
                    <img src={youAvatar} alt="" className="h-full w-full object-cover" />
                  </span>
                  <span
                    className="h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-blue-600"
                    aria-hidden
                  />
                </div>
              )}
              {!isRadiusMode && mapViewCenter && previewMapBounds && (
                <span
                  style={toPercent(mapViewCenter.lat, mapViewCenter.lon, previewMapBounds)}
                  className="absolute z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-violet-600 shadow"
                  title="Area center"
                  aria-hidden
                />
              )}
            </div>
          )}

          {showMapSurface && (showPinsLoadingOverlay || showNoAddressOverlay) ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 px-4 text-center backdrop-blur-[2px]">
              <MapPin className="mb-2 h-8 w-8 text-slate-400" aria-hidden />
              {showPinsLoadingOverlay ? (
                <>
                  <p className="text-sm font-medium text-slate-700">{labels.geocodingAddresses}</p>
                  {pendingGeocodeCount > 0 ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {pendingGeocodeCount} {labels.onMap}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-slate-600">{labels.noLocationsButMatches}</p>
              )}
            </div>
          ) : null}

          {!expanded && (
            <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-slate-600">
              {labels.tapToExplore}
            </p>
          )}

          {mapError && expanded && (
            <p className="absolute inset-0 flex items-center justify-center bg-white/90 p-4 text-center text-sm text-red-600">
              {mapError}
            </p>
          )}
        </div>

        {isRadiusMode && (
        <div className="border-t border-slate-200 bg-white px-3 py-2.5">
            <label className="mb-1 flex items-center justify-between text-xs text-slate-600">
              <span>{labels.radius}</span>
              <span className="font-semibold text-slate-800">
                {radiusMiles} {labels.miles}
              </span>
            </label>
            <input
              type="range"
              min={minRadiusMiles}
              max={maxRadiusMiles}
              step={5}
              value={radiusMiles}
              onChange={(e) => onRadiusChange(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-slate-700"
            />
          </div>
        )}

        {selected && (
          <div className="border-t border-slate-200 bg-gradient-to-b from-white to-slate-50 p-2.5">
            <div className="mb-2 flex min-w-0 items-center gap-2.5">
              <img
                src={selected.logo_url || 'https://images.unsplash.com/photo-1557426272-fc91fdb8f385?w=200&auto=format&fit=crop'}
                alt=""
                className="h-9 w-9 shrink-0 rounded-md object-cover ring-1 ring-slate-200"
              />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold text-slate-900">{selected.business_name}</p>
                {selected.distanceMi != null && (
                  <p className="text-xs text-slate-500">
                    {selected.distanceMi.toFixed(1)} {labels.miles}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {mapsDirectionsUrl ? (
                <a
                  href={mapsDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    mapActionClass,
                    'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-blue-500/30 hover:from-blue-600 hover:to-blue-700'
                  )}
                >
                  <span className={mapActionIconWrap}>
                    <Navigation className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  </span>
                  <span>{labels.openInMaps}</span>
                </a>
              ) : (
                <span
                  className={cn(mapActionClass, 'cursor-not-allowed bg-slate-100 text-slate-400 shadow-none')}
                  aria-disabled
                >
                  <span className={mapActionIconWrapMuted}>
                    <Navigation className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span>{labels.openInMaps}</span>
                </span>
              )}
              <Link
                href={getBusinessHref(selected)}
                className={cn(
                  mapActionClass,
                  'bg-gradient-to-b from-violet-600 to-violet-700 text-white shadow-violet-500/30 hover:from-violet-700 hover:to-violet-800'
                )}
              >
                <span className={mapActionIconWrap}>
                  <User className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                </span>
                <span>{labels.viewProfile}</span>
              </Link>
              {selectedPhone ? (
                <a
                  href={`tel:${selectedPhone}`}
                  className={cn(
                    mapActionClass,
                    'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-emerald-500/30 hover:from-emerald-600 hover:to-emerald-700'
                  )}
                >
                  <span className={mapActionIconWrap}>
                    <Phone className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  </span>
                  <span>{labels.call}</span>
                </a>
              ) : (
                <span
                  className={cn(mapActionClass, 'cursor-not-allowed bg-slate-100 text-slate-400 shadow-none')}
                  aria-disabled
                >
                  <span className={mapActionIconWrapMuted}>
                    <Phone className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span>{labels.call}</span>
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto border-t border-slate-200 p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chips.map((biz) => {
            const active = selectedId === biz.id;
            return (
              <button
                key={`chip-${biz.id}`}
                type="button"
                onClick={() => {
                  onSelect(biz.id);
                  if (!expanded) setExpanded(true);
                }}
                className={cn(
                  'shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition',
                  active
                    ? 'border-slate-800 bg-slate-800 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                )}
              >
                {biz.business_name}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

declare global {
  interface Window {
    initBusinessesMapPanel?: () => void;
  }
}
