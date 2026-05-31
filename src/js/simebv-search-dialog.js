import { __, _x, _n, sprintf } from './simebv-i18n.js'

export function searchDialog(onSearch, prevMatch, nextMatch, cleanup, returnFocus) {
    const dlg = document.createElement('dialog')
    const inputContainer = document.createElement('div')
    inputContainer.id = 'simebv-search-input'
    const iconBusy = document.createElement('span')
    iconBusy.id = 'simebv-busy-circle'
    inputContainer.append(iconBusy)

    const input = document.createElement('input')
    input.type = 'search'
    input.setAttribute('aria-label', __('Search', 'simple-ebook-viewer'))
    input.setAttribute('placeholder', __('Search', 'simple-ebook-viewer'))
    input.setAttribute('autofocus', true)
    inputContainer.append(input)

    const buttons = document.createElement('menu')

    const prevButton = document.createElement('button')
    prevButton.classList.add('simebv-button-icon', 'simebv-hidden')
    prevButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"
    fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path fill-rule="evenodd" d="M6 15l6 -6l6 6" />
    </svg>
    `
    prevButton.type = 'button'
    const prevButtonLabel = __('Previous result', 'simple-ebook-viewer')
    prevButton.setAttribute('aria-label', prevButtonLabel)
    prevButton.title = prevButtonLabel
    prevButton.setAttribute('disabled', true)
    const nextButton = document.createElement('button')
    nextButton.classList.add('simebv-button-icon', 'simebv-hidden')
    nextButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"
        fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path fill-rule="evenodd" d="M6 10l6 6l6 -6" />
    </svg>
    `
    nextButton.type = 'button'
    const nextButtonLabel = __('Next result', 'simple-ebook-viewer')
    nextButton.setAttribute('aria-label', nextButtonLabel)
    nextButton.title = nextButtonLabel
    nextButton.setAttribute('disabled', true)

    const menuContainer = document.createElement('div')
    menuContainer.classList.add('simebv-button-icon-container')
    const menuButton = document.createElement('button')
    menuButton.classList.add('simebv-button-icon')
    menuButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"
        fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path fill-rule="evenodd" d="M5 7h14M5 13h14M5 19h14" />
    </svg>
    `
    const menuLabel = __('Search Options', 'simple-ebook-viewer')
    menuButton.setAttribute('aria-label', menuLabel)
    menuButton.setAttribute('aria-expanded', false)
    menuButton.setAttribute('aria-controls', 'simebv-search-options')
    menuButton.title = menuLabel
    menuContainer.append(menuButton)

    const closeButton = document.createElement('button')
    closeButton.classList.add('simebv-button-icon')
    closeButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"
        fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path fill-rule="evenodd" d="M6 6l12 12M6 18l12 -12" />
    </svg>
    `
    closeButton.type = 'reset'
    const closeButtonLabel = __('Close', 'simple-ebook-viewer')
    closeButton.setAttribute('aria-label', closeButtonLabel)
    closeButton.title = closeButtonLabel

    buttons.append(prevButton, nextButton, menuContainer, closeButton)

    const popup = document.createElement('div')
    popup.id = 'simebv-search-options'
    popup.classList.add('simebv-search-options')
    const caseSensitive = document.createElement('button')
    caseSensitive.classList.add('simebv-button-icon')
    caseSensitive.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"
        fill="CanvasText" stroke-width="0">
      <text textLength="90%" x="5%" y="80%">aA</text>
    </svg>
    `
    const caseSensitiveLabel = __('Case sensitive', 'simple-ebook-viewer')
    caseSensitive.setAttribute('aria-label', caseSensitiveLabel)
    caseSensitive.setAttribute('aria-checked', false)
    caseSensitive.title = caseSensitiveLabel
    caseSensitive.role = 'switch'
    const wholeWords = document.createElement('button')
    wholeWords.classList.add('simebv-button-icon')
    wholeWords.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"
        fill="CanvasText" stroke-width="0" style="border-bottom:dashed 2.5px;border-radius:25%;box-sizing:border-box;">
      <text textLength="90%" x="5%" y="80%" lengthAdjust="spacingAndGlyphs">ab</text>
    </svg>
    `
    const wholeWordsLabel = __('Whole words', 'simple-ebook-viewer')
    wholeWords.setAttribute('aria-label', wholeWordsLabel)
    wholeWords.setAttribute('aria-checked', false)
    wholeWords.title = wholeWordsLabel
    wholeWords.role = 'switch'

    popup.append(caseSensitive, wholeWords)
    menuContainer.append(popup)

    dlg.append(inputContainer, buttons)

    const showOptions = () => {
        menuButton.setAttribute('aria-expanded', true)
        menuButton.classList.add('simebv-active')
        popup.classList.add('simebv-show')
        popup.firstElementChild?.focus({preventScroll: true})
    }
    const hideOptions = () => {
        menuButton.setAttribute('aria-expanded', false)
        menuButton.classList.remove('simebv-active')
        popup.classList.remove('simebv-show')
    }
    menuButton.addEventListener('click', () => {
        menuButton.ariaExpanded === 'true' ? hideOptions() : showOptions()
    })
    const showOptionsElements = [
        dlg, input, closeButton, menuButton, ...Array.from(popup.children)
    ]
    showOptionsElements.forEach(el => {
        el.addEventListener('blur', () => {
            setTimeout(() => {
                const active = menuButton.getRootNode().activeElement
                if (!showOptionsElements.includes(active)) {
                    hideOptions()
                }
            }, 0)
        })
    })
    const opts = {
        caseSensitive: false,
        wholeWords: false
    }
    caseSensitive.addEventListener('click', () => {
        if (opts.caseSensitive) {
            opts.caseSensitive = false
            caseSensitive.setAttribute('aria-checked', false)
            caseSensitive.classList.remove('simebv-active')
        }
        else {
            opts.caseSensitive = true
            caseSensitive.setAttribute('aria-checked', true)
            caseSensitive.classList.add('simebv-active')
        }
    })
    wholeWords.addEventListener('click', () => {
        if (opts.wholeWords) {
            opts.wholeWords = false
            wholeWords.setAttribute('aria-checked', false)
            wholeWords.classList.remove('simebv-active')
        }
        else {
            opts.wholeWords = true
            wholeWords.setAttribute('aria-checked', true)
            wholeWords.classList.add('simebv-active')
        }
    })

    // Show temporary floating labels after prolonged touch
    const showOptionLabel = label => {
        const container = document.createElement('div')
        container.classList.add('simebv-search-option-label')
        container.setAttribute('aria-hidden', true)
        const p = document.createElement('p')
        p.innerText = label
        container.append(p)
        popup.append(container)
        setTimeout(() => {
            container.remove()
        }, 2000)
        return container
    }
    let sensitiveTimeout
    let wholeWordsTimeout
    let tempLabel
    caseSensitive.addEventListener('touchstart', () => {
        sensitiveTimeout = setTimeout(() => {
            tempLabel?.remove()
            tempLabel = showOptionLabel(caseSensitiveLabel)
        }, 500)
    })
    caseSensitive.addEventListener('touchend', () => {
        clearTimeout(sensitiveTimeout)
        sensitiveTimeout = undefined
    })
    caseSensitive.addEventListener('touchmove', () => {
        clearTimeout(sensitiveTimeout)
        sensitiveTimeout = undefined
    })
    wholeWords.addEventListener('touchstart', () => {
        wholeWordsTimeout = setTimeout(() => {
            tempLabel?.remove()
            tempLabel = showOptionLabel(wholeWordsLabel)
        }, 500)
    })
    wholeWords.addEventListener('touchend', () => {
        clearTimeout(wholeWordsTimeout)
        wholeWordsTimeout = undefined
    })
    wholeWords.addEventListener('touchmove', () => {
        clearTimeout(wholeWordsTimeout)
        wholeWordsTimeout = undefined
    })

    let searching = false
    const execSearch = async (e, { prev, next, new_ }) => {
        if (searching) return
        let txt
        if (new_) {
            txt = input.value
            if (!txt) return
        }
        searching = true
        iconBusy.classList.add('simebv-show')
        try {
            if (prev) await prevMatch()
            else if (next) await nextMatch()
            else if (new_) await onSearch(txt, {
                reverse: e.shiftKey,
                matchCase: opts.caseSensitive,
                matchWholeWords: opts.wholeWords,
            })
            if (dlg.open) {
                prevButton.disabled = false
                nextButton.disabled = false
                prevButton.classList.remove('simebv-hidden')
                nextButton.classList.remove('simebv-hidden')
                hideOptions()
            }
        }
        finally {
            searching = false
            iconBusy.classList.remove('simebv-show')
        }
    }

    const close = () => {
        cleanup()
        prevButton.disabled = true
        nextButton.disabled = true
        hideOptions()
        dlg.classList.remove('simebv-show')
        dlg.close('')
        if (returnFocus) {
            returnFocus.focus({preventScroll: true})
        }
    }

    input.addEventListener('keydown', async (e) => {
        switch (e.key) {
            case 'Enter':
                await execSearch(e, {new_: true})
                break
            case 'ArrowLeft':
            case 'ArrowRight':
                e.stopPropagation()
                break
        }
    })
    input.addEventListener('focus', () => {
        prevButton.classList.add('simebv-hidden')
        nextButton.classList.add('simebv-hidden')
    })
    input.addEventListener('blur', () => {
        prevButton.classList.remove('simebv-hidden')
        nextButton.classList.remove('simebv-hidden')
    })
    prevButton.addEventListener('click', e => {
        e.preventDefault()  // prevent zoom on multiple taps
        execSearch(e, { prev: true })
    })
    nextButton.addEventListener('click', e => {
        e.preventDefault()  // prevent zoom on multiple taps
        execSearch(e, { next: true })
    })
    closeButton.addEventListener('click', close)

    dlg.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'Escape':
                close()
                e.stopPropagation()
                e.preventDefault()
                break
        }
    })

    return dlg
}