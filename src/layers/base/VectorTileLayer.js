import { pbfLayer } from "./pbfLayer.js";

export class VectorTileLayer {
    constructor(map, options = {}) {
        this.urlTemplate = options.urlTemplate;

        this.map = map;
        this.extent = options.extent;
        this.minZoom = options.minZoom || 0;
        this.maxZoom = options.maxZoom || 19;
        this.style = options.style || {};

        this.isVisible = false;

        this._pbfLayer = null;
        this._init();
    }

    _init() {
        this._pbfLayer = new pbfLayer({
            extent: this.extent,
            z_min: this.minZoom,
            z_max: this.maxZoom,
            data: null,
            check_exists: false,
            tileURL: this.urlTemplate,
        },  this.map);

        this._applyStyle();
    }

    _applyStyle() {
        const style = this.style;
        this._pbfLayer.tileStyle = (feature, data) => {
            const baseStyle = this._pbfLayer.defaultStyle();
            return { ...baseStyle, ...style };
        };
    }

    setStyle(newStyle) {
        this.style = { ...this.style, ...newStyle };

        if (this.isVisible) {
            this.hide();
            this._init();
            this.show();
        } else {
            this._applyStyle();
        }
    }

    show() {
        if (this._pbfLayer && !this.isVisible) {
            this._pbfLayer.show();
            this.isVisible = true;
        }
    }

    hide() {
        if (this._pbfLayer && this.isVisible) {
            this._pbfLayer.hide();
            this.isVisible = false;
        }
    }
}