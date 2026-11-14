import { textWalker, pdfArtifactSelector } from '../../../vendor/foliate-js/text-walker.js'
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

/** The text of a range without artifacts (a word split across two lines can have one in the middle) */
const textWithoutArtifacts = range => {
    const fragment = range.cloneContents()
    for (const el of fragment.querySelectorAll(pdfArtifactSelector)) el.remove()
    return fragment.textContent
}

/**
 * The marks of a block whose word in the SSML doesn't start the word that the TTS
 * highlights for the mark (letters only: the highlighted word can have a hyphen
 * at the end of a line, and the SSML word stops at an apostrophe)
 */
export function markMismatches({ marks, words }) {
    return Object.entries(marks)
        .filter(([name, word]) => !letters(words[name] ?? '').startsWith(word))
        .map(([name, word]) => `mark ${name}: "${word}" in the SSML, "${words[name]}" highlighted`)
}

/**
 * Reads the whole document: for each block, the SSML, its text, the highlighted range,
 * the marks, and the word that the TTS highlights for each mark (with setMark)
 */
export async function readAll(doc, format) {
    const blocks = []
    let highlighted
    const tts = new TTS(doc, textWalker, range => highlighted = range, 'word', SRE, format)
    for (let s = await tts.start(); s !== undefined; s = await tts.next(true)) {
        const { text, marks } = parseSSML(s)
        const range = highlighted
        const words = {}
        for (const name of Object.keys(marks)) {
            highlighted = null
            tts.setMark(name)
            words[name] = highlighted && textWithoutArtifacts(highlighted)
        }
        blocks.push({ ssml: s, text, range, marks, words })
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
    return readFromRange(doc, format, range)
}

/** The SSML text from a range, e.g. a word selected by the user */
export async function readFromRange(doc, format, range) {
    const tts = new TTS(doc, textWalker, () => {}, 'word', SRE, format)
    return parseSSML(await tts.from(range)).text
}

/** Letters only, to compare the text of a range with the SSML (which adds spaces and removes hyphens) */
export const letters = s => s.replace(/[\s\-­]/gu, '')
