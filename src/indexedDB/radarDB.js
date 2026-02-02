const DB_NAME = 'nexrad-db';
const DB_VERSION = 1;

class RadarDB {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('volumes')) {
                    const volumeStore = db.createObjectStore('volumes', { keyPath: 'id' });
                    volumeStore.createIndex('stationId', 'stationId');
                    volumeStore.createIndex('datetime', 'datetime');
                }

                if (!db.objectStoreNames.contains('momentData')) {
                    const momentStore = db.createObjectStore('momentData', { keyPath: 'id' });
                    momentStore.createIndex('volumeId', 'volumeId');
                }
            };
        });
    }

    // ============ Compression Utilities ============

    /**
     * Compress a Float32Array to gzipped ArrayBuffer
     */
    async compress(float32Array) {
        const bytes = new Uint8Array(float32Array.buffer);

        const cs = new CompressionStream('gzip');
        const writer = cs.writable.getWriter();
        writer.write(bytes);
        writer.close();

        const chunks = [];
        const reader = cs.readable.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }

        // Combine chunks into single ArrayBuffer
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return result.buffer;
    }

    /**
     * Decompress gzipped ArrayBuffer back to Float32Array
     */
    async decompress(compressedBuffer, length) {
        const ds = new DecompressionStream('gzip');
        const writer = ds.writable.getWriter();
        writer.write(new Uint8Array(compressedBuffer));
        writer.close();

        const chunks = [];
        const reader = ds.readable.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }

        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return new Float32Array(result.buffer);
    }

    /**
     * Compress multiple Float32Arrays into a single record
     */
    async compressMomentData(data, azimuths, ranges) {
        const [compressedData, compressedAzimuths, compressedRanges] = await Promise.all([
            this.compress(data),
            this.compress(azimuths),
            this.compress(ranges)
        ]);

        return {
            data: compressedData,
            dataLength: data.length,
            azimuths: compressedAzimuths,
            azimuthsLength: azimuths.length,
            ranges: compressedRanges,
            rangesLength: ranges.length
        };
    }

    /**
     * Decompress moment data record
     */
    async decompressMomentData(record) {
        const [data, azimuths, ranges] = await Promise.all([
            this.decompress(record.data, record.dataLength),
            this.decompress(record.azimuths, record.azimuthsLength),
            this.decompress(record.ranges, record.rangesLength)
        ]);

        return { data, azimuths, ranges };
    }

    // ============ Storage Methods ============

    /**
     * Save entire decoded radar volume with compression
     */
    async saveVolume(radar) {
        const volumeId = `${radar.stationId}_${radar.datetime.toISOString()}`;

        const volumeMeta = {
            id: volumeId,
            stationId: radar.stationId,
            datetime: radar.datetime.toISOString(),
            vcp: radar.vcp,
            moments: radar.moments,
            sweeps: radar.sweeps
        };

        // Prepare all moment data with compression
        const momentRecords = [];

        for (const sweep of radar.sweeps) {
            const sweepMoments = radar.getMomentsForSweep(sweep.index);

            for (const moment of sweepMoments) {
                const rawData = radar.getData(sweep.index, moment);
                const compressed = await this.compressMomentData(
                    rawData.data,
                    rawData.azimuths,
                    rawData.ranges
                );

                momentRecords.push({
                    id: `${volumeId}:${sweep.index}:${moment}`,
                    volumeId: volumeId,
                    sweepIndex: sweep.index,
                    moment: moment,
                    compressed: compressed,
                    elevation: rawData.elevation,
                    dims: rawData.dims
                });
            }
        }

        // Write to IndexedDB
        const tx = this.db.transaction(['volumes', 'momentData'], 'readwrite');
        tx.objectStore('volumes').put(volumeMeta);

        const momentStore = tx.objectStore('momentData');
        for (const record of momentRecords) {
            momentStore.put(record);
        }

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(volumeId);
            tx.onerror = () => reject(tx.error);
        });
    }

    /**
     * Load volume metadata
     */
    async getVolume(volumeId) {
        const tx = this.db.transaction('volumes', 'readonly');
        const request = tx.objectStore('volumes').get(volumeId);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Load and decompress specific moment data
     */
    async getMomentData(volumeId, sweepIndex, moment) {
        const key = `${volumeId}:${sweepIndex}:${moment}`;
        const tx = this.db.transaction('momentData', 'readonly');
        const request = tx.objectStore('momentData').get(key);

        return new Promise((resolve, reject) => {
            request.onsuccess = async () => {
                const record = request.result;
                if (!record) {
                    resolve(null);
                    return;
                }

                // Decompress the arrays
                const { data, azimuths, ranges } = await this.decompressMomentData(record.compressed);

                resolve({
                    data,
                    azimuths,
                    ranges,
                    elevation: record.elevation,
                    dims: record.dims
                });
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get storage stats for a volume
     */
    async getVolumeStats(volumeId) {
        const tx = this.db.transaction('momentData', 'readonly');
        const index = tx.objectStore('momentData').index('volumeId');
        const request = index.getAll(IDBKeyRange.only(volumeId));

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const records = request.result;
                let compressedSize = 0;
                let uncompressedSize = 0;

                for (const record of records) {
                    const c = record.compressed;
                    compressedSize += c.data.byteLength + c.azimuths.byteLength + c.ranges.byteLength;
                    uncompressedSize += (c.dataLength + c.azimuthsLength + c.rangesLength) * 4; // Float32 = 4 bytes
                }

                resolve({
                    momentCount: records.length,
                    compressedSize,
                    uncompressedSize,
                    compressionRatio: ((1 - compressedSize / uncompressedSize) * 100).toFixed(1) + '%'
                });
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * List all cached volumes
     */
    async listVolumes() {
        const tx = this.db.transaction('volumes', 'readonly');
        const request = tx.objectStore('volumes').getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete a volume and all its moment data
     */
    async deleteVolume(volumeId) {
        const tx = this.db.transaction(['volumes', 'momentData'], 'readwrite');

        tx.objectStore('volumes').delete(volumeId);

        const momentStore = tx.objectStore('momentData');
        const index = momentStore.index('volumeId');
        const request = index.openCursor(IDBKeyRange.only(volumeId));

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    /**
     * Clear entire cache
     */
    async clearAll() {
        const tx = this.db.transaction(['volumes', 'momentData'], 'readwrite');
        tx.objectStore('volumes').clear();
        tx.objectStore('momentData').clear();

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
}

export { RadarDB };