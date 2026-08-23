// vite.config.js
import { defineConfig } from 'vite'
import { v4wp } from '@kucrut/vite-for-wp';
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { readFileSync } from 'node:fs'

const version = readFileSync('./simple-ebook-viewer.php', 'utf-8')
    .match(/define\s*\(\s*(['"])SIMEBV_VERSION\1\s*,\s*(['"])([^'"]+)\2/)[3];

const bustImports = {
    name: 'bust-imports',
    renderChunk(code) {
        return code.replace(
            /((?:\bfrom\s*|\bimport\s*\(?\s*))(["'])(\.{1,2}\/[^"'?]+\.js)\2/g,
            `$1$2$3?ver=${version}$2`,
        );
    },
};

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
        bustImports,
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
                chunkFileNames: "assets/[name].js",
                assetFileNames: "assets/[name].[hash].[ext]",
            },
            preserveEntrySignatures: "strict",
        },
        commonjsOptions: {
            ignoreDynamicRequires: true,  // required by sre v5.0.0-rc4
        },
    },
});