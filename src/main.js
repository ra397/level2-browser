import './style.css';
import './components/sidebar.js';
import "./components/map.js";
import './components/timeline/timeline.js';
import './components/menu.js';
import './components/mrms-menu.js';
import './components/player/player.js';
import {NexradLevel2} from "./decoder/NexradLevel2.js";
import "./components/markers.js";
import './components/settings.js';
import './components/loading-screen.js';
import './layers/terrain.js';
import './layers/usgs.js';
import './layers/river.js';
import './components/collapsable.js';
import './components/mrms-index.js';
import './components/mrms-index.css';

// MRMS modules
import './mrms/api.js';
import './mrms/display.js';
import './components/mode-toggle.js';
import {
    buildColorLUT, getRadarMapOverlay,
    REF_PALETTE, RHO_PALETTE, CFP_PALETTE, PHI_PALETTE,
    SW_PALETTE, VEL_PALETTE, ZDR_PALETTE, latLngToRadarIndex
} from "./displayer/radarGl.js";
import { updateLevel2Legend, hideLegend, clearLevel2Legend } from "./components/legend.js";
import {tooltipManager} from "./components/tooltip.js";
import {Profile} from "./components/profile.js";
import './components/graph.js';
// import {getCurrentMode} from "./components/mode-toggle.js";
import {extractLevel2Timestamp, findNearestLevel2File} from "./components/menu.js";
import {getCurrentFrameTime} from "./components/barChart.js";
import {setCloseTimeoutDisabled} from "./components/sidebar.js";
import "./deckglLayers.js";

const PRODUCT_CONFIG = {
    REF: { palette: REF_PALETTE, minValue: -32, maxValue: 94.5, units: 'dBZ', labelStep: 2 },
    VEL: { palette: VEL_PALETTE, minValue: -64, maxValue: 64, units: 'm/s' },
    SW:  { palette: SW_PALETTE,  minValue: 0,   maxValue: 30, units: 'm/s' },
    ZDR: { palette: ZDR_PALETTE, minValue: -7.875, maxValue: 7.9375, units: 'dB' },
    PHI: { palette: PHI_PALETTE, minValue: 0,   maxValue: 360, units: '°' },
    RHO: { palette: RHO_PALETTE, minValue: 0,   maxValue: 1.05, units: 'ρ' },
    CFP: { palette: CFP_PALETTE, minValue: 0,   maxValue: 50, units: 'dB' },
};

const radars = new Map();
let activeRadarId = null;

function createRadarState(id, station, radarDecoder, url, terrainData) {
    return {
        id,
        station,
        radar: radarDecoder,
        overlay: null,
        sweepIndex: 0,
        moment: 'REF',
        radarData: null,
        profile: null,
        terrainData,
        url,
        timestamp: null, // extracted from URL
        opacity: 1.0,
        mrmsFrameTime: null
    };
}

function getActiveRadar() {
    return activeRadarId ? radars.get(activeRadarId) : null;
}

function setActiveRadar(radarId) {
    const previousActiveId = activeRadarId;
    activeRadarId = radarId;

    // Hide previous active radar's profile
    if (previousActiveId && previousActiveId !== radarId) {
        const prevRadar = radars.get(previousActiveId);
        if (prevRadar && prevRadar.profile) {
            prevRadar.profile.hide();
        }
    }

    // Show new active radar's profile
    const activeRadar = radars.get(radarId);
    if (activeRadar && activeRadar.profile) {
        activeRadar.profile.show();
    }

    // Bring active radar's overlay to top (re-add to map)
    if (activeRadar && activeRadar.overlay) {
        activeRadar.overlay.setMap(null);
        activeRadar.overlay.setMap(map);
    }

    // Update legend for active radar
    if (activeRadar) {
        const config = PRODUCT_CONFIG[activeRadar.moment] || PRODUCT_CONFIG['REF'];
        updateLevel2Legend(config.palette, config.units, config.labelStep || 1);
    }

    // Dispatch event for menu to update

    document.dispatchEvent(new CustomEvent('radar-focused', {
        detail: {
            radarId,
            radar: activeRadar,
            visible: activeRadar.overlay ? activeRadar.overlay.getMap() !== null : true,
        }
    }));

    // Request the graph to sync the profile mode and refresh data
    document.dispatchEvent(new CustomEvent('radar-switched', {
        detail: { radarId }
    }));
}

document.addEventListener('sync-profile-mode', (e) => {
    const { radarId, mode } = e.detail;

    const radarState = radars.get(radarId);
    if (!radarState || !radarState.profile) return;

    if (mode === 'AXS') {
        radarState.profile.setMode('AHI');  // Force mode change
    }

    // Sync the profile's mode to match the graph
    radarState.profile.setMode(mode);

    // Now refresh the profile data
    refreshProfileData(radarId);
});

// Fetch station metadata once at startup
fetch(`${import.meta.env.BASE_URL}data/nexrad.json`)
    .then(r => r.json())
    .then(data => {
        globalThis.nexradStations = data;
        document.dispatchEvent(new CustomEvent('nexradStationsReady', { detail: data }));
    });

function parseRadarId(url) {
    const match = url.match(/\/([A-Z]{4})\//);
    return match ? match[1] : null;
}

function findStation(radarId) {
    return nexradStations.find(s => s.id === radarId) || null;
}

function refreshProfileData(radarId) {
    const radarState = radars.get(radarId);
    if (!radarState || !radarState.profile) return;

    const profile = radarState.profile;
    if (profile.getMode() === 'AHI') {
        const data = gatherProfileData(radarId, profile.getAzimuth());
        if (data) {
            document.dispatchEvent(new CustomEvent('profile-data-ready', { detail: data }));
        }
    } else if (profile.getMode() === 'RHI') {
        const data = gatherRHIData(
            radarId,
            profile.getAzimuth(),
            profile.getEndAzimuth(),
            profile.getRangeKm()
        );
        if (data) {
            document.dispatchEvent(new CustomEvent('profile-rhi-data-ready', { detail: data }));
        }
    } else if (profile.getMode() === 'AXS') {
        // const pointA = profile.getPointA();
        // const pointB = profile.getPointB();
        // if (pointA && pointB) {
        //     const data = gatherAXSData(pointA, pointB);
        //     if (data) {
        //         document.dispatchEvent(new CustomEvent('profile-axs-data-ready', { detail: data }));
        //     }
        // }
    }
}

function visualizeRadar(radarId) {
    const radarState = radars.get(radarId);
    if (!radarState) return;

    const { station, radar, sweepIndex, moment, terrainData } = radarState;
    const config = PRODUCT_CONFIG[moment] || PRODUCT_CONFIG['REF'];
    const radarData = radar.getData(sweepIndex, moment);

    radarState.radarData = radarData;

    // Clean up existing overlay for this radar
    if (radarState.overlay) {
        radarState.overlay.setMap(null);
    }

    // Create new overlay
    const RadarMapOverlay = getRadarMapOverlay();
    radarState.overlay = new RadarMapOverlay(map, (overlay) => {
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
    radarState.overlay.setOpacity(radarState.opacity);

    // Handle profile
    if (radarState.profile) {
        // Refresh profile data if this is the active radar
        if (radarId === activeRadarId) {
            refreshProfileData(radarId);
        }
    } else {
        // Create profile for this radar
        radarState.profile = new Profile(map, station.lat, station.lng, 230e3, radarId);
        radarState.profile.radarId = radarId; // Tag profile with radar ID

        // Only show if this is the active radar
        if (radarId !== activeRadarId) {
            radarState.profile.hide();
        }
    }

    // Update legend if this is the active radar
    if (radarId === activeRadarId) {
        updateLevel2Legend(config.palette, config.units, config.labelStep || 1);
        tooltipManager.updateAllTooltips(radarData, config.units, station.lat, station.lng);
    }
}

document.addEventListener('decode-requested', async (e) => {
    const { url } = e.detail;

    showLoadingScreen();

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

    // Check if this radar already exists - if so, clean it up first
    const isNewRadar = !radars.has(radarId);
    if (radars.has(radarId)) {
        const existing = radars.get(radarId);
        if (existing.overlay) existing.overlay.setMap(null);
        if (existing.profile) existing.profile.destroy();
        radars.delete(radarId);
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const rawData = await response.arrayBuffer();
        const radarDecoder = new NexradLevel2(rawData);

        const terrainData = await fetchTerrainProfile(station.lat, station.lng);

        // Create radar state
        const radarState = createRadarState(radarId, station, radarDecoder, url, terrainData);

        // Determine initial moment
        const moments = radarDecoder.getMomentsForSweep(0);
        radarState.moment = moments.includes('REF') ? 'REF' : moments[0];

        // Extract timestamp from URL
        radarState.timestamp = extractLevel2Timestamp(url);
        radarState.mrmsFrameTime = getCurrentFrameTime(); // may be null if not loaded via MRMS

        radars.set(radarId, radarState);

        // Set as active and visualize
        setActiveRadar(radarId);
        visualizeRadar(radarId);

        document.dispatchEvent(new CustomEvent('decode-success', {
            detail: {
                radarId,
                sweeps: radarDecoder.sweeps,
                moments: moments,
                currentMoment: radarState.moment,
                url: url
            }
        }));

        // Only zoom for newly decoded radars
        if (isNewRadar) {
            map.setCenter({ lat: station.lat, lng: station.lng });
            map.setZoom(7);
        }

        setCloseTimeoutDisabled(true);
    } catch (err) {
        document.dispatchEvent(new CustomEvent('decode-error', { detail: { message: err.message } }));
    }
});

document.addEventListener('sweep-changed', (e) => {
    const { index } = e.detail;
    const activeRadar = getActiveRadar();
    if (!activeRadar) return;

    activeRadar.sweepIndex = index;

    const moments = activeRadar.radar.getMomentsForSweep(index);
    if (!moments.includes(activeRadar.moment)) {
        activeRadar.moment = moments.includes('REF') ? 'REF' : moments[0];
    }

    visualizeRadar(activeRadarId);

    document.dispatchEvent(new CustomEvent('moments-updated', {
        detail: {
            moments: moments,
            currentMoment: activeRadar.moment,
            sweepIndex: activeRadar.sweepIndex,
        }
    }));
});

document.addEventListener('moment-changed', (e) => {
    const { moment } = e.detail;
    const activeRadar = getActiveRadar();
    if (!activeRadar) return;

    activeRadar.moment = moment;
    visualizeRadar(activeRadarId);
});


// Map click handler for tooltips
map.addListener('click', (e) => {
    const clickLat = e.latLng.lat();
    const clickLng = e.latLng.lng();

    // Check active radar first (it's on top)
    const activeRadar = getActiveRadar();
    if (activeRadar && activeRadar.radarData && activeRadar.station) {
        // Check if in circle
        const distance = google.maps.geometry.spherical.computeDistanceBetween(
            { lat: activeRadar.station.lat, lng: activeRadar.station.lng },
            { lat: clickLat, lng: clickLng }
        );
        if (distance > 230_000) return; // 230 km in meters

        const indices = latLngToRadarIndex(
            clickLat, clickLng,
            activeRadar.station.lat, activeRadar.station.lng,
            activeRadar.radarData.azimuths, activeRadar.radarData.ranges
        );

        if (indices) {
            const { azimuthIndex, rangeIndex } = indices;
            const dataIndex = azimuthIndex * activeRadar.radarData.ranges.length + rangeIndex;
            const value = activeRadar.radarData.data[dataIndex];
            const config = PRODUCT_CONFIG[activeRadar.moment];
            tooltipManager.toggleTooltip(azimuthIndex, rangeIndex, clickLat, clickLng, value, config.units);
            return;
        }
    }

    // If not within active radar, check other radars
    for (const [radarId, radarState] of radars) {
        if (radarId === activeRadarId) continue;
        if (!radarState.radarData || !radarState.station) continue;

        const indices = latLngToRadarIndex(
            clickLat, clickLng,
            radarState.station.lat, radarState.station.lng,
            radarState.radarData.azimuths, radarState.radarData.ranges
        );

        if (indices) {
            const { azimuthIndex, rangeIndex } = indices;
            const dataIndex = azimuthIndex * radarState.radarData.ranges.length + rangeIndex;
            const value = radarState.radarData.data[dataIndex];
            const config = PRODUCT_CONFIG[radarState.moment];
            tooltipManager.toggleTooltip(azimuthIndex, rangeIndex, clickLat, clickLng, value, config.units);
            return;
        }
    }
});


// Opacity changed
document.addEventListener('opacity-changed', (e) => {
    const { opacity } = e.detail;
    const activeRadar = getActiveRadar();
    if (!activeRadar) return;

    activeRadar.opacity = opacity;
    if (activeRadar.overlay) {
        activeRadar.overlay.setOpacity(opacity);
    }
});

document.addEventListener('radar-marker-clicked', async (e) => {
    const {radarId} = e.detail;

    /*
    TODO:
    if radars is empty, then initialize the calendar popup
    if radars is not empty, get level II for that radar
     */
    if (radars.size === 0) {
        document.dispatchEvent(new CustomEvent('init:archive', {
            detail: {radarId}
        }));
        // radarId
        // Initialize calendar popup to get: frameTime (same format as the return from getCurrentFrameTime)
        // url = findNearestLevel2File(radarId, frameTime)
        // decode-requested with url
    } else {
        if (radars.has(radarId)) {
            setActiveRadar(radarId);
        } else {
            const url = await findNearestLevel2File(radarId, getCurrentFrameTime());
            document.dispatchEvent(new CustomEvent('decode-requested', {detail: {url}}));
        }
    }
});

// Toggle overlay
const toggleLayerBtn = document.getElementById('toggleLayerBtn');
document.addEventListener('toggle-layer', () => {
    const activeRadar = getActiveRadar();
    if (!activeRadar?.overlay) return;

    const currentlyVisible = activeRadar.overlay.getMap() !== null;
    activeRadar.overlay.setMap(currentlyVisible ? null : map);

    // Update the button text
    toggleLayerBtn.textContent = currentlyVisible ? 'Show Layer' : 'Hide Layer';
    console.log(`Setting to ${currentlyVisible} Layer`)
});

// Clear overlay
document.addEventListener('clear-overlay', () => {
    const activeRadar = getActiveRadar();
    if (!activeRadar) return;

    // Clean up this radar
    if (activeRadar.overlay) {
        activeRadar.overlay.setMap(null);
    }
    if (activeRadar.profile) {
        activeRadar.profile.destroy();
    }

    radars.delete(activeRadarId);

    // Dispatch radar-removed event
    document.dispatchEvent(new CustomEvent('radar-removed', {
        detail: { radarId: activeRadarId }
    }));

    // Set new active radar (if any remain)
    if (radars.size > 0) {
        const nextRadarId = radars.keys().next().value;
        setActiveRadar(nextRadarId);
    } else {
        activeRadarId = null;
        clearLevel2Legend();
        tooltipManager.clearAll();
        setCloseTimeoutDisabled(false);

        // Dispatch radar-focused with null to reset the menu
        document.dispatchEvent(new CustomEvent('radar-focused', {
            detail: {
                radarId: null,
                radar: null
            }
        }));
    }

    document.dispatchEvent(new CustomEvent('overlay-cleared'));
});

document.addEventListener('clear-all-overlays', () => {
    // Clean up all radars
    for (const [radarId, radar] of radars) {
        if (radar.overlay) {
            radar.overlay.setMap(null);
        }
        if (radar.profile) {
            radar.profile.destroy();
        }
        document.dispatchEvent(new CustomEvent('radar-removed', {
            detail: { radarId }
        }));
    }

    radars.clear();
    activeRadarId = null;
    clearLevel2Legend();
    tooltipManager.clearAll();
    setCloseTimeoutDisabled(false);

    document.dispatchEvent(new CustomEvent('radar-focused', {
        detail: {
            radarId: null,
            radar: null
        }
    }));
});

// Mode switching - show/hide Level II overlay
document.addEventListener('mode-changed', (e) => {
    const { mode } = e.detail;

    if (mode === 'level2') {
        // Show all radar overlays
        for (const [radarId, radarState] of radars) {
            if (radarState.overlay) {
                radarState.overlay.setMap(map);
            }
        }

        // Show active radar's profile
        const activeRadar = getActiveRadar();
        if (activeRadar) {
            if (activeRadar.profile) {
                activeRadar.profile.show();
            }
            const config = PRODUCT_CONFIG[activeRadar.moment] || PRODUCT_CONFIG['REF'];
            updateLevel2Legend(config.palette, config.units, config.labelStep || 1);
        }

        tooltipManager.showAll();
    } else {
        // Hide all radar overlays
        for (const [radarId, radarState] of radars) {
            if (radarState.overlay) {
                radarState.overlay.setMap(null);
            }
            if (radarState.profile) {
                radarState.profile.hide();
            }
        }
        tooltipManager.hideAll();
    }
});

function gatherProfileData(radarId, azimuth) {
    const radarState = radars.get(radarId);
    if (!radarState || !radarState.radar) return null;

    const { radar, moment, terrainData } = radarState;
    const config = PRODUCT_CONFIG[moment];

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
            radarData = radar.getData(sweep.index, moment);
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

    // Get terrain slice for this azimuth
    const terrainSlice = getTerrainSliceByAzimuth(radarId, azimuth);

    return {
        profileData,
        azimuth,
        moment: moment,
        units: config.units,
        palette: config.palette,
        minValue: config.minValue,
        maxValue: config.maxValue,
        terrain: terrainSlice,
        terrainWidth: terrainData ? terrainData.width : null
    };
}

function gatherRHIData(radarId, startAzimuth, endAzimuth, rangeKm) {
    const radarState = radars.get(radarId);
    if (!radarState || !radarState.radar) return null;

    const { radar, moment, terrainData } = radarState;
    const config = PRODUCT_CONFIG[moment];

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

    sweepsToUse.sort((a, b) => a.elevation - b.elevation);

    const profileData = [];

    for (const sweep of sweepsToUse) {
        let radarData;
        try {
            radarData = radar.getData(sweep.index, moment);
        } catch (e) {
            continue;
        }

        // Find the range gate closest to rangeKm
        const numRanges = radarData.ranges.length;
        let bestRangeIdx = 0;
        let bestDiff = Infinity;
        for (let r = 0; r < numRanges; r++) {
            const diff = Math.abs(radarData.ranges[r] - rangeKm);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestRangeIdx = r;
            }
        }

        // Extract data for all azimuths within the slice
        const gates = [];
        for (let i = 0; i < radarData.azimuths.length; i++) {
            let az = radarData.azimuths[i];

            // Check if azimuth is within slice
            let inSlice = false;
            if (startAzimuth <= endAzimuth) {
                inSlice = az >= startAzimuth && az <= endAzimuth;
            } else {
                // Slice wraps around 360
                inSlice = az >= startAzimuth || az <= endAzimuth;
            }

            if (inSlice) {
                const dataIndex = i * numRanges + bestRangeIdx;
                const value = radarData.data[dataIndex];
                gates.push({ azimuth: az, value });
            }
        }

        // Sort gates by azimuth
        gates.sort((a, b) => {
            // Handle wraparound
            let azA = a.azimuth;
            let azB = b.azimuth;
            if (startAzimuth > endAzimuth) {
                if (azA < startAzimuth) azA += 360;
                if (azB < startAzimuth) azB += 360;
            }
            return azA - azB;
        });

        profileData.push({
            elevation: sweep.elevation,
            gates: gates
        });
    }

    const terrainSlice = getTerrainSliceByRange(radarId, startAzimuth, endAzimuth, rangeKm);
    const stationElevation = terrainData ? terrainData.terrainProfile[0] : 0;

    return {
        profileData,
        startAzimuth,
        endAzimuth,
        rangeKm,
        moment: moment,
        units: config.units,
        palette: config.palette,
        minValue: config.minValue,
        maxValue: config.maxValue,
        terrain: terrainSlice,
        stationElevation: stationElevation
    };
}

function gatherAXSData(pointA, pointB) {
    const activeRadar = getActiveRadar();
    if (!activeRadar || !activeRadar.radar) return null;

    const lineLengthM = google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(pointA.lat, pointA.lng),
        new google.maps.LatLng(pointB.lat, pointB.lng)
    );
    const lineLengthKm = lineLengthM / 1000;

    if (lineLengthKm < 1) return null;

    const config = PRODUCT_CONFIG[activeRadar.moment];

    // Calculate heading from A to B
    const heading = google.maps.geometry.spherical.computeHeading(
        new google.maps.LatLng(pointA.lat, pointA.lng),
        new google.maps.LatLng(pointB.lat, pointB.lng)
    );

    // Precompute unique sorted sweeps for each loaded radar
    const sweepsByRadar = new Map();
    for (const [radarId, radarState] of radars) {
        if (!radarState.radar) continue;

        const seenElevations = new Set();
        const sweepsToUse = [];

        for (const sweep of radarState.radar.sweeps) {
            const elevRounded = sweep.elevation.toFixed(1);
            if (!seenElevations.has(elevRounded)) {
                seenElevations.add(elevRounded);
                sweepsToUse.push(sweep);
            }
        }
        sweepsToUse.sort((a, b) => a.elevation - b.elevation);
        sweepsByRadar.set(radarId, sweepsToUse);
    }

    const samples = [];

    // Sample at 1km intervals
    for (let distKm = 0; distKm <= lineLengthKm; distKm += 1) {
        const samplePoint = google.maps.geometry.spherical.computeOffset(
            new google.maps.LatLng(pointA.lat, pointA.lng),
            distKm * 1000,
            heading
        );
        const sampleLat = samplePoint.lat();
        const sampleLng = samplePoint.lng();

        // Find which radar covers this point (active radar has priority)
        const coveringRadar = findRadarForPoint(sampleLat, sampleLng);

        if (!coveringRadar || !coveringRadar.radar) {
            samples.push({
                distanceKm: distKm,
                lat: sampleLat,
                lng: sampleLng,
                radarId: null,
                rangeFromRadar: null,
                gates: [],
                terrainHeightM: null
            });
            continue;
        }

        const station = coveringRadar.station;
        const sweepsToUse = sweepsByRadar.get(coveringRadar.id);

        // Calculate azimuth and range from this radar's station
        const rangeM = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(station.lat, station.lng),
            samplePoint
        );
        const rangeKm = rangeM / 1000;

        const azimuth = google.maps.geometry.spherical.computeHeading(
            new google.maps.LatLng(station.lat, station.lng),
            samplePoint
        );
        const normalizedAzimuth = (azimuth + 360) % 360;

        const gates = [];

        const stationElevM = coveringRadar.terrainData?.terrainProfile?.[0] || 0;

        for (const sweep of sweepsToUse) {
            let radarData;
            try {
                radarData = coveringRadar.radar.getData(sweep.index, activeRadar.moment);
            } catch (e) {
                continue;
            }

            // Find closest azimuth index
            let azimuthIndex = 0;
            let minAzDiff = 360;
            for (let i = 0; i < radarData.azimuths.length; i++) {
                let diff = Math.abs(radarData.azimuths[i] - normalizedAzimuth);
                if (diff > 180) diff = 360 - diff;
                if (diff < minAzDiff) {
                    minAzDiff = diff;
                    azimuthIndex = i;
                }
            }

            // Find closest range index
            let rangeIndex = 0;
            let minRangeDiff = Infinity;
            for (let r = 0; r < radarData.ranges.length; r++) {
                const diff = Math.abs(radarData.ranges[r] - rangeKm);
                if (diff < minRangeDiff) {
                    minRangeDiff = diff;
                    rangeIndex = r;
                }
            }

            const dataIndex = azimuthIndex * radarData.ranges.length + rangeIndex;
            const value = radarData.data[dataIndex];

            const beamHeights = calculateBeamHeightsAtRange(rangeKm, sweep.elevation, stationElevM);

            gates.push({
                elevation: sweep.elevation,
                value: value,
                beamCenterKm: beamHeights.center,
                beamTopKm: beamHeights.top,
                beamBottomKm: beamHeights.bottom
            });
        }

        // Sample terrain from this radar's terrain data
        let terrainHeightM = null;
        if (coveringRadar.terrainData && coveringRadar.terrainData.terrainProfile) {
            const terrainAzIndex = Math.round(normalizedAzimuth) % 360;
            const terrainRangeIndex = Math.min(Math.round(rangeKm), coveringRadar.terrainData.width - 1);
            terrainHeightM = coveringRadar.terrainData.terrainProfile[terrainAzIndex * coveringRadar.terrainData.width + terrainRangeIndex];
        }

        samples.push({
            distanceKm: distKm,
            lat: sampleLat,
            lng: sampleLng,
            radarId: coveringRadar.id,
            rangeFromRadar: rangeKm,
            gates: gates,
            terrainHeightM: terrainHeightM
        });
    }

    return {
        samples,
        lineLengthKm,
        pointA,
        pointB,
        moment: activeRadar.moment,
        units: config.units,
        palette: config.palette,
        minValue: config.minValue,
        maxValue: config.maxValue
    };
}

function findRadarForPoint(lat, lng) {
    // Active radar has priority (it's visually on top)
    const activeRadar = getActiveRadar();
    if (activeRadar && activeRadar.station) {
        const dist = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(lat, lng),
            new google.maps.LatLng(activeRadar.station.lat, activeRadar.station.lng)
        );
        if (dist <= 230000) {
            return activeRadar;
        }
    }

    // Check other radars
    for (const [radarId, radarState] of radars) {
        if (radarId === activeRadarId) continue;
        if (!radarState.station) continue;

        const dist = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(lat, lng),
            new google.maps.LatLng(radarState.station.lat, radarState.station.lng)
        );
        if (dist <= 230000) {
            return radarState;
        }
    }

    return null;
}

function calculateBeamHeightsAtRange(rangeKm, elevationDeg, stationElevM = 0) {
    const EARTH_RADIUS = 6371000; // meters
    const K0 = 1 / (4 * EARTH_RADIUS);
    const BEAMWIDTH = 0.9; // degrees
    const HALF_BW = BEAMWIDTH / 2;

    const rangeM = rangeKm * 1000;

    const calcHeight = (elev) => {
        const eaRad = elev * Math.PI / 180;
        const kappa = K0 * Math.cos(eaRad);
        const a = EARTH_RADIUS;

        const s_a = rangeM / a;
        const inner = a * kappa * Math.sin(s_a) - Math.sin(eaRad + s_a);
        const slantRange = (1 / kappa) * (eaRad + s_a + Math.asin(inner));

        const kr = kappa * slantRange;
        const sin_kr = Math.sin(kr);
        const one_minus_cos_kr = 1 - Math.cos(kr);

        const S = (sin_kr / kappa) * Math.cos(eaRad) + (one_minus_cos_kr / kappa) * Math.sin(eaRad);
        const H = (sin_kr / kappa) * Math.sin(eaRad) - (one_minus_cos_kr / kappa) * Math.cos(eaRad);

        return (Math.sqrt((a + H) ** 2 + S ** 2) - a) / 1000; // km
    };

    const stationElevKm = stationElevM / 1000;

    return {
        center: calcHeight(elevationDeg) + stationElevKm,
        top: calcHeight(elevationDeg + HALF_BW) + stationElevKm,
        bottom: calcHeight(elevationDeg - HALF_BW) + stationElevKm
    };
}

async function fetchTerrainProfile(lat, lng) {
    const url = `https://visualriver.net/api-wsr88/get-terrain?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        const json = await response.json();
        const { terrain, dtype, width } = json;

        // Base64 decode the terrain string into binary
        const binary = atob(terrain);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        // dtype is uint16
        const typedArray = new Uint16Array(bytes.buffer);

        return {
            terrainProfile: typedArray,
            width: width
        };

    } catch (err) {
        console.error("Failed to fetch terrain:", err);
        return null;
    }
}

function getTerrainSliceByAzimuth(radarId, azimuth) {
    const radarState = radars.get(radarId);
    if (!radarState || !radarState.terrainData) return null;

    const { terrainData } = radarState;
    const normalizedAzimuth = ((Math.round(azimuth) % 360) + 360) % 360;
    const start = normalizedAzimuth * terrainData.width;
    const stop = start + terrainData.width;
    return terrainData.terrainProfile.slice(start, stop);
}

function getTerrainSliceByRange(radarId, startAzimuth, endAzimuth, rangeKm) {
    const radarState = radars.get(radarId);
    if (!radarState || !radarState.terrainData) return null;

    const { terrainData } = radarState;

    // Clamp range index to valid bounds
    const rangeIndex = Math.min(Math.round(rangeKm), terrainData.width - 1);

    // Calculate slice width (handling wraparound)
    const sliceWidth = endAzimuth >= startAzimuth
        ? endAzimuth - startAzimuth
        : (360 - startAzimuth) + endAzimuth;

    const terrainValues = [];

    // Sample terrain at this range for each azimuth in the slice
    for (let i = 0; i <= sliceWidth; i++) {
        const az = ((startAzimuth + i) % 360 + 360) % 360;
        const normalizedAz = Math.round(az) % 360;
        // Terrain data layout: [azimuth * width + rangeIndex]
        const index = normalizedAz * terrainData.width + rangeIndex;
        terrainValues.push({
            azimuth: az,
            elevation: terrainData.terrainProfile[index] || 0
        });
    }

    return terrainValues;
}

document.addEventListener('profile-azimuth-changed', (e) => {
    const { azimuth, radarId } = e.detail;

    // If radarId provided, use it; otherwise use active radar
    const targetRadarId = radarId || activeRadarId;
    if (!targetRadarId) return;

    // Set this radar as active (profile interaction)
    if (targetRadarId !== activeRadarId) {
        setActiveRadar(targetRadarId);
    }

    const data = gatherProfileData(targetRadarId, azimuth);
    if (data) {
        document.dispatchEvent(new CustomEvent('profile-data-ready', { detail: data }));
    }
});

// Listen for RHI profile changes
document.addEventListener('profile-rhi-changed', (e) => {
    const { startAzimuth, endAzimuth, rangeKm, radarId } = e.detail;

    const targetRadarId = radarId || activeRadarId;
    if (!targetRadarId) return;

    if (targetRadarId !== activeRadarId) {
        setActiveRadar(targetRadarId);
    }

    const data = gatherRHIData(targetRadarId, startAzimuth, endAzimuth, rangeKm);
    if (data) {
        document.dispatchEvent(new CustomEvent('profile-rhi-data-ready', { detail: data }));
    }
});

document.addEventListener('profile-axs-changed', (e) => {
    const { pointA, pointB, radarId } = e.detail;

    const targetRadarId = radarId || activeRadarId;
    if (!targetRadarId) return;

    if (targetRadarId !== activeRadarId) {
        setActiveRadar(targetRadarId);
    }

    const data = gatherAXSData(pointA, pointB);
    if (data) {
        document.dispatchEvent(new CustomEvent('profile-axs-data-ready', { detail: data }));
    }
});

// Listen for mode changes from graph
document.addEventListener('profile-mode-changed', (e) => {
    const { mode } = e.detail;
    const activeRadar = getActiveRadar();
    if (activeRadar && activeRadar.profile) {
        activeRadar.profile.setMode(mode);
    }
});

function generateShareableUrl() {
    const urls = [];
    for (const [radarId, radarState] of radars) {
        if (radarState.url) {
            urls.push(radarState.url);
        }
    }

    if (urls.length === 0) return null;

    const params = new URLSearchParams();
    params.set('urls', urls.join(','));

    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

async function loadRadarsFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const urlsParam = params.get('urls');

    if (!urlsParam) return;

    const urls = urlsParam.split(',');

    for (const url of urls) {
        document.dispatchEvent(new CustomEvent('decode-requested', {
            detail: { url: url.trim() }
        }));
        // Small delay between requests to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

document.addEventListener('nexradStationsReady', () => {
    loadRadarsFromUrl();
});

document.addEventListener('share-link-requested', () => {
    const shareableUrl = generateShareableUrl();

    if (!shareableUrl) {
        alert('No radars to share');
        return;
    }

    navigator.clipboard.writeText(shareableUrl).then(() => {
        alert('Link copied to clipboard');
    }).catch(() => {
        alert('Failed to copy link to clipboard');
    });
});

export function getLoadedRadars() {
    const result = [];
    for (const [radarId, radarState] of radars) {
        result.push({
            radarId,
            url: radarState.url,
            mrmsFrameTime: radarState.mrmsFrameTime
        });
    }
    return result;
}