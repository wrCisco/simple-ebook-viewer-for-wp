import { isAndroid, isNumeric } from './simebv-utils.js'
import { speechDialog } from './simebv-speech-dialog.js'
const { __, _x, _n, sprintf } = wp.i18n

export class SpeechManager {
    speechSynthesis = {
        synthesis: undefined,
        utterance: undefined,
        volume: 1,
        rate: 1,
        pitch: 1,
        lang: undefined,
        voice: undefined,
        lastCharRead: 0,
        paused: false,
        changedUtterance: false,
        warmup: undefined,
    }
    #view
    #target
    #localesBaseUrl
    #wakeLock
    #prefix = '<?xml version="1.0"?>'
    #speechErrors = {
        canceled: null,
        interrupted: null,
        'audio-busy': __("I cannot access the audio output device because it's already in use, maybe by another application.", 'simple-ebook-viewer'),
        'audio-hardware': __('I cannot identify an audio output channel on this device.', 'simple-ebook-viewer'),
        'network': __('A required network operation to start the speech synthesis failed.', 'simple-ebook-viewer'),
        'synthesis-unavailable': __('No speech synthesis engine available at this moment.', 'simple-ebook-viewer'),
        'synthesis-failed': __('The speech synthesis engine raised an error.', 'simple-ebook-viewer'),
        'language-unavailable': __('No appropriate voice available', 'simple-ebook-viewer'),
        'voice-unavailable': __('The selected voice is not available.', 'simple-ebook-viewer'),
        'text-too-long': __('The text is too long to synthesize.', 'simple-ebook-viewer'),
        'invalid-argument': __('The value of at least one amongst Speed, Pitch and Volume is not valid.', 'simple-ebook-viewer'),
        'not-allowed': __("The operation's start was not allowed.", 'simple-ebook-viewer'),
    }
    #isAndroid
    #savePreference
    #loadPreference
    #speechDialog
    #isNote

    constructor(view, eventTarget, localesBaseUrl, { savePreference, loadPreference } = {}) {
        this.#view = view
        this.#target = eventTarget
        this.#localesBaseUrl = localesBaseUrl
        this.#isAndroid = isAndroid()
        this.#savePreference = savePreference ?? (() => {})
        this.#loadPreference = loadPreference ?? (() => null)
    }

    #saveVoicePreference(voice) {
        if (voice) {
            this.#savePreference('speech-voice', { name: voice.name, lang: voice.lang })
        }
    }

    #loadVoicePreference() {
        const saved = this.#loadPreference('speech-voice')
        if (!saved) return null
        const voices = this.speechSynthesis.synthesis.getVoices()
        return voices.find(v => v.name === saved.name && v.lang === saved.lang)
            ?? voices.find(v => v.name === saved.name)
            ?? null
    }

    async open(isNote = false) {
        if (!this.#view?.book) {
            return
        }
        const synthesis = speechSynthesis
        if (!synthesis) {
            console.warn('Warning: no web speech API')
            return
        }
        this.speechSynthesis.synthesis = synthesis
        const speechProps = [
            ['volume', 0, 1, this.#loadPreference('speech-volume')],
            ['rate', 0, 2, this.#loadPreference('speech-rate')],
            ['pitch', 0, 2, this.#loadPreference('speech-pitch')],
        ]
        for (const [prop, min, max, val] of speechProps) {
            if (isNumeric(val) && val >= min && val <= max) {
                this.speechSynthesis[prop] = val
            }
        }
        const voice = this.#loadVoicePreference()
        if (voice) {
            this.speechSynthesis.voice = voice
        }
        await this.#view.initTTS('word', undefined, this.#localesBaseUrl)
        if (!this.#speechDialog) {
            const dlg = speechDialog(this.#target, this.speechSynthesis, isNote)
            dlg.element.id = 'simebv-speech-dialog'
            this.#target.append(dlg.element)
            this.#speechDialog = dlg
            this.#setupEventListeners()
        }
        this.#speechDialog.element.show()
        this.#speechDialog.element.classList.add('simebv-show')
        // to give the play button focus every time the dialog is opened.
        // the autofocus attribute is not sufficient
        setTimeout(() => this.#speechDialog.focus(), 5)
    }

    get isActive() {
        return !!this.speechSynthesis.synthesis
    }

    onSectionLoad() {
        this.#view.initTTS('word', undefined, this.#localesBaseUrl)
        this.speechSynthesis.utterance = undefined
    }

    static getDefaultVoice() {
        const s = speechSynthesis
        for (const voice of s.getVoices()) {
            if (voice.default) {
                return voice
            }
        }
    }

    static getSameLanguageVoice(lang) {
        const completeMatch = []
        const langMatch = []
        const s = speechSynthesis
        for (const voice of s.getVoices()) {
            if (lang === voice.lang) {
                completeMatch.push(voice)
            }
            else if (lang.slice(0, 2) === voice.lang.slice(0, 2)) {
                langMatch.push(voice)
            }
        }
        return completeMatch[0] ?? langMatch[0]
    }

    async #acquireWakeLock() {
        if (!('wakeLock' in navigator) || this.#wakeLock) return
        try {
            this.#wakeLock = await navigator.wakeLock.request('screen')
        }
        catch (err) {
            console.warn("Wake lock failed:", err)
            this.#wakeLock = null
        }
        if (this.#wakeLock) {
            this.#wakeLock.addEventListener('release', () => this.#wakeLock = null)
        }
    }

    #releaseWakeLock() {
        this.#wakeLock?.release()
        this.#wakeLock = null
    }

    #reacquireWakeLock() {
        if (document.visibilityState === 'visible' && this.speechSynthesis.synthesis?.speaking) {
            this.#acquireWakeLock()
        }
    }
    #boundReacquireWakeLock = this.#reacquireWakeLock.bind(this)
    
    #newUtterance(text, nextTexts = []) {
        const u = new SpeechSynthesisUtterance(text)
        u.volume = this.speechSynthesis.volume
        u.rate = this.speechSynthesis.rate
        u.pitch = this.speechSynthesis.pitch
        u.lang = this.speechSynthesis.lang
        this.#speechErrors['language-unavailable'] = sprintf(
            __('No appropriate voice available for the language %1$s', 'simple-ebook-viewer'),
            u.lang
        )
        let v = this.speechSynthesis.voice
        if (!v && u.lang) {
            v = SpeechManager.getSameLanguageVoice(u.lang)
        }
        if (!v) {
            v = SpeechManager.getDefaultVoice() ?? this.speechSynthesis.synthesis.getVoices()[0]
        }
        if (this.#isAndroid && v.lang.slice(0, 2) !== u.lang?.slice(0, 2)) {
            v = null
        }
        u.voice = v
        this.speechSynthesis.voice = v
        u.onend = async e => {
            if (this.speechSynthesis.utterance !== u) {
                return
            }
            this.speechSynthesis.lastCharRead = 0
            let s
            let utt
            if (nextTexts.length > 0) {
                s = nextTexts.shift()
                utt = this.#newUtterance(s, nextTexts)
            }
            else {
                s = await this.#view.tts.next(true)
                if (s) {
                    utt = this.#newUtterance(...this.#ssmlToStrings(this.#prefix + s))
                }
            }
            if (utt && !this.speechSynthesis.paused) {
                this.speechSynthesis.synthesis.speak(utt)
            }
            if (!s) {
                this.speechSynthesis.utterance = undefined
                this.#speechDialog.element.dispatchEvent(new CustomEvent('simebv-speech-dlg-toggle-playpause'))
            }
            this.speechSynthesis.paused = false
        }
        u.onpause = e => {
            this.speechSynthesis.lastCharRead = e.charIndex
        }
        u.onerror = (e) => {
            const type = e.error
            if (this.#speechErrors[type]) {
                alert('Error: ' + type + '\n' + this.#speechErrors[type])
                this.speechSynthesis.paused = false
            }
        }
        u.addEventListener('boundary', e => {
            this.speechSynthesis.lastCharRead = e.charIndex
        })
        u.addEventListener('mark', e => {
            this.speechSynthesis.lastCharRead = e.charIndex
        })
        this.speechSynthesis.utterance = u
        return u
    }

    #ssmlToStrings(ssml) {
        // TODO: reconsider direct use of ssml
        const doc = new DOMParser().parseFromString(ssml, 'application/xml')
        const lang = doc.documentElement.getAttributeNS?.('http://www.w3.org/XML/1998/namespace', 'lang')
        try {
            this.speechSynthesis.lang = Intl.getCanonicalLocales(lang)[0]
        }
        catch (err) {
            console.warn(err)
        }
        // Replace with punctuation the ssml pauses inserted
        // for math expressions by the Speech Rule Engine
        doc.querySelectorAll('break').forEach(el => {
            el.replaceWith(parseInt(el.getAttribute('time')) > 250 ? '...' : ',')
        })
        const text = doc.documentElement.textContent
        // with longer chunks Google voices may not start
        const maxLength = 4000
        if (text.length > maxLength) {
            const boundaries = [0]
            const segmenter = new Intl.Segmenter(this.speechSynthesis.lang, { granularity: "sentence" })
            const segments = segmenter.segment(text)
            let i = boundaries.at(-1)
            for (const s of segments) {
                if (s.index <= boundaries.at(-1) + maxLength - 1) {
                    i = s.index
                }
                else {
                    if (i > boundaries.at(-1)) {
                        boundaries.push(i)
                    }
                    else {
                        i = boundaries.at(-1) + maxLength - 1
                        // check that text[i] is not the trail of a surrogate pair
                        let codePoint = text[i].codePointAt(0)
                        if (codePoint >= 0xdc00 && codePoint <= 0xdfff) {
                            i--
                            codePoint = text[i].codePointAt(0)
                        }
                        boundaries.push(i)
                    }
                    i = boundaries.at(-1)
                }
            }
            const texts = boundaries.map((e, i) => text.slice(e, boundaries[i + 1]))
            return [texts[0], texts.slice(1)]
        }
        return [text, []]
    }

    #updateUtterance() {
        if (this.speechSynthesis.utterance) {
            const oldText = this.speechSynthesis.utterance.text
            const newText = oldText.slice(this.speechSynthesis.lastCharRead)
            this.#newUtterance(newText)
            this.speechSynthesis.lastCharRead = 0
        }
    }

    async #playHandler({ detail }) {
        const { doc } = this.#view.renderer.getContents()[0]
        const selection = doc.getSelection()
        let selectedRange
        if (selection?.type === 'Range') {
            selectedRange = selection.getRangeAt(0)
        }
        if (!this.speechSynthesis.utterance) {
            this.speechSynthesis.synthesis.cancel()
            setTimeout(async () => {
                const s = selectedRange ? (await this.#view.tts.from(selectedRange)) : (await this.#view.tts.start())
                const u = this.#newUtterance(...this.#ssmlToStrings(this.#prefix + s))
                // Add warmup utterance to avoid the cutting off of the first words by the Windows voices
                const warmup = new SpeechSynthesisUtterance('Silence...')
                warmup.volume = 0
                warmup.onend = () => {
                    this.speechSynthesis.warmup = undefined
                    this.speechSynthesis.synthesis.speak(u)
                }
                warmup.onerror = (e) => {
                    const type = e.error
                    if (this.#speechErrors[type]) {
                        alert('Error: ' + type + '\n' + this.#speechErrors[type])
                    }
                    this.speechSynthesis.warmup = undefined
                }
                this.speechSynthesis.warmup = warmup
                this.speechSynthesis.synthesis.speak(warmup)
                setTimeout(() => {
                    // Sometimes Firefox speech synthesis on Windows doesn't start without this
                    if (!this.#isAndroid) {
                        this.speechSynthesis.synthesis.pause()
                        this.speechSynthesis.synthesis.resume()
                    }
                }, 5)
            }, 50)
        }
        else {
            if (selectedRange) {
                const s = await this.#view.tts.from(selectedRange)
                this.speechSynthesis.synthesis.cancel()
                this.#newUtterance(...this.#ssmlToStrings(this.#prefix + s))
                this.speechSynthesis.synthesis.speak(this.speechSynthesis.utterance)
            }
            else if (this.speechSynthesis.paused && !this.#isAndroid) {
                this.speechSynthesis.synthesis.resume()
            }
            else {
                this.#updateUtterance()
                this.speechSynthesis.synthesis.cancel()
                this.speechSynthesis.synthesis.speak(this.speechSynthesis.utterance)
            }
        }
        this.speechSynthesis.paused = false
        this.#acquireWakeLock()
        document.addEventListener('visibilitychange', this.#boundReacquireWakeLock)
    }
    #boundPlayHandler = this.#playHandler.bind(this)

    #pauseHandler() {
        if (this.speechSynthesis.warmup) {
            this.speechSynthesis.warmup.onend = () => null
            this.speechSynthesis.synthesis.cancel()
            this.speechSynthesis.warmup = undefined
            this.speechSynthesis.utterance = undefined
        }
        else if (this.#isAndroid) {
            this.#updateUtterance()
            this.speechSynthesis.synthesis.cancel()
        }
        else {
            this.speechSynthesis.synthesis.pause()
            this.#view.deselect()
            this.speechSynthesis.paused = true
        }
    }
    #boundPauseHandler = this.#pauseHandler.bind(this)

    #closeHandler() {
        this.speechSynthesis.utterance = undefined
        this.speechSynthesis.voice = undefined
        this.speechSynthesis.paused = false
        this.speechSynthesis.warmup = undefined
        this.speechSynthesis.synthesis?.cancel()
        this.#releaseWakeLock()
        document.removeEventListener('visibilitychange', this.#boundReacquireWakeLock)
    }
    #boundCloseHandler = this.#closeHandler.bind(this)

    #updateHandler({ detail }) {
        if (detail && this.#isSpeechSynthesisToUpdate(this.speechSynthesis, detail)) {
            this.speechSynthesis.volume = detail.volume
            this.speechSynthesis.pitch = detail.pitch
            this.speechSynthesis.rate = detail.rate
            this.speechSynthesis.voice = detail.voice
            this.#savePreference('speech-volume', detail.volume)
            this.#savePreference('speech-pitch', detail.pitch)
            this.#savePreference('speech-rate', detail.rate)
            this.#saveVoicePreference(detail.voice)
            if (this.speechSynthesis.utterance) {
                this.#updateUtterance()
                this.speechSynthesis.synthesis.cancel()
                this.speechSynthesis.changedUtterance = true
            }
            this.speechSynthesis.paused = false
        }
    }
    #boundUpdateHandler = this.#updateHandler.bind(this)

    #resumeHandler() {
        if (!this.#isAndroid && !this.speechSynthesis.changedUtterance) {
            this.speechSynthesis.synthesis.resume()
        }
        else {
            this.speechSynthesis.synthesis.cancel()
            setTimeout(() => this.speechSynthesis.synthesis.speak(this.speechSynthesis.utterance), 200)
        }
        this.speechSynthesis.changedUtterance = false
        this.speechSynthesis.paused = false
    }
    #boundResumeHandler = this.#resumeHandler.bind(this)

    #prevSectionHandler() {
        const currentSection = this.#view.lastLocation?.section?.current
        if (currentSection > 0) {
            this.#view.goTo(currentSection - 1).catch(e => console.error(e))
            if (!this.speechSynthesis.paused && this.speechSynthesis.utterance) {
                this.#speechDialog.element.dispatchEvent(new CustomEvent('simebv-speech-dlg-toggle-playpause'))
            }
            this.speechSynthesis.paused = false
        }
    }
    #boundPrevSectionHandler = this.#prevSectionHandler.bind(this)

    #nextSectionHandler() {
        const currentSection = this.#view.lastLocation?.section?.current
        const totSections = this.#view.lastLocation?.section?.total
        if (currentSection < totSections) {
            this.#view.goTo(currentSection + 1).catch(e => console.error(e))
            if (!this.speechSynthesis.paused && this.speechSynthesis.utterance) {
                this.#speechDialog.element.dispatchEvent(new CustomEvent('simebv-speech-dlg-toggle-playpause'))
            }
            this.speechSynthesis.paused = false
        }
    }
    #boundNextSectionHandler = this.#nextSectionHandler.bind(this)

    #setupEventListeners() {
        this.#target.addEventListener('simebv-speech-play', this.#boundPlayHandler)
        this.#target.addEventListener('simebv-speech-pause', this.#boundPauseHandler)
        this.#target.addEventListener('simebv-speech-close', this.#boundCloseHandler)
        this.#target.addEventListener('simebv-speech-update', this.#boundUpdateHandler)
        this.#target.addEventListener('simebv-speech-resume', this.#boundResumeHandler)
        this.#target.addEventListener('simebv-speech-prev-section', this.#boundPrevSectionHandler)
        this.#target.addEventListener('simebv-speech-next-section', this.#boundNextSectionHandler)
    }

    #isSpeechSynthesisToUpdate(a, b) {
        return a.volume !== b.volume || a.pitch !== b.pitch || a.rate !== b.rate || a.voice !== b.voice
    }

    destroy() {
        this.#target.removeEventListener('simebv-speech-play', this.#boundPlayHandler)
        this.#target.removeEventListener('simebv-speech-pause', this.#boundPauseHandler)
        this.#target.removeEventListener('simebv-speech-close', this.#boundCloseHandler)
        this.#target.removeEventListener('simebv-speech-update', this.#boundUpdateHandler)
        this.#target.removeEventListener('simebv-speech-resume', this.#boundResumeHandler)
        this.#target.removeEventListener('simebv-speech-prev-section', this.#boundPrevSectionHandler)
        this.#target.removeEventListener('simebv-speech-next-section', this.#boundNextSectionHandler)
        this.#speechDialog?.element.remove()
        this.#speechDialog = null
        this.#closeHandler()
    }
}
