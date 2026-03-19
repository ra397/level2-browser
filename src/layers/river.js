import { VectorTileLayer } from "./base/VectorTileLayer.js";
import { mapReady } from "../components/map.js";

mapReady.then(() => {
    const riverLayer = new VectorTileLayer(map, {
        name: 'River Network',
        urlTemplate: (zxy) => `https://visualriver.net/api-common/tile?name=nhd-usgs-connect&zxy=/${zxy}`,
        extent: { west: -124.642, south: 25.41, east: -67.058, north: 49.364 },
        minZoom: 4,
        maxZoom: 12,
        style: {
            strokeColor: '#46bcec',
            strokeWeight: 1,
            strokeOpacity: 1.0
        },
    });

    const layerItemElement = document.querySelector('[data-layer="river-network"]');
    const toggle = layerItemElement.querySelector('.toggle-switch input');
    const opacitySlider = layerItemElement.querySelector('input[type="range"]');
    const opacityLabel = layerItemElement.querySelector('#river-network-opacity-label');
    const colorInput = layerItemElement.querySelector('input[type="color"]');
    const sizeInput = layerItemElement.querySelector('input[type="number"]');

    toggle.addEventListener('change', (e) => {
        e.target.checked ? riverLayer.show() : riverLayer.hide();
    });

    opacitySlider.addEventListener('change', (e) => {
        const newOpacity = e.target.value;
        riverLayer.setStyle({ strokeOpacity: newOpacity / 100 });
        opacityLabel.textContent = newOpacity + "%";
    });

    colorInput.addEventListener('change', (e) => {
        riverLayer.setStyle({ strokeColor: e.target.value });
    });

    sizeInput.addEventListener('input', (e) => {
        riverLayer.setStyle({ strokeWeight: parseFloat(e.target.value) });
    });
});