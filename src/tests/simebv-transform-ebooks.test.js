import { expect, test, describe } from 'vitest'
import { transformDoc } from '../js/simebv-transform-ebook.js'

const transformCSS = (css, allowRemoteResources = false) => transformDoc(
    { data: css, type: 'text/css', name: 'test.css' },
    { allowJS: false, allowRemoteResources },
    16,
)

describe('Remote resources are removed from CSS (stripRemoteCSS through transformDoc)', () => {
    test.for([
        ['a { background: url(http://example.com/a.png) }', 'a { background: url(about:invalid) }'],
        ['a { background: url("https://example.com/a.png") }', 'a { background: url(about:invalid) }'],
        ["a { background: url( 'https://example.com/a.png' ) }", 'a { background: url(about:invalid) }'],
        ['a { background: URL(//example.com/a.png) }', 'a { background: url(about:invalid) }'],
        ['a { background: url("HTTPS://example.com/a b.png") }', 'a { background: url(about:invalid) }'],
        ['a { background: url(http://example.com/a.png), url(b.png) }', 'a { background: url(about:invalid), url(b.png) }'],
        ['@import "https://example.com/a.css";', '@import "about:invalid";'],
        ["@import'//example.com/a.css';", "@import'about:invalid';"],
        ['@import url(https://example.com/a.css) screen;', '@import url(about:invalid) screen;'],
        [
            'a { background: image-set("https://example.com/a.png" 1x, url(https://example.com/b.png) 2x) }',
            'a { background: image-set("about:invalid" 1x, url(about:invalid) 2x) }',
        ],
        [
            "a { background: -webkit-image-set('https://example.com/a.png' 1x, \"b.png\" 2x) }",
            "a { background: -webkit-image-set('about:invalid' 1x, \"b.png\" 2x) }",
        ],
        [
            'a { background: image-set("//example.com/a.avif" type("image/avif"), "b.png" type("image/png")) }',
            'a { background: image-set("about:invalid" type("image/avif"), "b.png" type("image/png")) }',
        ],
    ])('%s', async ([css, expected]) => {
        expect(await transformCSS(css)).toBe(expected)
    })
})

describe('Strings and URLs that are not fetched, or not remote, are left alone', () => {
    test.for([
        '@namespace epub "http://www.idpf.org/2007/ops";',
        "@namespace epub 'http://www.idpf.org/2007/ops';",
        '@namespace url(http://www.w3.org/1999/xhtml);',
        '@namespace svg url("http://www.w3.org/2000/svg");\nsvg|a { fill: red }',
        'a[href^="http://"] { color: red }',
        "a[href^='https://example.com'], a[href^=\"//\"] { color: red }",
        ':not(a[href="https://example.com"]) { color: red }',
        'a::after { content: "https://example.com" }',
        'a { font-family: "Some Font", serif }',
        'a { background: url(images/a.png) }',
        'a { background: url("../images/a.png") }',
        'a { background: url(data:image/png;base64,AAAA) }',
        'a { background: url("blob:http://localhost/0000-1111") }',
        '@import "local.css";',
        'a { background: image-set("a.png" 1x, "b.png" 2x) }',
    ])('%s', async css => {
        expect(await transformCSS(css)).toBe(css)
    })

    test('with allowRemoteResources nothing is removed', async () => {
        const css = '@import "https://example.com/a.css";\na { background: url(https://example.com/a.png) }'
        expect(await transformCSS(css, true)).toBe(css)
    })
})

describe('Remote resources are removed from the CSS of XML documents', () => {
    test('style elements and presentation attributes in SVG', async () => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg"><style>@namespace svg "http://www.w3.org/2000/svg";
svg|rect { fill: url(https://example.com/a.svg#g) }</style><rect fill="url('https://example.com/a.svg#g')"/></svg>`
        const result = await transformDoc(
            { data: svg, type: 'image/svg+xml', name: 'test.svg' },
            { allowJS: false, allowRemoteResources: false },
            16,
        )
        expect(result).toContain('@namespace svg "http://www.w3.org/2000/svg";')
        expect(result).toContain('svg|rect { fill: url(about:invalid) }')
        expect(result).toContain('fill="url(about:invalid)"')
        expect(result).not.toContain('example.com')
    })
})
