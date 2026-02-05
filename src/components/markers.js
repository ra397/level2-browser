import {MarkerCollection} from "../displayer/markerCollection.js";

// NEXRAD markers
window.addEventListener("mapReady",() => {
    const nexradMarkers = new MarkerCollection(map);

    window.addEventListener('nexradStationsReady', (e) => {
        const stations = e.detail;
        for (const station of stations) {
            nexradMarkers.add(station.lat, station.lng, {
                id: station.id,
                name: station.name,
            });

            nexradMarkers.setColor("red");
            nexradMarkers.setSize(3.5);
        }
    });
});