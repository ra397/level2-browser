// MRMS Menu - handles product selection, opacity, and clear

const productRadios = document.querySelectorAll('input[name="product_selection"]');
const mrmsOverlayControls = document.getElementById('mrmsOverlayControls');
const mrmsOpacitySlider = document.getElementById('mrmsOpacitySlider');
const mrmsOpacityValue = document.getElementById('mrmsOpacityValue');
const clearMrmsBtn = document.getElementById('clearMrmsBtn');

// Product selection
productRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        const product = e.target.value;
        document.dispatchEvent(new CustomEvent('mrms-product-selected', {
            detail: { product }
        }));
    });
});

// Opacity slider change
mrmsOpacitySlider.addEventListener('input', (e) => {
    const opacity = parseFloat(e.target.value);
    mrmsOpacityValue.textContent = `${Math.round(opacity * 100)}%`;
    document.dispatchEvent(new CustomEvent('mrms-opacity-changed', { detail: { opacity } }));
});

// Clear button
clearMrmsBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('mrms-clear'));
});

// Show controls when MRMS data is loaded
document.addEventListener('mrms-files-total', (e) => {
    if (e.detail.total > 0) {
        mrmsOverlayControls.style.display = '';
    }
});

// Hide controls and reset when MRMS is cleared
document.addEventListener('mrms-clear', () => {
    mrmsOverlayControls.style.display = 'none';
    mrmsOpacitySlider.value = 1;
    mrmsOpacityValue.textContent = '100%';

    // Reset product selection
    productRadios.forEach(radio => {
        radio.checked = false;
    });
});