export class MarkerCollection {
    constructor(map) {
        this.map = map;
        this.markers = []; // { marker (google.maps.Marker), currentSize, properties }
        this.size = 2.5;
        this.color = "green";
        this.clickHandler = null;
        this.selectedMarker = null;
        this.selectedColor = "blue";

        this.map.addListener("idle", () => {
            this.#updateVisibleMarkers();
        });
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

    #isInViewport(marker) {
        const bounds = this.map.getBounds();
        return bounds && bounds.contains(marker.getPosition());
    }

    #updateVisibleMarkers() {
        const icon = this.#createIcon();
        for (const markerObj of this.markers) {
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

        // Add click listener
        marker.addListener('click', () => {
            if (this.clickHandler) {
                this.clickHandler(markerObj);
            }
        });

        this.markers.push(markerObj);
        return markerObj;
    }

    onClick(handler) {
        this.clickHandler = handler;
    }

    #createSelectedIcon() {
        const s = this.size * 2;
        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
            <circle cx="${this.size}" cy="${this.size}"
                    r="${this.size - 1}" fill="${this.selectedColor}" />
          </svg>
        `;

        return {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
            size: new google.maps.Size(s, s),
            anchor: new google.maps.Point(this.size, this.size),
        };
    }

    select(markerObj) {
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
    }
}