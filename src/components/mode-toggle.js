// import { getCurrentFrameTime } from "../mrms/display.js";
// import { getLoadedRadars } from "../main.js";
// import { findNearestLevel2File } from "./menu.js";
//
// // Mode Toggle Controller - switches between MRMS and Level II modes
//
// const modeMrmsBtn = document.getElementById('mode-mrms');
// const modeLevel2Btn = document.getElementById('mode-level2');
//
// let currentMode = 'mrms'; // 'mrms' or 'level2'
//
// const graphWrapper = document.querySelector('.graph-wrapper');
// const playerContainer = document.getElementById('player-container');
//
// // Track if each mode has data loaded
// let mrmsHasData = false;
// let level2HasData = false;
//
// function setMode(mode) {
//     if (mode === currentMode) return;
//
//     const previousMode = currentMode;
//     currentMode = mode;
//
//     // Update button states
//     modeMrmsBtn.classList.toggle('active', mode === 'mrms');
//     modeLevel2Btn.classList.toggle('active', mode === 'level2');
//
//     // Show/hide profile graph (Level II only)
//     if (graphWrapper) {
//         graphWrapper.style.display = mode === 'level2' ? '' : 'none';
//     }
//
//     // Show/hide player (MRMS only)
//     if (playerContainer) {
//         playerContainer.style.display = mode === 'mrms' ? '' : 'none';
//     }
//
//     // Dispatch mode change event
//     document.dispatchEvent(new CustomEvent('mode-changed', {
//         detail: { mode, previousMode }
//     }));
// }
//
// modeMrmsBtn.addEventListener('click', () => setMode('mrms'));
// modeLevel2Btn.addEventListener('click', async () => {
//     // Check if we need to prompt for update
//     if (currentMode === 'mrms' && level2HasData) {
//         const currentMrmsTime = getCurrentFrameTime();
//         if (currentMrmsTime) {
//             const loadedRadars = getLoadedRadars();
//
//             // Find which radars would get a different file
//             const radarsToUpdate = [];
//             for (const { radarId, url } of loadedRadars) {
//                 try {
//                     const newUrl = await findNearestLevel2File(radarId, currentMrmsTime);
//                     if (newUrl && newUrl !== url) {
//                         radarsToUpdate.push({ radarId, newUrl });
//                     }
//                 } catch (err) {
//                     console.error(`Error checking ${radarId}:`, err);
//                 }
//             }
//
//             if (radarsToUpdate.length > 0) {
//                 const radarList = radarsToUpdate.map(r => r.radarId).join(', ');
//                 const confirmed = confirm(
//                     `The MRMS timestamp has changed. ${radarsToUpdate.length} radar(s) (${radarList}) have newer data available. Would you like to update them?`
//                 );
//
//                 if (confirmed) {
//                     for (const { newUrl } of radarsToUpdate) {
//                         document.dispatchEvent(new CustomEvent('decode-requested', {
//                             detail: { url: newUrl }
//                         }));
//                     }
//                 }
//             }
//         }
//     }
//
//     setMode('level2');
// });
//
// // Track when MRMS has data
// document.addEventListener('mrms-files-total', (e) => {
//     if (e.detail.total > 0) {
//         mrmsHasData = true;
//         modeMrmsBtn.classList.add('has-data');
//         // Auto-switch to MRMS mode when data is loaded
//         setMode('mrms');
//     }
// });
//
// document.addEventListener('mrms-clear', () => {
//     mrmsHasData = false;
//     modeMrmsBtn.classList.remove('has-data');
// });
//
// // Track when Level II has data
// document.addEventListener('decode-success', () => {
//     level2HasData = true;
//     modeLevel2Btn.classList.add('has-data');
//     // Auto-switch to Level II mode when data is loaded
//     setMode('level2');
// });
//
// document.addEventListener('clear-overlay', () => {
//     level2HasData = false;
//     modeLevel2Btn.classList.remove('has-data');
// });
//
// // Set initial visibility based on default mode
// if (graphWrapper) {
//     graphWrapper.style.display = currentMode === 'level2' ? '' : 'none';
// }
// if (playerContainer) {
//     playerContainer.style.display = currentMode === 'mrms' ? '' : 'none';
// }
//
// // Export for other modules
// export function getCurrentMode() {
//     return currentMode;
// }
//
// export function hasMrmsData() {
//     return mrmsHasData;
// }
//
// export function hasLevel2Data() {
//     return level2HasData;
// }
