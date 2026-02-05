document.addEventListener('DOMContentLoaded', () => {
    globalThis.map = new google.maps.Map(document.getElementById("map"), {
        center: {lat: 39.5, lng: -98.35},
        zoom: 5,
        minZoom: 4,
        maxZoom: 12,
        clickableIcons: false,
    });
    window.dispatchEvent(new CustomEvent('mapReady'));
});