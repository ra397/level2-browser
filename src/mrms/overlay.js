// MRMS Mercator Overlay for Google Maps

const cssMercatorOverlay = [
    {'.mrms-overlayDiv': "position: absolute; border-style: none; border-width: 0px; image-rendering: pixelated;"},
    {'.mrms-overlayImg': "position: absolute; width: 100%; height: 100%;"}
];

let MRMSOverlay = null;

export function getMRMSOverlay() {
    if (MRMSOverlay) return MRMSOverlay;

    MRMSOverlay = class MRMSOverlay extends google.maps.OverlayView {
        static cssInjected = false;

        #bounds;
        #div;
        #img;
        #map;

        constructor(bounds, map) {
            super();

            if (!MRMSOverlay.cssInjected && cssMercatorOverlay) {
                cssMercatorOverlay.forEach(obj => {
                    const [selector, rules] = Object.entries(obj)[0];
                    this.#injectCSS(selector, rules);
                });
                MRMSOverlay.cssInjected = true;
            }

            if (typeof bounds.extend !== 'function' && bounds.sw && bounds.ne) {
                bounds = new google.maps.LatLngBounds(bounds.sw, bounds.ne);
            }

            this.#bounds = bounds;
            this.#map = map;

            this.#div = document.createElement('div');
            this.#div.className = 'mrms-overlayDiv';

            this.#img = document.createElement('img');
            this.#img.className = 'mrms-overlayImg';

            this.#div.appendChild(this.#img);
            this.setMap(map);
        }

        #injectCSS(selector, rules) {
            const style = document.createElement('style');
            style.type = 'text/css';
            document.head.appendChild(style);
            if (!(style.sheet || {}).insertRule) {
                (style.styleSheet || style.sheet).addRule(selector, rules);
            } else {
                style.sheet.insertRule(`${selector}{${rules}}`, 0);
            }
        }

        onAdd() {
            this.getPanes()['overlayLayer'].appendChild(this.#div);
        }

        draw() {
            const projection = this.getProjection();
            if (!projection || !this.#div) return;

            const sw = projection.fromLatLngToDivPixel(this.#bounds.getSouthWest());
            const ne = projection.fromLatLngToDivPixel(this.#bounds.getNorthEast());

            Object.assign(this.#div.style, {
                left: `${sw.x}px`,
                top: `${ne.y}px`,
                width: `${ne.x - sw.x}px`,
                height: `${sw.y - ne.y}px`
            });
        }

        onRemove() {
            if (this.#div?.parentNode) {
                this.#div.parentNode.removeChild(this.#div);
            }
        }

        setOpacity(opacity) {
            this.#img.style.opacity = opacity;
        }

        setSource(src) {
            this.#img.src = src;
        }

        show() {
            this.setMap(this.#map);
        }

        hide() {
            this.setMap(null);
        }

        destroy() {
            this.setMap(null);
            this.#div = null;
            this.#img = null;
            this.#bounds = null;
            this.#map = null;
        }
    };

    return MRMSOverlay;
}
