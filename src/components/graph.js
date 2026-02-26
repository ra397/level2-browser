import './graph.css';

// ─── Constants ───
const EARTH_RADIUS = 6_371_000;
const K0 = 1 / (4 * EARTH_RADIUS);
const BEAMWIDTH = 0.9;
const HALF_BW = BEAMWIDTH / 2;

const MAX_RANGE_KM = 230;
const MAX_HEIGHT_KM = 15;
const RANGE_STEPS = 230;
const STATION_ELEVATION = 0;

// ─── State ───
let currentMode = 'AHI';
let currentProfileData = null;
let currentPalette = null;
let currentMinValue = 0;
let currentMaxValue = 100;
let currentUnits = '';
let beams = [];
let currentAHITerrain = null;
let currentRHITerrain = null;
let currentTerrainWidth = null;
let stationElevationKm = 0;
let currentAzimuth = 0;

// RHI specific state
let rhiStartAzimuth = 0;
let rhiEndAzimuth = 15;
let rhiRangeKm = 50;

let isFolded = true;
let hasData = false;

function initFoldButton() {
    const foldBtn = document.getElementById('foldBtn');
    if (!foldBtn) return;

    foldBtn.addEventListener('click', toggleFold);

    // Start folded
    setFolded(true);
}

function toggleFold() {
    if (isFolded && !hasData) {
        return;
    }
    setFolded(!isFolded);
}

function setFolded(folded) {
    isFolded = folded;
    const wrapper = document.querySelector(".graph-wrapper");
    const content = document.querySelector('.graph-content');
    const foldBtn = document.getElementById('foldBtn');

    if (!content || !foldBtn) return;

    if (isFolded) {
        content.style.display = 'none';
        foldBtn.textContent = '+';
        wrapper.style.height = 'fit-content';
        wrapper.style.width = 'fit-content'
    } else {
        wrapper.style.height = 'fit-content';
        wrapper.style.width = '1400px';
        content.style.display = '';
        foldBtn.textContent = '−';

        // Re-render after unfolding since dimensions are now available
        requestAnimationFrame(() => {
            render();
            renderAxes();
        });
    }

    // Update disabled state
    if (hasData) {
        foldBtn.disabled = false;
        foldBtn.classList.remove('disabled');
    } else {
        foldBtn.disabled = true;
        foldBtn.classList.add('disabled');
    }
}

function setHasData(value) {
    hasData = value;
    const foldBtn = document.getElementById('foldBtn');
    if (foldBtn) {
        if (hasData) {
            foldBtn.disabled = false;
            foldBtn.classList.remove('disabled');
        } else {
            foldBtn.disabled = true;
            foldBtn.classList.add('disabled');
        }
    }
}

// ─── SVG Setup ───
const svg = document.getElementById('beamSvg');
const container = document.getElementById('graphContainer');
const tooltip = document.getElementById('tooltip');

// ─── Mode Switcher ───
function createModeSwitcher() {
    const titleBar = document.querySelector('.title-bar');
    if (!titleBar) return;

    titleBar.innerHTML = `
          <div class="mode-switcher">
              <label>
                  <input type="radio" name="profileMode" value="AHI" checked>
                  AHI
              </label>
              <label>
                  <input type="radio" name="profileMode" value="RHI">
                  RHI
              </label>
          </div>
          <div class="profile-info" id="profileInfo"></div>
      `;

    titleBar.addEventListener('change', (e) => {
        if (e.target.name === 'profileMode') {
            currentMode = e.target.value;
            currentProfileData = null;
            beams = [];
            render();
            renderAxes();
            updateProfileInfo();
            document.dispatchEvent(new CustomEvent('profile-mode-changed', {
                detail: { mode: currentMode }
            }));
        }
    });
}

function updateProfileInfo() {
    const profileInfo = document.getElementById('profileInfo');
    if (!profileInfo) return;

    if (currentMode === 'AHI') {
        profileInfo.textContent = `Azimuth: ${currentAzimuth.toFixed(1)}°`;
    } else {
        profileInfo.textContent = `Range: ${rhiRangeKm.toFixed(2)} km`;
    }
}

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

function calculateBeamWidthKm(rangeKm, elevationDeg) {
    const rangeM = rangeKm * 1000;
    const elevRad = elevationDeg * Math.PI / 180;
    const beamwidthRad = BEAMWIDTH * Math.PI / 180;

    // Beam width at slant range
    const slantRange = rangeM / Math.cos(elevRad);
    const widthM = 2 * slantRange * Math.tan(beamwidthRad / 2);
    return widthM / 1000;
}

// ─── Generate ground ranges (1km steps) ───
const groundRanges = [];
for (let i = 0; i <= RANGE_STEPS; i++) {
    groundRanges.push(i * 1000);
}
const rangesKm = groundRanges.map(r => r / 1000);

function getViewBox() {
    const rect = container.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
}

function dataToSvgAHI(rangeKm, heightKm, vb) {
    const x = (rangeKm / MAX_RANGE_KM) * vb.w;
    const y = vb.h - (heightKm / MAX_HEIGHT_KM) * vb.h;
    return { x, y };
}

function dataToSvgRHI(azimuthOffset, heightKm, sliceWidth, vb) {
    const x = (azimuthOffset / sliceWidth) * vb.w;
    const y = vb.h - (heightKm / MAX_HEIGHT_KM) * vb.h;
    return { x, y };
}

function buildPath(xArr, yArr, vb) {
    const pts = xArr.map((xk, i) => {
        const p = dataToSvgAHI(xk, yArr[i], vb);
        return `${p.x},${p.y}`;
    });
    return pts.join(' ');
}

function valueToColor(value, palette, minValue, maxValue) {
    if (value === null || isNaN(value)) {
        return null;
    }

    const sortedKeys = Object.keys(palette).map(Number).sort((a, b) => a - b);

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

function computeBeamsAHI(elevationAngles) {
    return elevationAngles.map((elev, idx) => {
        const center = calculateBeamHeights(groundRanges, elev, stationElevationKm * 1000).map(h => h / 1000);
        const top = calculateBeamHeights(groundRanges, elev + HALF_BW, stationElevationKm * 1000).map(h => h /
            1000);
        const bottom = calculateBeamHeights(groundRanges, elev - HALF_BW, stationElevationKm * 1000).map(h => h /
            1000);
        return { elev, center, top, bottom, idx };
    });
}

function computeBeamsRHI(elevationAngles, rangeKm, stationElevationM) {
    // Calculate the height each beam reaches at this range
    const rangeM = rangeKm * 1000;

    return elevationAngles.map((elev, idx) => {
        // Calculate center, top, and bottom heights at this specific range
        const centerHeights = calculateBeamHeights([rangeM], elev, stationElevationM);
        const topHeights = calculateBeamHeights([rangeM], elev + HALF_BW, stationElevationM);
        const bottomHeights = calculateBeamHeights([rangeM], elev - HALF_BW, stationElevationM);

        return {
            elev,
            idx,
            centerKm: centerHeights[0] / 1000,
            topKm: topHeights[0] / 1000,
            bottomKm: bottomHeights[0] / 1000
        };
    });
}

// ─── AHI Render ───
function renderAHI() {
    const vb = getViewBox();
    svg.setAttribute('viewBox', `0 0 ${vb.w} ${vb.h}`);

    let svgContent = '';

    svgContent += `<defs>
          <clipPath id="plotClip">
              <rect x="0" y="0" width="${vb.w}" height="${vb.h}" />
          </clipPath>
      </defs>`;

    svgContent += `<g clip-path="url(#plotClip)">`;

    // Draw terrain FIRST (behind everything)
    svgContent += renderTerrainAHI(vb);

    // Grid lines
    const yTicks = [0, 5, 10, 15];
    for (const yk of yTicks) {
        const p = dataToSvgAHI(0, yk, vb);
        svgContent += `<line x1="0" y1="${p.y}" x2="${vb.w}" y2="${p.y}" stroke="#141d30" stroke-width="0.5" />`;
    }
    const xTicks = [0, 50, 100, 150, 200];
    for (const xk of xTicks) {
        const p = dataToSvgAHI(xk, 0, vb);
        svgContent += `<line x1="${p.x}" y1="0" x2="${p.x}" y2="${vb.h}" stroke="#141d30" stroke-width="0.5" />`;
    }

    // Draw beams (highest first, lowest last)
    for (let beamIdx = beams.length - 1; beamIdx >= 0; beamIdx--) {
        const beam = beams[beamIdx];
        const profileBeam = currentProfileData ? currentProfileData[beamIdx] : null;

        svgContent += `<g class="beam-group" data-elev="${beam.elev}" data-beam-idx="${beamIdx}">`;

        if (profileBeam && currentPalette) {
            for (let gateIdx = 0; gateIdx < profileBeam.gates.length; gateIdx++) {
                const gate = profileBeam.gates[gateIdx];
                const rangeKm = gate.rangeKm;
                const nextRangeKm = rangeKm + 1;

                if (rangeKm >= MAX_RANGE_KM) continue;

                const color = valueToColor(gate.value, currentPalette, currentMinValue, currentMaxValue);
                if (!color) continue;

                const rangeIdx = Math.round(rangeKm);
                const nextRangeIdx = Math.min(rangeIdx + 1, RANGE_STEPS);

                const topLeft = dataToSvgAHI(rangeKm, beam.top[rangeIdx], vb);
                const topRight = dataToSvgAHI(nextRangeKm, beam.top[nextRangeIdx], vb);
                const bottomRight = dataToSvgAHI(nextRangeKm, beam.bottom[nextRangeIdx], vb);
                const bottomLeft = dataToSvgAHI(rangeKm, beam.bottom[rangeIdx], vb);

                svgContent += `<polygon
                      class="gate-fill"
                      data-beam-idx="${beamIdx}"
                      data-gate-idx="${gateIdx}"
                      data-value="${gate.value}"
                      data-range="${rangeKm}"
                      points="${topLeft.x},${topLeft.y} ${topRight.x},${topRight.y}
  ${bottomRight.x},${bottomRight.y} ${bottomLeft.x},${bottomLeft.y}"
                      fill="${color}"
                      stroke="none"
                  />`;
            }
        }

        // Beam center line
        const centerPath = buildPath(rangesKm, beam.center, vb);
        svgContent += `<polyline class="beam-center" points="${centerPath}" fill="none"
  stroke="rgba(50,50,50,0.5)" stroke-width="0.5" />`;

        svgContent += `</g>`;
    }

    // Crosshairs
    svgContent += `<line id="crosshairX" class="crosshair" x1="0" y1="0" x2="0" y2="${vb.h}" style="display:none"
  />`;
    svgContent += `<line id="crosshairY" class="crosshair" x1="0" y1="0" x2="${vb.w}" y2="0" style="display:none"
  />`;

    svgContent += `</g>`;
    svg.innerHTML = svgContent;
}

// ─── RHI Render ───
function renderRHI() {
    const vb = getViewBox();
    svg.setAttribute('viewBox', `0 0 ${vb.w} ${vb.h}`);

    let svgContent = '';

    svgContent += `<defs>
          <clipPath id="plotClip">
              <rect x="0" y="0" width="${vb.w}" height="${vb.h}" />
          </clipPath>
      </defs>`;

    svgContent += `<g clip-path="url(#plotClip)">`;

    const sliceWidth = rhiEndAzimuth >= rhiStartAzimuth
        ? rhiEndAzimuth - rhiStartAzimuth
        : (360 - rhiStartAzimuth) + rhiEndAzimuth;

    // Draw terrain FIRST (behind everything)
    svgContent += renderTerrainRHI(vb, sliceWidth);

    // Grid lines - height (same as AHI)
    const yTicks = [0, 5, 10, 15];
    for (const yk of yTicks) {
        const p = dataToSvgRHI(0, yk, sliceWidth, vb);
        svgContent += `<line x1="0" y1="${p.y}" x2="${vb.w}" y2="${p.y}" stroke="#141d30" stroke-width="0.5" />`;
    }

    // Vertical grid lines (azimuth)
    for (let i = 0; i <= sliceWidth; i += 3) {
        const x = (i / sliceWidth) * vb.w;
        svgContent += `<line x1="${x}" y1="0" x2="${x}" y2="${vb.h}" stroke="#141d30" stroke-width="0.5" />`;
    }

    // Draw beams (highest first, lowest last)
    for (let beamIdx = beams.length - 1; beamIdx >= 0; beamIdx--) {
        const beam = beams[beamIdx];
        const profileBeam = currentProfileData ? currentProfileData[beamIdx] : null;

        svgContent += `<g class="beam-group" data-elev="${beam.elev}" data-beam-idx="${beamIdx}">`;

        if (profileBeam && currentPalette) {
            for (let gateIdx = 0; gateIdx < profileBeam.gates.length; gateIdx++) {
                const gate = profileBeam.gates[gateIdx];

                // Calculate x position based on azimuth within slice
                let azOffset = gate.azimuth - rhiStartAzimuth;
                if (azOffset < 0) azOffset += 360;

                const color = valueToColor(gate.value, currentPalette, currentMinValue, currentMaxValue);
                if (!color) continue;

                // Calculate positions using height
                const topLeft = dataToSvgRHI(azOffset, beam.topKm, sliceWidth, vb);
                const topRight = dataToSvgRHI(azOffset + 1, beam.topKm, sliceWidth, vb);
                const bottomRight = dataToSvgRHI(azOffset + 1, beam.bottomKm, sliceWidth, vb);
                const bottomLeft = dataToSvgRHI(azOffset, beam.bottomKm, sliceWidth, vb);

                svgContent += `<polygon
                      class="gate-fill"
                      data-beam-idx="${beamIdx}"
                      data-gate-idx="${gateIdx}"
                      data-value="${gate.value}"
                      data-azimuth="${gate.azimuth}"
                      points="${topLeft.x},${topLeft.y} ${topRight.x},${topRight.y}
  ${bottomRight.x},${bottomRight.y} ${bottomLeft.x},${bottomLeft.y}"
                      fill="${color}"
                      stroke="none"
                  />`;
            }
        }

        // Beam center line (horizontal line at centerKm)
        const centerY = vb.h - (beam.centerKm / MAX_HEIGHT_KM) * vb.h;
        svgContent += `<line class="beam-center" x1="0" y1="${centerY}" x2="${vb.w}" y2="${centerY}"
              stroke="rgba(100,100,100,0.3)" stroke-width="0.5" />`;

        svgContent += `</g>`;
    }

    // Crosshairs
    svgContent += `<line id="crosshairX" class="crosshair" x1="0" y1="0" x2="0" y2="${vb.h}" style="display:none"
  />`;
    svgContent += `<line id="crosshairY" class="crosshair" x1="0" y1="0" x2="${vb.w}" y2="0" style="display:none"
  />`;

    svgContent += `</g>`;
    svg.innerHTML = svgContent;
}

function renderTerrainAHI(vb) {
    if (!currentAHITerrain || !currentTerrainWidth) return '';

    const NO_DATA_THRESHOLD = 9000; // meters - anything above this is likely "no data"
    const TERRAIN_COLOR = '#C4A484';
    const NO_DATA_COLOR = '#D3D3D3'; // light gray

    let svgContent = '';
    const rangeStepKm = MAX_RANGE_KM / currentTerrainWidth;

    // Group terrain into segments by whether they have valid data or not
    let segments = [];
    let currentSegment = null;

    for (let i = 0; i < currentAHITerrain.length && i < currentTerrainWidth; i++) {
        const rangeKm = i * rangeStepKm;
        if (rangeKm > MAX_RANGE_KM) break;

        const elevation = currentAHITerrain[i];
        const isNoData = elevation >= NO_DATA_THRESHOLD;
        const heightKm = isNoData ? 0.5 : elevation / 1000; // Use a small height for no-data areas

        if (!currentSegment || currentSegment.isNoData !== isNoData) {
            // Start a new segment
            if (currentSegment) {
                segments.push(currentSegment);
            }
            currentSegment = {
                isNoData,
                points: [],
                startRange: rangeKm
            };
        }
        currentSegment.points.push({ rangeKm, heightKm });
        currentSegment.endRange = rangeKm;
    }
    if (currentSegment) {
        segments.push(currentSegment);
    }

    // Render each segment
    for (const segment of segments) {
        const color = segment.isNoData ? NO_DATA_COLOR : TERRAIN_COLOR;
        let pathPoints = [];

        // Start at bottom-left of segment
        const startP = dataToSvgAHI(segment.startRange, 0, vb);
        pathPoints.push(`${startP.x},${vb.h}`);

        // Add terrain profile points
        for (const pt of segment.points) {
            const p = dataToSvgAHI(pt.rangeKm, pt.heightKm, vb);
            pathPoints.push(`${p.x},${p.y}`);
        }

        // End at bottom-right of segment
        const endP = dataToSvgAHI(segment.endRange, 0, vb);
        pathPoints.push(`${endP.x},${vb.h}`);

        // Close the path
        pathPoints.push(`${startP.x},${vb.h}`);

        svgContent += `<polygon
              class="terrain-fill"
              points="${pathPoints.join(' ')}"
              fill="${color}"
              fill-opacity="0.7"
          />`;
    }

    return svgContent;
}

function renderTerrainRHI(vb, sliceWidth) {
    if (!currentRHITerrain || currentRHITerrain.length === 0) return '';

    const NO_DATA_THRESHOLD = 9000; // meters
    const TERRAIN_COLOR = '#C4A484';
    const NO_DATA_COLOR = '#D3D3D3'; // light gray

    let svgContent = '';

    // Group terrain into segments by whether they have valid data or not
    let segments = [];
    let currentSegment = null;

    for (let i = 0; i < currentRHITerrain.length; i++) {
        const azOffset = i;
        const elevation = currentRHITerrain[i].elevation;
        const isNoData = elevation >= NO_DATA_THRESHOLD;
        const heightKm = isNoData ? 0.5 : elevation / 1000;

        if (!currentSegment || currentSegment.isNoData !== isNoData) {
            if (currentSegment) {
                segments.push(currentSegment);
            }
            currentSegment = {
                isNoData,
                points: [],
                startAzOffset: azOffset
            };
        }
        currentSegment.points.push({ azOffset, heightKm });
        currentSegment.endAzOffset = azOffset;
    }
    if (currentSegment) {
        segments.push(currentSegment);
    }

    // Render each segment
    for (const segment of segments) {
        const color = segment.isNoData ? NO_DATA_COLOR : TERRAIN_COLOR;
        let pathPoints = [];

        // Start at bottom-left of segment
        const startP = dataToSvgRHI(segment.startAzOffset, 0, sliceWidth, vb);
        pathPoints.push(`${startP.x},${vb.h}`);

        // Add terrain profile points
        for (const pt of segment.points) {
            const p = dataToSvgRHI(pt.azOffset, pt.heightKm, sliceWidth, vb);
            pathPoints.push(`${p.x},${p.y}`);
        }

        // End at bottom-right of segment
        const endP = dataToSvgRHI(segment.endAzOffset, 0, sliceWidth, vb);
        pathPoints.push(`${endP.x},${vb.h}`);

        // Close the path
        pathPoints.push(`${startP.x},${vb.h}`);

        svgContent += `<polygon
              class="terrain-fill"
              points="${pathPoints.join(' ')}"
              fill="${color}"
              fill-opacity="0.7"
          />`;
    }

    return svgContent;
}

function render() {
    if (currentMode === 'AHI') {
        renderAHI();
    } else {
        renderRHI();
    }
}

// ─── Axis labels ───
function renderAxesAHI() {
    const yLabels = document.getElementById('yLabels');
    const xLabels = document.getElementById('xLabels');
    const yTitle = document.querySelector('.y-axis-title');
    const xTitle = document.querySelector('.x-axis-title');

    const yTicks = [15, 10, 5, 0];
    yLabels.innerHTML = yTicks.map(v => `<span class="label">${v}</span>`).join('');

    const xTicks = [0, 50, 100, 150, 200, 230];
    xLabels.innerHTML = xTicks.map(v => `<span class="label">${v}</span>`).join('');

    if (yTitle) yTitle.textContent = 'Height (km)';
    if (xTitle) xTitle.textContent = 'Ground Range (km)';
}

function renderAxesRHI() {
    const yLabels = document.getElementById('yLabels');
    const xLabels = document.getElementById('xLabels');
    const yTitle = document.querySelector('.y-axis-title');
    const xTitle = document.querySelector('.x-axis-title');

    // Y-axis: height (same as AHI)
    const yTicks = [15, 10, 5, 0];
    yLabels.innerHTML = yTicks.map(v => `<span class="label">${v}</span>`).join('');

    // X-axis: azimuth range
    const sliceWidth = rhiEndAzimuth >= rhiStartAzimuth
        ? rhiEndAzimuth - rhiStartAzimuth
        : (360 - rhiStartAzimuth) + rhiEndAzimuth;

    const xTicks = [];
    for (let i = 0; i <= sliceWidth; i += 3) {
        xTicks.push(((rhiStartAzimuth + i) % 360).toFixed(0));
    }
    xLabels.innerHTML = xTicks.map(v => `<span class="label">${v}°</span>`).join('');

    if (yTitle) yTitle.textContent = 'Height (km)';
    if (xTitle) xTitle.textContent = 'Azimuth (°)';
}

function renderAxes() {
    if (currentMode === 'AHI') {
        renderAxesAHI();
    } else {
        renderAxesRHI();
    }
}

// ─── Hover logic ───
function findNearestBeamAndGateAHI(rangeKm, heightKm) {
    let bestBeam = null;
    let bestGate = null;
    let bestDist = Infinity;

    const rangeIdx = Math.round(rangeKm);
    if (rangeIdx < 0 || rangeIdx > RANGE_STEPS) return { beam: null, gate: null };

    // Find beam with the closest center line
    for (let beamIdx = 0; beamIdx < beams.length; beamIdx++) {
        const beam = beams[beamIdx];
        const center = beam.center[rangeIdx];
        const top = beam.top[rangeIdx];
        const bottom = beam.bottom[rangeIdx];

        const distToCenter = Math.abs(heightKm - center);

        if (distToCenter < bestDist) {
            bestDist = distToCenter;
            bestBeam = { ...beam, beamIdx, centerH: center, topH: top, bottomH: bottom };

            if (currentProfileData && currentProfileData[beamIdx]) {
                const gates = currentProfileData[beamIdx].gates;
                const gateIdx = Math.floor(rangeKm);
                if (gateIdx >= 0 && gateIdx < gates.length) {
                    bestGate = { ...gates[gateIdx], gateIdx };
                }
            }
        }
    }

    return { beam: bestBeam, gate: bestGate };
}

function findNearestBeamAndGateRHI(azimuthOffset, heightKm) {
    let bestBeam = null;
    let bestGate = null;
    let bestDist = Infinity;

    for (let beamIdx = 0; beamIdx < beams.length; beamIdx++) {
        const beam = beams[beamIdx];

        const distToCenter = Math.abs(heightKm - beam.centerKm);

        if (distToCenter < bestDist) {
            bestDist = distToCenter;
            bestBeam = { ...beam, beamIdx };

            if (currentProfileData && currentProfileData[beamIdx]) {
                const gates = currentProfileData[beamIdx].gates;
                // Find gate by azimuth
                const targetAz = (rhiStartAzimuth + azimuthOffset) % 360;
                let closestGate = null;
                let closestDiff = Infinity;

                for (let i = 0; i < gates.length; i++) {
                    let diff = Math.abs(gates[i].azimuth - targetAz);
                    if (diff > 180) diff = 360 - diff;
                    if (diff < closestDiff) {
                        closestDiff = diff;
                        closestGate = { ...gates[i], gateIdx: i };
                    }
                }

                if (closestGate) {
                    bestGate = closestGate;
                }
            }
        }
    }

    return { beam: bestBeam, gate: bestGate };
}

container.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const vb = { w: rect.width, h: rect.height };

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

    let beam, gate;

    if (currentMode === 'AHI') {
        const rangeKm = (mx / vb.w) * MAX_RANGE_KM;
        const heightKm = (1 - my / vb.h) * MAX_HEIGHT_KM;
        ({ beam, gate } = findNearestBeamAndGateAHI(rangeKm, heightKm));

        if (beam) {
            tooltip.style.display = 'block';

            let valueDisplay = 'No Data';
            if (gate && gate.value !== null && !isNaN(gate.value)) {
                valueDisplay = `${gate.value.toFixed(1)} ${currentUnits}`;
            }

            // Calculate ASL and AGL
            const aslKm = heightKm;
            let aglKm = heightKm;

            if (currentAHITerrain && currentTerrainWidth) {
                const rangeStepKm = MAX_RANGE_KM / currentTerrainWidth;
                const terrainIdx = Math.min(Math.floor(rangeKm / rangeStepKm), currentAHITerrain.length - 1);
                if (terrainIdx >= 0 && currentAHITerrain[terrainIdx] !== undefined) {
                    const terrainKm = currentAHITerrain[terrainIdx] / 1000;
                    aglKm = heightKm - terrainKm;
                }
            }

            tooltip.innerHTML = `
              <div class="elev-label">${beam.elev.toFixed(1)}° Elevation</div>
              <div>Range: ${rangeKm.toFixed(1)} km</div>
              <div>ASL: ${aslKm.toFixed(2)} km</div>
              <div>AGL: ${aglKm.toFixed(2)} km</div>
              <div>Value: ${valueDisplay}</div>
          `;
        } else {
            tooltip.style.display = 'none';
        }
    } else {
        const sliceWidth = rhiEndAzimuth >= rhiStartAzimuth
            ? rhiEndAzimuth - rhiStartAzimuth
            : (360 - rhiStartAzimuth) + rhiEndAzimuth;

        const azimuthOffset = (mx / vb.w) * sliceWidth;
        const heightKm = (1 - my / vb.h) * MAX_HEIGHT_KM;
        ({ beam, gate } = findNearestBeamAndGateRHI(azimuthOffset, heightKm));

        if (beam) {
            tooltip.style.display = 'block';

            let valueDisplay = 'No Data';
            if (gate && gate.value !== null && !isNaN(gate.value)) {
                valueDisplay = `${gate.value.toFixed(1)} ${currentUnits}`;
            }

            const displayAz = ((rhiStartAzimuth + azimuthOffset) % 360).toFixed(1);

            // ASL is the height at the mouse position
            const aslKm = heightKm;

            // Calculate AGL by subtracting terrain at this azimuth
            let aglKm = aslKm;
            if (currentRHITerrain && currentRHITerrain.length > 0) {
                const terrainIdx = Math.min(Math.floor(azimuthOffset), currentRHITerrain.length - 1);
                if (terrainIdx >= 0 && currentRHITerrain[terrainIdx]) {
                    const terrainKm = currentRHITerrain[terrainIdx].elevation / 1000;
                    aglKm = aslKm - terrainKm;
                }
            }

            tooltip.innerHTML = `
              <div class="elev-label">${beam.elev.toFixed(1)}° Elevation</div>
              <div>Azimuth: ${displayAz}°</div>
              <div>Range: ${rhiRangeKm.toFixed(2)} km</div>
              <div>ASL: ${aslKm.toFixed(2)} km</div>
              <div>AGL: ${aglKm.toFixed(2)} km</div>
              <div>Value: ${valueDisplay}</div>
          `;
        } else {
            tooltip.style.display = 'none';
        }
    }

    if (beam) {
        let tx = mx + 14;
        let ty = my - 10;
        const tw = tooltip.offsetWidth;
        const th = tooltip.offsetHeight;
        if (tx + tw > rect.width) tx = mx - tw - 14;
        if (ty + th > rect.height) ty = rect.height - th - 4;
        if (ty < 0) ty = 4;
        tooltip.style.left = tx + 'px';
        tooltip.style.top = ty + 'px';
    }
});

container.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
    const crossX = document.getElementById('crosshairX');
    const crossY = document.getElementById('crosshairY');
    if (crossX) crossX.style.display = 'none';
    if (crossY) crossY.style.display = 'none';
});

// ─── Event Listeners ───
document.addEventListener('profile-data-ready', (e) => {
    if (currentMode !== 'AHI') return;

    const { profileData, azimuth, moment, units, palette, minValue, maxValue, terrain, terrainWidth } = e.detail;

    currentProfileData = profileData;
    currentPalette = palette;
    currentMinValue = minValue;
    currentMaxValue = maxValue;
    currentUnits = units;
    currentAHITerrain = terrain;
    currentTerrainWidth = terrainWidth;
    currentAzimuth = azimuth;

    stationElevationKm = (terrain && terrain.length > 0) ? terrain[0] / 1000 : 0;

    const elevationAngles = profileData.map(p => p.elevation);
    beams = computeBeamsAHI(elevationAngles);
    setHasData(true);

    render();
    renderAxes();
    updateProfileInfo();
});

document.addEventListener('profile-rhi-data-ready', (e) => {
    if (currentMode !== 'RHI') return;

    const { profileData, startAzimuth, endAzimuth, rangeKm, units, palette, minValue, maxValue, terrain,
        stationElevation } = e.detail;

    currentProfileData = profileData;
    currentPalette = palette;
    currentMinValue = minValue;
    currentMaxValue = maxValue;
    currentUnits = units;
    rhiStartAzimuth = startAzimuth;
    rhiEndAzimuth = endAzimuth;
    rhiRangeKm = rangeKm;
    currentRHITerrain = terrain;

    const stationElevM = stationElevation || 0;

    const elevationAngles = profileData.map(p => p.elevation);
    beams = computeBeamsRHI(elevationAngles, rangeKm, stationElevM);
    setHasData(true);

    render();
    renderAxes();
    updateProfileInfo();
});

document.addEventListener('overlay-cleared', () => {
    currentProfileData = null;
    currentPalette = null;
    currentMinValue = 0;
    currentMaxValue = 100;
    currentUnits = '';
    beams = [];
    currentAHITerrain = null;
    currentTerrainWidth = null;
    stationElevationKm = 0;
    currentAzimuth = 0;

    setHasData(false);
    setFolded(true);

    render();
    renderAxes();
    updateProfileInfo();
});

// ─── Init ───
createModeSwitcher();
initFoldButton();
renderAxes();
window.addEventListener('resize', render);