import { safeCSSString } from './simebv-utils.js'

export function transformDoc(data, type, ops) {
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
                case 'injectMathJax':
                    injectMathJax(doc, ...args)
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
})

const fontFamilyKeywords = new Set([
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
    'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math',
    'fangsong', 'inherit', 'initial', 'revert', 'revert-layer', 'unset',
])

// CSS to inject in iframe of reflowable ebooks
export const getCSS = (values) => {
    let {
        spacing, justify, hyphenate,
        fontSize, colorScheme, bgColor,
        forcedColorScheme, fontFamily
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
    aside[epub|type~="endnote"],
    aside[epub|type~="footnote"],
    aside[epub|type~="note"],
    aside[epub|type~="rearnote"] {
        display: none;
    }
    a:focus {
        text-decoration: underline dotted .1em;
    }
`
}
