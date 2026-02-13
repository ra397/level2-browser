import { Grib2Decoder } from './decode/grib2/grib2.js';
import fastPng from "./decode/fastpng/fast-png-bundle.js";

// LUT loaded once when worker initializes
let LUT = null;

async function loadLUT() {
    if (LUT) return;

    const response = await fetch("/nexrad-l2/data/MRMS_LUT.json");
    LUT = await response.json();

    // Convert "mrms_1d_ix" from base64 string to typed array
    const dataUri = atob(LUT.mrms_1d_ix);
    const bytes = new Uint8Array(dataUri.length);
    for (let i = 0; i < dataUri.length; i++) {
        bytes[i] = dataUri.charCodeAt(i);
    }
    LUT.mrms_1d_ix = new Int32Array(bytes.buffer);
}

async function fetchFile(path) {
    const url = "https://noaa-mrms-pds.s3.amazonaws.com/" + path;
    try {
        const response = await fetch(url);
        const gzippedData = (await response.blob()).stream();
        const ds = new DecompressionStream("gzip");
        const decompressedData = gzippedData.pipeThrough(ds);
        return await new Response(decompressedData).arrayBuffer();
    } catch (err) {
        console.error('Worker: Fetch error:', err.message);
        return null;
    }
}

function decodeGrib2(rawData) {
    function pngDecoder(imageBytes) {
        const decoded = fastPng.decode(imageBytes);
        return decoded.data.slice(0);
    }

    const grib2Decoder = new Grib2Decoder({
        log: false,
        numMembers: 1,
        pngDecoder: pngDecoder,
    });

    grib2Decoder.parse(new Uint8Array(rawData));
    const gribData = grib2Decoder.data;
    const referenceValue = grib2Decoder.ReferenceValue;
    const binaryScaleFactor = grib2Decoder.BinaryScaleFactor;
    const decimalScaleFactor = grib2Decoder.DecimalScaleFactor;
    return { gribData, referenceValue, binaryScaleFactor, decimalScaleFactor };
}

function generateMatrixUsingLUT(values, numCols, numRows) {
    const total = numCols * numRows;
    const raster = new Uint16Array(total);

    for (let i = 0; i < total; i++) {
        const dataIndex = LUT.mrms_1d_ix[i];
        raster[i] = values[dataIndex];
    }
    return raster;
}

async function processFile(fileName, productName) {
    await loadLUT();

    try {
        const rawData = await fetchFile(fileName);

        if (!rawData) {
            self.postMessage({
                type: 'file-error',
                file_name: fileName,
                error: 'Failed to fetch file',
            });
            return;
        }

        const { gribData, referenceValue, binaryScaleFactor, decimalScaleFactor } = decodeGrib2(rawData);
        const decodedData = generateMatrixUsingLUT(gribData, LUT.ncols, LUT.nrows);

        self.postMessage({
            type: 'file-ready',
            product_name: productName,
            file_name: fileName,
            file_data: decodedData,
            reference_value: referenceValue,
            binary_scale: binaryScaleFactor,
            decimal_scale: decimalScaleFactor,
        }, [decodedData.buffer]);

    } catch (err) {
        self.postMessage({
            type: 'file-error',
            file_name: fileName,
            error: err.message,
        });
    }
}

self.onmessage = (event) => {
    const { type, fileName, productName } = event.data;

    if (type === 'fetch-file') {
        processFile(fileName, productName);
    }
};
