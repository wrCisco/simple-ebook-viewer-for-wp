// The "visually hidden" pattern clips the content to a 1px × 1px box:
// the extra half pixel absorbs the subpixel rounding
const MIN_VISIBLE_SIZE = 1.5

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/*
 * Get the bounds of the first non white-space character (grapheme cluster)
 * of a text node, at or after the offset, or null if there is only white space
 * from the offset on.
 * In vertical writing modes the boxes of collapsed white space have no height,
 * and in Firefox neither have those of part of a character (e.g. half a surrogate
 * pair, or a letter without its combining mark): the overlayer wouldn't draw them.
 */
function getCharacterBounds(text, offset = 0) {
    const str = text.textContent
    offset = Math.max(0, offset)
    const nonWhiteSpace = str.slice(offset).search(/\S/)
    if (nonWhiteSpace < 0) {
        return null
    }
    const { index, segment } = graphemeSegmenter.segment(str).containing(offset + nonWhiteSpace)
    return [index, index + segment.length]
}

/*
 * Get the bounds of the last non white-space character (grapheme cluster)
 * of a text node before the offset, or null if there is only white space before it.
 */
function getLastCharacterBounds(text, offset = Infinity) {
    const str = text.textContent
    const before = str.slice(0, Math.max(0, offset)).trimEnd()
    if (!before) {
        return null
    }
    const { index, segment } = graphemeSegmenter.segment(str).containing(before.length - 1)
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
 * A starting text node with only white space from the offset on is never part of
 * the range, which would select nothing else: the range starts after it (it selects
 * the first visible character that follows, if no visible box comes before it);
 * if nothing visible follows (e.g. at the end of a section), the range selects
 * the last visible character before the offset, and if there's no visible text
 * at all, it's collapsed at the offset.
 * The overlayer draws at the first box of the range, so:
 * - if a visible box (e.g. an image) precedes the first visible character,
 *   the range also contains the box;
 * - if hidden content precedes the first visible content (text, or a box),
 *   the range starts right after the hidden content.
 * Without layout (e.g. in a 'load' event handler, while the paginator keeps the
 * iframe hidden) every text looks hidden: when the starting node is a text node,
 * pass true as the third argument to skip the isVisuallyHidden check on the text,
 * so that any non white-space character counts as visible. Elements with
 * 'display: none' are skipped all the same in Chrome, but not in Firefox,
 * which computes no style in a hidden iframe.
 */
export function getNonEmptyRange(node, textOffset = 0, skipTextVisibilityCheck = false) {
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
        if (!skipTextVisibilityCheck && isVisuallyHidden(n)) {
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

    // the range must start after a text node with only white space from the offset on
    let afterText = false
    if (node.nodeType === Node.TEXT_NODE) {
        if (isVisibleText(node)) {
            if (getCharacterBounds(node, textOffset)) {
                return selectCharacter(node, textOffset)
            }
            afterText = true
        }
        else {
            // hidden text is handled with the rest of the hidden content
            afterText = !skippedHidden
        }
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
    if (inside || skippedHidden || afterText) {
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
    if ((inside || afterText) && endContainer && firstVisible === endContainer) {
        // nothing else comes first: select the first visible character
        // (the text offset refers to the starting node, not to the end container)
        return selectCharacter(endContainer, 0)
    }
    if (firstVisible && (inside || hiddenRoot || afterText)) {
        if (!hiddenRoot && !afterText) {
            range.setStart(node, 0)
        }
        // the hidden root could contain visible content too,
        // e.g. absolutely positioned text that escapes its clipping
        else if (!hiddenRoot?.contains(firstVisible)) {
            // Firefox includes the boxes of the hidden content if the
            // range starts at the end of its parent, so move up
            let last = hiddenRoot ?? node
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

    if (afterText) {
        // nothing visible follows (e.g. at the end of a section):
        // select the last visible character before the offset.
        // Without layout Firefox computes no style, so the walker can't skip the head
        const root = doc.body ?? doc.documentElement
        walker.currentNode = node
        let text = node
        let offset = textOffset
        while (text && root.contains(text)) {
            const bounds = isVisibleText(text) ? getLastCharacterBounds(text, offset) : null
            if (bounds) {
                range.setStart(text, bounds[0])
                range.setEnd(text, bounds[1])
                return range
            }
            text = walker.previousNode()
            offset = Infinity
        }
        range.setStart(node, Math.min(textOffset, node.length))
        range.collapse(true)
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
        endContainer.nodeType === Node.TEXT_NODE ? getCharacterBounds(endContainer)?.[1] ?? 0 : 0
    )
    return range
}
