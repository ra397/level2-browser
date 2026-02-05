import './style.css';
import {NexradLevel2} from "./decoder/NexradLevel2.js";
import "./components/markers.js";
import {
    buildColorLUT, CFP_PALETTE, PHI_PALETTE,
    RadarMapOverlay,
    REF_PALETTE, RHO_PALETTE,
    SW_PALETTE,
    VEL_PALETTE,
    ZDR_PALETTE
} from "./displayer/radarGl.js";
import {updateLegend, hideLegend} from "./components/legend.js";

const PRODUCT_CONFIG = {
    REF: { palette: REF_PALETTE, minValue: -32, maxValue: 94.5, units: 'dBZ', labelStep: 2 },
    VEL: { palette: VEL_PALETTE, minValue: -64, maxValue: 64, units: 'm/s' },
    SW:  { palette: SW_PALETTE,  minValue: 0,   maxValue: 30, units: 'm/s' },
    ZDR: { palette: ZDR_PALETTE, minValue: -7.875, maxValue: 7.9375, units: 'dB' },
    PHI: { palette: PHI_PALETTE, minValue: 0,   maxValue: 360, units: '°' },
    RHO: { palette: RHO_PALETTE, minValue: 0,   maxValue: 1.05, units: 'ρ' },
    CFP: { palette: CFP_PALETTE, minValue: 0,   maxValue: 50, units: 'dB' },
};

let radar = null;
let radarOverlay = null;
let currentSweepIndex = 0;
let currentMoment = 'REF';

// Fetch station metadata once at startup
fetch('/data/nexrad.json')
    .then(r => r.json())
    .then(data => {
        globalThis.nexradStations = data;
        window.dispatchEvent(new CustomEvent('nexradStationsReady', { detail: data }));
    });

function parseRadarId(url) {
    const match = url.match(/\/([A-Z]{4})\//);
    return match ? match[1] : null;
}

function findStation(radarId) {
    return nexradStations.find(s => s.id === radarId) || null;
}

function cleanupOverlay() {
    if (radarOverlay) {
        radarOverlay.setMap(null);
        radarOverlay = null;
    }
}

function visualize(station) {
    cleanupOverlay();

    const sweepIndex = currentSweepIndex;
    const moment = currentMoment;
    const config = PRODUCT_CONFIG[moment] || PRODUCT_CONFIG['REF'];
    const radarData = radar.getData(sweepIndex, moment);
    globalThis.radarData = radarData;

    radarOverlay = new RadarMapOverlay(map, (overlay) => {
        const colors = buildColorLUT(config.palette, config.minValue, config.maxValue);
        overlay.setColors(colors);
        overlay.setRadarPosition(station.lat, station.lng, radar.sweeps[sweepIndex].elevation);
        overlay.loadData(
            radarData.azimuths,
            radarData.ranges,
            radarData.data,
            { minValue: config.minValue, maxValue: config.maxValue }
        );
    });
    radarOverlay.setOpacity(1);

    updateLegend(config.palette, config.units, config.labelStep || 1);
}

function populateSweeps() {
    const container = document.getElementById('sweepList');
    container.innerHTML = '';
    radar.sweeps.forEach((sweep, i) => {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'sweep';
        radio.value = i;
        if (i === 0) radio.checked = true;
        label.appendChild(radio);
        label.append(` Sweep ${sweep.index} (${sweep.elevation.toFixed(1)}°) `);
        container.appendChild(label);
    });
    document.getElementById('sweepContainer').style.display = '';
}

function populateMoments() {
    const container = document.getElementById('momentList');
    container.innerHTML = '';
    const moments = radar.getMomentsForSweep(currentSweepIndex);
    // If current moment not available in this sweep, fallback
    if (!moments.includes(currentMoment)) {
        currentMoment = moments.includes('REF') ? 'REF' : moments[0];
    }
    moments.forEach(m => {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'moment';
        radio.value = m;
        if (m === currentMoment) radio.checked = true;
        label.appendChild(radio);
        label.append(` ${m} `);
        container.appendChild(label);
    });
    document.getElementById('momentContainer').style.display = '';
}

document.addEventListener('DOMContentLoaded', () => {
    globalThis.map = new google.maps.Map(document.getElementById("map"), {
        center: {lat: 39.5, lng: -98.35},
        zoom: 5,
        minZoom: 4,
        maxZoom: 12,
        clickableIcons: false,
    });
    window.dispatchEvent(new CustomEvent('mapReady'));

    const decodeBtn = document.getElementById('decodeBtn');
    const urlInput = document.getElementById('urlInput');

    decodeBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) { alert('Please enter a URL'); return; }

        const radarId = parseRadarId(url);
        if (!radarId) { alert('Could not parse radar ID from URL'); return; }

        const station = findStation(radarId);
        if (!station) { alert(`Station ${radarId} not found in nexrad.json`); return; }

        decodeBtn.textContent = 'Decoding...';
        decodeBtn.disabled = true;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
            const rawData = await response.arrayBuffer();
            radar = new NexradLevel2(rawData);

            currentSweepIndex = 0;
            currentMoment = 'REF';

            populateSweeps();
            populateMoments();
            visualize(station);
        } catch (err) {
            alert('Error decoding: ' + err.message);
        } finally {
            decodeBtn.textContent = 'Decode';
            decodeBtn.disabled = false;
        }
    });

    document.getElementById('sweepList').addEventListener('change', (e) => {
        currentSweepIndex = parseInt(e.target.value);
        populateMoments();
        const radarId = parseRadarId(urlInput.value);
        const station = findStation(radarId);
        if (station) visualize(station);
    });

    document.getElementById('momentList').addEventListener('change', (e) => {
        currentMoment = e.target.value;
        const radarId = parseRadarId(urlInput.value);
        const station = findStation(radarId);
        if (station) visualize(station);
    });
});