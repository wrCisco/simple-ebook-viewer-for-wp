import { expect, test, describe, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import { isPunctuation, textSearchEquivalence, getMatchText } from '../js/simebv-text-utils.js'
import { textWalker } from '../../vendor/foliate-js/text-walker.js'
import { searchMatcher } from '../../vendor/foliate-js/search.js'

describe('String contains only punctuation and optionally spaces, but never only spaces (unit test for isPunctuation)', () => {
    test.for([
        [',', true],
        ['.', true],
        ['\n', false],
        ['\t', false],
        ['a', false],
        ['\u0085', true],  // NEXT LINE (NEL)
        ['_', true],
        ['\u00AD', true],  // SOFT HYPHEN
        ['𓐰', true],  // EGYPTIAN HIEROGLYPH VERTICAL JOINER
        ['𓍚', false],  // EGYPTIAN HIEROGLYPH U035
        [' ', false],
        ['  ', false],
        ['the end.', false],
        ['. ', true],
        ['; ...', true],
    ])('"%s" -> %s', ([a, expected]) => {
        expect(isPunctuation(a)).toBe(expected)
    })
})

describe('Textual search equivalence (unit test for textSearchEquivalence)', () => {
    const strs = [
        { a: 'Ab', b: 'aB', expected: {
            cs_ip_noww: false, cs_noip_noww: false, nocs_noip_noww: true, nocs_ip_noww: true,
        }},
        { a: 'end of the world.', b: 'end of the world', expected: {
            cs_ip_noww: true, cs_noip_noww: false, nocs_noip_noww: false, nocs_ip_noww: true,
        }},
        { a: 'pretty printed end.', b: '\n  pretty printed end\n', expected: {
            cs_ip_noww: true, cs_noip_noww: false, nocs_noip_noww: false, nocs_ip_noww: true,
        }},
        { a: ', start with or without punctuation', b: 'start with or without punctuation', expected: {
            cs_ip_noww: true, cs_noip_noww: false, nocs_noip_noww: false, nocs_ip_noww: true,
        }},
        { a: '\n Exactly equals with space before!', b: '\n Exactly equals with space before!', expected: {
            cs_ip_noww: true, cs_noip_noww: true, nocs_noip_noww: true, nocs_ip_noww: true,
        }},
        { a: 'non   normalized \t \n spaces', b: 'non normalized spaces', expected: {
            cs_ip_noww: true, cs_noip_noww: true, nocs_noip_noww: true, nocs_ip_noww: true,
        }},
        { a: ' \n\t  ', b: ' \n\t  ', expected: {
            cs_ip_noww: false, cs_noip_noww: true, nocs_noip_noww: true, nocs_ip_noww: false,
        }},
        { a: '', b: '', expected: {
            cs_ip_noww: false, cs_noip_noww: false, nocs_noip_noww: false, nocs_ip_noww: false,
        }},
        { a: 'two completely', b: 'different strings', expected: {
            cs_ip_noww: false, cs_noip_noww: false, nocs_noip_noww: false, nocs_ip_noww: false,
        }},
        { a: 'Differents in case, and punctuation', b: 'differents in case and punctuation', expected: {
            cs_ip_noww: false, cs_noip_noww: false, nocs_noip_noww: false, nocs_ip_noww: true,
        }},
        { a: 'Großbuchstabe', b: 'grossbuchstabe', locales: 'de', expected: {
            cs_ip_noww: false, cs_noip_noww: false, nocs_noip_noww: true, nocs_ip_noww: true,
        }},
        { a: 'großbuchstabe', b: 'grossbuchstabe', locales: 'de', expected: {
            cs_ip_noww: false, cs_noip_noww: false, nocs_noip_noww: true, nocs_ip_noww: true,
        }},
        { a: 'grossbuchstabe', b: 'großbuchstabe', locales: 'de', expected: {
            cs_ip_noww: false, cs_noip_noww: false, nocs_noip_noww: true, nocs_ip_noww: true,
        }},
        { a: 'ẞ ﬃ ῳ İ', b: 'SS FFI ΩΙ İ', expected: {
            cs_ip_noww: false, cs_noip_noww: false, nocs_noip_noww: false, nocs_ip_noww: false,
        }},
        { a: 'ẞ ῳ ﬃ İ', b: 'SS ῳ FFI İ', expected: {
            cs_ip_noww: false, cs_noip_noww: false, nocs_noip_noww: true, nocs_ip_noww: true,
        }},
    ]
    describe('With default options (case sensitive, ignore punctuation, no whole words)', () => {
        test.for(
            strs.map(s => ({ a: s.a, b: s.b, expected: s.expected.cs_ip_noww }))
        )('"$a" and "$b" -> $expected', ({a, b, locales = 'en', expected}) => {
            expect(textSearchEquivalence(a, b, { locales })).toBe(expected)
        })
    })
    describe('With options: case sensitive, no ignore punctuation, no whole words', () => {
        test.for(
            strs.map(s => ({ a: s.a, b: s.b, expected: s.expected.cs_noip_noww }))
        )('"$a" and "$b" -> $expected', ({a, b, locales = 'en', expected}) => {
            expect(textSearchEquivalence(a, b, { ignorePunctuation: false })).toBe(expected)
        })
    })
    describe('With options: no case sensitive, no ignore punctuation, no whole words', () => {
        test.for(
            strs.map(s => ({ a: s.a, b: s.b, expected: s.expected.nocs_noip_noww }))
        )('"$a" and "$b" -> $expected', ({a, b, locales = 'en', expected}) => {
            expect(textSearchEquivalence(a, b, { caseSensitive: false, ignorePunctuation: false })).toBe(expected)
        })
    })
    describe('With options: no case sensitive, ignore punctuation, no whole words', () => {
        test.for(
            strs.map(s => ({ a: s.a, b: s.b, expected: s.expected.nocs_ip_noww }))
        )('"$a" and "$b" -> $expected', ({a, b, locales = 'en', expected}) => {
            expect(textSearchEquivalence(a, b, { caseSensitive: false })).toBe(expected)
        })
    })
})

/**
 * Given a query string and a document, check that textSearchEquivalence,
 * called with the query and the result of getMatchText on the document body
 * as arguments, give results compatible with foliate-js's searchMatcher.
 */
describe('Textual search equivalence (comparison with real text search)', () => {
    let iframe

    beforeAll(() => new Promise(resolve => {
        iframe = document.createElement('iframe')
        iframe.addEventListener('load', () => resolve())
        iframe.src = URL.createObjectURL(new Blob([`<?xml version="1.0" encoding="UTF-8"?>
            <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
            <head><title>t</title></head>
            <body></body></html>`]), { type: 'application/xhtml+xml' })
        document.body.append(iframe)
    }))
    afterAll(() => {
        URL.revokeObjectURL(iframe.src)
        document.body.replaceChildren()
    })

    const makeMatcher = ({ defaultLocale = 'en', matchCase = false, ignorePunctuation = false } = {}) => {
        return searchMatcher(textWalker, {
            defaultLocale, matchCase, matchDiacritics: false, matchWholeWords: false, ignorePunctuation,
        })
    }

    const textToMatch = (doc, content) => {
        doc.body.innerHTML = content
        const range = doc.createRange()
        range.selectNodeContents(doc.body)
        return getMatchText(range)
    }

    const setupTest = (content, { locales, matchCase = false, ignorePunctuation = false} = {}) => {
        const doc = iframe.contentDocument
        return {
            doc,
            text: textToMatch(doc, content),
            matcher: makeMatcher({ locales, matchCase, ignorePunctuation }),
        }
    }

    const strs = [
        { query: 'Ab', content: '<p>aB</p>' },
        { query: 'end of the world.', content: '<p>end of the world</p>' },
        { query: 'pretty printed end.', content: '<p>\n  pretty printed end\n</p>' },
        { query: ', start with punctuation', content: '<p>start with punctuation</p>' },
        { query: '\n Exactly equals with space before!', content: '<div><p>\n<span> Exactly</span> equals with space before!</p></div>'},
        { query: 'non   normalized \t \n spaces', content: '<p>non normalized spaces</p>' },
        { query: ' \n\t  ', content: '<p> \n\t</p>' },
        { query: '', content: '<p></p>' },
        { query: 'two completely', content: '<p>different strings</p>' },
        { query: 'Differents in case, and punctuation', content: '<p>differents in case and punctuation</p>' },
        { query: 'Großbuchstabe', content: '<p>gro<span>ss</span>buchstabe</p>', locales: 'de' },
        { query: 'großbuchstabe', content: '<p>gro<span>ss</span>buchstabe</p>', locales: 'de' },
        { query: 'grossbuchstabe', content: '<p>Gro<span>ß</span>buchstabe</p>', locales: 'de' },
        { query: 'ẞ ῳ ﬃ İ', content: '<p>SS ΩΙ FFI İ</p>' },
        { query: 'ẞ ῳ ﬃ İ', content: '<p>SS ῳ FFI İ</p>' }
    ]
    describe('With default options (case sensitive, ignore punctuation, no whole words)', () => {
        test.for(strs)('', ({query, content, locales = 'en'}) => {
            const { doc, matcher, text } = setupTest(content, { locales, matchCase: true, ignorePunctuation: true })
            expect([...matcher(doc, query)].length !== 0).toEqual(textSearchEquivalence(query, text))
        })
    })
    describe('With options: case sensitive, no ignore punctuation, no whole words', () => {
        test.for(strs)('', ({query, content, locales = 'en'}) => {
            const { doc, matcher, text } = setupTest(content, { locales, matchCase: true, ignorePunctuation: false })
            expect([...matcher(doc, query)].length !== 0).toEqual(textSearchEquivalence(query, text, { ignorePunctuation: false }))
        })
    })
    describe('With options: no case sensitive, no ignore punctuation, no whole words', () => {
        test.for(strs)('', ({query, content, locales = 'en'}) => {
            const { doc, matcher, text } = setupTest(content, { locales, matchCase: false, ignorePunctuation: false })
            expect([...matcher(doc, query)].length !== 0).toEqual(textSearchEquivalence(query, text, { caseSensitive: false, ignorePunctuation: false }))
        })
    })
    describe('With options: no case sensitive, ignore punctuation, no whole words', () => {
        test.for(strs)('', ({query, content, locales = 'en'}) => {
            const { doc, matcher, text } = setupTest(content, { locales, matchCase: false, ignorePunctuation: true })
            expect([...matcher(doc, query)].length !== 0).toEqual(textSearchEquivalence(query, text, { caseSensitive: false }))
        })
    })
})
