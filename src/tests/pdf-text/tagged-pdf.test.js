import { expect, test, describe, beforeAll } from 'vitest'
import { makePDF } from '../../../vendor/foliate-js/pdf.js'
import { textWalker } from '../../../vendor/foliate-js/text-walker.js'
import { searchCrossSections } from '../../../vendor/foliate-js/search.js'
import { readAll, markMismatches, letters } from './tts-helpers.js'

// a path from the root of the vite server: the asset urls made by vite (?url imports,
// new URL(..., import.meta.url)) have the origin of the server for WordPress (server.origin)
const taggedPdfUrl = '/src/tests/pdf-text/fixtures/tagged.pdf'

/*
 * The text of a real tagged pdf, as pdf.js renders it: TTS on the rendered pages,
 * and search on the documents made by createDocument.
 * fixtures/tagged.pdf is fixtures/tagged.html printed by Chrome, which tags the pdf
 * and marks its header (date and title) and footer (url and page number) as artifacts:
 *   chrome --headless=new --export-tagged-pdf --print-to-pdf=tagged.pdf tagged.html
 * It has two pages, and a paragraph that continues from the first to the second one.
 * vendor/foliate-js/pdf.js needs vitest.config.js to serve the files of pdf.js (see servePdfjs).
 */

// the line break in "marked-content" can't be told apart from a word split by hyphenation
const pages = [
    [
        'Chapter one',
        'Extraordinarily long words like internationalization, incomprehensibilities and characteristically uncharacteristic phraseology appear here so that the browser hyphenates them across consecutive lines of this deliberately narrow paragraph.',
        'A second paragraph with an italic phrase in the middle, which usually creates separate markedcontent sequences, followed by more text that wraps onto several lines.',
        'Section two',
        'Representativeness, counterrevolutionaries and institutionalization are further examples of long words; telecommunications and responsibilities follow them.',
        'Short.',
        'Final paragraph of the first page, then the text continues and continues until it reaches the bottom, where the running footer printed by Chrome should appear as an artifact.',
        'More filler text to reach a second page: the quick brown fox jumps over the lazy dog, again and again, with interdisciplinary considerations and electroencephalographic measurements included for good measure.',
        'Even more filler text to reach a second page: the quick brown fox jumps over the lazy dog, again and again, with interdisciplinary considerations',
    ],
    [
        'and electroencephalographic measurements included for good measure.',
        'Still more filler text to reach a second page: the quick brown fox jumps over the lazy dog, again and again, with interdisciplinary considerations and electroencephalographic measurements included for good measure.',
    ],
]

const artifactText = /Tagged test book|file:|\d+\/\d+/

let book

async function renderPage(index) {
    const { src, onZoom } = await book.sections[index].load()
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'width: 800px; height: 1100px; border: 0'
    await new Promise(resolve => {
        iframe.addEventListener('load', resolve, { once: true })
        iframe.src = src
        document.body.append(iframe)
    })
    await onZoom({ doc: iframe.contentDocument, scale: 1 })
    return iframe.contentDocument
}

beforeAll(async () => {
    const blob = await (await fetch(taggedPdfUrl)).blob()
    book = await makePDF(new File([blob], 'tagged.pdf'))
    expect(book.sections).toHaveLength(2)
})

describe.each([0, 1])('rendered page %i', index => {
    let doc
    let blocks

    beforeAll(async () => {
        doc = await renderPage(index)
        blocks = await readAll(doc, 'pdf')
    })

    test('the header and the footer are stamped as artifacts', () => {
        const artifacts = [...doc.querySelectorAll('.textLayer [data-foliate-artifact]')]
        expect(artifacts).toHaveLength(3)
        expect(artifacts.every(el => el.matches('.markedContent[aria-hidden="true"]'))).toBe(true)
    })

    test('TTS reads the blocks, without artifacts', () => {
        expect(blocks.map(b => b.text)).toEqual(pages[index])
    })

    test('TTS highlights the text it reads, without artifacts', () => {
        for (const { text, range } of blocks) expect(letters(range.toString())).toBe(letters(text))
    })

    test('the word marks match the highlighted words', () => {
        for (const { marks, range } of blocks) expect(markMismatches(marks, range)).toEqual([])
    })
})

describe('createDocument', () => {
    test.each([0, 1])('search text of page %i: lines joined, no artifacts', async index => {
        const doc = await book.sections[index].createDocument()
        const [strs] = textWalker(doc, function* (strs) { yield strs })
        const text = strs.join('')
        expect(text).toBe(pages[index].join(' '))
        expect(text).not.toMatch(artifactText)
    })

    test('search finds text across the page break', async () => {
        const query = 'considerations and electroencephalographic measurements included for good measure. Still'
        const results = []
        for await (const r of searchCrossSections(query, {}, 0, book.sections, textWalker, new Map()))
            results.push(r)
        expect(results).toHaveLength(1)
        expect(results[0].parts.map(p => p.index)).toEqual([0, 1])
        expect(results[0].parts.map(p => p.range.toString()).join(' ')).toBe(query)
    })
})
