import { View } from '../../vendor/foliate-js/view.js'
import * as CFI from '../../vendor/foliate-js/epubcfi.js'
import { textWalker } from '../../vendor/foliate-js/text-walker.js'
import { startSREEngine } from './simebv-sre.js'

export class SimebvView extends View {
    static cfiFilter = node => {
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

    getCFI(index, range) {
        const baseCFI = this.book.sections[index].cfi ?? CFI.fake.fromIndex(index)
        if (!range) return baseCFI
        return CFI.joinIndir(baseCFI, CFI.fromRange(range, SimebvView.cfiFilter))
    }
    resolveCFI(cfi) {
        if (this.book.resolveCFI)
            return this.book.resolveCFI(cfi, SimebvView.cfiFilter)
        else {
            const parts = CFI.parse(cfi)
            const index = CFI.fake.toIndex((parts.parent ?? parts).shift())
            const anchor = doc => CFI.toRange(doc, parts, SimebvView.cfiFilter)
            return { index, anchor }
        }
    }
    async initTTS(granularity = 'word', highlight, sreBaseUrl) {
        const doc = this.renderer.getContents()[0].doc
        if (this.tts && this.tts.doc === doc) return
        const { TTS } = await import('./simebv-tts.js')
        const speechRuleEngine = await startSREEngine(sreBaseUrl)
        this.tts = new TTS(doc, textWalker, highlight || (range =>
            this.renderer.scrollToAnchor(range, true)), granularity, speechRuleEngine)
    }
}

customElements.define('simebv-foliate-view', SimebvView)
