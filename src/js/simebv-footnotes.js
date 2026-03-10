import { FootnoteHandler } from '../../vendor/foliate-js/footnotes.js'
import { transformDoc, getCSS } from './simebv-transform-ebook.js'
import { pluginBaseUrl } from './simebv-utils.js'
import { SpeechManager } from './simebv-speech.js'
const { __, _x, _n, sprintf } = wp.i18n


export class FootnoteManager {
    #handler = new FootnoteHandler()
    #reader
    #options
    #notesDlg
    #notesDlgHeaderTypes = {
        'biblioentry': __('Bibliography', 'simple-ebook-viewer'),
        'definition': __('Definition', 'simple-ebook-viewer'),
        'endnote': __('Note', 'simple-ebook-viewer'),
        'footnote': __('Note', 'simple-ebook-viewer'),
    }
    #defaultFontSize
    #speechManager

    constructor(reader, options, defaultFontSize) {
        this.#reader = reader
        this.#options = options
        this.#defaultFontSize = defaultFontSize
    }

    handleFootnotes(detectFootnotes = true) {
        this.#handler.detectFootnotes = !!detectFootnotes
        this.#reader.view.addEventListener('link', (e) => {
            this.#handler.handle(this.#reader.view.book, e)
        })
        this.#handler.addEventListener('before-render', (e) => {
            const { view } = e.detail
            view.book.transformTarget?.addEventListener('data', ({ detail }) => {
                detail.data = transformDoc(detail, this.#options, this.#defaultFontSize)
            })
            if (!this.#notesDlg) {
                this.#notesDlg = this.#createDialog()
                this.#reader._rootDiv.append(this.#notesDlg)
                if (screen?.orientation) {
                    screen.orientation.addEventListener('change', () => {
                        this.#updateDialogSize()
                    })
                }
            }
            this.#updateDialogSize()
            this.#notesDlg.querySelector('#simebv-notes-dialog-contents').replaceChildren(view)
            if (this.#speechManager) {
                this.#speechManager.destroy()
            }
            this.#speechManager = new SpeechManager(view, this.#notesDlg, pluginBaseUrl(), {
                savePreference: this.#reader._savePreference.bind(this.#reader),
                loadPreference: this.#reader._loadPreference.bind(this.#reader),
            })
        })
        this.#handler.addEventListener('render', (e) => {
            const { view, type } = e.detail
            view.renderer.setAttribute('flow', 'scrolled')
            view.renderer.setAttribute('gap', '2%')
            view.renderer.setAttribute('margin', '5px')
            view.renderer.setAttribute('max-block-size', '100%')
            view.renderer.setStyles?.(getCSS(this.#reader.style) + '* { overflow-wrap: break-word; }')
            this.#notesDlg.querySelector('#simebv-notes-dialog-header')
                .textContent = this.#notesDlgHeaderTypes[type] ?? __('Note', 'simple-ebook-viewer')
            this.#notesDlg.showModal()
        })
    }

    #createDialog() {
        const notesDlg = document.createElement('dialog')
        notesDlg.id = 'simebv-notes-dialog'
        notesDlg.setAttribute('aria-labelledby', 'simebv-notes-dialog-header')
        const notesContainer = document.createElement('div')
        notesContainer.id = 'simebv-notes-dialog-container'
        const notesHeader = document.createElement('h2')
        notesHeader.textContent = __('Note', 'simple-ebook-viewer')
        notesHeader.classList.add('simebv-header-dialog')
        notesHeader.id = 'simebv-notes-dialog-header'
        const notesTopBtnContainer = document.createElement('div')
        notesTopBtnContainer.classList.add('simebv-notes-dialog-controls')
        const speechIcon = document.createElement('button')
        speechIcon.classList.add('simebv-speech-dlg-button', 'simebv-notes-dlg-button')
        speechIcon.innerHTML = `
        <svg id="speakerIcon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-5 4h-4v6h4l5 4V5z"/>
            <path d="M16.5 8.7a15 9 0 0 1 0 7.07"/>
        </svg>`
        speechIcon.setAttribute('aria-label', __('Read aloud...'))
        speechIcon.setAttribute('aria-pressed', false)
        speechIcon.addEventListener('click', () => {
            speechIcon.setAttribute('aria-pressed', true)
            speechIcon.disabled = true
            this.#speechManager.open(true)
        })
        const notesContents = document.createElement('div')
        notesContents.id = 'simebv-notes-dialog-contents'
        const notesBtnContainer = document.createElement('div')
        notesBtnContainer.id = 'simebv-notes-dialog-buttons'
        const notesBtn = document.createElement('button')
        notesBtn.textContent = __('OK', 'simple-ebook-viewer')
        notesBtn.addEventListener('click', () => notesDlg.close())
        notesDlg.append(notesContainer)
        notesContainer.append(notesHeader, notesTopBtnContainer, notesContents, notesBtnContainer)
        notesTopBtnContainer.append(speechIcon)
        notesBtnContainer.append(notesBtn)
        notesDlg.addEventListener('close', () => {
            if (this.#speechManager) {
                this.#speechManager.destroy()
                this.#speechManager = null
                speechIcon.setAttribute('aria-pressed', false)
                speechIcon.disabled = false
            }
            this.#reader.container.focus()
        })
        notesDlg.addEventListener('simebv-speech-close', () => {
            speechIcon.setAttribute('aria-pressed', false)
            speechIcon.disabled = false
        })
        return notesDlg
    }

    #updateDialogSize() {
        if (globalThis.innerWidth > globalThis.innerHeight) {
            this.#notesDlg.style.width = 'min(80vw, 480px)'
            this.#notesDlg.style.height = 'min(90vh, 480px)'
        }
        else {
            this.#notesDlg.style.width = 'min(90vw, 480px)'
            this.#notesDlg.style.height = 'min(80vh, 480px)'
        }
        this.#notesDlg.style.maxWidth = (this.#reader.containerWidth - 10) + 'px'
        this.#notesDlg.style.maxHeight = (this.#reader.containerHeight - 10) + 'px'
    }

}
