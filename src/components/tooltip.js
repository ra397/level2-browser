import {latLngToRadarIndex} from "../displayer/radarGl.js";

let TooltipOverlay = null;

function getTooltipOverlay() {
    if (TooltipOverlay) return TooltipOverlay;

    TooltipOverlay = class extends google.maps.OverlayView {
        #position;
        #content;
        #div;
        #onClose;

        constructor(position, content, map, onClose) {
            super();
            this.#position = position;
            this.#content = content;
            this.#div = null;
            this.#onClose = onClose;
            this.setMap(map);
        }

        onAdd() {
            this.#div = document.createElement('div');
            this.#div.className = 'product-tooltip';

            const content = document.createElement('span');
            content.className = 'product-tooltip-content';
            content.textContent = this.#content;

            const closeBtn = document.createElement('span');
            closeBtn.className = 'product-tooltip-close';
            closeBtn.textContent = '×';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.#onClose?.();
            });

            this.#div.appendChild(content);
            this.#div.appendChild(closeBtn);
            this.getPanes().floatPane.appendChild(this.#div);
        }

        draw() {
            const projection = this.getProjection();
            if (!projection || !this.#div) return;

            const pos = projection.fromLatLngToDivPixel(this.#position);
            this.#div.style.left = `${pos.x}px`;
            this.#div.style.top = `${pos.y}px`;
        }

        onRemove() {
            if (this.#div?.parentNode) {
                this.#div.parentNode.removeChild(this.#div);
                this.#div = null;
            }
        }

        setContent(content) {
            this.#content = content;
            if (this.#div) {
                const contentEl = this.#div.querySelector('.product-tooltip-content');
                if (contentEl) contentEl.textContent = content;
            }
        }

        destroy() {
            this.setMap(null);
        }
    };

    return TooltipOverlay;
}

// Inject tooltip CSS
const style = document.createElement('style');
style.textContent = `
      .product-tooltip {
          position: absolute;
          transform: translate(-50%, -100%) translateY(-8px);
          background: white;
          border: 1px solid #ccc;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 12px;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          display: flex;
          align-items: center;
          gap: 6px;
          pointer-events: auto;
      }
      .product-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 6px solid transparent;
          border-top-color: white;
      }
      .product-tooltip::before {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 7px solid transparent;
          border-top-color: #ccc;
      }
      .product-tooltip-close {
          cursor: pointer;
          color: #999;
          font-size: 14px;
          line-height: 1;
      }
      .product-tooltip-close:hover {
          color: #333;
      }
  `;
document.head.appendChild(style);

function formatValue(value, units) {
    if (value === null || isNaN(value)) {
        return 'No Data';
    }
    return `${value.toFixed(1)} ${units}`;
}

function makeKey(azimuthIndex, rangeIndex) {
    return `${azimuthIndex}:${rangeIndex}`;
}

// Map<"azimuthIndex:rangeIndex", { overlay, lat, lng, azimuthIndex, rangeIndex }>
const openTooltips = new Map();

export const tooltipManager = {
    hasTooltip(azimuthIndex, rangeIndex) {
        return openTooltips.has(makeKey(azimuthIndex, rangeIndex));
    },

    createTooltip(azimuthIndex, rangeIndex, lat, lng, value, units) {
        const key = makeKey(azimuthIndex, rangeIndex);
        const position = new google.maps.LatLng(lat, lng);
        const onClose = () => this.destroyTooltip(azimuthIndex, rangeIndex);
        const Overlay = getTooltipOverlay();
        const overlay = new Overlay(position, formatValue(value, units), globalThis.map, onClose);
        openTooltips.set(key, { overlay, lat, lng, azimuthIndex, rangeIndex });
    },

    destroyTooltip(azimuthIndex, rangeIndex) {
        const key = makeKey(azimuthIndex, rangeIndex);
        const tooltip = openTooltips.get(key);
        if (tooltip) {
            tooltip.overlay.destroy();
            openTooltips.delete(key);
        }
    },

    toggleTooltip(azimuthIndex, rangeIndex, lat, lng, value, units) {
        if (this.hasTooltip(azimuthIndex, rangeIndex)) {
            this.destroyTooltip(azimuthIndex, rangeIndex);
        } else {
            this.createTooltip(azimuthIndex, rangeIndex, lat, lng, value, units);
        }
    },

    updateAllTooltips(radarData, units, stationLat, stationLng) {
        const numRanges = radarData.ranges.length;

        openTooltips.forEach((tooltip, key) => {
            // Recalculate indices from lat/lng for new sweep data
            const indices = latLngToRadarIndex(
                tooltip.lat, tooltip.lng,
                stationLat, stationLng,
                radarData.azimuths, radarData.ranges
            );

            if (!indices) {
                tooltip.overlay.setContent('Out of range');
                return;
            }

            // Update stored indices to match new data
            tooltip.azimuthIndex = indices.azimuthIndex;
            tooltip.rangeIndex = indices.rangeIndex;

            const dataIndex = indices.azimuthIndex * numRanges + indices.rangeIndex;
            const value = radarData.data[dataIndex];
            tooltip.overlay.setContent(formatValue(value, units));
        });
    },

    getOpenTooltips() {
        return Array.from(openTooltips.values());
    },

    clearAll() {
        openTooltips.forEach(tooltip => tooltip.overlay.destroy());
        openTooltips.clear();
    }
};