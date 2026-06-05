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
        total_area: decodeField(json.total_area),
    };
}

/**
 * Get timezone offset in seconds.
 * @param {boolean} useLocal - If true, returns local timezone offset; if false, returns 0 (UTC)
 * @returns {number} Offset in seconds to subtract from UTC timestamp to get local day boundary
 */
export function getTimezoneOffset(useLocal) {
    if (!useLocal) return 0;
    // JavaScript getTimezoneOffset returns minutes, positive for west of UTC
    // We need seconds to subtract from UTC to align with local midnight
    return -new Date().getTimezoneOffset() * 60;
}

export function aggregateByDay({ timestamps, area_rain, volume_rain, total_area }, aggregationMethod = 'mean', tzOffset = 0) {
    const DAY = 86400;
    const days = new Map();

    for (let i = 0; i < timestamps.length; i++) {
        // Adjust timestamp by timezone offset before computing day boundary
        const adjustedTs = timestamps[i] - tzOffset;
        const dayStart = Math.floor(adjustedTs / DAY) * DAY;
        let d = days.get(dayStart);
        if (!d) days.set(dayStart, (d = { areaSum: 0, areaMax: -Infinity, count: 0, volSum: 0 }));
        d.areaSum += area_rain[i];
        d.areaMax = Math.max(d.areaMax, area_rain[i]);
        d.volSum += volume_rain[i];
        d.count++;
    }

    const starts = [...days.keys()].sort((a, b) => a - b);
    const ts = new Uint32Array(starts.length);
    const area = new Float64Array(starts.length);
    const vol = new Float64Array(starts.length);
    const mean = new Float64Array(starts.length);

    starts.forEach((start, i) => {
        const d = days.get(start);
        const wettedArea = aggregationMethod === 'max'
            ? d.areaMax
            : d.areaSum / d.count;

        ts[i] = start;
        area[i] = wettedArea / total_area;
        vol[i] = d.volSum;
        mean[i] = d.volSum / (d.areaSum / d.count);
    });

    return { timestamps: ts, area_rain: area, volume_rain: vol, mean_rain: mean };
}

/**
 * Get hourly data for a specific day (unix timestamp at day start in adjusted time).
 * Returns an array of 24 hourly entries with the selected variable's values.
 * @param {object} data - Raw radar data
 * @param {number} dayTimestamp - Day start timestamp (already adjusted for timezone)
 * @param {string} variable - Variable to extract
 * @param {number} tzOffset - Timezone offset in seconds (0 for UTC)
 */
export function getHourlyDataForDay({ timestamps, area_rain, volume_rain, total_area }, dayTimestamp, variable, tzOffset = 0) {
    const HOUR = 3600;
    const DAY = 86400;
    const dayStart = Math.floor(dayTimestamp / DAY) * DAY;

    const hourlyData = [];
    for (let h = 0; h < 24; h++) {
        const hourStart = dayStart + h * HOUR;
        const hourEnd = hourStart + HOUR;

        // Find all entries within this hour (adjust raw timestamps by tzOffset)
        const hourEntries = [];
        for (let i = 0; i < timestamps.length; i++) {
            const adjustedTs = timestamps[i] - tzOffset;
            if (adjustedTs >= hourStart && adjustedTs < hourEnd) {
                hourEntries.push(i);
            }
        }

        let value = 0;
        if (hourEntries.length > 0) {
            if (variable === 'volume_rain') {
                // Sum of volumes for the hour
                value = hourEntries.reduce((sum, idx) => sum + volume_rain[idx], 0);
            } else if (variable === 'area_rain') {
                // Mean of area percentages for the hour
                const areaSum = hourEntries.reduce((sum, idx) => sum + area_rain[idx], 0);
                value = (areaSum / hourEntries.length) / total_area;
            } else if (variable === 'mean_rain') {
                // Mean rain depth = total volume / total wetted area
                const volSum = hourEntries.reduce((sum, idx) => sum + volume_rain[idx], 0);
                const areaSum = hourEntries.reduce((sum, idx) => sum + area_rain[idx], 0);
                value = areaSum > 0 ? volSum / (areaSum / hourEntries.length) : 0;
            }
        }

        const formattedTime = `${String(h+1).padStart(2, '0')}:00`;

        hourlyData.push({
            label: formattedTime,
            value: value,
            timestamp: new Date((hourStart - tzOffset + 3600) * 1000)
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