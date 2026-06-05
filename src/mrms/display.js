// MRMS Display Module - renders MRMS data on the map
import { updateMRMSLegend, clearMRMSLegend } from "../components/legend.js";
import { mapReady } from "../components/map.js";
import { RasterGenerator } from "./rasterGenerator.js";
import { overlayInfo, getProductByS3Name, buildColorMap, scaleColorMap } from "./config.js";
import { getMRMSOverlay } from "./overlay.js";
// import { setSliderRange, setSliderValue, getPlaybackSpeed } from "../components/player/player.js";
import { getActiveFiles, getActiveFileCount, getActiveFile, hasFile, getFile } from "./api.js";
import {extractTimestampFromKey} from "../utils/util.js";

let overlay = null;
let currentIndex = 0;
let isPlaying = false;
let playInterval = null;

const speedIntervals = {
    0.5: 2000,
    1: 1000,
    2: 500,
    3: 333
};

// Image cache: fileName -> imageUrl
const imageCache = new Map();

// Initialize overlay when map is ready
mapReady.then(() => {
    const MRMSOverlay = getMRMSOverlay();
    overlay = new MRMSOverlay(overlayInfo.bbox, map);
    overlay.setSource(overlayInfo.transparentImgSrc);
    overlay.hide();
});

// --- Helper Functions ---

async function generateImageUrl(fileData) {
    const { data, productName, referenceValue, binaryScale, decimalScale } = fileData;
    const product = getProductByS3Name(productName);

    if (!product) {
        console.error('Unknown product:', productName);
        return null;
    }

    const colorMap = buildColorMap(product);
    const scaledColorMap = scaleColorMap(colorMap, referenceValue, binaryScale, decimalScale);
    const raster = new RasterGenerator(data, overlayInfo.numCols, overlayInfo.numRows, scaledColorMap);
    return await raster.generateUrl();
}

async function getOrGenerateImage(fileName) {
    if (imageCache.has(fileName)) {
        return imageCache.get(fileName);
    }

    const fileData = getFile(fileName);
    if (!fileData) return null;

    const imageUrl = await generateImageUrl(fileData);
    imageCache.set(fileName, imageUrl);
    return imageUrl;
}

function displayFrame(index) {
    const activeFiles = getActiveFiles();
    if (index < 0 || index >= activeFiles.length) return;

    const fileName = activeFiles[index];

    if (imageCache.has(fileName)) {
        overlay.setSource(imageCache.get(fileName));
        currentIndex = index;
        setSliderValue(index);

        document.dispatchEvent(new CustomEvent('frame-changed', {
            detail: { filename: fileName }
        }));
    }
}

// --- Event Handlers ---

document.addEventListener('mrms-files-total', event => {
    const { total, fileNames } = event.detail;
    setSliderRange(0, total - 1);
    imageCache.clear();
});

document.addEventListener('mrms-display-file', async event => {
    const { file_name, file_data, product_name, referenceValue, binaryScale, decimalScale } = event.detail;

    // Update legend with product info
    const product = getProductByS3Name(product_name);
    if (product) {
        updateMRMSLegend(product.thresholds, product.defaultColors, product.units);
    }

    // Generate image
    const fileData = {
        data: file_data,
        productName: product_name,
        referenceValue,
        binaryScale,
        decimalScale,
    };

    const imageUrl = await generateImageUrl(fileData);
    imageCache.set(file_name, imageUrl);

    // Display if this is the first file or current frame
    const activeFiles = getActiveFiles();
    const fileIndex = activeFiles.indexOf(file_name);

    if (fileIndex === 0 || fileIndex === currentIndex) {
        if (!isPlaying) {
            overlay.show();
            overlay.setSource(imageUrl);
            currentIndex = fileIndex;
            setSliderValue(fileIndex);

            document.dispatchEvent(new CustomEvent('frame-changed', {
                detail: { filename: file_name }
            }));
        }
    }
});

// Opacity changed
document.addEventListener('mrms-opacity-changed', (e) => {
    const { opacity } = e.detail;
    if (overlay) {
        overlay.setOpacity(opacity);
    }
});

document.addEventListener("mrms-clear", () => {
    currentIndex = 0;
    pause();
    imageCache.clear();
    if (overlay) {
        overlay.hide();
    }
    clearMRMSLegend();
    document.dispatchEvent(new CustomEvent('display-reset'));
});

// --- Mode Switching ---

document.addEventListener('mode-changed', (e) => {
    const { mode } = e.detail;

    if (mode === 'mrms') {
        // Show MRMS overlay if we have data
        const activeFiles = getActiveFiles();
        if (activeFiles.length > 0 && overlay) {
            overlay.show();
            // Re-display current frame and update timestamp
            const fileName = activeFiles[currentIndex];
            if (fileName && imageCache.has(fileName)) {
                overlay.setSource(imageCache.get(fileName));
                setSliderValue(currentIndex);
                document.dispatchEvent(new CustomEvent('frame-changed', {
                    detail: { filename: fileName }
                }));
            }
        }
    } else {
        // Hide MRMS overlay when switching away
        pause();
        if (overlay) {
            overlay.hide();
        }
    }
});

// --- Playback Controls ---

function play() {
    if (isPlaying) return;
    isPlaying = true;

    const speed = getPlaybackSpeed();
    const interval = speedIntervals[speed] || 1000;

    playInterval = setInterval(() => {
        let nextIndex = currentIndex + 1;
        if (nextIndex >= getActiveFileCount()) {
            nextIndex = 0;
        }

        const fileName = getActiveFile(nextIndex);

        if (imageCache.has(fileName)) {
            displayFrame(nextIndex);
        }
    }, interval);
}

function pause() {
    isPlaying = false;
    if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
    }
}

document.addEventListener('player-play', () => play());
document.addEventListener('player-pause', () => pause());

document.addEventListener('playback-speed-change', event => {
    if (isPlaying) {
        pause();
        play();
    }
});

document.addEventListener('player-seek', event => {
    displayFrame(event.detail.index);
});

// Export current frame info for Level II lookup
export function getCurrentFrameTime() {
    const activeFiles = getActiveFiles();
    if (activeFiles.length === 0 || currentIndex >= activeFiles.length) {
        return null;
    }

    const fileName = activeFiles[currentIndex];
    try {
        return extractTimestampFromKey(fileName);
    } catch (e) {
        return null;
    }
}

export { displayFrame };
