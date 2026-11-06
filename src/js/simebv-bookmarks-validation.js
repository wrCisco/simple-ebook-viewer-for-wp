import { CFI } from './simebv-epubcfi.js'

export const CURRENT_VERSION = 1
export const FORMATS = {
    1: {
        type: 'object',
        items: {
            content: {
                type: 'string',
            },
            inBook: {
                type: 'object',
                items: {
                    text: { type: 'string' },
                    textAfter: { type: 'string' },
                    textBefore: { type: 'string' },
                    matchText: { type: 'string', optional: true },
                    matchTextAfter: { type: 'string', optional: true },
                },
            },
            loc: {
                type: 'object',
                items: {
                    cfi: { type: 'string', notEmpty: true, valid: CFI.isCFI.test.bind(CFI.isCFI) },
                    page: { type: 'number', optional: true },
                    pageLabel: { type: 'string', optional: true },
                    section: { type: 'number' },
                    sectionFraction: { type: 'number', optional: true },
                    bookFraction: { type: 'number' },
                    textSectionFraction: { type: 'number', optional: true },
                    tocLabel: { type: 'string', optional: true },
                    type: { type: 'string', choices: ['page', 'selection'], notEmpty: true },
                }
            },
            version: {
                type: 'number'
            },
        },
    },
}

export const isUnrecoverable = bookmark => {
    return !bookmark || typeof bookmark !== 'object' || Array.isArray(bookmark)
            || typeof bookmark.loc?.cfi !== 'string' || !CFI.isCFI.test(bookmark.loc.cfi)
}

export const bookmarksValidationErrors = {
    UNSUPPORTED_VERSION: 0,
    NOT_AN_OBJECT: 1,
    MISSING_PROPERTY: 2,
    WRONG_TYPE_PROPERTY: 3,
    EMPTY_PROPERTY: 4,
    NOT_IN_ALLOWED_CHOICES: 5,
    INVALID_VALUE: 6,
}

const flatten = (errors, key = '') => {
    const result = []
    for (const e of errors) {
        if (e.key) {
            result.push(...flatten(e.errors, `${key ? key + '.' : ''}${e.key}`))
        }
        else {
            result.push({ key, ...e })
        }
    }
    return result
}

export const validateBookmark = (bookmark, finishEarly = false) => {
    const version = bookmark?.version ?? CURRENT_VERSION
    const errors = []
    switch (version) {
        case 1: {
            if (!bookmark || typeof bookmark !== 'object' || Array.isArray(bookmark)) {
                return [{
                    key: '', code: bookmarksValidationErrors.NOT_AN_OBJECT,
                    description: 'The bookmark is not an object',
                }]
            }
            validateObject(bookmark, FORMATS[version], errors, finishEarly)
            return flatten(errors)
        }
        default: {
            return [{
                key: 'version', code: bookmarksValidationErrors.UNSUPPORTED_VERSION,
                description: 'version number not supported'
            }]
        }
    }
}

const validateObject = (obj, blueprint, errors, finishEarly) => {
    for (const [k, v] of Object.entries(blueprint.items)) {
        const keyErrors = []
        if (!Object.hasOwn(obj, k)) {
            if (!v.optional) {
                keyErrors.push({
                    code: bookmarksValidationErrors.MISSING_PROPERTY,
                    description: 'missing property'
                })
                errors.push({ key: k, errors: keyErrors })
                if (finishEarly) return
            }
            continue
        }
        const acceptedTypes = [v.type]
        if (v.optional) acceptedTypes.push('undefined')
        let wrongType = obj[k] === null
            ? !v.optional
            : Array.isArray(obj[k])
                ? !acceptedTypes.includes('array')
                : !acceptedTypes.includes(typeof obj[k])
        if (wrongType) {
            keyErrors.push({
                code: bookmarksValidationErrors.WRONG_TYPE_PROPERTY,
                description: 'value of wrong type: ' + (typeof obj[k])
            })
        }
        if (v.type === 'object' && obj[k] && typeof obj[k] === 'object') {
            validateObject(obj[k], v, keyErrors, finishEarly)
        }
        if (v.type === 'string' && v.notEmpty && !obj[k]) keyErrors.push({
            code: bookmarksValidationErrors.EMPTY_PROPERTY,
            description: 'empty property with nonEmpty requirement'
        })
        if (v.choices && !v.choices.includes(obj[k])) keyErrors.push({
            code: bookmarksValidationErrors.NOT_IN_ALLOWED_CHOICES,
            description: 'value ' + obj[k] + ' outside of allowed choices'
        })
        if (!wrongType && obj[k] != null && typeof v.valid === 'function' && !v.valid(obj[k])) keyErrors.push({
            code: bookmarksValidationErrors.INVALID_VALUE,
            description: 'value ' + obj[k] + " rejected by validation function"
        })
        if (keyErrors.length > 0) {
            errors.push({ key: k, errors: keyErrors })
            if (finishEarly) return
        }
    }
}
