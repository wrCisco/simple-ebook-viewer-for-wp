import { textWalker } from '../../../vendor/foliate-js/text-walker.js'
import { TTS } from '../../js/simebv-tts.js'

// speech-rule-engine is only used for math
export const SRE = { updateLocale: async () => {}, engine: { toSpeech: () => '' } }

export function loadIframe(source, type = 'text/html') {
    return new Promise(resolve => {
        const iframe = document.createElement('iframe')
        iframe.style.cssText = 'width: 800px; height: 1100px; border: 0'
        const url = URL.createObjectURL(new Blob([source], { type }))
        iframe.addEventListener('load', () => {
            URL.revokeObjectURL(url)
            resolve(iframe)
        }, { once: true })
        iframe.src = url
        document.body.append(iframe)
    })
}

/** The words of a range, numbered like the marks of the TTS (same walker, same segmentation) */
export function rangeWords(range) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'word' })
    return [...textWalker(range, function* (strs) {
        for (const x of segmenter.segment(strs.join(''))) if (x.isWordLike) yield x.segment
    })]
}

/** The text of an SSML string, and the first word after each mark */
export function parseSSML(s) {
    const doc = new DOMParser().parseFromString(s, 'application/xml')
    const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
    let flat = ''
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.nodeType === Node.TEXT_NODE) flat += n.nodeValue
        else if (n.localName === 'mark') flat += `\u0000${n.getAttribute('name')}\u0000`
    }
    const marks = {}
    for (const m of flat.matchAll(/\u0000(\d+)\u0000[^\p{L}\p{N}\u0000]*([\p{L}\p{N}]+)/gu)) marks[m[1]] = m[2]
    return { text: doc.documentElement.textContent.replace(/\s+/gu, ' ').trim(), marks }
}

/**
 * The marks whose word in the SSML doesn't start the word with the same number in the
 * highlighted range. The SSML word can be shorter: the text layer has no space between
 * lines, so in the range the last word of a line and the first of the next one are one
 * word (one mark), while the SSML has a space between them.
 */
export function markMismatches(marks, range) {
    const words = rangeWords(range)
    return Object.entries(marks)
        .filter(([name, word]) => !words[name]?.startsWith(word))
        .map(([name, word]) => `mark ${name}: "${word}" in the SSML, "${words[name]}" in the range`)
}

/** Reads the whole document: for each block, the SSML, its text, the highlighted range and the marks */
export async function readAll(doc, format) {
    const blocks = []
    let highlighted
    const tts = new TTS(doc, textWalker, range => highlighted = range, 'word', SRE, format)
    for (let s = await tts.start(); s !== undefined; s = await tts.next(true)) {
        const { text, marks } = parseSSML(s)
        blocks.push({ ssml: s, text, range: highlighted, marks })
        highlighted = null
    }
    return blocks
}

/** The SSML text from the first occurrence of word in the document */
export async function readFrom(doc, format, word) {
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode()) && !node.nodeValue.includes(word));
    const range = doc.createRange()
    const i = node.nodeValue.indexOf(word)
    range.setStart(node, i)
    range.setEnd(node, i + word.length)
    const tts = new TTS(doc, textWalker, () => {}, 'word', SRE, format)
    return parseSSML(await tts.from(range)).text
}

/** Letters only, to compare the text of a range with the SSML (which adds spaces and removes hyphens) */
export const letters = s => s.replace(/[\s\-­]/gu, '')
