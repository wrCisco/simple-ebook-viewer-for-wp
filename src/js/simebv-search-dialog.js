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
    class="simebv-search-icon">
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
        class="simebv-search-icon">
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
        class="simebv-search-icon">
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
        class="simebv-search-icon">
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
        class="simebv-search-icon-text">
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
        class="simebv-search-icon-text" style="border-bottom:dashed 2.5px;border-radius:25%;box-sizing:border-box;">
      <text textLength="90%" x="5%" y="80%" lengthAdjust="spacingAndGlyphs">ab</text>
    </svg>
    `
    const wholeWordsLabel = __('Whole words', 'simple-ebook-viewer')
    wholeWords.setAttribute('aria-label', wholeWordsLabel)
    wholeWords.setAttribute('aria-checked', false)
    wholeWords.title = wholeWordsLabel
    wholeWords.role = 'switch'

    const ignorePunctuation = document.createElement('button')
    ignorePunctuation.classList.add('simebv-button-icon')
    ignorePunctuation.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
        <text textLength="80%" x="10%" y="80%" class="simebv-search-icon-text">?!;</text>
        <path d="M1 6l22 12" stroke-width="1.25" stroke="CanvasText" stroke-linecap="round" />
    </svg>
    `
    const ignorePunctuationLabel = __('Ignore spaces and punctuation', 'simple-ebook-viewer')
    ignorePunctuation.setAttribute('aria-label', ignorePunctuationLabel)
    ignorePunctuation.setAttribute('aria-checked', false)
    ignorePunctuation.title = ignorePunctuationLabel
    ignorePunctuation.role = 'switch'

    popup.append(caseSensitive, wholeWords, ignorePunctuation)
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
        caseSensitive: {
            element: caseSensitive, value: false, label: caseSensitiveLabel, timeout: undefined
        },
        wholeWords: {
            element: wholeWords, value: false, label: wholeWordsLabel, timeout: undefined
        },
        ignorePunctuation: {
            element: ignorePunctuation, value: false, label: ignorePunctuationLabel, timeout: undefined
        },
    }
    for (const key in opts) {
        const opt = opts[key]
        opt.element.addEventListener('click', () => {
            if (opt.value) {
                opt.element.setAttribute('aria-checked', false)
                opt.element.classList.remove('simebv-active')
            }
            else {
                opt.element.setAttribute('aria-checked', true)
                opt.element.classList.add('simebv-active')
            }
            opt.value = !opt.value
        })
    }

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
    let tempLabel
    for (const key in opts) {
        const opt = opts[key]
        opt.element.addEventListener('touchstart', () => {
            opt.timeout = setTimeout(() => {
                tempLabel?.remove()
                tempLabel = showOptionLabel(opt.label)
            }, 500)
        })
        opt.element.addEventListener('touchend', () => {
            clearTimeout(opt.timeout)
            opt.timeout = undefined
        })
        opt.element.addEventListener('touchmove', () => {
            clearTimeout(opt.timeout)
            opt.timeout = undefined
        })
    }

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
                matchCase: opts.caseSensitive.value,
                matchWholeWords: opts.wholeWords.value,
                ignorePunctuation: opts.ignorePunctuation.value,
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
