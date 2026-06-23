import { defineConfig } from 'vite';

export default defineConfig({
    base: '/nexrad-l2/',
    server: {
        proxy: {
            '/mrms-stats': {
                target: 'https://visualriver.net',
                changeOrigin: true,
                secure: false,
            }
        }
    }
});