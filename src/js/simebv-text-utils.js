import { textWalkerFilters } from '../../vendor/foliate-js/text-walker.js'
import { search, searchOptions } from '../../vendor/foliate-js/search.js'

export function createTextWalker(doc, { root, filter, acceptNode } = {}) {
    if (!filter && !acceptNode) {
        ;({ filter, acceptNode } = textWalkerFilters)
    }
    return doc.createTreeWalker(
        root ?? doc.body ?? doc.documentElement,
        filter ?? NodeFilter.SHOW_TEXT,
        acceptNode ? { acceptNode } : undefined
    )
}

export function getTextFraction(doc, range, offset = 0, { root, filter, acceptNode } = {}) {
    const walker = createTextWalker(doc, { root, filter, acceptNode })
    const { startContainer, startOffset } = range
    let total = 0
    let numerator
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (numerator === undefined) {
            if (n === startContainer) numerator = total + startOffset + offset
            else if (range.comparePoint(n, 0) >= 0) numerator = total + offset
        }
        total += n.length
    }
    if (!Number.isFinite(total)) {
        throw new TypeError(
            'Filter and acceptNode must ensure that only text or cdata nodes are returned'
        )
    }
    return total ? (numerator ?? total) / total : 0
}

export function getPositionAtTextFraction(doc, fraction = 0, { root, filter, acceptNode } = {}) {
    const walker = createTextWalker(doc, { root, filter, acceptNode })
    const nodes = []
    let total = 0
    let n
    while (n = walker.nextNode()) {
        nodes.push(n)
        total += n.length
    }
    if (!nodes.length) return null
    let remaining = Math.floor(total * fraction)
    for (const node of nodes) {
        if (remaining < node.length) return { node, offset: remaining }
        remaining -= node.length
    }
    const last = nodes[nodes.length - 1]
    return { node: last, offset: last.length }
}

/** The point (node, 0) as an offset in the parent node, or null if node isn't text or offset isn't 0 */
const liftTextStartPoint = (node, offset) => offset === 0 && node.parentNode
    && (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE)
        ? [node.parentNode, Array.prototype.indexOf.call(node.parentNode.childNodes, node)]
        : null

/**
 * Chrome's Selection.toString() is wrong when the selection starts or ends at offset 0
 * of a text node right after a <ruby>: the text starts (or stops) at the start of the paragraph.
 * The same point expressed as an offset in the parent node doesn't have the problem.
 */
function liftTextStart(range) {
    const start = liftTextStartPoint(range.startContainer, range.startOffset)
    const end = liftTextStartPoint(range.endContainer, range.endOffset)
    if (!start && !end) return range
    const lifted = range.cloneRange()
    if (start) lifted.setStart(...start)
    if (end) lifted.setEnd(...end)
    return lifted
}

/**
 * Returns the text Selection.toString() would give for the range
 * (no text that isn't rendered, whitespace as the browser serializes it).
 * Needs layout: in a document that isn't rendered the result is unreliable.
 */
export function getSelectionText(range) {
    const sel = range.commonAncestorContainer.ownerDocument.getSelection()
    if (!sel) return range.toString()
    const toSelect = liftTextStart(range)
    const single = sel.rangeCount === 1
        ? [sel.anchorNode, sel.anchorOffset, sel.focusNode, sel.focusOffset]
        : null
    if (single && toSelect === range) {
        const selRange = sel.getRangeAt(0)
        if (selRange.compareBoundaryPoints(Range.START_TO_START, range) === 0 &&
            selRange.compareBoundaryPoints(Range.END_TO_END, range) === 0) {
            return sel.toString()
        }
    }
    const saved = Array.from({ length: sel.rangeCount }, (_, i) => sel.getRangeAt(i).cloneRange())
    sel.removeAllRanges()
    sel.addRange(toSelect === range ? range.cloneRange() : toSelect)
    const text = sel.toString()
    sel.removeAllRanges()
    // setBaseAndExtent keeps the direction of a backward selection
    if (single) sel.setBaseAndExtent(...single)
    else for (const r of saved) sel.addRange(r)
    return text
}

/**
 * Given a range, returns its textual content as gathered by the textWalker
 * (so, for the default values of filter and acceptNode, it's compatible
 * with textual searches).
 */
export function getMatchText(range, { filter, acceptNode } = {}) {
    let root = range.commonAncestorContainer
    if (root.nodeType !== Node.ELEMENT_NODE) root = root.parentNode
    const doc = root.ownerDocument ?? root
    const walker = createTextWalker(doc, { root, filter, acceptNode })
    const { startContainer, startOffset, endContainer, endOffset } = range
    let text = ''
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (range.comparePoint(n, 0) > 0) break
        if (!range.intersectsNode(n)) continue
        const start = n === startContainer ? startOffset : 0
        const end = n === endContainer ? endOffset : n.length
        text += n.data.slice(start, end)
    }
    return text
}

/**
 * Returns the text inside a range: displayText from getSelectionText
 * and matchText from getMatchText. If searching for displayText finds
 * all of matchText (punctuation and white space at its edges aside),
 * matchText is set to null.
 */
export function getTextFromRange(range, { filter, acceptNode, defaultLocale = 'en' } = {}) {
    const sel = getSelectionText(range)
    let match = getMatchText(range, { filter, acceptNode })
    const doc = range.commonAncestorContainer.ownerDocument ?? range.commonAncestorContainer
    const opts = searchOptions(doc, {
        defaultLocale, matchCase: false, matchDiacritics: false,
        matchWholeWords: false, ignorePunctuation: true
    })
    const skipped = s => !s.trim() || isPunctuation(s)
    for (const { range: r } of search([match], sel, opts)) {
        if (skipped(match.slice(0, r.startOffset)) && skipped(match.slice(r.endOffset))) {
            match = null
            break
        }
    }
    return { text: sel, matchText: match }
}

/**
 * Whether a text search would find a match between the strings a and b.
 * The function accept ignorePunctuation and caseSensitive options
 * as part of the optional third argument, while 'whole words' and
 * 'match diacritics' are always off.
 * It compares the whole strings with a collator, so it differs from the
 * search (search() in vendor/foliate-js/search.js) in these cases:
 * - the search finds the query anywhere in the text, while here a and b
 *   must be equivalent from start to end (punctuation and white space aside,
 *   with ignorePunctuation)
 * - the search can start or end a match inside a character that is equivalent
 *   to several (e.g. 'ﬁ' and 'fi', 'ß' and 'ss'), and the match covers the whole
 *   character: searching 'ine' finds 'ﬁne', and 'gros' finds 'groß', while here
 *   they're different
 * - here the strings can be equivalent with a different number of graphemes,
 *   while the search compares the query with as many graphemes of the text, after
 *   splitting the compatibility characters and those that change length with the
 *   case (e.g. 'ﬁ', '㎏', 'ß'): 'aa' and 'å' are equivalent here in Danish ('da'),
 *   but the search doesn't find one with the other
 * - the search gets its locale from searchOptions (the language of the document,
 *   or else the default locale), here it's `locales`, 'en' if not given: for a
 *   search, some languages treat as different letters some that 'en' treats as
 *   equal with sensitivity 'base' (e.g. 'a' and 'ä' in German and Swedish, 'o'
 *   and 'ø' in Danish, 'n' and 'ñ' in Spanish)
 * - without Intl.Segmenter, the search only approximates the collator
 */
export function textSearchEquivalence(a, b, { locales = 'en', ignorePunctuation = true, caseSensitive = false } = {}) {
    if (ignorePunctuation) {
        const r = /[\p{Format}\p{P}\p{Z}\t\f\r\n\v\u0085]/gu
        a = a.replace(r, '')
        b = b.replace(r, '')
    }
    else {
        a = a.replace(/\p{Format}+/gu, '').replace(/\s+/gu, ' ')
        b = b.replace(/\p{Format}+/gu, '').replace(/\s+/gu, ' ')
    }
    if (!a) return false
    const collator = new Intl.Collator(
        locales, { usage: 'search', sensitivity: caseSensitive ? 'case' : 'base', ignorePunctuation }
    )
    return collator.compare(a, b) === 0
}

/**
 * Whether a text search with the options 'ignore punctuation'
 * and not 'whole words' would ignore the string
 */
export function isPunctuation(s) {
    return !!s.trim() && !/[^\p{Format}\p{P}\p{Z}\t\f\r\n\v\u0085]/u.test(s)
}
