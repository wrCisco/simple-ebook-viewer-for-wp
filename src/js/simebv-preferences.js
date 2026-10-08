import { isNumeric } from './simebv-utils.js'

// https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API#testing_for_availability
const STORAGE_TEST_KEY = "__storage_test__"
const storageAvailable = (type) => {
    let storage
    try {
        storage = window[type]
        const x = STORAGE_TEST_KEY
        storage.setItem(x, x)
        storage.removeItem(x)
        return true
    } catch (e) {
        return (
            e instanceof DOMException &&
            e.name === "QuotaExceededError" &&
            // acknowledge QuotaExceededError only if there's something already stored
            storage &&
            storage.length !== 0
        )
    }
}


class WPConsentManager {
    /**
     * Returns true if the WP Consent API is not active on the page
     * or if the consent has been explicitly given or if the consent
     * has not been explicitly denied (the last one only in case of
     * an optout type of consent, which is set at website level).
     */
    granted(type) {
        if (!window.simebvConsent?.isApiActive) return true
        return typeof window.wp_has_consent === 'function'
            ? window.wp_has_consent(type)
            : window.simebvConsent[type]
    }
    /**
     * Returns true only in case of an explicit denial.
     */
    denied(type) {
        if (!window.simebvConsent?.isApiActive) return false
        if (typeof window.consent_api_get_cookie !== 'function' || !window.consent_api) return false
        return window.consent_api_get_cookie(window.consent_api.cookie_prefix + '_' + type) === 'deny'
    }
    onChange(cb, types) {
        document.addEventListener('wp_listen_for_consent_change', e => {
            const changed = e.detail
            for (const type of types) {
                if (type in changed)  {
                    const allowed = changed[type] === 'allow'
                    if (window.simebvConsent) {
                        window.simebvConsent[type] = allowed
                    }
                    cb(type, allowed)
                }
            }
        })
    }
}


class PreferencesManager {
    #hasUserInteracted = false
    #consent
    #flushTimeout
    #pendingFlush = new Set()
    #storageName
    #categories = [
        'preferences',
        'functional',
    ]
    #dirty = {}
    #clients = []
    #prefix = 'simebv-'
    #corrupted = {}
    storage
    data = {}
    target = new EventTarget()

    constructor() {
        for (const type of this.#categories) {
            this.data[type] = {}
            this.#dirty[type] = new Set()
        }
    }

    init(consentManager, storageName = 'localStorage', force = false) {
        if (!force && this.#consent) return
        this.#consent = consentManager ?? new WPConsentManager()
        this.#storageName = storageName
        if (this.isStorageAvailable()) {
            this.storage = window[storageName]
            for (const type of this.#categories) {
                if (this.#consent.denied(type)) {
                    this.clearStorage(type)
                }
            }
            for (const type of this.#categories) {
                this.data[type] = this.loadStorage(type).data
            }
            if (this.#categories.every(type => Object.keys(this.data[type]).length === 0)
                    && Object.keys(this.#corrupted).length === 0) {
                this.convertFromOldStyle()
            }
        }
        this.#consent.onChange(
            (type, allowed) => {
                if (allowed) {
                    for (const name of Object.keys(this.data[type])) {
                        this.#dirty[type].add(name)
                    }
                    this.flushPreferences(type)
                }
                else this.clearStorage(type)
            },
            this.#categories,
        )
        globalThis.addEventListener('storage', e => {
            if (this.#clients.length === 0) return
            const type = this.#categories.find(t => e.key === this.#prefix + t)
            if (!type) return
            const { data: newData, unreadable, corrupted } = this.loadStorage(type)
            if (!newData || unreadable || corrupted !== undefined) return
            const updated = []
            for (const name in newData) {
                const value = newData[name]
                if (this.#dirty[type].has(name) ||
                        JSON.stringify(value) === JSON.stringify(this.data[type][name])) {
                    continue
                }
                this.data[type][name] = value
                updated.push(name)
            }
            for (const { target, types, names } of this.#clients) {
                if (!types.includes(type)) continue
                for (const name of updated) {
                    if (names.includes(name)) {
                        target.dispatchEvent(new CustomEvent('storage-changed', {
                            detail: { type, name }
                        }))
                    }
                }
            }
        })
    }

    hasConsent(type) {
        return this.#consent.granted(type)
    }

    registerClient(eventTarget, types = [], names = []) {
        this.#clients.push({target: eventTarget, types, names})
    }

    isStorageAvailable() {
        return storageAvailable(this.#storageName)
    }

    useStorage(storageName) {
        if (storageAvailable(storageName)) {
            this.#storageName = storageName
            this.storage = window[storageName]
            return true
        }
        return false
    }

    refreshStorage(resetData = false) {
        this.useStorage(this.#storageName)
        if (this.storage) {
            for (const type of this.#categories) {
                const newPrefs = this.loadStorage(type)
                if (newPrefs.unreadable || newPrefs.corrupted !== undefined) {
                    continue
                }
                this.data[type] = resetData ? newPrefs.data : { ...newPrefs.data, ...this.data[type] }
            }
        }
    }

    userInteraction() {
        this.#hasUserInteracted = true
    }

    get hasUserInteracted() {
        return this.#hasUserInteracted
    }

    savePreference(name, value, type = 'preferences', flush = true) {
        this.data[type][name] = value
        this.#dirty[type].add(name)
        if (flush) {
            this.flushPreferences(type)
        }
    }

    savePreferences(prefs, flush = true) {
        let updatedTypes = new Set()
        for (const [name, value, type = 'preferences'] of prefs) {
            this.data[type][name] = value
            this.#dirty[type].add(name)
            updatedTypes.add(type)
        }
        if (flush && updatedTypes.size > 0) {
            this.flushPreferences(...updatedTypes)
        }
    }

    updatePreference(name, updater, type = 'preferences', flush = true) {
        const current = this.#dirty[type].has(name)
            ? this.data[type][name]
            : (this.loadStorage(type).data[name] ?? this.data[type][name])
        const value = updater(current)
        this.savePreference(name, value, type, flush)
        return value
    }

    loadPreference(name, type = 'preferences') {
        if (Object.hasOwn(this.data[type], name)) {
            return this.data[type][name]
        }
    }

    flushPreferences(...types) {
        types.forEach(type => this.#pendingFlush.add(type))
        if (this.#flushTimeout) clearTimeout(this.#flushTimeout)
        this.#flushTimeout = setTimeout(() => {
            if (!this.isStorageAvailable() || !this.#hasUserInteracted) {
                return
            }
            if (!this.storage) {
                this.refreshStorage()
            }
            for (const type of this.#pendingFlush) {
                if (!this.#consent.granted(type)) {
                    this.#emitErrors(type, 'no-consent-storage')
                    continue
                }
                const { data: merged, unreadable, corrupted } = this.loadStorage(type)
                if (unreadable || corrupted !== undefined) {
                    this.#emitErrors(type, 'error-storage')
                    continue
                }
                for (const name of this.#dirty[type]) {
                    if (Object.hasOwn(this.data[type], name)) {
                        merged[name] = this.data[type][name]
                    }
                    else { delete merged[name] }
                }
                try {
                    this.storage.setItem(this.#prefix + type, JSON.stringify(merged))
                }
                catch (e) {
                    this.#emitErrors(type, 'error-storage', e, merged)
                    continue
                }
                this.#dirty[type].clear()
                this.#pendingFlush.delete(type)
            }
        }, 200)
    }

    clearStorage(type) {
        this.#pendingFlush.delete(type)
        if (!this.isStorageAvailable()) {
            return
        }
        if (!this.storage) {
            this.useStorage(this.#storageName)
        }
        this.storage.removeItem(this.#prefix + type)
        this.#setCorrupted(type, undefined)
    }

    loadStorage(type) {
        if (!this.isStorageAvailable()) {
            return { data: {}, unreadable: true }
        }
        if (!this.storage) {
            this.useStorage(this.#storageName)
        }
        let raw
        try {
            raw = this.storage.getItem(this.#prefix + type)
        }
        catch (e) {
            return { data: {}, unreadable: true, error: e }
        }
        if (raw === null) {
            this.#setCorrupted(type, undefined)
            return { data: {} }
        }
        try {
            const parsed = JSON.parse(raw)
            if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
                this.#setCorrupted(type, undefined)
                return { data: parsed }
            }
        } catch {}
        this.#setCorrupted(type, raw)
        return { data: {}, corrupted: raw }
    }

    getCorruptedData(type) {
        if (!type) return { ...this.#corrupted }
        return this.#corrupted[type]
    }

    discardCorrupted(type) {
        if (this.#corrupted[type] === undefined) return
        delete this.#corrupted[type]
        try {
            this.storage.removeItem(this.#prefix + type)
        }
        catch {}
        this.flushPreferences(type)
    }

    #setCorrupted(type, raw) {
        if (this.#corrupted[type] === raw) return
        if (raw === undefined) delete this.#corrupted[type]
        else this.#corrupted[type] = raw
        // detail.raw undefined means repaired
        for (const { target, types } of this.#clients) {
            if (types.includes(type)) {
                target.dispatchEvent(new CustomEvent('corrupted-storage', { detail: { type, raw }}))
            }
        }
    }

    #emitErrors(type, eventName, error, load) {
        for (const { target, types, names } of this.#clients) {
            if (!types.includes(type)) continue
            const errorNames = Array.from(this.#dirty[type]).filter(n => names.includes(n))
            if (errorNames.length > 0) {
                target.dispatchEvent(new CustomEvent(eventName, {
                    detail: {
                        error, type, load, names: errorNames, storageName: this.#storageName
                    }
                }))
            }
        }
    }

    convertFromOldStyle() {
        const oldKeys = []
        for (const [key, value] of Object.entries(this.storage)) {
            if (!key.startsWith('simebv-')) continue
            const k = key.replace('simebv-', '')
            if (this.#categories.includes(k)) continue
            const type = key.endsWith('_LastPage') ? 'functional' : 'preferences'
            try {
                this.data[type][k] = JSON.parse(value)
            } catch {
                console.warn('error in parsing value:', value)
            }
            oldKeys.push(key)
        }
        for (const key of oldKeys) {
            this.storage.removeItem(key)
        }
        for (const type of this.#categories) {
            if (Object.keys(this.data[type]).length > 0 && this.#consent.granted(type)) {
                this.storage.setItem(this.#prefix + type, JSON.stringify(this.data[type]))
            }
        }
    }

}


let preferencesManager
export function getPreferencesManager() {
    if (!preferencesManager) {
        preferencesManager = new PreferencesManager()
    }
    return preferencesManager
}


export class PreferencesLoader {
    container
    manager

    constructor(container, manager) {
        this.container = container
        this.manager = manager
    }

    loadAnnotationPrefs(showAnnotationsAttr, showPageDelimitAttr) {
        const showAnnotations = this.manager.loadPreference('show-annotations') ?? showAnnotationsAttr
        const showPageDelimiters = this.manager.loadPreference('show-page-delimiters') ?? showPageDelimitAttr
        return { showAnnotations, showPageDelimiters }
    }

    loadFontFamilyPrefs(fontFamilyAttr) {
        let fontFamily = this.manager.loadPreference('font-family')
        if (!fontFamily && fontFamilyAttr) {
            fontFamily = fontFamilyAttr
        }
        return fontFamily
    }

    loadFilterPrefs(filter) {
        if (!filter) {
            return
        }
        for (const prop in filter) {
            let value = this.container.getAttribute('data-simebv-' + prop.toLowerCase())
            value = PreferencesLoader.convertUserSettings(prop, value)
            if (value !== null) {
                filter[prop] = value
            }
        }
        for (const prop in filter) {
            let value = this.manager.loadPreference(prop)
            if (value !== null) {
                filter[prop] = value  // TODO: sanity check?
            }
        }
        return filter
    }

    loadMenuPrefs(values, menu) {
        if (!menu) {
            return
        }
        const selectOpts = { initialSelect: true }
        // Retrieve data set by the user server side, validate it and store it as default
        const defValues = values.map((item) => {
            const [name, _] = item
            let attrVal = this.container.getAttribute('data-simebv-' + name.toLowerCase())
            attrVal = PreferencesLoader.convertUserSettings(name, attrVal)
            if (attrVal && menu.groups[name]?.validate(attrVal)) {
                return [name, attrVal]
            }
            return item
        })
        // if there is no storage available, select default values on the menu
        if (!this.manager.isStorageAvailable()) {
            for (const [name, defVal] of defValues) {
                menu.groups[name]?.select(defVal, selectOpts)
            }
            return
        }
        // Retrieve data from storage, validate it and select it on the menu, otherwise use default
        for (const [name, defVal] of defValues) {
            if (name === 'zoom') {
                const savedCustomZoom = this.manager.loadPreference('custom-zoom')
                if (menu.groups.zoom?.validate(savedCustomZoom)) {
                    // this will not trigger the change event
                    menu.element.querySelector('#simebv-zoom-numeric').value = savedCustomZoom
                    const smItem = menu.element.querySelector('#simebv-zoom-numeric-sm')
                    smItem.textContent = smItem.textContent.replace(/\d+/, savedCustomZoom)
                }
            }
            let savedVal = this.manager.loadPreference(name)
            // let savedVal = JSON.parse(localStorage.getItem('simebv-' + name))
            menu.groups[name]?.validate(savedVal)
                ? menu.groups[name].select(savedVal, selectOpts)
                : (
                    menu.groups[name]?.select(defVal, selectOpts),
                    console.warn(`Invalid value for menu ${name}: ${savedVal}, setting default: ${defVal}`)
                )
        }
    }

    static convertUserSettings(name, value) {
        const converter = {
            colors: {
                sepia: 'simebv-sepia',
                light: 'simebv-light',
                dark: 'simebv-dark',
                'light-forced': 'simebv-light-forced',
                'dark-forced': 'simebv-dark-forced',
            },
            margins: {
                small: '4%',
                medium: '8%',
                large: '12%',
            },
            fontsize: {
                small: 14,
                medium: 18,
                large: 22,
                'x-large': 26,
            },
            linespacing: {
                auto: 0,
                small: 1,
                medium: 1.4,
                large: 2.3,
            },
            activatecolorfilter: {
                'true': true,
                'false': false,
            },
            bgfiltertransparent: {
                'true': true,
                'false': false,
            },
            hyphenation: {
                'auto': 'auto',
                'true': 'yes',
                'false': 'no',
            },
        }
        if (isNumeric(value)) {
            value = Number(value)
        }
        return converter[name.toLowerCase()]?.[value] ?? value
    }

}
