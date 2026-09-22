import { View } from '../../vendor/foliate-js/view.js'
import { textWalker } from '../../vendor/foliate-js/text-walker.js'
import { startSREEngine } from './simebv-sre.js'

export class SimebvView extends View {

    goToLandmark(name) {
        const target = ['bodymatter', 'text'].includes(name) ? ['bodymatter', 'text'] : [name]
        return this.goTo(this.book.landmarks
            ?.find(m => target.some(t => m.type.includes(t)))
            ?.href ?? this.book.sections.findIndex(s => s.linear !== 'no'))
    }

    async init({ lastLocation, landmark }) {
        const resolved = lastLocation ? this.resolveNavigation(lastLocation) : null
        if (resolved) {
            await this.renderer.goTo(resolved)
            this.history.pushState(lastLocation)
        }
        else if (landmark) await this.goToLandmark(landmark)
        else {
            this.history.pushState(0)
            await this.next()
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
