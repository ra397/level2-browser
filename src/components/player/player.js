// import './player.css';
// import './playback-settings.css';
// import {extractTimestampFromKey} from "../../main.js";
//
// let isPlaying = false;
//
// const playPause = document.getElementById("play-pause-btn");
// // const prevBtn = document.getElementById("step-backward");
// // const nextBtn = document.getElementById("step-forward");
//
// const playSVG = `
//     <svg height="100%" width="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
//         <polygon points="0,0 0,100 75,50 0,0" fill="black"/>
//     </svg>
// `;
//
// const pauseSVG = `
//     <svg width="100%" height="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
//         <rect x="20" y="10" width="20" height="80" fill="black"/>
//         <rect x="60" y="10" width="20" height="80" fill="black" />
//     </svg>
// `;
//
// playPause.addEventListener("click", () => {
//     togglePlayPause();
// });
//
// // nextBtn.addEventListener("click", () => {
// //     document.dispatchEvent(new CustomEvent("player-step", {
// //         detail: { direction: 1 },
// //     }));
// // });
// //
// // prevBtn.addEventListener("click", () => {
// //     document.dispatchEvent(new CustomEvent("player-step", {
// //         detail: { direction: -1 },
// //     }));
// // });
//
// function togglePlayPause() {
//     isPlaying = !isPlaying; // update state
//     playPause.innerHTML = isPlaying ? pauseSVG : playSVG; // update icon
//     const eventName = isPlaying ? 'player-play' : 'player-pause';
//     document.dispatchEvent(new CustomEvent(eventName));
// }
//
// playPause.innerHTML = playSVG;
//
// /* Player Seek Slider */
//
// const slider = document.getElementById('player-seek');
//
//
// slider.addEventListener('input', () => {
//    const index = parseInt(slider.value, 10);
//    document.dispatchEvent(new CustomEvent("player-seek", {
//        detail: { index },
//    }));
// });
//
// export function setSliderRange(min, max) {
//     slider.min = min;
//     slider.max = max;
//     slider.value = min;
// }
//
// export function setSliderValue(value) {
//     slider.value = value;
// }
//
// function getSliderValue() {
//     return parseInt(slider.value, 10);
// }
//
// /* Settings Menu */
//
// const settingsBtn = document.getElementById('playback-settings-btn');
// const settingsMenu = document.getElementById('playback-settings-menu');
// const settingsOptions = document.querySelectorAll('.playback-settings-option');
//
// let currentSpeed = 1;
//
// settingsBtn.addEventListener('click', (e) => {
//     e.stopPropagation();
//     settingsMenu.classList.toggle('hidden');
// });
//
// // Close menu when clicking outside
// document.addEventListener('click', (e) => {
//     if (!settingsMenu.contains(e.target) && e.target !== settingsBtn) {
//         settingsMenu.classList.add('hidden');
//     }
// });
//
// settingsOptions.forEach(option => {
//     option.addEventListener('click', () => {
//         const speed = parseFloat(option.dataset.speed);
//         currentSpeed = speed;
//
//         // Update selected state
//         settingsOptions.forEach(opt => opt.classList.remove('selected'));
//         option.classList.add('selected');
//
//         // Dispatch event for display.js to handle
//         document.dispatchEvent(new CustomEvent('playback-speed-change', {
//             detail: { speed }
//         }));
//     });
// });
//
// export function getPlaybackSpeed() {
//     return currentSpeed;
// }
//
// /* Frame Timestamp */
//
// const timestampEl = document.getElementById('frame-timestamp');
// let currentTimezone = 'local';
//
// function formatTimestamp(date) {
//     const options = {
//         year: 'numeric',
//         month: '2-digit',
//         day: '2-digit',
//         hour: '2-digit',
//         minute: '2-digit',
//         second: '2-digit',
//         hour12: false,
//     };
//
//     if (currentTimezone === 'utc') {
//         options.timeZone = 'UTC';
//     }
//
//     return date.toLocaleString('en-US', options);
// }
//
// let lastFilename = null;
//
// document.addEventListener('frame-changed', (event) => {
//     const { filename } = event.detail;
//     lastFilename = filename;
//     try {
//         const timestamp = extractTimestampFromKey(filename);
//         timestampEl.textContent = formatTimestamp(timestamp);
//     } catch (e) {
//         timestampEl.textContent = '';
//     }
// });
//
// document.addEventListener('display-reset', () => {
//     timestampEl.textContent = '';
//     lastFilename = null;
// });
//
// document.addEventListener('timezone-change', (event) => {
//     const { timezone } = event.detail;
//     currentTimezone = timezone;
//
//     // Re-format the current timestamp if one is displayed
//     if (lastFilename) {
//         try {
//             const timestamp = extractTimestampFromKey(lastFilename);
//             timestampEl.textContent = formatTimestamp(timestamp);
//         } catch (e) {
//             timestampEl.textContent = '';
//         }
//     }
// });