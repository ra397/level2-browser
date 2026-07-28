export class MarkerCollection {
    constructor(map, options = {}) {
        this.map = map;
        this.markers = []; // { marker (google.maps.Marker), currentSize, properties }
        this.size = 2.5;
        this.color = "green";

        // Feature flags
        this.selectable = options.selectable ?? false;
        this.autoResizeOnZoom = options.autoResizeOnZoom ?? false;
        this.getMarkerSizeForZoom = options.getMarkerSizeForZoom ?? null;

        // Selection state (only used if selectable)
        this.clickHandler = null;
        this.hoverHandler = null;
        this.hoverOutHandler = null;
        this.selectedMarker = null;
        this.selectedColor = options.selectedColor ?? "#FFED29";

        this.map.addListener("idle", () => {
            this.#updateVisibleMarkers();
        });

        // Auto-resize on zoom change
        if (this.autoResizeOnZoom && this.getMarkerSizeForZoom) {
            this.map.addListener("zoom_changed", () => {
                const newSize = this.getMarkerSizeForZoom(this.map.getZoom());
                this.setSize(newSize);
            });
        }
    }

    #createIcon() {
        const s = this.size * 2;
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
              <circle cx="${this.size}" cy="${this.size}"
                      r="${this.size - 1}" fill="${this.color}" />
            </svg>
          `;

        return {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
            size: new google.maps.Size(s, s),
            anchor: new google.maps.Point(this.size, this.size),
        };
    }

    #createSelectedIcon() {
        const s = this.size * 2;
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
              <circle cx="${this.size}" cy="${this.size}"
                      r="${this.size - 1}" fill="${this.selectedColor}"
                       stroke="#000"/>
            </svg>
          `;

        return {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
            size: new google.maps.Size(s, s),
            anchor: new google.maps.Point(this.size, this.size),
        };
    }

    #isInViewport(marker) {
        const bounds = this.map.getBounds();
        return bounds && bounds.contains(marker.getPosition());
    }

    #updateVisibleMarkers() {
        const icon = this.#createIcon();
        for (const markerObj of this.markers) {
            // Skip selected marker - it has a different icon
            if (this.selectable && markerObj === this.selectedMarker) {
                continue;
            }
            if (markerObj.currentSize !== this.size && this.#isInViewport(markerObj.marker)) {
                markerObj.marker.setIcon(icon);
                markerObj.currentSize = this.size;
            }
        }
    }

    add(lat, lng, properties = {}) {
        const marker = new google.maps.Marker({
            position: { lat, lng },
            map: this.map,
            icon: this.#createIcon(),
        });

        const markerObj = {
            marker: marker,
            currentSize: this.size,
            properties: properties,
        };

        // Add click listener only if selectable
        if (this.selectable) {
            marker.addListener('click', () => {
                if (this.clickHandler) {
                    this.clickHandler(markerObj);
                }
            });
        }

        marker.addListener('mouseover', () => {
            if (this.hoverHandler) this.hoverHandler(markerObj);
        });

        marker.addListener('mouseout', () => {
            if (this.hoverOutHandler) this.hoverOutHandler(markerObj);
        });

        this.markers.push(markerObj);
        return markerObj;
    }

    // Selection methods (only work when selectable is true)
    onClick(handler) {
        if (!this.selectable) return;
        this.clickHandler = handler;
    }

    onHover(handler) {
        this.hoverHandler = handler;
    }

    onHoverOut(handler) {
        this.hoverOutHandler = handler;
    }

    select(markerObj) {
        if (!this.selectable) return;

        // Deselect previous
        if (this.selectedMarker) {
            this.selectedMarker.marker.setIcon(this.#createIcon());
        }

        // Select new
        this.selectedMarker = markerObj;
        if (markerObj) {
            markerObj.marker.setIcon(this.#createSelectedIcon());
        }
    }

    getSelected() {
        return this.selectedMarker;
    }

    clearSelection() {
        if (!this.selectable) return;
        if (this.selectedMarker) {
            this.selectedMarker.marker.setIcon(this.#createIcon());
            this.selectedMarker = null;
        }
    }

    setColor(color) {
        if (this.color === color) return;
        this.color = color;
        const newIcon = this.#createIcon();
        for (const markerObj of this.markers) {
            // Skip selected marker
            if (this.selectable && markerObj === this.selectedMarker) {
                continue;
            }
            markerObj.marker.setIcon(newIcon);
        }
    }

    getColor() {
        return this.color;
    }

    setSize(size) {
        if (this.size === size) return;
        this.size = size;
        const newIcon = this.#createIcon();
        for (const markerObj of this.markers) {
            // Skip selected marker - update it with selected icon
            if (this.selectable && markerObj === this.selectedMarker) {
                markerObj.marker.setIcon(this.#createSelectedIcon());
                markerObj.currentSize = this.size;
                continue;
            }
            if (this.#isInViewport(markerObj.marker)) {
                markerObj.marker.setIcon(newIcon);
                markerObj.currentSize = this.size;
            }
        }
    }

    getSize() {
        return this.size;
    }

    hide() {
        for (const markerObj of this.markers) {
            markerObj.marker.setMap(null);
        }
    }

    show() {
        for (const markerObj of this.markers) {
            markerObj.marker.setMap(this.map);
        }
    }

    clear() {
        this.markers.forEach(markerObj => markerObj.marker.setMap(null));
        this.markers = [];
        this.selectedMarker = null;
    }
}