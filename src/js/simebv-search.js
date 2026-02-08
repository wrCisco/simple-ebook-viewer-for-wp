import * as CFI from '../../vendor/foliate-js/epubcfi.js'

export class TextSearch {
    #currentSearch
    #currentSearchQuery
    #currentSearchResult = []
    #currentSearchResultIndex = -1
    #currentLocation
    target

    constructor(target) {
        this.target = target
    }

    async doSearch(str, reverse = false) {
        if (this.#currentSearch && this.#currentSearchQuery === str) {
            reverse ? await this.prevMatch() : await this.nextMatch()
            return
        }
        this.searchCleanUp()
        this.#currentSearchQuery = str
        let newSearch = { newSearch: undefined, lastLocation: undefined }
        this.target.dispatchEvent(new CustomEvent('simebv-search-new', { detail: { newSearch, query: str }}))
        this.#currentSearch = newSearch.newSearch
        this.#currentLocation = newSearch.lastLocation
        await this.matchUntilCurrentLocation()
        await this.nextMatch()
    }
    boundDoSearch = this.doSearch.bind(this)

    async matchUntilCurrentLocation() {
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
                this.#currentSearchResult.push(...result.value.subitems)
                let resultCfi = this.#currentSearchResult[this.#currentSearchResult.length - 1].cfi
                if (CFI.compare(this.#currentLocation.cfi, resultCfi) > 0) {  // 1: resultCfi precedes this.viewer.view.lastLocation.cfi
                    this.#currentSearchResultIndex = this.#currentSearchResult.length - 1
                    continue
                }
                while (this.#currentSearchResultIndex < this.#currentSearchResult.length - 1) {
                    this.#currentSearchResultIndex++
                    resultCfi = this.#currentSearchResult[this.#currentSearchResultIndex].cfi
                    if (CFI.compare(this.#currentLocation.cfi, resultCfi) <= 0) {
                        this.#currentSearchResultIndex--
                        return
                    }
                }
            }
        }
        this.#currentSearchResultIndex = this.#currentSearchResult.length - 2
    }

    async nextMatch() {
        if (!this.#currentSearch) {
            return
        }
        if (this.#currentSearchResult
                && this.#currentSearchResult.length > 0
                && this.#currentSearchResultIndex < this.#currentSearchResult.length - 1
        ) {
            const oldCFI = this.#currentSearchResult[this.#currentSearchResultIndex]?.cfi
            this.#currentSearchResultIndex++
            const newCFI = this.#currentSearchResult[this.#currentSearchResultIndex].cfi
            const promises = []
            this.target.dispatchEvent(new CustomEvent(
                'simebv-search-next',
                { detail: { oldCFI, newCFI, register(promise) { promises.push(promise) }}}
            ))
            await Promise.all(promises)
            return
        }
        let result = await this.#currentSearch.next()
        if (result.value === 'done' || result.done === true) {
            return
        }
        if (result.value?.subitems) {
            this.#currentSearchResult.push(...result.value.subitems)
            const oldCFI = this.#currentSearchResult[this.#currentSearchResultIndex]?.cfi
            this.#currentSearchResultIndex++
            const newCFI = this.#currentSearchResult[this.#currentSearchResultIndex].cfi
            const promises = []
            this.target.dispatchEvent(new CustomEvent(
                'simebv-search-next',
                { detail: { oldCFI, newCFI, register(promise) { promises.push(promise) }}}
            ))
            await Promise.all(promises)
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
        if (this.#currentSearchResult
                && this.#currentSearchResult.length > 0
                && this.#currentSearchResultIndex > 0
        ) {
            const oldCFI = this.#currentSearchResult[this.#currentSearchResultIndex]?.cfi
            this.#currentSearchResultIndex--
            const newCFI = this.#currentSearchResult[this.#currentSearchResultIndex].cfi
            const promises = []
            this.target.dispatchEvent(new CustomEvent(
                'simebv-search-next',
                { detail: { oldCFI, newCFI, register(promise) { promises.push(promise) }}}
            ))
            await Promise.all(promises)
            return
        }
    }
    boundPrevMatch = this.prevMatch.bind(this)

    async searchCleanUp() {
        const lastCFI = this.#currentSearchResult[this.#currentSearchResultIndex]?.cfi
        this.#currentSearch = undefined
        this.#currentSearchResult = []
        this.#currentSearchResultIndex = -1
        this.target.dispatchEvent(new CustomEvent('simebv-search-cleanup', { detail: { lastCFI }}))
    }
    boundSearchCleanUp = this.searchCleanUp.bind(this)

}
