import { defineConfig, mergeConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import viteConfig from './vite.config'

// vendor/foliate-js/pdf.js loads the worker, css, cmaps and fonts of pdf.js from '../vendor/pdfjs/',
// that is from dist/vendor/pdfjs, where they're copied by copy-sre-locales.js after the build.
// In the tests, vite replaces import.meta.url with self.location in that new URL() (it has
// @vite-ignore), and the tests run in a page at the root of the server, so the url is
// /vendor/pdfjs/: there the files are served from their source directory, as they are
const pdfjsDir = fileURLToPath(new URL('./vendor/foliate-js/vendor/pdfjs', import.meta.url))
const contentTypes = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css' }
const servePdfjs = {
    name: 'serve-pdfjs',
    configureServer(server) {
        server.middlewares.use('/vendor/pdfjs', (req, res, next) => {
            const file = join(pdfjsDir, decodeURIComponent(new URL(req.url, 'http://localhost').pathname))
            if (!file.startsWith(pdfjsDir + sep) || !existsSync(file) || !statSync(file).isFile()) return next()
            res.setHeader('Content-Type', contentTypes[extname(file)] ?? 'application/octet-stream')
            createReadStream(file).pipe(res)
        })
    },
}

export default mergeConfig(viteConfig, defineConfig({
    plugins: [servePdfjs],
    test: {
        browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            // https://vitest.dev/config/browser/playwright
            instances: [
                { browser: 'chromium' },
                { browser: 'firefox' },
                { browser: 'webkit' },
            ],
        },
    },
}))
