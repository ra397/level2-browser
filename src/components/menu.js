const decodeBtn = document.getElementById('decodeBtn');
const urlInput = document.getElementById('urlInput');
const sweepContainer = document.getElementById('sweepContainer');
const sweepList = document.getElementById('sweepList');
const momentContainer = document.getElementById('momentContainer');
const momentList = document.getElementById('momentList');
const overlayControls = document.getElementById('overlayControls');
const opacitySlider = document.getElementById('opacitySlider');
const opacityValue = document.getElementById('opacityValue');
const clearOverlayBtn = document.getElementById('clearOverlayBtn');

// New Level II workflow elements
const level2Instructions = document.getElementById('level2-instructions');
const level2RadarSelection = document.getElementById('level2-radar-selection');
const selectedRadarIdEl = document.getElementById('selectedRadarId');
const viewLevel2Btn = document.getElementById('viewLevel2Btn');
const level2Loading = document.getElementById('level2-loading');

let selectedRadar = null;
let mrmsMode = false; // Track if we're in MRMS mode

function populateSweeps(sweeps) {
    sweepList.innerHTML = '';
    sweeps.forEach((sweep, i) => {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'sweep';
        radio.value = i;
        if (i === 0) radio.checked = true;
        label.appendChild(radio);
        label.append(` Sweep ${sweep.index} (${sweep.elevation.toFixed(1)}°) `);
        sweepList.appendChild(label);
    });
    sweepContainer.style.display = '';
}

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
        momentList.appendChild(label);
    });
    momentContainer.style.display = '';
}

// Decode button click
decodeBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (!url) {
        alert('Please enter a URL');
        return;
    }

    decodeBtn.textContent = 'Decoding...';
    decodeBtn.disabled = true;

    document.dispatchEvent(new CustomEvent('decode-requested', { detail: { url } }));
});

// Sweep radio change
sweepList.addEventListener('change', (e) => {
    const index = parseInt(e.target.value);
    document.dispatchEvent(new CustomEvent('sweep-changed', { detail: { index } }));
});

// Moment radio change
momentList.addEventListener('change', (e) => {
    const moment = e.target.value;
    document.dispatchEvent(new CustomEvent('moment-changed', { detail: { moment } }));
});

// Listen: decode-success
document.addEventListener('decode-success', (e) => {
    const { sweeps, moments, currentMoment } = e.detail;

    decodeBtn.textContent = 'View';
    decodeBtn.disabled = false;

    populateSweeps(sweeps);
    populateMoments(moments, currentMoment);
    overlayControls.style.display = '';  // Add this line
});

// Listen: decode-error
document.addEventListener('decode-error', (e) => {
    const { message } = e.detail;

    decodeBtn.textContent = 'Decode';
    decodeBtn.disabled = false;

    alert('Error: ' + message);
});

// Listen: moments-updated
document.addEventListener('moments-updated', (e) => {
    const { moments, currentMoment } = e.detail;
    populateMoments(moments, currentMoment);
});

// Opacity slider change
opacitySlider.addEventListener('input', (e) => {
    const opacity = parseFloat(e.target.value);
    opacityValue.textContent = `${Math.round(opacity * 100)}%`;
    document.dispatchEvent(new CustomEvent('opacity-changed', { detail: { opacity } }));
});

// Clear overlay button
clearOverlayBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('clear-overlay'));
});

document.addEventListener('overlay-cleared', () => {
    urlInput.value = '';
    sweepContainer.style.display = 'none';
    momentContainer.style.display = 'none';
    overlayControls.style.display = 'none';
    opacitySlider.value = 1;
    opacityValue.textContent = '100%';
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
});

// When a radar is selected on the map
document.addEventListener('radar-selected', (e) => {
    selectedRadar = e.detail;
    selectedRadarIdEl.textContent = selectedRadar.id;
});

// View Level II button - fetch nearest file to current MRMS frame
viewLevel2Btn.addEventListener('click', async () => {
    if (!selectedRadar) {
        alert('Please select a radar station on the map first');
        return;
    }

    // Import getCurrentFrameTime from MRMS display
    const { getCurrentFrameTime } = await import('../mrms/display.js');
    const frameTime = getCurrentFrameTime();

    if (!frameTime) {
        alert('No MRMS frame is currently displayed');
        return;
    }

    viewLevel2Btn.disabled = true;
    level2Loading.style.display = 'block';
    level2Loading.textContent = 'Finding nearest file...';

    try {
        const url = await findNearestLevel2File(selectedRadar.id, frameTime);

        if (url) {
            // Decode the Level II file - mode will auto-switch on decode-success
            level2Loading.textContent = 'Decoding...';
            document.dispatchEvent(new CustomEvent('decode-requested', { detail: { url } }));
        } else {
            alert('No Level II file found near the selected time');
        }
    } catch (err) {
        console.error('Error finding Level II file:', err);
        alert('Error: ' + err.message);
    } finally {
        viewLevel2Btn.disabled = false;
        level2Loading.style.display = 'none';
    }
});

// Find the nearest Level II file to the given time
async function findNearestLevel2File(radarId, targetTime) {
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

function extractLevel2Timestamp(filename) {
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