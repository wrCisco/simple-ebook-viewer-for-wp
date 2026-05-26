import { isNumeric } from './simebv-utils.js'

// https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API#testing_for_availability
const storageAvailable = (type) => {
    let storage
    try {
        storage = window[type]
        const x = "__storage_test__"
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
    granted(type) {
        return !window.simebvConsent?.isApiActive || window.simebvConsent[type]
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


export class PreferencesManager {
    #hasUserInteracted = false
    #consent
    #flushTimeout
    #pendingFlush = new Set()
    #storageName
    #categories = [
        'preferences',
        'functional',
    ]
    storage
    data

    constructor(consentManager, storageName = 'localStorage') {
        this.data = Object.fromEntries(this.#categories.map(type => [type, {}]))
        this.#consent = consentManager ?? new WPConsentManager()
        this.#storageName = storageName
        if (this.isStorageAvailable()) {
            this.storage = window[storageName]
            for (const type of this.#categories) {
                this.data[type] = this.loadStorage(type)
            }
            if (this.#categories.every(type => Object.keys(this.data[type]).length === 0)) {
                this.convertFromOldStyle()
            }
            for (const type of this.#categories) {
                if (!this.#consent.granted(type)) {
                    this.clearStorage(type)
                }
            }
        }
        this.#consent.onChange(
            (type, allowed) => {
                if (allowed) this.flushPreferences(type)
                else this.clearStorage(type)
            },
            this.#categories,
        )
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
                this.data[type] = resetData ? newPrefs : { ...newPrefs, ...this.data[type] }
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
        if (flush) {
            this.flushPreferences(type)
        }
    }

    savePreferences(prefs, flush = true) {
        let updatedTypes = new Set()
        for (const [name, value, type = 'preferences'] of prefs) {
            this.data[type][name] = value
            updatedTypes.add(type)
        }
        if (flush && updatedTypes.size > 0) {
            this.flushPreferences(...updatedTypes)
        }
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
                    continue
                }
                this.storage.setItem('simebv-' + type, JSON.stringify(this.data[type]))
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
        this.storage.removeItem('simebv-' + type)
    }

    loadStorage(type) {
        if (!this.isStorageAvailable()) {
            return
        }
        if (!this.storage) {
            this.useStorage(this.#storageName)
        }
        let parsed
        try {
            parsed = JSON.parse(this.storage.getItem('simebv-' + type))
        } catch {
            parsed = {}
        }
        return (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {}
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
                this.storage.setItem('simebv-' + type, JSON.stringify(this.data[type]))
            }
        }
    }

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
                menu.groups[name]?.select(defVal)
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
                ? menu.groups[name].select(savedVal)
                : (
                    menu.groups[name]?.select(defVal),
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
