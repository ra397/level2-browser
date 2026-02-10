import './style.css';
import "./components/map.js";
import './components/menu.js';
import {NexradLevel2} from "./decoder/NexradLevel2.js";
import "./components/markers.js";
import {
    buildColorLUT, getRadarMapOverlay,
    REF_PALETTE, RHO_PALETTE, CFP_PALETTE, PHI_PALETTE,
    SW_PALETTE, VEL_PALETTE, ZDR_PALETTE, latLngToRadarIndex
} from "./displayer/radarGl.js";
import {updateLegend, hideLegend} from "./components/legend.js";
import {tooltipManager} from "./components/tooltip.js";
import {Profile} from "./components/profile.js";
import './components/graph.js';

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
let currentStation= null;
let currentRadarData = null;
let currentProfile = null;

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

    // Store for tooltip
    currentRadarData = radarData;
    currentStation = station;

    // update all tooltips
    tooltipManager.updateAllTooltips(radarData, config.units, station.lat, station.lng);

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

    let oldAzimuth = null;
    if (currentProfile) {
        oldAzimuth = currentProfile.getAzimuth();
        currentProfile.destroy();
        currentProfile = null;
    }
    currentProfile = new Profile(map, station.lat, station.lng, 230e3);
    if (oldAzimuth !== null) {
        currentProfile.setAzimuth(oldAzimuth);
    }

    // Refresh profile data if profile exists
    if (currentProfile) {
        const data = gatherProfileData(currentProfile.getAzimuth());
        if (data) {
            document.dispatchEvent(new CustomEvent('profile-data-ready', { detail: data }));
        }
    }
}

document.addEventListener('decode-requested', async (e) => {
    const { url } = e.detail;

    tooltipManager.clearAll();

    if (currentProfile !== null) {
        currentProfile.destroy();
        currentProfile = null;
    }

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

// Map click handler for tooltips
map.addListener('click', (e) => {
    if (!currentRadarData || !currentStation) return;

    const clickLat = e.latLng.lat();
    const clickLng = e.latLng.lng();

    const indices = latLngToRadarIndex(
        clickLat, clickLng,
        currentStation.lat, currentStation.lng,
        currentRadarData.azimuths, currentRadarData.ranges
    );

    if (!indices) return;

    const { azimuthIndex, rangeIndex } = indices;
    const dataIndex = azimuthIndex * currentRadarData.ranges.length + rangeIndex;
    const value = currentRadarData.data[dataIndex];

    const config = PRODUCT_CONFIG[currentMoment];
    tooltipManager.toggleTooltip(azimuthIndex, rangeIndex, clickLat, clickLng, value, config.units);
});

// Opacity changed
document.addEventListener('opacity-changed', (e) => {
    const { opacity } = e.detail;
    console.log(opacity);
    if (radarOverlay) {
        radarOverlay.setOpacity(opacity);
    }
});

// Clear overlay
document.addEventListener('clear-overlay', () => {
    cleanupOverlay();
    tooltipManager.clearAll();
    if (currentProfile !== null) {
        currentProfile.destroy();
        currentProfile = null;
    }
    hideLegend();
    radar = null;
    currentRadarData = null;
    currentStation = null;
    document.dispatchEvent(new CustomEvent('overlay-cleared'));
});

function gatherProfileData(azimuth) {
    if (!radar) return null;

    const config = PRODUCT_CONFIG[currentMoment];

    // Get unique elevation angles (first sweep for each elevation)
    const seenElevations = new Set();
    const sweepsToUse = [];

    for (const sweep of radar.sweeps) {
        const elevRounded = sweep.elevation.toFixed(1);
        if (!seenElevations.has(elevRounded)) {
            seenElevations.add(elevRounded);
            sweepsToUse.push(sweep);
        }
    }

    // Sort by elevation angle
    sweepsToUse.sort((a, b) => a.elevation - b.elevation);

    const profileData = [];

    for (const sweep of sweepsToUse) {
        let radarData;
        try {
            radarData = radar.getData(sweep.index, currentMoment);
        } catch (e) {
            // Moment not available for this sweep, skip it
            continue;
        }

        // Find the closest azimuth index
        let azimuthIndex = 0;
        let minDiff = 360;
        for (let i = 0; i < radarData.azimuths.length; i++) {
            let diff = Math.abs(radarData.azimuths[i] - azimuth);
            if (diff > 180) diff = 360 - diff;
            if (diff < minDiff) {
                minDiff = diff;
                azimuthIndex = i;
            }
        }

        // Extract gate values - one per km, up to 230km
        const numRanges = radarData.ranges.length;
        const gates = [];

        for (let km = 0; km < 230; km++) {
            // Find the gate closest to this km
            let bestRangeIdx = null;
            let bestDiff = Infinity;

            for (let r = 0; r < numRanges; r++) {
                const diff = Math.abs(radarData.ranges[r] - km);
                if (diff < bestDiff) {
                    bestDiff = diff;
                    bestRangeIdx = r;
                }
                // Early exit if we've passed the target
                if (radarData.ranges[r] > km + 0.5) break;
            }

            if (bestRangeIdx !== null && bestDiff < 1) {
                const dataIndex = azimuthIndex * numRanges + bestRangeIdx;
                const value = radarData.data[dataIndex];
                gates.push({ rangeKm: km, value });
            } else {
                gates.push({ rangeKm: km, value: NaN });
            }
        }

        profileData.push({
            elevation: sweep.elevation,
            gates: gates
        });
    }

    return {
        profileData,
        azimuth,
        moment: currentMoment,
        units: config.units,
        palette: config.palette,
        minValue: config.minValue,
        maxValue: config.maxValue
    };
}

document.addEventListener('profile-azimuth-changed', (e) => {
    const { azimuth } = e.detail;
    const data = gatherProfileData(azimuth);
    if (data) {
        document.dispatchEvent(new CustomEvent('profile-data-ready', { detail: data }));
    }
});