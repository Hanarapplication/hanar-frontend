/**
 * While a feed video is in native fullscreen, DOM rendered via `createPortal(..., document.body)`
 * is outside the fullscreen subtree and will not show. Callers portalling UI that must appear
 * "on top of" fullscreen video should use `getFeedVideoFullscreenPortalTarget()` as the portal
 * container instead of `document.body` when it returns the active player root.
 */

const EVENT = 'feed-video-fullscreen-portal-target';

let activeRoot: HTMLDivElement | null = null;

export function setFeedVideoFullscreenPortalRoot(el: HTMLDivElement | null) {
  activeRoot = el;
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new Event(EVENT));
  }
}

export function releaseFeedVideoFullscreenPortalRoot(el: HTMLDivElement | null) {
  if (el && activeRoot === el) {
    activeRoot = null;
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new Event(EVENT));
    }
  }
}

export function getFeedVideoFullscreenPortalTarget(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const fs = document.fullscreenElement;
  if (activeRoot && fs) {
    if (fs === activeRoot || activeRoot.contains(fs)) {
      return activeRoot;
    }
  }
  return document.body;
}

export function subscribeFeedVideoFullscreenPortalTarget(onStoreChange: () => void) {
  const handler = () => onStoreChange();
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener(EVENT, handler);
  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener(EVENT, handler);
  };
}
