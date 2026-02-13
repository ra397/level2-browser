// Mode Toggle Controller - switches between MRMS and Level II modes

const modeMrmsBtn = document.getElementById('mode-mrms');
const modeLevel2Btn = document.getElementById('mode-level2');

let currentMode = 'mrms'; // 'mrms' or 'level2'

// Track if each mode has data loaded
let mrmsHasData = false;
let level2HasData = false;

function setMode(mode) {
    if (mode === currentMode) return;

    const previousMode = currentMode;
    currentMode = mode;

    // Update button states
    modeMrmsBtn.classList.toggle('active', mode === 'mrms');
    modeLevel2Btn.classList.toggle('active', mode === 'level2');

    // Dispatch mode change event
    document.dispatchEvent(new CustomEvent('mode-changed', {
        detail: { mode, previousMode }
    }));
}

modeMrmsBtn.addEventListener('click', () => setMode('mrms'));
modeLevel2Btn.addEventListener('click', () => setMode('level2'));

// Track when MRMS has data
document.addEventListener('mrms-files-total', (e) => {
    if (e.detail.total > 0) {
        mrmsHasData = true;
        modeMrmsBtn.classList.add('has-data');
    }
});

document.addEventListener('mrms-clear', () => {
    mrmsHasData = false;
    modeMrmsBtn.classList.remove('has-data');
});

// Track when Level II has data
document.addEventListener('decode-success', () => {
    level2HasData = true;
    modeLevel2Btn.classList.add('has-data');
    // Auto-switch to Level II mode when data is loaded
    setMode('level2');
});

document.addEventListener('clear-overlay', () => {
    level2HasData = false;
    modeLevel2Btn.classList.remove('has-data');
});

// Export for other modules
export function getCurrentMode() {
    return currentMode;
}

export function hasMrmsData() {
    return mrmsHasData;
}

export function hasLevel2Data() {
    return level2HasData;
}
