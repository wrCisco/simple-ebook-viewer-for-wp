import { CFI } from './simebv-epubcfi.js'
import { searchDialog } from './simebv-search-dialog.js'
import { getColorScheme } from './simebv-utils.js'
import { searchResultsHighlight } from './simebv-overlayer-shapes.js'

export class TextSearch {
    #currentSearch
    #query
    #opts = {
        matchCase: false,
        matchWholeWords: false,
    }
    #results = []
    #index = -1
    #currentLocation
    #view
    #container
    #dlg
    target

    constructor(view, container) {
        this.#view = view
        this.#container = container
        this.target = new EventTarget()
    }

    openDialog(returnFocusTo) {
        if (!this.#dlg) {
            this.#dlg = searchDialog(
                this.boundDoSearch,
                this.boundPrevMatch,
                this.boundNextMatch,
                this.boundSearchCleanUp,
                returnFocusTo,
            )
            this.#dlg.id = 'simebv-search-dialog'
            this.#container.append(this.#dlg)
        }
        this.#dlg.show()
        this.#dlg.classList.add('simebv-show')
    }

    async doSearch(str, opts) {
        const { reverse, matchCase, matchWholeWords } = opts
        if (this.#currentSearch && this.#isSameSearch(str, {matchCase, matchWholeWords})) {
            reverse ? await this.prevMatch() : await this.nextMatch()
            return
        }
        this.searchCleanUp()
        this.#query = str
        this.#opts.matchCase = matchCase
        this.#opts.matchWholeWords = matchWholeWords
        this.#currentSearch = this.#newSearch(str, { matchCase, matchWholeWords })
        this.#currentLocation = this.#view.lastLocation
        await this.#matchUntilCurrentLocation()
        if (this.#results.length > 0 && this.#index === this.#results.length - 2) {
            await this.#goToNextMatch({ useOldCFI: false })
        }
        else {
            await this.nextMatch()
        }
    }
    boundDoSearch = this.doSearch.bind(this)

    #isSameSearch(str, opts) {
        return this.#query === str && Object.entries(opts).every(opt => opt[1] === this.#opts[opt[0]])
    }

    #newSearch(query, opts) {
        const isFxl = this.#view.isFixedLayout
        const isDark = getColorScheme(this.#container) === 'dark'
        const color = isFxl ? 'transparent' : 'light-dark(#706766, #DDF4FF)'
        return this.#view.search({
            query,
            draw: searchResultsHighlight,
            drawOptions: {
                color,
                opacity: isFxl ? 1 : isDark ? .4 : .3,
                mixBlendMode: isFxl ? 'normal' : isDark ? 'screen' : 'darken',
                invert: isFxl
            },
            ...opts,
        })
    }

    async #matchUntilCurrentLocation() {
        while (true) {
            if (!this.#currentSearch) {
                // this can happen if the user closes the search panel during the search
                return
            }
            const result = await this.#currentSearch.next()
            if (result.value === 'done' || result.done === true) {
                break
            }
            if (result.value?.subitems) {
                this.#results.push(...result.value.subitems)
                let resultCfi = this.#results[this.#results.length - 1].cfi
                if (CFI.compare(this.#currentLocation.cfi, resultCfi) > 0) {  // 1: resultCfi precedes this.viewer.view.lastLocation.cfi
                    this.#index = this.#results.length - 1
                    continue
                }
                while (this.#index < this.#results.length - 1) {
                    this.#index++
                    resultCfi = this.#results[this.#index].cfi
                    if (CFI.compare(this.#currentLocation.cfi, resultCfi) <= 0) {
                        this.#index--
                        return
                    }
                }
            }
        }
        this.#index = this.#results.length - 2
    }

    async #goToNextMatch({ previous = false, useOldCFI = true } = {}) {
        const oldCFI = useOldCFI
            ? this.#results[this.#index]?.cfi
            : null
        this.#index += previous ? -1 : 1
        const newCFI = this.#results[this.#index].cfi
        if (oldCFI && useOldCFI) {
            this.#view.deleteAnnotation({ value: oldCFI })
        }
        if (this.#view.isFixedLayout) {
            const oldIndex = oldCFI
                ? this.#view.resolveCFI(oldCFI).index
                : undefined
            const newIndex = this.#view.resolveCFI(newCFI).index
            if (oldIndex !== newIndex) {
                await this.#view.goTo(newCFI)
            }
        }
        else {
            await this.#view.goTo(newCFI)
        }
        await this.#view.addAnnotation({ value: newCFI, type: 'current-search' })
    }

    async nextMatch() {
        if (!this.#currentSearch) {
            return
        }
        if (this.#results.length > 0 && this.#index < this.#results.length - 1) {
            await this.#goToNextMatch()
            return
        }
        let result = await this.#currentSearch.next()
        if (result.value === 'done' || result.done === true) {
            return
        }
        if (result.value?.subitems) {
            this.#results.push(...result.value.subitems)
            await this.#goToNextMatch()
            return
        }
        else {
            await this.nextMatch()
        }
    }
    boundNextMatch = this.nextMatch.bind(this)

    async prevMatch() {
        if (!this.#currentSearch) {
            return
        }
        if (this.#results.length > 0 && this.#index > 0) {
            await this.#goToNextMatch({ previous: true })
            return
        }
    }
    boundPrevMatch = this.prevMatch.bind(this)

    async searchCleanUp() {
        const lastCFI = this.#results[this.#index]?.cfi
        if (lastCFI) {
            this.#view.deleteAnnotation({ value: lastCFI })
        }
        this.#currentSearch = undefined
        this.#results = []
        this.#index = -1
        this.#view.clearSearch()
        this.#view.deselect()
        this.target.dispatchEvent(new CustomEvent('simebv-search-cleanup'))
    }
    boundSearchCleanUp = this.searchCleanUp.bind(this)
}
