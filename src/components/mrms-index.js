import { Calendar, colorMap } from "./calendar.js";
import { aggregateByDay, loadRadarData, getHourlyDataForDay, getTimezoneOffset } from "../mrmsArchiveDataLoader.js";
import { barChart } from "./barChart.js";

const VARIABLE_LABELS = {
    'volume_rain': 'Volume (L)',
    'area_rain': 'Area (%)',
    'mean_rain': 'Mean Depth (mm)'
};

const popup = document.getElementsByClassName("mrms-index-popup")[0];
const calendarEl = document.getElementById('calendar');
const barChartEl = document.getElementById('chart');

const variableSelectionEl = document.getElementById("variable-selection");
const aggregationMethodSelectionEl = document.getElementById("aggregation-method-selection");
const backBtn = document.getElementById('back');

let currentRadar = null;
let currentYear = 2026;
let useLocalTime = true;
let radarData = null;
let selectedDay = null;

function getCurrentTzOffset() {
    return getTimezoneOffset(useLocalTime);
}

function showBarChart() {
    calendarEl.classList.add('hidden');
    barChartEl.classList.remove('hidden');
    backBtn.classList.remove('hidden');
}

function showCalendar() {
    barChartEl.classList.add('hidden');
    calendarEl.classList.remove('hidden');
    backBtn.classList.add('hidden');
}

function updateBarChart() {
    if (!selectedDay) return;

    const variable = variableSelectionEl.value;
    const tzOffset = getCurrentTzOffset();
    const hourlyData = getHourlyDataForDay(radarData, selectedDay.timestamp, variable, tzOffset);

    barChart(barChartEl, {
        data: hourlyData,
        yLabel: VARIABLE_LABELS[variable] || variable
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

let calendar = null;

async function initArchive(e) {
    currentRadar = e.detail['radarId'];
    radarData = await loadRadarData(`/nexrad-l2/data/mrms/${currentRadar}_${currentYear}.json`);
    calendar = new Calendar(
        new Date(2020, 9, 14),   // startDate
        new Date(),                                    // endDate
        currentYear,
        calendarEl,
        aggregateByDay(radarData, aggregationMethodSelectionEl.value, getCurrentTzOffset()),
        variableSelectionEl.value,
        colorMap,
        handleDayClick,
        getCurrentTzOffset()
    );
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

        radarData = await loadRadarData(`/nexrad-l2/data/mrms/${currentRadar}_${targetYear}.json`);

        // Only updates state if fetch succeeds
        currentYear = targetYear;
        calendar.updateData(aggregateByDay(radarData, aggregationMethodSelectionEl.value, getCurrentTzOffset()));
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

aggregationMethodSelectionEl.addEventListener('change',() => {
    const newAggregationMethod = aggregationMethodSelectionEl.value;
    const newData = aggregateByDay(radarData, newAggregationMethod, getCurrentTzOffset());
    calendar.updateData(newData);
});

document.addEventListener('timezone-change', (e) => {
    useLocalTime = e.detail.timezone === 'local';
    const tzOffset = getCurrentTzOffset();

    // Recalculate selected day timestamp for new timezone
    if (selectedDay) {
        const DAY = 86400;
        const utcTimestamp = Date.UTC(selectedDay.date.getFullYear(), selectedDay.date.getMonth(), selectedDay.date.getDate()) / 1000;
        const adjustedTimestamp = utcTimestamp - tzOffset;
        selectedDay.timestamp = Math.floor(adjustedTimestamp / DAY) * DAY;
    }

    // Re-aggregate data with new timezone
    const newData = aggregateByDay(radarData, aggregationMethodSelectionEl.value, tzOffset);
    calendar.setTimezoneOffset(tzOffset);
    calendar.updateData(newData);
    updateBarChart();
});

document.addEventListener("clear-all-overlays", (e) => {
    showCalendar();
})