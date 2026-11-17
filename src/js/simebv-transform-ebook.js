import { safeCSSString } from './simebv-utils.js'

const MIME = {
    XHTML: 'application/xhtml+xml',
    HTML: 'text/html',
    XML: 'application/xml',
    XML_TEXT: 'text/xml',
    SVG: 'image/svg+xml',
}
// foliate-js is lenient in the media types that it accepts
// so I can't just make a simple comparison of the raw strings
const mimeEssence = type => typeof type === 'string'
    ? type.split(';')[0].trim().toLowerCase() : ''
const isXMLType = type => type === MIME.XML || type === MIME.XML_TEXT
    || (type.endsWith('+xml') && type !== MIME.XHTML)
const isSniffed = type => !/^[\w!#$%&'*+.^`|~-]+\/[\w!#$%&'*+.^`|~-]+$/.test(type)
    || ['unknown/unknown', 'application/unknown', '*/*'].includes(type)
// foliate passes types it doesn't recognize as a Blob (EPUB) or a Uint8Array (KF8)
const toText = data => typeof data === 'string' ? data : new Response(data).text()

export function transformDoc(detail, options, defaultFontSize) {
    const { filterEbookContent, allowJS, useMathStyles } = options
    const type = mimeEssence(detail.type)
    if (isSniffed(type)) {
        detail.type = 'application/octet-stream'
    }
    return Promise
        .resolve(detail.data)
        .then(data => typeof filterEbookContent === 'function' ? filterEbookContent(data) : data)
        .then(async data => {
            const ops = new Map()
            if (type === MIME.XHTML || type === MIME.HTML) {
                if (!allowJS) {
                    ops.set('addCSPMeta', [])
                }
                if (['fonts', 'styles', 'all'].includes(useMathStyles)) {
                    ops.set('useMathStyles', [useMathStyles])
                }
                ops.set('convertFontSizePxToRem', [defaultFontSize])
                return applyTransform(await toText(data), type, ops)
            }
            if (isXMLType(type)) {
                if (allowJS) return data
                ops.set('sanitizeXML', [])
                return applyTransform(await toText(data), type, ops)
            }
            if (type === 'text/css') {
                return convertFontSizePxToRem(await toText(data), defaultFontSize)
            }
            return data
        })
        .catch(e => {
            console.error(new Error(`Failed to load ${detail.name}`, { cause: e }))
            return ''
        })
}

export function applyTransform(data, type, ops) {
    // the parser allows only five specific media types (html, xhtml, svg, 2 xml)
    const acceptedTypes = Object.values(MIME)
    try {
        let doc
        typeof data === 'string'
            ? doc = new DOMParser().parseFromString(data, acceptedTypes.includes(type) ? type : 'application/xml')
            : doc = data
        for (const [op, args] of ops.entries()) {
            switch (op) {
                case 'addCSPMeta':
                    addCSPMeta(doc)
                    break
                case 'sanitizeXML':
                    sanitizeXML(doc)
                    break
                case 'useMathStyles':
                    useMathStyles(doc, args[0])
                    break
            }
        }
        if (ops.has('convertFontSizePxToRem')) {
            const fontSize = ops.get('convertFontSizePxToRem')[0]
            doc.querySelectorAll('style')
                .forEach(s => s.textContent = convertFontSizePxToRem(
                    s.textContent, fontSize)
                )
        }
        return serializeDocument(doc)
    }
    catch (e) { console.error(e) }
    return data
}

// serializes what precedes the root (doctype, processing instructions
// like xml-stylesheet that can be used in svg files, comment), but skips
// the xml declaration (the blob built by foliate-js is always utf-8,
// a different declared encoding can cause issues)
function serializeDocument(doc) {
    const serializer = new XMLSerializer()
    let result = ''
    for (const node of doc.childNodes) {
        if (node === doc.documentElement) return result + node.outerHTML
        result += serializer.serializeToString(node) + '\n'
    }
    throw new Error('Document without root element')
}

function addCSPMeta(doc) {
    const meta = doc.createElement('meta')
    meta.setAttribute('http-equiv', 'content-security-policy')
    meta.setAttribute('content', "script-src 'none'; script-src-attr 'none'; script-src-elem 'none'")
    meta.setAttribute('data-simebv-inject', 'true')
    doc.head ? doc.head.prepend(meta) : doc.documentElement.prepend(meta)
}

function sanitizeXML(doc) {
    const XHTML_NS = 'http://www.w3.org/1999/xhtml'
    for (const el of [...doc.getElementsByTagName('*')]) {
        const name = el.localName
        if (name === 'script') {
            // replace instead of remove to not mess up the epubcfis
            el.replaceWith(doc.createElement('style'))
            continue
        }
        // SMIL can set attributes at runtime, e.g. href="javascript:...":
        // without attributeName the animation has no target
        if ((name === 'set' || name === 'animate')
            && /^(?:on|(?:\w+:)?href$)/i.test(el.getAttribute('attributeName') ?? '')) {
            el.removeAttribute('attributeName')
        }
        if (el.namespaceURI === XHTML_NS && (name === 'iframe' || name === 'frame')) {
            el.removeAttribute('srcdoc')
        }
        for (const attr of [...el.attributes]) {
            const n = attr.localName.toLowerCase()
            if (n.startsWith('on')) el.removeAttributeNode(attr)
            else if (['href', 'src', 'action', 'formaction', 'data'].includes(n)) {
                let protocol
                try { protocol = new URL(attr.value, 'https://invalid.invalid/').protocol } catch {}
                if (protocol === 'javascript:') el.removeAttributeNode(attr)
            }
        }
    }
}

// TODO: reconsider usage of a custom version of MathJax
function injectMathJax(doc, url, config) {
    const scriptConfig = doc.createElement('script')
    scriptConfig.textContent = config
    const script = doc.createElement('script')
    script.setAttribute('defer', 'true')
    script.src = url
    doc.head
        ? doc.head.append(scriptConfig, script)
        : doc.documentElement.prepend(scriptConfig, script)
}

export function convertFontSizePxToRem(data, defaultSize) {
    return data.replace(
        /(?<=[{\s;])font-size:\s*([0-9]*\.?[0-9]+)px/gi,
        (match, p1, offset, string) => {
            const n = parseFloat(p1)
            return 'font-size:' + (Math.round((n / defaultSize) * 1000) / 1000) + 'rem'
        })
}

import latinModernMath from "../../resources/fonts/latinmodern/latinmodern-math.woff2?url"
import latinModernRomanRegular from "../../resources/fonts/latinmodern/lmroman10-regular.woff2?url"
import latinModernRomanBold from "../../resources/fonts/latinmodern/lmroman10-bold.woff2?url"
import latinModernRomanItalic from "../../resources/fonts/latinmodern/lmroman10-italic.woff2?url"
import latinModernRomanBoldItalic from "../../resources/fonts/latinmodern/lmroman10-bolditalic.woff2?url"
const mathNamespaceCSS = `
@namespace m url("http://www.w3.org/1998/Math/MathML");
`
const mathFontsCSS = `
/* The WOFF fonts have been converted from the OTF ones
obtained from http://www.gust.org.pl/projects/e-foundry/.
Stylesheet inspired by https://github.com/fred-wang/MathFonts
by Frédéric Wang Nélar */
@font-face {
    font-family: LMRoman10;
    src: url("${latinModernRomanRegular}") format("woff2");
}
@font-face {
    font-family: LMRoman10;
    src: url("${latinModernRomanBold}") format("woff2");
    font-weight: bold;
}
@font-face {
    font-family: LMRoman10;
    src: url("${latinModernRomanItalic}") format("woff2");
    font-style: italic;
}
@font-face {
    font-family: LMRoman10;
    src: url("${latinModernRomanBoldItalic}") format("woff2");
    font-weight: bold;
    font-style: italic;
}
@font-face {
    font-family: "Latin Modern Math";
    src: local("Latin Modern Math"), local("LatinModernMath-Regular"),
         url("${latinModernMath}") format("woff2");
}
m|mtext {
    font-family: "Latin Modern Roman", LatinModernRoman, LMRoman10;
}
m|math {
    font-family: "Latin Modern Math";
}
`
const mathStylesCSS = `
/* From https://stackoverflow.com/questions/13916177/how-to-line-break-in-mathml#answer-77954155
answer by Sámal Rasmussen */
m|math:not([display="block"]) {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: left;
    gap: 3px;
}
`
const supportsMathMLLineBreaks = (function() {
    const div = document.createElement('div')
    div.style.cssText = 'color: rgba(0, 0, 0, 0); border: none; background-color: transparent; font-size: 12px; position: absolute; width: 100px;'
    div.innerHTML = `<math display="block">
        <mn>100</mn><mo>+</mo>
        <mn>200</mn><mo>+</mo>
        <mn>300</mn><mo>+</mo>
        <mn>400</mn><mo>+</mo>
        <mn>500</mn><mo>+</mo>
    </math>`
    document.body.appendChild(div)
    const m = div.querySelector('math')
    const linesHeight = m.getBoundingClientRect().height
    div.style.width = '10000px'
    const singleLineHeight = m.getBoundingClientRect().height
    document.body.removeChild(div)
    return linesHeight > singleLineHeight;
})();

function useMathStyles(doc, what) {
    let mathElems = doc.body?.getElementsByTagNameNS('http://www.w3.org/1998/Math/MathML', 'math')
    if (mathElems?.length) {
        let styleText = mathNamespaceCSS
        if (['fonts', 'all'].includes(what)) {
            styleText += mathFontsCSS
        }
        if (['styles', 'all'].includes(what)) {
            for (const math of mathElems) {
                if (math.getAttribute('display') === 'block'
                        || (math.children.length === 1 && math.firstElementChild.tagName.toLowerCase() === 'mtable')) {
                    if (math.closest('[data-simebv-math-style]')) {
                        continue
                    }
                    let el = math.closest('table, p')
                    if (!el) {
                        el = math
                    }
                    const div = document.createElement('div')
                    div.setAttribute('data-simebv-math-style', 'true')
                    div.setAttribute('data-simebv-skip', 'true')
                    div.style.width = '100%'
                    div.style.overflowX = 'auto'
                    div.style.overflowY = 'hidden'
                    div.style.paddingBlock = '2px'
                    el.replaceWith(div)
                    div.append(el)
                }
            }
            if (!supportsMathMLLineBreaks) {
                styleText += mathStylesCSS
            }
        }
        const style = doc.createElement('style')
        style.textContent = styleText
        doc.head.append(style)
    }
}


import openDyslexicRegular from "../../resources/fonts/opendyslexic/OpenDyslexic-Regular.woff2?url"
import openDyslexicBold from "../../resources/fonts/opendyslexic/OpenDyslexic-Bold.woff2?url"
import openDyslexicItalic from "../../resources/fonts/opendyslexic/OpenDyslexic-Italic.woff2?url"
import openDyslexicBoldItalic from "../../resources/fonts/opendyslexic/OpenDyslexic-BoldItalic.woff2?url"

export const defaultStyles = Object.freeze({
    spacing: 1.4,
    textAlign: 'justify',
    hyphenate: 'auto',
    fontSize: 18,
    colorScheme: 'light dark',
    bgColor: 'transparent',
    forcedColorScheme: '',
    fontFamily: 'auto',
    popupNotes: true,
})

const fontFamilyKeywords = new Set([
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
    'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math',
    'fangsong', 'inherit', 'initial', 'revert', 'revert-layer', 'unset',
])

// CSS to inject in iframe of reflowable ebooks
export const getCSS = (values) => {
    let {
        spacing, textAlign, hyphenate, fontSize, colorScheme,
        bgColor, forcedColorScheme, fontFamily, popupNotes
    } = values
    spacing = safeCSSString(spacing) ?? defaultStyles.spacing
    textAlign = safeCSSString(textAlign) ?? defaultStyles.textAlign
    hyphenate = safeCSSString(hyphenate) ?? defaultStyles.hyphenate
    fontSize = safeCSSString(fontSize) ?? defaultStyles.fontSize
    colorScheme = safeCSSString(colorScheme) ?? defaultStyles.colorScheme
    bgColor = safeCSSString(bgColor) ?? defaultStyles.bgColor
    forcedColorScheme = safeCSSString(forcedColorScheme) ?? defaultStyles.forcedColorScheme
    if (['auto', 'undefined'].includes(fontFamily)) {
        fontFamily = ''
    }
    if (fontFamily && !fontFamilyKeywords.has(fontFamily)) {
        fontFamily = safeCSSString(fontFamily, true) ?? ''
    }

    return `
    @namespace epub "http://www.idpf.org/2007/ops";
    :root {
        color-scheme: ${colorScheme} !important;
        font-size: ${fontSize}px;
        background-color: ${bgColor};
        -webkit-text-size-adjust: 100%;
    }
    ${spacing === '0'
        ? ':where(:root) { line-height: 1.4; }'
        : '* { line-height: ' + spacing + ' !important; }'
    }
    /* https://github.com/whatwg/html/issues/5426 */
    @media all and (prefers-color-scheme: dark) {
        a:link {
            color: ${colorScheme.includes('dark') ? 'lightblue' : 'LinkText'};
        }
        ${colorScheme.includes('dark')
          ? 'a:visited { color: VisitedText; }'
          : ''
        }
        ${!colorScheme.includes('dark')
            ? '[epub|type~="se:image.color-depth.black-on-transparent"] { filter: none !important; }'
            : ''
        }
    }
    ${forcedColorScheme.includes('dark')
        ? 'body, body * { color: #ffffff !important; background-color: ' + bgColor + ' !important; border-color: #ffffff !important; }'
        : ''
    }
    ${forcedColorScheme.includes('light')
        ? 'body, body * { color: #000000 !important; background-color: ' + bgColor + ' !important; border-color: #000000 !important; }'
        : ''
    }
    @font-face {
        font-family: "OpenDyslexic";
        src:
            local("OpenDyslexic"),
            local("OpenDyslexic-Regular"),
            local("OpenDyslexic Regular"),
            url("${openDyslexicRegular}") format("woff2");
    }
    @font-face {
        font-family: "OpenDyslexic";
        src:
            local("OpenDyslexic-Bold"),
            local("OpenDyslexic Bold"),
            url("${openDyslexicBold}") format("woff2");
        font-weight: bold;
    }
    @font-face {
        font-family: "OpenDyslexic";
        src:
            local("OpenDyslexic-Italic"),
            local("OpenDyslexic Italic"),
            url("${openDyslexicItalic}") format("woff2");
        font-style: italic;
    }
    @font-face {
        font-family: "OpenDyslexic";
        src:
            local("OpenDyslexic-BoldItalic"),
            local("OpenDyslexic Bold Italic"),
            url("${openDyslexicBoldItalic}") format("woff2");
        font-style: italic;
        font-weight: bold;
    }
    ${fontFamily
        ? 'body, body :not(math):not(math *) { font-family: ' + fontFamily + ' !important; }'
        : ''
    }
    ${textAlign === 'auto'
        ? ':where(p, li, blockquote, dt, dd, td, figure, h1, h2, h3, h4, h5, h6, pre) { text-align: justify; }'
        : 'p, li, blockquote, dt, dd, td, figure, h1, h2, h3, h4, h5, h6, pre { text-align: ' + textAlign + ' !important; }'
    }
    ${hyphenate === 'auto'
        ? `:where(p, li, blockquote, dt, dd, td, figcaption, h1, h2, h3, h4, h5, h6, pre) {
            -webkit-hyphens: auto;
            hyphens: auto;`
        : `p, li, blockquote, dt, dd, td, figcaption, h1, h2, h3, h4, h5, h6, pre {
            -webkit-hyphens: ` + (hyphenate === 'yes' ? 'auto' : 'manual') + ` !important;
            hyphens: ` + (hyphenate === 'yes' ? 'auto' : 'manual') + ' !important;'
    }
        -webkit-hyphenate-limit-before: 3;
        -webkit-hyphenate-limit-after: 2;
        -webkit-hyphenate-limit-lines: 2;
        hanging-punctuation: allow-end last;
        widows: 2;
    }
    /* do not override the align attribute in case textAlign === 'auto' */
    [align="left"] { text-align: left; }
    [align="right"] { text-align: right; }
    [align="center"] { text-align: center; }
    [align="justify"] { text-align: justify; }

    pre {
        white-space: pre-wrap !important;
    }
    ${popupNotes
        ? `
    aside[epub|type~="endnote"],
    aside[epub|type~="footnote"],
    aside[epub|type~="note"],
    aside[epub|type~="rearnote"] {
        display: none;
    }`
        : ''
    }
    a:focus {
        text-decoration: underline dotted .1em;
    }
`
}
