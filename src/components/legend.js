import './legend.css';

const legendContainer = document.getElementById('color-legend');
const legendTitle = legendContainer.querySelector('.legend-title');
const legendBar = legendContainer.querySelector('.legend-bar');
const legendLabels = legendContainer.querySelector('.legend-labels');

// Store current legend data for each mode
let level2LegendData = null;
let mrmsLegendData = null;
let currentMode = 'level2';

function formatValue(value) {
    if (Number.isInteger(value)) {
        return value.toString();
    }
    return parseFloat(value.toFixed(2)).toString();
}

export function hideLegend() {
    legendContainer.classList.add('hidden');
}

function renderLegend(palette, units, labelStep = 1) {
    const sortedKeys = Object.keys(palette).map(Number).sort((a, b) => a - b);

    legendTitle.textContent = units || '';

    legendBar.innerHTML = sortedKeys.map((key) => {
        const [r, g, b] = palette[key];
        return `<div class="legend-segment" style="background-color: rgb(${r},${g},${b});"></div>`;
    }).join('');

    legendLabels.innerHTML = sortedKeys.map((key, index) => {
        if (index % labelStep !== 0) return '<span class="legend-label"></span>';
        return `<span class="legend-label">${formatValue(key)}</span>`;
    }).join('');

    legendContainer.classList.remove('hidden');
}

// Update Level II legend (called from main.js)
export function updateLevel2Legend(palette, units, labelStep = 1) {
    level2LegendData = { palette, units, labelStep };

    // Only render if we're in Level II mode
    if (currentMode === 'level2') {
        renderLegend(palette, units, labelStep);
    }
}

// Update MRMS legend
export function updateMRMSLegend(thresholds, colors, units) {
    // Convert MRMS format to palette format
    const palette = {};
    for (let i = 0; i < thresholds.length && i < colors.length; i++) {
        const [r, g, b] = colors[i];
        palette[thresholds[i]] = [r, g, b];
    }

    mrmsLegendData = { palette, units, labelStep: 1 };

    // Only render if we're in MRMS mode
    if (currentMode === 'mrms') {
        renderLegend(palette, units, 1);
    }
}

// Clear Level II legend data
export function clearLevel2Legend() {
    level2LegendData = null;
    if (currentMode === 'level2') {
        hideLegend();
    }
}

// Clear MRMS legend data
export function clearMRMSLegend() {
    mrmsLegendData = null;
    if (currentMode === 'mrms') {
        hideLegend();
    }
}

// Listen for mode changes
document.addEventListener('mode-changed', (e) => {
    const { mode } = e.detail;
    currentMode = mode;

    if (mode === 'level2') {
        if (level2LegendData) {
            renderLegend(level2LegendData.palette, level2LegendData.units, level2LegendData.labelStep);
        } else {
            hideLegend();
        }
    } else if (mode === 'mrms') {
        if (mrmsLegendData) {
            renderLegend(mrmsLegendData.palette, mrmsLegendData.units, mrmsLegendData.labelStep);
        } else {
            hideLegend();
        }
    }
});