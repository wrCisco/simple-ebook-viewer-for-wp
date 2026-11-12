import { expect, test, describe } from 'vitest'
import { crossSectionText, searchCrossSections } from '../../../vendor/foliate-js/search.js'

/*
 * Search across the page breaks of fixed-layout books: crossSectionText appends the
 * beginning of the following pages to the text of a page, joined with joinLines.
 * The pages are fake sections, made of the strings a text walker would give.
 */

const makeSections = pages => pages.map(strs => ({ createDocument: async () => ({ strs }) }))
// the "range" of a match part is the arguments of makeRange: [startIndex, startOffset, endIndex, endOffset]
const walker = (doc, func) => func(doc.strs, (...args) => args)

const find = async (pages, query, opts = {}) => {
    const results = []
    for await (const r of searchCrossSections(query, opts, 0, makeSections(pages), walker, new Map()))
        results.push(r)
    return results
}

const modes = {
    'default options': {},
    'match case and diacritics (simpleSearch)': { matchCase: true, matchDiacritics: true },
    'ignore punctuation': { ignorePunctuation: true },
}
const wholeWords = { matchWholeWords: true }

const splitWords = [
    ['hyphen', [['The word charac-'], ['teristically appears']]],
    ['white space nodes around the page break', [['The word charac-', ' \n'], ['\n  ', 'teristically appears']]],
    ['soft hyphen', [['The word charac­'], ['teristically appears']]],
    ['non-breaking hyphen', [['The word charac‑'], ['teristically appears']]],
    ['blank page between', [['The word charac-'], ['  '], ['teristically appears']]],
]

describe('a word split across pages', () => {
    describe.each(Object.entries(modes))('%s', (_, opts) => {
        test.each(splitWords)('%s', async (_, pages) => {
            const results = await find(pages, 'characteristically', opts)
            expect(results).toHaveLength(1)
            expect(results[0].parts.map(p => p.index)).toEqual([0, pages.length - 1])
        })
    })

    test('the part on the first page still covers the hyphen', async () => {
        const [{ parts }] = await find([['The word charac-'], ['teristically appears']], 'characteristically')
        expect(parts[0].range).toEqual([0, 9, 0, 'The word charac-'.length])
        expect(parts[1].range).toEqual([0, 0, 0, 'teristically'.length])
    })

    // known limit: with whole words, segmenterSearch segments each string separately,
    // so a word in two text nodes is never found (it happens inside pages too)
    test.fails('whole words (known limit)', async () => {
        expect(await find(splitWords[0][1], 'characteristically', wholeWords)).toHaveLength(1)
    })
})

describe('words on different pages', () => {
    const pages = [['last word'], ['first word']]

    test('are separated by a space', async () => {
        expect(await find(pages, 'word first')).toHaveLength(1)
        expect(await find(pages, 'word first', wholeWords)).toHaveLength(1)
        expect(await find(pages, 'wordfirst')).toHaveLength(0)
    })

    test('a hyphen attached to a number is kept', async () => {
        expect(await find([['see pages 10-'], ['20 of the book']], '10-20')).toHaveLength(1)
    })

    test('white space at the end of a page is text: a suspended hyphen keeps its space', async () => {
        const pages = [['in the pre- '], ['and post-war periods']]
        expect(await find(pages, 'pre- and post-war')).toHaveLength(1)
        expect(await find(pages, 'preand')).toHaveLength(0)
    })

    test('white space at the start of a page is text', async () => {
        const pages = [['Apri il PDF'], [' ファイル']]
        expect(await find(pages, 'PDF ファイル')).toHaveLength(1)
        expect(await find(pages, 'PDFファイル')).toHaveLength(0)
    })
})

describe('scripts without spaces between words', () => {
    const cases = [
        ['Chinese', [['这是一个'], ['句子。']], '一个句子'],
        ['Japanese', [['文章の'], ['つづき']], 'のつづき'],
        ['Chinese, blank page between', [['这是一个'], [''], ['句子。']], '一个句子'],
    ]
    describe.each(Object.entries({ ...modes, 'whole words': wholeWords }))('%s', (_, opts) => {
        test.each(cases)('%s', async (_, pages, query) => {
            const results = await find(pages, query, opts)
            expect(results).toHaveLength(1)
            expect(results[0].parts.map(p => p.index)).toEqual([0, pages.length - 1])
        })
    })
})

test('the strings of the cached pages are not changed', async () => {
    const cache = new Map()
    const sections = makeSections([['The word charac-'], ['teristically appears']])
    const t = await crossSectionText(0, sections, walker, cache, 100, 3)
    expect(t.strs).toEqual(['The word charac', '', 'teristically appears'])
    expect(cache.get(0).strs).toEqual(['The word charac-'])
})
