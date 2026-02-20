# NEXRAD Level 2 Browser

A browser-based NEXRAD Level 2 and MRMS radar data viewer that decodes raw binary weather radar files and renders them interactively on Google Maps using WebGL. The application parses NEXRAD's proprietary binary format (including Bzip2 decompression) entirely client-side, then projects polar radar data onto a Mercator map in real-time.

## Features

- **Direct Binary Decoding**: Parses NEXRAD Level 2 archive files in-browser, handling Bzip2 decompression and extracting all radar moments (REF, VEL, SW, ZDR, PHI, RHO, CFP)
- **WebGL Radar Rendering**: GPU-accelerated polar-to-Mercator coordinate transformation using custom GLSL shaders with 4/3 Earth refraction model
- **MRMS Mosaic Support**: Fetches and decodes GRIB2-encoded MRMS products from NOAA S3, with Web Worker-based parallel processing
- **Vertical Profile Visualization**: Interactive AHI (Azimuth-Height Indicator) and RHI (Range-Height Indicator) cross-sections with terrain overlay
- **Temporal Animation**: Frame-by-frame playback of MRMS time series with variable speed control
- **Click-to-Interrogate**: Map click resolves to radar gate coordinates via inverse Haversine calculation

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Event Bus (DOM CustomEvents)                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       │                       │                       │
┌──────▼──────┐    ┌───────────▼───────────┐    ┌──────▼──────┐
│   Decoder   │    │    WebGL Renderer     │    │    MRMS     │
│             │    │                       │    │  Pipeline   │
│ NexradLevel2│    │  RadarRenderer        │    │             │
│  (Bzip2)    │    │  (GLSL + Mercator)    │    │ Web Worker  │
│             │    │                       │    │  + GRIB2    │
└──────┬──────┘    └───────────┬───────────┘    └──────┬──────┘
       │                       │                       │
       └───────────────────────┴───────────────────────┘
                               │
                     ┌─────────▼─────────┐
                     │   Google Maps     │
                     │  OverlayView API  │
                     └───────────────────┘
```

**Data Flow**:
1. User provides URL to NEXRAD Archive II file or selects MRMS product + time range
2. Binary data fetched and decompressed (Bzip2 for Level 2, gzip for MRMS GRIB2)
3. Decoder extracts polar radar data: azimuths × range gates × values
4. WebGL shader converts polar coordinates to Mercator using 4/3 Earth model
5. Triangulated mesh rendered as Google Maps overlay

**State Management**: Decoupled modules communicate via DOM CustomEvents (`decode-requested`, `sweep-changed`, `profile-azimuth-changed`, etc.). No framework—pure event-driven coordination.

## Tech Stack

- **Rendering**: WebGL2 with custom GLSL shaders
- **Map**: Google Maps JavaScript API with custom OverlayView
- **Binary Parsing**: DataView API, seek-bzip (Bzip2), DecompressionStream (gzip)
- **Parallel Processing**: Web Workers for MRMS decoding pipeline
- **Build**: Vite

## Key Engineering Decisions

### Polar-to-Mercator Projection in GPU

Radar data is inherently polar (azimuth + slant range). Rather than pre-computing Cartesian coordinates on the CPU, the vertex shader performs the full geodesic calculation:

```glsl
// 4/3 Earth model for atmospheric refraction
float kRe = (4.0 / 3.0) * EARTH_RADIUS;
float phi = atan(R * cosElev, kRe + R * sinElev);
float groundDist = kRe * phi;

// Spherical law of cosines for destination point
float sinLat2 = sinLat1 * cosDist + cosLat1 * sinDist * cos(bearing);
```

This allows the mesh to be redrawn instantly on pan/zoom without CPU involvement.

### LUT-Based GRIB2 Coordinate Remapping

MRMS GRIB2 products use Lambert Conformal Conic projection. Instead of computing the reprojection for each pixel per frame, a precomputed lookup table (`MRMS_LUT.json`) maps each Mercator pixel directly to its source GRIB index. This reduces per-frame work to a single array traversal.

### Web Worker Decoding Pipeline

MRMS files are fetched and decoded in a dedicated Worker to avoid blocking the main thread:

```
Main Thread                    Worker
    │                             │
    ├─ postMessage(fetch-file) ──►│
    │                             ├─ fetch + gunzip
    │                             ├─ GRIB2 decode
    │                             ├─ LUT remap
    │◄─ postMessage(file-ready) ──┤
    │        (transferable)       │
```

Decoded arrays use `Transferable` ownership transfer to avoid serialization overhead.

### Beam Height Calculation

Vertical profile graphs use the standard radar beam propagation model accounting for Earth curvature and 4/3 refraction:

```javascript
const kappa = K0 * Math.cos(eaRad);
const slantRanges = groundRanges.map(s => {
    const s_a = s / EARTH_RADIUS;
    return (1 / kappa) * (eaRad + s_a + Math.asin(EARTH_RADIUS * kappa * Math.sin(s_a) - Math.sin(eaRad + s_a)));
});
```

## Challenges & Solutions

### Big-Endian Binary Parsing

NEXRAD uses big-endian byte ordering. JavaScript TypedArrays default to platform endianness (little-endian on most systems).

**Solution**: All multi-byte reads go through `DataView.getUint16/32(offset, false)` with explicit big-endian flag. For 16-bit radar moment data, manual byte-swapping in a loop:

```javascript
for (let i = 0; i < numGates; i++) {
    rawValues[i] = view.getUint16(dataStart + (i * 2), false);
}
```

### Azimuth-to-Screen Mapping for Click Interrogation

Converting a map click back to radar coordinates requires inverse geodesic calculation.

**Solution**: Haversine formula computes distance and bearing from radar site to click point, then binary searches the azimuth/range arrays for nearest gate:

```javascript
const bearing = Math.atan2(sin(dLng) * cos(lat2), cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLng));
```

### Message Type 31 Parsing Ambiguity

NEXRAD Level 2 stores azimuth as either IEEE 754 float or scaled uint32 depending on file version. Invalid float interpretation produces garbage values.

**Solution**: Parse as float first, validate range (0-360°). If invalid, reinterpret same bytes as uint32 and divide by 8:

```javascript
if (azimuthAngle < 0 || azimuthAngle >= 360 || isNaN(azimuthAngle)) {
    const azInt = view.getUint32(start + 12, false);
    azimuthAngle = azInt / 8.0;
}
```

### MRMS File Discovery

NOAA's S3 bucket requires listing files across multiple date prefixes to find data within a time range.

**Solution**: Enumerate all date directories between start/end, fetch S3 `list-type=2` XML for each, filter keys by embedded timestamp, then parallelize fetches with AbortController for cancellation support.

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env`:
   ```
   VITE_GOOGLE_MAPS_KEY=your_api_key_here
   VITE_GOOGLE_MAPS_LIBS=geometry
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```
