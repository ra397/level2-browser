import {MarkerCollection} from "../displayer/markerCollection.js";
import {mapReady} from "./map.js";
import './nexradHover.js';

// NEXRAD markers
let nexradMarkers = null;

mapReady.then(() => {
    nexradMarkers = new MarkerCollection(map, {
        selectable: true,
        selectedColor: "#FFED29"
    });
    document.addEventListener('nexradStationsReady', (e) => {
        const stations = e.detail;
        for (const station of stations) {
            nexradMarkers.add(station.lat, station.lng, {
                id: station.id,
                name: station.name,
            });
        }

        nexradMarkers.setColor("red");
        nexradMarkers.setSize(4.0);

        // Add menu listeners for NEXRAD layer controls
        const layerItemElement = document.querySelector('[data-layer="nexrad"]');
        if (layerItemElement) {
            const toggle = layerItemElement.querySelector('.toggle-switch input');
            const colorInput = layerItemElement.querySelector('input[type="color"]');
            const sizeInput = layerItemElement.querySelector('input[type="number"]');

            // Sync initial values
            colorInput.value = nexradMarkers.getColor();
            sizeInput.value = nexradMarkers.getSize();

            toggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    nexradMarkers.show();
                } else {
                    nexradMarkers.hide();
                }
            });

            colorInput.addEventListener('change', (e) => {
                nexradMarkers.setColor(e.target.value);
            });

            sizeInput.addEventListener('input', (e) => {
                nexradMarkers.setSize(parseFloat(e.target.value));
            });
        }

        // Handle marker clicks - select radar station
        nexradMarkers.onClick((markerObj) => {
            const radarId = markerObj.properties.id;

            nexradMarkers.select(markerObj);

            // Dispatch radar-selected for MRMS mode workflow
            document.dispatchEvent(new CustomEvent('radar-selected', {
                detail: {
                    id: radarId,
                    name: markerObj.properties.name,
                    lat: markerObj.marker.getPosition().lat(),
                    lng: markerObj.marker.getPosition().lng(),
                }
            }));

            // If this radar is already loaded, set it as active
            document.dispatchEvent(new CustomEvent('radar-marker-clicked', {
                detail: { radarId }
            }));
        });

        // Handle marker hover
        nexradMarkers.onHover((markerObj) => {
            const radarId = markerObj.properties.id;
            for (const station of stations) {
                if (radarId === station.id) {
                    document.dispatchEvent(new CustomEvent('radar-hover', {
                        detail: {
                            id: radarId,
                            name: station.name,
                            lat: station.lat,
                            lng: station.lng,
                        }
                    }));
                }
            }
        });

        nexradMarkers.onHoverOut((markerObj) => {
            const radarId = markerObj.properties.id;
            document.dispatchEvent(new CustomEvent('radar-hover-out', {
                detail: {
                    id: markerObj.properties.id,
                }
            }));
        });
    });
});

// Clear selection when MRMS is cleared or Level II is cleared
document.addEventListener('mrms-clear', () => {
    if (nexradMarkers) {
        nexradMarkers.clearSelection();
    }
});

document.addEventListener('clear-overlay', () => {
    if (nexradMarkers) {
        nexradMarkers.clearSelection();
    }
});

document.addEventListener('clear-all-overlays', () => {
    if (nexradMarkers) {
        nexradMarkers.clearSelection();
    }
});