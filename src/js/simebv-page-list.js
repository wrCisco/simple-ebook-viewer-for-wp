import { CFI } from './simebv-epubcfi.js'
import { getNonEmptyRange } from './simebv-non-empty-range.js'

function getLastNode(cfi) {
    for (let i = cfi.length - 1; i > 0; i--) {
        if (cfi[i] === '/' && /[0-9]/.test(cfi[i + 1])) {
            let j = i - 1
            let escapes = 0
            while (j && cfi[j] === '^') {
                escapes++
                j--
            }
            if (escapes % 2 === 0) {
                return cfi.substring(i + 1, cfi.length - 1)
            }
        }
    }
}

/**
 * Create the cfi ranges and other properties for the page list annotations.
 * The nodes referenced in the ebooks's page lists are often empty
 * elements, sometimes inside a paragraphs, sometimes between paragraphs.
 * In Chromium, range.getClientRects() (used by the overlayer to draw the annotations)
 * in some cases returns an empty list when dealing with empty (or whitespace only)
 * text nodes (cfr. https://issues.chromium.org/issues/41387258).
 * So, I try to circumvent this issue by searching non-whitespace-only text nodes:
 * if the node referenced by the ebook's page list contains non-whitespace text,
 * start and end node of the range are its non-whitespace-only descendant text node.
 * Otherwise the start node of the range is the node referenced by the
 * ebook's page list, and the end node may vary: the function tries to always get
 * a not-whitespace-only text node, but if there isn't one it uses the first
 * html element that follows the start node; and if there isn't even this,
 * it skips the entry.
 */
export function createPageListForAnnotations(reader, bookPageList, index, doc) {
    const pageList = []
    const pageListByValue = new Map()
    for (const p of bookPageList) {
        const { index: i, anchor } = reader.view.resolveNavigation(p.href)
        if (i !== index) {
            continue
        }
        const node = anchor(doc)
        const range = getNonEmptyRange(node)
        if (range.collapsed) continue
        const sectionCFI = reader.view.getCFI(index)
        const cfiRange = sectionCFI.replace(/\)$/, '!') + CFI.fromRange(range).replace(/^epubcfi\(/, '')
        const annotation = { value: cfiRange, type: 'page-list', label: p.label, href: p.href }
        pageList.push(annotation)
        pageListByValue.set(annotation.value, annotation)
    }
    return { pageList, pageListByValue }
}
