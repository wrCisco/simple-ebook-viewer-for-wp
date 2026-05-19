import { View } from '../../vendor/foliate-js/view.js'
import * as CFI from '../../vendor/foliate-js/epubcfi.js'
import { textWalker } from '../../vendor/foliate-js/text-walker.js'
import { startSREEngine } from './simebv-sre.js'
import { cfiFilter } from './simebv-utils.js'

export class SimebvView extends View {
    cfiFilter = cfiFilter

    getCFI(index, range) {
        const baseCFI = this.book.sections[index].cfi ?? CFI.fake.fromIndex(index)
        if (!range) return baseCFI
        return CFI.joinIndir(baseCFI, CFI.fromRange(range, this.cfiFilter))
    }
    resolveCFI(cfi) {
        if (this.book.resolveCFI)
            return this.book.resolveCFI(cfi, this.cfiFilter)
        else {
            const parts = CFI.parse(cfi)
            const index = CFI.fake.toIndex((parts.parent ?? parts).shift())
            const anchor = doc => CFI.toRange(doc, parts, this.cfiFilter)
            return { index, anchor }
        }
    }
    async initTTS(granularity = 'word', highlight, sreBaseUrl, format) {
        const { doc } = this.getCurrentContents()
        if (this.tts && this.tts.doc === doc) return
        const { TTS } = await import('./simebv-tts.js')
        const speechRuleEngine = await startSREEngine(sreBaseUrl)
        this.tts = new TTS(doc, textWalker, highlight || (range =>
            this.renderer.scrollToAnchor(range, true)), granularity, speechRuleEngine, format)
    }
}

customElements.define('simebv-foliate-view', SimebvView)
