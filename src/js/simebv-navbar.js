import { commonStyles } from './simebv-component-styles.js'
import { __, _x, _n, sprintf } from './simebv-i18n.js'

const template = document.createElement('template')
template.innerHTML = `
<style>
#nav-bar {
    bottom: 0;
    transition: opacity .3s linear;
}
#nav-bar.fullscreen {
    background-color: var(--reader-bg);
}
#nav-bar.hide {
    opacity: 0;
}
.hide :is(button, input) {
    height: 0;
    overflow: hidden;
}
#position-viewer {
    flex-grow: 1;
    margin: 0 12px;
}
#progress-slider {
    width: 100%;
    display: none;
}
#progress-percent, #progress-pages {
    margin: 0 12px;
    display: none;
    text-align: center;
}
</style>
<div id="nav-bar" class="simebv-toolbar">
    <button id="left-button" aria-label="Go left">
        <svg class="simebv-icon" width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M 15 6 L 9 12 L 15 18"/>
        </svg>
    </button>
    <div id="position-viewer" aria-live="polite" aria-atomic="true">
        <input id="progress-slider" type="range" min="0" max="1" step="any" list="tick-marks">
        <datalist id="tick-marks"></datalist>
        <div id="progress-percent"></div>
        <div id="progress-pages"></div>
    </div>
    <button id="right-button" aria-label="Go right">
        <svg class="simebv-icon" width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M 9 6 L 15 12 L 9 18"/>
        </svg>
    </button>
</div>
`

export class NavBar extends HTMLElement {
    static observedAttributes = ["position-view-type"]
    root
    buttonLeft
    buttonRight
    positionViewer
    slider
    percent
    pages
    controls

    constructor() {
        super()
        this.attachShadow({ mode: 'open', delegatesFocus: true })
        this.shadowRoot.append(
            commonStyles.content.cloneNode(true),
            template.content.cloneNode(true)
        )
        this.root = this.shadowRoot.getElementById('nav-bar')
        this.buttonLeft = this.shadowRoot.getElementById('left-button')
        this.buttonRight = this.shadowRoot.getElementById('right-button')
        this.positionViewer = this.shadowRoot.getElementById('position-viewer')
        this.slider = this.shadowRoot.getElementById('progress-slider')
        this.percent = this.shadowRoot.getElementById('progress-percent')
        this.pages = this.shadowRoot.getElementById('progress-pages')
        this.controls = [this.buttonLeft, this.buttonRight, this.slider]

        this.setLocalizedLabels()

        const sliderDataList = this.shadowRoot.getElementById('tick-marks')
        this.addEventListener('new-book', ({ detail }) => {
            this.slider.dir = detail.dir || 'auto'
            sliderDataList.textContent = ''
            for (const fraction of detail.fractions) {
                const option = document.createElement('option')
                option.value = fraction
                sliderDataList.append(option)
            }
            this.root.style.visibility = 'visible'
        })
        this.addEventListener('relocate', this.boundUpdatePositionViewer)
    }

    setLocalizedLabels() {
        const leftButtonLabel = __('Turn left page', 'simple-ebook-viewer')
        this.buttonLeft.setAttribute('aria-label', leftButtonLabel)
        this.buttonLeft.title = leftButtonLabel
        const rightButtonLabel = __('Turn right page', 'simple-ebook-viewer')
        this.buttonRight.setAttribute('aria-label', rightButtonLabel)
        this.buttonRight.title = rightButtonLabel
        const sliderLabel = __('Location in ebook', 'simple-ebook-viewer')
        this.slider.setAttribute('aria-label', sliderLabel)
    }

    connectedCallback() {
        // Guard against Safari on iOS, which queues the click
        // for a bit even if the button is disabled or invisible
        const wasJustRestored = el => performance.now() - el.simebvRestoredAt < 300
        this.buttonLeft.addEventListener(
            'click', e => {
                if (wasJustRestored(this.buttonLeft)) return
                e.preventDefault()  // prevent zoom on multiple taps
                this.dispatchEvent(new CustomEvent('go-left'))
            }
        )
        this.buttonRight.addEventListener(
            'click', e => {
                if (wasJustRestored(this.buttonRight)) return
                e.preventDefault()  // prevent zoom on multiple taps
                this.dispatchEvent(new CustomEvent('go-right'))
            }
        )
        this.slider.addEventListener(
            'input',
            e => {
                if (wasJustRestored(this.slider)) {
                    e.preventDefault()
                    e.stopPropagation()
                    return
                }
                this.changedPageSlider = true
                this.dispatchEvent(new CustomEvent('changed-page-slider', { detail: { newLocation: e.target.value }, bubbles: true }))
            }
        )
        this.addEventListener('toggle-fullscreen', ({ detail }) => {
            if (detail.data === 'enter') {
                this.root.classList.add('fullscreen')
                this.setFullscreenListeners()
                this.hideBar()
            }
            else {
                this.root.classList.remove('hide', 'fullscreen')
                this.removeFullscreenListeners()
                this.showBar()
            }
        })
    }

    setFullscreenListeners() {
        this.root.addEventListener('touchstart', this.boundShowBar, { passive: true })
        this.root.addEventListener('touchend', this.boundHideBar, { passive: true })
        this.root.addEventListener('mouseenter', this.boundShowBar)
        this.root.addEventListener('mouseleave', this.boundHideBar)
        this.controls.forEach(el => {
            el.addEventListener('focus', this.boundShowBar)
            el.addEventListener('blur', this.boundHideBar)
        })
        this.addEventListener('tap-on-document', this.boundOnDocumentClick)
    }

    removeFullscreenListeners() {
        this.root.removeEventListener('touchstart', this.boundShowBar)
        this.root.removeEventListener('touchend', this.boundHideBar)
        this.root.removeEventListener('mouseenter', this.boundShowBar)
        this.root.removeEventListener('mouseleave', this.boundHideBar)
        this.controls.forEach(el => {
            el.removeEventListener('focus', this.boundShowBar)
            el.removeEventListener('blur', this.boundHideBar)
        })
        this.removeEventListener('tap-on-document', this.boundOnDocumentClick)
    }

    onDocumentClick() {
        this.showBar()
        this.hideBar()
    }
    boundOnDocumentClick = this.onDocumentClick.bind(this)

    showBar() {
        if (this.root.classList.contains('hide')) {
            this.root.classList.remove('hide')
            this.controls.forEach(el => el.simebvRestoredAt = performance.now())
            this.slider.style.pointerEvents = 'none'
            setTimeout(() => this.slider.style.pointerEvents = '', 500)
        }
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout)
            this.hideTimeout = undefined
        }
    }
    boundShowBar = this.showBar.bind(this)

    hideBar() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout)
            this.hideTimeout = undefined
        }
        this.hideTimeout = setTimeout(() => {
            this.root.classList.add('hide')
        }, 1500)
    }
    boundHideBar = this.hideBar.bind(this)

    attributeChangedCallback(name, oldValue, newValue) {
        switch (oldValue) {
            case 'slider':
                this.slider.style.display = 'none'
                break
            case 'percent':
                this.percent.style.display = 'none'
                break
            case 'pages':
                this.pages.style.display = 'none'
                break
        }
        switch (newValue) {
            case 'slider':
                this.slider.style.display = 'block'
                break
            case 'percent':
                this.percent.style.display = 'block'
                break
            case 'pages':
                this.pages.style.display = 'block'
                break
        }
    }

    updatePositionViewer({ detail }) {
        this.slider.title = detail.sliderTitle
        this.slider.setAttribute('aria-valuetext', detail.sliderTitle)
        if (!this.changedPageSlider) {
            this.slider.value = detail.sliderValue
        }
        this.changedPageSlider = false
        this.percent.innerText = detail.percent
        this.pages.innerText = detail.page
    }
    boundUpdatePositionViewer = this.updatePositionViewer.bind(this)
}

customElements.define('simebv-reader-navbar', NavBar)
