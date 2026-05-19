import * as _ from '../../vendor/foliate-js/epubcfi.js'


export class CFI {
    static filter = node => {
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return NodeFilter.FILTER_ACCEPT
        }
        if (node.matches('[data-simebv-inject]')) {
            return NodeFilter.FILTER_REJECT
        }
        if (node.matches('[data-simebv-skip]')) {
            return NodeFilter.FILTER_SKIP
        }
        return NodeFilter.FILTER_ACCEPT
    }

    static isCFI = _.isCFI

    static joinIndir(...xs) {
        return _.joinIndir(...xs)
    }

    static parse(cfi) {
        return _.parse(cfi)
    }

    static collapse(x, toEnd) {
        return _.collapse(x, toEnd)
    }

    static compare(a, b) {
        return _.compare(a, b)
    }

    static fromRange(range, filter) {
        return _.fromRange(range, filter ?? CFI.filter)
    }

    static toRange(doc, parts, filter) {
        return _.toRange(doc, parts, filter ?? CFI.filter)
    }

    static fromElements(elements) {
        return _.fromElements(elements)
    }

    static toElement(doc, parts) {
        return _.toElement(doc, parts)
    }

    static fake = _.fake

    static fromCalibrePos(pos) {
        return _.fromCalibrePos(pos)
    }

    static fromCalibreHighlight(obj) {
        return _.fromCalibreHighlight(obj)
    }
}
