# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A browser-based NEXRAD Level 2 radar data viewer that renders weather radar data on Google Maps using WebGL. Users can input a URL to a NEXRAD Level 2 file, which gets decoded and displayed as an interactive radar overlay.

## Commands

- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Architecture

### Data Flow
1. User pastes a NEXRAD Level 2 URL in the menu
2. `main.js` fetches and decodes the file using `NexradLevel2` decoder
3. Decoded radar data is passed to `RadarMapOverlay` (WebGL renderer)
4. Overlay renders on Google Maps with selected sweep/moment

### Module Structure

**Decoder** (`src/decoder/`)
- `NexradLevel2.js` - Parses NEXRAD Level 2 binary files, handles Bzip2 decompression, extracts radar moments (REF, VEL, SW, ZDR, PHI, RHO, CFP)

**Displayer** (`src/displayer/`)
- `radarGl.js` - WebGL2-based radar renderer with GLSL shaders, handles polar-to-Mercator coordinate transformation for Google Maps overlay, contains color palettes for each radar moment
- `markerCollection.js` - Google Maps marker management with SVG icons

**Components** (`src/components/`)
- `map.js` - Google Maps initialization using `@googlemaps/js-api-loader`
- `menu.js` - URL input and sweep/moment selection UI
- `legend.js` - Color scale legend display
- `markers.js` - NEXRAD station markers on map

### Event-Driven Communication
Components communicate via custom DOM events:
- `decode-requested` - Triggered when user clicks decode
- `decode-success` / `decode-error` - Decode completion status
- `sweep-changed` / `moment-changed` - User selection changes
- `moments-updated` - Available moments changed
- `mapReady` / `nexradStationsReady` - Initialization events

### Environment Variables
Required in `.env`:
- `VITE_GOOGLE_MAPS_KEY` - Google Maps API key
- `VITE_GOOGLE_MAPS_LIBS` - Comma-separated list of Google Maps libraries to load

### Static Data
- `/data/nexrad.json` - NEXRAD station metadata (id, name, lat, lng)

## Code Style

- ES modules with explicit `.js` extensions in imports
- Classes use private methods with `#` prefix
- CSS custom properties defined in `:root`
- Async operations use async/await
- No TypeScript, no build-time type checking

## Team Etiquette 
Calude, you are NOT ALLOWED to edit any files for me, please only suggest code and I will edit my files myself.