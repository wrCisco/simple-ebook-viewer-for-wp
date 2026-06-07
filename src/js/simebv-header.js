import { commonStyles } from './simebv-component-styles.js'
import { __, _x, _n, sprintf } from './simebv-i18n.js'

const template = document.createElement('template')
template.innerHTML = `
<style>
#header-bar {
    top: 0;
    z-index: 2;
    transition: opacity .3s linear;
}
#header-bar.fullscreen {
    background-color: var(--reader-bg);
}
#header-bar.hide {
    opacity: 0;
}
.reader-headline {
    flex: 1 1 fit-content;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
}
.reader-headline h1 {
    margin-block: 0;
    font-size: 1.3rem;
    white-space: pre;
    text-overflow: ellipsis;
    text-align: center;
}
.hide button {
    height: 0px;
    overflow: hidden;
}
.right-side-buttons,
.left-side-buttons {
    display: flex;
    flex-direction: row;
    vertical-align: middle;
    position: relative;
    flex: 0 0 3em;
}
.left-side-buttons {
    justify-content: start;
}
.right-side-buttons {
    justify-content: end;
}
.right-side-button-container {
    text-align: center;
    margin: auto;
}
#menu-button-container {
    position: relative;
}
#close-button {
    display: none;
}
.simebv-menu, .simebv-menu ul {
    list-style: none;
    padding: 0;
    margin: 0;
}
.simebv-menu {
    visibility: hidden;
    position: absolute;
    right: 0;
    background: var(--menu-bg);
    color: CanvasText;
    border-radius: 6px;
    box-shadow: var(--menu-box-shadow);
    padding: 6px;
    cursor: default;
    inline-size: 28ch;
    max-inline-size: 80vw;
    max-block-size: 80vh;
    overflow: auto;
    scrollbar-width: thin;
    user-select: none;
    box-sizing: border-box;
}
.simebv-menu.simebv-show {
    visibility: visible;
}
.simebv-menu li[role="presentation"] {
    padding: 0;
}
.simebv-menu li {
    padding: 6px 12px;
    padding-inline-start: 24px;
    border-radius: 6px;
}
.simebv-menu .simebv-action-menu-item {
    padding-inline-start: 6px;
}
.simebv-menu p[role^=menuitem] {
    --menuitem-inline-padding: 12px;
    padding: 6px var(--menuitem-inline-padding);
    border-radius: 6px;
    margin: 0;
    display: inline-block;
    width: calc(100% - var(--menuitem-inline-padding) * 2);
}
.simebv-menu li:not([role="presentation"]):hover,
.simebv-menu p[role^=menuitem]:hover {
    background-color: var(--active-bg);
    cursor: pointer;
}
.simebv-menu [aria-disabled="true"] li:hover,
.simebv-menu li[aria-disabled="true"]:hover,
.simebv-menu p[aria-disabled="true"]:hover {
    background-color: transparent;
    cursor: default;
}
.simebv-menu li[aria-checked="true"] {
    background-position: center left;
    background-repeat: no-repeat;
    background-image: var(--enabled-dot);
}
.simebv-menu [aria-disabled="true"] li[aria-checked="true"] {
    background-image: var(--disabled-dot);
}
.simebv-menu .simebv-horizontal {
    margin-block: .3em;
}
.simebv-menu .simebv-horizontal > li {
    display: list-item inline;
}
.simebv-menu fieldset {
    border: none;
    border-block-end: 1px solid var(--menu-group-separator-color);
    padding: 0;
    padding-block: .2em;
    margin-block-end: .6em;
}
.simebv-menu > li:last-child fieldset {
    border-block-end: none;
    margin-block-end: .2em;
}
.simebv-menu legend {
    padding-block-end: .4em;
    font-weight: 500;
}
.simebv-menu-shortcut {
    float: right;
    float: inline-end;
    color: var(--gray-text);
    padding-inline-start: .1em;
}
#simebv-zoom-numeric {
    inline-size: 5ch;
    margin-inline-end: .2em;
}
#simebv-zoom-numeric-sm {
    inline-size: 5ch;
    font-variant-numeric: tabular-nums;
    text-align: center;
}
#simebv-zoom-numeric-container {
    white-space: pre;
    margin-inline-start: .5em;
}
#simebv-zoom-numeric-container-sm {
    display: none;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 4px;
    padding-inline-start: .3em;
    user-select: none;
    vertical-align: middle;
}
@media screen and (max-width: 768px) {
    #simebv-zoom-numeric-container {
        display: none;
    }
    #simebv-zoom-numeric-container-sm {
        display: inline-flex;
    }
}
.simebv-numeric-btn-sm {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
}
.simebv-numeric-btn-sm:hover {
    background: var(--active-bg-2);
}
.simebv-numeric-btn-sm:active {
    transform: scale(0.95);
}
</style>
<div id="header-bar" class="simebv-toolbar">
    <div class="left-side-buttons">
        <button id="side-bar-button" aria-label="Show sidebar" aria-expanded="false" aria-controls="simebv-reader-sidebar">
            <svg class="simebv-icon" width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M 4 6 h 16 M 4 12 h 16 M 4 18 h 16"/>
            </svg>
        </button>
    </div>
    <header id="headline-container" class="reader-headline">
        <h1 id="book-header">No title</h1>
    </header>
    <div class="right-side-buttons">
        <div id="menu-button-container">
            <button id="menu-button" aria-label="Show settings" aria-haspopup="true">
                <svg class="simebv-icon" width="32" height="32" viewBox="0 0 24 24" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12.7a7 7 0 0 1 0-1.4l-1.8-2 2-3.5 2.7.5a7 7 0 0 1 1.2-.7L10 3h4l.9 2.6 1.2.7 2.7-.5 2 3.4-1.8 2a7 7 0 0 1 0 1.5l1.8 2-2 3.5-2.7-.5a7 7 0 0 1-1.2.7L14 21h-4l-.9-2.6a7 7 0 0 1-1.2-.7l-2.7.5-2-3.4 1.8-2Z"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>
            </button>
        </div>
        <div class="right-side-button-container">
            <button id="full-screen-button" aria-label="Full screen">
                <svg width="32" height="32" viewBox="-2 -2 28 28" class="simebv-icon" id="icon-enter-fullscreen" xmlns="http://www.w3.org/2000/svg" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8 2H4C2.89543 2 2 2.89543 2 4V8" stroke-width="1.8"/>
                    <path d="M22 8L22 4C22 2.89543 21.1046 2 20 2H16" stroke-width="1.8"/>
                    <path d="M16 22L20 22C21.1046 22 22 21.1046 22 20L22 16" stroke-width="1.8"/>
                    <path d="M8 22L4 22C2.89543 22 2 21.1046 2 20V16" stroke-width="1.8"/>
                </svg>
                <svg class="simebv-icon simebv-icon-hidden" id="icon-exit-fullscreen" width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 12 L12 12 12 4 M20 4 L20 12 28 12 M4 20 L12 20 12 28 M28 20 L20 20 20 28" stroke-width="1.8" />
                </svg>
            </button>
            <button id="close-button" aria-label="Close Ebook Viewer">
                <svg class="simebv-icon simebv-icon-fill" id="icon-close-viewer" width="32" height="32" viewBox="-1.5 -1.5 19 19" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z" stroke-width=".1" />
                </svg>
            </button>
        </div>
    </div>
</div>
`


export class HeaderBar extends HTMLElement {
    static observedAttributes = ["show-close-button"]
    root
    header
    buttonSideBar
    buttonMenuContainer
    buttonMenu
    buttonClose
    buttonFullscreen
    iconEnterFullscreen
    iconExitFullscreen
    buttons

    constructor() {
        super()
        this.attachShadow({ mode: 'open', delegatesFocus: true })
        this.shadowRoot.append(
            commonStyles.content.cloneNode(true),
            template.content.cloneNode(true),
        )
        this.root = this.shadowRoot.getElementById('header-bar')
        this.header = this.shadowRoot.getElementById('book-header')
        this.buttonSideBar = this.shadowRoot.getElementById('side-bar-button')
        this.buttonMenuContainer = this.shadowRoot.getElementById('menu-button-container')
        this.buttonMenu = this.shadowRoot.getElementById('menu-button')
        this.buttonClose = this.shadowRoot.getElementById('close-button')
        this.buttonFullscreen = this.shadowRoot.getElementById('full-screen-button')
        this.iconEnterFullscreen = this.shadowRoot.getElementById('icon-enter-fullscreen')
        this.iconExitFullscreen = this.shadowRoot.getElementById('icon-exit-fullscreen')
        this.buttons = [this.buttonSideBar, this.buttonMenu, this.buttonClose, this.buttonFullscreen]
        this.setLocalizedLabels()
    }

    connectedCallback() {
        // Guard against Safari on iOS, which queues the click
        // for a bit even if the button is disabled or invisible
        const wasJustRestored = el => performance.now() - el.simebvRestoredAt < 300
        this.buttonSideBar.addEventListener(
            'click', () => {
                if (wasJustRestored(this.buttonSideBar)) return
                const state = this.buttonSideBar.getAttribute('aria-expanded')
                if (state === 'false') {
                    this.buttonSideBar.setAttribute('aria-expanded', 'true')
                }
                this.dispatchEvent(new CustomEvent('side-bar-button'))
            }
        )
        this.buttonMenu.addEventListener(
            'click', () => {
                if (wasJustRestored(this.buttonMenu)) return
                this.dispatchEvent(new CustomEvent('menu-button'))
            }
        )
        this.buttonFullscreen.addEventListener(
            'click', () => {
                if (wasJustRestored(this.buttonFullscreen)) return
                this.dispatchEvent(new CustomEvent('fullscreen-button'))
            }
        )
        this.buttonClose.addEventListener(
            'click', () => {
                if (wasJustRestored(this.buttonClose)) return
                this.dispatchEvent(new CustomEvent('close-button'))
            }
        )
        this.addEventListener('toggle-fullscreen', ({ detail }) => {
            if (detail.data === 'enter') {
                this.iconEnterFullscreen.classList.add('simebv-icon-hidden')
                this.iconExitFullscreen.classList.remove('simebv-icon-hidden')
                this.root.classList.add('fullscreen')
                this.#setFullscreenListeners()
                this.hideBar()
                this.buttonFullscreen.setAttribute(
                    detail.mode === 'viewport' ? 'aria-expanded' : 'aria-pressed', true
                )
            }
            else {
                this.iconEnterFullscreen.classList.remove('simebv-icon-hidden')
                this.iconExitFullscreen.classList.add('simebv-icon-hidden')
                this.root.classList.remove('fullscreen')
                this.#removeFullscreenListeners()
                this.showBar()
                this.buttonFullscreen.setAttribute(
                    detail.mode === 'viewport' ? 'aria-expanded' : 'aria-pressed', false
                )
            }
        })
        this.addEventListener('new-book', () => this.root.style.visibility = 'visible')
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (newValue === 'true') {
            this.buttonFullscreen.style.display = 'none'
            this.buttonClose.style.display = 'inline-block'
        }
        else {
            this.buttonFullscreen.style.display = ''
            this.buttonClose.style.display = ''
        }
    }

    #addStdEventListeners() {
        this.root.addEventListener('touchstart', this.boundShowBar, { passive: true })
        this.root.addEventListener('touchend', this.boundHideBar, { passive: true })
        this.root.addEventListener('mouseenter', this.boundShowBar)
        this.root.addEventListener('mouseleave', this.boundHideBar)
        this.buttons.forEach(button => {
            button.addEventListener('focus', this.boundShowBar)
            button.addEventListener('blur', this.boundHideBar)
        })
    }

    #removeStdEventListeners() {
        this.root.removeEventListener('touchstart', this.boundShowBar, { passive: true })
        this.root.removeEventListener('touchend', this.boundHideBar, { passive: true })
        this.root.removeEventListener('mouseenter', this.boundShowBar)
        this.root.removeEventListener('mouseleave', this.boundHideBar)
        this.buttons.forEach(button => {
            button.removeEventListener('focus', this.boundShowBar)
            button.removeEventListener('blur', this.boundHideBar)
        })
    }

    #setFullscreenListeners() {
        this.#addStdEventListeners()
        this.addEventListener('open-menus', this.boundOpenMenus)
        this.addEventListener('close-menus', this.boundCloseMenus)
        this.addEventListener('tap-on-document', this.boundOnDocumentClick)
    }

    #removeFullscreenListeners() {
        this.#removeStdEventListeners()
        this.removeEventListener('open-menus', this.boundOpenMenus)
        this.removeEventListener('close-menus', this.boundCloseMenus)
        this.removeEventListener('tap-on-document', this.boundOnDocumentClick)
    }

    openMenus() {
        this.#removeStdEventListeners()
        this.showBar()
    }
    boundOpenMenus = this.openMenus.bind(this)

    closeMenus() {
        this.#addStdEventListeners()
        this.hideBar()
    }
    boundCloseMenus = this.closeMenus.bind(this)

    onDocumentClick() {
        this.showBar()
        this.hideBar()
    }
    boundOnDocumentClick = this.onDocumentClick.bind(this)

    showBar(e) {
        if (this.root.classList.contains('hide')) {
            this.root.classList.remove('hide')
            this.buttons.forEach(el => el.simebvRestoredAt = performance.now())
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

    setLocalizedLabels() {
        this.setHeader(__('No title', 'simple-ebook-viewer'))
        const sideBarButtonLabel = __('Show sidebar', 'simple-ebook-viewer')
        this.buttonSideBar.setAttribute('aria-label', sideBarButtonLabel)
        this.buttonSideBar.title = sideBarButtonLabel
        const settingsButtonLabel = __('Show settings', 'simple-ebook-viewer')
        this.buttonMenu.setAttribute('aria-label', settingsButtonLabel)
        this.buttonMenu.title = settingsButtonLabel
        const fullScreenButtonLabel = __('Toggle full screen', 'simple-ebook-viewer')
        this.buttonFullscreen.setAttribute('aria-label', fullScreenButtonLabel)
        this.buttonFullscreen.title = fullScreenButtonLabel
        const buttonCloseLabel = __('Close Reader', 'simple-ebook-viewer')
        this.buttonClose.setAttribute('aria-label', buttonCloseLabel)
        this.buttonClose.title = buttonCloseLabel
    }

    setHeader(text) {
        this.header.textContent = text
    }

    attachMenu(menu) {
        this.buttonMenuContainer.append(menu)
    }

}

customElements.define('simebv-reader-header', HeaderBar)
