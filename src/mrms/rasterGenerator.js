export class RasterGenerator {
    constructor(data, width, height, colorMap = null) {
        this.canvas = new OffscreenCanvas(width, height);
        this.ctx = this.canvas.getContext('2d');

        this.data = data;
        this.width = width;
        this.height = height;
        this.colorMap = colorMap;
    }

    getColor(value) {
        for (const entry of this.colorMap) {
            if (value >= entry.min && value < entry.max) {
                return entry.rgba;
            }
        }
        return [0, 0, 0, 0];
    }

    drawRaster() {
        const imageData = this.ctx.createImageData(this.width, this.height);

        for (let i = 0; i < this.data.length; i++) {
            const value = this.data[i];
            const j = i * 4;

            if (this.colorMap) {
                const [r, g, b, a] = this.getColor(value);
                imageData.data[j] = r;
                imageData.data[j + 1] = g;
                imageData.data[j + 2] = b;
                imageData.data[j + 3] = a;
            } else {
                const normalized = Math.max(0, Math.min(1, (value - 0) / (100 - 0)));
                const grayscale = Math.floor((1 - normalized) * 255);
                imageData.data[j] = grayscale;
                imageData.data[j + 1] = grayscale;
                imageData.data[j + 2] = grayscale;
                imageData.data[j + 3] = 255;
            }
        }

        this.ctx.putImageData(imageData, 0, 0);
    }

    async toBlob() {
        this.drawRaster();
        return await this.canvas.convertToBlob({ type: 'image/png' });
    }

    async generateUrl() {
        const blob = await this.toBlob();
        return URL.createObjectURL(blob);
    }
}
