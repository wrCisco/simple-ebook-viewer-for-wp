import { bookmarksDialog } from './simebv-bookmarks-dialog.js'
import { addBookmarkDialog } from './simebv-bookmarks-add-dialog.js'
import { CFI } from './simebv-epubcfi.js'
import { getNonEmptyRange, requestPersistentStorage } from './simebv-utils.js'
import { __, _x, _n, sprintf } from './simebv-i18n.js'

const insertSorted = (list, bookmark) => {
    let edited = -1
    let inserted = false
    for (const [i, b] of list.entries()) {
        if (b.loc.cfi === bookmark.loc.cfi) {
            b.content = bookmark.content
            edited = i
            break
        }
        else if (CFI.compare(b.loc.cfi, bookmark.loc.cfi) > 0) {
            list.splice(i, 0, bookmark)
            inserted = true
            break
        }
    }
    if (edited === -1 && !inserted) {
        list.push(bookmark)
    }
    return [list, edited]
}

const removeSorted = (list, bookmark) => {
    for (const [i, b] of list.entries()) {
        if (b.loc.cfi === bookmark.loc.cfi) {
            const deleted = list.splice(i, 1)[0]
            return [list, deleted]
        }
    }
    return [list, undefined]
}


export class BookmarksManager {
    #view
    #bookmarksPrefsName
    #ebookLocales
    #bookmarksTypes
    #containerWidth
    #savePreference
    #loadPreference
    #updatePreference
    #hasConsent
    #bookmarks
    #bookmarksBin
    #dlg  // main bookmarks dialog
    #addBookmarkDlg
    #rootContainer
    #showBookmarksInPage
    #bookmarkInSight
    #segmenter
    eventTarget = new EventTarget()

    constructor(view, bookmarksPrefsName, ebookLocales,
            bookmarksTypes, rootContainer, containerWidth,
            { savePreference, loadPreference, updatePreference, hasConsent }) {
        this.#view = view
        this.#bookmarks = []
        this.#bookmarksBin = new Set()
        this.#bookmarksPrefsName = bookmarksPrefsName
        this.#ebookLocales = ebookLocales
        this.#bookmarksTypes = bookmarksTypes
        this.#rootContainer = rootContainer
        this.#containerWidth = containerWidth
        this.#savePreference = savePreference
        this.#loadPreference = loadPreference
        this.#updatePreference = updatePreference
        this.#hasConsent = hasConsent

        this.#segmenter = new Intl.Segmenter(this.#ebookLocales, { granularity: 'grapheme'})
    }

    setupEventHandlers() {
        this.eventTarget.addEventListener('save-bookmark', e => {
            const { loc, content, textInBook } = e.detail
            const editedIndex = this.saveBookmark({ loc, content, inBook: textInBook })
            this.#dlg?.updateAlert('')
            if (this.#dlg?.element.open) {
                if (editedIndex === -1) {
                    this.updateBookmarks()
                }
                else {
                    this.updateBookmark(loc)
                }
            }
        })
        this.eventTarget.addEventListener('remove-bookmark', e => {
            const { location } = e.detail
            const deleted = this.removeBookmark(location)
            this.#dlg?.updateAlert('')
            if (this.#dlg?.element.open) {
                this.updateBookmarks({ deleted: [deleted] })
                this.#dlg.focusTo(location)
            }
        })
        this.eventTarget.addEventListener('edit-bookmark', e => {
            const { location, textInBook } = e.detail
            if (location) {
                const returnFocus = true
                this.addBookmark(location, textInBook, returnFocus)
            }
        })
        this.eventTarget.addEventListener('recover-bookmark', e => {
            const { bookmark } = e.detail
            const { loc, content, inBook } = bookmark
            this.#bookmarksBin.delete(bookmark)
            this.eventTarget.dispatchEvent(new CustomEvent('save-bookmark', {
                detail: { loc, content, textInBook: inBook }
            }))
            this.#dlg.focusTo(loc)
        })
        this.eventTarget.addEventListener('focus-bookmark', e => {
            const { loc } = e.detail
            this.#dlg.focusTo(loc)
        })
        this.eventTarget.addEventListener('close-bookmarks-dlg', () => {
            this.flushBookmarksBin()
        })
        this.eventTarget.addEventListener('storage-changed', e => {
            if (e.detail.name === this.#bookmarksPrefsName) {
                const cfi = this.#dlg?.element.getRootNode().activeElement?.closest('li')?.dataset.cfi
                const [added, deleted] = this.loadBookmarks()
                this.updateBookmarks({
                    updateOverlay: this.showBookmarksInPage, added, deleted
                })
                if (cfi && this.isDialogOpen()) this.#dlg.focusTo({ cfi })
                if (added.length > 0 || deleted.length > 0) {
                    this.#checkInSight()
                }
            }
        })
        this.eventTarget.addEventListener('selection', e => {
            if (!this.canBookmarkSelection()) return
            const { docs } = e.detail
            let hasSelection
            for (const doc of docs) {
                const sel = doc.getSelection()
                hasSelection = sel && !sel.isCollapsed
                if (hasSelection) break
            }
            const hint = !hasSelection
            this.#dlg?.updateSelectionStatus(hasSelection, hint)
        })
        this.eventTarget.addEventListener('error-storage', e => {
            if (this.#dlg?.isShowingAlert()) return
            const { storageName, error } = e.detail
            let msg = sprintf(
                /* translators: %1$s: storage category (localstorage, cookies...) */
                __('Bookmarks not saved: error while writing in %1$s.', 'simple-ebook-viewer'), storageName
            )
            if (error?.name) {
                msg += ' ' + sprintf(__('Error name: %1$s', 'simple-ebook-viewer'), error.name)
            }
            if (!this.#dlg) {
                this.eventTarget.dispatchEvent(new CustomEvent('create-bookmarks-dlg'))
                this.updateBookmarks()
            }
            if (!this.isDialogOpen()) {
                this.showDialog()
            }
            this.#dlg.updateAlert(msg)
        })
        this.eventTarget.addEventListener('no-consent-storage', e => {
            if (this.#dlg?.isShowingAlert()) return
            const { type } = e.detail
            const msg = sprintf(
                /* translators: %1$s: data category (functional, preference, marketing...) */
                __("Bookmarks not saved: missing permission to save %1$s data in this device"), type
            )
            if (!this.#dlg) {
                this.eventTarget.dispatchEvent(new CustomEvent('create-bookmarks-dlg'))
                this.updateBookmarks()
            }
            if (!this.isDialogOpen()) {
                this.showDialog()
            }
            this.#dlg.updateAlert(msg)
        })
    }

    get showBookmarksInPage() {
        if (this.#showBookmarksInPage === undefined) {
            this.#showBookmarksInPage = this.#loadPreference('show-user-bookmarks')
        }
        return this.#showBookmarksInPage
    }

    canBookmarkSelection() {
        return this.#bookmarksTypes.includes('selection')
    }

    saveBookmark(bookmark) {
        const [_, editedIndex] = insertSorted(this.#bookmarks, bookmark)
        if (editedIndex !== -1) {
            bookmark = this.#bookmarks[editedIndex]
        }
        else if (this.showBookmarksInPage) {
            const annotation = { value: bookmark.loc.cfi, type: `user-bookmark-${bookmark.loc.type}` }
            this.drawAnnotation(annotation)
        }
        this.#bookmarks = this.#updatePreference(
            this.#bookmarksPrefsName, list => insertSorted([...list ?? []], bookmark)[0], 'functional'
        )
        if (!this.#bookmarkInSight) {
            this.#checkInSight()
        }
        if (this.#hasConsent()) requestPersistentStorage()
        return editedIndex
    }

    loadBookmarks() {
        const bookmarks = this.#loadPreference(this.#bookmarksPrefsName, 'functional')
        const added = []
        const deleted = []
        if (bookmarks) {
            for (const bookmark of this.#bookmarks) {
                if (!bookmarks.map(b => b.loc.cfi).includes(bookmark.loc.cfi)) {
                    deleted.push(bookmark)
                }
            }
            for (const bookmark of bookmarks) {
                if (!this.#bookmarks.map(b => b.loc.cfi).includes(bookmark.loc.cfi)) {
                    added.push(bookmark)
                }
            }
            this.#bookmarks = bookmarks
        }
        return [added, deleted]
    }

    getBookmarks(index) {
        const list = []
        for (const b of this.#bookmarks) {
            if (b.loc.section - 1 === index) {
                list.push(b)
            }
        }
        return list
    }

    getLocationData() {
        if (!this.#view.lastLocation) return []
        const page = this.#view.lastLocation.location.current
        if (this.#bookmarksTypes.includes('selection')) {
            for (const { doc, index } of this.#view.renderer.getContents()) {
                const sel = doc?.getSelection()
                if (!sel || sel.isCollapsed) continue
                const range = sel.getRangeAt(0)
                const { tocItem, pageItem } = this.#view.getProgressOf(index, range)
                const cfi = this.#view.getCFI(index, range)
                const text = sel.toString()
                return [
                    {
                        cfi,
                        tocLabel: this.#truncateString(tocItem?.label, 48, true),
                        section: index + 1,
                        pageLabel: pageItem?.label,
                        page: this.#view.isFixedLayout ? index + 1 : page + 1,
                        type: 'selection',
                    },
                    text,
                ]
            }
        }
        const section = this.#view.lastLocation.section.current
        const range = this.#view.lastLocation.range  // null for fixed-layout ebooks
        const { tocItem, pageItem } = this.#view.getProgressOf(section, range)
        const { doc } = this.#view.getCurrentContents()
        let bookmarkRange
        let startNode
        let startOffset = 0
        if (!this.canBookmarkSelection()) {
            // as of now, PDF and CBZ: reevaluate in case of changes
            bookmarkRange = doc.createRange()
            bookmarkRange.selectNode(doc.body.firstElementChild)
        }
        else {
            if (this.#view.isFixedLayout) {
                startNode = doc.body.firstElementChild
            }
            else {
                if (pageItem?.href) {
                    const resolved = this.#view.resolveNavigation(pageItem.href)
                    if (resolved?.index === section) {
                        startNode = resolved.anchor?.(doc)
                    }
                }
                if (!startNode) {
                    startNode = range.startContainer
                    startOffset = range.startOffset
                }
            }
            bookmarkRange = getNonEmptyRange(startNode, startOffset)
        }
        const cfi = this.#view.getCFI(section, bookmarkRange)
        return [
            {
                cfi,
                tocLabel: this.#truncateString(tocItem?.label, 48, true),
                section: section + 1,
                pageLabel: pageItem?.label,
                page: this.#view.isFixedLayout ? section + 1 : page + 1,
                type: 'page',
            },
            '',
        ]
    }

    #truncateString(str, qty, ellipsis) {
        if (!str) return ''
        const segments = this.#segmenter.segment(str)
        let text = []
        let i = 0
        for (const { segment } of segments) {
            if (++i > qty) {
                if (ellipsis) text.push('…')
                break
            }
            text.push(segment)
        }
        return text.join('')
    }

    getBookmarkLabel(location, min = 0) {
        let { tocLabel, section, pageLabel, page } = location
        if (typeof page === 'number' && min) {
            page = Math.max(page, min)
        }
        const p = pageLabel ?? page
        if (tocLabel) {
            if (p) {
                return sprintf(
                    /* translators: %1$s: chapter title, %2$s: page number */
                    __('%1$s - Page %2$s', 'simple-ebook-viewer'), tocLabel, p
                )
            }
            else return tocLabel
        }
        if (p) {
            if (this.#view.isFixedLayout) {
                return sprintf(
                    /* translators: %1$s: page number */
                    __('Page %1$s', 'simple-ebook-viewer'), p
                )
            }
            return sprintf(
                /* translators: %1$s: section number, %2$s: page number */
                __('Section %1$s - Page %2$s', 'simple-ebook-viewer'), section, p
            )
        }
        return sprintf(
            /* translators: %1$s: section number */
            __('Section %1$s', 'simple-ebook-viewer'), section
        )
    }

    addBookmark(location, textInBook, returnFocus) {
        if (!this.#addBookmarkDlg) {
            this.#addBookmarkDlg = addBookmarkDialog(this.eventTarget)
            this.#addBookmarkDlg.element.id = 'simebv-add-bookmarks-dialog'
            this.#rootContainer.append(this.#addBookmarkDlg.element)
        }
        const label = this.getBookmarkLabel(location)
        const b = this.#bookmarks.find(b => b.loc.cfi === location.cfi)
        let content = ''
        let dlgHeader = location.type === 'selection'
            ? __('Bookmark current selection', 'simple-ebook-viewer')
            : __('Bookmark this page', 'simple-ebook-viewer')
        if (b) {
            content = b.content ?? ''
            textInBook = b.inBook ?? ''
            dlgHeader = __('Edit bookmark', 'simple-ebook-viewer')
        }
        textInBook = this.#truncateString(textInBook, 24, true)
        this.#addBookmarkDlg.setData({ label, data: location}, content, textInBook, returnFocus, dlgHeader)
        this.#addBookmarkDlg.element.style.maxInlineSize = 'min(30rem, ' + (this.#containerWidth() - 20) + 'px)'
        this.#addBookmarkDlg.element.showModal()
    }

    removeBookmark(location) {
        const [_, deleted] = removeSorted(this.#bookmarks, { loc: location })
        if (deleted) {
            if (deleted.loc.cfi === this.#bookmarkInSight?.loc.cfi) {
                this.#checkInSight()
            }
            this.#view.deleteAnnotation({ value: deleted.loc.cfi })
            this.#bookmarks = this.#updatePreference(
                this.#bookmarksPrefsName, list => removeSorted([...list ?? []], deleted)[0], 'functional'
            )
            this.eventTarget.dispatchEvent(new CustomEvent('removed-bookmarks', { detail: { locations: [location.cfi] }}))
        }
        return deleted
    }

    updateBookmark(loc) {
        if (!this.#dlg?.element) return
        this.#dlg.updateBookmark(this.#bookmarks.find(b => b.loc.cfi === loc.cfi))
    }

    updateBookmarks({ updateOverlay, added = [], deleted = [] } = {}) {
        if (this.#bookmarks.length === 0) this.loadBookmarks()
        if (updateOverlay) {
            for (const { index } of this.#view.renderer.getContents()) {
                this.updateOverlay(index, added, deleted)
            }
        }
        added.forEach(d => this.#bookmarksBin.delete(d))
        if (this.isDialogOpen()) deleted.forEach(d => this.#bookmarksBin.add(d))
        if (!this.#dlg?.element) return
        const fixedLayout = this.#view.isFixedLayout
        this.#dlg.updateBookmarks(this.#bookmarks, this.#bookmarksBin,
            fixedLayout, this.getBookmarkLabel.bind(this), target => {
            this.#view.goTo(target)
        })
    }

    flushBookmarksBin() {
        this.#bookmarksBin.clear()
    }

    showBookmarks(show) {
        if (show) {
            this.#view.addEventListener('create-overlay', this.boundCreateOverlay)
        }
        else {
            this.#view.removeEventListener('create-overlay', this.boundCreateOverlay)
        }
        for (const { index } of this.#view.renderer.getContents()) {
            if (show) {
                this.createOverlay({ detail: { index }})
            }
            else {
                const bookmarks = this.getBookmarks(index)
                for (const b of bookmarks) {
                    this.#view.deleteAnnotation({ value: b.loc.cfi })
                }
            }
        }
        this.#savePreference('show-user-bookmarks', show)
        this.#showBookmarksInPage = show
    }

    getAnnotation(bookmark) {
        return { value: bookmark.loc.cfi, type: `user-bookmark-${bookmark.loc.type}` }
    }

    updateOverlay(index, add, remove) {
        const indices = this.#view.renderer.getContents().map(c => c.index)
        for (const bookmark of add) {
            if (!indices.includes(bookmark.loc.section - 1)) continue
            this.drawAnnotation(this.getAnnotation(bookmark))
        }
        if (remove.length > 0) {
            const locs = remove
                .filter(b => indices.includes(b.loc.section - 1))
                .map(b => b.loc.cfi)
            for (const l of locs) {
                this.#view.deleteAnnotation({ value: l })
            }
            this.eventTarget.dispatchEvent(new CustomEvent('removed-bookmarks', {
                detail: { locations: locs }
            }))
        }
    }

    createOverlay(e) {
        const { index } = e.detail
        for (const bookmark of this.getBookmarks(index)) {
            this.drawAnnotation(this.getAnnotation(bookmark))
        }
    }
    boundCreateOverlay = this.createOverlay.bind(this)

    drawAnnotation(annotation) {
        this.#view.addAnnotation(annotation)
    }

    #checkInSight() {
        const { lastLocation, isFixedLayout } = this.#view
        const boundaries = isFixedLayout
            ? this.#view.renderer.getContents().map(obj => obj.index)
            : lastLocation?.cfi
        if (!boundaries) return
        this.checkBookmarksInSight(boundaries)
    }

    checkBookmarksInSight(boundaries) {
        const inSight = []
        if (Array.isArray(boundaries)) { // array of section indices
            for (const b of this.#bookmarks) {
                if (boundaries.includes(b.loc.section - 1)) {
                    inSight.push(b)
                    break
                }
                else if (b.loc.section - 1 > Math.max(...boundaries)) {
                    break
                }
            }
        }
        else {
            const [start, end] = [CFI.collapse(boundaries), CFI.collapse(boundaries, true)]
            for (const b of this.#bookmarks) {
                const [bStart, bEnd] = [CFI.collapse(b.loc.cfi), CFI.collapse(b.loc.cfi, true)]
                if (CFI.compare(bEnd, start) > 0 && CFI.compare(bStart, end) < 0) {
                    inSight.push(b)
                    break
                }
                else if (CFI.compare(bStart, end) >= 0) {
                    break
                }
            }
        }
        this.updateBookmarkInSight(inSight)
    }

    updateBookmarkInSight(inSight) {
        this.eventTarget.dispatchEvent(
            new CustomEvent('bookmarks-in-sight', { detail: { inSight: inSight.length > 0 }})
        )
        this.#bookmarkInSight = inSight[0]
    }

    createDialog(updateBookmarks = false) {
        const show = this.showBookmarksInPage ?? false
        let hasSelection = false
        let showHint = false
        if (this.#bookmarksTypes.includes('selection')) {
            for (const { doc } of this.#view.renderer.getContents()) {
                const sel = doc.getSelection()
                if (sel && !sel.isCollapsed) hasSelection = true
                showHint = !hasSelection
            }
        }
        this.#dlg = bookmarksDialog(this.eventTarget, show, hasSelection, showHint)
        this.#dlg.element.classList.add('simebv-bookmarks-dlg')
        if (updateBookmarks) this.updateBookmarks()
    }

    showDialog(showBookmark, returnFocus) {
        if (!this.#dlg?.element) return
        this.#dlg.show(returnFocus)
        if (!showBookmark) showBookmark = this.#bookmarkInSight
        if (showBookmark) {
            this.#dlg.showBookmark(showBookmark)
        }
    }

    closeDialog(returnFocus) {
        if (!this.#dlg?.element) return
        this.#dlg.close()
        returnFocus?.focus()
    }

    toggleDialog(returnFocus) {
        if (!this.#dlg?.element) return
        if (this.#dlg.element.open) {
            this.closeDialog(returnFocus)
        }
        else {
            this.showDialog(undefined, returnFocus)
        }
    }

    getDialog() {
        return this.#dlg?.element
    }

    isDialogOpen() {
        return this.#dlg?.element.open
    }

    destroyDialog() {
        this.#dlg?.element.remove()
    }

}
