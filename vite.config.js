// vite.config.js
import { defineConfig } from 'vite'
import { v4wp } from '@kucrut/vite-for-wp';
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
    plugins: [
        v4wp( {
            input: {
                'simebv-viewer-lib': 'src/js/simebv-viewer.js',
                'simebv-viewer-init': 'src/js/simebv-init.js',
            },
            outDir: 'dist',
        } ),
        nodePolyfills({
            include: ['fs', 'http', 'https'],
        }),
    ],
    esbuild: {
        minifyIdentifiers: false,
        keepNames: true,
    },
    build: {
        minify: true,
        sourcemap: false,
        manifest: true,
        rollupOptions: {
            output: {
                entryFileNames: "[name].js",
            },
            preserveEntrySignatures: "strict",
        },
    },
});