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
`;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function ensureBusinessMapPinStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(BUSINESS_MAP_PIN_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = BUSINESS_MAP_PIN_STYLE_ID;
  style.textContent = BUSINESS_MAP_PIN_CSS;
  document.head.appendChild(style);
}
