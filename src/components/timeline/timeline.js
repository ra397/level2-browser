// import './Timeline/TimelineRenderer.js';
// import './Timeline/TimelineController.js';
// import './timeline.css';
// import {extractTimestampFromKey} from "../../main.js";
//
//
// const today = new Date();
// const startDate = new Date(today);
// startDate.setHours(today.getHours() - 6);
//
// const timeline = new Timeline(
//     document.getElementById('timeline'),
//     document.getElementById('start-marker'),
//     document.getElementById('stop-marker'),
//     document.getElementById('current-frame-marker'),
//     {
//         resolution: "hour",
//         startDate: new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), startDate.getHours()),
//     }
// );
//
// const timelineController = new TimelineController(timeline, document.getElementById('timeline'));
//
// timelineController.onRangeSelected(({ startDate, endDate }) => {
//     document.dispatchEvent(new CustomEvent('time-selected', {
//         detail: {
//             startDate,
//             endDate,
//         },
//     }))
// });
//
// document.addEventListener('frame-changed', (event) => {
//     const { filename } = event.detail;
//     try {
//         const timestamp = extractTimestampFromKey(filename);
//         timeline.setCurrentFrameDate(timestamp);
//     } catch (e) {
//         timeline.clearCurrentFrameDate();
//     }
// });
//
// document.addEventListener('display-reset', () => {
//     timeline.clearCurrentFrameDate();
// });
//
// document.getElementById('zoom-in-btn').addEventListener('click', () => {
//     const timelineEl = document.getElementById('timeline');
//     const timelineSpans = timelineEl.children;
//     if (timelineSpans.length === 0) return;
//
//     const middleTimeSpan = timelineSpans[Math.floor((timelineSpans.length - 1) / 2)];
//     const isoDate = middleTimeSpan.getAttribute('date');
//     const zoomToDate = new Date(isoDate);
//
//     timeline.zoom('in', zoomToDate);
// });
//
// document.getElementById('zoom-out-btn').addEventListener('click', () => {
//     timeline.zoom('out');
// });
//
// document.addEventListener('timezone-change', (event) => {
//     const { timezone } = event.detail;
//     timeline.setTimezone(timezone);
// });