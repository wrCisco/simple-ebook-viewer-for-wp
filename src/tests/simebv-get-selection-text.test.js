import { expect, test, describe, beforeAll, beforeEach, afterAll } from 'vitest'
import { getSelectionText, createTextWalker } from '../js/simebv-text-utils.js'

/*
 * getSelectionText needs layout, so these tests load their documents in an iframe.
 * Chrome and Firefox don't serialize a selection in the same way (Chrome leaves CDATA
 * sections out and includes the <rt> readings, Firefox does the opposite), so the tests
 * check properties that don't depend on the browser:
 * - a point gives the same text when it's expressed as (text, offset) or as (parent, index);
 * - splitting a range at a point gives two texts that, joined, are the text of the whole range;
 * - the selection of the user is still there, unchanged, after the call.
 * Whitespace is ignored: browsers add line breaks at block edges, <br>s, table cells
 * and list items depending on which side of the element edge the boundary is.
 */

const IMG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='72'%3E%3Crect width='120' height='72' fill='%23999'/%3E%3C/svg%3E`

const STYLE = `
    .hidden { display: none; }
    img { width: 120px; height: 72px; vertical-align: middle; }
`

// valid both as HTML and as XHTML
const BODY = `
<h1>Chapter One: Placeholder</h1>
<p id="plain">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
    incididunt ut labore et dolore magna aliqua: the source of this paragraph
    has line breaks and indentation inside its text.</p>
<p>Starts plain, then <em>emphasis</em>, <strong>strong text</strong> and a <a href="#">link with <em>nested emphasis</em> inside</a>.</p>
<p><em>An element at the start</em> of the paragraph, and one at its end: <strong>bold end</strong></p>
<p>Nested elements at the end: <a href="#"><em><strong>deeply nested end</strong></em></a></p>
<p>Adjacent<em>elements</em><strong>without</strong>spaces<span></span>and an empty span.</p>
<p>First line<br/>second line<br/><br/>after two breaks.</p>
<p>Text before an image <img alt="placeholder image" src="${IMG}"/> and text after it.</p>
<p>Visible text<span class="hidden"> HIDDEN TEXT </span>continues here.</p>
<p>Before a script<script type="text/plain">SCRIPT TEXT</script> and after it.</p>
<p>Ends with a style<style>.unused { color: red }</style></p>
<p>Non-breaking&#160;space, soft&#173;hyphen, zero&#8203;width space, punctuation — dashes… “quotes”!</p>
<ul>
    <li>First item</li>
    <li>Second item with <em>emphasis</em></li>
    <li>Third item</li>
</ul>
<table>
    <tr><th>Header A</th><th>Header B</th></tr>
    <tr><td>Cell one</td><td>Cell two</td></tr>
</table>
<p>A combining accent: cafe&#x301;. Emoji: 👨‍👩‍👧 family, 🇮🇹 flag.</p>
<p id="ruby-en">Ruby: <ruby>漢<rt>kan</rt>字<rt>ji</rt></ruby>.</p>
<p id="ruby-ja" lang="ja"><ruby>漢字<rt>かんじ</rt></ruby>の<ruby>読<rt>よ</rt></ruby>み<ruby>方<rp>(</rp><rt>かた</rt><rp>)</rp></ruby>を<ruby>振<rt>ふ</rt></ruby>り<ruby>仮名<rt>がな</rt></ruby>で<span><ruby>示<rt>しめ</rt></ruby></span>す。</p>
<p>A paragraph that ends with a script<script>(function () { const a = '' })()</script></p>
`

// CDATA sections are comments in HTML
const CDATA = `
<p>A CDATA section <![CDATA[in the middle, with <markup> & an ampersand,]]> then text again.</p>
<p><![CDATA[A CDATA section at the start]]>, then a text node.</p>
<p>A CDATA section as the last child<![CDATA[ CDATA AT THE END]]></p>
<p>A CDATA section in a span at the end<span><![CDATA[ CDATA IN A SPAN]]></span></p>
<p>Text<![CDATA[CDATA]]>text<![CDATA[CDATA]]>, adjacent without spaces.</p>
`

const LAST = `<p><em>Last element</em>last text node of the document</p>`

const HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><title>getSelectionText</title><style>${STYLE}</style></head>
<body>${BODY}${LAST}</body></html>`

const XHTML = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">
<head><meta charset="utf-8"/><title>getSelectionText</title><style>${STYLE}</style></head>
<body>${BODY}${CDATA}${LAST}</body></html>`

const documents = [
    { name: 'HTML', source: HTML, type: 'text/html' },
    { name: 'XHTML', source: XHTML, type: 'application/xhtml+xml' },
]

// text nodes right after a <ruby> (in the last one, a span with a ruby): in Chrome, Selection.toString()
// of a selection that starts at their offset 0 starts at the start of the paragraph,
// and the one of a selection that ends there loses the text of the paragraph before the end
const afterRuby = [
    ['#ruby-en', '.'],
    ['#ruby-ja', 'の'],
    ['#ruby-ja', 'み'],
    ['#ruby-ja', 'を'],
    ['#ruby-ja', 'り'],
    ['#ruby-ja', 'で'],
    ['#ruby-ja', 'す。'],
]

function loadIframe(source, type) {
    return new Promise(resolve => {
        const iframe = document.createElement('iframe')
        iframe.style.cssText = 'width: 800px; height: 600px; border: 0'
        const url = URL.createObjectURL(new Blob([source], { type }))
        iframe.addEventListener('load', () => {
            URL.revokeObjectURL(url)
            resolve(iframe)
        }, { once: true })
        iframe.src = url
        document.body.append(iframe)
    })
}

const noSpace = s => s.replace(/\s+/gu, '')

const indexInParent = node => Array.prototype.indexOf.call(node.parentNode.childNodes, node)

/** The text and CDATA nodes a text search would look into, without the blank ones */
function textNodes(doc) {
    const nodes = []
    const walker = createTextWalker(doc)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.nodeValue.trim()) nodes.push(n)
    }
    return nodes
}

/** start and end are [node, offset] */
function makeRange(doc, start, end) {
    const range = doc.createRange()
    range.setStart(...start)
    range.setEnd(...end)
    return range
}

function describeNode(node) {
    const path = []
    for (let n = node.parentNode; n && n.localName !== 'body'; n = n.parentNode) {
        path.unshift(n.localName + (n.id ? '#' + n.id : ''))
    }
    const kind = node.nodeType === Node.CDATA_SECTION_NODE ? 'CDATA' : 'text'
    return `${kind} ${JSON.stringify(node.nodeValue.slice(0, 16))} in ${path.join(' > ')}`
}

/** The text node child of the element matching selector whose text is text */
function findText(doc, selector, text) {
    const parent = doc.querySelector(selector)
    const node = Array.from(parent.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.nodeValue === text)
    if (!node) throw new Error(`No text node "${text}" in ${selector}`)
    return { parent, node }
}

function selectionState(sel) {
    return {
        anchorNode: sel.anchorNode, anchorOffset: sel.anchorOffset,
        focusNode: sel.focusNode, focusOffset: sel.focusOffset,
        rangeCount: sel.rangeCount,
    }
}

/** toBe on each property: toEqual compares DOM nodes with isEqualNode */
function expectSameSelection(sel, state) {
    const now = selectionState(sel)
    for (const key of Object.keys(state)) {
        expect(now[key], key).toBe(state[key])
    }
}

describe.each(documents)('getSelectionText in a $name document', ({ source, type }) => {
    let iframe
    let doc
    let bodyStart
    let bodyEnd

    beforeAll(async () => {
        iframe = await loadIframe(source, type)
        doc = iframe.contentDocument
        bodyStart = [doc.body, 0]
        bodyEnd = [doc.body, doc.body.childNodes.length]
    })
    afterAll(() => {
        iframe.remove()
    })
    beforeEach(() => {
        doc.getSelection().removeAllRanges()
    })

    test('the document is parsed as expected', () => {
        expect(doc.contentType).toBe(type)
        const cdata = textNodes(doc).filter(n => n.nodeType === Node.CDATA_SECTION_NODE)
        expect(cdata.length > 0).toBe(type === 'application/xhtml+xml')
    })

    test('a point gives the same text as (text, offset) and as (parent, index)', () => {
        const differences = []
        for (const node of textNodes(doc)) {
            const i = indexInParent(node)
            const points = [
                ['offset 0', [node, 0], [node.parentNode, i]],
                ['offset length', [node, node.length], [node.parentNode, i + 1]],
            ]
            for (const [where, inText, inParent] of points) {
                for (const side of ['start', 'end']) {
                    const make = point => side === 'start'
                        ? makeRange(doc, point, bodyEnd)
                        : makeRange(doc, bodyStart, point)
                    const a = getSelectionText(make(inText))
                    const b = getSelectionText(make(inParent))
                    if (noSpace(a) !== noSpace(b)) {
                        differences.push(`range ${side} at ${where} of the ${describeNode(node)}`)
                    }
                }
            }
        }
        expect(differences).toEqual([])
    })

    test('the texts before and after a point are, joined, the text of the whole range', () => {
        const whole = noSpace(getSelectionText(makeRange(doc, bodyStart, bodyEnd)))
        const differences = []
        for (const node of textNodes(doc)) {
            const i = indexInParent(node)
            const points = [
                ['(text, 0)', [node, 0]],
                ['(text, length)', [node, node.length]],
                ['(parent, index)', [node.parentNode, i]],
                ['(parent, index + 1)', [node.parentNode, i + 1]],
            ]
            for (const [where, point] of points) {
                const before = getSelectionText(makeRange(doc, bodyStart, point))
                const after = getSelectionText(makeRange(doc, point, bodyEnd))
                if (noSpace(before) + noSpace(after) !== whole) {
                    differences.push(`split at ${where} of the ${describeNode(node)}`)
                }
            }
        }
        expect(differences).toEqual([])
    })

    test.for(afterRuby)('a range split at the start of the text after a ruby (%s, "%s")', ([selector, text]) => {
        const { parent, node } = findText(doc, selector, text)
        const start = [parent, 0]
        const end = [parent, parent.childNodes.length]
        const before = getSelectionText(makeRange(doc, start, [node, 0]))
        const after = getSelectionText(makeRange(doc, [node, 0], end))
        const whole = getSelectionText(makeRange(doc, start, end))
        expect(noSpace(after).slice(0, text.length)).toBe(text)
        expect(noSpace(before) + noSpace(after)).toBe(noSpace(whole))
    })

    test.for(afterRuby)('a backward selection of the user ending at the start of the text after a ruby (%s, "%s")', ([selector, text]) => {
        const { parent, node } = findText(doc, selector, text)
        const sel = doc.getSelection()
        const last = parent.lastChild
        sel.setBaseAndExtent(last, last.length, node, 0)
        const state = selectionState(sel)
        // the range of the selection itself, as in BookmarksManager.getLocationData
        const selected = getSelectionText(sel.getRangeAt(0))
        expect(noSpace(selected).slice(0, text.length)).toBe(text)
        expect(noSpace(selected)).toBe(noSpace(getSelectionText(makeRange(doc, [node, 0], [last, last.length]))))
        expectSameSelection(sel, state)
    })

    test('the range of the selection, when no boundary needs to be changed', () => {
        const node = doc.querySelector('#plain').firstChild
        const sel = doc.getSelection()
        sel.setBaseAndExtent(node, 6, node, 26)
        const state = selectionState(sel)
        expect(getSelectionText(sel.getRangeAt(0))).toBe('ipsum dolor sit amet')
        expectSameSelection(sel, state)
    })

    test('a range that isn\'t the selection doesn\'t change the selection', () => {
        const node = doc.querySelector('#plain').firstChild
        const sel = doc.getSelection()
        sel.setBaseAndExtent(node, 26, node, 6)
        const state = selectionState(sel)
        // a range whose start is changed to (parent, index)
        const { node: textAfterRuby } = findText(doc, '#ruby-ja', 'の')
        expect(noSpace(getSelectionText(makeRange(doc, [textAfterRuby, 0], [textAfterRuby, 1])))).toBe('の')
        expect(getSelectionText(makeRange(doc, [node, 0], [node, 5]))).toBe('Lorem')
        expectSameSelection(sel, state)
    })

    test('no selection before, no selection after', () => {
        const node = doc.querySelector('#plain').firstChild
        const sel = doc.getSelection()
        expect(getSelectionText(makeRange(doc, [node, 0], [node, 5]))).toBe('Lorem')
        expect(sel.rangeCount).toBe(0)
    })

    test('a selection with more than one range', ({ skip }) => {
        const node = doc.querySelector('#plain').firstChild
        const sel = doc.getSelection()
        const ranges = [makeRange(doc, [node, 0], [node, 5]), makeRange(doc, [node, 6], [node, 11])]
        for (const r of ranges) sel.addRange(r)
        skip(sel.rangeCount < 2, 'Only Firefox supports selections with more than one range')
        expect(getSelectionText(makeRange(doc, [node, 12], [node, 17]))).toBe('dolor')
        expect(sel.rangeCount).toBe(2)
        for (let i = 0; i < 2; i++) {
            const r = sel.getRangeAt(i)
            expect(r.compareBoundaryPoints(Range.START_TO_START, ranges[i])).toBe(0)
            expect(r.compareBoundaryPoints(Range.END_TO_END, ranges[i])).toBe(0)
        }
    })
})
