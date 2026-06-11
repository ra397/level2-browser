import {getCurrentFrameTime} from "./barChart.js";
import './loading-screen.js';

// const decodeBtn = document.getElementById('decodeBtn');
const urlInput = document.getElementById('urlInput');
const sweepContainer = document.getElementById('sweepContainer');
const momentContainer = document.getElementById('momentContainer');
const momentList = document.getElementById('momentList');
const overlayControls = document.getElementById('overlayControls');
const opacitySlider = document.getElementById('opacitySlider');
const opacityValue = document.getElementById('opacityValue');
const toggleLayerBtn = document.getElementById('toggleLayerBtn');
const clearOverlayBtn = document.getElementById('clearOverlayBtn');

// New Level II workflow elements
const level2Instructions = document.getElementById('level2-instructions');
const level2RadarSelection = document.getElementById('level2-radar-selection');
const selectedRadarIdEl = document.getElementById('selectedRadarId');
const volumeSweepTimestampEl = document.getElementById('volumeSweepTimestamp');
const currentSweepDisplay = document.getElementById('currentSweepDisplay');
const viewLevel2Btn = document.getElementById('viewLevel2Btn');

// d-pad
const dpadUp = document.getElementById('dpadUp');
const dpadDown = document.getElementById('dpadDown');
const dpadLeft = document.getElementById('dpadLeft');
const dpadRight = document.getElementById('dpadRight');

let selectedRadar = null;
let mrmsMode = false; // Track if we're in MRMS mode
let currentSweeps = [];  // Array of sweep objects
let currentSweepIndex = 0;
let currentVolumeFiles = [];   // Array of file keys for current day
let currentVolumeIndex = -1;   // Index of current file in the array
let currentVolumeRadarId = null; // Radar ID for current volume list
let currentVolumeDate = null;  // Date object for current volume list
let loadedRadarIds = new Set();

let currentTimezone = 'local';
let currentRadarTimestamp = null;

document.addEventListener('timezone-change', (event) => {
    const { timezone } = event.detail;
    currentTimezone = timezone;
    updateTimestampDisplay();
});

function updateTimestampDisplay() {
    if (currentRadarTimestamp) {
        volumeSweepTimestampEl.textContent = formatLevel2Timestamp(currentRadarTimestamp);
    }
}

function formatLevel2Timestamp(date) {
    if (!date) return '--';

    if (currentTimezone === 'utc') {
        return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    } else {
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        };
        return date.toLocaleString('en-US', options).replace(',', '') + ' Local';
    }
}

dpadUp.addEventListener('click', () => {
    if (currentSweepIndex < currentSweeps.length - 1) {
        const newIndex = currentSweepIndex + 1;
        document.dispatchEvent(new CustomEvent('sweep-changed', { detail: { index: newIndex } }));
    }
});

// D-pad down button - decrease sweep index
dpadDown.addEventListener('click', () => {
    if (currentSweepIndex > 0) {
        const newIndex = currentSweepIndex - 1;
        document.dispatchEvent(new CustomEvent('sweep-changed', { detail: { index: newIndex } }));
    }
});

// D-pad left button - previous volume scan
dpadLeft.addEventListener('click', async () => {
    if (dpadLeft.disabled) return;
    await navigateToPreviousVolume();
});

// D-pad right button - next volume scan
dpadRight.addEventListener('click', async () => {
    if (dpadRight.disabled) return;
    await navigateToNextVolume();
});

function updateSweepDisplay(sweeps, sweepIndex) {
    currentSweeps = sweeps;
    currentSweepIndex = sweepIndex;

    if (!sweeps || sweeps.length === 0) {
        currentSweepDisplay.textContent = '--';
        dpadUp.disabled = true;
        dpadDown.disabled = true;
        return;
    }

    const sweep = sweeps[sweepIndex];
    currentSweepDisplay.textContent = `${sweepIndex} (${sweep.elevation.toFixed(1)}°)`;

    // Update button states
    dpadDown.disabled = sweepIndex === 0;
    dpadUp.disabled = sweepIndex === sweeps.length - 1;
}

const MOMENT_NAMES = {
    REF: 'Reflectivity',
    VEL: 'Velocity',
    SW: 'Spectrum Width',
    ZDR: 'Differential Reflectivity',
    PHI: 'Differential Phase',
    RHO: 'Correlation Coefficient',
    CFP: 'Clutter Filter Power Removed'
};

function populateMoments(moments, currentMoment) {
    momentList.innerHTML = '';
    moments.forEach(m => {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'moment';
        radio.value = m;
        if (m === currentMoment) radio.checked = true;
        label.appendChild(radio);
        label.append(` ${m} `);

        if (MOMENT_NAMES[m]) {
            label.title = MOMENT_NAMES[m];
        }

        momentList.appendChild(label);
    });
    momentContainer.style.display = '';
}

// Decode button click
// decodeBtn.addEventListener('click', () => {
//     const url = urlInput.value.trim();
//     if (!url) {
//         alert('Please enter a URL');
//         return;
//     }
//
//     decodeBtn.textContent = 'Decoding...';
//     decodeBtn.disabled = true;
//
//     document.dispatchEvent(new CustomEvent('decode-requested', { detail: { url } }));
// });

// Moment radio change
momentList.addEventListener('change', (e) => {
    const moment = e.target.value;
    document.dispatchEvent(new CustomEvent('moment-changed', { detail: { moment } }));
});

// Listen: decode-success
document.addEventListener('decode-success', async (e) => {
    layerVisible = true;
    toggleLayerBtn.textContent = 'Hide Layer';

    console.log("Setting to Hide Layer")

    popup.classList.add('hidden');
    
    const { radarId, sweeps, moments, currentMoment, url } = e.detail;

    // Track this radar as loaded
    loadedRadarIds.add(radarId);

    // Reset button but keep it disabled since this radar now has an overlay
    viewLevel2Btn.textContent = 'View Level II';
    

    level2Instructions.style.display = 'none';
    level2RadarSelection.style.display = 'block';

    sweepContainer.style.display = '';

    // decodeBtn.textContent = 'View';
    // decodeBtn.disabled = false;

    updateSweepDisplay(sweeps, 0);
    populateMoments(moments, currentMoment);
    overlayControls.style.display = '';

    selectedRadarIdEl.textContent = radarId;

    if (url) {
        const timestamp = extractLevel2Timestamp(url);
        if (timestamp) {
            currentRadarTimestamp = timestamp;
            volumeSweepTimestampEl.textContent = formatLevel2Timestamp(timestamp);
        } else {
            volumeSweepTimestampEl.textContent = '--';
            currentRadarTimestamp = null;
        }

        await updateVolumeFileList(radarId, url);
    }

    hideLoadingScreen();
});

// Listen: decode-error
document.addEventListener('decode-error', (e) => {
    const { message } = e.detail;

    // decodeBtn.textContent = 'Decode';
    // decodeBtn.disabled = false;

    // Reset View Level II button
    viewLevel2Btn.textContent = 'View Level II';
    viewLevel2Btn.disabled = false;

    hideLoadingScreen();

    alert('Error: ' + message);
});

// Listen: moments-updated
document.addEventListener('moments-updated', (e) => {
    const { moments, currentMoment, sweepIndex } = e.detail;
    populateMoments(moments, currentMoment);

    // Update sweep display with new index (the sweep may have changed)
    if (currentSweeps.length > 0 && sweepIndex !== undefined) {
        updateSweepDisplay(currentSweeps, sweepIndex);
    }
});

// Opacity slider change
opacitySlider.addEventListener('input', (e) => {
    const opacity = parseFloat(e.target.value);
    opacityValue.textContent = `${Math.round(opacity * 100)}%`;
    document.dispatchEvent(new CustomEvent('opacity-changed', { detail: { opacity } }));
});

// Toggle overlay button
let layerVisible = true;
toggleLayerBtn.addEventListener('click', () => {
    // layerVisible = !layerVisible;
    // toggleLayerBtn.textContent = layerVisible ? 'Hide Layer' : 'Show Layer';
    // document.dispatchEvent(new CustomEvent('toggle-layer', { detail: { visible: layerVisible } }));
    document.dispatchEvent(new CustomEvent('toggle-layer'));
});

// Clear overlay button
clearOverlayBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('clear-overlay'));
});

const clearAllBtn = document.getElementById('clearAllBtn');
clearAllBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('clear-all-overlays'));
});

// --- MRMS Mode / Radar Selection ---

// When MRMS data starts loading, switch to MRMS mode
document.addEventListener('mrms-files-total', () => {
    mrmsMode = true;
    level2Instructions.style.display = 'none';
    level2RadarSelection.style.display = 'block';
});

// When MRMS is cleared, switch back to manual mode
document.addEventListener('mrms-clear', () => {
    mrmsMode = false;
    selectedRadar = null;
    selectedRadarIdEl.textContent = '--';
    level2Instructions.style.display = 'block';
    level2RadarSelection.style.display = 'none';

    // Clear loaded radars tracking
    loadedRadarIds.clear();
    viewLevel2Btn.disabled = false;
    viewLevel2Btn.textContent = 'View Level II';
});

// When a radar is selected on the map
document.addEventListener('radar-selected', (e) => {
    selectedRadar = e.detail;
    selectedRadarIdEl.textContent = selectedRadar.id;

    // Enable button only if this radar doesn't already have an overlay
    const hasOverlay = loadedRadarIds.has(selectedRadar.id);

    viewLevel2Btn.disabled = hasOverlay;

    if (!hasOverlay) {
        sweepContainer.style.display = 'none';
        momentContainer.style.display = 'none';
        overlayControls.style.display = 'none';

        // Clear volume navigation state
        currentVolumeFiles = [];
        currentVolumeIndex = -1;
        currentVolumeRadarId = null;
        dpadLeft.disabled = true;
        dpadRight.disabled = true;
    }

    level2Instructions.innerHTML = `Selected radar: <b>${selectedRadar.id}</b>`;
});

document.addEventListener('radar-focused', async (e) => {
    const { radarId, radar, visible } = e.detail;

    if (!radar) {
        // No active radar - reset the entire Level II menu
        selectedRadarIdEl.textContent = '--';
        volumeSweepTimestampEl.textContent = '--';
        currentRadarTimestamp = null;
        updateSweepDisplay([], 0);
        sweepContainer.style.display = 'none';
        momentContainer.style.display = 'none';
        overlayControls.style.display = 'none';

        // Clear volume navigation state
        currentVolumeFiles = [];
        currentVolumeIndex = -1;
        currentVolumeRadarId = null;
        dpadLeft.disabled = true;
        dpadRight.disabled = true;

        // Clear loaded radars tracking
        loadedRadarIds.clear();

        // Reset View Level II button
        viewLevel2Btn.textContent = 'View Level II';
        viewLevel2Btn.disabled = false;

        // Reset selected radar
        selectedRadar = null;

        // Show instructions if not in MRMS mode, otherwise show radar selection
        if (mrmsMode) {
            level2RadarSelection.style.display = 'block';
        } else {
            level2Instructions.style.display = 'block';
            level2RadarSelection.style.display = 'none';
        }

        toggleLayerBtn.textContent = 'Hide Layer';
        console.log("Setting to Hide Layer")
        return;
    }

    selectedRadarIdEl.textContent = radarId;

    if (radar.timestamp) {
        currentRadarTimestamp = radar.timestamp;
        volumeSweepTimestampEl.textContent = formatLevel2Timestamp(currentRadarTimestamp);
    } else {
        volumeSweepTimestampEl.textContent = '--';
        currentRadarTimestamp = null;
    }

    // Update sweeps and moments for this radar
    if (radar.radar) {
        updateSweepDisplay(radar.radar.sweeps, radar.sweepIndex);
        const moments = radar.radar.getMomentsForSweep(radar.sweepIndex);
        populateMoments(moments, radar.moment);

        // Update opacity slider to match this radar's opacity
        opacitySlider.value = radar.opacity;
        opacityValue.textContent = `${Math.round(radar.opacity * 100)}%`;

        sweepContainer.style.display = '';

        // Update volume file list for this radar
        if (radar.url) {
            await updateVolumeFileList(radarId, radar.url);
        }
    }

    overlayControls.style.display = '';

    // Disable View Level II button since this radar has an overlay
    toggleLayerBtn.textContent = visible ? 'Hide Layer' : 'Show Layer';
    console.log(`Setting to ${visible} Layer`)
});

// Update overlay-cleared to handle partial clear
document.addEventListener('overlay-cleared', () => {
    // Only reset URL input, don't hide controls if there are still radars
    // urlInput.value = '';
});

// Listen for when no radars remain
document.addEventListener('radar-removed', (e) => {
    const { radarId } = e.detail;
    loadedRadarIds.delete(radarId);

    // If the currently selected radar was removed, re-enable the button
    if (selectedRadar && selectedRadar.id === radarId) {
        viewLevel2Btn.disabled = false;
    }
});

// View Level II button - fetch nearest file to current MRMS frame
const popup = document.getElementsByClassName("mrms-index-popup")[0];
viewLevel2Btn.addEventListener('click', async () => {
    if (!selectedRadar) {
        alert('Please select a radar station on the map first');
        return;
    }

    const frameTime = getCurrentFrameTime();

    if (!frameTime) {
        alert('No MRMS frame is currently displayed');
        return;
    }

    viewLevel2Btn.textContent = 'Finding nearest file...';

    try {
        const url = await findNearestLevel2File(selectedRadar.id, frameTime);

        if (url) {
            viewLevel2Btn.textContent = 'Decoding...';
            document.dispatchEvent(new CustomEvent('decode-requested', { detail: { url } }));
            // Note: Button stays disabled and showing "Decoding..." until decode-success
        } else {
            alert('No Level II file found near the selected time');
            viewLevel2Btn.textContent = 'View Level II';
            viewLevel2Btn.disabled = false;
        }
    } catch (err) {
        console.error('Error finding Level II file:', err);
        alert('Error: ' + err.message);
        viewLevel2Btn.textContent = 'View Level II';
        viewLevel2Btn.disabled = false;
    }
});


async function fetchFilesForDate(radarId, date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    const prefix = `${year}/${month}/${day}/${radarId}/`;
    const listUrl = `https://unidata-nexrad-level2.s3.amazonaws.com/?list-type=2&delimiter=/&prefix=${prefix}`;

    const response = await fetch(listUrl);
    const xmlString = await response.text();

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");

    const keyElements = xmlDoc.getElementsByTagName("Key");
    const files = [];

    for (let i = 0; i < keyElements.length; i++) {
        const key = keyElements[i].textContent;
        // Filter for actual data files (not MDM files)
        if (key.includes('_V0') && !key.includes('_MDM')) {
            files.push(key);
        }
    }

    // Sort files by timestamp
    files.sort((a, b) => {
        const tsA = extractLevel2Timestamp(a);
        const tsB = extractLevel2Timestamp(b);
        if (!tsA || !tsB) return 0;
        return tsA.getTime() - tsB.getTime();
    });

    return files;
}

async function updateVolumeFileList(radarId, currentUrl) {
    const timestamp = extractLevel2Timestamp(currentUrl);
    if (!timestamp) return;

    currentVolumeRadarId = radarId;
    currentVolumeDate = new Date(Date.UTC(
        timestamp.getUTCFullYear(),
        timestamp.getUTCMonth(),
        timestamp.getUTCDate()
    ));

    currentVolumeFiles = await fetchFilesForDate(radarId, currentVolumeDate);

    // Find current file index
    const currentFileKey = currentUrl.replace('https://unidata-nexrad-level2.s3.amazonaws.com/', '');
    currentVolumeIndex = currentVolumeFiles.indexOf(currentFileKey);

    updateDpadLeftRightState();
}

function updateDpadLeftRightState() {
    if (currentVolumeFiles.length === 0 || currentVolumeIndex === -1) {
        dpadLeft.disabled = true;
        dpadRight.disabled = true;
        return;
    }

    // Left is always enabled (can go to previous day)
    dpadLeft.disabled = false;
    // Right is always enabled (can go to next day, unless we're at "now")
    dpadRight.disabled = false;
}

async function navigateToPreviousVolume() {
    if (currentVolumeIndex > 0) {
        // Previous file in same day
        currentVolumeIndex--;
        const fileKey = currentVolumeFiles[currentVolumeIndex];
        const url = `https://unidata-nexrad-level2.s3.amazonaws.com/${fileKey}`;
        document.dispatchEvent(new CustomEvent('decode-requested', { detail: { url } }));
    } else {
        // Need to go to previous day
        dpadLeft.disabled = true;
        dpadRight.disabled = true;

        const prevDate = new Date(currentVolumeDate);
        prevDate.setUTCDate(prevDate.getUTCDate() - 1);

        const prevDayFiles = await fetchFilesForDate(currentVolumeRadarId, prevDate);

        if (prevDayFiles.length > 0) {
            currentVolumeDate = prevDate;
            currentVolumeFiles = prevDayFiles;
            currentVolumeIndex = prevDayFiles.length - 1; // Last file of previous day

            const fileKey = currentVolumeFiles[currentVolumeIndex];
            const url = `https://unidata-nexrad-level2.s3.amazonaws.com/${fileKey}`;
            document.dispatchEvent(new CustomEvent('decode-requested', { detail: { url } }));
        } else {
            alert('No data available for the previous day');
            updateDpadLeftRightState();
        }
    }
}

// Navigate to next volume scan
async function navigateToNextVolume() {
    if (currentVolumeIndex < currentVolumeFiles.length - 1) {
        // Next file in same day
        currentVolumeIndex++;
        const fileKey = currentVolumeFiles[currentVolumeIndex];
        const url = `https://unidata-nexrad-level2.s3.amazonaws.com/${fileKey}`;
        document.dispatchEvent(new CustomEvent('decode-requested', { detail: { url } }));
    } else {
        // Need to go to next day
        dpadLeft.disabled = true;
        dpadRight.disabled = true;

        const nextDate = new Date(currentVolumeDate);
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);

        // Don't allow navigating to future dates
        const now = new Date();
        if (nextDate > now) {
            alert('No future data available');
            updateDpadLeftRightState();
            return;
        }

        const nextDayFiles = await fetchFilesForDate(currentVolumeRadarId, nextDate);

        if (nextDayFiles.length > 0) {
            currentVolumeDate = nextDate;
            currentVolumeFiles = nextDayFiles;
            currentVolumeIndex = 0; // First file of next day

            const fileKey = currentVolumeFiles[currentVolumeIndex];
            const url = `https://unidata-nexrad-level2.s3.amazonaws.com/${fileKey}`;
            document.dispatchEvent(new CustomEvent('decode-requested', { detail: { url } }));
        } else {
            alert('No data available for the next day');
            updateDpadLeftRightState();
        }
    }
}

// Find the nearest Level II file to the given time
export async function findNearestLevel2File(radarId, targetTime) {
    const year = targetTime.getUTCFullYear();
    const month = String(targetTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(targetTime.getUTCDate()).padStart(2, '0');

    const prefix = `${year}/${month}/${day}/${radarId}/`;
    const listUrl = `https://unidata-nexrad-level2.s3.amazonaws.com/?list-type=2&delimiter=/&prefix=${prefix}`;

    const response = await fetch(listUrl);
    const xmlString = await response.text();

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");

    const keyElements = xmlDoc.getElementsByTagName("Key");
    const files = [];

    for (let i = 0; i < keyElements.length; i++) {
        const key = keyElements[i].textContent;
        // Filter for actual data files (not MDM files)
        if (key.includes('_V0') && !key.includes('_MDM')) {
            files.push(key);
        }
    }

    if (files.length === 0) {
        return null;
    }

    // Parse timestamps from filenames and find nearest
    // Format: YYYY/MM/DD/RADARID/RADARIDYYYYMMDD_HHMMSS_V0X
    const targetMs = targetTime.getTime();
    let bestFile = null;
    let bestDiff = Infinity;

    for (const file of files) {
        const timestamp = extractLevel2Timestamp(file);
        if (timestamp) {
            const diff = Math.abs(timestamp.getTime() - targetMs);
            // Only consider files that are at or before the target time
            if (timestamp.getTime() <= targetMs && diff < bestDiff) {
                bestDiff = diff;
                bestFile = file;
            }
        }
    }

    // If no file before target, take the first file after
    if (!bestFile) {
        for (const file of files) {
            const timestamp = extractLevel2Timestamp(file);
            if (timestamp) {
                const diff = Math.abs(timestamp.getTime() - targetMs);
                if (diff < bestDiff) {
                    bestDiff = diff;
                    bestFile = file;
                }
            }
        }
    }

    if (bestFile) {
        return `https://unidata-nexrad-level2.s3.amazonaws.com/${bestFile}`;
    }

    return null;
}

export function extractLevel2Timestamp(filename) {
    // Format: YYYY/MM/DD/RADARID/RADARIDYYYYMMDD_HHMMSS_V0X
    const match = filename.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_V\d+/);
    if (!match) return null;

    const [_, year, month, day, hour, minute, second] = match;
    return new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
    ));
}