import { expect, test, describe } from 'vitest'
import { joinLines } from '../../../vendor/foliate-js/search.js'

/*
 * joinLines decides how two lines of a pdf text layer (or the last line of a page and
 * the first line of the next one) are joined: it returns the text before the break,
 * without a hyphen that splits a word, and the separator to add after it.
 * Here each case checks the joined text: before (changed) + separator + after.
 */

const join = (before, after) => {
    const [text, sep] = joinLines(before, after)
    return text + sep + after
}

const cases = (name, rows) => describe(name, () => {
    test.each(rows)('%s', (_, before, after, expected) => {
        expect(join(before, after)).toBe(expected)
    })
})

cases('a hyphen between letters splits a word', [
    ['hyphen-minus', 'charac-', 'teristically', 'characteristically'],
    ['soft hyphen', 'charac­', 'teristically', 'characteristically'],
    ['hyphen', 'charac‐', 'teristically', 'characteristically'],
    ['non-breaking hyphen', 'charac‑', 'teristically', 'characteristically'],
    ['fullwidth hyphen-minus', 'charac－', 'teristically', 'characteristically'],
    ['Armenian hyphen', 'Հայ֊', 'աստան', 'Հայաստան'],
    ['double oblique hyphen', 'Zei⸗', 'tung', 'Zeitung'],
    ['combining mark before the hyphen', 'café-', 'teria', 'caféteria'],
])

cases('a hyphen or a dash attached to the previous character is kept, without a space', [
    ['number range', 'see pages 10-', '20 of', 'see pages 10-20 of'],
    ['letters, then a number', 'COVID-', '19 cases', 'COVID-19 cases'],
    ['en dash range', 'pages 10–', '20', 'pages 10–20'],
    ['em dash', 'wait—', 'then', 'wait—then'],
    ['hyphen at the end of the text', 'charac-', '', 'charac-'],
])

cases('a hyphen or a dash with a space before it is kept, with a space', [
    ['spaced hyphen', 'this is -', 'as you know', 'this is - as you know'],
    ['spaced em dash', 'this is —', 'as you know', 'this is — as you know'],
    ['line with only a hyphen', '-', 'Total', '- Total'],
])

cases('scripts without spaces between words are joined without a space', [
    ['Chinese', '这是一个', '句子。', '这是一个句子。'],
    ['Japanese', '文章の', 'つづき', '文章のつづき'],
    ['Thai', 'ภาษา', 'ไทย', 'ภาษาไทย'],
    ['CJK ideograph outside the BMP', '𠀀', 'x', '𠀀x'],
    ['Latin, then Katakana', 'Apri il PDF', 'ファイル', 'Apri il PDFファイル'],
])

// in a pdf text layer the line ends are <br>s, so white space in the text was in the pdf
cases('white space at the edges of the lines is text: it is kept, and no separator is added', [
    ['space at the end', 'word ', 'next', 'word next'],
    ['space at the start', 'word', ' next', 'word next'],
    ['suspended hyphen', 'pre- ', 'and post-war', 'pre- and post-war'],
    ['suspended hyphen after a number', '10- ', 'and 20-year', '10- and 20-year'],
    ['a hyphenation hyphen is never followed by a space', 'charac- ', 'teristically', 'charac- teristically'],
    ['space between Thai phrases', 'ภาษาไทย ', 'ง่าย', 'ภาษาไทย ง่าย'],
    ['space between Chinese and Latin', '使用 ', 'PDF', '使用 PDF'],
    ['space between Latin and Katakana', 'Apri il PDF ', 'ファイル', 'Apri il PDF ファイル'],
    ['ideographic space', '山田　', '太郎', '山田　太郎'],
])

cases('other lines are joined with a space', [
    ['words', 'like', 'internationalization', 'like internationalization'],
    ['sentence end', 'The end.', 'Next', 'The end. Next'],
    ['minus sign', '2−', '3', '2− 3'],
    ['Korean (it uses spaces, so a break inside a word cannot be told apart)', '한국', '어', '한국 어'],
])
