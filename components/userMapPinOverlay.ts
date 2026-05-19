import { HANAR_AVATAR_URL } from '@/components/Avatar';
import { escapeHtml } from '@/components/businessMapPinStyles';

export type UserPinOverlayHandle = google.maps.OverlayView & {
  requestDraw: () => void;
};

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

    onAdd() {
      const label = escapeHtml(options.label);
      const avatarUrl = options.avatarUrl || HANAR_AVATAR_URL;
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
        const preload = new Image();
        preload.decoding = 'async';
        preload.referrerPolicy = 'no-referrer';
        preload.onload = () => {
          img.src = avatarUrl;
          img.classList.add('hanar-user-map-pin__avatar--ready');
          this.requestDraw();
        };
        preload.onerror = () => {
          img.src = HANAR_AVATAR_URL;
          img.classList.add('hanar-user-map-pin__avatar--ready');
          this.requestDraw();
        };
        preload.src = avatarUrl;
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
