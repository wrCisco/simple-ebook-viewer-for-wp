import { textWalker, textWalkerFilters } from '../../vendor/foliate-js/text-walker.js'
import { searchMatcher, search } from '../../vendor/foliate-js/search.js'
import { bookmarksDialog } from './simebv-bookmarks-dialog.js'
import { addBookmarkDialog } from './simebv-bookmarks-add-dialog.js'
import { corruptedDataDialog } from './simebv-corrupted-data-dialog.js'
import {
    FORMATS, CURRENT_VERSION, isUnrecoverable,
    validateBookmark } from './simebv-bookmarks-validation.js'
import { CFI } from './simebv-epubcfi.js'
import { getNonEmptyRange, getPreviousCharacterRange } from './simebv-non-empty-range.js'
import { requestPersistentStorage, isNumeric } from './simebv-utils.js'
import {
    createTextWalker, getTextFraction, getPositionAtTextFraction,
    getMatchText, getTextFromRange, textSearchEquivalence } from './simebv-text-utils.js'
import { __, _x, _n, sprintf } from './simebv-i18n.js'


const ACCEPTED_VERSIONS = Object.keys(FORMATS).map(n => Number(n))

const isFromNewerVersion = b => isNumeric(b?.version) && Number(b.version) > CURRENT_VERSION
const getFirstSuitableNode = doc => doc.body.firstElementChild ?? doc.body.firstChild ?? doc.body
const textAroundExpectedLength = textLength => !textLength ? 80 : Math.max(64, 128 - textLength)
const isTextual = node => node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE
const isRejected = node => node.nodeType === Node.ELEMENT_NODE
    && textWalkerFilters.acceptNode(node) === NodeFilter.FILTER_REJECT

/**
 * Uses the same filter and acceptNode as the ones used by
 * default by foliate-js's textWalker for textual searches.
 */
const bookmarkTextWalker = function* (doc, startNode, reverse) {
    const walker = createTextWalker(doc)
    walker.currentNode = startNode
    const walk = reverse ? walker.previousNode.bind(walker) : walker.nextNode.bind(walker)
    while (walk()) {
        yield walker.currentNode
    }
}

const insertSorted = (list, bookmarks) => {
    bookmarks.sort((a, b) => CFI.compare(a.loc.cfi, b.loc.cfi))
    const edited = []
    let toAddIndex = 0
    for (const [i, b] of list.entries()) {
        const bookmark = bookmarks[toAddIndex]
        if (!bookmark) break
        if (b.loc.cfi === bookmark.loc.cfi) {
            b.version = bookmark.version
            b.content = bookmark.content
            b.inBook = { ...bookmark.inBook }
            b.loc = { ...bookmark.loc }
            edited.push(i)
            toAddIndex++
        }
        else if (CFI.compare(b.loc.cfi, bookmark.loc.cfi) > 0) {
            list.splice(i, 0, bookmark)
            toAddIndex++
        }
    }
    list.push(...bookmarks.slice(toAddIndex))
    return [list, edited]
}

const updateSorted = (list, bookmarks) => {
    const edited = []
    const editedCFIs = new Set()
    const m = new Map()
    for (const b of list) {
        m.set(b.loc.cfi, b)
    }
    for (const [storedCFI, bookmark] of bookmarks.entries()) {
        if (m.has(storedCFI)) {
            const b = m.get(storedCFI)
            b.version = bookmark.version
            b.content = bookmark.content
            b.inBook = { ...bookmark.inBook }
            b.loc = { ...bookmark.loc }
            editedCFIs.add(bookmark.loc.cfi)
        }
    }
    list.sort((a, b) => CFI.compare(a.loc.cfi, b.loc.cfi))
    for (const [i, b] of list.entries()) {
        if (editedCFIs.has(b.loc.cfi)) {
            edited.push(i)
        }
    }
    return [list, edited]
}

const mergeOverlapping = list => {
    const deleted = []
    const edited = []
    const editedCFIs = new Set()
    const m = new Map()
    for (const [i, b] of list.entries()) {
        if (!m.has(b.loc.cfi)) {
            m.set(b.loc.cfi, b)
        }
        else {
            if (b.content) {
                const bookmark = m.get(b.loc.cfi)
                bookmark.content = bookmark.content
                    ? bookmark.content + '\n\n---\n\n' + b.content
                    : b.content
                editedCFIs.add(b.loc.cfi)
            }
            deleted.push(b)
        }
    }
    list = Array.from(m.values()).sort((a, b) => CFI.compare(a.loc.cfi, b.loc.cfi))
    for (const [i, b] of list.entries()) {
        if (editedCFIs.has(b.loc.cfi)) {
            edited.push(i)
        }
    }
    return [list, edited]
}

const removeSorted = (list, bookmarks) => {
    const deleted = []
    for (let i = list.length - 1; i >= 0; i--) {
        const b = list[i]
        if (bookmarks.has(b.loc.cfi)) {
            deleted.push(list.splice(i, 1)[0])
        }
    }
    return [list, deleted]
}

// const removeUnrecoverables = list => {
//     const deleted = []
//     for (let i = list.length - 1; i >= 0; i--) {
//         if (isUnrecoverable(list[i])) {
//             deleted.push(list.splice(i, 1)[0])
//         }
//     }
//     return [list, deleted]
// }

class UnrecoverableBookmark extends Error {
    constructor(message) {
        super(message)
        this.name = 'UnrecoverableBookmark'
    }
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
    #userInteraction
    #bookmarks
    #bookmarksBin
    #dlg  // main bookmarks dialog
    #addBookmarkDlg
    #corruptedBookmarksDlg
    #rootContainer
    #showBookmarksInPage
    #bookmarkInSight
    #segmenter
    #toRestore = new Set
    #restoringBookmarks = new Map
    eventTarget = new EventTarget()

    constructor(view, bookmarksPrefsName, ebookLocales,
            bookmarksTypes, rootContainer, containerWidth,
            { savePreference, loadPreference, updatePreference, hasConsent, userInteraction }) {
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
        this.#userInteraction = userInteraction

        this.#segmenter = new Intl.Segmenter(this.#ebookLocales, { granularity: 'grapheme'})
    }

    setupEventHandlers() {
        this.eventTarget.addEventListener('save-bookmark', e => {
            const { loc, content, text } = e.detail
            const editedIndex = this.saveBookmark({ loc, content, inBook: text })
            this.#dlg?.updateAlert('')
            if (this.#dlg?.element.open) {
                if (editedIndex === undefined) {
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
            const { location } = e.detail
            if (location) {
                const returnFocus = true
                const textInBook = undefined
                this.addBookmark(location, textInBook, returnFocus)
            }
        })
        this.eventTarget.addEventListener('recover-bookmark', e => {
            const { bookmark } = e.detail
            const { loc, content, inBook } = bookmark
            this.#bookmarksBin.delete(bookmark)
            this.eventTarget.dispatchEvent(new CustomEvent('save-bookmark', {
                detail: { loc, content, text: inBook }
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
        this.#view.addEventListener('create-overlay', e => {
            const { doc, index } = e.detail
            const bookmarks = this.getBookmarks(index)
            const toRestore = []
            for (const bookmark of bookmarks) {
                try {
                    const range = this.#view.resolveCFI(bookmark.loc.cfi).anchor(doc)
                    // no text comparisons for ebooks that don't support selection bookmarks
                    if (!this.canBookmarkSelection()) continue
                    let text
                    let bText
                    if (bookmark.loc.type === 'selection') {
                        text = getMatchText(range)
                        bText = bookmark.inBook.matchText ?? bookmark.inBook.text
                    }
                    else {
                        const { startContainer, startOffset } = range
                        const { textBefore, textAfter, matchTextAfter } = this.#getTextAround(
                            textAroundExpectedLength(), doc, startContainer, startOffset, startContainer, startOffset
                        )
                        text = textBefore + (matchTextAfter ?? textAfter)
                        bText = bookmark.inBook.textBefore + (bookmark.inBook.matchTextAfter ?? bookmark.inBook.textAfter)
                    }
                    if (!(text.trim() === '' && bText.trim() === '') && !textSearchEquivalence(text, bText)) {
                        toRestore.push(bookmark)
                    }
                } catch (e) {
                    toRestore.push(bookmark)
                }
            }
            if (toRestore.length) {
                try {
                    this.restoreCFI(index, doc, toRestore)
                } catch (e) {
                    console.error(e)
                }
            }
            // fonts may take longer to load and change layout (and number) of non-fixed-layout pages
            doc.fonts.ready.then(() => {
                if (this.#view.renderer.getContents().some(c => c.doc === doc)) {
                    this.restoreLocations(index, doc)
                }
            })
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

    #updateStoredBookmarks(updater) {
        let usable
        this.#updatePreference(this.#bookmarksPrefsName, list => {
            list = Array.isArray(list) ? list : []
            const newer = list.filter(isFromNewerVersion)
            usable = updater(list.filter(b => !isFromNewerVersion(b) && !isUnrecoverable(b)))
            return usable.concat(newer)
        }, 'functional')
        return usable
    }

    saveBookmark(bookmark) {
        if (!Object.hasOwn(bookmark, 'version')) bookmark.version = CURRENT_VERSION
        let [_, editedIndex] = insertSorted(this.#bookmarks, [bookmark])
        editedIndex = editedIndex[0]
        if (editedIndex !== undefined) {
            bookmark = this.#bookmarks[editedIndex]
        }
        else if (this.showBookmarksInPage) {
            this.drawAnnotation(bookmark)
        }
        this.#bookmarks = this.#updateStoredBookmarks(list => insertSorted(list, [bookmark])[0])
        if (!this.#bookmarkInSight) {
            this.#checkInSight()
        }
        if (this.#hasConsent()) requestPersistentStorage()
        return editedIndex
    }

    loadBookmarks() {
        const bookmarks = this.#loadPreference(this.#bookmarksPrefsName, 'functional')
        const oldBookmarks = this.#bookmarks.slice()
        const unrecoverables = []
        const added = []
        let deleted = []
        if (bookmarks === undefined || bookmarks === null) {
            this.#bookmarks = []
            deleted = oldBookmarks
            return [added, deleted]
        }
        if (!Array.isArray(bookmarks)) {
            this.#showUnrecoverableBookmarks(bookmarks)
            this.#savePreference(this.#bookmarksPrefsName, [], 'functional')
            this.#bookmarks = []
            deleted = oldBookmarks
            return [added, deleted]
        }
        // validate, try to restore, and delete unrecoverable bookmarks
        const toUpdate = new Map()
        const toRemove = new Map()
        for (const bookmark of bookmarks) {
            if (isFromNewerVersion(bookmark)) continue
            const errors = validateBookmark(bookmark, true)
            if (errors.length > 0) {
                try {
                    const oldCFI = bookmark?.loc?.cfi
                    if (this.#restoreInvalidBookmark(bookmark)) {
                        toUpdate.set(oldCFI, bookmark)
                    }
                }
                catch (e) {
                    if (e instanceof UnrecoverableBookmark) {
                        // toRemove is set when the bookmark is de facto unrecoverable,
                        // but the function isUnrecoverable returns false (e.g. when
                        // the section cannot be restored adequately from the cfi)
                        if (bookmark.toRemove) {
                            toRemove.set(bookmark.loc.cfi, bookmark)
                        }
                        else {
                            unrecoverables.push(bookmark)
                        }
                    }
                    else {
                        console.error(e)
                    }
                }
            }
        }
        if (toUpdate.size || unrecoverables.length || toRemove.size) {
            if (unrecoverables.length || toRemove.size) {
                unrecoverables.push(...toRemove.values())
                this.#showUnrecoverableBookmarks(unrecoverables)
                this.#bookmarks = this.#updateStoredBookmarks(list => removeSorted(list, toRemove)[0])
            }
            if (toUpdate.size) {
                this.#bookmarks = this.#updateStoredBookmarks(list => updateSorted(list, toUpdate)[0])
            }
        }
        else {
            this.#bookmarks = bookmarks.filter(b => !isFromNewerVersion(b) && !isUnrecoverable(b))
        }
        for (const bookmark of this.#bookmarks) {
            if (!oldBookmarks.map(b => b.loc.cfi).includes(bookmark.loc.cfi)) {
                added.push(bookmark)
            }
            if (bookmark.loc.toUpdate) {
                this.#toRestore.add(bookmark.loc.cfi)
            }
        }
        for (const bookmark of oldBookmarks) {
            // unrecoverable bookmarks don't get pushed in the 'deleted' array,
            // which is used to let users recover the bookmarks later
            if (!unrecoverables.map(b => b?.loc?.cfi).includes(bookmark.loc.cfi)
                    && !this.#bookmarks.map(b => b.loc.cfi).includes(bookmark.loc.cfi)) {
                deleted.push(bookmark)
            }
        }
        return [added, deleted]
    }

    #showUnrecoverableBookmarks(invalidBookmarks) {
        let dlg = this.#corruptedBookmarksDlg
        if (!dlg) {
            dlg = corruptedDataDialog(
                __('Invalid bookmarks', 'simple-ebook-viewer'),
                __("I couldn't read some of the saved bookmarks for this ebook, " +
                    "the invalid bookmarks will be removed. If there are notes " +
                    "that you want to keep, you can download a copy of the raw data " +
                    "now before closing this dialog.", 'simple-ebook-viewer'),
                'bookmarks',
                { keep: false },
            )
            dlg.element.id = 'simebv-unrecoverable-bookmarks-dialog'
            this.#rootContainer.append(dlg.element)
            this.#corruptedBookmarksDlg = dlg
            dlg.element.addEventListener('close', e => {
                this.#userInteraction()
                this.#bookmarks = this.#updateStoredBookmarks(list => list)
            })
        }
        dlg.setData('bookmarks', JSON.stringify(invalidBookmarks, undefined, 2))
        dlg.element.style.maxInlineSize = 'min(30rem, ' + (this.#containerWidth() - 20) + 'px)'
        if (!dlg.element.open) {
            dlg.element.showModal()
        }
    }

    /**
     * Ensures a minimum level of usability for loaded bookmarks,
     * in terms of format and types. Returns true if it updates the bookmark,
     * false otherwise.
     * It does not verify the correctness of the location in the ebook.
     * If the bookmark is not recoverable, throws UnrecoverableBookmark Error.
     * If the bookmark has a version number greater than the current supported
     * version, the function doesn't change the bookmark and returns false.
     */
    #restoreInvalidBookmark(bookmark) {
        const b = bookmark
        let version = isNumeric(b?.version) ? Number(b.version) : 1

        const registerToUpdate = (bookmark, what) => {
            if (!Array.isArray(bookmark.loc.toUpdate)) {
                bookmark.loc.toUpdate = []
            }
            if (!bookmark.loc.toUpdate.includes(what)) {
                bookmark.loc.toUpdate.push(what)
            }
        }
        let updated = false
        switch (version) {
            case 1:
            default:
                if (version > CURRENT_VERSION) return false
                if (isUnrecoverable(b)) {
                    throw new UnrecoverableBookmark()
                }
                if (!b.version || typeof version !== typeof b.version || !ACCEPTED_VERSIONS.includes(version)) {
                    b.version = CURRENT_VERSION
                    version = CURRENT_VERSION
                    updated = true
                }
                if (!Object.hasOwn(b.loc, 'section') || typeof b.loc.section !== 'number') {
                    try {
                        const index = this.#view.resolveCFI(b.loc.cfi).index
                        b.loc.section = index + 1
                        if (isNaN(b.loc.section)) {
                            b.toRemove = true
                            throw new UnrecoverableBookmark()
                        }
                        updated = true
                    } catch (e) {
                        b.toRemove = true
                        throw new UnrecoverableBookmark()
                    }
                }
                const inBookProps = ['text', 'textBefore', 'textAfter', 'matchText', 'matchTextAfter']
                if (!Object.hasOwn(b, 'inBook') || inBookProps.some(s => typeof b.inBook?.[s] !== 'string')) {
                    const text = typeof b.inBook === 'string'
                        ? b.inBook
                        : (typeof b.inBook?.text === 'string' ? b.inBook.text : '')
                    const textBefore = typeof b.inBook?.textBefore === 'string' ? b.inBook.textBefore : ''
                    const textAfter = typeof b.inBook?.textAfter === 'string' ? b.inBook.textAfter : ''
                    const mt = b.inBook?.matchText
                    const matchText = mt === text || typeof mt !== 'string' ? null : mt
                    const mta = b.inBook?.matchTextAfter
                    const matchTextAfter = mta === textAfter || typeof mta !== 'string' ? null : mta
                    b.inBook = {
                        text,
                        textBefore,
                        textAfter,
                        matchText,
                        matchTextAfter,
                    }
                    updated = true
                }
                if (!Object.hasOwn(b.loc, 'type') || !['selection', 'page'].includes(b.loc.type)) {
                    b.loc.type = b.inBook.text ? 'selection' : 'page'
                    updated = true
                }
                if (!Object.hasOwn(b.loc, 'page') && this.#view?.isFixedLayout) {
                    b.loc.page = b.loc.section
                    updated = true
                }
                // check the type of optional location properties
                // (expected formats here are only strings and numbers):
                // convert to number numerical strings whose expected type is number,
                // remove the rest of the properties with wrong type
                for (const [prop, value] of Object.entries(FORMATS[version].items.loc.items)) {
                    if (!value.optional || !Object.hasOwn(b.loc, prop) || b.loc[prop] === null) continue
                    if (typeof b.loc[prop] === value.type) continue
                    if (value.type === 'number' && isNumeric(b.loc[prop]) && !Array.isArray(b.loc[prop])) {
                        b.loc[prop] = Number(b.loc[prop])
                    }
                    else {
                        delete b.loc[prop]
                        this.#toRestore.add(b.loc.cfi)
                        registerToUpdate(b, 'location')
                    }
                    updated = true
                }
                // bookFraction is not optional, but it can't be reliably provided here
                if (!Object.hasOwn(b.loc, 'bookFraction') ||
                        (Array.isArray(b.loc.bookFraction) || !isNumeric(b.loc.bookFraction))) {
                    this.#toRestore.add(b.loc.cfi)
                    registerToUpdate(b, 'location')
                    updated = true
                }
                if (typeof b.content !== 'string') {
                    b.content = ''
                    updated = true
                }
        }
        return updated
    }

    restoreCFI(index, doc, bookmarks) {
        if (!bookmarks.length) {
            return
        }
        // normalization analogous to the one applied by searchMatcher
        const normalize = text => text
            .replace(/\s+/gu, ' ')
            .replace(/[\p{P}\p{Z}\t\n\v\f\r\u0085\p{Format}]/gu, '')
        const matcher = searchMatcher(textWalker, {
            defaultLocale: this.#ebookLocales, matchCase: false, matchDiacritics: false,
            matchWholeWords: false, ignorePunctuation: true,
        })
        const oldCFIs = new Map()
        for (const bookmark of bookmarks) {
            const storedLoc = structuredClone(bookmark.loc)
            try {
                const { inBook, loc } = bookmark
                const oldCFI = loc.cfi
                let foundNewCFI = false
                if (this.canBookmarkSelection()) {
                    let matches
                    const inBookText = inBook.matchText ?? inBook.text
                    const inBookTextAfter = inBook.matchTextAfter ?? inBook.textAfter
                    let query = inBook.textBefore + inBookText + inBookTextAfter
                    if (query) {
                        // TODO: if no matches, search in other sections
                        // (and, if isFixedLayout, combine the sections to search 'em together)
                        matches = [...matcher(doc, query)].map(m => m.range)
                        let match
                        if (matches.length === 1) match = matches[0]
                        else if (matches.length > 1 && Object.hasOwn(loc, 'textSectionFraction')) {
                            const tsf = loc.textSectionFraction
                            let minDelta = 999
                            const offset = inBook.textBefore.length
                            for (const [i, m] of matches.entries()) {
                                const delta = Math.abs(tsf - getTextFraction(doc, m, offset))
                                if (delta < minDelta) {
                                    minDelta = delta
                                    match = m
                                }
                            }
                        }
                        if (match) {
                            const text = normalize(inBookText)
                            const before = normalize(inBook.textBefore)
                            const after = normalize(inBookTextAfter)
                            const locales = doc.body.lang || doc.documentElement.lang || this.#ebookLocales || 'en'
                            const prevOccurrences = t => {
                                return [...search(
                                    [inBook.textBefore, inBookText, inBookTextAfter], t,
                                    { locales, granularity: 'grapheme', sensitivity: 'base', ignorePunctuation: true }
                                )].filter(({range}) => range.startIndex === 0).length
                            }
                            if (text) {
                                const qty = prevOccurrences(inBookText)
                                const ranges = [...matcher(doc, inBookText)].map(m => m.range)
                                for (const [i, range] of ranges.entries()) {
                                    if (match.comparePoint(range.startContainer, range.startOffset) === 0) {
                                        if (i + qty >= ranges.length) break
                                        const r = ranges[i + qty]
                                        const cfi = this.#view.getCFI(index, r)
                                        loc.cfi = cfi
                                        foundNewCFI = true
                                        break
                                    }
                                }
                            }
                            else if (before.length > after.length) {
                                const ranges = [...matcher(doc, inBook.textBefore)].map(m => m.range)
                                for (const range of ranges) {
                                    if (match.comparePoint(range.startContainer, range.startOffset) === 0) {
                                        const nonEmpty = getNonEmptyRange(range.endContainer, range.endOffset)
                                        const cfi = this.#view.getCFI(index, nonEmpty)
                                        loc.cfi = cfi
                                        foundNewCFI = true
                                        break
                                    }
                                }
                            }
                            else {
                                const qty = prevOccurrences(inBookTextAfter)
                                const ranges = [...matcher(doc, inBookTextAfter)].map(m => m.range)
                                for (const [i, range] of ranges.entries()) {
                                    if (match.comparePoint(range.startContainer, range.startOffset) === 0) {
                                        if (i + qty >= ranges.length) break
                                        const r = ranges[i + qty]
                                        const nonEmpty = getNonEmptyRange(r.startContainer, r.startOffset)
                                        const cfi = this.#view.getCFI(index, nonEmpty)
                                        loc.cfi = cfi
                                        foundNewCFI = true
                                        break
                                    }
                                }
                            }
                        }
                    }
                }
                if (foundNewCFI) {
                    // update also text to defend against browsers's quirks
                    // in handling ranges and selections textual content
                    loc.toUpdate = ['location', 'text']
                }
                else {
                    let bookmarkRange
                    const fallback = getFirstSuitableNode(doc)
                    if (!this.canBookmarkSelection()) {
                        bookmarkRange = doc.createRange()
                        bookmarkRange.selectNode(fallback)
                    }
                    else {
                        const fraction = loc.textSectionFraction ?? loc.sectionFraction
                        const pos = getPositionAtTextFraction(doc, fraction)
                        if (!pos) {
                            bookmarkRange = doc.createRange()
                            bookmarkRange.selectNode(fallback)
                        }
                        else {
                            const { node, offset } = pos
                            bookmarkRange = getNonEmptyRange(node, offset)
                        }
                    }
                    const cfi = this.#view.getCFI(index, bookmarkRange)
                    loc.cfi = cfi
                    loc.type = 'page'
                    loc.toUpdate = this.canBookmarkSelection() ? ['location', 'text'] : ['location']
                }
                // try to avoid perfectly overlapping bookmarks
                let sameCFIs = this.#bookmarks.filter(b => b.loc.cfi === loc.cfi)
                if (sameCFIs.length > 1) {
                    const overlappingCFI = loc.cfi
                    let foundNewLocation = false
                    mainloop: for (let i = 0; i < 2; i++) {
                        let reverse = i !== 0
                        loc.cfi = overlappingCFI
                        for (let j = 0; j < 50; j++) {
                            let range
                            try {
                                range = this.#view.resolveCFI(loc.cfi).anchor(doc)
                            } catch (e) {
                                break
                            }
                            const nonEmpty = reverse
                                ? getPreviousCharacterRange(range.startContainer, range.startOffset)
                                : getNonEmptyRange(range.endContainer, range.endOffset)
                            if (!nonEmpty || nonEmpty.collapsed) break
                            const cfi = this.#view.getCFI(index, nonEmpty)
                            if (cfi === loc.cfi) break
                            loc.cfi = cfi
                            sameCFIs = this.#bookmarks.filter(b => b.loc.cfi === loc.cfi)
                            if (sameCFIs.length === 1) {
                                foundNewLocation = true
                                loc.type = 'page'
                                if (this.canBookmarkSelection() && !loc.toUpdate.includes('text')) {
                                    loc.toUpdate.push('text')
                                }
                                break mainloop
                            }
                        }
                    }
                    if (!foundNewLocation) loc.cfi = overlappingCFI
                }
                this.#toRestore.add(loc.cfi)
                oldCFIs.set(oldCFI, bookmark)
            }
            catch (e) {
                console.error(e)
                bookmark.loc = storedLoc
            }
        }
        this.#bookmarks = this.#updateStoredBookmarks(list => updateSorted(list, oldCFIs)[0])
        if (new Set(this.#bookmarks.map(b => b.loc.cfi)).size < this.#bookmarks.length) {
            this.#bookmarks = this.#updateStoredBookmarks(list => mergeOverlapping(list)[0])
        }

        if (this.isDialogOpen()) {
            this.updateBookmarks()
        }
    }

    #toBookFraction(index, fraction, size = 0) {
        const f = this.#view.getSectionFractions()
        return f[index] + (fraction + size) * (f[index + 1] - f[index])
    }

    restoreLocations(index, doc) {
        if (!doc) return
        const toUpdate = new Map()
        const bookmarks = this.getBookmarks(index)
        for (const cfi of this.#toRestore) {
            try {
                let updated = false
                const bookmark = bookmarks.find(b => b.loc.cfi === cfi)
                if (!bookmark) continue
                const range = this.#view.resolveCFI(bookmark.loc.cfi)?.anchor(doc)
                if (bookmark.loc.toUpdate?.includes('location')) {
                    let fraction
                    let size
                    if (this.#view.isFixedLayout) {
                        fraction = 0
                        size = 0
                    }
                    else {
                        const f = this.#view.renderer.getFractionFromRange(range)
                        if (!f) continue
                        ;({ fraction, size } = f)
                    }
                    const { tocItem, pageItem, progress } = this.#view.getProgressOf(index, range, fraction, size)
                    bookmark.loc.sectionFraction = Math.min(1, fraction + size)
                    bookmark.loc.bookFraction = this.#toBookFraction(index, fraction, size)
                    bookmark.loc.tocLabel = tocItem?.label
                    bookmark.loc.pageLabel = pageItem?.label
                    bookmark.loc.page = this.#view.isFixedLayout ? index + 1 : progress.location.current + 1
                    bookmark.loc.textSectionFraction = getTextFraction(doc, range)
                    updated = true
                }

                if (bookmark.loc.toUpdate?.includes('text')) {
                    const { text, matchText } = bookmark.loc.type === 'selection'
                        ? getTextFromRange(range)
                        : { text: '', matchText: null }
                    let textBefore = ''
                    let textAfter = ''
                    let matchTextAfter = null
                    const rangeLength = [...this.#segmenter.segment(text)].length
                    if (bookmark.loc.type === 'selection') {
                        if (rangeLength < 160) {
                            const requiredLength = textAroundExpectedLength(rangeLength)
                            const { startContainer, startOffset, endContainer, endOffset } = range
                            ;({ textBefore, textAfter, matchTextAfter } = this.#getTextAround(
                                requiredLength, doc, startContainer, startOffset, endContainer, endOffset
                            ))
                        }
                    }
                    else {
                        const requiredLength = textAroundExpectedLength()
                        const { startContainer, startOffset } = range
                        ;({ textBefore, textAfter, matchTextAfter } = this.#getTextAround(
                            requiredLength, doc, startContainer, startOffset, startContainer, startOffset
                        ))
                    }
                    bookmark.inBook.text = text
                    bookmark.inBook.textBefore = textBefore
                    bookmark.inBook.textAfter = textAfter
                    bookmark.inBook.matchText = matchText
                    bookmark.inBook.matchTextAfter = matchTextAfter
                    updated = true
                }

                delete bookmark.loc.toUpdate
                this.#toRestore.delete(cfi)
                if (updated) toUpdate.set(bookmark.loc.cfi, bookmark)
            }
            catch (e) {
                console.error(e)
            }
        }
        if (toUpdate.size) {
            this.#bookmarks = this.#updateStoredBookmarks(list => updateSorted(list, toUpdate)[0])
            if (this.isDialogOpen()) {
                this.updateBookmarks()
            }
        }
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

    #getTextAround(length, doc, startNode, startOffset, endNode, endOffset) {
        const arrText = []
        let textLength = 0
        let walker
        if (startNode.nodeType === Node.ELEMENT_NODE && startOffset > 0) {
            const c = startNode.childNodes
            if (c.length) startNode = c[Math.min(startOffset, c.length - 1)]
            if (startOffset === c.length) {
                if (startNode.nodeType === Node.ELEMENT_NODE) {
                    while (startNode.textContent && startNode.nodeType === Node.ELEMENT_NODE
                            && !isRejected(startNode)) {
                        startNode = startNode.lastChild
                    }
                }
                if (isTextual(startNode)) {
                    startOffset = startNode.nodeValue.length
                }
            }
            else {
                startOffset = 0
            }
        }
        if (isTextual(startNode) && startOffset !== 0) {
            arrText.push(startNode.nodeValue.slice(0, startOffset).replace(/\s+/ug, ' '))
            textLength += [...this.#segmenter.segment(arrText.at(-1))].length
        }
        walker = bookmarkTextWalker(doc, startNode, true)
        for (const node of walker) {
            if (textLength >= length) break
            arrText.push(node.nodeValue.replace(/\s+/ug, ' '))
            textLength += [...this.#segmenter.segment(arrText.at(-1))].length
        }
        let textBefore = arrText.toReversed().join('').replace(/\s+/ug, ' ')
        textBefore = this.#truncateString(textBefore, length, { fromEnd: true })
        const rangeAfter = doc.createRange()
        rangeAfter.setStart(endNode, endOffset)
        arrText.length = 0
        textLength = 0
        let skipFirstContainer = false
        if (endNode.nodeType === Node.ELEMENT_NODE && endOffset > 0) {
            const c = endNode.childNodes
            if (c.length) endNode = c[Math.min(endOffset, c.length - 1)]
            if (endOffset === c.length) skipFirstContainer = true
            endOffset = 0
        }
        if (!skipFirstContainer && isTextual(endNode) && endOffset < endNode.length) {
            arrText.push(endNode.nodeValue.slice(endOffset).replace(/\s+/ug, ' '))
            textLength += [...this.#segmenter.segment(arrText.at(-1))].length
            rangeAfter.setStart(endNode, endOffset)
            rangeAfter.setEnd(endNode, endNode.length)
        }
        walker = bookmarkTextWalker(doc, endNode)
        let node = walker.next().value
        if (skipFirstContainer || isRejected(endNode)) {
            while (node && endNode.contains(node)) node = walker.next().value
        }
        while (node && textLength < length) {
            if (!arrText.length) rangeAfter.setStart(node, 0)
            arrText.push(node.nodeValue.replace(/\s+/ug, ' '))
            textLength += [...this.#segmenter.segment(arrText.at(-1))].length
            rangeAfter.setEnd(node, node.nodeValue.length)
            node = walker.next().value
        }
        const t = getTextFromRange(rangeAfter)
        const textAfter = this.#truncateString(t.text.replace(/\s+/ug, ' '), length)
        const matchTextAfter = t.matchText
            ? this.#truncateString(t.matchText.replace(/\s+/ug, ' '), length) : null
        return { textBefore, textAfter, matchTextAfter }
    }

    getLocationData() {
        if (!this.#view.lastLocation) return []
        const page = this.#view.lastLocation.location.current
        const section = this.#view.lastLocation.section.current
        const fraction = this.#view.lastLocation.fraction
        let fractionInSection = 0
        if (!this.#view.isFixedLayout) {
            const resolved = this.#view.resolveNavigation({ fraction })
            fractionInSection = resolved.anchor
            // a section's last page can return the index of the next section and a fraction near zero
            if (resolved.index !== section) fractionInSection = 1
        }
        if (this.#bookmarksTypes.includes('selection')) {
            for (const { doc, index } of this.#view.renderer.getContents()) {
                const sel = doc?.getSelection()
                if (!sel || sel.isCollapsed) continue
                const range = sel.getRangeAt(0)
                const { tocItem, pageItem } = this.#view.getProgressOf(index, range)
                const cfi = this.#view.getCFI(index, range)
                const { text, matchText } = getTextFromRange(range)
                let textBefore = ''
                let textAfter = ''
                let matchTextAfter = null
                const selectionLength = [...this.#segmenter.segment(text)].length
                if (selectionLength < 160) {
                    const requiredLength = textAroundExpectedLength(selectionLength)
                    ;({ textBefore, textAfter, matchTextAfter } = this.#getTextAround(
                        requiredLength, doc, range.startContainer, range.startOffset,
                        range.endContainer, range.endOffset
                    ))
                }
                return [
                    {
                        cfi,
                        section: index + 1,
                        sectionFraction: fractionInSection,
                        bookFraction: fraction,
                        textSectionFraction: getTextFraction(doc, range),
                        tocLabel: tocItem?.label,
                        pageLabel: pageItem?.label,
                        page: this.#view.isFixedLayout ? index + 1 : page + 1,
                        type: 'selection',
                    },
                    {
                        text,
                        textBefore,
                        textAfter,
                        matchText,
                        matchTextAfter,
                    }
                ]
            }
        }
        const range = this.#view.lastLocation.range  // null for fixed-layout ebooks
        const { tocItem, pageItem } = this.#view.getProgressOf(section, range)
        const { doc } = this.#view.getCurrentContents()
        let bookmarkRange
        let startNode
        let startOffset = 0
        if (!this.canBookmarkSelection()) {
            // as of now, PDF and CBZ: reevaluate in case of changes
            bookmarkRange = doc.createRange()
            bookmarkRange.selectNode(getFirstSuitableNode(doc))
        }
        else {
            if (this.#view.isFixedLayout) {
                startNode = getFirstSuitableNode(doc)
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
        let textBefore = ''
        let textAfter = ''
        let matchTextAfter = null
        let textFraction = 0
        if (this.canBookmarkSelection()) {
            const requiredLength = textAroundExpectedLength()
            const { startContainer, startOffset } = bookmarkRange
            ;({ textBefore, textAfter, matchTextAfter } = this.#getTextAround(
                requiredLength, doc, startContainer, startOffset, startContainer, startOffset
            ))
            textFraction = getTextFraction(doc, bookmarkRange)
        }
        return [
            {
                cfi,
                section: section + 1,
                sectionFraction: fractionInSection,
                bookFraction: fraction,
                textSectionFraction: textFraction,
                tocLabel: tocItem?.label,
                pageLabel: pageItem?.label,
                page: this.#view.isFixedLayout ? section + 1 : page + 1,
                type: 'page',
            },
            { text: '', matchText: null, textBefore, textAfter, matchTextAfter },
        ]
    }

    #truncateString(str, qty, { ellipsis = false, fromEnd = false } = {}) {
        if (!str || qty <= 0) return ''
        let segments = this.#segmenter.segment(str)
        if (fromEnd) segments = [...segments].reverse()
        let text = []
        let i = 0
        for (const { segment } of segments) {
            if (++i > qty) {
                if (ellipsis) text.push('…')
                break
            }
            text.push(segment)
        }
        return fromEnd ? text.reverse().join('') : text.join('')
    }

    #makeInBookDisplayText(text) {
        return this.#truncateString(text?.trim(), 30, { ellipsis: true })
    }

    #makeTocLabelDisplay(label) {
        return this.#truncateString(label?.trim(), 48, { ellipsis: true })
    }

    getBookmarkLabel(location, min = 0) {
        let { tocLabel, section, pageLabel, page } = location
        if (typeof page === 'number' && min) {
            page = Math.max(page, min)
        }
        const p = pageLabel ?? page
        const tocLabelDisplay = this.#makeTocLabelDisplay(tocLabel)
        if (tocLabelDisplay) {
            if (p) {
                return sprintf(
                    /* translators: %1$s: chapter title, %2$s: page number */
                    __('%1$s - Page %2$s', 'simple-ebook-viewer'), tocLabelDisplay, p
                )
            }
            else return tocLabelDisplay
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
            textInBook = { ...b.inBook, ...(textInBook ?? {}) }
            dlgHeader = __('Edit bookmark', 'simple-ebook-viewer')
        }
        else {
            if (!textInBook) {
                textInBook = { text: '', textBefore: '', textAfter: '', matchText: null, matchTextAfter: null, }
            }
        }
        this.#addBookmarkDlg.setData(
            { label, data: location }, content, { data: textInBook }, returnFocus, dlgHeader
        )
        this.#addBookmarkDlg.element.style.maxInlineSize = 'min(30rem, ' + (this.#containerWidth() - 20) + 'px)'
        this.#addBookmarkDlg.element.showModal()
    }

    removeBookmark(location) {
        let [_, deleted] = removeSorted(this.#bookmarks, new Set([location.cfi]))
        deleted = deleted[0]
        if (deleted) {
            if (deleted.loc.cfi === this.#bookmarkInSight?.loc.cfi) {
                this.#checkInSight()
            }
            this.#view.deleteAnnotation({ value: deleted.loc.cfi })
            this.#bookmarks = this.#updateStoredBookmarks(list => removeSorted(list, new Set([deleted.loc.cfi]))[0])
            this.eventTarget.dispatchEvent(
                new CustomEvent('removed-bookmarks', { detail: { locations: [location.cfi] }})
            )
        }
        return deleted
    }

    updateBookmark(loc) {
        if (!this.#dlg?.element) return
        this.#dlg.updateBookmark(this.#bookmarks.find(b => b.loc.cfi === loc.cfi))
    }

    updateBookmarks({ updateOverlay, added = [], deleted = [] } = {}) {
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
            fixedLayout, this.getBookmarkLabel.bind(this), this.#makeInBookDisplayText.bind(this),
            async (target, fallback) => {
                const resolved = await this.#view.goTo(target)
                if (!resolved) await this.#view.goTo(fallback)
            }
        )
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
            this.drawAnnotation(bookmark)
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
            this.drawAnnotation(bookmark)
        }
    }
    boundCreateOverlay = this.createOverlay.bind(this)

    drawAnnotation(bookmark) {
        this.#view.addAnnotation(this.getAnnotation(bookmark))
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
