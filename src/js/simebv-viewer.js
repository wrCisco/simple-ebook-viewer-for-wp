import './simebv-view.js'
import './simebv-navbar.js'
import './simebv-header.js'
import './simebv-sidebar.js'
import { createTOCView } from '../../vendor/foliate-js/ui/tree.js'
import { Overlayer } from '../../vendor/foliate-js/overlayer.js'
import { CFI } from './simebv-epubcfi.js'
import {
    isNumeric, getDefaultFontSize, pluginBaseUrl,
    isElementWritable, scrollIntoView } from './simebv-utils.js'
import {
    pageListOutline, pageBookmarkHighlight,
    currentSearchOutline, thinRectHitTester } from './simebv-overlayer-shapes.js'
import { transformDoc, convertFontSizePxToRem, defaultStyles, getCSS } from './simebv-transform-ebook.js'
import { colorFiltersDialog } from './simebv-filters-dialog.js'
import { metadataDialog, MetadataFormatter } from './simebv-metadata-dialog.js'
import { fontsDialog } from './simebv-fonts-dialog.js'
import { annotationsDialog } from './simebv-annotations-dialog.js'
import { corruptedDataDialog } from './simebv-corrupted-data-dialog.js'
import { createShowAnnotationDialog } from './simebv-show-annotation-dialog.js'
import { createPageListForAnnotations } from './simebv-page-list.js'
import { Menu } from './simebv-menu.js'
import { createMenuItemsStd, getInitialMenuStatusStd } from './simebv-menu-items.js'
import { ebookFormat } from './simebv-ebook-format.js'
import { TextSearch } from './simebv-search.js'
import { SpeechManager } from './simebv-speech.js'
import { FootnoteManager } from './simebv-footnotes.js'
import { BookmarksManager } from './simebv-bookmarks.js'
import { setMousePanEvents } from './simebv-fxl-mousepan.js'
import { setTouchEvents } from './simebv-doc-touchevents.js'
import { getPreferencesManager, PreferencesLoader } from './simebv-preferences.js'
import { __, _x, _n, sprintf } from './simebv-i18n.js'

// Import css for the Viewer's container element, as static asset
import '../css/simebv-container.css'
// Import css for the Viewer's UI, as string
import viewerUiCss from '../css/simebv-viewer.css?raw'

const readerMarkup = `
<style>
${viewerUiCss}
</style>
<div id="simebv-reader-root" class="simebv-supports-dark">
    <div id="simebv-loading-overlay" class="simebv-show">
        <p id="simebv-loading-overlay-text">Loading...</p>
    </div>
    <div id="simebv-dimming-overlay"></div>
    <section id="simebv-side-bar"></section>
    <div id="simebv-header-bar"></div>
    <div id="simebv-nav-bar"></div>
    <div id="simebv-book-container" tabindex="0"></div>
</div>
`

const percentFormat = new Intl.NumberFormat('en', { style: 'percent' })

export class Reader {
    _root
    _rootDiv
    _bookContainer
    _tocView
    _navBar
    _headerBar
    _sideBar
    _overlay
    _realFullscreen
    _alwaysFullViewport
    _modalDialogs = {
        annotations: undefined,
        showAnnotation: undefined,
        metadata: undefined,
        colorsFilter: undefined,
        fonts: undefined,
        corruptedData: undefined,
    }
    _textSearch
    _appliedFilter = {
        activateColorFilter: false,
        invertColorsFilter: 0,
        rotateColorsFilter: 0,
        bgFilterTransparent: true,
        bgColorsFilter: '#FFFFFF',
    }
    style = { ...defaultStyles }
    annotations = new Map()
    annotationsByValue = new Map()
    pageList = new Map()
    pageListByValue = new Map()
    _showAnnotations
    _showPageDelimiters
    _rendererResizeObserver
    container
    menu
    _openEbookFormat
    _ebookTitle
    _defaultFontSize
    _speechManager
    _prefsManager
    _prefsLoader
    _bookmarksManager

    _closeMenus(focusTo) {
        if (this._sideBar.isVisible()) {
            this._sideBar.saveLastFocus()
            if (!focusTo) focusTo = this._headerBar.buttonSideBar
            this._headerBar.buttonSideBar.setAttribute('aria-expanded', 'false')
        }
        this._overlay.classList.remove('simebv-show')
        this._sideBar.hide()
        this.menu.hide(false)
        this._headerBar.dispatchEvent(new CustomEvent('close-menus'))
        if (focusTo) {
            focusTo.focus({ preventScroll: true })
        }
    }

    constructor(container, options) {
        let { menu, navBar, headerBar, sideBar, realFullscreen,
            alwaysFullViewport, closeViewerCallback, hideTitle
        } = options
        this.container = container ?? document.body
        this._root = this.container.attachShadow({ mode: 'open' })
        this._root.innerHTML = readerMarkup
        this._rootDiv = this._root.querySelector('#simebv-reader-root')
        this._bookContainer = this._root.querySelector('#simebv-book-container')
        this._overlay = this._root.querySelector('#simebv-dimming-overlay')
        this._realFullscreen = !!realFullscreen && this.container.requestFullscreen
        // Always full viewport needs a callback function for the close button
        // and can't be real full screen (it needs user activation)
        this._alwaysFullViewport = !!alwaysFullViewport && !!closeViewerCallback && !this._realFullscreen
        this._hideTitle = hideTitle

        const sideBarContainer = this._root.querySelector('#simebv-side-bar')
        if (!sideBar) {
            sideBar = document.createElement('simebv-reader-sidebar')
        }
        sideBar.id = 'simebv-reader-sidebar'
        sideBarContainer.append(sideBar)
        this._sideBar = sideBar

        const headerBarContainer = this._root.querySelector('#simebv-header-bar')
        if (!headerBar) {
            headerBar = document.createElement('simebv-reader-header')
        }
        headerBarContainer.append(headerBar)
        this._headerBar = headerBar
        if (['always', 'first-page'].includes(this._hideTitle)) {
            this._headerBar.hideHeader()
        }

        const navBarContainer = this._root.querySelector('#simebv-nav-bar')
        if (!navBar) {
            navBar = document.createElement('simebv-reader-navbar')
        }
        navBarContainer.append(navBar)
        this._navBar = navBar

        if (!menu) {
            menu = new Menu()
        }
        this.menu = menu
        this.menu.element.classList.add('simebv-menu')

        this._headerBar.buttonFullscreen.setAttribute('aria-controls', this.container.id)
        if (!this._realFullscreen) {
            this.container.setAttribute('popover', 'manual')
            if (typeof closeViewerCallback === 'function') {
                this._headerBar.setAttribute('show-close-button', 'true')
                this._headerBar.addEventListener('close-button', closeViewerCallback)
                if (this._alwaysFullViewport) {
                    this._toggleFullViewport()
                }
            }
        }
        this._headerBar.addEventListener('side-bar-button', () => {
            setTimeout(() => {
                if (this._sideBar.isVisible()) {
                    this._closeMenus()
                }
                else {
                    this._overlay.classList.add('simebv-show')
                    this._sideBar.show()
                    this._sideBar.setInitialFocus()
                    this._headerBar.dispatchEvent(new CustomEvent('open-menus'))
                }
            }, 20)
        })
        this._overlay.addEventListener('click', () => {
            this._closeMenus(this.container)
        })
        this._sideBar.addEventListener('side-bar-close', () => this._closeMenus())
        this.menu.element.addEventListener('closeMenu', () => {
            this._closeMenus()
        })

        this._headerBar.registerAttachment({
            menu: this._sideBar,
            isVisible: this._sideBar.isVisible.bind(this._sideBar)
        })
        this._headerBar.attachMenu(this.menu.element, this.menu.isVisible.bind(this.menu))
        this._headerBar.addEventListener('menu-button', (e) => {
            const close = e.detail?.close
            if (!close && !this.menu.element.classList.contains('simebv-show')) {
                this._prefsManager.userInteraction()
                this.menu.show(this._headerBar.buttonMenu)
                this._overlay.classList.add('simebv-show')
                this._headerBar.dispatchEvent(new CustomEvent('open-menus'))
            }
            else {
                this._closeMenus()
            }
        })
        this._headerBar.addEventListener(
            'fullscreen-button',
            this._realFullscreen ? this._toggleFullScreen.bind(this) : this._toggleFullViewport.bind(this)
        )
        this.container.addEventListener('fullscreenchange', (e) => {
            const detail = { fxl: this.view.isFixedLayout }
            if (document.fullscreenElement) {
                detail.data = 'enter'
                this.container.classList.add('simebv-view-real-fullscreen')
                this._bookContainer.classList.add('simebv-fullscreen')
                // To prevent Chromium based browsers from scrolling down the page upon leaving fullscreen
                document.documentElement.classList.add('simebv-overflow-anchor-none')
                document.body.classList.add('simebv-overflow-anchor-none')
            }
            else {
                detail.data = 'exit'
                this.container.classList.remove('simebv-view-real-fullscreen')
                this._bookContainer.classList.remove('simebv-fullscreen')
                this.view.removeAttribute('autohide-cursor')
                document.documentElement.classList.remove('simebv-overflow-anchor-none')
                document.body.classList.remove('simebv-overflow-anchor-none')
            }
            const toggleFullscreen = new CustomEvent('toggle-fullscreen', { detail })
            this._headerBar.dispatchEvent(toggleFullscreen)
            this._navBar.dispatchEvent(toggleFullscreen)
        })
        this.container.addEventListener('tap-on-document', e => {
            const ev = new CustomEvent('tap-on-document')
            this._headerBar.dispatchEvent(ev)
            this._navBar.dispatchEvent(ev)
        })
        const viewerResizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target === this.container) {
                    this._setMenusMaxSize()
                }
            }
        })
        viewerResizeObserver.observe(this.container)

        this.setLocalizedDefaultInterface(this._root)
        this._defaultFontSize = getDefaultFontSize(this._rootDiv)

        this._prefsManager = getPreferencesManager()
        this._prefsManager.registerClient(this._rootDiv, ['functional', 'preferences'])
        this._rootDiv.addEventListener('corrupted-storage', this._boundCorruptedDataHandler)
        this._prefsManager.init()
        this._prefsLoader = new PreferencesLoader(this.container, this._prefsManager)

        document.dispatchEvent(new CustomEvent('simebv-viewer-loaded'))
    }

    get containerHeight() {
        return this.container.getBoundingClientRect().height
    }

    get containerWidth() {
        return this.container.getBoundingClientRect().width
    }

    /**
     * Look for the document's active element, checking also open shadow roots
     * and same origin iframes, including the ebook's displayed documents.
     * If the focus is on the body or the html node of one of the ebook's documents,
     * the function returns this.view as the active element (this.view is a closed
     * shadow root, so unless there is a specific focused element inside one of the
     * ebook's documents, I cannot know which one has the focus, if any).
     * As a reminder: with no internal focused element, shadowRoot.activeElement
     * returns null, while document.activeElement returns body or documentElement
     */
    getActiveElement() {
        let activeElement = document.activeElement
        while (activeElement) {
            if (activeElement?.shadowRoot?.activeElement) {
                activeElement = activeElement.shadowRoot.activeElement
            }
            else if (activeElement?.tagName.toLowerCase() === 'iframe') {
                const inner = activeElement.contentDocument?.activeElement
                if (!inner) break
                activeElement = inner
            }
            else break
        }
        if (activeElement === this.view) {
            for (const { doc } of this.view.renderer.getContents()) {
                const inner = doc.activeElement
                if (!['body', 'html'].includes(inner.nodeName.toLowerCase())) {
                    activeElement = inner
                    break
                }
            }
        }
        return activeElement
    }

    async drawAnnotationHandler(e) {
        const { draw, annotation, doc, range } = e.detail
        switch (annotation.type) {
            case 'current-search':
                const el = draw(currentSearchOutline, {
                    color: '#FF0000', width: 2, opacity: .8, radius: 0
                })
                if (this.view.isFixedLayout) {
                    scrollIntoView(el, doc, this.view.renderer)
                }
                break
            case 'calibre-bookmark':
            case 'user-bookmark-selection':
                draw(Overlayer.highlight, { color: annotation.color })
                break
            case 'user-bookmark-page': {
                    const fontSize = doc?.body ? getDefaultFontSize(doc.body) : this._defaultFontSize
                    draw(pageBookmarkHighlight, {
                        color: annotation.color, fontSize, hitTester: thinRectHitTester
                    })
                    break
                }
            case 'page-list': {
                    const fontSize = doc?.body ? getDefaultFontSize(doc.body) : this._defaultFontSize
                    draw(pageListOutline, {
                        color: '#E55330', label: annotation.label, type: annotation.type, fontSize,
                        hitTester: thinRectHitTester
                    })
                    break
                }
            default: {
                const drawingFunc = annotation.shape ?? Overlayer.highlight
                draw(drawingFunc, annotation)
            }
        }
    }

    pageListCreateOverlay(e) {
        const { index, doc } = e.detail
        if (!this.pageList.has(index)) {
            const pageList = this.view.book.pageList
            if (!pageList) {
                return
            }
            const { pageList: pl, pageListByValue } = createPageListForAnnotations(this, pageList, index, doc)
            this.pageList.set(index, pl)
            for (const [v, notes] of pageListByValue.entries()) {
                this.pageListByValue.set(v, notes)
            }
            const links = this._sideBar.pageList.element.querySelectorAll('a')
            for (const p of pl) {
                for (const a of links) {
                    if (a.getAttribute('href') === p.href) {
                        a.setAttribute('data-simebv-cfi', p.value)
                        break
                    }
                }
            }
        }
        const list = this.pageList.get(index)
        if (list) {
            for (const page of list) {
                this.view.addAnnotation(page)
            }
        }
    }
    boundPageListCreateOverlay = this.pageListCreateOverlay.bind(this)

    pageListShowAnnotation(e) {
        const { value, index } = e.detail
        const annotation = this.pageListByValue.get(value)
        if (!annotation?.label) return
        // a visible page bookmark on the same spot opens also the bookmarks panel
        const bm = this._bookmarksManager
        const sharedWithBookmark = bm?.showBookmarksInPage
            && bm.getBookmarks(index).some(b => b.loc.cfi === value)
        this.openShowAnnotationDialog(
            __('Start of page ', 'simple-ebook-viewer') + annotation.label,
            __('Page list', 'simple-ebook-viewer'),
            sharedWithBookmark ? () => bm.getDialog() : undefined,
        )
    }
    boundPageListShowAnnotation = this.pageListShowAnnotation.bind(this)

    bookmarksCreateOverlay(e) {
        const { index } = e.detail
        const list = this.annotations.get(index)
        if (list) {
            for (const annotation of list) {
                this.view.addAnnotation(annotation)
            }
        }
    }
    boundBookmarksCreateOverlay = this.bookmarksCreateOverlay.bind(this)

    bookmarksShowAnnotation(e) {
        const annotation = this.annotationsByValue.get(e.detail.value)
        if (annotation?.note) {
            this.openShowAnnotationDialog(annotation.note)
        }
    }
    boundBookmarksShowAnnotation = this.bookmarksShowAnnotation.bind(this)

    openShowAnnotationDialog(note, header, bookmarksDlg) {
        if (!this._modalDialogs.showAnnotation) {
            const dlg = createShowAnnotationDialog()
            dlg.element.id = 'simebv-show-annotation-dialog'
            dlg.element.classList.add('simebv-form-dialog')
            this._rootDiv.append(dlg.element)
            this._modalDialogs.showAnnotation = dlg
        }
        const returnFocus = bookmarksDlg ?? (() => this.container)
        this._modalDialogs.showAnnotation.showAnnotation(note, header, returnFocus)
        // The opening of the bookmarks dialog can take the focus away
        setTimeout(() => { this._modalDialogs.showAnnotation.setFocus() }, 0)
    }

    _createAnnotationsDialog() {
        if (!this._modalDialogs.annotations) {
            const dlg = annotationsDialog(this, this._rootDiv)
            dlg.element.id = 'simebv-annotations-dialog'
            dlg.element.classList.add('simebv-form-dialog')
            this._rootDiv.append(dlg.element)
            this._modalDialogs.annotations = dlg
        }
    }

    openAnnotationsDialog() {
        if (!this._modalDialogs.annotations) {
            this._createAnnotationsDialog()
        }
        this._modalDialogs.annotations.element.showModal()
    }

    openMetadataDialog() {
        if (!this._modalDialogs.metadata) {
            const dlg = metadataDialog(this.view?.book?.metadata ?? {}, this._metadataFormatter, this._openEbookFormat)
            dlg.element.id = 'simebv-metadata-dialog'
            dlg.element.style.minWidth = 'min(320px, 100vw)'
            this._rootDiv.append(dlg.element)
            this._modalDialogs.metadata = dlg
        }
        this._modalDialogs.metadata.element.style.maxWidth = 'min(70vw, ' + (this.containerWidth - 30) + 'px)'
        this._modalDialogs.metadata.element.showModal()
    }

    _createFilterDialog(bookContainer, isFixedLayout) {
        if (!this._modalDialogs.colorsFilter) {
            const dlg = colorFiltersDialog(bookContainer, this.view, this._appliedFilter, isFixedLayout)
            dlg.element.id = 'simebv-colors-filter-dialog'
            this._rootDiv.append(dlg.element)
            dlg.element.addEventListener('close', () => {
                for (const prop in this._appliedFilter) {
                    this._savePreference(prop, this._appliedFilter[prop])
                }
            })
            this._modalDialogs.colorsFilter = dlg
        }
    }

    openFilterDialog(bookContainer) {
        if (!this._modalDialogs.colorsFilter) {
            this._createFilterDialog(bookContainer)
        }
        this._modalDialogs.colorsFilter.element.showModal()
    }

    openFontsDialog() {
        if (!this._modalDialogs.fonts) {
            const dlg = fontsDialog(this, getCSS)
            dlg.element.id = 'simebv-fonts-dialog'
            dlg.element.classList.add('simebv-form-dialog')
            this._rootDiv.append(dlg.element)
            this._modalDialogs.fonts = dlg
        }
        this._modalDialogs.fonts.element.showModal()
    }

    openCorruptedDataDialog(type) {
        let dlg = this._modalDialogs.corruptedData
        if (!dlg) {
            dlg = corruptedDataDialog()
            dlg.element.id = 'simebv-corrupted-data-dialog'
            this._rootDiv.append(dlg.element)
            this._modalDialogs.corruptedData = dlg
        }
        dlg.element.onclose = e => {
            if (dlg.element.returnValue === 'clear') {
                this._prefsManager.discardCorrupted(type)
            }
        }
        dlg.setData(type, this._prefsManager.getCorruptedData(type))
        dlg.element.style.maxInlineSize = 'min(30rem, ' + (this._getContainerUnscaledWidth() - 20) + 'px)'
        if (!dlg.element.open) {
            dlg.element.returnValue = ''
            dlg.element.showModal()
        }
    }

    _corruptedDataHandler(e) {
        const { type, raw } = e.detail
        if (type === 'preferences') {
            if (raw !== undefined) {
                this._prefsManager.discardCorrupted(type)
            }
        }
        else {
            if (raw !== undefined) {
                this.openCorruptedDataDialog(type)
            }
            else {
                const dlg = this._modalDialogs.corruptedData
                if (dlg?.element.open && type === dlg.getData().type) {
                    dlg.element.close()
                }
            }
        }
    }
    _boundCorruptedDataHandler = this._corruptedDataHandler.bind(this)

    async open(fileUrl, options) {
        let {
            menuItems, initialMenuStatus, ebookTitle, ebookAuthor,
            fontFamily, allowJS, useMathStyles, filterEbookContent,
            showAnnotations, showPageDelimiters, popupNotes, openAt
        } = options
        this.view = document.createElement('simebv-foliate-view')
        this._bookContainer.append(this.view)
        const file = await fetchFile(fileUrl)
        await this.view.open(file, { CFI })
        this.view.book._defaultDir = this.view.book.dir
        this._openEbookFormat = await ebookFormat(file)
        this._populateMenu(menuItems)
        if (this.view.isFixedLayout) {
            this._bookContainer.classList.add('simebv-fxd-layout')
            if (this._alwaysFullViewport) {
                const ev = new CustomEvent('always-fullscreen')
                this._headerBar.dispatchEvent(ev)
                this._navBar.dispatchEvent(ev)
            }
        }
        else {
            this._bookContainer.classList.remove('simebv-fxd-layout')
        }
        this.view.addEventListener('load', this._onLoad.bind(this))
        this.view.history.addEventListener('index-change', this._updateHistoryMenuItems.bind(this))
        const newBookEvent = new CustomEvent('new-book', { detail: {
            fractions: this.view.getSectionFractions(),
            dir: this.view.book.dir
        }})
        this._navBar.dispatchEvent(newBookEvent)
        if (this.menu.groups.speechSynthesis) {
            this._speechManager = new SpeechManager(
                this.view, this._rootDiv, pluginBaseUrl(), this._openEbookFormat, {
                savePreference: this._savePreference.bind(this),
                loadPreference: this._loadPreference.bind(this),
            })
        }

        this._textSearch = new TextSearch(this.view, this._rootDiv)
        this._textSearch.target.addEventListener('simebv-search-cleanup', () => {
            this._closeMenus()
        })

        const { book } = this.view
        book.transformTarget?.addEventListener('data', ({ detail }) => {
            detail.data = transformDoc(detail, options, this._defaultFontSize)
        })

        this._navBar.addEventListener('go-left', () => this.view.goLeft())
        this._navBar.addEventListener('go-right', () => this.view.goRight())
        this._navBar.addEventListener('changed-page-slider', ({ detail }) => {
            this.view.goToFraction(parseFloat(detail.newLocation))
        })
        this.container.addEventListener('keydown', this._handleKeydown.bind(this))

        this._metadataFormatter = new MetadataFormatter(this._getEbookLocales())
        if (!ebookTitle) {
            ebookTitle = this._metadataFormatter.formatLanguageMap(book.metadata?.title) || file.name || 'Untitled Book'
        }
        ebookTitle = ebookTitle.slice(0, 260)
        this._ebookTitle = ebookTitle
        this._headerBar.setHeader(ebookTitle)
        this._headerBar.dispatchEvent(newBookEvent)
        this._sideBar.setTitle(ebookTitle)
        if (ebookAuthor) {
            ebookAuthor = ebookAuthor.slice(0, 260)
        }
        this._sideBar.setAuthor(ebookAuthor ? ebookAuthor : this._metadataFormatter.formatContributor(book.metadata?.author))
        Promise.resolve(book.getCover?.())?.then(blob =>
            blob ? this._sideBar.setCover(URL.createObjectURL(blob)) : null)
        this._sideBar.addEventListener('show-details', this.openMetadataDialog.bind(this))

        const toc = book.toc
        if (toc) {
            this._tocView = createTOCView(toc, href => {
                this.view.goTo(href).catch(e => console.error(e))
                this._closeMenus()
            })
            this._sideBar.attachToc(this._tocView)
        }

        this.view.addEventListener('draw-annotation', this.drawAnnotationHandler.bind(this))
        const annotationPrefs = this._prefsLoader.loadAnnotationPrefs(showAnnotations, showPageDelimiters)
        this._showAnnotations = annotationPrefs.showAnnotations
        this._showPageDelimiters = annotationPrefs.showPageDelimiters

        // load and show page delimiters if the ebook contains a page list
        const pageList = book.pageList
        if (pageList) {
            if (this._showPageDelimiters && !this.view.isFixedLayout) {
                this.view.addEventListener('create-overlay', this.boundPageListCreateOverlay)
                this.view.addEventListener('show-annotation', this.boundPageListShowAnnotation)
            }
            this._pageListView = createTOCView(pageList, target => {
                this.view.goTo(target).catch(e => console.error(e))
                this._closeMenus()
            })
            this._sideBar.attachPageList(this._pageListView)
            this._rootDiv.addEventListener('show-page-delimiters', e => {
                this._redrawOverlappingPageAnnotations('pages')
            })
        }

        // load and show highlights embedded in the file by Calibre
        const calibreBookmarks = await book.getCalibreBookmarks?.()
        if (calibreBookmarks) {
            for (const obj of calibreBookmarks) {
                if (obj.type === 'highlight') {
                    const value = CFI.fromCalibreHighlight(obj)
                    const color = obj.style.which
                    const note = obj.notes
                    const type = 'calibre-bookmark'
                    const annotation = { value, color, note, type }
                    const list = this.annotations.get(obj.spine_index)
                    if (list) list.push(annotation)
                    else this.annotations.set(obj.spine_index, [annotation])
                    this.annotationsByValue.set(value, annotation)
                }
            }
            if (this._showAnnotations) {
                this.view.addEventListener('create-overlay', this.boundBookmarksCreateOverlay)
                this.view.addEventListener('show-annotation', this.boundBookmarksShowAnnotation)
            }
        }

        this._bookmarksManager = this._setBookmarksManager()
        this._setBookmarksManagerHandlers()
        this._initBookmarks()

        if (popupNotes) {
            this._footnoteManager = new FootnoteManager(this, options, this._defaultFontSize)
            this._footnoteManager.handleFootnotes()
            this.style.popupNotes = true
        }
        else {
            this.style.popupNotes = false
        }

        this._setInitialMenuStatus(initialMenuStatus)
        this._prefsLoader.loadFilterPrefs(this._appliedFilter)
        this._createFilterDialog(this._rootDiv, this.view.isFixedLayout)
        this._createAnnotationsDialog()
        fontFamily = this._prefsLoader.loadFontFamilyPrefs(fontFamily)
        if (fontFamily) {
            this.style.fontFamily = fontFamily
        }

        this.view.renderer.setStyles?.(getCSS(this.style))

        this.view.addEventListener('relocate', this._onRelocate.bind(this))
        if (this.view.isFixedLayout) {
            this.setFxlRendererEventListeners()
            this._rendererResizeObserver = new ResizeObserver((entries) => {
                const r = this.view.renderer
                if (!r || entries[0].target !== r) return
                this.updateCursorGrab()
            })
            this._rendererResizeObserver.observe(this.view.renderer)
        }

        await this.goToLastReadPage(openAt)

        // Register the user interaction after the first relocate event.
        // The event fires multiple times from foliate-js during the ebook
        // opening, so wait a little before setting the listener.
        setTimeout(
            () => {
                this.view.addEventListener(
                'relocate', () => this._prefsManager.userInteraction(), { once: true }
            )},
            2000,
        )
        document.dispatchEvent(new CustomEvent('simebv-ebook-loaded'))

    }

    async reopen() {
        // work in progress
        const { book } = this.view
        this._rendererResizeObserver.disconnect()
        this.view.close()
        await this.view.open(book, { CFI })
        if (this.view.isFixedLayout) {
            this.setFxlRendererEventListeners()
        }
        this.goToLastReadPage()
    }

    setFxlRendererEventListeners() {
        this.view.renderer.addEventListener('relocate', this._boundOnFxlRelocate)
    }

    async goToLastReadPage(fallback) {
        // With certain formats (e.g. fb2), invalid values of lastLocation
        // can result in the ebook not opening but without raising errors,
        // so I try to make a bit of validation beforehand. Accepted values are
        // a non negative number, or a string that is a valid epubcfi.
        let lastLocation = this._getLastReadPage()  // should always be a string
        if (!isNumeric(lastLocation) && !CFI.isCFI.test(lastLocation)) {
            lastLocation = null
        }
        // pages and section numbers for the user start at 1, for the viewer start at 0
        if (parseInt(fallback) === Number(fallback)) {
            fallback = parseInt(fallback) - 1
        }
        if (lastLocation === null && isNumeric(fallback)) {
            lastLocation = fallback
        }
        if (isNumeric(lastLocation)) {
            if (lastLocation < 0) { lastLocation = 0 }
            if (lastLocation < 1) {
                lastLocation = {
                    fraction: Number(lastLocation)
                }
            }
            else {
                lastLocation = parseInt(lastLocation)
                if (lastLocation >= this.view.book.sections.length) {
                    lastLocation = this.view.book.sections.length - 1
                }
            }
        }
        try {
            await this.view.init({lastLocation, landmark: fallback})
        }
        catch(e) {
            console.error(e)
            if (lastLocation) {
                console.error(
                    'Cannot load the last read page:', lastLocation,
                    'nor the optional fallback:', fallback)
            }
            this.view.history.pushState(0)
            await this.view.next()
        }
    }

    updateCursorGrab() {
        const r = this.view?.renderer
        if (!r) return
        let cursor = ''
        if (r.scrollWidth > r.clientWidth || r.scrollHeight > r.clientHeight) {
            cursor = 'grab'
        }
        const docs = this.view.renderer.getContents().map(c => c.doc)
        for (const doc of docs) {
            if (doc.body) doc.body.style.cursor = cursor
        }
    }

    _populateMenu(customMenuItems) {
        if (customMenuItems) {
            this.menu.addMenuItems(customMenuItems)
            return
        }
        const menuItems = createMenuItemsStd(this, getCSS)
        if (this.view.isFixedLayout) {
            const maxPages = menuItems.get('maxPages')
            maxPages.items = maxPages.items.slice(0, 2)
            this.menu.addMenuItems([
                menuItems.get('search'),
                menuItems.get('history'),
            ])
            if (this._openEbookFormat !== 'cbz') {
                this.menu.addMenuItem(
                    menuItems.get('speechSynthesis'), true
                )
            }
            this.menu.addMenuItems([
                menuItems.get('maxPages'),
                menuItems.get('zoom'),
            ])
            if (['pdf', 'cbz'].includes(this._openEbookFormat)) {
                this.menu.addMenuItem(
                    menuItems.get('oddPages'), true
                )
            }
            this.menu.addMenuItems([
                menuItems.get('pageProgression'),
                menuItems.get('colors'),
                menuItems.get('colorFilter'),
                menuItems.get('positionViewer')
            ])
        }
        else {
            this.menu.addMenuItems([
                menuItems.get('search'),
                menuItems.get('history'),
                menuItems.get('speechSynthesis'),
                menuItems.get('layout'),
                menuItems.get('maxPages'),
                menuItems.get('colors'),
                menuItems.get('fontFamily'),
                menuItems.get('fontSize'),
                menuItems.get('textAlign'),
                menuItems.get('lineSpacing'),
                menuItems.get('hyphenation'),
                menuItems.get('margins'),
                menuItems.get('colorFilter'),
                menuItems.get('showAnnotations'),
                menuItems.get('positionViewer'),
            ])
        }
    }

    _setInitialMenuStatus(initialMenuStatus) {
        this.menu.groups.history?.items.previous.enable(false)
        this.menu.groups.history?.items.next.enable(false)
        if (!initialMenuStatus) {
            initialMenuStatus = getInitialMenuStatusStd()
        }
        let prefs = (initialMenuStatus?.bothBefore || [])
            .concat((this.view.isFixedLayout
                ? initialMenuStatus?.fixedLayout
                : initialMenuStatus?.reflowable) || [])
            .concat(initialMenuStatus?.bothAfter || [])
        this._prefsLoader.loadMenuPrefs(prefs, this.menu)
    }

    _setMenusMaxSize() {
        const headerHeight = this._headerBar
            ? this._headerBar.root.getBoundingClientRect().bottom - this.container.getBoundingClientRect().top
            : 62
        const scaleY = this.containerHeight / this.container.offsetHeight
        const maxBlockSize = 'min(85vh, ' + Math.round((this.containerHeight - headerHeight) / scaleY) + 'px)'

        const rightGap = this._headerBar
            ? this.container.getBoundingClientRect().right - this._headerBar.root.querySelector('#menu-button').getBoundingClientRect().right + 5
            : 48
        const scaleX = this.containerWidth / this.container.offsetWidth
        const maxInlineSize = 'min(85vw, ' + Math.round((this.containerWidth - rightGap) / scaleX) + 'px)'

        if (this.menu) {
            this.menu.element.style.maxBlockSize = maxBlockSize
            this.menu.element.style.maxInlineSize = maxInlineSize
        }
        const dlg = this._bookmarksManager?.getDialog()
        if (dlg) {
            dlg.style.maxBlockSize = maxBlockSize
            dlg.style.maxInlineSize = maxInlineSize
        }
    }

    _getContainerUnscaledWidth() {
        const scale = this.containerWidth / this.container.offsetWidth
        return Math.round(this.containerWidth / scale)
    }

    _updateHistoryMenuItems() {
        this.view?.history?.canGoBack
            ? this.menu.groups.history?.items.previous.enable(true)
            : this.menu.groups.history?.items.previous.enable(false)
        this.view?.history?.canGoForward
            ? this.menu.groups.history?.items.next.enable(true)
            : this.menu.groups.history?.items.next.enable(false)
    }

    _getEbookLocales() {
        let lang = this.view?.book?.metadata.language
        if (typeof lang === 'string') {
            lang = [lang]
        }
        return lang?.map(l => {
            try {
                return Intl.getCanonicalLocales(l)[0]
            }
            catch (e) {}
        }).filter(Boolean)
    }

    _toggleFullScreen() {
        if (this.container.requestFullscreen) {
            if (document.fullscreenElement) {
                document.exitFullscreen()
                this.view.removeAttribute('autohide-cursor')
            }
            else {
                this.container.requestFullscreen()
                    .then(() => this.view.setAttribute('autohide-cursor', ''))
            }
        }
        else {
            this._toggleFullViewport()
        }
    }

    #inerted = []
    _inertEverythingExcept(target) {
        const path = new Set()
        for (let el = target; el !== document.body; el = el.parentElement) {
            path.add(el)
        }
        for (const el of path) {
            for (const sibling of el.parentElement.children) {
                if (path.has(sibling) || sibling === target) continue
                if (sibling.hasAttribute('inert')) continue
                sibling.setAttribute('inert', '')
                this.#inerted.push(sibling)
            }
        }
    }

    _toggleFullViewport() {
        const detail = { fxl: this.view?.isFixedLayout, mode: 'viewport' }
        if (this.container.classList.contains('simebv-view-fullscreen')) {
            this.container.classList.remove('simebv-view-fullscreen')
            this._bookContainer.classList.remove('simebv-fullscreen')
            this.view?.removeAttribute('autohide-cursor')
            document.body?.classList.remove('simebv-overflow-hidden')
            this.container.hidePopover?.()
            this.#inerted.forEach(el => el.removeAttribute('inert'))
            this.#inerted = []
            // To prevent Chromium based browsers from scrolling down the page upon leaving fullscreen
            setTimeout(() => {
                document.documentElement.classList.remove('simebv-overflow-anchor-none')
                document.body?.classList.remove('simebv-overflow-anchor-none')
            }, 0)
            detail.data = 'exit'
        }
        else {
            this.container.classList.add('simebv-view-fullscreen')
            this._bookContainer.classList.add('simebv-fullscreen')
            this.view?.setAttribute('autohide-cursor', '')
            document.body?.classList.add('simebv-overflow-hidden')
            this.container.showPopover?.()
            this._inertEverythingExcept(this.container)
            document.documentElement.classList.add('simebv-overflow-anchor-none')
            document.body?.classList.add('simebv-overflow-anchor-none')
            detail.data = 'enter'
        }
        const toggleFullscreen = new CustomEvent('toggle-fullscreen', { detail })
        this._headerBar.dispatchEvent(toggleFullscreen)
        this._navBar.dispatchEvent(toggleFullscreen)
    }

    _setBookmarksManager() {
        const bookmarksPrefsName = (this.getBookIdentifier() ?? this.getCurrentTitle()) + '_bookmarks'
        const allowedBookmarksType = this.view.isFixedLayout && this._openEbookFormat !== 'epub'
            ? ['page'] : ['page', 'selection']
        const modalDlgContainer = this._rootDiv
        const containerWidth = this._getContainerUnscaledWidth.bind(this)
        const bm = new BookmarksManager(
            this.view, bookmarksPrefsName, this._getEbookLocales(),
            allowedBookmarksType, modalDlgContainer, containerWidth, {
            savePreference: this._savePreference.bind(this),
            loadPreference: this._loadPreference.bind(this),
            updatePreference: this._updatePreference.bind(this),
            hasConsent: () => this._prefsManager.hasConsent('functional'),
        })
        this._prefsManager.registerClient(bm.eventTarget, ['functional'], [bookmarksPrefsName])
        return bm
    }

    _setBookmarksManagerHandlers() {
        this._bookmarksManager.setupEventHandlers()
        const createBookmarksDlg = () => {
            if (this._bookmarksManager.getDialog()) return
            this._bookmarksManager.createDialog()
            this._headerBar.attachBookmarksDlg(
                this._bookmarksManager.getDialog(),
                this._bookmarksManager.isDialogOpen.bind(this._bookmarksManager)
            )
            this._setMenusMaxSize()
        }
        this._bookmarksManager.eventTarget.addEventListener('create-bookmarks-dlg', createBookmarksDlg)
        this._headerBar.addEventListener('bookmarks-button', e => {
            this._prefsManager.userInteraction()
            if (!this._bookmarksManager.getDialog()) {
                createBookmarksDlg()
            }
            if (!this._bookmarksManager.isDialogOpen()) {
                this._bookmarksManager.updateBookmarks()
            }
            // is the user clicks on a bookmark in page when the dialog is already open,
            // use showDialog to scroll to the clicked bookmark.
            const bookmark = e.detail?.bookmark
            const returnFocus = e.detail?.returnFocus
            if (bookmark) {
                this._bookmarksManager.showDialog(bookmark, returnFocus)
            }
            else {
                this._bookmarksManager.toggleDialog(returnFocus)
            }
        })
        this._bookmarksManager.eventTarget.addEventListener('close-bookmarks-dlg', () => {
            this._headerBar.dispatchEvent(new CustomEvent('close-bookmarks-dlg'))
        })
        this._bookmarksManager.eventTarget.addEventListener('open-bookmarks-dlg', () => {
            this._headerBar.dispatchEvent(new CustomEvent('open-bookmarks-dlg'))
        })

        const addBookmark = () => {
            this._prefsManager.userInteraction()
            const [location, text] = this._bookmarksManager.getLocationData()
            if (!location) return
            this._bookmarksManager.addBookmark(location, text)
        }
        this._headerBar.addEventListener('add-bookmark-button', addBookmark)
        this._bookmarksManager.eventTarget.addEventListener('add-bookmark-action', addBookmark)
        this._bookmarksManager.eventTarget.addEventListener('bookmarks-in-sight', e => {
            const { inSight } = e.detail
            this._headerBar.dispatchEvent(new CustomEvent('bookmarks-in-sight', { detail: { inSight } }))
        })
        this._bookmarksManager.eventTarget.addEventListener('show-user-bookmarks', e => {
            this._prefsManager.userInteraction()
            const { show } = e.detail
            this._bookmarksManager.showBookmarks(show)
            if (!show) this._redrawOverlappingPageAnnotations('bookmarks')
        })
        this._bookmarksManager.eventTarget.addEventListener('removed-bookmarks', e => {
            this._redrawOverlappingPageAnnotations('bookmarks', e.detail?.locations)
        })
        this.view.addEventListener('show-annotation', e => {
            if (!this._bookmarksManager.showBookmarksInPage) return
            const { value, index } = e.detail
            const bookmarks = this._bookmarksManager.getBookmarks(index)
            for (const b of bookmarks) {
                if (value === b.loc.cfi) {
                    this._headerBar.dispatchEvent(new CustomEvent('bookmarks-button', {
                        detail: { bookmark: b, returnFocus: this.container }
                    }))
                    break
                }
            }
        })
    }

    /**
     * Page bookmarks and page list delimiters for the same page
     * share the same cfi range, and the overlayer draws only
     * one annotation for cfi range. When the user chooses to hide
     * one of the two categories, the overlapping annotations of the
     * other category may need to be redrawn. Another possibility
     * is that the user deletes a page bookmark, in that case we have
     * a precise location and a single page delimiter to look for.
     */
    _redrawOverlappingPageAnnotations(hiddenType, locations) {
        if (!['bookmarks', 'pages'].includes(hiddenType)) return
        const guard = hiddenType === 'bookmarks'
            ? this._showPageDelimiters
            : this._bookmarksManager.showBookmarksInPage
        if (!guard || this.view.isFixedLayout) return
        if (hiddenType === 'bookmarks' && Array.isArray(locations)) {
            for (const cfi of locations) {
                const p = this.pageListByValue.get(cfi)
                if (p) this.view.addAnnotation(p)
            }
            return
        }
        for (const { index } of this.view.renderer.getContents()) {
            if (!this.pageList.get(index)?.length) continue
            const bookmarks = this._bookmarksManager.getBookmarks(index)
            for (const b of bookmarks) {
                const p = this.pageListByValue.get(b.loc.cfi)
                if (p) {
                    this.view.addAnnotation(
                        hiddenType === 'bookmarks' ? p : this._bookmarksManager.getAnnotation(b)
                    )
                }
            }
        }
    }

    _initBookmarks() {
        this._bookmarksManager.loadBookmarks()
        if (this._bookmarksManager.showBookmarksInPage) {
            this._bookmarksManager.showBookmarks(true)
        }
    }

    _handleKeydown(e) {
        if (this._rootDiv.querySelector('dialog:modal')) {
            return
        }
        const k = e.key
        switch (k) {
            case 'PageUp':
                e.preventDefault()
                this.view.prev()
                if (this.view.isFixedLayout) {
                    this.container.focus()
                }
                break
            case 'PageDown':
                e.preventDefault()
                this.view.next()
                if (this.view.isFixedLayout) {
                    this.container.focus()
                }
                break
            case 'ArrowLeft':
                e.preventDefault()
                this.view.goLeft()
                if (this.view.isFixedLayout) {
                    this.container.focus()
                }
                break
            case 'ArrowRight':
                e.preventDefault()
                this.view.goRight()
                if (this.view.isFixedLayout) {
                    this.container.focus()
                }
                break
            case 'ArrowUp':
            case 'ArrowDown':
                if (this._speechManager?.isActive) {
                    e.preventDefault()
                    this._speechManager.keydownHandler(e)
                }
                break
            case 'Tab':
                if (this.menu.element.classList.contains('simebv-show')
                        || this._sideBar.isVisible()) {
                    this._closeMenus()
                }
                break
            case 'Escape':
                if (this.menu.element.classList.contains('simebv-show')
                        || this._sideBar.isVisible()) {
                    this._closeMenus()
                }
                else if (this._realFullscreen && document.fullscreenElement) {
                    this._toggleFullScreen()
                }
                else if (!this._alwaysFullViewport
                        && this.container.classList.contains('simebv-view-fullscreen')) {
                    this._toggleFullViewport()
                }
                break
            case 'F':
            case 'f':
                if (k === 'F' ^ e.getModifierState('CapsLock')) {
                    break
                }
                if (e.ctrlKey) {
                    this._closeMenus()
                    this._textSearch.openDialog(this.container)
                    e.preventDefault()
                }
                break
            case 'P':
            case 'p':
                if (k === 'p' ^ e.getModifierState('CapsLock')) {
                    break
                }
                if (e.shiftKey && this._speechManager?.isActive === false) {
                    const activeElement = this.getActiveElement()
                    if (isElementWritable(activeElement)) {
                        break
                    }
                    this._closeMenus()
                    this._speechManager.open()
                    this._prefsManager.userInteraction()
                    e.preventDefault()
                }
                break
            case 'B':
            case 'b':
                if (k === 'B' ^ e.getModifierState('CapsLock'))  {
                    break
                }
                if (e.ctrlKey && !e.shiftKey && !e.altKey) {
                    const activeElement = this.getActiveElement()
                    if (isElementWritable(activeElement)) {
                        break
                    }
                    this._bookmarksManager?.eventTarget.dispatchEvent(new CustomEvent('add-bookmark-action'))
                    e.preventDefault()
                }
                break
        }
    }

    _onLoad({ detail: { doc } }) {
        const loadingOverlay = this._root.getElementById('simebv-loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('simebv-show');
        }
        if (this._speechManager?.isActive && !this.view.isFixedLayout) {
            this._speechManager.onSectionLoad()
        }
        doc.addEventListener('keydown', this._handleKeydown.bind(this))
        if (this._openEbookFormat === 'cbz') {
            doc.addEventListener('dblclick', () => {
                if (['fit-page', 'fit-width'].includes(this.menu.groups.zoom?.current())) {
                    this.menu.groups.zoom?.select('custom')
                }
                else {
                    this.menu.groups.zoom?.select('fit-page')
                }
            })
        }
        setTouchEvents(doc, this)
        if (this._bookmarksManager.canBookmarkSelection()) {
            doc.addEventListener('selectionchange', e => {
                let docs = this.view.renderer.getContents().map(c => c.doc)
                const s = new CustomEvent('selection', { detail: { docs }})
                this._headerBar.dispatchEvent(s)
                this._bookmarksManager.eventTarget.dispatchEvent(s)
            })
        }
    }


    _onRelocate({ detail }) {
        const { fraction, section, location, tocItem, pageItem, cfi } = detail
        this._savePreference(
            this._lastReadPagePrefName(),
            this.view.isFixedLayout ? section.current : (cfi ?? fraction),
            'functional',
        )
        const percent = percentFormat.format(fraction)
        let currentPage = location.current + 1
        let totalPages = location.total
        if (this.view.isFixedLayout) {
            currentPage = section.current + 1
            totalPages = section.total
        }
        let loc
        let page
        if (pageItem) {
            loc = sprintf(
                /* translators: %1$s: page number */
                __('Page %1$s', 'simple-ebook-viewer'), pageItem.label
            )
            page = sprintf(
                /* translators: %1$s: page number */
                __('Page %1$s', 'simple-ebook-viewer'), pageItem.label
            )
        }
        else if (this.view.book.pageList?.length) {
            loc = __('Front matter', 'simple-ebook-viewer')
            page = __('Front matter', 'simple-ebook-viewer')
        }
        else {
            loc = sprintf(
                /* translators: Location in the book, followed by a numerical fraction */
                __('Location %1$s/%2$s', 'simple-ebook-viewer'), location.current + 1, location.total
            )
            page = sprintf(
                /* translators: current page number / total pages number */
                __('Page %1$s / %2$s', 'simple-ebook-viewer'), currentPage, totalPages
            )
        }
        this._navBar.dispatchEvent(new CustomEvent('relocate', { detail: {
            sliderValue: fraction,
            sliderTitle: `${percent} · ${this.view.isFixedLayout ? page : loc}`,
            percent,
            page,
        }}))
        if (tocItem?.href) this._tocView?.setCurrentHref?.(tocItem.href)
        if (pageItem?.href) this._pageListView?.setCurrentHref?.(pageItem.href)
        if (this._hideTitle === 'first-page') {
            const r = this.view.renderer
            const atStart = this.view.isFixedLayout
                ? detail.section.current === 0
                : r.scrolled ? r.start <= 0 && r.atStart : r.atStart
            if (atStart) this._headerBar.hideHeader()
            else this._headerBar.showHeader()
        }
        this._bookmarksManager.checkBookmarksInSight(this.view.isFixedLayout
            ? this.view.renderer.getContents().map(obj => obj.index) : cfi
        )
    }

    _onFxlRelocate({ detail }) {
        const current = this.view.lastLocation.section.current
        if (this._speechManager?.isActive) {
            if (this._speechManager._lastSection !== current) {
                this._speechManager.onSectionLoad(detail.reason)
            }
            this._speechManager._lastSection = current
        }
        setMousePanEvents(this.view.renderer)
        if (this._bookmarksManager.canBookmarkSelection()) {
            const docs = this.view.renderer.getContents().map(c => c.doc)
            const s = new CustomEvent('selection', { detail: { docs }})
            this._headerBar.dispatchEvent(s)
            this._bookmarksManager.eventTarget.dispatchEvent(s)
        }
    }
    _boundOnFxlRelocate = this._onFxlRelocate.bind(this)

    getBookIdentifier() {
        return this.view?.book?.metadata?.identifier || null
    }

    getCurrentTitle() {
        return this._ebookTitle
    }

    _lastReadPagePrefName() {
        return (this.getBookIdentifier() ?? this.getCurrentTitle()) + '_LastPage'
    }

    _getLastReadPage() {
        return this._loadPreference(this._lastReadPagePrefName(), 'functional')
    }

    _savePreferences(prefs) {
        this._prefsManager.savePreferences(prefs)
    }

    _savePreference(name, value, type = 'preferences') {
        this._prefsManager.savePreference(name, value, type)
    }

    _updatePreference(name, value, type = 'preferences') {
        return this._prefsManager.updatePreference(name, value, type)
    }

    _loadPreference(name, type = 'preferences') {
        return this._prefsManager.loadPreference(name, type)
    }

    setLocalizedDefaultInterface(root) {
        root.getElementById('simebv-loading-overlay-text').innerText = __('Loading...', 'simple-ebook-viewer')
        root.getElementById('simebv-book-container').setAttribute('aria-label', __('Ebook contents', 'simple-ebook-viewer'))
    }
}


// from vendor/foliate-js/view.js
const fetchFile = async url => {
    const res = await fetch(url)
    if (!res.ok) {
        throw new Error(
            `${res.status} ${res.statusText}`, { cause: res }
        )
    }
    return new File([await res.blob()], new URL(res.url).pathname)
}


const refreshRestNonce = async () => {
    const res = await fetch(`${wpApiSettings.root}simebv/v1/nonce`, {
        credentials: 'same-origin',
        cache: 'no-store',
    })
    if (!res.ok) {
        throw new Error(`Nonce refresh failed: ${res.status}`)
    }
    const { nonce } = await res.json()
    wpApiSettings.nonce = nonce
    if (wp.api?.settings) wp.api.settings.nonce = nonce
    return nonce
}


export const get_ebook_url = async id => {
    await wp.api.loadPromise
    const fetchMedia = async () => {
        const media = new wp.api.models.Media({ id })
        const res = await media.fetch()
        return new URL(res.source_url).href
    }
    try {
        return await fetchMedia()
    } catch (e) {
        const status = e?.status ?? e?.statusCode
        if (status !== 401 && status !== 403) throw e
        await refreshRestNonce()
        return fetchMedia()
    }
}


export const show_error_msg = (container, msg) => {
    container.style.textAlign = 'center'
    container.style.padding = '12px'
    container.innerText = ''
    container.append(msg)
}


export const gatherOptionsFromContainer = container => {
    const options = {
        reader: {},
        ebook: {}
    }
    if (container.getAttribute('data-simebv-always-full-viewport') === 'true') {
        options.reader.alwaysFullViewport = true
    }
    let return_to_url = container.getAttribute('data-simebv-return-to-url')
    if (return_to_url) {
        return_to_url = new URL(return_to_url, window.location.origin)
        if (return_to_url.origin === window.location.origin) {
            options.reader.closeViewerCallback = () => window.location.assign(return_to_url.href)
        }
    }
    if (container.getAttribute('data-simebv-real-fullscreen') === 'true') {
        options.reader.realFullscreen = true
    }
    if (['always', 'first-page'].includes(container.getAttribute('data-simebv-hide-title'))) {
        options.reader.hideTitle = container.getAttribute('data-simebv-hide-title')
    }
    if (container.getAttribute('data-simebv-allow-js') === 'true') {
        options.ebook.allowJS = true
    }
    if (['fonts', 'styles', 'all'].includes(container.getAttribute('data-simebv-math-styles'))) {
        options.ebook.useMathStyles = container.getAttribute('data-simebv-math-styles')
    }
    if (container.hasAttribute('data-simebv-font-family')) {
        options.ebook.fontFamily = container.getAttribute('data-simebv-font-family')
    }
    if (container.getAttribute('data-simebv-show-annotations') === 'true') {
        options.ebook.showAnnotations = true
    }
    if (container.getAttribute('data-simebv-show-page-delimiters') === 'true') {
        options.ebook.showPageDelimiters = true
    }
    if (container.getAttribute('data-simebv-popup-notes') === 'true') {
        options.ebook.popupNotes = true
    }
    if (container.hasAttribute('data-simebv-open-at')) {
        options.ebook.openAt = container.getAttribute('data-simebv-open-at')
    }
    options.ebook.ebookTitle = container.getAttribute('data-simebv-ebook-title') || ''
    options.ebook.ebookAuthor = container.getAttribute('data-simebv-ebook-author') || ''
    return options
}


export const initializeViewer = async containerID => {
    const ebook_path_el = document.getElementById(containerID);
    if (ebook_path_el) {
        let url
        const dataUrl = ebook_path_el.getAttribute('data-ebook-url')
        if (dataUrl) {
            try {
                url = new URL(dataUrl, window.location.href).href
            } catch (e) {
                console.warn(e)
            }
        }
        if (!url) {
            try {
                url = await get_ebook_url(ebook_path_el.getAttribute('data-ebook-id'))
            } catch (e) {
                const msg = __('Error: I couldn\'t retrieve the book to display.', 'simple-ebook-viewer')
                show_error_msg(ebook_path_el, msg)
                console.error(e)
                if (e.status === 404) {
                    ebook_path_el.append(
                        document.createElement('br'),
                        __('Resource not found on the server', 'simple-ebook-viewer')
                    )
                }
                else if (e.responseJSON?.message) {
                    ebook_path_el.append(document.createElement('br'), e.responseJSON.message)
                }
            }
        }
        if (url) {
            try {
                const options = gatherOptionsFromContainer(ebook_path_el)
                const reader = new Reader(ebook_path_el, options.reader)
                await reader.open(url, options.ebook)
            } catch (e) {
                const msg = document.createElement('p')
                msg.append(
                    __('Error while opening the book:', 'simple-ebook-viewer'),
                    document.createElement('br'),
                    e.message
                )
                if (ebook_path_el.shadowRoot) {
                    ebook_path_el.shadowRoot.innerHTML = ''
                    const newRoot = document.createElement('div')
                    ebook_path_el.shadowRoot.append(newRoot)
                    show_error_msg(newRoot, msg)
                }
                else {
                    show_error_msg(ebook_path_el, msg)
                }
                console.error(e)
            }
        }
    }
}


export * from './simebv-view.js'
export * from './simebv-navbar.js'
export * from './simebv-header.js'
export * from './simebv-sidebar.js'
export * from './simebv-utils.js'
export * from './simebv-component-styles.js'
export * from './simebv-transform-ebook.js'
export * from './simebv-overlayer-shapes.js'
export * from './simebv-non-empty-range.js'
export * from './simebv-search-dialog.js'
export * from './simebv-filters-dialog.js'
export * from './simebv-metadata-dialog.js'
export * from './simebv-fonts-dialog.js'
export * from './simebv-bookmarks-dialog.js'
export * from './simebv-bookmarks-add-dialog.js'
export * from './simebv-annotations-dialog.js'
export * from './simebv-show-annotation-dialog.js'
export * from './simebv-corrupted-data-dialog.js'
export * from './simebv-speech-dialog.js'
export * from './simebv-speech.js'
export * from './simebv-sre.js'
export * from './simebv-tts.js'
export * from './simebv-i18n.js'
export * from './simebv-bookmarks.js'
export * from './simebv-footnotes.js'
export * from './simebv-page-list.js'
export * from './simebv-menu.js'
export * from './simebv-menu-items.js'
export * from './simebv-ebook-format.js'
export * from './simebv-search.js'
export * from './simebv-epubcfi.js'
export * from './simebv-doc-touchevents.js'
export * from './simebv-fxl-mousepan.js'
export * from './simebv-preferences.js'
export * from '../../vendor/foliate-js/ui/tree.js'
export * from '../../vendor/foliate-js/overlayer.js'
