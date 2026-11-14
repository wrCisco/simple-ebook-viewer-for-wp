import { expect, test, describe, beforeAll, afterAll, beforeEach } from 'vitest'
import { getTextFromRange, getSelectionText, getMatchText } from '../js/simebv-text-utils.js'

/*
 * getTextFromRange gives the text of a range as the browser displays it (text) and the text
 * a search looks into (matchText), which is null when searching for the displayed text
 * finds all of it. It needs layout, like getSelectionText, so the document is in an iframe.
 * Some differences between the two texts depend on the browser (Chrome leaves CDATA sections
 * out of the displayed text, Firefox adds the alt text of images): for those the tests
 * check that matchText is kept exactly when the two texts differ.
 */

const IMG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='72'%3E%3Crect width='120' height='72' fill='%23999'/%3E%3C/svg%3E`

const XHTML = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">
<head><meta charset="utf-8"/><title>getTextFromRange</title>
<style>.hidden { display: none; } img { width: 120px; height: 72px; }</style></head>
<body>
<p id="plain">Lorem ipsum dolor sit amet, consectetur
    adipiscing elit.</p>
<p id="next">Next paragraph.</p>
<p id="hidden-end">Visible text<span class="hidden"> HIDDEN TEXT</span></p>
<p id="hidden-start"><span class="hidden">HIDDEN TEXT </span>visible text</p>
<p id="hidden-middle">Visible<span class="hidden"> HIDDEN </span> text</p>
<p id="cdata-start"><![CDATA[A CDATA section]]> at the start</p>
<p id="cdata-end">At the end, <![CDATA[a CDATA section]]></p>
<p id="img">An image <img alt="ALT TEXT" src="${IMG}"/> in the text.</p>
<p id="last">The last paragraph.</p>
</body></html>`

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

// what a search ignoring punctuation looks at
const searched = s => s.replace(/[\p{P}\p{Z}\s\p{Format}]/gu, '')

describe('getTextFromRange', () => {
    let iframe
    let doc

    beforeAll(async () => {
        iframe = await loadIframe(XHTML, 'application/xhtml+xml')
        doc = iframe.contentDocument
    })
    afterAll(() => {
        iframe.remove()
    })
    beforeEach(() => {
        doc.getSelection().removeAllRanges()
    })

    const range = (start, end = start) => {
        const r = doc.createRange()
        r.setStart(...start)
        r.setEnd(...end)
        return r
    }
    const contents = selector => {
        const r = doc.createRange()
        r.selectNodeContents(doc.querySelector(selector))
        return r
    }
    const text = selector => doc.querySelector(selector).firstChild

    test('the document is parsed as expected', () => {
        expect(doc.contentType).toBe('application/xhtml+xml')
        expect(text('#cdata-start').nodeType).toBe(Node.CDATA_SECTION_NODE)
    })

    test('the same text: no matchText', () => {
        expect(getTextFromRange(range([text('#plain'), 6], [text('#plain'), 26])))
            .toEqual({ text: 'ipsum dolor sit amet', matchText: null })
    })

    test('white space that the browser collapses: no matchText', () => {
        const r = contents('#plain')
        const { text, matchText } = getTextFromRange(r)
        expect(text).not.toBe(getMatchText(r))
        expect(matchText).toBe(null)
    })

    test('a range across the edge of a block: no matchText', () => {
        const end = text('#plain')
        expect(getTextFromRange(range([end, end.length - 'elit.'.length], [text('#next'), 4])).matchText).toBe(null)
    })

    // a search for the displayed text finds a part of the text of the range
    test.for([
        ['at the end', '#hidden-end', 'Visible text HIDDEN TEXT'],
        ['at the start', '#hidden-start', 'HIDDEN TEXT visible text'],
        ['in the middle', '#hidden-middle', 'Visible HIDDEN  text'],
    ])('text that isn\'t displayed, %s: matchText has it', ([_, selector, expected]) => {
        const { text, matchText } = getTextFromRange(contents(selector))
        expect(text).not.toContain('HIDDEN')
        expect(matchText).toBe(expected)
    })

    // e.g. the text after a position at the end of a section, in BookmarksManager.#getTextAround
    test.for([
        ['a collapsed range in a text node', () => range([text('#last'), text('#last').length])],
        ['a collapsed range at the end of the body', () => range([doc.body, doc.body.childNodes.length])],
    ])('no text (%s): no error', ([_, makeRange]) => {
        const { text, matchText } = getTextFromRange(makeRange())
        expect(text).toBe('')
        expect(matchText ?? '').toBe('')
    })

    // Firefox displays the alt text, which a search can't find
    test('a range with only an image: no error', () => {
        const p = doc.querySelector('#img')
        expect(getTextFromRange(range([p, 1], [p, 2])).matchText ?? '').toBe('')
    })

    // Chrome leaves CDATA sections out of the displayed text, Firefox adds the alt text of images
    test.for([
        ['a CDATA section at the start', '#cdata-start'],
        ['a CDATA section at the end', '#cdata-end'],
        ['an image', '#img'],
    ])('%s: matchText is kept only if the displayed text is different', ([_, selector]) => {
        const r = contents(selector)
        const displayed = getSelectionText(r)
        const walked = getMatchText(r)
        const { text, matchText } = getTextFromRange(r)
        expect(text).toBe(displayed)
        expect(matchText).toBe(searched(displayed) === searched(walked) ? null : walked)
    })

    // defaultLocale comes from the metadata of the book
    test('an invalid defaultLocale, in a document without a language: no error', () => {
        const root = doc.documentElement
        root.removeAttribute('lang')
        try {
            const r = range([text('#plain'), 6], [text('#plain'), 26])
            expect(getTextFromRange(r, { defaultLocale: 'not a locale!' }).matchText).toBe(null)
        } finally {
            root.setAttribute('lang', 'en')
        }
    })
})
