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
        { a: 'non   normalized \t \n spaces in query', b: 'non normalized spaces in query', expected: {
            cs_ip_noww: true, cs_noip_noww: true, nocs_noip_noww: true, nocs_ip_noww: true,
        }},
        { a: 'non normalized spaces in content', b: 'non   normalized \t \n spaces in content', expected: {
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
        { a: 'split wor ds', b: 'split words', expected: {
            cs_ip_noww: true, cs_noip_noww: false, nocs_noip_noww: false, nocs_ip_noww: true,
        }},
        { a: 'Großbuchstabe', b: 'grossbuchstabe', locales: 'de', expected: {
            cs_ip_noww: false, cs_noip_noww: false, nocs_noip_noww: true, nocs_ip_noww: true,
        }},
        { a: 'großbuchstabe', b: 'grossbuchstabe', locales: 'de', expected: {
            cs_ip_noww: true, cs_noip_noww: true, nocs_noip_noww: true, nocs_ip_noww: true,
        }},
        { a: 'grossbuchstabe', b: 'großbuchstabe', locales: 'de', expected: {
            cs_ip_noww: true, cs_noip_noww: true, nocs_noip_noww: true, nocs_ip_noww: true,
        }},
        { a: 'gros', b: 'groß', locales: 'de', expected: {
            cs_ip_noww: false, cs_noip_noww: false, nocs_noip_noww: false, nocs_ip_noww: false,
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
            expect(textSearchEquivalence(a, b, { locales, caseSensitive: true })).toBe(expected)
        })
    })
    describe('With options: case sensitive, no ignore punctuation, no whole words', () => {
        test.for(
            strs.map(s => ({ a: s.a, b: s.b, expected: s.expected.cs_noip_noww }))
        )('"$a" and "$b" -> $expected', ({a, b, locales = 'en', expected}) => {
            expect(textSearchEquivalence(a, b, { caseSensitive: true, ignorePunctuation: false })).toBe(expected)
        })
    })
    describe('With options: no case sensitive, no ignore punctuation, no whole words', () => {
        test.for(
            strs.map(s => ({ a: s.a, b: s.b, expected: s.expected.nocs_noip_noww }))
        )('"$a" and "$b" -> $expected', ({a, b, locales = 'en', expected}) => {
            expect(textSearchEquivalence(a, b, { ignorePunctuation: false })).toBe(expected)
        })
    })
    describe('With options: no case sensitive, ignore punctuation, no whole words', () => {
        test.for(
            strs.map(s => ({ a: s.a, b: s.b, expected: s.expected.nocs_ip_noww }))
        )('"$a" and "$b" -> $expected', ({a, b, locales = 'en', expected}) => {
            expect(textSearchEquivalence(a, b)).toBe(expected)
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
            <body></body></html>`], { type: 'application/xhtml+xml' }))
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
        { query: 'non   normalized \t \n spaces in query', content: '<p>non normalized spaces in query</p>' },
        { query: 'non normalized spaces in content', content: '<p>non   normalized \t \n spaces in content</p>' },
        { query: ' \n\t  ', content: '<p> \n\t</p>' },
        { query: '', content: '<p></p>' },
        { query: 'two completely', content: '<p>different strings</p>' },
        { query: 'Differents in case, and punctuation', content: '<p>differents in case and punctuation</p>' },
        { query: 'split wor ds', content: '<p>split words</p>' },
        { query: 'Großbuchstabe', content: '<p>gro<span>ss</span>buchstabe</p>', locales: 'de' },
        { query: 'großbuchstabe', content: '<p>gro<span>ss</span>buchstabe</p>', locales: 'de' },
        { query: 'grossbuchstabe', content: '<p>Gro<span>ß</span>buchstabe</p>', locales: 'de' },
        { query: 'ẞ ῳ ﬃ İ', content: '<p>SS ΩΙ FFI İ</p>' },
        { query: 'ẞ ῳ ﬃ İ', content: '<p>SS ῳ FFI İ</p>' },
    ]
    describe('With default options (case sensitive, ignore punctuation, no whole words)', () => {
        test.for(strs)('', ({query, content, locales = 'en'}) => {
            const { doc, matcher, text } = setupTest(content, { locales, matchCase: true, ignorePunctuation: true })
            const opts = { locales, caseSensitive: true }
            const matches = [...matcher(doc, query)]
            expect(textSearchEquivalence(query, text, opts)).toEqual(matches.length !== 0)
            matches.forEach(m => {
                expect(textSearchEquivalence(getMatchText(m.range), text, opts)).toBe(matches.length !== 0)
            })
        })
    })
    describe('With options: case sensitive, no ignore punctuation, no whole words', () => {
        test.for(strs)('query: "$query"', ({query, content, locales = 'en'}) => {
            const { doc, matcher, text } = setupTest(content, { locales, matchCase: true, ignorePunctuation: false })
            const opts = { locales, caseSensitive: true, ignorePunctuation: false }
            const matches = [...matcher(doc, query)]
            expect(textSearchEquivalence(query, text, opts)).toEqual(matches.length !== 0)
            matches.forEach(m => {
                expect(textSearchEquivalence(getMatchText(m.range), text, opts)).toBe(matches.length !== 0)
            })
        })
    })
    describe('With options: no case sensitive, no ignore punctuation, no whole words', () => {
        test.for(strs)('', ({query, content, locales = 'en'}) => {
            const { doc, matcher, text } = setupTest(content, { locales, matchCase: false, ignorePunctuation: false })
            const opts = { locales, ignorePunctuation: false }
            const matches = [...matcher(doc, query)]
            expect(textSearchEquivalence(query, text, opts)).toEqual(matches.length !== 0)
            matches.forEach(m => {
                expect(textSearchEquivalence(getMatchText(m.range), text, opts)).toBe(matches.length !== 0)
            })
        })
    })
    describe('With options: no case sensitive, ignore punctuation, no whole words', () => {
        test.for(strs)('', ({query, content, locales = 'en'}) => {
            const { doc, matcher, text } = setupTest(content, { locales, matchCase: false, ignorePunctuation: true })
            const opts = { locales }
            const matches = [...matcher(doc, query)]
            expect(textSearchEquivalence(query, text, opts)).toEqual(matches.length !== 0)
            matches.forEach(m => {
                expect(textSearchEquivalence(getMatchText(m.range), text, opts)).toBe(matches.length !== 0)
            })
        })
    })
    // a match can end inside a character, covering all of it: 'gros' is found in 'groß' (as in 'grosse'),
    // and 'ine' is found in ﬁne', while textSearchEquivalence compares whole texts
    test.for([
        [true, true], [true, false], [false, false], [false, true],
    ])('a match that ends inside a character (case sensitive: %s, ignore punctuation: %s)', ([matchCase, ignorePunctuation]) => {
        const { doc, matcher, text } = setupTest('<p>groß</p>', { locales: 'de', matchCase, ignorePunctuation })
        const opts = { locales: 'de', caseSensitive: matchCase, ignorePunctuation }
        expect([...matcher(doc, 'gros')].map(m => getMatchText(m.range))).toEqual(['groß'])
        expect(textSearchEquivalence('gros', text, opts)).toBe(false)
    })
})
