// MRMS API - fetches and decodes MRMS files

const state = {
    product: null,
    startTime: null,
    endTime: null,
};

let isFetching = false;
let currentAbortController = null;

// Data store for decoded files
const dataStore = new Map();
let activeFiles = [];

// Web Worker instance
const fetchAndDecodeWorker = new Worker(new URL('./mrms-worker.js', import.meta.url), { type: 'module' });

fetchAndDecodeWorker.onerror = (error) => {
    console.error('MRMS Worker error:', error);
};

// Listen for product selection from MRMS menu
document.addEventListener('mrms-product-selected', event => {
    const newProduct = event.detail.product;

    if (state.startTime && state.endTime) {
        handleNewRequest(newProduct, state.startTime, state.endTime);
    } else {
        state.product = newProduct;
    }
});

// Listen for time selection from timeline
document.addEventListener('time-selected', event => {
    const newStartTime = event.detail.startDate;
    const newEndTime = event.detail.endDate;

    if (state.product) {
        handleNewRequest(state.product, newStartTime, newEndTime);
    } else {
        state.startTime = newStartTime;
        state.endTime = newEndTime;
    }
});

function handleNewRequest(newProduct, newStartTime, newEndTime) {
    if (isFetching) {
        // Cancel current request
        if (currentAbortController) {
            currentAbortController.abort();
        }
    }

    state.product = newProduct;
    state.startTime = newStartTime;
    state.endTime = newEndTime;
    fetchData();
}

async function fetchData() {
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;
    isFetching = true;

    try {
        const start_YYYYMMDD = extractYYYYMMDD(state.startTime.toISOString());
        const end_YYYYMMDD = extractYYYYMMDD(state.endTime.toISOString());

        const dates = getDatesBetween(start_YYYYMMDD, end_YYYYMMDD);

        const possible_files = [];

        for (const date of dates) {
            if (signal.aborted) return;
            const files_for_that_day = await getFiles(date, signal);
            for (const file of files_for_that_day) {
                possible_files.push(file);
            }
        }

        if (signal.aborted) return;

        const files_to_fetch = [];

        for (const file of possible_files) {
            const file_timestamp = extractTimestampFromKey(file).toISOString();
            if (file_timestamp > state.startTime.toISOString() && file_timestamp <= state.endTime.toISOString()) {
                files_to_fetch.push(file);
            }
        }

        // Sort files by timestamp
        files_to_fetch.sort((a, b) => {
            const timestampA = extractTimestampFromKey(a).toISOString();
            const timestampB = extractTimestampFromKey(b).toISOString();
            return timestampA.localeCompare(timestampB);
        });

        // Set active files
        activeFiles = files_to_fetch;

        // Dispatch total files count
        document.dispatchEvent(new CustomEvent('mrms-files-total', {
            detail: {
                total: files_to_fetch.length,
                fileNames: files_to_fetch
            },
        }));

        // Fetch files not already in cache
        const filesToActuallyFetch = files_to_fetch.filter(file => !dataStore.has(file));

        // For files already in memory, dispatch display-file with cached data
        for (const fileName of files_to_fetch) {
            if (signal.aborted) return;
            if (dataStore.has(fileName)) {
                const cached = dataStore.get(fileName);
                dispatchDisplayFile(
                    cached.productName,
                    fileName,
                    cached.data,
                    cached.referenceValue,
                    cached.binaryScale,
                    cached.decimalScale
                );
            }
        }

        // Fetch missing files
        for (const fileName of filesToActuallyFetch) {
            if (signal.aborted) return;
            await fetchAndDecodeFile(fileName, signal);
        }

    } finally {
        isFetching = false;
        currentAbortController = null;
    }
}

function dispatchDisplayFile(product_name, file_name, file_data, referenceValue, binaryScale, decimalScale) {
    document.dispatchEvent(new CustomEvent('mrms-display-file', {
        detail: {
            product_name: product_name,
            file_data: file_data,
            file_name: file_name,
            referenceValue: referenceValue,
            binaryScale: binaryScale,
            decimalScale: decimalScale,
        },
    }));
}

function fetchAndDecodeFile(fileName, signal) {
    return new Promise((resolve, reject) => {
        if (signal && signal.aborted) {
            resolve();
            return;
        }

        const handler = async (event) => {
            const { type, product_name, file_name, file_data, reference_value, binary_scale, decimal_scale, error } = event.data;
            if (file_name !== fileName) return;

            fetchAndDecodeWorker.removeEventListener('message', handler);
            if (signal) {
                signal.removeEventListener('abort', abortHandler);
            }

            if (type === 'file-ready') {
                if (signal && signal.aborted) {
                    resolve();
                    return;
                }

                // Store in memory cache
                dataStore.set(file_name, {
                    data: file_data,
                    productName: product_name,
                    referenceValue: reference_value,
                    binaryScale: binary_scale,
                    decimalScale: decimal_scale,
                });

                dispatchDisplayFile(product_name, file_name, file_data, reference_value, binary_scale, decimal_scale);
                resolve();
            } else if (type === 'file-error') {
                console.error(`Failed to process: ${file_name}`, error);
                resolve(); // Continue even on error
            }
        };

        const abortHandler = () => {
            fetchAndDecodeWorker.removeEventListener('message', handler);
            resolve();
        };

        if (signal) {
            signal.addEventListener('abort', abortHandler);
        }

        fetchAndDecodeWorker.addEventListener('message', handler);

        fetchAndDecodeWorker.postMessage({
            type: 'fetch-file',
            fileName: fileName,
            productName: state.product,
        });
    });
}

async function getFiles(day, signal) {
    const product = state.product;
    try {
        const response = await fetch(`https://noaa-mrms-pds.s3.amazonaws.com/?list-type=2&delimiter=/&prefix=CONUS/${product}/${day}/`, { signal });
        const xmlString = await response.text();

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "application/xml");

        const keyElements = xmlDoc.getElementsByTagName("Key");

        const filenames = [];
        for (let i = 0; i < keyElements.length; i++) {
            filenames.push(keyElements[i].textContent);
        }
        return filenames;
    } catch (e) {
        if (e.name === 'AbortError') {
            return [];
        }
        console.error(e);
        return [];
    }
}

export function extractTimestampFromKey(filename) {
    const match = filename.match(/(\d{8})-(\d{6})\.grib2\.gz$/);

    if (!match) {
        throw new Error("No valid timestamp found in the input string.");
    }

    const [_, yyyymmdd, hhmmss] = match;

    const year = yyyymmdd.substring(0, 4);
    const month = yyyymmdd.substring(4, 6);
    const day = yyyymmdd.substring(6, 8);

    const hour = hhmmss.substring(0, 2);
    const minute = hhmmss.substring(2, 4);
    const second = hhmmss.substring(4, 6);

    return new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
    ));
}

function extractYYYYMMDD(isoString) {
    const date = new Date(isoString);

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    return `${year}${month}${day}`;
}

function getDatesBetween(startDate, endDate) {
    const parseDate = (dateStr) => {
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        return new Date(year, month, day);
    };

    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    };

    const start = parseDate(startDate);
    const end = parseDate(endDate);
    const dates = [];

    const current = new Date(start);
    while (current <= end) {
        dates.push(formatDate(current));
        current.setDate(current.getDate() + 1);
    }

    return dates;
}

// Export for use by display module
export function getActiveFiles() {
    return activeFiles;
}

export function getActiveFileCount() {
    return activeFiles.length;
}

export function getActiveFile(index) {
    return activeFiles[index];
}

export function hasFile(fileName) {
    return dataStore.has(fileName);
}

export function getFile(fileName) {
    return dataStore.get(fileName);
}

export function getCurrentFrameTimestamp() {
    return state.currentFrameTime;
}

// Clear MRMS data
document.addEventListener('mrms-clear', () => {
    activeFiles = [];
    dataStore.clear();
    state.product = null;
    state.startTime = null;
    state.endTime = null;
});
