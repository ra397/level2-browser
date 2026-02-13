// MRMS Menu - handles product selection

const productRadios = document.querySelectorAll('input[name="product_selection"]');

productRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        const product = e.target.value;
        document.dispatchEvent(new CustomEvent('mrms-product-selected', {
            detail: { product }
        }));
    });
});
