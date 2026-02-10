import './graph.css';
import {DragContainer, draggerClassList} from "./draggable.js";

// ─── Constants ───
const EARTH_RADIUS = 6_371_000;
const K0 = 1 / (4 * EARTH_RADIUS);
const BEAMWIDTH = 0.9;
const HALF_BW = BEAMWIDTH / 2;

const MAX_RANGE_KM = 230;
const MAX_HEIGHT_KM = 15;
const RANGE_STEPS = 230; // 1 step per km
const STATION_ELEVATION = 0;

// ─── Beam height calculation ───
function calculateBeamHeights(groundRanges, eaDeg, elevation) {
    const eaRad = eaDeg * Math.PI / 180;
    const kappa = K0 * Math.cos(eaRad);
    const a = EARTH_RADIUS;

    const slantRanges = groundRanges.map(s => {
        const s_a = s / a;
        const inner = a * kappa * Math.sin(s_a) - Math.sin(eaRad + s_a);
        return (1 / kappa) * (eaRad + s_a + Math.asin(inner));
    });

    return slantRanges.map(r => {
        const kr = kappa * r;
        const sin_kr = Math.sin(kr);
        const one_minus_cos_kr = 1 - Math.cos(kr);

        const S = (sin_kr / kappa) * Math.cos(eaRad) + (one_minus_cos_kr / kappa) * Math.sin(eaRad);
        const H = (sin_kr / kappa) * Math.sin(eaRad) - (one_minus_cos_kr / kappa) * Math.cos(eaRad);

        return Math.sqrt((a + H) ** 2 + S ** 2) - a + elevation;
    });
}

// ─── Generate ground ranges (1km steps) ───
const groundRanges = [];
for (let i = 0; i <= RANGE_STEPS; i++) {
    groundRanges.push(i * 1000); // meters
}
const rangesKm = groundRanges.map(r => r / 1000);

// ─── SVG Setup ───
const svg = document.getElementById('beamSvg');
const container = document.getElementById('graphContainer');
const tooltip = document.getElementById('tooltip');

// Current profile data
let currentProfileData = null;
let currentPalette = null;
let currentMinValue = 0;
let currentMaxValue = 100;
let currentUnits = '';
let beams = [];

function getViewBox() {
    const rect = container.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
}

function dataToSvg(rangeKm, heightKm, vb) {
    const x = (rangeKm / MAX_RANGE_KM) * vb.w;
    const y = vb.h - (heightKm / MAX_HEIGHT_KM) * vb.h;
    return { x, y };
}

function buildPath(xArr, yArr, vb) {
    const pts = xArr.map((xk, i) => {
        const p = dataToSvg(xk, yArr[i], vb);
        return `${p.x},${p.y}`;
    });
    return pts.join(' ');
}

function valueToColor(value, palette, minValue, maxValue) {
    if (value === null || isNaN(value)) {
        return null; // No data
    }

    const sortedKeys = Object.keys(palette).map(Number).sort((a, b) => a - b);

    // Find surrounding palette entries
    let lowerKey = sortedKeys[0];
    let upperKey = sortedKeys[sortedKeys.length - 1];

    for (let j = 0; j < sortedKeys.length - 1; j++) {
        if (value >= sortedKeys[j] && value < sortedKeys[j + 1]) {
            lowerKey = sortedKeys[j];
            upperKey = sortedKeys[j + 1];
            break;
        }
    }

    let r, g, b;
    if (value < sortedKeys[0]) {
        [r, g, b] = palette[sortedKeys[0]];
    } else if (value >= sortedKeys[sortedKeys.length - 1]) {
        [r, g, b] = palette[sortedKeys[sortedKeys.length - 1]];
    } else {
        const t = (value - lowerKey) / (upperKey - lowerKey);
        const c1 = palette[lowerKey];
        const c2 = palette[upperKey];
        r = Math.round(c1[0] + t * (c2[0] - c1[0]));
        g = Math.round(c1[1] + t * (c2[1] - c1[1]));
        b = Math.round(c1[2] + t * (c2[2] - c1[2]));
    }

    return `rgb(${r},${g},${b})`;
}

function computeBeams(elevationAngles) {
    return elevationAngles.map((elev) => {
        const center = calculateBeamHeights(groundRanges, elev, STATION_ELEVATION).map(h => h / 1000);
        const top = calculateBeamHeights(groundRanges, elev + HALF_BW, STATION_ELEVATION).map(h => h / 1000);
        const bottom = calculateBeamHeights(groundRanges, elev - HALF_BW, STATION_ELEVATION).map(h => h / 1000);
        return { elev, center, top, bottom };
    });
}

function render() {
    const vb = getViewBox();
    svg.setAttribute('viewBox', `0 0 ${vb.w} ${vb.h}`);

    let svgContent = '';

    // Defs for clipping
    svgContent += `<defs>
      <clipPath id="plotClip">
        <rect x="0" y="0" width="${vb.w}" height="${vb.h}" />
      </clipPath>
    </defs>`;

    svgContent += `<g clip-path="url(#plotClip)">`;

    // Grid lines
    const yTicks = [0, 5, 10, 15];
    for (const yk of yTicks) {
        const p = dataToSvg(0, yk, vb);
        svgContent += `<line x1="0" y1="${p.y}" x2="${vb.w}" y2="${p.y}" stroke="#141d30" stroke-width="0.5" />`;
    }
    const xTicks = [0, 50, 100, 150, 200];
    for (const xk of xTicks) {
        const p = dataToSvg(xk, 0, vb);
        svgContent += `<line x1="${p.x}" y1="0" x2="${p.x}" y2="${vb.h}" stroke="#141d30" stroke-width="0.5" />`;
    }

    // Draw beams with color-coded gates
    for (let beamIdx = beams.length - 1; beamIdx >= 0; beamIdx--) {
        const beam = beams[beamIdx];
        const profileBeam = currentProfileData ? currentProfileData[beamIdx] : null;

        svgContent += `<g class="beam-group" data-elev="${beam.elev}" data-beam-idx="${beamIdx}">`;

        if (profileBeam && currentPalette) {
            // Draw each gate as a colored rectangle
            for (let gateIdx = 0; gateIdx < profileBeam.gates.length; gateIdx++) {
                const gate = profileBeam.gates[gateIdx];
                const rangeKm = gate.rangeKm;
                const nextRangeKm = rangeKm + 1; // 1km per gate

                if (rangeKm >= MAX_RANGE_KM) continue;

                const color = valueToColor(gate.value, currentPalette, currentMinValue, currentMaxValue);
                if (!color) continue; // Skip no-data

                // Get beam heights at this range
                const rangeIdx = Math.round(rangeKm);
                const nextRangeIdx = Math.min(rangeIdx + 1, RANGE_STEPS);

                const topLeft = dataToSvg(rangeKm, beam.top[rangeIdx], vb);
                const topRight = dataToSvg(nextRangeKm, beam.top[nextRangeIdx], vb);
                const bottomRight = dataToSvg(nextRangeKm, beam.bottom[nextRangeIdx], vb);
                const bottomLeft = dataToSvg(rangeKm, beam.bottom[rangeIdx], vb);

                svgContent += `<polygon
                      class="gate-fill"
                      data-beam-idx="${beamIdx}"
                      data-gate-idx="${gateIdx}"
                      data-value="${gate.value}"
                      data-range="${rangeKm}"
                      points="${topLeft.x},${topLeft.y} ${topRight.x},${topRight.y} ${bottomRight.x},${bottomRight.y} ${bottomLeft.x},${bottomLeft.y}"
                      fill="${color}"
                      opacity="1.0"
                      stroke="none"
                  />`;
            }
        }

        // Draw beam outline
        const topPath = buildPath(rangesKm, beam.top, vb);
        const bottomReversed = [...beam.bottom].reverse();
        const rangesReversed = [...rangesKm].reverse();
        const bottomPath = buildPath(rangesReversed, bottomReversed, vb);

        svgContent += `<polygon class="beam-outline" points="${topPath} ${bottomPath}" fill="none" stroke="rgba(100,100,100,0.3)" stroke-width="0.5" />`;

        svgContent += `</g>`;
    }

    // Crosshair lines
    svgContent += `<line id="crosshairX" class="crosshair" x1="0" y1="0" x2="0" y2="${vb.h}" style="display:none" />`;
    svgContent += `<line id="crosshairY" class="crosshair" x1="0" y1="0" x2="${vb.w}" y2="0" style="display:none" />`;

    svgContent += `</g>`;
    svg.innerHTML = svgContent;
}

// ─── Axis labels ───
function renderAxes() {
    const yLabels = document.getElementById('yLabels');
    const xLabels = document.getElementById('xLabels');

    const yTicks = [15, 10, 5, 0];
    yLabels.innerHTML = yTicks.map(v => `<span class="label">${v}</span>`).join('');

    const xTicks = [0, 50, 100, 150, 200, 230];
    xLabels.innerHTML = xTicks.map(v => `<span class="label">${v}</span>`).join('');
}

// ─── Hover logic ───
function findNearestBeamAndGate(rangeKm, heightKm) {
    let bestBeam = null;
    let bestGate = null;

    const rangeIdx = Math.round(rangeKm);
    if (rangeIdx < 0 || rangeIdx > RANGE_STEPS) return { beam: null, gate: null };

    // Search from lowest to highest elevation (lowest takes priority in overlap)
    for (let beamIdx = 0; beamIdx < beams.length; beamIdx++) {
        const beam = beams[beamIdx];
        const top = beam.top[rangeIdx];
        const bottom = beam.bottom[rangeIdx];
        const center = beam.center[rangeIdx];

        if (heightKm >= bottom && heightKm <= top) {
            bestBeam = { ...beam, beamIdx, centerH: center, topH: top, bottomH: bottom };

            if (currentProfileData && currentProfileData[beamIdx]) {
                const gates = currentProfileData[beamIdx].gates;
                const gateIdx = Math.floor(rangeKm);
                if (gateIdx >= 0 && gateIdx < gates.length) {
                    bestGate = { ...gates[gateIdx], gateIdx };
                }
            }
            break; // Stop at first match (lowest elevation)
        }
    }
    return { beam: bestBeam, gate: bestGate };
}

container.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const vb = { w: rect.width, h: rect.height };

    const rangeKm = (mx / vb.w) * MAX_RANGE_KM;
    const heightKm = (1 - my / vb.h) * MAX_HEIGHT_KM;

    // Update crosshairs
    const crossX = document.getElementById('crosshairX');
    const crossY = document.getElementById('crosshairY');
    if (crossX && crossY) {
        crossX.style.display = 'block';
        crossY.style.display = 'block';
        crossX.setAttribute('x1', mx);
        crossX.setAttribute('x2', mx);
        crossY.setAttribute('y1', my);
        crossY.setAttribute('y2', my);
    }

    const { beam, gate } = findNearestBeamAndGate(rangeKm, heightKm);

    // Reset highlights
    svg.querySelectorAll('.beam-group').forEach(g => {
        g.querySelectorAll('.gate-fill').forEach(gf => {
            gf.style.opacity = '';
        });
    });

    if (beam) {
        tooltip.style.display = 'block';

        let valueDisplay = 'No Data';
        if (gate && gate.value !== null && !isNaN(gate.value)) {
            valueDisplay = `${gate.value.toFixed(1)} ${currentUnits}`;
        }

        tooltip.innerHTML = `
              <div class="elev-label">${beam.elev.toFixed(1)}° Elevation</div>
              <div>Range: ${rangeKm.toFixed(1)} km</div>
              <div>Height: ${beam.centerH.toFixed(2)} km (${(beam.centerH * 3280.84).toFixed(0)} ft)</div>
              <div>Value: ${valueDisplay}</div>
          `;

        // Position tooltip
        let tx = mx + 14;
        let ty = my - 10;
        const tw = tooltip.offsetWidth;
        const th = tooltip.offsetHeight;
        if (tx + tw > rect.width) tx = mx - tw - 14;
        if (ty + th > rect.height) ty = rect.height - th - 4;
        if (ty < 0) ty = 4;
        tooltip.style.left = tx + 'px';
        tooltip.style.top = ty + 'px';
    } else {
        tooltip.style.display = 'none';
    }
});

container.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
    const crossX = document.getElementById('crosshairX');
    const crossY = document.getElementById('crosshairY');
    if (crossX) crossX.style.display = 'none';
    if (crossY) crossY.style.display = 'none';
});

// ─── Listen for profile data ───
document.addEventListener('profile-data-ready', (e) => {
    const { profileData, azimuth, moment, units, palette, minValue, maxValue } = e.detail;

    currentProfileData = profileData;
    currentPalette = palette;
    currentMinValue = minValue;
    currentMaxValue = maxValue;
    currentUnits = units;

    // Compute beams for the elevation angles in the data
    const elevationAngles = profileData.map(p => p.elevation);
    beams = computeBeams(elevationAngles);

    render();
});

document.addEventListener('overlay-cleared', () => {
    currentProfileData = null;
    currentPalette = null;
    currentMinValue = 0;
    currentMaxValue = 100;
    currentUnits = '';
    beams = [];
    render();
    renderAxes();
});

// ─── Init ───
renderAxes();
window.addEventListener('resize', render);

// Make the profile graph draggable
const graphContainerEl = document.querySelector('.graph-wrapper');
const dragContainer = new DragContainer(graphContainerEl, draggerClassList);