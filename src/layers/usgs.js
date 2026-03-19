import { MarkerCollection } from "../displayer/markerCollection.js";
import { mapReady } from '../components/map.js';
import Pbf from 'pbf';
import geobuf from 'geobuf';

// You'll need to add a getMarkerSizeForZoom function or import it
function getMarkerSizeForZoom(zoom) {
    if (zoom <= 6) return 2.0;
    if (zoom <= 8) return 2.5;
    if (zoom <= 10) return 3.0;
    return 3.5;
}

let markers = null;
let sizeInput = null;

mapReady.then(async () => {
    markers = new MarkerCollection(map);
    markers.setColor("#008000");
    markers.setSize(getMarkerSizeForZoom(map.getZoom()));

    const response = await fetch(`${import.meta.env.BASE_URL}data/usgs_markers.pbf`);
    const arrayBuffer = await response.arrayBuffer();
    const pbf = new Pbf(arrayBuffer);
    const geojson = geobuf.decode(pbf);

    const currentBasin = {
        layer: null,
        id: null,
    };

    for (let i = 0; i < geojson.features.length; i++) {
        const feature = geojson.features[i];

        const lat = feature.geometry.coordinates[1];
        const lng = feature.geometry.coordinates[0];
        const id = feature.properties['usgs_id'];
        const name = feature.properties['name'];

        const markerObj = markers.add(lat, lng, {
            id: id,
            name: name,
        });

        markerObj.marker.addListener('click', () => {
            if (currentBasin.id) {
                if (currentBasin.id === markerObj.properties.id) {
                    currentBasin.layer.setMap(null);
                    currentBasin.layer = null;
                    currentBasin.id = null;
                } else {
                    currentBasin.layer.setMap(null);
                    currentBasin.layer = null;
                    currentBasin.id = null;
                    showBasin(markerObj.properties.id, currentBasin);
                }
            } else {
                showBasin(markerObj.properties.id, currentBasin);
            }
        });
    }

    markers.hide();

    // Add menu listeners
    const layerItemElement = document.querySelector('[data-layer="usgs"]');
    const toggle = layerItemElement.querySelector('.toggle-switch input');
    const colorInput = layerItemElement.querySelector('input[type="color"]');
    sizeInput = layerItemElement.querySelector('input[type="number"]');

    colorInput.value = markers.getColor();
    sizeInput.value = markers.getSize();

    toggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            markers.show();
        } else {
            markers.hide();
            if (currentBasin.id) {
                currentBasin.layer.setMap(null);
                currentBasin.layer = null;
                currentBasin.id = null;
            }
        }
    });

    document.dispatchEvent(new CustomEvent('usgs-markers-ready', {
        detail: { markers: markers, toggle: toggle }
    }));

    colorInput.addEventListener('change', (e) => {
        markers.setColor(e.target.value);
    });

    sizeInput.addEventListener('input', (e) => {
        markers.setSize(parseFloat(e.target.value));
    });

    map.addListener('zoom_changed', () => {
        const newSize = getMarkerSizeForZoom(map.getZoom());
        markers.setSize(newSize);
        if (sizeInput) sizeInput.value = newSize;
    });
});

async function showBasin(usgs_id, currentBasin) {
    const response = await fetch(`https://visualriver.net/wsr88/public/data/pbf_basins/${usgs_id}.pbf`);
    const arrayBuffer = await response.arrayBuffer();
    const geojson = geobuf.decode(new Pbf(new Uint8Array(arrayBuffer)));

    currentBasin.layer = new google.maps.Data({ map: map });
    currentBasin.layer.addGeoJson(geojson);
    currentBasin.layer.setStyle({
        fillColor: '#ccc',
        fillOpacity: 0.5,
        strokeColor: "black",
        strokeWeight: 1,
        clickable: false,
    });
    currentBasin.id = usgs_id;

    const bounds = new google.maps.LatLngBounds();
    currentBasin.layer.forEach((feature) => {
        feature.getGeometry().forEachLatLng((latLng) => {
            bounds.extend(latLng);
        });
    });
    map.fitBounds(bounds);
}