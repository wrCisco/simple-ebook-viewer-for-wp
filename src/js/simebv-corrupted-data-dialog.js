import { __, _x, _n, sprintf } from './simebv-i18n.js'

export function corruptedDataDialog() {
    let corruptedData = ''
    let type = ''

    const dlg = document.createElement('dialog')
    dlg.setAttribute('aria-labelledby', 'simebv-corrupted-data-dialog-header')
    dlg.setAttribute('aria-describedby', 'simebv-corrupted-data-legend')
    dlg.classList.add('simebv-form-dialog')

    const form = document.createElement('form')
    form.setAttribute('method', 'dialog')

    const header = document.createElement('h2')
    header.classList.add('simebv-header-dialog')
    header.textContent = __('Corrupted data', 'simple-ebook-viewer')
    header.id = 'simebv-corrupted-data-dialog-header'

    const fieldset = document.createElement('fieldset')

    const legend = document.createElement('p')
    legend.id = 'simebv-corrupted-data-legend'
    legend.textContent = __(
        "Your saved bookmarks and reading positions for this site couldn't be read. " +
        "You can download a copy before deleting them. Until then, new bookmarks and " +
        "reading positions won't be saved.", 'simple-ebook-viewer'
    )

    const displayDataLabel = document.createElement('label')
    displayDataLabel.textContent = __('Raw data', 'simple-ebook-viewer')
    displayDataLabel.classList.add('simebv-label-block')
    const displayData = document.createElement('textarea')
    displayData.readOnly = true
    displayData.classList.add('simebv-textarea-block')
    displayData.id = 'simebv-corrupted-data-text'
    displayDataLabel.htmlFor = displayData.id

    fieldset.append(legend, displayDataLabel, displayData)

    const buttons = document.createElement('div')
    buttons.classList.add('simebv-dialog-buttons')
    const saveFile = document.createElement('button')
    saveFile.type = 'button'
    saveFile.textContent = __('Download data', 'simple-ebook-viewer')
    saveFile.addEventListener('click', e => { saveDataAsFile(corruptedData) })
    const copyData = document.createElement('button')
    copyData.type = 'button'
    copyData.textContent = __('Copy', 'simple-ebook-viewer')
    copyData.addEventListener('click', async e => {
        try {
            if (!navigator.clipboard) throw new DOMException('', 'NotAllowedError')
            await navigator.clipboard.writeText(corruptedData)
        }
        catch (e) {
            console.error(e)
            const msg = e.name === 'NotAllowedError'
                ? __("Copy to the clipboard is not allowed in the current context.", 'simple-ebook-viewer')
                : __("Error while copying the data to the clipboard.", 'simple-ebook-viewer')
            alert(msg)
        }
    })
    const clearData = document.createElement('button')
    clearData.type = 'submit'
    clearData.textContent = __('Clear data', 'simple-ebook-viewer')
    clearData.addEventListener('click', e => { dlg.close('clear') })
    const keepData = document.createElement('button')
    keepData.type = 'submit'
    keepData.textContent = __('Keep data', 'simple-ebook-viewer')
    keepData.addEventListener('click', e => { dlg.close('keep') })
    buttons.append(saveFile, copyData, clearData, keepData)

    form.append(header, fieldset, buttons)

    dlg.append(form)

    const saveDataAsFile = data => {
        const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data)], { type: "text/plain" })
        const link = document.createElement('a')

        const date = new Date()
        const y = date.getFullYear()
        const m = (date.getMonth() + 1 + '').padStart(2, "0")
        const d = (date.getDate() + '').padStart(2, "0")
        const h = (date.getHours() + '').padStart(2, "0")
        const M = (date.getMinutes() + '').padStart(2, "0")
        const s = (date.getSeconds() + '').padStart(2, "0")

        link.download = `corrupt-data-${y}-${m}-${d}_${h}-${M}-${s}.txt`
        link.href = window.URL.createObjectURL(blob)

        const evt = new MouseEvent("click", {
            view: window,
            bubbles: true,
            cancelable: true,
        })

        link.dispatchEvent(evt)
        setTimeout(() => { window.URL.revokeObjectURL(link.href) }, 1000)
    }

    const setData = (newType, raw) => {
        type = newType
        corruptedData = typeof raw === 'string' ? raw : JSON.stringify(raw)
        displayData.value = corruptedData
    }

    const getData = () => {
        return { type, data: corruptedData }
    }

    return { element: dlg, setData, getData }
}
