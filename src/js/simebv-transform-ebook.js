import { safeCSSString } from './simebv-utils.js'

export function transformDoc(detail, options, defaultFontSize) {
    const { filterEbookContent, allowJS, useMathStyles } = options
    return Promise
        .resolve(detail.data)
        .then(data => typeof filterEbookContent === 'function' ? filterEbookContent(data) : data)
        .then(data => {
            const ops = new Map()
            switch(detail.type) {
                case 'application/xhtml+xml':
                case 'text/html':
                    if (!allowJS) {
                        ops.set('addCSPMeta', [])
                    }
                    if (['fonts', 'styles', 'all'].includes(useMathStyles)) {
                        ops.set('useMathStyles', [useMathStyles])
                    }
                    ops.set('convertFontSizePxToRem', [defaultFontSize])
                    if (ops.size > 0) {
                        data = applyTransform(data, detail.type, ops)
                    }
                    return data
                case 'image/svg+xml':
                case 'application/xml':
                    if (!allowJS) {
                        ops.set('removeInlineScripts', [])
                    }
                    if (ops.size > 0) {
                        data = applyTransform(data, detail.type, ops)
                    }
                    return data
                case 'text/css':
                    return convertFontSizePxToRem(data, defaultFontSize)
                default:
                    return data
            }
        })
        .catch(e => {
            console.error(new Error(`Failed to load ${detail.name}`, { cause: e }))
            return ''
        })
}

export function applyTransform(data, type, ops) {
    try {
        let doc
        typeof data === 'string'
            ? doc = new DOMParser().parseFromString(data, type)
            : doc = data
        for (const [op, args] of ops.entries()) {
            switch (op) {
                case 'addCSPMeta':
                    addCSPMeta(doc)
                    break
                case 'removeInlineScripts':
                    removeInlineScripts(doc)
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
        return doc.documentElement.outerHTML
    }
    catch (e) { console.error(e) }
    return data
}

function addCSPMeta(doc) {
    const meta = doc.createElement('meta')
    meta.setAttribute('http-equiv', 'content-security-policy')
    meta.setAttribute('content', "script-src 'none'; script-src-attr 'none'; script-src-elem 'none'")
    meta.setAttribute('data-simebv-inject', 'true')
    doc.head ? doc.head.prepend(meta) : doc.documentElement.prepend(meta)
}

function removeInlineScripts(doc) {
    doc.querySelectorAll('script').forEach(el => el.replaceWith(doc.createElement('style')))
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
                if (math.getAttribute('display') === 'block') {
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
    justify: true,
    hyphenate: true,
    fontSize: 1,
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
        spacing, justify, hyphenate, fontSize, colorScheme,
        bgColor, forcedColorScheme, fontFamily, popupNotes
    } = values
    spacing = safeCSSString(spacing) ?? defaultStyles.spacing
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
    p, li, blockquote, dd {
        line-height: ${spacing};
        text-align: ${justify ? 'justify' : 'start'};
        -webkit-hyphens: ${hyphenate ? 'auto' : 'manual'};
        hyphens: ${hyphenate ? 'auto' : 'manual'};
        -webkit-hyphenate-limit-before: 3;
        -webkit-hyphenate-limit-after: 2;
        -webkit-hyphenate-limit-lines: 2;
        hanging-punctuation: allow-end last;
        widows: 2;
    }
    /* prevent the above from overriding the align attribute */
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
