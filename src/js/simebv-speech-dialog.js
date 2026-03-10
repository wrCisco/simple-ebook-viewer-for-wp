import { isAndroid } from './simebv-utils.js'
const { __, _x, _n, sprintf } = wp.i18n;


export function speechDialog(target, speechOptions, isNote, returnFocus) {
    const dlg = document.createElement('dialog')
    const container = document.createElement('div')
    container.classList.add('simebv-speech-dialog-controls')
    container.setAttribute('role', 'toolbar')

    const playPause = document.createElement('button')
    playPause.id = 'simebv-speech-play-pause'
    playPause.classList.add('simebv-speech-dlg-button')
    playPause.setAttribute('autofocus', 'true')
    const playLabel = __('Play', 'simple-ebook-viewer')
    const pauseLabel = __('Pause', 'simple-ebook-viewer')
    playPause.setAttribute('aria-label', playLabel)
    playPause.setAttribute('aria-pressed', false)
    playPause.title = playLabel
    playPause.innerHTML = `
    <svg id="playIcon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8.5 5v14l11-7z"/>
    </svg>
    <svg id="pauseIcon" viewBox="0 0 24 24" aria-hidden="true" style="display: none;">
        <path d="M8 4h4v16h-4zm8 0h4v16h-4z"/>
    </svg>
    `
    const playIcon = playPause.querySelector('#playIcon')
    const pauseIcon = playPause.querySelector('#pauseIcon')

    const options = document.createElement('button')
    options.id = 'simebv-speech-options'
    options.classList.add('simebv-speech-dlg-button')
    const optionsLabel = __('Speech Options', 'simple-ebook-viewer')
    options.setAttribute('aria-label', optionsLabel)
    options.setAttribute('aria-haspopup', true)
    options.title = optionsLabel
    options.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
    </svg>
    `

    const prevSection = document.createElement('button')
    prevSection.id = 'simebv-speech-prev-section'
    prevSection.classList.add('simebv-speech-dlg-button')
    const prevSectionLabel = __('Go to previous section', 'simple-ebook-viewer')
    prevSection.setAttribute('aria-label', prevSectionLabel)
    prevSection.title = prevSectionLabel
    prevSection.innerHTML = `
    <svg id="playIcon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19 6v12l-10-6zm-10 0v12h-2v-12z"/>
    </svg>`

    const nextSection = document.createElement('button')
    nextSection.id = 'simebv-speech-next-section'
    nextSection.classList.add('simebv-speech-dlg-button')
    const nextSectionLabel = __('Go to next section', 'simple-ebook-viewer')
    nextSection.setAttribute('aria-label', nextSectionLabel)
    nextSection.title = nextSectionLabel
    nextSection.innerHTML = `
    <svg id="playIcon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 6v12l10-6zm10 0v12h2v-12z"/>
    </svg>`

    if (isNote) {
        prevSection.disabled = true
        nextSection.disabled = true
    }

    const closeBtn = document.createElement('button')
    closeBtn.id = 'simebv-speech-close'
    closeBtn.classList.add('simebv-speech-dlg-button')
    const closeLabel = __('Close', 'simple-ebook-viewer')
    closeBtn.setAttribute('aria-label', closeLabel)
    closeBtn.title = closeLabel
    closeBtn.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
    `

    container.append(playPause, prevSection, nextSection, options, closeBtn)
    dlg.append(container)

    let _isPlaying = false
    const isPlaying = () => _isPlaying

    const setPlayState = () => {
        playIcon.style.display = 'none'
        pauseIcon.style.display = 'block'
        playPause.title = pauseLabel
        playPause.setAttribute('aria-label', pauseLabel)
        playPause.setAttribute('aria-pressed', true)
        _isPlaying = true
    }

    const setPauseState = () => {
        playIcon.style.display = 'block'
        pauseIcon.style.display = 'none'
        playPause.title = playLabel
        playPause.setAttribute('aria-label', playLabel)
        playPause.setAttribute('aria-pressed', false)
        _isPlaying = false
    }

    playPause.addEventListener('click', () => {
        if (_isPlaying) {
            setPauseState()
            target.dispatchEvent(new CustomEvent('simebv-speech-pause'))
        }
        else {
            setPlayState()
            target.dispatchEvent(new CustomEvent('simebv-speech-play'))
        }
    })

    prevSection.addEventListener('click', () => {
        target.dispatchEvent(new CustomEvent('simebv-speech-prev-section'))
    })
    nextSection.addEventListener('click', () => {
        target.dispatchEvent(new CustomEvent('simebv-speech-next-section'))
    })

    let optionsDlg
    let wasPlaying
    options.addEventListener('click', () => {
        if (!optionsDlg) {
            optionsDlg = speechDialogOptions(target, speechOptions)
            optionsDlg.element.classList.add('simebv-form-dialog')
            dlg.parentElement.append(optionsDlg.element)
        }
        else {
            optionsDlg.updateVoices()
        }
        if (_isPlaying) {
            wasPlaying = true
            setPauseState()
        }
        target.dispatchEvent(new CustomEvent('simebv-speech-pause'))
        optionsDlg.element.showModal()
    })
    target.addEventListener('simebv-speech-update', () => {
        // custom event when the options dialog closes
        if (wasPlaying) {
            wasPlaying = false
            setPlayState()
            setTimeout(() => target.dispatchEvent(new CustomEvent('simebv-speech-resume')), 5)
        }
    })

    const close = () => {
        _isPlaying = false
        setPauseState()
        dlg.classList.remove('simebv-show')
        dlg.close('')
        if (returnFocus) {
            returnFocus.focus()
        }
        target.dispatchEvent(new CustomEvent('simebv-speech-close'))
        speechOptions.synthesis.cancel()
    }

    closeBtn.addEventListener('click', close)
    dlg.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'Escape':
                close()
                e.stopPropagation()
                e.preventDefault()
                break
        }
    })

    dlg.addEventListener('simebv-speech-dlg-toggle-playpause', () => {
        playPause.click()
    })

    const focus = () => {
        playPause.focus()
    }

    return { element: dlg, isPlaying, focus }
}


function speechDialogOptions(target, options) {
    const dlg = document.createElement('dialog')
    dlg.id = 'simebv-speech-dialog-options'
    dlg.setAttribute('aria-labelledby', 'simebv-speech-options-header')

    const form = document.createElement('form')
    form.setAttribute('method', 'dialog')

    const fieldset = document.createElement('fieldset')

    const header = document.createElement('h2')
    header.classList.add('simebv-header-dialog')
    header.textContent = __('Text To Speech Options', 'simple-ebook-viewer')
    header.id = 'simebv-speech-options-header'

    const volume = document.createElement('div')
    volume.classList.add('simebv-speech-dlg-input')
    const volumeControl = document.createElement('input')
    volumeControl.type = 'range'
    volumeControl.id = 'simebv-speech-volume'
    volumeControl.step = 0.1
    volumeControl.min = 0
    volumeControl.max = 1
    volumeControl.value = options.volume
    const volumeLabel = document.createElement('label')
    volumeLabel.classList.add('simebv-speech-dlg-options-label')
    volumeLabel.textContent = __('Volume: ', 'simple-ebook-viewer')
    volumeLabel.htmlFor = volumeControl.id
    const volumeValue = document.createElement('output')
    volumeValue.classList.add('simebv-speech-dlg-output')
    volumeValue.htmlFor = volumeControl.id
    volumeValue.value = volumeControl.value * 10
    volumeControl.addEventListener('change', () => { volumeValue.value = volumeControl.value * 10 })
    volume.append(volumeLabel, ' ', volumeControl, ' ', volumeValue)

    const pitch = document.createElement('div')
    pitch.classList.add('simebv-speech-dlg-input')
    const pitchControl = document.createElement('input')
    pitchControl.type = 'range'
    pitchControl.id = 'simebv-speech-pitch'
    pitchControl.step = 0.2
    pitchControl.min = 0
    pitchControl.max = 2
    pitchControl.value = options.pitch
    const pitchLabel = document.createElement('label')
    pitchLabel.classList.add('simebv-speech-dlg-options-label')
    pitchLabel.textContent = __('Pitch: ', 'simple-ebook-viewer')
    pitchLabel.htmlFor = pitchControl.id
    const pitchValue = document.createElement('output')
    pitchValue.classList.add('simebv-speech-dlg-output')
    pitchValue.htmlFor = pitchControl.id
    pitchValue.value = pitchControl.value * 10
    pitchControl.addEventListener('change', () => { pitchValue.value = pitchControl.value * 10 })
    pitch.append(pitchLabel, ' ', pitchControl, ' ', pitchValue)

    const rate = document.createElement('div')
    rate.classList.add('simebv-speech-dlg-input')
    const rateControl = document.createElement('input')
    rateControl.type = 'range'
    rateControl.id = 'simebv-speech-rate'
    rateControl.step = 0.2
    rateControl.min = 0
    rateControl.max = 2
    rateControl.value = options.rate
    const rateLabel = document.createElement('label')
    rateLabel.classList.add('simebv-speech-dlg-options-label')
    rateLabel.textContent = __('Speed: ', 'simple-ebook-viewer')
    rateLabel.htmlFor = rateControl.id
    const rateValue = document.createElement('output')
    rateValue.classList.add('simebv-speech-dlg-output')
    rateValue.htmlFor = rateControl.id
    rateValue.value = rateControl.value + 'x'
    rateControl.addEventListener('change', () => { rateValue.value = rateControl.value + 'x' })
    rate.append(rateLabel, ' ', rateControl, ' ', rateValue)

    const voice = document.createElement('div')
    voice.classList.add('simebv-speech-dlg-input')
    const voiceControl = document.createElement('select')
    voiceControl.name = 'voice'
    voiceControl.id = 'simebv-speech-voice'
    voiceControl.classList.add('simebv-speech-dlg-options-control')

    const updateVoices = () => {
        const voices = options.synthesis.getVoices()
        const opts = []
        for (const [i, v] of voices.entries()) {
            const opt = document.createElement('option')
            opt.value = i
            opt.textContent = `${v.name} - ${v.lang} - (${v.localService ? 'local' : 'remote'})`
            if (v === options.voice) {
                opt.selected = true
            }
            opts.push(opt)
        }
        voiceControl.replaceChildren(...opts)
    }
    updateVoices()
    options.synthesis.addEventListener('voiceschanged', updateVoices)

    const voiceLabel = document.createElement('label')
    voiceLabel.classList.add('simebv-speech-dlg-options-label')
    voiceLabel.textContent = __('Voice: ', 'simple-ebook-viewer')
    voiceLabel.htmlFor = voiceControl.id
    voice.append(voiceLabel, ' ', voiceControl)

    const warnings = document.createElement('div')
    if (isAndroid()) {
        voiceControl.setAttribute('disabled', 'true')
        const androidWarning = document.createElement('p')
        const androidWarningText = __('The voice is automatically selected based on the ebook and the system language. If you have more than one voice for the language, you can select your preferred one in the system settings.', 'simple-ebook-viewer')
        androidWarning.innerHTML = `<small>${androidWarningText}</small>`
        warnings.append(androidWarning)
    }

    const warning = document.createElement('p')
    const warningText1 = __('If you select a word in the text, the speech will begin from that word.', 'simple-ebook-viewer')
    const warningText2 = __('Warning: remote voices may restart from the beginning of the paragraph when they are changed. On Android, all voices may do the same when paused also.', 'simple-ebook-viewer')
    warning.innerHTML = `<small>${warningText1}<br><br>${warningText2}</small>`

    warnings.append(warning)

    const buttons = document.createElement('div')
    buttons.classList.add('simebv-dialog-buttons')
    const close = document.createElement('button')
    close.type = 'submit'
    close.textContent = __('OK', 'simple-ebook-viewer')
    close.addEventListener('click', () => dlg.close())
    const dismiss = document.createElement('button')
    dismiss.textContent = __('Close', 'simple-ebook-viewer')
    dismiss.setAttribute('type', 'button')
    dismiss.addEventListener('click', () => dlg.dispatchEvent(new Event('cancel')))
    buttons.append(close, dismiss)

    fieldset.append(volume, pitch, rate, voice, warnings)
    form.append(header, fieldset, buttons)
    dlg.append(form)

    dlg.addEventListener('submit', e => {
        target.dispatchEvent(new CustomEvent('simebv-speech-update', {
            detail: { 
                volume: volumeControl.value,
                pitch: pitchControl.value,
                rate: rateControl.value,
                voice: options.synthesis.getVoices()[voiceControl.selectedIndex]
            }
        }))
    })

    dlg.addEventListener('cancel', () => {
        volumeControl.value = options.volume
        pitchControl.value = options.pitch
        rateControl.value = options.rate
        volumeValue.value = volumeControl.value * 10
        pitchValue.value = pitchControl.value * 10
        rateValue.value = rateControl.value + 'x'
        for (const [i, v] of options.synthesis.getVoices().entries()) {
            if (v === options.voice) {
                voiceControl.selectedIndex = i
                break
            }
        }
        target.dispatchEvent(new CustomEvent('simebv-speech-update'))
        dlg.close()
    })

    return { element: dlg, updateVoices }
}
