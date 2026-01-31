import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
    base: './',
    plugins: [process.env.VITE_SINGLEFILE ? viteSingleFile() : null].filter(Boolean),
    build: {
        target: 'esnext',
        assetsInlineLimit: 1000000, // Inline everything (icon is ~422KB)
        chunkSizeWarningLimit: 1000,
    },
    esbuild: {
        // Strip console.log and console.warn in production builds
        drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    },
});
