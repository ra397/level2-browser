import {getTooltipOverlay} from "./tooltip.js";

let hoverTooltip = null;
let currentKey = null;
let hideTimer = null;

export const hoverTooltipManager = {
    show(lat, lng, text, key = text) {
        clearTimeout(hideTimer);
        hideTimer = null;

        if (currentKey === key && hoverTooltip) return;  // repeat mouseover, ignore
        currentKey = key;

        if (hoverTooltip) {
            hoverTooltip.setPosition(new google.maps.LatLng(lat, lng));
            hoverTooltip.setContent(text);
            return;
        }

        const Overlay = getTooltipOverlay();
        hoverTooltip = new Overlay(
            new google.maps.LatLng(lat, lng), text, globalThis.map, null, 'tooltip-label'
        );
    },

    hide(delay = 100) {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => this.hideNow(), delay);
    },

    hideNow() {
        clearTimeout(hideTimer);
        hideTimer = null;
        currentKey = null;
        if (hoverTooltip) {
            hoverTooltip.destroy();
            hoverTooltip = null;
        }
    }
};

document.addEventListener('radar-hover', (e) => {
    const { name, id, lat, lng } = e.detail;
    hoverTooltipManager.show(lat, lng, `${name} (${id})`);
});

document.addEventListener('radar-hover-out', () => {
    hoverTooltipManager.hide();
});