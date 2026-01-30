/**
 * RadarGL - WebGL-based radar data renderer for Google Maps
 *
 * Renders NEXRAD-style radar data (reflectivity, velocity, etc.) as a
 * colored overlay on Google Maps using WebGL for performance.
 *
 * Data format expected:
 *   - azimuths: Float32Array of azimuth angles in degrees (meteorological: 0=North, clockwise)
 *   - ranges: Float32Array of range gate distances in kilometers
 *   - data: Float32Array of values, laid out as [az0_r0, az0_r1, ..., az1_r0, az1_r1, ...]
 */

// =============================================================================
// SECTION 1: Color Palette
// =============================================================================

/**
 * Standard NWS reflectivity color palette
 * Keys are dBZ values, values are [R, G, B] (0-255)
 */
let REF_PALETTE = {
    10: [72, 61, 139],       // Dark slate blue
    12: [70, 130, 180],      // Steel blue
    14: [95, 158, 160],      // Cadet blue
    16: [0, 139, 139],       // Dark cyan
    18: [34, 139, 34],       // Forest green
    20: [60, 179, 113],      // Medium sea green
    22: [107, 142, 35],      // Olive drab
    24: [154, 205, 50],      // Yellow green
    26: [205, 173, 0],       // Dark gold
    28: [255, 215, 0],       // Gold
    30: [255, 255, 0],       // Yellow
    32: [255, 165, 0],       // Orange
    34: [255, 140, 0],       // Dark orange
    36: [255, 127, 0],       // Orange
    38: [255, 99, 71],       // Tomato
    40: [255, 69, 0],        // Red-orange
    42: [226, 1, 30],        // Red
    44: [200, 6, 30],        // Dark red
    46: [185, 1, 30],        // Darker red
    48: [252, 156, 156],     // Light coral
    50: [255, 182, 193],     // Light pink
    52: [238, 130, 238],     // Violet
    54: [219, 112, 147],     // Pale violet red
    56: [218, 112, 214],     // Orchid
    58: [186, 85, 211],      // Medium orchid
    60: [153, 50, 204],      // Dark orchid
    62: [160, 32, 240],      // Purple
    64: [159, 121, 238],     // Medium purple
    66: [171, 130, 255],     // Light purple
    68: [138, 143, 255],     // Light blue-purple
    70: [54, 62, 255],       // Blue
    72: [45, 48, 122],       // Dark blue
    74: [45, 48, 82],        // Darker blue
    76: [32, 40, 44],        // Near black
    78: [0, 0, 0],           // Black
    80: [64, 64, 64],        // Dark gray
    82: [102, 102, 102],     // Gray
    84: [140, 140, 140],     // Medium gray
    86: [179, 179, 179],     // Light gray
    88: [204, 204, 204],     // Lighter gray
    90: [230, 230, 230],     // Very light gray
    92: [255, 255, 255],     // White
    94: [179, 179, 255],     // Light blue-white
};

/**
 * Build a 256-color lookup table from sparse palette
 * @param {Object} palette - Sparse palette {value: [r,g,b], ...}
 * @param {number} minVal - Minimum data value
 * @param {number} maxVal - Maximum data value
 * @returns {Array} 256-element array of [r,g,b] normalized to 0-1
 */
function buildColorLUT(palette, minVal = 0, maxVal = 95) {
    const lut = new Array(256);
    const sortedKeys = Object.keys(palette).map(Number).sort((a, b) => a - b);

    // Initialize all to transparent/white
    for (let i = 0; i < 256; i++) {
        lut[i] = [1, 1, 1]; // White (will be transparent for low values)
    }

    // Map data values to color indices
    for (let i = 0; i < 256; i++) {
        // Convert index back to data value
        const dataVal = minVal + (i / 255) * (maxVal - minVal);

        // Find surrounding palette entries
        let lowerKey = sortedKeys[0];
        let upperKey = sortedKeys[sortedKeys.length - 1];

        for (let j = 0; j < sortedKeys.length - 1; j++) {
            if (dataVal >= sortedKeys[j] && dataVal < sortedKeys[j + 1]) {
                lowerKey = sortedKeys[j];
                upperKey = sortedKeys[j + 1];
                break;
            }
        }

        if (dataVal < sortedKeys[0]) {
            // Below minimum - use first color or transparent
            lut[i] = palette[sortedKeys[0]].map(v => v / 255);
        } else if (dataVal >= sortedKeys[sortedKeys.length - 1]) {
            // Above maximum - use last color
            lut[i] = palette[sortedKeys[sortedKeys.length - 1]].map(v => v / 255);
        } else {
            // Interpolate between colors
            const t = (dataVal - lowerKey) / (upperKey - lowerKey);
            const c1 = palette[lowerKey];
            const c2 = palette[upperKey];
            lut[i] = [
                (c1[0] + t * (c2[0] - c1[0])) / 255,
                (c1[1] + t * (c2[1] - c1[1])) / 255,
                (c1[2] + t * (c2[2] - c1[2])) / 255
            ];
        }
    }
    return lut;
}

// =============================================================================
// SECTION 2: Coordinate Transformations
// =============================================================================

/**
 * Convert lat/lng to Web Mercator coordinates (meters)
 * This is the projection Google Maps uses internally
 */
function latLngToMercator(lat, lng) {
    const EARTH_RADIUS = 6378137; // meters
    const DEG_TO_RAD = Math.PI / 180;

    const x = EARTH_RADIUS * lng * DEG_TO_RAD;
    const y = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * DEG_TO_RAD / 2));

    return { x, y };
}

/**
 * Convert meteorological azimuth to mathematical angle
 * Meteorological: 0° = North, increases clockwise
 * Mathematical: 0° = East, increases counter-clockwise
 */
function metAzimuthToMathAngle(azimuth) {
    // 90 - azimuth converts from met to math convention
    let angle = 90 - azimuth;
    if (angle < 0) angle += 360;
    return angle;
}

// =============================================================================
// SECTION 3: WebGL Shaders
// =============================================================================

/**
 * Vertex Shader
 *
 * Takes polar coordinates (azimuth, distance) and converts to screen position.
 * Also passes the color index to the fragment shader.
 */
const VERTEX_SHADER = `#version 300 es
precision highp float;

// Per-vertex inputs
in float a_azimuth;      // Angle in degrees (math convention)
in float a_distance;     // Distance from radar in meters
in float a_colorIndex;   // Index into color palette (0-255)

// Uniform values (same for all vertices)
uniform vec2 u_origin;      // Radar position in Mercator coords
uniform vec2 u_boundsMin;   // Map viewport min corner (Mercator)
uniform vec2 u_boundsMax;   // Map viewport max corner (Mercator)

// Output to fragment shader
flat out int v_colorIndex;

void main() {
    // Convert polar (azimuth, distance) to Cartesian (x, y)
    float angleRad = radians(a_azimuth);
    float x = cos(angleRad) * a_distance + u_origin.x;
    float y = sin(angleRad) * a_distance + u_origin.y;
    
    // Convert Mercator coords to Normalized Device Coordinates (-1 to 1)
    float ndc_x = 2.0 * (x - u_boundsMin.x) / (u_boundsMax.x - u_boundsMin.x) - 1.0;
    float ndc_y = 2.0 * (y - u_boundsMin.y) / (u_boundsMax.y - u_boundsMin.y) - 1.0;
    
    gl_Position = vec4(ndc_x, ndc_y, 0.0, 1.0);
    v_colorIndex = int(a_colorIndex);
}
`;

/**
 * Fragment Shader
 *
 * Colors each pixel based on the color index passed from vertex shader.
 */
const FRAGMENT_SHADER = `#version 300 es
precision highp float;

flat in int v_colorIndex;       // Color index from vertex shader
uniform vec3 u_colors[256];     // Color lookup table

out vec4 outColor;

void main() {
    vec3 color = u_colors[v_colorIndex];
    
    // Make very low values (index 0-10) transparent
    float alpha = v_colorIndex < 10 ? 0.0 : 1.0;
    
    outColor = vec4(color, alpha);
}
`;

// =============================================================================
// SECTION 4: WebGL Helper Functions
// =============================================================================

/**
 * Compile a shader from source code
 */
function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

/**
 * Create and link a shader program
 */
function createShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return null;
    }

    return program;
}

/**
 * Create and populate a buffer, bind it to an attribute
 */
function createAttributeBuffer(gl, program, data, attributeName, size = 1) {
    const location = gl.getAttribLocation(program, attributeName);
    const buffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);

    return buffer;
}

// =============================================================================
// SECTION 5: RadarRenderer Class
// =============================================================================

/**
 * Main radar rendering class
 *
 * Usage:
 *   const renderer = new RadarRenderer(canvas);
 *   renderer.setColors(colorLUT);
 *   renderer.setRadarPosition(lat, lng);
 *   renderer.loadData(azimuths, ranges, data, options);
 *   renderer.setViewBounds(minX, minY, maxX, maxY);
 *   renderer.draw();
 */
class RadarRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2', {
            alpha: true,           // Support transparency
            preserveDrawingBuffer: true  // Don't clear between frames
        });

        if (!this.gl) {
            throw new Error('WebGL2 not supported');
        }

        // Enable 32-bit indices (needed for large meshes)
        this.gl.getExtension('OES_element_index_uint');

        // Enable alpha blending for transparency
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        // Create shader program
        this.program = createShaderProgram(this.gl, VERTEX_SHADER, FRAGMENT_SHADER);
        this.gl.useProgram(this.program);

        // Store uniform locations for later use
        this.uniforms = {
            origin: this.gl.getUniformLocation(this.program, 'u_origin'),
            boundsMin: this.gl.getUniformLocation(this.program, 'u_boundsMin'),
            boundsMax: this.gl.getUniformLocation(this.program, 'u_boundsMax'),
            colors: this.gl.getUniformLocation(this.program, 'u_colors')
        };

        // Initialize state
        this.radarOrigin = { x: 0, y: 0 };
        this.indexCount = 0;
        this.dataLoaded = false;
    }

    /**
     * Set the color lookup table
     * @param {Array} colors - 256-element array of [r,g,b] values (0-1 range)
     */
    setColors(colors) {
        // Flatten to single array for WebGL
        const flatColors = new Float32Array(colors.flat());
        this.gl.uniform3fv(this.uniforms.colors, flatColors);
    }

    /**
     * Set radar position
     * @param {number} lat - Latitude in degrees
     * @param {number} lng - Longitude in degrees
     */
    setRadarPosition(lat, lng) {
        this.radarOrigin = latLngToMercator(lat, lng);
        this.gl.uniform2f(this.uniforms.origin, this.radarOrigin.x, this.radarOrigin.y);
    }

    /**
     * Set the current map viewport bounds (in Mercator coordinates)
     */
    setViewBounds(minX, minY, maxX, maxY) {
        this.gl.uniform2f(this.uniforms.boundsMin, minX, minY);
        this.gl.uniform2f(this.uniforms.boundsMax, maxX, maxY);
    }

    /**
     * Load radar data and create WebGL buffers
     *
     * @param {Float32Array} azimuths - Array of azimuth angles (degrees, met convention)
     * @param {Float32Array} ranges - Array of range values (km)
     * @param {Float32Array} data - Flattened data array [az0_r0, az0_r1, ..., az1_r0, ...]
     * @param {Object} options - Optional parameters
     *   - elevation: Radar elevation angle (degrees) for distance correction
     *   - minValue: Minimum data value for color mapping
     *   - maxValue: Maximum data value for color mapping
     *   - beamWidth: Azimuthal beam width (degrees)
     */
    loadData(azimuths, ranges, data, options = {}) {
        const {
            elevation = 0.5,      // Default elevation angle
            minValue = -10,       // Min reflectivity for color mapping
            maxValue = 80,        // Max reflectivity for color mapping
            beamWidth = 0.5       // Azimuthal resolution
        } = options;

        const numAzimuths = azimuths.length;
        const numRanges = ranges.length;

        //console.log(`Loading radar data: ${numAzimuths} azimuths × ${numRanges} ranges`);
        const startTime = performance.now();

        // =================================================================
        // Step 1: Create vertices
        // =================================================================
        // We need (numAzimuths + 1) × (numRanges + 1) vertices
        // The +1 is because each "cell" needs 4 corners

        const numVertices = (numAzimuths + 1) * (numRanges + 1);
        const vertexAzimuths = new Float32Array(numVertices);
        const vertexDistances = new Float32Array(numVertices);
        const vertexColors = new Float32Array(numVertices);

        const elevationCos = Math.cos(elevation * Math.PI / 180);

        let vertexIndex = 0;
        for (let a = 0; a <= numAzimuths; a++) {
            // Get azimuth angle (wrap around for last vertex)
            const metAzimuth = azimuths[a % numAzimuths];
            // Convert to math convention and offset by half beam width
            const mathAngle = metAzimuthToMathAngle(metAzimuth) - beamWidth / 2;

            for (let r = 0; r <= numRanges; r++) {
                // Get range in km, convert to meters, apply elevation correction
                const rangeKm = ranges[Math.min(r, numRanges - 1)];
                const distanceMeters = rangeKm * 1000 * elevationCos;

                vertexAzimuths[vertexIndex] = mathAngle;
                vertexDistances[vertexIndex] = distanceMeters;
                vertexIndex++;
            }
        }

        //console.log(`  Vertices created: ${performance.now() - startTime}ms`);

        // =================================================================
        // Step 2: Create triangles and assign colors
        // =================================================================
        // Each cell (azimuth × range) becomes 2 triangles (a quad)
        // Triangle indices reference vertices by their index number

        const maxTriangles = numAzimuths * numRanges * 2;
        const indices = new Uint32Array(maxTriangles * 3);

        let indexOffset = 0;
        const verticesPerAzimuth = numRanges + 1;

        for (let a = 0; a < numAzimuths; a++) {
            const baseVertex = a * verticesPerAzimuth;

            for (let r = 0; r < numRanges; r++) {
                // Get data value for this cell
                const dataIndex = a * numRanges + r;
                const value = data[dataIndex];

                // Convert value to color index (0-255)
                let colorIndex = Math.round(((value - minValue) / (maxValue - minValue)) * 255);
                colorIndex = Math.max(0, Math.min(255, colorIndex));

                // Skip cells with no/low data (makes rendering faster)
                if (colorIndex < 10) continue;

                // Calculate vertex indices for this cell's 4 corners
                //
                //  v2 -------- v3    (next azimuth)
                //   |          |
                //   |   cell   |
                //   |          |
                //  v0 -------- v1    (current azimuth)
                //  (r)        (r+1)

                const v0 = baseVertex + r;                        // Current az, current range
                const v1 = baseVertex + r + 1;                    // Current az, next range
                const v2 = baseVertex + verticesPerAzimuth + r;   // Next az, current range
                const v3 = baseVertex + verticesPerAzimuth + r + 1; // Next az, next range

                // Assign same color to all 4 corners of this cell
                vertexColors[v0] = colorIndex;
                vertexColors[v1] = colorIndex;
                vertexColors[v2] = colorIndex;
                vertexColors[v3] = colorIndex;

                // Triangle 1: v0, v1, v2
                indices[indexOffset++] = v0;
                indices[indexOffset++] = v1;
                indices[indexOffset++] = v2;

                // Triangle 2: v1, v3, v2
                indices[indexOffset++] = v1;
                indices[indexOffset++] = v3;
                indices[indexOffset++] = v2;
            }
        }

        // Trim indices to actual size used
        const finalIndices = indices.slice(0, indexOffset);
        this.indexCount = indexOffset;

        //console.log(`  Triangles created: ${performance.now() - startTime}ms`);
        //console.log(`  Triangle count: ${indexOffset / 3}`);

        // =================================================================
        // Step 3: Upload to GPU
        // =================================================================

        createAttributeBuffer(this.gl, this.program, vertexAzimuths, 'a_azimuth');
        createAttributeBuffer(this.gl, this.program, vertexDistances, 'a_distance');
        createAttributeBuffer(this.gl, this.program, vertexColors, 'a_colorIndex');

        // Create and fill index buffer
        const indexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, finalIndices, this.gl.STATIC_DRAW);

        //console.log(`  GPU upload complete: ${performance.now() - startTime}ms`);

        this.dataLoaded = true;
    }

    /**
     * Render the radar data
     */
    draw() {
        if (!this.dataLoaded) return;

        // Clear canvas (transparent black)
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        // Draw all triangles
        this.gl.drawElements(
            this.gl.TRIANGLES,
            this.indexCount,
            this.gl.UNSIGNED_INT,
            0
        );
    }

    /**
     * Update canvas size
     */
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
    }
}

// =============================================================================
// SECTION 6: Google Maps Overlay
// =============================================================================

/**
 * Custom Google Maps overlay that renders radar data using WebGL
 *
 * Usage:
 *   const overlay = new RadarMapOverlay(map);
 *   overlay.setRadarPosition(radarLat, radarLng);
 *   overlay.loadData(azimuths, ranges, data, options);
 */
class RadarMapOverlay extends google.maps.OverlayView {
    constructor(map, onReady = null) {
        super();
        this.map = map;
        this.onReady = onReady;
        this.opacity = 1;

        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.id = "radarMapOverlay";
        this.canvas.style.position = 'absolute';

        // Attach to map
        this.setMap(map);
    }

    /**
     * Called when overlay is added to map
     */
    onAdd() {
        // Add canvas to map's overlay layer
        const panes = this.getPanes();
        panes.overlayLayer.appendChild(this.canvas);

        // Create renderer
        this.renderer = new RadarRenderer(this.canvas);

        // Set default colors
        const defaultColors = buildColorLUT(REF_PALETTE, -10, 80);
        this.renderer.setColors(defaultColors);

        // Notify that we're ready
        if (this.onReady) {
            this.onReady(this);
        }
    }

    /**
     * Called whenever map view changes (pan, zoom)
     */
    draw() {
        if (!this.renderer) return;

        const projection = this.getProjection();
        const bounds = this.map.getBounds();
        if (!projection || !bounds) return;

        // Get pixel coordinates of map corners
        const sw = projection.fromLatLngToDivPixel(bounds.getSouthWest());
        const ne = projection.fromLatLngToDivPixel(bounds.getNorthEast());

        // Size and position canvas to cover map
        const width = Math.abs(ne.x - sw.x);
        const height = Math.abs(sw.y - ne.y);

        this.canvas.style.left = `${sw.x}px`;
        this.canvas.style.top = `${ne.y}px`;
        this.canvas.style.opacity = this.opacity;

        // Update canvas size if needed
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.renderer.resize(width, height);
        }

        // Convert map bounds to Mercator coordinates
        const mercSW = latLngToMercator(
            bounds.getSouthWest().lat(),
            bounds.getSouthWest().lng()
        );
        const mercNE = latLngToMercator(
            bounds.getNorthEast().lat(),
            bounds.getNorthEast().lng()
        );

        // Update renderer and redraw
        this.renderer.setViewBounds(mercSW.x, mercSW.y, mercNE.x, mercNE.y);
        this.renderer.draw();
    }

    /**
     * Called when overlay is removed
     */
    onRemove() {
        this.canvas.remove();
    }

    /**
     * Set radar position
     */
    setRadarPosition(lat, lng) {
        if (this.renderer) {
            this.renderer.setRadarPosition(lat, lng);
        }
    }

    /**
     * Load radar data
     */
    loadData(azimuths, ranges, data, options = {}) {
        if (this.renderer) {
            this.renderer.loadData(azimuths, ranges, data, options);
            this.draw();
        }
    }

    /**
     * Set overlay opacity (0-1)
     */
    setOpacity(opacity) {
        this.opacity = Math.max(0, Math.min(1, opacity));
        this.canvas.style.opacity = this.opacity;
    }

    /**
     * Set custom color palette
     */
    setColors(colors) {
        if (this.renderer) {
            this.renderer.setColors(colors);
            this.draw();
        }
    }
}

export {
    RadarRenderer,
    RadarMapOverlay,
    buildColorLUT,
    REF_PALETTE,
    latLngToMercator
};