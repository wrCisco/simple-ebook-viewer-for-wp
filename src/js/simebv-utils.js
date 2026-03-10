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

export function isNumeric(v) {
    return parseFloat(v) === Number(v)
}

export function getLang(el) {
    while (el) {
        if (el.hasAttribute('lang')) {
            return el.getAttribute('lang')
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


export function pageListOutline(rects, options = {}) {
    const { color = 'red', width: strokeWidth = 2, radius = 3, label = '', fontSize = 16 } = options
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
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
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        el.setAttribute('d', `M ${Math.max(0, left - 1)},${top + pathHeight} v ${-pathHeight}`)// l 6 -3`)
        el.style.opacity = 'var(--overlayer-highlight-opacity, .8)'
        el.style.mixBlendMode = 'var(--overlayer-highlight-blend-mode, normal)'
        g.append(el)
        g.onclick = () => {}  // for single tap opening on iOS
    }
    return g
}
