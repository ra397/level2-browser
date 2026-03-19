document.addEventListener('click', (e) => {
    const header = e.target.closest('.layer-header');
    if (!header) return;

    // Don't toggle if clicking on the toggle switch
    if (e.target.closest('.toggle-switch')) return;

    const layerItem = header.closest('.layer-item');
    if (layerItem) {
        layerItem.classList.toggle('expanded');
    }
});