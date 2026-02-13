import './Timeline/TimelineRenderer.js';
import './Timeline/TimelineController.js';
import './timeline.css';

function extractTimestampFromKey(filename) {
    const match = filename.match(/(\d{8})-(\d{6})\.grib2\.gz$/);

    if (!match) {
        throw new Error("No valid timestamp found in the input string.");
    }

    const [_, yyyymmdd, hhmmss] = match;

    const year = yyyymmdd.substring(0, 4);
    const month = yyyymmdd.substring(4, 6);
    const day = yyyymmdd.substring(6, 8);

    const hour = hhmmss.substring(0, 2);
    const minute = hhmmss.substring(2, 4);
    const second = hhmmss.substring(4, 6);

    return new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
    ));
}

const today = new Date();
const startDate = new Date(today);
startDate.setHours(today.getHours() - 6);

const timeline = new Timeline(
    document.getElementById('timeline'),
    document.getElementById('start-marker'),
    document.getElementById('stop-marker'),
    document.getElementById('current-frame-marker'),
    {
        resolution: "hour",
        startDate: new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), startDate.getHours()),
    }
);

const timelineController = new TimelineController(timeline, document.getElementById('timeline'));

timelineController.onRangeSelected(({ startDate, endDate }) => {
    document.dispatchEvent(new CustomEvent('time-selected', {
        detail: {
            startDate,
            endDate,
        },
    }))
});

document.addEventListener('frame-changed', (event) => {
    const { filename } = event.detail;
    try {
        const timestamp = extractTimestampFromKey(filename);
        timeline.setCurrentFrameDate(timestamp);
    } catch (e) {
        timeline.clearCurrentFrameDate();
    }
});

document.addEventListener('display-reset', () => {
    timeline.clearCurrentFrameDate();
});

document.getElementById('zoom-in-btn').addEventListener('click', () => {
    const timelineEl = document.getElementById('timeline');
    const timelineSpans = timelineEl.children;
    if (timelineSpans.length === 0) return;

    const middleTimeSpan = timelineSpans[Math.floor((timelineSpans.length - 1) / 2)];
    const isoDate = middleTimeSpan.getAttribute('date');
    const zoomToDate = new Date(isoDate);

    timeline.zoom('in', zoomToDate);
});

document.getElementById('zoom-out-btn').addEventListener('click', () => {
    timeline.zoom('out');
});

document.addEventListener('timezone-change', (event) => {
    const { timezone } = event.detail;
    timeline.setTimezone(timezone);
});