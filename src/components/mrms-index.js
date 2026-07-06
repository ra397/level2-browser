import { Calendar } from "./calendar.js";
import { aggregateByDay, loadRadarData, getHourlyDataForDay, transformToLocal } from "../mrmsArchiveDataLoader.js";
import { barChart } from "./barChart.js";
import {DragContainer, draggerClassList} from "./draggable.js";
import {fetchFilesForDate} from "./menu.js";

const VARIABLE_LABELS = {
    'max_rain': 'Max Depth (mm)',
    'area_rain': 'Area (%)',
    'mean_rain': 'Mean Depth (mm)'
};

const popup = document.getElementsByClassName("mrms-index-popup")[0];
popup.drag = new DragContainer(popup, draggerClassList);
const calendarEl = document.getElementById('calendar');
const barChartEl = document.getElementById('chart');

const variableSelectionEl = document.getElementById("variable-selection");
const backBtn = document.getElementById('back');

const getMostRecentBtn = document.getElementById('getMostRecentBtn');
const viewLevel2Btn = document.getElementById('viewLevel2Btn');

let currentRadar = null;
let currentYear = 2026;
let useLocalTime = true;

let radarDataUTC = null;
let radarDataLocal = null;
let selectedDay = null;

function getCurrentData() {
    return useLocalTime ? radarDataLocal : radarDataUTC;
}

const title = document.querySelector('.mrms-index-popup > .title')

function showBarChart() {
    calendarEl.classList.add('hidden');
    barChartEl.classList.remove('hidden');
    backBtn.classList.remove('hidden');
    getMostRecentBtn.classList.add('hidden');
    viewLevel2Btn.classList.remove('hidden');
    title.textContent = "Choose an hour:";
}

function showCalendar() {
    barChartEl.classList.add('hidden');
    calendarEl.classList.remove('hidden');
    backBtn.classList.add('hidden');
    getMostRecentBtn.classList.remove('hidden');
    viewLevel2Btn.classList.add('hidden');
    title.textContent = "Choose a day:";
}

function updateBarChart() {
    if (!selectedDay) return;

    const variable = variableSelectionEl.value;
    const hourlyData = getHourlyDataForDay(getCurrentData(), selectedDay.timestamp, variable);

    barChart(barChartEl, {
        data: hourlyData,
        variable: variable,
    });
}

function handleDayClick(dayTimestamp, date) {
    selectedDay = {
        timestamp: dayTimestamp,
        date: date,
        dateStr: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };
    updateBarChart();
    showBarChart();
}

function buildColorMap(summary) {
    const colors = [
        "",
        "#ffffbf",
        "#fdae61",
        "#d7191c"
    ];

    const map = {};

    for (const [variable, stats] of Object.entries(summary)) {
        map[variable] = [
            { max: stats.p67, color: colors[0] },
            { max: stats.p80, color: colors[1] },
            { max: stats.p97, color: colors[2] },
            { max: Infinity, color: colors[3] }
        ];
    }

    return map;
}

let calendar = null;

async function initArchive(e) {
    currentRadar = e.detail['radarId'];

    const summary = await fetch(
        `/mrms-stats/summary?radar=${currentRadar}`
    ).then(r => r.json());

    const colorMap = buildColorMap(summary);

    radarDataUTC = await loadRadarData(`/mrms-stats?radar=${currentRadar}&year=${currentYear}`);
    radarDataLocal = transformToLocal(radarDataUTC);

    calendar = new Calendar(
        new Date(2020, 9, 14),   // startDate
        new Date(),              // endDate
        currentYear,
        calendarEl,
        aggregateByDay(getCurrentData(), 'mean'),
        variableSelectionEl.value,
        colorMap,
        handleDayClick
    );
    updateBarChart();
    popup.classList.remove('hidden');
}

document.removeEventListener('init:archive', initArchive);
document.addEventListener("init:archive", initArchive);

const closeBtn = document.querySelector('.mrms-index-popup .close-btn');
closeBtn.addEventListener("click", () => {
    popup.classList.add('hidden');
    showCalendar();
})

async function handleYearChange(direction) {
    const prevBtn = document.getElementById('prev');
    const nextBtn = document.getElementById('next');
    const targetYear = currentYear + direction;

    try {
        prevBtn.disabled = true;
        nextBtn.disabled = true;

        radarDataUTC = await loadRadarData(`/mrms-stats?radar=${currentRadar}&year=${targetYear}`);
        radarDataLocal = transformToLocal(radarDataUTC);

        currentYear = targetYear;
        calendar.updateData(aggregateByDay(getCurrentData(), 'mean'));
        calendar.setYear(currentYear);

    } catch (error) {
        console.error(`Failed to load radar data for year ${targetYear}:`, error);
    } finally {
        prevBtn.disabled = false;
        nextBtn.disabled = false;
    }
}

// Clean, single-responsibility event listeners
document.getElementById('prev').addEventListener('click', () => handleYearChange(-1));
document.getElementById('next').addEventListener('click', () => handleYearChange(1));
backBtn.addEventListener('click', showCalendar);

variableSelectionEl.addEventListener('change',  () => {
    const newVariable = variableSelectionEl.value;
    calendar.updateVariable(newVariable);
    updateBarChart();
});

document.addEventListener('timezone-change', (e) => {
    useLocalTime = e.detail.timezone === 'local';

    // Recalculate selected day for new timezone
    if (selectedDay) {
        const DAY = 86400;
        const utcMidnight = Date.UTC(selectedDay.date.getFullYear(), selectedDay.date.getMonth(), selectedDay.date.getDate()) / 1000;
        selectedDay.timestamp = Math.floor(utcMidnight / DAY) * DAY;
    }

    calendar.updateData(aggregateByDay(getCurrentData(), 'mean'));
    updateBarChart();
});

document.addEventListener("clear-all-overlays", (e) => {
    showCalendar();
})


getMostRecentBtn.addEventListener('click', async () => {
    if (!currentRadar) {
        alert('No radar selected');
        return;
    }

    getMostRecentBtn.textContent = 'Fetching...';
    getMostRecentBtn.disabled = true;

    try {
        // Fetch today's files
        const today = new Date();
        const files = await fetchFilesForDate(currentRadar, today);

        if (files.length === 0) {
            alert('No files found for today');
            getMostRecentBtn.textContent = 'Get Most Recent';
            getMostRecentBtn.disabled = false;
            return;
        }

        // Get the last (most recent) file
        const mostRecentFile = files[files.length - 1];
        const url = `https://unidata-nexrad-level2.s3.amazonaws.com/${mostRecentFile}`;

        // Decode it
        document.dispatchEvent(new CustomEvent('decode-requested', { detail: { url } }));

    } catch (err) {
        console.error('Error fetching most recent file:', err);
        alert('Error: ' + err.message);
        getMostRecentBtn.textContent = 'Get Most Recent';
        getMostRecentBtn.disabled = false;
    }
});

document.addEventListener('decode-success', () => {
    getMostRecentBtn.textContent = 'Get Most Recent';
    getMostRecentBtn.disabled = false;
});

document.addEventListener('decode-error', () => {
    getMostRecentBtn.textContent = 'Get Most Recent';
    getMostRecentBtn.disabled = false;
});

export const formatValue = (value, variable) => {
    if (variable === "max_rain") {
        return value.toFixed(2) + " mm";
    } else if (variable === "area_rain") {
        return (value * 100).toFixed(2) + "%";
    } else if (variable === "mean_rain") {
        return value.toFixed(2) + " mm";
    } else if (variable === "volume_rain") {
        // Convert mm³ to Liters (1 L = 1,000,000 mm³)
        const liters = value / 1e6;
        if (liters >= 1e9) {
            return (liters / 1e9).toFixed(2) + " GL"; // Gigaliters
        } else if (liters >= 1e6) {
            return (liters / 1e6).toFixed(2) + " ML"; // Megaliters
        } else if (liters >= 1e3) {
            return (liters / 1e3).toFixed(2) + " kL"; // Kiloliters
        } else {
            return liters.toFixed(2) + " L";
        }
    }
    return value.toFixed(2);
};
