import './legend.css';

const legendContainer = document.getElementById('color-legend');
const legendTitle = legendContainer.querySelector('.legend-title');
const legendBar = legendContainer.querySelector('.legend-bar');
const legendLabels = legendContainer.querySelector('.legend-labels');

function formatValue(value) {
    if (Number.isInteger(value)) {
        return value.toString();
    }
    return parseFloat(value.toFixed(2)).toString();
}

export function hideLegend() {
    legendContainer.classList.add('hidden');
}

export function updateLegend(palette, units, labelStep = 1) {
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