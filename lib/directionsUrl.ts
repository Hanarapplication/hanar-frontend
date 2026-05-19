export type DirectionsAddress = {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
};

function formatAddressQuery(address: DirectionsAddress): string {
  return [address.street, address.city, address.state, address.zip].filter(Boolean).join(', ');
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/** Opens turn-by-turn directions in Apple Maps (iOS) or Google Maps (other). */
export function buildDirectionsUrl(
  address: DirectionsAddress,
  coords?: { lat: number; lng: number } | null
): string {
  const query = formatAddressQuery(address);
  const encoded = encodeURIComponent(query);
  const ios = isIosDevice();

  if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
    const dest = `${coords.lat},${coords.lng}`;
    if (ios) return `https://maps.apple.com/?daddr=${dest}&dirflg=d`;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
  }

  if (ios) return `https://maps.apple.com/?daddr=${encoded}&dirflg=d`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
}

export function openDirections(
  address: DirectionsAddress,
  coords?: { lat: number; lng: number } | null
): void {
  if (typeof window === 'undefined') return;
  const url = buildDirectionsUrl(address, coords);
  window.location.assign(url);
}
