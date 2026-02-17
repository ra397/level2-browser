import {MarkerCollection} from "../displayer/markerCollection.js";
import {mapReady} from "./map.js";

// NEXRAD markers
let nexradMarkers = null;

mapReady.then(() => {
    nexradMarkers = new MarkerCollection(map);

    document.addEventListener('nexradStationsReady', (e) => {
        const stations = e.detail;
        for (const station of stations) {
            nexradMarkers.add(station.lat, station.lng, {
                id: station.id,
                name: station.name,
            });
        }

        nexradMarkers.setColor("red");
        nexradMarkers.setSize(3.5);

        // Handle marker clicks - select radar station
        nexradMarkers.onClick((markerObj) => {
            nexradMarkers.select(markerObj);
            document.dispatchEvent(new CustomEvent('radar-selected', {
                detail: {
                    id: markerObj.properties.id,
                    name: markerObj.properties.name,
                    lat: markerObj.marker.getPosition().lat(),
                    lng: markerObj.marker.getPosition().lng(),
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