import { RasterTileLayer } from './base/RasterTileLayer.js';
import { mapReady } from '../components/map.js';

let terrainLayer = null;

mapReady.then(() => {
    terrainLayer = new RasterTileLayer({
        name: 'Terrain',
        urlTemplate: (x, y, z) => `https://visualriver.net/api-common/tile?name=hillshade&zxy=/${z}/${x}/${y}`
    });

    const layerItemElement = document.querySelector('[data-layer="terrain"]');
    const toggle = layerItemElement.querySelector('.toggle-switch input');
    const slider = layerItemElement.querySelector('input[type="range"]');
    const opacityLabel = layerItemElement.querySelector('#terrain-opacity-label');

    toggle.addEventListener('change', (e) => {
        e.target.checked ? terrainLayer.setMap(map) : terrainLayer.setMap(null);
    });

    slider.addEventListener('change', (e) => {
        const newOpacity = e.target.value;
        terrainLayer.setOpacity(newOpacity / 100);
        opacityLabel.textContent = newOpacity + "%";
    });
});