import { __, _x, _n, sprintf } from './simebv-i18n.js'


export function addBookmarkDialog(target) {
    const dlg = document.createElement('dialog')
    dlg.classList.add('simebv-form-dialog')
    dlg.setAttribute('aria-labelledby', 'simebv-add-bookmarks-dlg-header')

    const form = document.createElement('form')
    form.setAttribute('method', 'dialog')

    const h = document.createElement('h2')
    h.classList.add('simebv-header-dialog')
    h.id = 'simebv-add-bookmarks-dlg-header'

    const fs = document.createElement('fieldset')

    const displayLoc = document.createElement('p')
    displayLoc.classList.add('simebv-bookmark-loc')

    const noteLabel = document.createElement('label')
    noteLabel.textContent = __('Note (optional)', 'simple-ebook-viewer')
    noteLabel.classList.add('simebv-label-block')
    const note = document.createElement('textarea')
    note.maxLength = 512
    note.classList.add('simebv-textarea-block')
    note.id = 'simebv-note-input-text'
    noteLabel.htmlFor = note.id

    const legend = document.createElement('p')
    legend.classList.add('simebv-add-bookmarks-storage-legend')
    legend.textContent = __('It will be saved on this device and in this browser only. Clearing your browsing data, or not visiting this site for a while, may delete it.', 'simple-ebook-viewer')

    const buttons = document.createElement('div')
    buttons.classList.add('simebv-dialog-buttons')
    const ok = document.createElement('button')
    ok.textContent = __('Save', 'simple-ebook-viewer')
    ok.type = 'submit'
    const cancel = document.createElement('button')
    cancel.textContent = __('Cancel', 'simple-ebook-viewer')
    cancel.type = 'button'
    cancel.addEventListener('click', () => dlg.dispatchEvent(new CustomEvent('cancel')))

    const locationData = {}
    let textInBook = ''
    let returnFocus
    dlg.addEventListener('submit', () => {
        target.dispatchEvent(new CustomEvent(
            'save-bookmark', { detail:
                {
                    content: note.value,
                    loc: locationData.data,
                    textInBook,
                    label: displayLoc.textContent,
                    returnFocus,
                }
            }
        ))
        close()
    })

    buttons.append(ok, cancel)
    fs.append(displayLoc, noteLabel, note, legend)
    form.append(h, fs, buttons)
    dlg.append(form)

    const setData = (location, content, text, editedBookmark, header) => {
        const { label, data } = location
        displayLoc.textContent = label
        locationData.data = data
        note.value = content
        returnFocus = editedBookmark
        textInBook = text
        h.textContent = header
    }

    const close = () => {
        const f = returnFocus
        const loc = locationData.data
        setData({label: '', data: null}, '', false, '')
        if (dlg.open) dlg.close()
        if (f) target.dispatchEvent(new CustomEvent('focus-bookmark', { detail: { loc }}))
    }

    dlg.addEventListener('cancel', close)

    return { element: dlg, setData }
}
