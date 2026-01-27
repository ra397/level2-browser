import './style.css';
import {NexradLevel2} from "./decoder/NexradLevel2.js";
import {polarToCartesian} from "./decoder/polarToCartesian.js";
import {ImgGenerator} from "./displayer/ImgGenerator.js";
import {customOverlay} from "./displayer/customOverlay.js";

document.addEventListener('DOMContentLoaded', () => {
    globalThis.map = new google.maps.Map(document.getElementById("map"), {
        center: {lat: 39.5, lng: -98.35},
        zoom: 5,
        minZoom: 4,
        maxZoom: 12,
        clickableIcons: false,
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
const defaultReflectivityColorMap = [
    { min: -35, max: 10, rgba: [106, 90, 205, 255] },
    { min: 10, max: 12, rgba: [72, 61, 139, 255] },
    { min: 12, max: 14, rgba: [70, 130, 180, 255] },
    { min: 14, max: 16, rgba: [95, 158, 160, 255] },
    { min: 16, max: 18, rgba: [0, 139, 139, 255] },
    { min: 18, max: 20, rgba: [34, 139, 34, 255] },
    { min: 20, max: 22, rgba: [60, 179, 113, 255] },
    { min: 22, max: 24, rgba: [107, 142, 35, 255] },
    { min: 24, max: 26, rgba: [154, 205, 50, 255] },
    { min: 26, max: 28, rgba: [205, 173, 0, 255] },
    { min: 28, max: 30, rgba: [255, 215, 0, 255] },
    { min: 30, max: 32, rgba: [255, 255, 0, 255] },
    { min: 32, max: 34, rgba: [255, 165, 0, 255] },
    { min: 34, max: 36, rgba: [255, 140, 0, 255] },
    { min: 36, max: 38, rgba: [255, 127, 0, 255] },
    { min: 38, max: 40, rgba: [255, 99, 71, 255] },
    { min: 40, max: 42, rgba: [255, 69, 0, 255] },
    { min: 42, max: 44, rgba: [226, 1, 30, 255] },
    { min: 44, max: 46, rgba: [200, 6, 30, 255] },
    { min: 46, max: 48, rgba: [185, 1, 30, 255] },
    { min: 48, max: 50, rgba: [252, 156, 156, 255] },
    { min: 50, max: 52, rgba: [255, 182, 193, 255] },
    { min: 52, max: 54, rgba: [238, 130, 238, 255] },
    { min: 54, max: 56, rgba: [219, 112, 147, 255] },
    { min: 56, max: 58, rgba: [218, 112, 214, 255] },
    { min: 58, max: 60, rgba: [186, 85, 211, 255] },
    { min: 60, max: 62, rgba: [153, 50, 204, 255] },
    { min: 62, max: 64, rgba: [160, 32, 240, 255] },
    { min: 64, max: 66, rgba: [159, 121, 238, 255] },
    { min: 66, max: 68, rgba: [171, 130, 255, 255] },
    { min: 68, max: 70, rgba: [138, 143, 255, 255] },
    { min: 70, max: 72, rgba: [54, 62, 255, 255] },
    { min: 72, max: 74, rgba: [45, 48, 122, 255] },
    { min: 74, max: 76, rgba: [45, 48, 82, 255] },
    { min: 76, max: 78, rgba: [32, 40, 44, 255] },
    { min: 78, max: 80, rgba: [0, 0, 0, 255] },
    { min: 80, max: 82, rgba: [64, 64, 64, 255] },
    { min: 82, max: 84, rgba: [102, 102, 102, 255] },
    { min: 84, max: 86, rgba: [140, 140, 140, 255] },
    { min: 86, max: 88, rgba: [179, 179, 179, 255] },
    { min: 88, max: 90, rgba: [204, 204, 204, 255] },
    { min: 90, max: 92, rgba: [230, 230, 230, 255] },
    { min: 92, max: 94, rgba: [255, 255, 255, 255] },
    { min: 94, max: Infinity, rgba: [179, 179, 255, 255] },
];
console.time("Fetching data");
const rawData = await loadData(url);
console.timeEnd("Fetching data");

console.time("Decoding data");
const radar = new NexradLevel2(rawData);
const radarData = radar.getData(0, "REF");
console.timeEnd("Decoding data");

console.time("Converting from polar to cartesian");
const cartesianReflectivity = polarToCartesian(radarData.data, radarData.azimuths, radarData.ranges, 2000);
console.timeEnd("Converting from polar to cartesian");

console.time("Generating image");
const imgGen = new ImgGenerator();
const imgUrl = await imgGen.generateImage(cartesianReflectivity, 2000, 2000, defaultReflectivityColorMap);
console.timeEnd("Generating image");

const bounds = {
    "sw": {
        "lat": 39.42100608729517,
            "lng": -93.43410232792675
    },
    "ne": {
        "lat": 43.755004878284836,
            "lng": -87.56683969618199
    }
};
console.time("Displaying image on map");
const overlay = customOverlay(imgUrl, bounds, map);
console.timeEnd("Displaying image on map");

console.log(radar.sweeps)