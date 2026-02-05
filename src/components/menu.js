const decodeBtn = document.getElementById('decodeBtn');
const urlInput = document.getElementById('urlInput');
const sweepContainer = document.getElementById('sweepContainer');
const sweepList = document.getElementById('sweepList');
const momentContainer = document.getElementById('momentContainer');
const momentList = document.getElementById('momentList');

function populateSweeps(sweeps) {
    sweepList.innerHTML = '';
    sweeps.forEach((sweep, i) => {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'sweep';
        radio.value = i;
        if (i === 0) radio.checked = true;
        label.appendChild(radio);
        label.append(` Sweep ${sweep.index} (${sweep.elevation.toFixed(1)}°) `);
        sweepList.appendChild(label);
    });
    sweepContainer.style.display = '';
}

function populateMoments(moments, currentMoment) {
    momentList.innerHTML = '';
    moments.forEach(m => {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'moment';
        radio.value = m;
        if (m === currentMoment) radio.checked = true;
        label.appendChild(radio);
        label.append(` ${m} `);
        momentList.appendChild(label);
    });
    momentContainer.style.display = '';
}

// Decode button click
decodeBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (!url) {
        alert('Please enter a URL');
        return;
    }

    decodeBtn.textContent = 'Decoding...';
    decodeBtn.disabled = true;

    document.dispatchEvent(new CustomEvent('decode-requested', { detail: { url } }));
});

// Sweep radio change
sweepList.addEventListener('change', (e) => {
    const index = parseInt(e.target.value);
    document.dispatchEvent(new CustomEvent('sweep-changed', { detail: { index } }));
});

// Moment radio change
momentList.addEventListener('change', (e) => {
    const moment = e.target.value;
    document.dispatchEvent(new CustomEvent('moment-changed', { detail: { moment } }));
});

// Listen: decode-success
document.addEventListener('decode-success', (e) => {
    const { sweeps, moments, currentMoment } = e.detail;

    decodeBtn.textContent = 'Decode';
    decodeBtn.disabled = false;

    populateSweeps(sweeps);
    populateMoments(moments, currentMoment);
});

// Listen: decode-error
document.addEventListener('decode-error', (e) => {
    const { message } = e.detail;

    decodeBtn.textContent = 'Decode';
    decodeBtn.disabled = false;

    alert('Error: ' + message);
});

// Listen: moments-updated
document.addEventListener('moments-updated', (e) => {
    const { moments, currentMoment } = e.detail;
    populateMoments(moments, currentMoment);
});