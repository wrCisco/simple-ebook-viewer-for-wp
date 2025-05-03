// vite.config.js
import { defineConfig } from 'vite'
import { v4wp } from '@kucrut/vite-for-wp';

export default defineConfig({
    plugins: [
        v4wp( {
            input: {
                'simebv-viewer-lib': 'src/js/simebv-viewer.js',
            },
            outDir: 'dist',
        } ),
    ],
    server: {
        cors: {
            origin: [
                /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/,
                /^https?:\/\/(?:www\.)?embedebooks-wp\.it/,
            ],
        },
        origin: 'http://www.embedebooks-wp.it',
    },
    esbuild: {
        supported: {
            'top-level-await': true,
        },
    },
    build: {
        minify: true,
        sourceMap: false,
        manifest: true
    },
});