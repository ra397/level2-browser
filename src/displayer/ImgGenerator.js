export class ImgGenerator {
    constructor() {
        this.canvas = null;
        this.ctx = null;
    }

    /**
     * @param {Float32Array} data - Cartesian grid of values
     * @param {number} width
     * @param {number} height
     * @param {Array<{min: number, max: number, rgba: number[]}>} colorMap
     * @returns {Promise<string>}
     */
    async generateImage(data, width, height, colorMap) {
        this.canvas = new OffscreenCanvas(width, height);
        this.ctx = this.canvas.getContext('2d');

        const imageData = this.ctx.createImageData(width, height);
        const pixels = imageData.data;

        for (let i = 0; i < data.length; i++) {
            const value = data[i];
            const j = i * 4;

            const [r, g, b, a] = this._getColor(value, colorMap);
            pixels[j] = r;
            pixels[j + 1] = g;
            pixels[j + 2] = b;
            pixels[j + 3] = a;
        }

        this.ctx.putImageData(imageData, 0, 0);
        const blob = await this.canvas.convertToBlob({ type: 'image/png' });
        return URL.createObjectURL(blob);
    }

    _getColor(value, colorMap) {
        if (isNaN(value)) return [0, 0, 0, 0];

        for (const entry of colorMap) {
            if (value >= entry.min && value < entry.max) {
                return entry.rgba;
            }
        }
        return [0, 0, 0, 0];
    }
}