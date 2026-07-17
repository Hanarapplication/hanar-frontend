export const DEFAULT_BUSINESS_MAP_LOGO =
  'https://images.unsplash.com/photo-1557426272-fc91fdb8f385?w=200&auto=format&fit=crop';

export const BUSINESS_MAP_PIN_STYLE_ID = 'hanar-business-map-pin-styles';

export const BUSINESS_MAP_PIN_CSS = `
@keyframes hanar-pin-drop {
  0% {
    opacity: 0;
    transform: translate(-50%, -160%) scale(0.45);
  }
  65% {
    opacity: 1;
    transform: translate(-50%, -92%) scale(1.08);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -100%) scale(1);
  }
}

@keyframes hanar-pin-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.45); }
  50% { box-shadow: 0 0 0 6px rgba(124, 58, 237, 0); }
}

.hanar-business-map-pin {
  position: absolute;
  transform: translate(-50%, -100%);
  cursor: pointer;
  z-index: 10;
  animation: hanar-pin-drop 0.6s cubic-bezier(0.34, 1.45, 0.64, 1) both;
  will-change: transform, opacity;
}

.hanar-business-map-pin--instant {
  animation: none;
  opacity: 1;
  transform: translate(-50%, -100%);
}

.hanar-business-map-pin--selected {
  z-index: 60;
  animation: hanar-pin-drop 0.45s cubic-bezier(0.34, 1.45, 0.64, 1) both,
    hanar-pin-pulse 1.8s ease-in-out 0.45s infinite;
}

.hanar-business-map-pin--instant.hanar-business-map-pin--selected {
  animation: hanar-pin-pulse 1.8s ease-in-out infinite;
}

.hanar-business-map-pin__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  max-width: 120px;
}

.hanar-business-map-pin__name {
  margin: 0;
  padding: 2px 8px;
  max-width: 116px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(15, 23, 42, 0.12);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.14);
  font: 600 11px/1.25 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  color: #0f172a;
  pointer-events: none;
}

.hanar-business-map-pin--selected .hanar-business-map-pin__name {
  background: #0f172a;
  color: #fff;
  border-color: #0f172a;
}

.hanar-business-map-pin__logo-wrap {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  overflow: hidden;
  border: 3px solid #fff;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.22);
  background: #f1f5f9;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.hanar-business-map-pin:hover .hanar-business-map-pin__logo-wrap {
  transform: translateY(-2px) scale(1.06);
}

.hanar-business-map-pin--selected .hanar-business-map-pin__logo-wrap {
  width: 46px;
  height: 46px;
  border-color: #7c3aed;
}

.hanar-business-map-pin--premium {
  z-index: 20;
}

.hanar-business-map-pin--premium:not(.hanar-business-map-pin--selected) .hanar-business-map-pin__logo-wrap {
  border: 3px solid #e8c547;
  box-shadow:
    0 0 0 1.5px rgba(255, 255, 255, 0.95),
    0 4px 14px rgba(15, 23, 42, 0.22),
    0 0 10px rgba(212, 160, 23, 0.35);
}

.hanar-business-map-pin--premium.hanar-business-map-pin--selected .hanar-business-map-pin__logo-wrap {
  border-color: #7c3aed;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.22);
}

.hanar-business-map-pin__logo-wrap img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.35;
  transition: opacity 0.2s ease;
}

.hanar-business-map-pin__logo-wrap img.hanar-business-map-pin__logo--ready {
  opacity: 1;
}

.hanar-business-map-pin__tail {
  display: block;
  width: 0;
  height: 0;
  margin-top: -2px;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-top: 10px solid #fff;
  filter: drop-shadow(0 2px 2px rgba(15, 23, 42, 0.18));
}

.hanar-business-map-pin--selected .hanar-business-map-pin__tail {
  border-top-color: #7c3aed;
}

.hanar-user-map-pin {
  position: absolute;
  transform: translate(-50%, -100%);
  z-index: 200;
  pointer-events: none;
}

.hanar-user-map-pin__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.hanar-user-map-pin__label {
  margin: 0;
  padding: 2px 10px;
  border-radius: 999px;
  background: #2563eb;
  color: #fff;
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.2);
  font: 700 11px/1.25 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  white-space: nowrap;
}

.hanar-user-map-pin__avatar-wrap {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  overflow: hidden;
  border: 3px solid #2563eb;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
  background: #f1f5f9;
}

.hanar-user-map-pin__avatar-wrap img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.4;
  transition: opacity 0.2s ease;
}

.hanar-user-map-pin__avatar-wrap img.hanar-user-map-pin__avatar--ready {
  opacity: 1;
}

.hanar-user-map-pin__tail {
  display: block;
  width: 0;
  height: 0;
  margin-top: -2px;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-top: 10px solid #2563eb;
  filter: drop-shadow(0 2px 2px rgba(15, 23, 42, 0.18));
}

/* Hide Google Maps logo / terms / Street View inside Hanar map surfaces. */
.hanar-businesses-map-surface .gm-style-cc,
.hanar-business-embed-map-surface .gm-style-cc,
.hanar-businesses-map-surface .gm-style-mtc,
.hanar-business-embed-map-surface .gm-style-mtc,
.hanar-businesses-map-surface a[href*="google.com/maps"],
.hanar-business-embed-map-surface a[href*="google.com/maps"],
.hanar-businesses-map-surface a[href*="google.com"],
.hanar-business-embed-map-surface a[href*="google.com"],
.hanar-businesses-map-surface a[href*="terms"],
.hanar-business-embed-map-surface a[href*="terms"],
.hanar-businesses-map-surface img[alt="Google"],
.hanar-business-embed-map-surface img[alt="Google"],
.hanar-business-embed-map-surface .gm-style > div > a,
.hanar-business-embed-map-surface .gm-style > div > div > a {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

/* Hide rotate / Street View pegman / directions controls. */
.hanar-businesses-map-surface .gm-compass,
.hanar-business-embed-map-surface .gm-compass,
.hanar-businesses-map-surface .gm-svpc,
.hanar-business-embed-map-surface .gm-svpc,
.hanar-businesses-map-surface button[aria-label*="Rotate"],
.hanar-business-embed-map-surface button[aria-label*="Rotate"],
.hanar-businesses-map-surface button[aria-label*="rotate"],
.hanar-business-embed-map-surface button[aria-label*="rotate"],
.hanar-businesses-map-surface button[aria-label*="Directions"],
.hanar-business-embed-map-surface button[aria-label*="Directions"],
.hanar-businesses-map-surface button[aria-label*="directions"],
.hanar-business-embed-map-surface button[aria-label*="directions"],
.hanar-businesses-map-surface button[aria-label*="Street View"],
.hanar-business-embed-map-surface button[aria-label*="Street View"],
.hanar-businesses-map-surface button[title*="Rotate"],
.hanar-business-embed-map-surface button[title*="Rotate"],
.hanar-businesses-map-surface button[title*="Directions"],
.hanar-business-embed-map-surface button[title*="Directions"],
.hanar-businesses-map-surface button[title*="Street View"],
.hanar-business-embed-map-surface button[title*="Street View"] {
  display: none !important;
}

/* Business profile embed: hide zoom and remaining bundled Google controls. */
.hanar-business-embed-map-surface .gm-bundled-control,
.hanar-business-embed-map-surface .gmnoprint,
.hanar-business-embed-map-surface .gm-fullscreen-control,
.hanar-business-embed-map-surface .gm-style-moc {
  display: none !important;
}
`;

/** Applied to business slug / profile embedded maps (minimal Google chrome). */
export const BUSINESS_EMBED_MAP_SURFACE_CLASS = 'hanar-business-embed-map-surface';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function ensureBusinessMapPinStyles() {
  if (typeof document === 'undefined') return;
  let style = document.getElementById(BUSINESS_MAP_PIN_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = BUSINESS_MAP_PIN_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = BUSINESS_MAP_PIN_CSS;
}
