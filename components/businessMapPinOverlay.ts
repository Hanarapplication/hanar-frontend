import {
  DEFAULT_BUSINESS_MAP_LOGO,
  escapeHtml,
} from '@/components/businessMapPinStyles';

export type BusinessMapPinData = {
  id: string;
  business_name: string;
  logo_url: string;
  lat: number;
  lon: number;
};

export type BusinessPinOverlayHandle = google.maps.OverlayView & {
  setSelected: (selected: boolean) => void;
  updateBusiness: (biz: BusinessMapPinData) => void;
  requestDraw: () => void;
};

export function createBusinessPinOverlay(
  biz: BusinessMapPinData,
  map: google.maps.Map,
  options: {
    selected: boolean;
    animationDelayMs: number;
    animateEntry: boolean;
    onClick: () => void;
  }
): BusinessPinOverlayHandle {
  let currentBiz = biz;

  class BusinessPinOverlay extends google.maps.OverlayView {
    private div: HTMLDivElement | null = null;
    private position: google.maps.LatLng;
    private selected = options.selected;

    constructor() {
      super();
      this.position = new google.maps.LatLng(currentBiz.lat, currentBiz.lon);
    }

    setSelected(selected: boolean) {
      this.selected = selected;
      if (!this.div) return;
      this.div.classList.toggle('hanar-business-map-pin--selected', selected);
    }

    updateBusiness(next: BusinessMapPinData) {
      currentBiz = next;
      this.position = new google.maps.LatLng(next.lat, next.lon);
      if (!this.div) return;
      this.div.setAttribute('aria-label', next.business_name);
      const nameEl = this.div.querySelector('.hanar-business-map-pin__name');
      if (nameEl) nameEl.textContent = next.business_name;
      const img = this.div.querySelector('img');
      if (img) {
        const logoUrl = next.logo_url || DEFAULT_BUSINESS_MAP_LOGO;
        if (img.getAttribute('src') !== logoUrl) {
          img.classList.remove('hanar-business-map-pin__logo--ready');
          const preload = new Image();
          preload.decoding = 'async';
          preload.referrerPolicy = 'no-referrer';
          preload.onload = () => {
            img.src = logoUrl;
            img.classList.add('hanar-business-map-pin__logo--ready');
            this.requestDraw();
          };
          preload.onerror = () => {
            img.src = DEFAULT_BUSINESS_MAP_LOGO;
            img.classList.add('hanar-business-map-pin__logo--ready');
            this.requestDraw();
          };
          preload.src = logoUrl;
        }
      }
      this.requestDraw();
    }

    requestDraw() {
      this.draw();
    }

    onAdd() {
      const logoUrl = currentBiz.logo_url || DEFAULT_BUSINESS_MAP_LOGO;
      const name = escapeHtml(currentBiz.business_name);
      const placeholder = DEFAULT_BUSINESS_MAP_LOGO.replace(/"/g, '&quot;');

      this.div = document.createElement('div');
      this.div.className = [
        'hanar-business-map-pin',
        options.animateEntry ? '' : 'hanar-business-map-pin--instant',
        this.selected ? 'hanar-business-map-pin--selected' : '',
      ]
        .filter(Boolean)
        .join(' ');
      if (options.animateEntry) {
        this.div.style.animationDelay = `${options.animationDelayMs}ms`;
      }

      this.div.setAttribute('role', 'button');
      this.div.setAttribute('aria-label', currentBiz.business_name);
      this.div.tabIndex = 0;

      this.div.innerHTML = `
        <div class="hanar-business-map-pin__card">
          <p class="hanar-business-map-pin__name">${name}</p>
          <div class="hanar-business-map-pin__logo-wrap">
            <img src="${placeholder}" alt="" decoding="async" referrerpolicy="no-referrer" />
          </div>
          <span class="hanar-business-map-pin__tail" aria-hidden="true"></span>
        </div>
      `;

      const img = this.div.querySelector('img');
      if (img) {
        const preload = new Image();
        preload.decoding = 'async';
        preload.referrerPolicy = 'no-referrer';
        preload.onload = () => {
          img.src = logoUrl;
          img.classList.add('hanar-business-map-pin__logo--ready');
          this.requestDraw();
        };
        preload.onerror = () => {
          img.src = DEFAULT_BUSINESS_MAP_LOGO;
          img.classList.add('hanar-business-map-pin__logo--ready');
          this.requestDraw();
        };
        preload.src = logoUrl;
      }

      const activate = (e: Event) => {
        e.stopPropagation();
        options.onClick();
      };
      this.div.addEventListener('click', activate);
      this.div.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate(e);
        }
      });

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

  const overlay = new BusinessPinOverlay() as BusinessPinOverlayHandle;
  overlay.setMap(map);
  return overlay;
}
