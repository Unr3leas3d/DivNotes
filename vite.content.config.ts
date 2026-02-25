import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Separate build config for content script (must be IIFE, no ES imports)
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: false, // Don't clear main build output
        lib: {
            entry: resolve(__dirname, 'src/content/index.tsx'),
            name: 'DivNotesContent',
            formats: ['iife'],
            fileName: () => 'content/content.js',
        },
        rollupOptions: {
            output: {
                globals: {},
                // Ensure everything is inlined
                inlineDynamicImports: true,
            },
        },
    },
    define: {
        'process.env.NODE_ENV': '"production"',
    },
});
