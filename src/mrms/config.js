// MRMS reflectivity products and their color mappings
const decibelThresholds = [-35,-30,-25,-20,-15,-10,-5,0,5,10,15,20,25,30,35,40,45,50,55,60,65,70,75];
const decibelColors = [[221,254,255,255],[216,210,233,255],[208,175,212,255],[163,127,167,255],[115,74,119,255],[214,212,173,255],[169,168,125,255],[119,119,119,255],[0,236,236,255],[1,160,246,255],[0,0,246,255],[0,255,0,255],[0,200,0,255],[0,144,0,255],[255,255,0,255],[231,192,0,255],[255,144,0,255],[255,0,0,255],[220,0,0,255],[192,0,0,255],[255,0,255,255],[153,85,201,255]];

export const overlayInfo = {
    bbox: {
        sw: { lng: -130.004188, lat: 21.101622 },
        ne: { lng: -60.869844, lat: 52.636275 }
    },
    numCols: 1924,
    numRows: 1128,
    transparentImgSrc: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z/CfAQADgwGf6tJVEwAAAABJRU5ErkJggg==",
};

export const mrmsProducts = [
    {
        display_name: "Base Reflectivity",
        s3_name: "MergedBaseReflectivity_00.50",
        thresholds: decibelThresholds,
        defaultColors: decibelColors,
        units: "dBZ"
    },
    {
        display_name: "Base Reflectivity (Quality Control)",
        s3_name: "MergedBaseReflectivityQC_00.50",
        thresholds: decibelThresholds,
        defaultColors: decibelColors,
        units: "dBZ"
    }
];

export function getProductByS3Name(s3Name) {
    return mrmsProducts.find(p => p.s3_name === s3Name);
}

export function buildColorMap(product) {
    const { thresholds, defaultColors } = product;
    const colorMap = [];

    // Below minimum threshold
    colorMap.push({
        min: -Infinity,
        max: thresholds[0],
        rgba: [0, 0, 0, 0]
    });

    // Threshold ranges
    for (let i = 0; i < thresholds.length - 1; i++) {
        colorMap.push({
            min: thresholds[i],
            max: thresholds[i + 1],
            rgba: defaultColors[i]
        });
    }

    // Above maximum threshold
    colorMap.push({
        min: thresholds[thresholds.length - 1],
        max: Infinity,
        rgba: defaultColors[defaultColors.length - 1]
    });

    return colorMap;
}

export function scaleColorMap(colorMap, referenceValue, binaryScale, decimalScale) {
    const decimalFactor = Math.pow(10, decimalScale);
    const binaryFactor = Math.pow(2, binaryScale);

    return colorMap.map(entry => ({
        min: entry.min === -Infinity ? -Infinity : (entry.min * decimalFactor - referenceValue) / binaryFactor,
        max: entry.max === Infinity ? Infinity : (entry.max * decimalFactor - referenceValue) / binaryFactor,
        rgba: entry.rgba,
    }));
}
