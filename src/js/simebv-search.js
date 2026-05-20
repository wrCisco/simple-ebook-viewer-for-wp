import { CFI } from './simebv-epubcfi.js'

export class TextSearch {
    #currentSearch
    #query
    #results = []
    #index = -1
    #currentLocation
    target

    constructor(target) {
        this.target = target
    }

    async doSearch(str, reverse = false) {
        if (this.#currentSearch && this.#query === str) {
            reverse ? await this.prevMatch() : await this.nextMatch()
            return
        }
        this.searchCleanUp()
        this.#query = str
        let newSearch = { newSearch: undefined, lastLocation: undefined }
        this.target.dispatchEvent(new CustomEvent('simebv-search-new', { detail: { newSearch, query: str }}))
        this.#currentSearch = newSearch.newSearch
        this.#currentLocation = newSearch.lastLocation
        await this.matchUntilCurrentLocation()
        if (this.#results.length > 0 && this.#index === this.#results.length - 2) {
            await this.goToNextMatch({useOldCFI: false})
        }
        else {
            await this.nextMatch()
        }
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

    async goToNextMatch({ previous = false, useOldCFI = true } = {}) {
        const oldCFI = useOldCFI
            ? this.#results[this.#index]?.cfi
            : null
        this.#index += previous ? -1 : 1
        const newCFI = this.#results[this.#index].cfi
        const promises = []
        this.target.dispatchEvent(new CustomEvent(
            'simebv-search-next',
            { detail: {
                oldCFI, newCFI,
                deleteOld: useOldCFI,
                register(promise) { promises.push(promise) }
            }}
        ))
        await Promise.all(promises)
    }

    async nextMatch() {
        if (!this.#currentSearch) {
            return
        }
        if (this.#results.length > 0 && this.#index < this.#results.length - 1) {
            await this.goToNextMatch()
            return
        }
        let result = await this.#currentSearch.next()
        if (result.value === 'done' || result.done === true) {
            return
        }
        if (result.value?.subitems) {
            this.#results.push(...result.value.subitems)
            await this.goToNextMatch()
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
            await this.goToNextMatch({previous: true})
            return
        }
    }
    boundPrevMatch = this.prevMatch.bind(this)

    async searchCleanUp() {
        const lastCFI = this.#results[this.#index]?.cfi
        this.#currentSearch = undefined
        this.#results = []
        this.#index = -1
        this.target.dispatchEvent(new CustomEvent('simebv-search-cleanup', { detail: { lastCFI }}))
    }
    boundSearchCleanUp = this.searchCleanUp.bind(this)

}
