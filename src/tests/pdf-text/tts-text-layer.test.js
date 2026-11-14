import { expect, test, describe, beforeAll } from 'vitest'
import { loadIframe, readAll, readFrom, markMismatches } from './tts-helpers.js'

/*
 * TTS on mock pdf text layers, laid out like the output of pdf.js with marked content:
 * a .markedContent wrapper for each marked-content sequence, artifacts (running heads,
 * page numbers) with aria-hidden="true", text in role="presentation" spans, and a <br>
 * at the start of the wrapper of each new line. vendor/foliate-js/pdf.js stamps the
 * artifacts with data-foliate-artifact after rendering, so the mocks do the same.
 */

const span = (text, size = 12) => `<span role="presentation" style="--font-height:${size}px">${text}</span>`
const line = (text, size = 12, br = true) =>
    `<span class="markedContent">${br ? '<br role="presentation">' : ''}${span(text, size)}</span>`
const artifact = (spans, br = true) =>
    `<span class="markedContent" aria-hidden="true">${br ? '<br role="presentation">' : ''}${spans}</span>`

const textLayer = content => `<!doctype html>
<html><head><meta charset="utf-8"><style>
.textLayer { position: absolute; inset: 0 }
.markedContent { display: contents }
</style></head><body><div id="canvas"></div><div class="textLayer">${content}</div><div class="annotationLayer"></div></body></html>`

async function loadTextLayer(content) {
    const { contentDocument: doc } = await loadIframe(textLayer(content))
    for (const el of doc.querySelectorAll('.textLayer .markedContent[aria-hidden="true"]'))
        el.setAttribute('data-foliate-artifact', '')
    return doc
}

describe('artifacts', () => {
    let doc
    let blocks

    beforeAll(async () => {
        doc = await loadTextLayer(
            artifact(span('11/11/26, 10:00', 9) + span('Tagged test book', 9), false) +
            line('Chapter one', 20) +
            line('Body line one without a full stop') +
            artifact(span('Running head')) +
            line('body line two continues here.') +
            line('Section two', 20) +
            artifact(span('file:///C:/x.html', 9) + span('1/2', 9)))
        blocks = await readAll(doc, 'pdf')
    })

    test('are not read, and blocks made only of artifacts are skipped', () => {
        // the lines before and after an artifact in the middle of the page are never joined
        expect(blocks.map(b => b.text)).toEqual([
            'Chapter one',
            'Body line one without a full stop',
            'body line two continues here.',
            'Section two',
        ])
    })

    test('are not highlighted', () => {
        expect(blocks.map(b => b.range.toString())).toEqual(blocks.map(b => b.text))
    })

    test('are not counted by the word marks', () => {
        for (const block of blocks) expect(markMismatches(block)).toEqual([])
    })

    test('reading from a word skips the words before it', async () => {
        expect(await readFrom(doc, 'pdf', 'continues')).toBe('continues here.')
    })
})

describe('lines of a block', () => {
    // each case is two lines with the same font size and no sentence end between them,
    // so getBlocks puts them in the same block
    const cases = [
        ['a hyphen between letters is removed',
            line('The word charac-', 12, false) + line('teristically appears here.'),
            'The word characteristically appears here.'],
        ['the other lines are joined with a space',
            line('Extraordinarily long words like', 12, false) + line('internationalization appear here.'),
            'Extraordinarily long words like internationalization appear here.'],
        ['a hyphen attached to a number is kept',
            line('see pages 10-', 12, false) + line('20 of the book.'),
            'see pages 10-20 of the book.'],
        ['a spaced hyphen is kept',
            line('this is -', 12, false) + line('as you know.'),
            'this is - as you know.'],
        ['a suspended hyphen keeps the space after it',
            line('in the pre- ', 12, false) + line('and post-war periods.'),
            'in the pre- and post-war periods.'],
        ['the next line is checked after the word marks: no space before Katakana',
            line('Apri il PDF', 12, false) + line('ファイルを開く。'),
            'Apri il PDFファイルを開く。'],
        ['an artifact on the same line is not the line end',
            line('Another charac-', 12, false) + artifact(span('12'), false) + line('teristically example.'),
            'Another characteristically example.'],
        ['an artifact on the same line is not the line end (without a hyphen)',
            line('Some words and', 12, false) + artifact(span('12'), false) + line('more words here.'),
            'Some words and more words here.'],
        // pdf.js adds a <br> also for an empty line, without a span
        ['two <br> are a single line break',
            line('A first line that is longer than the next', 12, false) + '<br role="presentation">' + line('short end.'),
            'A first line that is longer than the next short end.'],
        ['two <br> after a hyphen between letters',
            line('Another charac-', 12, false) + '<br role="presentation">' + line('teristically example.'),
            'Another characteristically example.'],
        ['a comma does not end the block',
            line('First part,', 12, false) + line('second part.'),
            'First part, second part.'],
    ]

    test.each(cases)('%s', async (_, content, expected) => {
        const doc = await loadTextLayer(content)
        const blocks = await readAll(doc, 'pdf')
        expect(blocks.map(b => b.text)).toEqual([expected])
        expect(markMismatches(blocks[0])).toEqual([])
    })

    test('reading from the first word of a line starts from it', async () => {
        const doc = await loadTextLayer(line('Extraordinarily long words like', 12, false) + line('internationalization appear here.'))
        expect(await readFrom(doc, 'pdf', 'internationalization')).toBe('internationalization appear here.')
    })

    test('reading from the second half of a word split by a hyphen starts from the whole word', async () => {
        const doc = await loadTextLayer(line('The word charac-', 12, false) + line('teristically appears here.'))
        expect(await readFrom(doc, 'pdf', 'teristically')).toBe('characteristically appears here.')
    })

    test('a sentence end, a colon or a different font size end the block', async () => {
        const doc = await loadTextLayer(
            line('A heading', 20, false) +
            line('First sentence.') +
            line('A list follows:') +
            line('first item'))
        expect((await readAll(doc, 'pdf')).map(b => b.text))
            .toEqual(['A heading', 'First sentence.', 'A list follows:', 'first item'])
    })
})

describe('reflowable documents', () => {
    test('a document without block elements is read', async () => {
        const { contentDocument: doc } = await loadIframe(`<!doctype html><html><body>
<img alt="Cover" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
</body></html>`)
        expect((await readAll(doc, 'epub')).map(b => b.text)).toEqual(['Cover'])
    })

    test('a <br> is a pause, not a line join', async () => {
        const { contentDocument: doc } = await loadIframe(`<!doctype html><html><body>
<p>First verse<br>second verse</p>
</body></html>`)
        const [block] = await readAll(doc, 'epub')
        expect(block.ssml.replace(/<mark [^>]*\/>/g, '')).toMatch(/First verse<break\/>second verse/)
    })
})
