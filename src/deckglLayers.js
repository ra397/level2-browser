import { GoogleMapsOverlay } from "@deck.gl/google-maps";
import { CompositeLayer } from "@deck.gl/core";
import { IconLayer } from "@deck.gl/layers";
import { GridLayer } from "@deck.gl/aggregation-layers";
import {mapReady} from "./components/map.js";

async function loadData(filename) {
    try {
        const res = await fetch(filename);

        // NGINX already does this:
        if (filename.endsWith(".gz")) {
            const ds = new DecompressionStream("gzip");
            const decompressedStream = res.body.pipeThrough(ds);
            const decompressedBuffer = await new Response(decompressedStream).arrayBuffer();
            const decompressedText = new TextDecoder().decode(decompressedBuffer);
            return JSON.parse(decompressedText);
        }

        return await res.json();
    } catch (e) {
        console.error(e);
        return null;
    }
}

class HybridLayer extends CompositeLayer {
    #zoom = null;
    #color = null;

    initializeState() {
        this.#zoom = Math.round(this.context.viewport.zoom);
        this.#color = this.props.color;
        this.#generateIconAtlas();
    }

    shouldUpdateState() {
        const newZoom = Math.round(this.context.viewport.zoom);
        const shouldUpdate = (newZoom !== this.#zoom);
        this.#zoom = newZoom;
        return shouldUpdate;
    }

    async setColor(newColor) {
        this.#color = newColor;
        await this.#generateIconAtlas();
        this.setState({ _forceUpdate: Math.random() });
    }

    #generateSvg([r, g, b]) {
        return `
            <svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
                <circle cx="64" cy="64" r="64" fill="rgb(${r},${g},${b})"/>
            </svg>
        `;
    }

    async #svgToPngUrl(svgText) {
        return new Promise(resolve => {
            const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
            const svgUrl = URL.createObjectURL(svgBlob);
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = 128;
                canvas.height = 128;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);

                canvas.toBlob(blob => {
                    const pngUrl = URL.createObjectURL(blob);
                    resolve(pngUrl);
                    URL.revokeObjectURL(svgUrl);
                });
            };
            img.src = svgUrl;
        });
    }

    async #generateIconAtlas() {
        const svg = this.#generateSvg(this.#color);
        const pngUrl = await this.#svgToPngUrl(svg);
        this.setState({
            iconAtlasUrl: pngUrl,
            iconMapping: {
                marker: { x: 0, y: 0, width: 128, height: 128 }
            }
        });
    }

    renderLayers() {
        const { data, id, zoomThreshold } = this.props;
        const color = this.#color;
        const zoom = this.#zoom;

        const iconAtlas = this.state.iconAtlasUrl;
        const iconMapping = this.state.iconMapping;

        const cellSize = 9000 - zoom * 1000;
        const iconSize = zoom <= 9 ? 4 : 2 * (zoom - 7);

        if (!iconAtlas && zoom > zoomThreshold) {
            return [];
        }

        if (zoom <= zoomThreshold) {
            return [
                new GridLayer({
                    id: `${id}-grid`,
                    data,
                    getPosition: d => d.COORDINATES,
                    cellSize,
                    colorRange: [color],
                    elevationScale: 0,
                    extruded: false,
                    pickable: false,
                    gpuAggregation: false,
                    updateTriggers: {
                        getColor: color,
                        cellSize: zoom
                    }
                })
            ];
        }

        return [
            new IconLayer({
                id: `${id}-icon`,
                data,
                iconAtlas,
                iconMapping,
                getIcon: () => "marker",
                getPosition: d => d.COORDINATES,
                getSize: () => iconSize,
                getColor: () => [255, 255, 255],
                pickable: false,
                updateTriggers: {
                    iconAtlas,
                    getSize: zoom
                }
            })
        ];
    }
}
HybridLayer.layerName = 'HybridLayer';

// Load data
const wind_turbines_dataset = await loadData(`${import.meta.env.BASE_URL}data/wind_turbines.min.json.gz`);

// Initialize the overlay (add this if you don't have it already)
const overlay = new GoogleMapsOverlay({
    layers: [],
});
mapReady.then( () => {
        overlay.setMap(globalThis.map); // make sure 'map' is your Google Maps instance
    }
)
// Store the current colors for each layer
globalThis.deckglLayerColors = {
    windFarms: [116, 109, 105]
};

let counter = 0;

const layerFactories = {
    smallDams: (data) => new HybridLayer({
        id: `small-dams-${++counter}`,
        data,
        color: globalThis.deckglLayerColors.smallDams,
        zoomThreshold: 7
    }),
    windFarms: (data) => new HybridLayer({
        id: `wind-turbines-${++counter}`,
        data,
        color: globalThis.deckglLayerColors.windFarms,
        zoomThreshold: 7
    })
};

let activeLayerNames = new Set();
let activeLayers = [];

function updateOverlayLayers() {
    activeLayers = [...activeLayerNames].map(name => {
        // if (name === "smallDams") {
        //     return layerFactories[name](small_dams_dataset);
        // }
        if (name === "windFarms") {
            return layerFactories[name](wind_turbines_dataset);
        }
    }).filter(Boolean);

    // Store reference for color updates
    globalThis.hybridLayers = activeLayers;

    overlay.setProps({ layers: activeLayers });
}

// Toggle layer visibility
document.getElementById('smallDams-checkbox')?.addEventListener('change', (e) => {
    if (e.target.checked) {
        activeLayerNames.add('smallDams');
    } else {
        activeLayerNames.delete('smallDams');
    }
    updateOverlayLayers();
});

document.getElementById('windFarms-checkbox')?.addEventListener('change', (e) => {
    if (e.target.checked) {
        activeLayerNames.add('windFarms');
    } else {
        activeLayerNames.delete('windFarms');
    }
    updateOverlayLayers();
});

// Add this function after your layer setup code
globalThis.resetHybridLayers = function() {
    activeLayerNames.clear();
    activeLayers = [];
    overlay.setProps({ layers: [] });

    // Uncheck the checkboxes
    const smallDamsCheckbox = document.getElementById('smallDams-checkbox');
    const windFarmsCheckbox = document.getElementById('windFarms-checkbox');

    if (smallDamsCheckbox) smallDamsCheckbox.checked = false;
    if (windFarmsCheckbox) windFarmsCheckbox.checked = false;

    // Clear the global reference
    globalThis.hybridLayers = [];
};