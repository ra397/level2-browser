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