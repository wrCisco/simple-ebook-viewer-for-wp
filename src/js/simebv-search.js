import { CFI } from './simebv-epubcfi.js'
import { searchDialog } from './simebv-search-dialog.js'
import { getColorScheme } from './simebv-utils.js'
import { searchResultsHighlight } from './simebv-overlayer-shapes.js'

export class TextSearch {
    #currentSearch
    #query = ''
    #opts = {
        matchCase: false,
        matchWholeWords: false,
    }
    #count = 0
    #results = []
    #sectionsIndex
    #matchesIndex = -1
    #totSections
    #currentMatch
    #runId = 0
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
        this.#sectionsIndex = this.#view.lastLocation.section.current
        this.#totSections = this.#view.lastLocation.section.total
        await this.#matchUntilCurrentLocation()
        if (this.#count > 0) {
            await this.#goToMatch()
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

    async #searchInSection(runId) {
        if (runId !== this.#runId) { return [] }
        this.#results[this.#sectionsIndex] = []
        const { matchCase, matchWholeWords } = this.#opts
        const search = this.#newSearch(
            this.#query, { matchCase, matchWholeWords, index: this.#sectionsIndex }
        )
        if (runId !== this.#runId) {
            search.return?.()
            return []
        }
        let result = await search.next()
        while (result.value !== 'done' && result.done !== true) {
            if (runId !== this.#runId) {
                search.return?.()
                return []
            }
            this.#results[this.#sectionsIndex].push(result.value)
            result = await search.next()
        }
        this.#count += this.#results[this.#sectionsIndex].length
        this.#currentSearch = search
        return this.#results[this.#sectionsIndex]
    }

    async #matchUntilCurrentLocation() {
        const currentLoc = this.#view.lastLocation
        const currentSection = currentLoc.section.current
        while (true) {
            const results = await this.#searchInSection(this.#runId)
            if (!this.#currentSearch) {
                // if the user closes the search panel during the search
                return
            }
            if (results.length > 0) {
                if (this.#sectionsIndex > currentSection) {
                    this.#matchesIndex = 0
                    return
                }
                if (this.#sectionsIndex === currentSection) {
                    for (const [i, result] of results.entries()) {
                        if (CFI.compare(currentLoc.cfi, result.cfi) <= 0) {
                            this.#matchesIndex = i
                            return
                        }
                    }
                }
                else {
                    this.#matchesIndex = results.length - 1
                    return
                }
            }
            if (this.#sectionsIndex < currentSection) {
                this.#sectionsIndex--
            }
            else if (this.#sectionsIndex === this.#totSections - 1) {
                this.#sectionsIndex = currentSection - 1
            }
            if (this.#sectionsIndex < 0) {
                if (this.#results[currentSection].length > 0) {
                    this.#sectionsIndex = currentSection
                    this.#matchesIndex = this.#results[currentSection].length - 1
                }
                return
            }
            if (this.#sectionsIndex >= currentSection) {
                this.#sectionsIndex++
            }
        }
    }

    async #goToMatch() {
        const runId = this.#runId
        const results = this.#results[this.#sectionsIndex]
        const newCFI = results[this.#matchesIndex].cfi
        if (this.#currentMatch?.cfi) {
            this.#view.deleteAnnotation({ value: this.#currentMatch.cfi })
        }
        if (this.#view.isFixedLayout) {
            const oldIndex = this.#currentMatch?.cfi
                ? this.#view.resolveCFI(this.#currentMatch?.cfi).index
                : undefined
            const newIndex = this.#view.resolveCFI(newCFI).index
            if (oldIndex !== newIndex) {
                await this.#view.goTo(newCFI)
                if (runId !== this.#runId) { return }
            }
        }
        else {
            await this.#view.goTo(newCFI)
            if (runId !== this.#runId) { return }
        }
        this.#currentMatch = { cfi: newCFI, index: this.#sectionsIndex }
        await this.#view.addAnnotation({ value: newCFI, type: 'current-search' })
    }

    async #goToAdjacentSection({ previous = false } = {}) {
        const runId = this.#runId
        this.#sectionsIndex += previous ? -1 : 1
        if (this.#results[this.#sectionsIndex]?.length > 0) {
            this.#matchesIndex = previous ? this.#results[this.#sectionsIndex].length - 1 : 0
            await this.#goToMatch()
            return
        }
        while (true) {
            if (!this.#results[this.#sectionsIndex]) {
                await this.#searchInSection(runId)
                if (runId !== this.#runId) { return }
            }
            if (this.#results[this.#sectionsIndex]?.length > 0) {
                break
            }
            if ((!previous && this.#sectionsIndex >= this.#totSections - 1)
                    || (previous && this.#sectionsIndex === 0)) {
                return
            }
            this.#sectionsIndex += previous ? -1 : 1
        }
        this.#matchesIndex = previous ? this.#results[this.#sectionsIndex].length - 1 : 0
        await this.#goToMatch()
    }

    async nextMatch() {
        if (!this.#currentSearch) {
            return
        }
        if (this.#results[this.#sectionsIndex]?.length > 0
                && this.#matchesIndex < this.#results[this.#sectionsIndex].length - 1) {
            if (!this.#currentMatch || this.#currentMatch.index === this.#sectionsIndex) {
                this.#matchesIndex++
            }
            await this.#goToMatch()
            return
        }
        if (this.#sectionsIndex >= this.#totSections - 1) {
            return
        }
        await this.#goToAdjacentSection()
    }
    boundNextMatch = this.nextMatch.bind(this)

    async prevMatch() {
        if (!this.#currentSearch) {
            return
        }
        if (this.#results[this.#sectionsIndex]?.length > 0 && this.#matchesIndex > 0) {
            if (!this.#currentMatch || this.#currentMatch.index === this.#sectionsIndex) {
                this.#matchesIndex--
            }
            await this.#goToMatch()
            return
        }
        if (this.#sectionsIndex === 0) {
            return
        }
        await this.#goToAdjacentSection({ previous: true })

    }
    boundPrevMatch = this.prevMatch.bind(this)

    async searchCleanUp() {
        if (this.#currentMatch?.cfi) {
            this.#view.deleteAnnotation({ value: this.#currentMatch?.cfi })
        }
        this.#currentSearch?.return?.()
        this.#currentSearch = undefined
        this.#query = ''
        this.#results = []
        this.#sectionsIndex = undefined
        this.#matchesIndex = -1
        this.#totSections = undefined
        this.#currentMatch = undefined
        this.#count = 0
        this.#runId++
        this.#view.clearSearch()
        this.#view.deselect()
        this.target.dispatchEvent(new CustomEvent('simebv-search-cleanup'))
    }
    boundSearchCleanUp = this.searchCleanUp.bind(this)
}
