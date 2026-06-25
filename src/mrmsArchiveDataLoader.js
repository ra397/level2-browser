// Decoder for compacted MRMS radar JSON (base64 typed arrays).
// Assumes little-endian (every common browser/Node platform).

const DTYPES = {
    "<f4": Float32Array,
    "<f8": Float64Array,
    "<u4": Uint32Array,
    "<i4": Int32Array,
    "<u2": Uint16Array,
    "<i2": Int16Array,
    "<u1": Uint8Array,
    "<i1": Int8Array,
};

function decodeField(field) {
    // scalar fields (e.g. total_area) are stored as a plain number
    if (typeof field.data === "number") return field.data;

    const TA = DTYPES[field.dtype];
    if (!TA) throw new Error(`Unsupported dtype: ${field.dtype}`);

    const bin = atob(field.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TA(bytes.buffer);
}

/**
 * Decode one radar-year file.
 * @returns {{ timestamps: Uint32Array, area_rain: Float32Array,
 *             volume_rain: Float32Array, total_area: number }}
 */
export function decodeRadarYear(json) {
    return {
        timestamps: decodeField(json.timestamps), // unix seconds
        area_rain: decodeField(json.area_rain),
        volume_rain: decodeField(json.volume_rain),
        max_rain: decodeField(json.max_rain),
        total_area: decodeField(json.total_area),
    };
}

/**
 * Transform timestamps to local time.
 * @param {object} data - Raw radar data with UTC timestamps
 * @returns {object} - Data with timestamps shifted to local time
 */
export function transformToLocal(data) {
    const offset = -new Date().getTimezoneOffset() * 60;
    const localTimestamps = new Uint32Array(data.timestamps.length);
    for (let i = 0; i < data.timestamps.length; i++) {
        localTimestamps[i] = data.timestamps[i] + offset;
    }
    return {
        ...data,
        timestamps: localTimestamps
    };
}

export function aggregateByDay({ timestamps, area_rain, volume_rain, max_rain, total_area }, aggregationMethod = 'mean') {
    const DAY = 86400;
    const days = new Map();

    for (let i = 0; i < timestamps.length; i++) {
        const dayStart = Math.floor(timestamps[i] / DAY) * DAY;
        let d = days.get(dayStart);
        if (!d) days.set(dayStart, (d = { areaSum: 0, areaMax: -Infinity, count: 0, volSum: 0, maxRain: -Infinity }));
        d.areaSum += area_rain[i];
        d.areaMax = Math.max(d.areaMax, area_rain[i]);
        d.volSum += volume_rain[i];
        d.maxRain = Math.max(d.maxRain, max_rain[i]);
        d.count++;
    }

    const starts = [...days.keys()].sort((a, b) => a - b);
    const ts = new Uint32Array(starts.length);
    const area = new Float64Array(starts.length);
    const vol = new Float64Array(starts.length);
    const mean = new Float64Array(starts.length);
    const max = new Float64Array(starts.length);

    starts.forEach((start, i) => {
        const d = days.get(start);
        const wettedArea = aggregationMethod === 'max'
            ? d.areaMax
            : d.areaSum / d.count;

        ts[i] = start;
        area[i] = wettedArea / total_area;
        vol[i] = d.volSum;
        mean[i] = d.areaSum > 0 ? d.volSum / d.areaSum : 0;
        max[i] = d.maxRain > 0 ? d.maxRain : 0;
    });

    return { timestamps: ts, area_rain: area, volume_rain: vol, mean_rain: mean, max_rain: max };
}

/**
 * Get hourly data for a specific day.
 * @param {object} data - Radar data (already in correct timezone)
 * @param {number} dayTimestamp - Day start timestamp
 * @param {string} variable - Variable to extract
 */
export function getHourlyDataForDay({ timestamps, area_rain, volume_rain, max_rain, total_area }, dayTimestamp, variable) {
    const HOUR = 3600;
    const DAY = 86400;
    const dayStart = Math.floor(dayTimestamp / DAY) * DAY;

    const hourlyData = [];
    for (let h = 0; h < 24; h++) {
        const hourStart = dayStart + h * HOUR;
        const hourEnd = hourStart + HOUR;

        const hourEntries = [];
        for (let i = 0; i < timestamps.length; i++) {
            if (timestamps[i] >= hourStart && timestamps[i] < hourEnd) {
                hourEntries.push(i);
            }
        }

        let value = 0;
        if (hourEntries.length > 0) {
            if (variable === 'volume_rain') {
                value = hourEntries.reduce((sum, idx) => sum + volume_rain[idx], 0);
            } else if (variable === 'area_rain') {
                const areaSum = hourEntries.reduce((sum, idx) => sum + area_rain[idx], 0);
                value = (areaSum / hourEntries.length) / total_area;
            } else if (variable === 'mean_rain') {
                const volSum = hourEntries.reduce((sum, idx) => sum + volume_rain[idx], 0);
                const areaSum = hourEntries.reduce((sum, idx) => sum + area_rain[idx], 0);
                value = areaSum > 0 ? volSum / areaSum : 0;
            } else if (variable === 'max_rain') {
                value = hourEntries.reduce((maxVal, idx) => Math.max(maxVal, max_rain[idx]), 0);
            }
        }

        hourlyData.push({
            label: `${String(h).padStart(2, '0')}:00`,
            value: value,
            timestamp: new Date(hourStart * 1000)
        });
    }

    return hourlyData;
}

/** Fetch + decode a single file. */
export async function loadRadarData(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return decodeRadarYear(await res.json());
}
