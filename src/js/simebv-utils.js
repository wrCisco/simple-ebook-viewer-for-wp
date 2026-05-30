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

export function scrollIntoView(element, doc, renderer) {
    const containerBBox = renderer.getBoundingClientRect()
    const elBBox = element.getBoundingClientRect()
    if (elBBox.right > containerBBox.right
            || elBBox.left < containerBBox.left
            || elBBox.bottom > containerBBox.bottom
            || elBBox.top < containerBBox.top) {
        // TODO: investigate why this doesn't work in Firefox, it would be much simpler...
        //     element.scrollIntoView({
        //         behavior: 'instant',
        //         container: 'nearest',
        //         block: 'center',
        //         inline: contents.length > 1
        //             ? (contents[0].doc === doc ^ this.view.renderer.rtl ? 'end' : 'start')
        //             : 'center'
        //     })
        const contents = renderer.getContents()
        let inlineTo = contents.length > 1
            ? (contents[0].doc === doc ^ !renderer.rtl ? 'left' : 'right')
            : 'center'
        // let blockTo = 'center'
        // const { vertical } = getDirection(doc)
        // if (vertical) [inlineTo, blockTo] = [blockTo, inlineTo]
        const relativeLeft = renderer.scrollLeft + elBBox.left - containerBBox.left
        const relativeRight = renderer.scrollLeft + elBBox.right - containerBBox.left
        const moveInline = inlineTo === 'left'
            ? Math.min(relativeLeft - 20, renderer.scrollWidth - containerBBox.width)
            : inlineTo === 'right'
                ? Math.max(relativeRight + 20 - containerBBox.width, 0)
                : relativeLeft + Math.min(elBBox.width / 2 - containerBBox.width / 2, -10)
        const relativeTop = renderer.scrollTop + elBBox.top - containerBBox.top
        const moveBlock = Math.min(
            relativeTop + Math.min(elBBox.height / 2 - containerBBox.height / 2, -10),
            renderer.scrollHeight - containerBBox.height
        )
        renderer.scroll(moveInline, moveBlock)
    }
}

// from foliate-js/paginator.js
export function getDirection(doc) {
    const { defaultView } = doc
    const { writingMode, direction } = defaultView.getComputedStyle(doc.body)
    const vertical = writingMode === 'vertical-rl'
        || writingMode === 'vertical-lr'
    const rtl = doc.body.dir === 'rtl'
        || direction === 'rtl'
        || doc.documentElement.dir === 'rtl'
    return { vertical, rtl }
}
