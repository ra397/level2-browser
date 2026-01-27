/**
 * NEXRAD Level 2 File Reader (Vanilla JS)
 * * A lightweight parser for NEXRAD Level 2 radar data files.
 * * Moment Names:
 * REF - Reflectivity (dBZ)
 * VEL - Velocity (m/s)
 * SW  - Spectrum Width (m/s)
 * ZDR - Differential Reflectivity (dB)
 * PHI - Differential Phase (degrees)
 * RHO - Correlation Coefficient (unitless)
 * CFP - Clutter Filter Power Removed (dB)
 */

import seekBzip from 'seek-bzip';
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

const MOMENT_MAP = {
    'REF': 'REF',
    'VEL': 'VEL',
    'SW\x00': 'SW',
    'SW': 'SW',
    'ZDR': 'ZDR',
    'PHI': 'PHI',
    'RHO': 'RHO',
    'CFP': 'CFP',
};

// Constants
const CTM_HEADER_SIZE = 12;
const MSG_HEADER_SIZE = 16;
const VOLUME_HEADER_SIZE = 24;

export class NexradLevel2 {
    /**
     * @param {ArrayBuffer} buffer - The raw binary data of the file
     */
    constructor(buffer) {
        if (!(buffer instanceof ArrayBuffer)) {
            throw new Error("Input must be an ArrayBuffer");
        }

        this._buffer = buffer;
        this._view = new DataView(buffer);

        this._stationId = '';
        this._datetime = null;
        this._vcp = 0;
        this._sweepsData = []; // Metadata
        this._rays = [];       // Data: rays[sweepIndex] = [ray1, ray2...]

        this._parse();

        if (!this._rays.length || this._rays.every(s => s.length === 0)) {
            throw new Error("File contains no valid radar data");
        }
    }

    get stationId() { return this._stationId; }
    get datetime() { return this._datetime; }
    get vcp() { return this._vcp; }
    get sweeps() { return [...this._sweepsData]; }

    /**
     * Get list of all moment names available in this volume.
     * @returns {string[]}
     */
    get moments() {
        const allMoments = new Set();
        for (const sweepRays of this._rays) {
            for (const ray of sweepRays) {
                Object.keys(ray.moments).forEach(m => allMoments.add(m));
            }
        }
        return Array.from(allMoments).sort();
    }

    /**
     * Get available moments for a specific sweep.
     * @param {number} sweepIndex
     * @returns {string[]}
     */
    getMomentsForSweep(sweepIndex) {
        if (sweepIndex < 0 || sweepIndex >= this._rays.length) {
            throw new Error(`Sweep index ${sweepIndex} out of range`);
        }
        const moments = new Set();
        for (const ray of this._rays[sweepIndex]) {
            Object.keys(ray.moments).forEach(m => moments.add(m));
        }
        return Array.from(moments).sort();
    }

    /**
     * Extract moment data for a specific sweep.
     * @param {number} sweepIndex
     * @param {string} moment
     * @returns {Object} { data: Float32Array, azimuths: Float32Array, ranges: Float32Array, elevation: number }
     */
    getData(sweepIndex, moment) {
        if (sweepIndex < 0 || sweepIndex >= this._rays.length) {
            throw new Error(`Sweep index ${sweepIndex} out of range`);
        }

        const sweepRays = this._rays[sweepIndex];
        const availableMoments = this.getMomentsForSweep(sweepIndex);

        if (!availableMoments.includes(moment)) {
            throw new Error(`Moment '${moment}' not available in sweep ${sweepIndex}`);
        }

        // Find template ray
        let templateRay = null;
        for (const ray of sweepRays) {
            if (ray.moments[moment]) {
                templateRay = ray;
                break;
            }
        }

        if (!templateRay) throw new Error("Moment found in index but no ray contains data.");

        const momentInfo = templateRay.moments[moment];
        const numGates = momentInfo.numGates;
        const firstGate = momentInfo.firstGate;
        const gateWidth = momentInfo.gateWidth;

        // Build ranges (km)
        const ranges = new Float32Array(numGates);
        for (let i = 0; i < numGates; i++) {
            ranges[i] = (i * gateWidth) + firstGate;
        }

        const numRays = sweepRays.length;
        const azimuths = new Float32Array(numRays);

        // Flattened 2D array [rays * gates]
        // You can use a wrapper to access as [r][g] if preferred, but flat is better for WebGL/Canvas
        const data = new Float32Array(numRays * numGates);
        data.fill(NaN);

        for (let i = 0; i < numRays; i++) {
            const ray = sweepRays[i];
            azimuths[i] = ray.azimuth;

            if (ray.moments[moment]) {
                const rayMoment = ray.moments[moment];
                const rayData = rayMoment.data;
                const limit = Math.min(rayData.length, numGates);

                // Copy data into the flattened array
                // Offset = current ray index * stride (numGates)
                const offset = i * numGates;
                data.set(rayData.subarray(0, limit), offset);
            }
        }

        return {
            data: data, // Flat Float32Array (Row-major: Ray1, Ray2...)
            azimuths: azimuths,
            ranges: ranges,
            elevation: this._sweepsData[sweepIndex].elevation,
            dims: [numRays, numGates]
        };
    }

    _parse() {
        if (this._buffer.byteLength < VOLUME_HEADER_SIZE) {
            throw new Error("File too small");
        }

        this._parseVolumeHeader();

        // Parse compressed records
        // Starting after header
        const rawBytes = new Uint8Array(this._buffer, VOLUME_HEADER_SIZE);
        this._parseCompressedRecords(rawBytes);

        this._buildSweepMetadata();
    }

    _parseVolumeHeader() {
        // Bytes 20-23: Station ID
        const stationBytes = new Uint8Array(this._buffer, 20, 4);
        this._stationId = new TextDecoder().decode(stationBytes).replace(/\0/g, '');

        const julianDate = this._view.getUint16(12, false); // Big Endian
        const milliseconds = this._view.getUint32(14, false);

        if (julianDate > 0) {
            // JS Dates are epoch based. Julian 1 = Jan 1 1970
            // Subtract 1 day because Julian 1 is the 1st day, Epoch 0 is start of 1st day.
            const baseTime = (julianDate - 1) * 86400000;
            this._datetime = new Date(baseTime + milliseconds);
        }
    }

    _parseCompressedRecords(compressedData) {
        const raysBySweep = {};
        let pos = 0;
        const view = new DataView(compressedData.buffer, compressedData.byteOffset, compressedData.byteLength);

        while (pos + 4 < compressedData.byteLength) {
            // Record size (Big Endian int32)
            const recordSize = view.getInt32(pos, false);
            pos += 4;

            if (recordSize === 0) break;

            const isCompressed = recordSize > 0;
            const actualSize = Math.abs(recordSize);

            if (pos + actualSize > compressedData.byteLength) break;

            const chunk = new Uint8Array(compressedData.buffer, compressedData.byteOffset + pos, actualSize);
            pos += actualSize;

            let decompressed = null;
            if (isCompressed) {
                // *** DECOMPRESSION HOOK ***
                // Note: NEXRAD files use Bzip2. Browsers do NOT support Bzip2 natively.
                // If you are loading standard L2 files, you need a JS bzip2 decoder here.
                // If you are loading Gzipped L2 files, we could use DecompressionStream (async),
                // but for this synchronous parser, we assume an external helper or uncompressed.

                decompressed = this._decompressChunk(chunk);
            } else {
                decompressed = chunk;
            }

            if (decompressed) {
                this._parseMessages(decompressed, raysBySweep);
            }
        }

        // Sort and store
        const sortedKeys = Object.keys(raysBySweep).map(Number).sort((a, b) => a - b);
        this._rays = sortedKeys.map(k => raysBySweep[k]);
    }

    /**
     * Decompress Bzip2 or Gzip chunks.
     * Note: Browsers do not support Bzip2 natively.
     * We rely on the global 'seekBzip' library for this.
     */
    _decompressChunk(chunk) {
        // Check signature for BZ2 ('B' 'Z')
        if (chunk[0] === 0x42 && chunk[1] === 0x5A) {
            try {
                // Use the imported 'seekBzip' directly
                return seekBzip.decode(chunk);
            } catch (err) {
                console.error("Bzip2 decompression failed", err);
                return null;
            }
        }

        // Return raw chunk if not compressed or unknown
        return chunk;
    }

    _parseMessages(data, raysBySweep) {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        let pos = 0;

        while (pos < data.byteLength - (CTM_HEADER_SIZE + MSG_HEADER_SIZE)) {
            const msgHeaderStart = pos + CTM_HEADER_SIZE;

            if (msgHeaderStart + MSG_HEADER_SIZE > data.byteLength) break;

            const msgSizeHw = view.getUint16(msgHeaderStart, false);
            const msgType = view.getUint8(msgHeaderStart + 3);
            const msgSizeBytes = msgSizeHw * 2;

            if (msgSizeBytes < MSG_HEADER_SIZE || msgSizeBytes > 20000) {
                pos += 1;
                continue;
            }

            const totalSize = CTM_HEADER_SIZE + msgSizeBytes;

            if (msgType === 31) {
                const msg31Start = msgHeaderStart + MSG_HEADER_SIZE;
                // Parse Message 31
                const rayInfo = this._parseMessage31(view, msg31Start, msgSizeBytes - MSG_HEADER_SIZE);

                if (rayInfo) {
                    const sweepNum = rayInfo.sweepNumber;
                    if (!raysBySweep[sweepNum]) raysBySweep[sweepNum] = [];
                    raysBySweep[sweepNum].push(rayInfo);

                    if (rayInfo.vcp > 0) this._vcp = rayInfo.vcp;
                    if (!this._datetime && rayInfo.datetime) this._datetime = rayInfo.datetime;
                    if (rayInfo.stationId) this._stationId = rayInfo.stationId;
                }
            }

            pos += totalSize;
        }
    }

    _parseMessage31(view, start, maxLength) {
        try {
            if (start + 60 > view.byteLength) return null;

            // Radar ID (4 bytes)
            const idBytes = new Uint8Array(view.buffer, view.byteOffset + start, 4);
            const radarId = new TextDecoder().decode(idBytes);
            if (!/^[A-Z]/.test(radarId)) return null;

            const collectionTime = view.getUint32(start + 4, false);
            const julianDate = view.getUint16(start + 8, false);

            let azimuthAngle = view.getFloat32(start + 12, false);
            if (azimuthAngle < 0 || azimuthAngle >= 360) {
                // Try scaled integer
                // Re-read as Uint32 then divide
                const azInt = view.getUint32(start + 12, false); // Actually the bytes are same, just interpreting differently
                // Wait, need to read raw bytes to reinterpret? getUint32 reads the same 4 bytes
                azimuthAngle = azInt / 8.0;
                // Wait, Python `struct.unpack('>f')` vs `>I`.
                // We should assume Float first. If float looks garbage, try int scaling.
                // Re-reading the float logic:
                // If the float interpretation is huge or NaN, it might be int.
            }
            // Strict reset for JS:
            if (azimuthAngle < 0 || azimuthAngle >= 360 || isNaN(azimuthAngle)) {
                const azInt = view.getUint32(start + 12, false);
                azimuthAngle = azInt / 8.0;
                if (azimuthAngle < 0 || azimuthAngle >= 360) return null;
            }

            const elevationNum = view.getUint8(start + 22);
            const elevationAngle = view.getFloat32(start + 24, false);

            if (elevationAngle < -10 || elevationAngle > 90) return null;

            const dataBlockCount = view.getUint16(start + 30, false);
            if (dataBlockCount < 1 || dataBlockCount > 15) return null;

            // Block Pointers
            const blockPointers = [];
            let ptrOffset = start + 32;
            for (let i = 0; i < dataBlockCount; i++) {
                blockPointers.push(view.getUint32(ptrOffset, false));
                ptrOffset += 4;
            }

            const momentsData = {};
            let vcp = 0;

            for (const ptr of blockPointers) {
                if (ptr === 0) continue;
                const blockPos = start + ptr;
                if (blockPos + 4 > view.byteLength) continue;

                // Block Name (ASCII)
                // Type is 1 byte, name is 3 bytes.
                // We access the chars directly.
                const typeChar = String.fromCharCode(view.getUint8(blockPos));

                if (typeChar === 'R') {
                    // Volume Data
                    if (blockPos + 20 <= view.byteLength) {
                        vcp = view.getUint16(blockPos + 16, false);
                    }
                } else if (typeChar === 'D') {
                    // Moment Data
                    const momentData = this._parseMomentBlock(view, blockPos);
                    if (momentData) {
                        let name = momentData.name;
                        // Clean null bytes
                        name = name.replace(/\0/g, '');
                        if (MOMENT_MAP[name]) {
                            momentsData[MOMENT_MAP[name]] = momentData;
                        }
                    }
                }
            }

            if (Object.keys(momentsData).length === 0) return null;

            let rayDatetime = null;
            if (julianDate > 0) {
                const baseTime = (julianDate - 1) * 86400000;
                rayDatetime = new Date(baseTime + collectionTime);
            }

            return {
                stationId: radarId.replace(/\0/g, ''),
                azimuth: azimuthAngle,
                elevation: elevationAngle,
                sweepNumber: elevationNum,
                moments: momentsData,
                vcp: vcp,
                datetime: rayDatetime
            };

        } catch (e) {
            return null;
        }
    }

    _parseMomentBlock(view, pos) {
        try {
            if (pos + 28 > view.byteLength) return null;

            const nameBytes = new Uint8Array(view.buffer, view.byteOffset + pos + 1, 3);
            const name = new TextDecoder().decode(nameBytes);

            const numGates = view.getUint16(pos + 8, false);
            const firstGateM = view.getUint16(pos + 10, false);
            const gateWidthM = view.getUint16(pos + 12, false);
            const dataWordSize = view.getUint8(pos + 19);
            const scale = view.getFloat32(pos + 20, false);
            const offset = view.getFloat32(pos + 24, false);

            if (numGates < 1 || numGates > 2000) return null;
            if (gateWidthM < 50 || gateWidthM > 4000) return null; // Relaxed max slightly
            if (scale === 0) return null;

            const dataStart = pos + 28;
            let rawValues;
            let byteSize = 0;

            if (dataWordSize === 8) {
                byteSize = numGates;
                if (dataStart + byteSize > view.byteLength) return null;
                rawValues = new Uint8Array(view.buffer, view.byteOffset + dataStart, numGates);
            } else if (dataWordSize === 16) {
                byteSize = numGates * 2;
                if (dataStart + byteSize > view.byteLength) return null;
                // Need a temporary view to read Big Endian uint16s if platform is Little Endian
                // Or map it manually. TypedArray constructor uses platform endianness (usually Little).
                // NEXRAD is Big Endian. We cannot just wrap Uint16Array.
                rawValues = new Uint16Array(numGates);
                for(let i=0; i<numGates; i++) {
                    rawValues[i] = view.getUint16(dataStart + (i*2), false);
                }
            } else {
                return null;
            }

            // Convert to physical units
            const physicalValues = new Float32Array(numGates);
            for (let i = 0; i < numGates; i++) {
                const val = rawValues[i];
                if (val < 2) {
                    physicalValues[i] = NaN; // Below threshold or range folded
                } else {
                    physicalValues[i] = (val - offset) / scale;
                }
            }

            return {
                name: name,
                numGates: numGates,
                firstGate: firstGateM / 1000.0, // km
                gateWidth: gateWidthM / 1000.0, // km
                data: physicalValues
            };

        } catch (e) {
            return null;
        }
    }

    _buildSweepMetadata() {
        this._sweepsData = [];
        this._rays.forEach((sweepRays, i) => {
            if (!sweepRays || sweepRays.length === 0) return;

            const elevationSum = sweepRays.reduce((acc, r) => acc + r.elevation, 0);
            const avgElevation = elevationSum / sweepRays.length;

            this._sweepsData.push({
                index: i,
                elevation: parseFloat(avgElevation.toFixed(2)),
                rayCount: sweepRays.length
            });
        });
    }
}