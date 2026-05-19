import { View } from '../../vendor/foliate-js/view.js'
import { textWalker } from '../../vendor/foliate-js/text-walker.js'
import { startSREEngine } from './simebv-sre.js'

export class SimebvView extends View {

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
