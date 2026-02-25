import { defineConfig } from 'vite';
import { resolve } from 'path';

// Separate build config for service worker (must be self-contained)
export default defineConfig({
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: false,
        lib: {
            entry: resolve(__dirname, 'src/background/service-worker.ts'),
            name: 'DivNotesServiceWorker',
            formats: ['iife'],
            fileName: () => 'background/service-worker.js',
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            },
        },
    },
});
