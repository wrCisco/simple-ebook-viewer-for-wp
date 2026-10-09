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

export function scrollMenuEntryIntoView(element, container) {
    const containerBBox = container.getBoundingClientRect()
    const elBBox = element.getBoundingClientRect()
    if (elBBox.bottom > containerBBox.bottom || elBBox.top < containerBBox.top) {
        const relativeTop = container.scrollTop + elBBox.top - containerBBox.top
        const moveBlock = Math.min(
            relativeTop + Math.min(elBBox.height / 2 - containerBBox.height / 2, -10),
            container.scrollHeight - containerBBox.height
        )
        container.scroll(0, moveBlock)
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

let requestedPersistentStorage = false
export async function requestPersistentStorage() {
    try {
        if (requestedPersistentStorage || !navigator.storage?.persist) return
        requestedPersistentStorage = true
        if (await navigator.storage.persisted()) return
        await navigator.storage.persist()
    }
    catch {}
}


// The "visually hidden" pattern clips the content to a 1px × 1px box:
// the extra half pixel absorbs the subpixel rounding
const MIN_VISIBLE_SIZE = 1.5

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/*
 * Get the bounds of the first non white-space character (grapheme cluster)
 * of a text node, at or after the offset; if there is only white space after
 * the offset, get the bounds of the character at the offset.
 * In vertical writing modes the boxes of collapsed white space have no height,
 * and in Firefox neither have those of part of a character (e.g. half a surrogate
 * pair, or a letter without its combining mark): the overlayer wouldn't draw them.
 */
function getCharacterBounds(text, offset = 0) {
    const str = text.textContent
    offset = Math.max(0, Math.min(offset, str.length - 1))
    const nonWhiteSpace = str.slice(offset).search(/\S/)
    if (nonWhiteSpace > 0) {
        offset += nonWhiteSpace
    }
    const { index, segment } = graphemeSegmenter.segment(str).containing(offset)
    return [index, index + segment.length]
}

/*
 * Check whether a text node or an element, though rendered, can't be seen,
 * like the text that some ebooks provide only for screen readers.
 * The node is considered hidden when:
 * - its 'visibility' isn't 'visible', or it or one of its ancestors has 'opacity: 0';
 * - none of its boxes is bigger than MIN_VISIBLE_SIZE, after being clipped by the
 *   'overflow' of its ancestors (e.g. 'width: 1px; height: 1px; overflow: hidden',
 *   or 'text-indent: -999em; overflow: hidden');
 * - it is, or it is inside, an absolutely positioned box placed outside the
 *   viewport of the document (e.g. 'position: absolute; left: -999em').
 *   This relies on foliate-js sizing the iframe to the whole section without ever
 *   scrolling it, so nothing outside its viewport can be displayed. It isn't
 *   applied to in-flow content, which can overflow the iframe for a while
 *   (e.g. until web fonts are loaded and the paginator expands the iframe again).
 */
export function isVisuallyHidden(node) {
    return getHiddenContent(node) !== null
}

/*
 * Return null if the node can be seen (see isVisuallyHidden), otherwise an object
 * whose `root` is the node itself, or the ancestor that hides it together with all
 * its content: the outermost box with opacity 0, the box whose overflow clips the
 * node away, or the innermost absolutely positioned box placed off-screen.
 * `root` is null when the node simply has no boxes of a visible size
 * (e.g. an empty element), so there is nothing to draw.
 */
function getHiddenContent(node) {
    const doc = node.ownerDocument
    const win = doc.defaultView
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement
    if (!el) {
        return { root: null }
    }
    if (win.getComputedStyle(el).visibility !== 'visible') {
        return { root: node }
    }
    let rects
    if (node === el) {
        rects = el.getClientRects()
    }
    else {
        const range = doc.createRange()
        range.selectNodeContents(node)
        rects = range.getClientRects()
    }
    rects = Array.from(rects, ({ left, top, right, bottom }) => ({ left, top, right, bottom }))
    const isBigEnough = r => r.right - r.left > MIN_VISIBLE_SIZE && r.bottom - r.top > MIN_VISIBLE_SIZE
    const empty = !rects.some(isBigEnough)
    let transparent = null
    let clipping = null
    let outOfFlow = null
    // an absolutely positioned box isn't clipped by the ancestors
    // between itself and its containing block
    let clips = true
    let fixed = false
    for (let a = el; a; a = a.parentElement) {
        const style = win.getComputedStyle(a)
        if (style.opacity === '0') {
            transparent = a
        }
        // the overflow of the root (and of the body) is set by the paginator
        if (fixed || a === doc.body || a === doc.documentElement) {
            continue
        }
        if (!clips && style.position !== 'static') {
            clips = true
        }
        if (clips && a !== node
                && (style.overflowX !== 'visible' || style.overflowY !== 'visible')
                && !['inline', 'contents'].includes(style.display)) {
            const box = a.getBoundingClientRect()
            for (const r of rects) {
                r.left = Math.max(r.left, box.left)
                r.top = Math.max(r.top, box.top)
                r.right = Math.min(r.right, box.right)
                r.bottom = Math.min(r.bottom, box.bottom)
            }
            if (!empty && !clipping && !rects.some(isBigEnough)) {
                clipping = a
            }
        }
        if (style.position === 'absolute' || style.position === 'fixed') {
            outOfFlow ??= a
            clips = false
            fixed = style.position === 'fixed'
        }
    }
    if (transparent) {
        return { root: transparent }
    }
    if (empty) {
        return { root: null }
    }
    if (clipping) {
        return { root: clipping }
    }
    if (outOfFlow) {
        const { innerWidth, innerHeight } = win
        const onCanvas = r => r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight
        if (!rects.some(r => isBigEnough(r) && onCanvas(r))) {
            return { root: outOfFlow }
        }
    }
    return null
}

/*
 * Try to get a range that contains at least one visible non white-space character
 * starting from the node passed as first argument. If the node is a text node,
 * it's possible to pass a second numeric argument for the text offset.
 * Elements with the style property 'display' set to 'none' will be skipped,
 * and so will the text that can't be seen (see isVisuallyHidden).
 * If the starting node contains visible text, the range selects its first visible
 * character; otherwise it goes from the starting node to the first visible character
 * that follows it. If there isn't an adequate range, use the first element following
 * the starting node as the end container of the range, and if there isn't even that,
 * use the starting node as both the start and the end container of the range.
 * The overlayer draws at the first box of the range, so:
 * - if a visible box (e.g. an image) precedes the first visible character,
 *   the range also contains the box;
 * - if hidden content precedes the first visible content (text, or a box),
 *   the range starts right after the hidden content.
 */
export function getNonEmptyRange(node, textOffset = 0) {
    const doc = node.ownerDocument
    const win = doc.defaultView
    let skippedHidden = false

    function nodeFilter(n) {
        if (n.nodeType !== Node.ELEMENT_NODE) {
            return NodeFilter.FILTER_ACCEPT
        }
        if (['script', 'noscript', 'style'].includes(n.localName)) {
            return NodeFilter.FILTER_REJECT
        }
        if (win.getComputedStyle(n).display === 'none') {
            return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
    }

    function isVisibleText(n) {
        if (n.nodeType !== Node.TEXT_NODE || !n.textContent.trim()) {
            return false
        }
        if (isVisuallyHidden(n)) {
            skippedHidden = true
            return false
        }
        return true
    }

    const range = doc.createRange()

    function selectCharacter(text, offset) {
        const [start, end] = getCharacterBounds(text, offset)
        range.setStart(text, start)
        range.setEnd(text, end)
        return range
    }

    if (isVisibleText(node)) {
        return selectCharacter(node, textOffset)
    }
    const walker = doc.createTreeWalker(
        node.getRootNode(), NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT, nodeFilter
    )
    // the end container: the first visible text, inside the starting node or after it
    let endContainer
    walker.currentNode = node
    while (walker.nextNode()) {
        const current = walker.currentNode
        if (isVisibleText(current)) {
            endContainer = current
            break
        }
    }
    const inside = !!endContainer && node.contains(endContainer)

    // A visible box (e.g. an image) that precedes the end container is what the
    // overlayer will draw, so the range must contain it entirely; the hidden content
    // that precedes the first visible content must stay out of the range instead
    let hiddenRoot = null
    let firstVisible = endContainer
    if (inside || skippedHidden) {
        hiddenRoot = getHiddenContent(node)?.root ?? null
        firstVisible = undefined
        walker.currentNode = node
        while (walker.nextNode()) {
            const current = walker.currentNode
            if (current === endContainer) {
                firstVisible = current
                break
            }
            // ancestors of the end container aren't entirely in the range
            if ((endContainer && current.contains(endContainer))
                    || (current.nodeType === Node.TEXT_NODE && !current.textContent.trim())) {
                continue
            }
            const hidden = getHiddenContent(current)
            if (!hidden) {
                firstVisible = current
                break
            }
            if (hidden.root && !hiddenRoot?.contains(hidden.root)) {
                hiddenRoot = hidden.root
            }
        }
    }
    if (inside && firstVisible === endContainer) {
        // the text offset refers to the starting node, not to its descendants
        return selectCharacter(endContainer, 0)
    }
    if (firstVisible && (inside || hiddenRoot)) {
        if (!hiddenRoot) {
            range.setStart(node, 0)
        }
        // the hidden root could contain visible content too,
        // e.g. absolutely positioned text that escapes its clipping
        else if (!hiddenRoot.contains(firstVisible)) {
            // Firefox includes the boxes of the hidden content if the
            // range starts at the end of its parent, so move up
            let last = hiddenRoot
            while (!last.nextSibling && last.parentNode && last.parentNode !== doc.body) {
                last = last.parentNode
            }
            range.setStartAfter(last)
        }
        else if (firstVisible.nodeType === Node.TEXT_NODE) {
            range.setStart(firstVisible, getCharacterBounds(firstVisible)[0])
        }
        else {
            range.setStartBefore(firstVisible)
        }
        if (endContainer) {
            range.setEnd(endContainer, getCharacterBounds(endContainer)[1])
        }
        else {
            range.setEndAfter(firstVisible)
        }
        return range
    }

    if (!endContainer) {
        walker.currentNode = node
        walker.lastChild()
        while (walker.nextNode()) {
            const current = walker.currentNode
            if (node.contains(current)) continue
            if (current.nodeType === Node.ELEMENT_NODE) {
                endContainer = current
                break
            }
        }
        if (!endContainer) {
            endContainer = node
        }
    }
    range.setStart(node, 0)
    range.setEnd(
        endContainer,
        endContainer.nodeType === Node.TEXT_NODE ? getCharacterBounds(endContainer)[1] : 0
    )
    return range
}
