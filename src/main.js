import './style.css';
import "./components/map.js";
import './components/menu.js';
import {NexradLevel2} from "./decoder/NexradLevel2.js";
import "./components/markers.js";
import {
    buildColorLUT, getRadarMapOverlay,
    REF_PALETTE, RHO_PALETTE, CFP_PALETTE, PHI_PALETTE,
    SW_PALETTE, VEL_PALETTE, ZDR_PALETTE
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

    const RadarMapOverlay = getRadarMapOverlay();
    radarOverlay = new RadarMapOverlay(map, (overlay) => {
        const colors = buildColorLUT(config.palette, config.minValue, config.maxValue);
        overlay.setColors(colors);
        overlay.setRadarPosition(station.lat, station.lng, radar.sweeps[sweepIndex].elevation);
        overlay.loadData(
            radarData.azimuths,
            radarData.ranges,
            radarData.data,
            {minValue: config.minValue, maxValue: config.maxValue}
        );
    });
    radarOverlay.setOpacity(1);

    updateLegend(config.palette, config.units, config.labelStep || 1);
}

document.addEventListener('decode-requested', async (e) => {
    const { url } = e.detail;

    const radarId = parseRadarId(url);
    if (!radarId) {
        document.dispatchEvent(new CustomEvent('decode-error', { detail: { message: 'Could not parse radar ID from URL' } }));
        return;
    }

    const station = findStation(radarId);
    if (!station) {
        document.dispatchEvent(new CustomEvent('decode-error', { detail: { message: `Station ${radarId} not found` } }));
        return;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const rawData = await response.arrayBuffer();
        radar = new NexradLevel2(rawData);

        currentSweepIndex = 0;
        currentMoment = 'REF';

        const moments = radar.getMomentsForSweep(currentSweepIndex);
        if (!moments.includes(currentMoment)) {
            currentMoment = moments[0];
        }

        visualize(station);

        document.dispatchEvent(new CustomEvent('decode-success', {
            detail: {
                sweeps: radar.sweeps,
                moments: moments,
                currentMoment: currentMoment
            }
        }));
    } catch (err) {
        document.dispatchEvent(new CustomEvent('decode-error', { detail: { message: err.message } }));
    }
});

document.addEventListener('sweep-changed', (e) => {
    const { index } = e.detail;
    currentSweepIndex = index;

    const moments = radar.getMomentsForSweep(currentSweepIndex);
    if (!moments.includes(currentMoment)) {
        currentMoment = moments.includes('REF') ? 'REF' : moments[0];
    }

    const radarId = parseRadarId(document.getElementById('urlInput').value);
    const station = findStation(radarId);
    if (station) visualize(station);

    document.dispatchEvent(new CustomEvent('moments-updated', {
        detail: {
            moments: moments,
            currentMoment: currentMoment
        }
    }));
});

document.addEventListener('moment-changed', (e) => {
    const { moment } = e.detail;
    currentMoment = moment;

    const radarId = parseRadarId(document.getElementById('urlInput').value);
    const station = findStation(radarId);
    if (station) visualize(station);
});