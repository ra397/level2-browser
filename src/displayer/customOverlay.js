export class TiledRasterLayer {
    constructor(map, name, urlTemplate, options = {}) {
        this.layer = null;
        this.map = map;
        this.name = name || 'Custom Tile Layer';
        this.urlTemplate = urlTemplate;           // URL template with placeholders for zoom (z), x, and y tile coordinates.
                                                  // Example: '/tiles/{z}/{x}/{y}.png'
        // Optional settings
        this.tms_style  = options?.tms_style || false;
        this.tileSize = options?.tileSize || new google.maps.Size(256, 256);
        this.minZoom = options?.minZoom || 5;
        this.maxZoom = options?.maxZoom || 18;
        this.divClass = options?.divClass || null;
        this.imgClass = options?.divClass || null;
    }
    getURL = (e, z) => {
        const zxy = {
            "z": z,
            "x": e.x,
            "y": this.tms_style ? (1 << z) - e.y - 1 : e.y
        };
        return this.urlTemplate.replace(/\{(\w+)\}/g, (_, key) => zxy[key] ?? '');
    }
    #createLayer() {
        return new google.maps.ImageMapType({
            getTileUrl: this.getURL,
            tileSize:   this.tileSize,
            minZoom:    this.minZoom,
            maxZoom:    this.maxZoom,
            name:       this.name
        });
    }

    isVisible() {
        let visible = false;
        this.map.overlayMapTypes.forEach((layer) => {
            if (layer && layer.name === this.name) {
                visible = true;
            }
        });
        return visible;
    }

    show() {
        this.hide();
        this.layer = this.#createLayer();
        this.map.overlayMapTypes.insertAt(0, this.layer);
    }

    hide() {
        this.map.overlayMapTypes.forEach((layer, i) => {
            if (layer.name === this.name) {
                this.map.overlayMapTypes.removeAt(i);
            }
        });
    };

    setMap  = (map) => !map ? this.hide() : this.show();

    destroy() {
        this.setMap(null);
        this.unbindAll();
        this.urlTemplate = null
        // Optional settings
        this.tms_style  = null;
        this.tileSize = null;
        this.minZoom = null;
        this.maxZoom = null;
    }

    update(urlTemplate) {
        if (urlTemplate) this.urlTemplate = urlTemplate;
        this.show();
    }

    setSource = this.update

    setOpacity = (val) => this.layer.setOptions({ opacity: val})

}

const cssMercatorOverlay = [
    {'.overlayDiv': "position: absolute; border-style: none; border-width: 0px; image-rendering: pixelated;"},
    {'.overlayImg': "position: absolute; width: 100%; height: 100%;"},
    {'.imgSmooth':  "image-rendering: auto;"}
];

///  use for image created in WGS84
export class GeoOverlay extends google.maps.GroundOverlay {
    constructor(image, bounds, map) {
        super(image, bounds);
        this.setMap(map);
    }
    remove() {
        this.setMap(null);
    }
    destroy() {
        this.setMap(null);
        this.unbindAll();
        this.image = null;
        this.bounds = null;
        this.set('url', null);
    }

    update(src) {
        this.set('url', src);
        this.setMap(this.getMap());
    }
    setSource = this.update
}

///  use for image created in WebMercator
export class MercatorOverlay extends google.maps.OverlayView {
    static cssInjected = false;

    #bounds;
    #div;
    #img;
    #pane;
    #map;
    #numCols;
    #numRows;

    constructor(image, bounds, map, smooth = false, pane = 'overlayMouseTarget', numCols = 1924, numRows = 1128) {
        super();

        if (!MercatorOverlay.cssInjected && cssMercatorOverlay) {
            cssMercatorOverlay.forEach(obj => {
                const [selector, rules] = Object.entries(obj)[0];
                this.#injectCSS(selector, rules);
            });
            MercatorOverlay.cssInjected = true;
        }

        this.#bounds = bounds;
        this.#pane = pane;
        this.#map = map;
        this.#numCols = numCols;
        this.#numRows = numRows;

        this.#div = document.createElement('div');
        this.#div.className = 'overlayDiv';

        this.#img = document.createElement('img');
        this.#img.className = 'overlayImg';
        if (smooth) this.#img.classList.add('imgSmooth');
        this.#img.src = image;

        this.#div.appendChild(this.#img);
        this.#div.addEventListener('mousedown', this.#handleMouseDown.bind(this));
        this.#div.addEventListener('mouseup', this.#handleMouseUp.bind(this));
        this.setMap(map);
    }

    #mouseDownPos = null;

    #handleMouseDown(event) {
        this.#mouseDownPos = { x: event.clientX, y: event.clientY };
    }

    #handleMouseUp(event) {
        // Ignore if this was a drag (mouse moved more than 5 pixels)
        if (this.#mouseDownPos) {
            const dx = event.clientX - this.#mouseDownPos.x;
            const dy = event.clientY - this.#mouseDownPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 5) {
                this.#mouseDownPos = null;
                return;
            }
        }
        this.#mouseDownPos = null;

        const rect = this.#div.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const gridX = Math.floor(x / rect.width * this.#numCols);
        const gridY = Math.floor(y / rect.height * this.#numRows);

        // Get exact lat/lng from Google Maps projection
        const projection = this.getProjection();
        const mapDiv = this.#map.getDiv().getBoundingClientRect();
        const pixelX = event.clientX - mapDiv.left;
        const pixelY = event.clientY - mapDiv.top;
        const latLng = projection.fromContainerPixelToLatLng(new google.maps.Point(pixelX, pixelY));

        document.dispatchEvent(new CustomEvent('overlay-click', {
            detail: { gridX, gridY, lat: latLng.lat(), lng: latLng.lng() }
        }));
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
        this.getPanes()[this.#pane].appendChild(this.#div);
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

    remove() {
        this.setMap(null);
    }

    setOpacity(opacity) {
        this.#img.style.opacity = opacity;
    }

    update(src) {
        this.#img.src = src;
    }

    setSource = this.update;

    show() {
        this.setMap(this.#map);
    }

    hide() {
        this.setMap(null);
    }

    destroy() {
        this.remove();
        this.unbindAll();
        this.#div = null;
        this.#img = null;
        this.#bounds = null;
        this.#map = null;
    }

}

export function customOverlay(image_url, bounds, map, type = 'OverlayView', smooth = false, pane='overlayMouseTarget') {
    if (typeof bounds.extend !== 'function' && bounds.sw && bounds.ne) {
        bounds = new google.maps.LatLngBounds(bounds.sw, bounds.ne);
    }

    return type === 'OverlayView'
        ? new MercatorOverlay(image_url, bounds, map, smooth, pane)
        : new GeoOverlay(image, bounds, map);
}