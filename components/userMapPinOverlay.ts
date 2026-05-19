import { HANAR_AVATAR_URL } from '@/components/Avatar';
import { escapeHtml } from '@/components/businessMapPinStyles';

export type UserPinOverlayHandle = google.maps.OverlayView & {
  requestDraw: () => void;
  updateAvatar: (avatarUrl: string) => void;
};

function loadPinAvatarImage(img: HTMLImageElement, avatarUrl: string, onDone: () => void) {
  const url = avatarUrl || HANAR_AVATAR_URL;
  if (img.dataset.avatarSrc === url && img.classList.contains('hanar-user-map-pin__avatar--ready')) {
    onDone();
    return;
  }
  img.dataset.avatarSrc = url;
  img.classList.remove('hanar-user-map-pin__avatar--ready');
  const preload = new Image();
  preload.decoding = 'async';
  preload.referrerPolicy = 'no-referrer';
  preload.onload = () => {
    img.src = url;
    img.classList.add('hanar-user-map-pin__avatar--ready');
    onDone();
  };
  preload.onerror = () => {
    img.src = HANAR_AVATAR_URL;
    img.dataset.avatarSrc = HANAR_AVATAR_URL;
    img.classList.add('hanar-user-map-pin__avatar--ready');
    onDone();
  };
  preload.src = url;
}

export function createUserMapPinOverlay(
  lat: number,
  lon: number,
  map: google.maps.Map,
  options: {
    avatarUrl: string;
    label: string;
  }
): UserPinOverlayHandle {
  class UserPinOverlay extends google.maps.OverlayView {
    private div: HTMLDivElement | null = null;
    private readonly position = new google.maps.LatLng(lat, lon);

    requestDraw() {
      this.draw();
    }

    updateAvatar(avatarUrl: string) {
      const img = this.div?.querySelector('img');
      if (!img) return;
      loadPinAvatarImage(img, avatarUrl, () => this.requestDraw());
    }

    onAdd() {
      const label = escapeHtml(options.label);
      const placeholder = HANAR_AVATAR_URL.replace(/"/g, '&quot;');

      this.div = document.createElement('div');
      this.div.className = 'hanar-user-map-pin';
      this.div.setAttribute('aria-label', options.label);

      this.div.innerHTML = `
        <div class="hanar-user-map-pin__card">
          <p class="hanar-user-map-pin__label">${label}</p>
          <div class="hanar-user-map-pin__avatar-wrap">
            <img src="${placeholder}" alt="" decoding="async" referrerpolicy="no-referrer" />
          </div>
          <span class="hanar-user-map-pin__tail" aria-hidden="true"></span>
        </div>
      `;

      const img = this.div.querySelector('img');
      if (img) {
        loadPinAvatarImage(img, options.avatarUrl, () => this.requestDraw());
      }

      this.getPanes()?.overlayMouseTarget.appendChild(this.div);
    }

    draw() {
      if (!this.div) return;
      const point = this.getProjection()?.fromLatLngToDivPixel(this.position);
      if (!point) return;
      this.div.style.left = `${point.x}px`;
      this.div.style.top = `${point.y}px`;
    }

    onRemove() {
      this.div?.remove();
      this.div = null;
    }
  }

  const overlay = new UserPinOverlay() as UserPinOverlayHandle;
  overlay.setMap(map);
  return overlay;
}
