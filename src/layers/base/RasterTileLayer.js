export class RasterTileLayer {
    constructor(options = {}) {
        // Required
        this.urlTemplate = options.urlTemplate; // Function: (x, y, z) => url string

        // Optional with defaults
        this.tileSize = new google.maps.Size(
            options.tileSize || 256,
            options.tileSize || 256
        );
        this.maxZoom = options.maxZoom || 19;
        this.minZoom = options.minZoom || 0;
        this.opacity = options.opacity ?? 1;
        this.className = options.className || 'tile-layer';
        this.name = options.name || 'Tile Layer';
        this.alt = options.alt || this.name;

        // Internal state
        this.tiles = [];
        this.map = null;
        this.isActive = false;
    }

    getTile(coord, zoom, ownerDocument) {
        const div = ownerDocument.createElement('div');
        const img = ownerDocument.createElement('img');

        div.className = this.className;
        div.style.width = `${this.tileSize}px`;
        div.style.height = `${this.tileSize}px`;
        div.style.opacity = this.opacity;
        div.style.display = this.isActive ? 'block' : 'none';

        img.src = this.urlTemplate(coord.x, coord.y, zoom);
        img.style.width = '100%';
        img.style.height = '100%';

        div.appendChild(img);
        this.tiles.push(div);

        return div;
    }

    releaseTile(tile) {
        tile.innerHTML = '';
        const index = this.tiles.indexOf(tile);
        if (index > -1) {
            this.tiles.splice(index, 1);
        }
    }

    setMap(map) {
        if (map === null && this.map) {
            const overlayMapTypes = this.map.overlayMapTypes;
            for (let i = overlayMapTypes.getLength() - 1; i >= 0; i--) {
                if (overlayMapTypes.getAt(i) === this) {
                    overlayMapTypes.removeAt(i);
                    break;
                }
            }
            this.isActive = false;
            this.map = null;
        } else if (map) {
            this.map = map;
            this.isActive = true;
            map.overlayMapTypes.push(this);
        }

        this.tiles.forEach(tile => {
            tile.style.display = this.isActive ? 'block' : 'none';
        });
    }

    setOpacity(opacity) {
        this.opacity = opacity;
        this.tiles.forEach(tile => {
            tile.style.opacity = opacity;
        });
    }
}