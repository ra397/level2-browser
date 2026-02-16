import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

let loaderPromise;
function loadGoogleMaps() {
    if (globalThis.google?.maps) return Promise.resolve(globalThis.google);
    if (loaderPromise) return loaderPromise;

    const google_key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
    const google_libs = import.meta.env.VITE_GOOGLE_MAPS_LIBS.split(',');
    setOptions({ key: google_key });
    loaderPromise = (async () => {
        await Promise.all(google_libs.map(lib => importLibrary(lib.trim())));
        return globalThis.google;
    })();
    return loaderPromise;
}

export const mapReady = loadGoogleMaps().then(google => {
    globalThis.map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 39.5, lng: -98.35 },
        zoom: 5,
        minZoom: 4,
        maxZoom: 22,
        clickableIcons: false,
    });
    window.dispatchEvent(new CustomEvent('mapReady')); // Keep for backwards compat
    return map;
});

// Still await for modules that import map.js directly
await mapReady;