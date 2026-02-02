import './style.css';
import {NexradLevel2} from "./decoder/NexradLevel2.js";
import {MarkerCollection} from "./displayer/markerCollection.js";
import {buildColorLUT, RadarMapOverlay, REF_PALETTE} from "./displayer/radarGl.js";

const radarPos = {lat: 41.611568075614784, lng: -90.58089555033914};
const radarRange = 460e3;

document.addEventListener('DOMContentLoaded', () => {
    globalThis.map = new google.maps.Map(document.getElementById("map"), {
        center: {lat: 39.5, lng: -98.35},
        zoom: 5,
        minZoom: 4,
        maxZoom: 12,
        clickableIcons: false,
    });
    new google.maps.Circle({
        strokeColor: "#FF0000",
        strokeOpacity: 0.8,
        strokeWeight: 1,
        fillColor: "#FF0000",
        fillOpacity: 0,
        map: map,
        center: radarPos,
        radius: radarRange,
    });
});

const url = 'https://unidata-nexrad-level2.s3.amazonaws.com/2025/08/12/KDVN/KDVN20250812_041552_V06';

async function loadData(url) {
    try {
        const response = await fetch(url);
        return await response.arrayBuffer();
    } catch (error) {
        console.error(error);
    }
}

console.time("Fetching data");
const rawData = await loadData(url);
console.timeEnd("Fetching data");

console.time("Decoding data");
const radar = new NexradLevel2(rawData);

const sweepIndex = radar.sweeps[0].index;

const radarData = radar.getData(sweepIndex, "REF");
console.timeEnd("Decoding data");

console.time("Displaying data");
const radarOverlay = new RadarMapOverlay(map, (overlay) => {
    const colors = buildColorLUT(REF_PALETTE, -35, 95);
    overlay.setColors(colors);
    overlay.setRadarPosition(radarPos.lat, radarPos.lng, radar.sweeps[sweepIndex].elevation);

    overlay.loadData(
        radarData.azimuths,
        radarData.ranges,
        radarData.data,
        { minValue: -35, maxValue: 95 }
    );
});
console.timeEnd("Displaying data");
radarOverlay.setOpacity(1);

const markers = new MarkerCollection(map);
markers.add(radarPos.lat, radarPos.lng);
markers.setSize(4);
markers.setColor('red');