export function polarToCartesian(data, azimuths, ranges, imgSize = 2000) {
    const cx = imgSize / 2;
    const cy = imgSize / 2;
    const minRange = ranges[0];
    const maxRange = ranges[ranges.length - 1];

    // Sort azimuths and get indices
    const sortedAzIndices = Array.from(azimuths.keys()).sort(
        (a, b) => azimuths[a] - azimuths[b]
    );
    const azSorted = sortedAzIndices.map((i) => azimuths[i]);

    // Output: raw reflectivity values (Float32Array)
    const output = new Float32Array(imgSize * imgSize);
    output.fill(NaN);

    for (let py = 0; py < imgSize; py++) {
        for (let px = 0; px < imgSize; px++) {
            const dx = px - cx;
            const dy = cy - py;

            const pixelRange = Math.sqrt(dx * dx + dy * dy) * (maxRange / (imgSize / 2));
            let pixelAz = (Math.atan2(dx, dy) * 180) / Math.PI;
            if (pixelAz < 0) pixelAz += 360;

            // Skip if outside range bounds
            if (pixelRange > maxRange || pixelRange < minRange) {
                continue;
            }

            // Binary search for azimuth index
            let azIdx = binarySearch(azSorted, pixelAz) - 1;
            if (azIdx < 0) azIdx = azSorted.length - 1;
            azIdx = sortedAzIndices[azIdx];

            // Binary search for range index
            let rangeIdx = binarySearch(ranges, pixelRange) - 1;
            rangeIdx = Math.max(0, Math.min(rangeIdx, ranges.length - 1));

            // Store raw reflectivity value
            output[py * imgSize + px] = data[azIdx * ranges.length + rangeIdx];
        }
    }
    return output;
}

function binarySearch(arr, val) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (arr[mid] <= val) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}