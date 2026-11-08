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
        ignorePunctuation: false,
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

        this.#view.addEventListener('create-overlay', async e => {
            const { index } = e.detail
            for (const { index: i, cfi } of this.#currentMatch?.parts ?? []) {
                if (i === index) {
                    await this.#view.addAnnotation({ value: cfi, type: 'current-search'})
                }
            }
        })
    }

    openDialog(returnFocusTo) {
        if (!this.#dlg) {
            this.#dlg = searchDialog(
                this.boundDoSearch,
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
        const { reverse, matchCase, matchWholeWords, ignorePunctuation } = opts
        if (this.#currentSearch && this.#isSameSearch(str, {matchCase, matchWholeWords, ignorePunctuation})) {
            reverse ? await this.prevMatch() : await this.nextMatch()
            return
        }
        this.searchCleanUp()
        this.#query = str
        this.#opts.matchCase = matchCase
        this.#opts.matchWholeWords = matchWholeWords
        this.#opts.ignorePunctuation = ignorePunctuation
        this.#sectionsIndex = Math.min(...this.#view.renderer.getContents().map(c => c.index))
        if (this.#sectionsIndex === Infinity) this.#sectionsIndex = this.#view.lastLocation.section.current
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
        const { matchCase, matchWholeWords, ignorePunctuation } = this.#opts
        const search = this.#newSearch(
            this.#query, { matchCase, matchWholeWords, ignorePunctuation, index: this.#sectionsIndex }
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
        const currentSection = this.#sectionsIndex
        while (true) {
            const results = await this.#searchInSection(this.#runId)
            if (!this.#currentSearch) {
                // if the user closes the search panel during the search
                return
            }
            if (results.length > 0) {
                if (this.#sectionsIndex !== currentSection || this.#view.isFixedLayout) {
                    this.#matchesIndex = 0
                    return
                }
                for (const [i, result] of results.entries()) {
                    if (CFI.compare(currentLoc.cfi, result.cfi) <= 0) {
                        this.#matchesIndex = i
                        return
                    }
                }
            }
            if (this.#sectionsIndex === this.#totSections - 1) {
                this.#sectionsIndex = 0
            }
            else {
                this.#sectionsIndex++
            }
            if (this.#sectionsIndex === currentSection) {
                if (this.#results[currentSection].length > 0) {
                    this.#matchesIndex = 0
                }
                return
            }
        }
    }

    async #goToMatch() {
        const runId = this.#runId
        const results = this.#results[this.#sectionsIndex]
        const match = results[this.#matchesIndex]
        const parts = match.parts ?? [{ index: this.#sectionsIndex, cfi: match.cfi }]
        for (const { cfi } of this.#currentMatch?.parts ?? []) {
            this.#view.deleteAnnotation({ value: cfi })
        }
        this.#currentMatch = { cfi: match.cfi, parts, index: this.#sectionsIndex }
        const visible = this.#view.renderer.getContents().map(c => c.index)
        if (!this.#view.isFixedLayout || !visible.includes(this.#sectionsIndex)) {
            await this.#view.goTo(match.cfi)
            if (runId !== this.#runId) { return }
        }
        // reverse the parts to draw the first one last (cfr. scrollIntoView)
        for (const { cfi } of parts.toReversed()) {
            await this.#view.addAnnotation({ value: cfi, type: 'current-search'})
        }
    }

    async #goToAdjacentSection({ previous = false } = {}) {
        const runId = this.#runId
        const startSection = this.#sectionsIndex
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
                this.#sectionsIndex = startSection
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

    async searchCleanUp() {
        for (const { cfi } of this.#currentMatch?.parts ?? []) {
            this.#view.deleteAnnotation({ value: cfi })
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
