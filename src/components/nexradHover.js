import {getTooltipOverlay} from "./tooltip.js";

let hoverTooltip = null;
let showTimer = null;

export const hoverTooltipManager = {
    show(lat, lng, text, delay = 750) {
        clearTimeout(showTimer);
        showTimer = setTimeout(() => {
            this.hideNow();
            const Overlay = getTooltipOverlay();
            hoverTooltip = new Overlay(
                new google.maps.LatLng(lat, lng),
                text,
                globalThis.map,
                null
            );
        }, delay);
    },

    hide() {
        clearTimeout(showTimer);
        showTimer = null;
        this.hideNow();
    },

    hideNow() {
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