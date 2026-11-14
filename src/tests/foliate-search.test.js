import { expect, test, describe, beforeAll, afterAll } from 'vitest'
import { search } from '../../vendor/foliate-js/search.js'

/*
 * The text search of foliate-js (search() in vendor/foliate-js/search.js) on arrays
 * of strings, one for each text node, as the text walker gives them.
 */

const sensitivities = {
    'default': 'base',
    'match case': 'case',
    'match diacritics': 'accent',
    'match case and diacritics': 'variant',
}
// all the combinations of the options, as searchOptions() makes them
const allOptions = Object.entries(sensitivities).flatMap(([name, sensitivity]) =>
    [false, true].flatMap(ignorePunctuation => ['grapheme', 'word'].map(granularity => ({
        name: [name, ignorePunctuation && 'ignore punctuation', granularity === 'word' && 'whole words']
            .filter(Boolean).join(', '),
        options: { locales: 'it', sensitivity, ignorePunctuation, granularity },
    }))))

// the matched text of each result
const find = (strs, query, options) => Array.from(search(strs, query, options), r => r.excerpt.match)

describe('the query matches wherever the collator considers it equal to the text', () => {
    const pairs = [
        // [name, text, query]
        ['decomposed text, precomposed query', 'café', 'café'],
        ['precomposed text, decomposed query', 'café', 'café'],
        ['ligature in the text', 'ﬁne', 'fine'],
        ['ligature in the query', 'fine', 'ﬁne'],
        ['sharp s in the text', 'straße', 'strasse'],
        ['sharp s in the query', 'strasse', 'straße'],
        ['capital sharp s', 'STRAẞE', 'STRASSE'],
        ['ĳ digraph', 'ĳs', 'ijs'],
        ['ǆ digraph', 'ǆep', 'džep'],
        ['squared unit', '5 ㎏', '5 kg'],
        ['Roman numeral', 'Luigi Ⅻ', 'Luigi XII'],
        ['Arabic ligature', 'ﻻ', 'لا'],
        ['final sigma', 'λόγος', 'λόγοσ'],
        ['fullwidth letters', 'ＡＢ', 'AB'],
        ['superscript', 'm²', 'm2'],
        ['soft hyphen', 'charac­teristically', 'characteristically'],
        ['Arabic tatweel', 'كـتـاب', 'كتاب'],
        ['different words', 'parola', 'parole'],
    ]
    describe.each(pairs)('%s', (_, text, query) => {
        test.each(allOptions)('$name', ({ options }) => {
            const { locales, sensitivity, ignorePunctuation } = options
            const equal = new Intl.Collator(locales, { usage: 'search', sensitivity, ignorePunctuation })
                .compare(text, query) === 0
            expect(find([`x ${text} y`], query, options)).toEqual(equal ? [text] : [])
        })
    })

    // where the collator considers a character equal to several (e.g. 'ﬁ' and 'fi'), a match can
    // start or end inside it, and covers the whole character; but a part of a character is not a whole word
    describe.each([
        // [text, equal text, query, match]
        ['ﬁne', 'fine', 'ine', 'ﬁne'],
        ['ﬁne', 'fine', 'f', 'ﬁ'],
        ['straße', 'strasse', 'stras', 'straß'],
        ['5 ㎏', '5 kg', 'g', '㎏'],
    ])('a match inside a character: %s, %s, %s', (text, equalText, query, match) => {
        test.each(allOptions)('$name', ({ options }) => {
            const { locales, sensitivity, ignorePunctuation, granularity } = options
            const equal = new Intl.Collator(locales, { usage: 'search', sensitivity, ignorePunctuation })
                .compare(text, equalText) === 0
            expect(find([text], query, options)).toEqual(equal && granularity === 'grapheme' ? [match] : [])
        })
    })

    test('a character is found once, even if the query matches several of its parts', () => {
        expect(find(['Straße'], 's', { locales: 'de', sensitivity: 'base', granularity: 'grapheme' })).toEqual(['S', 'ß'])
    })
})

// 'İ'.toLocaleLowerCase('en') and 'Ì'.toLocaleLowerCase('lt') are longer than the original
describe.each([
    ['en', 'İstanbul is big.'],
    ['en', 'İstanbul is big'],
    ['lt', 'Ìtaka is big'],
])('the ranges are right when changing the case changes the length (%s: %s)', (locales, text) => {
    test.each(allOptions)('$name', ({ options }) => {
        expect(find([text], 'big', { ...options, locales })).toEqual(['big'])
    })
})

describe('text in several text nodes', () => {
    const wholeWords = { locales: 'en', sensitivity: 'base', granularity: 'word' }

    test.each(allOptions)('a word split in several nodes is found: $name', ({ options }) => {
        const [result, ...others] = search(['The word ', 'charac', 'teristically', ' appears'], 'characteristically', options)
        expect(others).toEqual([])
        expect(result.range).toEqual({ startIndex: 1, startOffset: 0, endIndex: 2, endOffset: 12 })
    })

    test.each(allOptions)('a combining mark in the next node is part of the character: $name', ({ options }) => {
        expect(find(['un caffe', '̀ caldo'], 'caffè', options)).toEqual(['caffè'])
    })

    test.each(allOptions)('runs of white space are a single space: $name', ({ options }) => {
        expect(find(['word\n   ', 'next'], 'word next', options)).toEqual(['word\n   next'])
    })

    test('a match that ends with white space ends with the whole run', () => {
        expect(find(['word\n   ', 'next'], 'word ', wholeWords)).toEqual(['word\n   '])
        expect(find(['word\n   ', 'next'], ' next', wholeWords)).toEqual(['\n   next'])
    })

    test('the edges of the nodes are also edges of words, as they can be the edges of blocks', () => {
        // e.g. <p>Chapter 1</p><p>The beginning</p>
        const strs = ['Chapter 1', 'The beginning']
        expect(find(strs, 'The', wholeWords)).toEqual(['The'])
        expect(find(strs, '1', wholeWords)).toEqual(['1'])
    })

    test('a part of a word is not a whole word', () => {
        expect(find(['characteristically'], 'charac', wholeWords)).toEqual([])
        expect(find(['characteristically'], 'teristically', wholeWords)).toEqual([])
    })

    test('ignoring punctuation and white space, whole words must still be the same words', () => {
        const options = { ...wholeWords, ignorePunctuation: true }
        expect(find(['a, b'], 'ab', options)).toEqual([])
        expect(find(['ab'], 'a b', options)).toEqual([])
        expect(find(['a, b'], 'a b', options)).toEqual(['a, b'])
        expect(find(["don't"], 'dont', options)).toEqual(["don't"])
    })

    test('a zero width space separates words', () => {
        expect(find(['a​b'], 'ab', wholeWords)).toEqual([])
        expect(find(['a​b'], 'ab', { ...wholeWords, ignorePunctuation: true })).toEqual([])
        expect(find(['a​b'], 'ab', { ...wholeWords, granularity: 'grapheme' })).toEqual(['a​b'])
    })
})

describe('without Intl.Segmenter', () => {
    let Segmenter
    beforeAll(() => {
        Segmenter = Intl.Segmenter
        Intl.Segmenter = undefined
    })
    afterAll(() => {
        Intl.Segmenter = Segmenter
    })
    const options = sensitivity => ({ locales: 'en', sensitivity, granularity: 'grapheme' })

    test.each(Object.entries(sensitivities))('soft hyphens, white space and text nodes: %s', (_, sensitivity) => {
        expect(find(['charac­teris', 'tically\n  appears'], 'characteristically appears', options(sensitivity)))
            .toEqual(['charac­teristically\n  appears'])
    })

    test.each(Object.entries(sensitivities))('decomposed characters: %s', (_, sensitivity) => {
        expect(find(['un caffè caldo'], 'caffè', options(sensitivity))).toEqual(['caffè'])
    })

    test.each([
        ['en', 'İstanbul is big'],
        ['lt', 'Ìtaka is big'],
    ])('the ranges are right when changing the case changes the length (%s: %s)', (locales, text) => {
        for (const sensitivity of Object.values(sensitivities))
            expect(find([text], 'big', { ...options(sensitivity), locales })).toEqual(['big'])
    })

    test('case and diacritics', () => {
        expect(find(['Città'], 'citta', options('base'))).toEqual(['Città'])
        expect(find(['Città'], 'citta', options('accent'))).toEqual([])
        expect(find(['Città'], 'Citta', options('case'))).toEqual(['Città'])
        expect(find(['Città'], 'citta', options('case'))).toEqual([])
        expect(find(['Città'], 'Città', options('variant'))).toEqual(['Città'])
        expect(find(['Città'], 'città', options('variant'))).toEqual([])
    })

    test('compatibility characters', () => {
        expect(find(['ﬁne'], 'fine', options('base'))).toEqual(['ﬁne'])
        expect(find(['ﬁne'], 'fine', options('variant'))).toEqual([])
        expect(find(['ﬁne'], 'ine', options('base'))).toEqual(['ﬁne'])
        expect(find(['Straße'], 's', options('base'))).toEqual(['S', 'ß'])
    })

    test('a match can end between the parts of a character, but not between a letter and its marks', () => {
        // 'İ' is 'I' and a combining dot above, U+0307
        expect(find(['İ'], 'i', options('base'))).toEqual(['İ'])
        expect(find(['İ'], 'i', options('accent'))).toEqual([])
    })
})
