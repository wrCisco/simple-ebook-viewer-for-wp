import { scrollMenuEntryIntoView } from './simebv-utils.js'
import { CFI } from './simebv-epubcfi.js'
import { __, _x, _n, sprintf } from './simebv-i18n.js'


export function bookmarksDialog(target, showBookmarks, hasSelection, showHint) {
    const dlg = document.createElement('dialog')
    dlg.setAttribute('aria-label', __('Bookmarks', 'simple-ebook-viewer'))
    dlg.id = 'simebv-bookmarks-dialog'

    const addBookmarkContainer = document.createElement('div')
    const addBookmarkButtonContainer = document.createElement('p')
    addBookmarkButtonContainer.classList.add('simebv-bookmarks-add-textual')
    const addBookmark = document.createElement('button')
    addBookmark.addEventListener('click', () => {
        target.dispatchEvent(new CustomEvent('add-bookmark-action'))
    })
    addBookmark.setAttribute('aria-haspopup', 'dialog')
    const addBookmarkText = document.createElement('span')
    const addBookmarkShortcut = document.createElement('span')
    addBookmarkShortcut.classList.add('simebv-bookmarks-shortcut')
    addBookmarkShortcut.textContent = __('Ctrl+B', 'simple-ebook-viewer')
    addBookmark.setAttribute('aria-keyshortcuts', 'Control+B')
    addBookmark.append(addBookmarkText, addBookmarkShortcut)
    const addBookmarkHint = document.createElement('p')
    addBookmarkHint.classList.add('simebv-bookmarks-hint')
    addBookmarkHint.id = 'simebv-bookmarks-hint'
    addBookmarkHint.textContent = __('To bookmark a passage, select some text', 'simple-ebook-viewer')
    addBookmarkButtonContainer.append(addBookmark)
    addBookmarkContainer.append(addBookmarkButtonContainer, addBookmarkHint)

    const updateSelectionStatus = (selection, hint) => {
        addBookmarkText.textContent = selection
            ? __('Bookmark selection', 'simple-ebook-viewer')
            : __('Bookmark this page', 'simple-ebook-viewer')
        if (hint) {
            addBookmarkHint.classList.add('show')
            addBookmark.setAttribute('aria-describedby', 'simebv-bookmarks-hint')
        }
        else {
            addBookmarkHint.classList.remove('show')
            addBookmark.removeAttribute('aria-describedby')
        }
    }
    updateSelectionStatus(hasSelection, showHint)

    const showBookmarksContainer = document.createElement('p')
    showBookmarksContainer.classList.add('simebv-bookmarks-show-container')
    const showBookmarksCheckbox = document.createElement('input')
    showBookmarksCheckbox.type = 'checkbox'
    showBookmarksCheckbox.id = 'simebv-show-bookmarks'
    showBookmarksCheckbox.checked = !!showBookmarks
    const showBookmarksLabel = document.createElement('label')
    showBookmarksLabel.textContent = __('Show bookmarks in page', 'simple-ebook-viewer')
    showBookmarksLabel.htmlFor = showBookmarksCheckbox.id
    showBookmarksContainer.append(showBookmarksCheckbox, showBookmarksLabel)

    showBookmarksCheckbox.addEventListener('change', () => {
        target.dispatchEvent(new CustomEvent('show-user-bookmarks', { detail: { show: showBookmarksCheckbox.checked }}))
    })

    const alert = document.createElement('p')
    alert.classList.add('simebv-bookmarks-alert', 'hide')
    alert.setAttribute('aria-live', 'polite')
    const updateAlert = msg => {
        if (msg) {
            alert.textContent = msg
            alert.classList.remove('hide')
            if (dlg.open) scrollMenuEntryIntoView(alert, dlg)
        }
        else {
            alert.textContent = ''
            alert.classList.add('hide')
        }
    }

    const isShowingAlert = () => {
        return !alert.classList.contains('hide') && alert.textContent !== ''
    }

    dlg.append(addBookmarkContainer, showBookmarksContainer, alert)

    const list = document.createElement('ol')
    list.classList.add('simebv-bookmarks-list')
    list.setAttribute('role', 'list')

    const noBookmarks = document.createElement('p')
    noBookmarks.textContent = __('No bookmarks yet', 'simple-ebook-viewer')
    noBookmarks.classList.add('simebv-no-bookmarks')
    
    dlg.append(list, noBookmarks)

    let bookmarks_ = []
    const updateBookmarks = (bookmarks, bookmarksBin, isFixedLayout, makeLabel, onclick) => {
        list.replaceChildren()
        bookmarks_ = bookmarks.concat(Array.from(bookmarksBin)).sort((a, b) => CFI.compare(a.loc.cfi, b.loc.cfi))
        let minPage = 0
        for (const [i, bookmark] of bookmarks_.entries()) {
            const { loc, content, inBook } = bookmark
            const isDeleted = bookmarksBin.has(bookmark)
            const { cfi, tocLabel, section, page, type } = loc
            const item = document.createElement('li')
            if (cfi) item.dataset.cfi = cfi
            const ref = document.createElement('p')
            ref.classList.add('simebv-bookmarks-location')
            if (isDeleted) {
                if (i > 0 && loc.cfi === bookmarks_[i - 1].loc.cfi) {
                    // in case the bookmark has been restored outside of the current tab 
                    continue
                }
                const labelText = makeLabel(loc, minPage)
                const label = document.createElement('span')
                label.classList.add('simebv-bookmarks-label')
                label.textContent = __('Deleted', 'simple-ebook-viewer')
                label.title = sprintf(
                    /* translators: %1$s: label of the recoverable bookmark */
                    __("Deleted bookmark '%1$s'", 'simple-ebook-viewer'), labelText
                )
                label.setAttribute('aria-label', label.title)
                label.id = 'simebv-user-bookmark-' + (i + 1) + '-deleted'
                const bookmarkButtons = document.createElement('span')
                bookmarkButtons.classList.add('simebv-bookmark-edit-buttons')
                const recoverIcon = document.createElement('button')
                const recoverIconLabel = __('Recover bookmark', 'simple-ebook-viewer')
                recoverIcon.setAttribute('aria-describedby', label.id)
                recoverIcon.setAttribute('aria-label', recoverIconLabel)
                recoverIcon.title = recoverIconLabel
                recoverIcon.innerHTML = `
                <svg class="simebv-icon" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <path d="M15 9A6 6 -45 1 1 9 3" stroke-linecap="round"/>
                    <path d="M5.5 2l3.5 1l-1.5 3z" stroke-linejoin="miter"/>
                </svg>`
                recoverIcon.addEventListener('click', () => {
                    target.dispatchEvent(new CustomEvent('recover-bookmark', {
                        detail: { bookmark }
                    }))
                })
                bookmarkButtons.append(recoverIcon)
                ref.append(label, bookmarkButtons)
            }
            else {
                const label = document.createElement('a')
                label.href = '#'
                label.classList.add('simebv-bookmarks-label')
                label.textContent = makeLabel(loc, minPage)
                if (typeof page === 'number') minPage = Math.max(page, minPage)
                label.onclick = event => {
                    event.preventDefault()
                    onclick(cfi ?? section - 1)
                }
                label.id = 'simebv-user-bookmark-' + (i + 1)
                label.dataset.section = section
                const bookmarkButtons = document.createElement('span')
                bookmarkButtons.classList.add('simebv-bookmark-edit-buttons')
                const editIcon = document.createElement('button')
                const editIconLabel = __('Edit bookmark', 'simple-ebook-viewer')
                editIcon.setAttribute('aria-label', editIconLabel)
                editIcon.setAttribute('aria-haspopup', 'dialog')
                editIcon.setAttribute('aria-describedby', label.id)
                editIcon.title = editIconLabel
                editIcon.innerHTML = `
                <svg class="simebv-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18 4l2 2l-10 10l-4 2l2 -4z"/>
                    <path d="M5 20h14" stroke-dasharray="4,2,3,2,3" />
                </svg>`
                editIcon.addEventListener('click', () => {
                    target.dispatchEvent(new CustomEvent('edit-bookmark', {
                        detail: { location: loc }
                    }))
                })
                const deleteIcon = document.createElement('button')
                const deleteIconLabel = __('Delete bookmark', 'simple-ebook-viewer')
                deleteIcon.setAttribute('aria-label', deleteIconLabel)
                deleteIcon.setAttribute('aria-describedby', label.id)
                deleteIcon.title = deleteIconLabel
                deleteIcon.innerHTML = `
                <svg class="simebv-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 4l8 8l-8 8l8 -8l8 8l-8 -8l8 -8" />
                </svg>`
                deleteIcon.addEventListener('click', () => {
                    target.dispatchEvent(new CustomEvent('remove-bookmark', {
                        detail: { location: loc, textInBook: inBook }
                    }))
                })
                bookmarkButtons.append(editIcon, deleteIcon)
                ref.append(label, bookmarkButtons)
            }
            item.append(ref)
            const textInBook = document.createElement('p')
            textInBook.classList.add('simebv-bookmarks-textinbook')
            if (inBook) {
                textInBook.textContent = sprintf(
                    /* translators: %1$s: first words of the ebook's text associated with a bookmark */
                    __('In book: "%1$s"', 'simple-ebook-viewer'), inBook
                )
            }
            else if (type === 'page') {
                textInBook.textContent = __('Page bookmark', 'simple-ebook-viewer')
            }
            const note = document.createElement('p')
            note.classList.add('simebv-bookmarks-content')
            note.textContent = content ?? ''
            item.append(textInBook, note)
            list.append(item)
        }
        if (bookmarks_.length > 0) {
            noBookmarks.classList.add('hide') 
        }
        else {
            noBookmarks.classList.remove('hide')
        }
    }

    const getItem = cfi => {
        for (const item of list.children) {
            if (cfi === item.dataset.cfi) {
                return item
            }
        }
    }

    const updateBookmark = bookmark => {
        const { loc } = bookmark
        const item = getItem(loc.cfi)
        if (!item) return
        const content = item.getElementsByClassName('simebv-bookmarks-content')[0]
        content.textContent = bookmark.content
    }

    let shownBookmark
    const showBookmark = bookmark => {
        const { loc } = bookmark
        const item = getItem(loc.cfi)
        if (!item) return
        scrollMenuEntryIntoView(item, dlg)
        const a = item.getElementsByTagName('a')[0]
        a?.focus()
        shownBookmark = bookmark
    }

    const focusTo = loc => {
        const item = typeof loc === 'number'
            ? list.children[loc]
            : typeof loc?.cfi === 'string' ? getItem(loc.cfi) : loc
        if (!item) return
        let el = item.getElementsByClassName('simebv-bookmarks-label')[0]
        if (el.id.includes('deleted')) {
            el = item.getElementsByClassName('simebv-bookmark-edit-buttons')[0].firstElementChild
        }
        if (!el) el = addBookmark
        el.focus()
    }

    let returnFocus
    const show = returnFocusTo => {
        dlg.show()
        target.dispatchEvent(new CustomEvent('open-bookmarks-dlg'))
        returnFocus = returnFocusTo
    }

    const close = () => {
        dlg.close()
        target.dispatchEvent(new CustomEvent('close-bookmarks-dlg'))
        if (returnFocus) {
            returnFocus.focus()
            returnFocus = undefined
        }
        shownBookmark = undefined
    }

    dlg.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'Escape':
                close()
                e.stopPropagation()
                e.preventDefault()
                break
        }
    })

    dlg.addEventListener('focus-from-show-annotation-dlg', () => {
        if (shownBookmark) showBookmark(shownBookmark)
    })

    return {
        element: dlg,
        close, show,
        updateBookmarks, updateBookmark,
        showBookmark, focusTo,
        updateSelectionStatus,
        updateAlert,
        isShowingAlert,
    }
}
