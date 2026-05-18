// https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API#testing_for_availability
export function storageAvailable(type) {
    let storage;
    try {
        storage = window[type];
        const x = "__storage_test__";
        storage.setItem(x, x);
        storage.removeItem(x);
        return true;
    } catch (e) {
        return (
            e instanceof DOMException &&
            e.name === "QuotaExceededError" &&
            // acknowledge QuotaExceededError only if there's something already stored
            storage &&
            storage.length !== 0
        );
    }
}

export const pluginBaseUrl = () => {
    return new URL(/* @vite-ignore */'../../', import.meta.url).href
}

export function isAndroid() {
    return navigator.userAgentData?.platform === 'Android' || /Android/i.test(navigator.userAgent)
}

export function isWindows() {
    return navigator.userAgentData?.platform === 'Windows' || /Windows|Win32|Win64|WOW64/i.test(navigator.userAgent)
}

export function isFirefoxOnLinuxOrBSD() {
    const ua = navigator.userAgent
    return /Firefox\/\d+/.test(ua) && /Linux|X11|FreeBSD|OpenBSD(?!.*CrOS)/.test(ua) && !/Android/.test(ua)
}

export function isElementWritable(el) {
    return el?.matches('input:is(:not([type]),[type=text],[type=email],[type=number],[type=password],[type=search],[type=tel],[type=time],[type=month],[type=date],[type=datetime-local],[type=url]),textarea') || el?.isContentEditable
}

export function getColorScheme(elem) {
    const probe = document.createElement('span')
    probe.style.cssText = `
        position: absolute;
        width: 0; height: 0;
        visibility: hidden;
        color: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));
    `
    elem.append(probe)
    const color = globalThis.getComputedStyle(probe).color
    const scheme = color === 'rgb(255, 255, 255)' ? 'dark' : 'light'
    probe.remove()
    return scheme
}

export function isNumeric(v) {
    return parseFloat(v) === Number(v)
}

export function getLang(el) {
    while (el) {
        const lang = el.lang || el.getAttributeNS?.('http://www.w3.org/XML/1998/namespace', 'lang')
        if (lang) {
            return lang
        }
        el = el.parentElement
    }
}

export function getDefaultFontSize(root) {
    const fake = document.createElement('div')
    fake.style.visibility = 'hidden'
    fake.style.position = 'absolute'
    fake.style.fontSize = '1rem'
    root.append(fake)
    const computedFontSize = parseFloat(globalThis.getComputedStyle(fake).fontSize)
    fake.remove()
    return isNaN(computedFontSize) ? 16 : computedFontSize
}

/**
 * Sanitizes the input string for safe use as a CSS property
 * value (e.g., a font-family name, or a color).
 *
 * It uses a somewhat draconian approach, removing all
 * the characters that are not letters, numbers, simple spaces,
 * or a selected set of punctuation characters,
 * ( /%:.#()_- ), so its use is limited to specific values.
 *
 * @param {string} input - string to sanitize.
 * @returns {string} A quoted and sanitized value.
 */
export function sanitizeCSSString(input) {
  const cleaned = input
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} /%:.#()_-]/gu, '')
  return `"${cleaned}"`
}

/**
 * Tests the safety of a string that have to be inserted
 * in a CSS as a property value (e.g. a font-family name
 * or a color).
 *
 * It admits any letter or number, the simple white space
 * and a selected set of punctuation characters (/%:.#()_-).
 * If the input string contains any other character,
 * the function returns null, otherwise it returns
 * the canonical normalized unicode form of the input,
 * optionally surrounded by double quotes.
 *
 * @param {string} input - string to check for safety.
 * @param {boolean} [quotes=false] - if true, the input will be returned surrounded by double quotes ("${input}").
 * @returns {(string|null)} The normalized string if it contains allowed characters only, null otherwise.
 */
export function safeCSSString(input, quotes=false) {
    if (isNumeric(input)) { input = input.toString() }
    const cleaned = input.normalize('NFC')
    if (!/^[\p{L}\p{N} /%:.#()_-]*$/u.test(cleaned)) {
        return null
    }
    return quotes ? `"${cleaned}"` : cleaned
}

const NS = {
    SVG: 'http://www.w3.org/2000/svg',
    XHTML: 'http://www.w3.org/1999/xhtml'
}

export function pageListOutline(rects, options = {}) {
    const { color = 'red', width: strokeWidth = 2, radius = 3, label = '', fontSize = 16 } = options
    const g = document.createElementNS(NS.SVG, 'g')
    g.setAttribute('fill', 'none')
    g.setAttribute('stroke', color)
    g.setAttribute('stroke-width', strokeWidth)
    let rect
    for (let i = 0; i < rects.length; i++) {
        if (rects[i].height) {
            rect = rects[i]
            break
        }
    }
    if (rect) {
        const { left, top, height, width } = rect
        const pathHeight = Math.min(height, fontSize * 1.7)
        const el = document.createElementNS(NS.SVG, 'path')
        el.setAttribute('d', `M ${Math.max(0, left - 1)},${top + pathHeight} v ${-pathHeight}`)// l 6 -3`)
        el.style.opacity = 'var(--overlayer-highlight-opacity, .8)'
        el.style.mixBlendMode = 'var(--overlayer-highlight-blend-mode, normal)'
        g.append(el)
        g.onclick = () => {}  // for single tap opening on iOS
    }
    return g
}

export function searchResultsHighlight(rects, options = {}) {
    const { color = 'red', opacity = .3, mixBlendMode = 'normal', invert = false } = options
    const g = document.createElementNS(NS.SVG, 'g')
    g.setAttribute('fill', color)
    g.style.opacity = opacity
    g.style.mixBlendMode = mixBlendMode
    const foreigns = []
    for (const { left, top, height, width } of rects) {
        const el = document.createElementNS(NS.SVG, 'rect')
        el.setAttribute('x', left)
        el.setAttribute('y', top)
        el.setAttribute('height', height)
        el.setAttribute('width', width)
        if (invert) {
            const foreign = document.createElementNS(NS.SVG, 'foreignObject')
            foreign.setAttribute('x', left)
            foreign.setAttribute('y', top)
            foreign.setAttribute('width', width)
            foreign.setAttribute('height', height)
            const foreignDiv = document.createElementNS(NS.XHTML, 'div')
            foreignDiv.style.cssText=`width:${width}px;height:${height}px;backdrop-filter:invert(1) hue-rotate(180deg);`
            foreign.append(foreignDiv)
            foreigns.push(foreign)
        }
        g.append(el)
    }
    foreigns.forEach(f => g.append(f))
    return g
}

export function cfiFilter(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return NodeFilter.FILTER_ACCEPT
    }
    if (node.matches('[data-simebv-inject]')) {
        return NodeFilter.FILTER_REJECT
    }
    if (node.matches('[data-simebv-skip]')) {
        return NodeFilter.FILTER_SKIP
    }
    return NodeFilter.FILTER_ACCEPT
}
