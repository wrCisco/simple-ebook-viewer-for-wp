import { expect, test, describe, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import {
    CURRENT_VERSION, FORMATS, isUnrecoverable,
    bookmarksValidationErrors as errors, validateBookmark } from '../js/simebv-bookmarks-validation.js'


const bookmarks = [
    {
        "loc": {
            "cfi": "epubcfi(/6/16!/4/2[act-3]/6/2/6/4,/1:15,/1:34)",
            "section": 8,
            "sectionFraction": 0.5554134079503226,
            "bookFraction": 0.5554134079503228,
            "textSectionFraction": 0.012907567137701107,
            "tocLabel": "Act III",
            "page": 116,
            "type": "selection"
        },
        "content": "vuolsi così colà",
        "inBook": {
            "text": "conscientious",
            "textBefore": "placeholder text before ",
            "textAfter": ", placeholder text after,",
            "matchText": null,
            "matchTextAfter": null
        },
        "version": 1
    },
    {
        "loc": {
            "cfi": "epubcfi(/6/192!,/4,/4)",
            "tocLabel": "Statements",
            "section": 96,
            "page": 96,
            "type": "page",
            "sectionFraction": 0,
            "bookFraction": 0.09634888438133897,
            "textSectionFraction": 0
        },
        "content": "trentatre trentini entrarono a Trento",
        "inBook": {
            "text": "",
            "textBefore": "",
            "textAfter": "",
            "displayText": ""  // missing two optional fields and adding one extraneous field
        },
        "version": 1
    }
]

const strBookmark = bookmark => {
    return `Bookmark (type: ${bookmark?.loc?.type}, cfi: ${bookmark?.loc?.cfi}, content: ${bookmark?.content})`
}

test.for(
    bookmarks.map(b => ({ bookmark: b, repr: strBookmark(b), expected: [] }))
)(`Validating $repr. Expected result: $expected`, ({ bookmark, expected }) => {
    expect(validateBookmark(bookmark)).toEqual(expected)
})

describe('Validating selection bookmark', () => {
    let copy
    beforeEach(() => {
        copy = structuredClone(bookmarks[0])
    })
    test("loc.cfi === ''", () => {
        copy.loc.cfi = ''
        expect(validateBookmark(copy)).toEqual([
            expect.objectContaining({ key: 'loc.cfi', code: errors.EMPTY_PROPERTY }),
            expect.objectContaining({ key: 'loc.cfi', code: errors.INVALID_VALUE }),
        ])
    })
    test('loc.cfi === null', () => {
        copy.loc.cfi = null
        expect(validateBookmark(copy)).toEqual([
            expect.objectContaining({ key: 'loc.cfi', code: errors.WRONG_TYPE_PROPERTY }),
            expect.objectContaining({ key: 'loc.cfi', code: errors.EMPTY_PROPERTY }),
        ])
    })
    test('loc.cfi non existent', () => {
        delete copy.loc.cfi
        expect(validateBookmark(copy)).toEqual([
            expect.objectContaining({ key: 'loc.cfi', code: errors.MISSING_PROPERTY }),
        ])
    })
    test('loc.cfi === "not a cfi"', () => {
        copy.loc.cfi = 'not a cfi'
        expect(validateBookmark(copy)).toEqual([
            expect.objectContaining({ key: 'loc.cfi', code: errors.INVALID_VALUE }),
        ])
    })
    test('loc.cfi === 5 (wrong type)', () => {
        copy.loc.cfi = 5
        expect(validateBookmark(copy)).toEqual([
            expect.objectContaining({ key: 'loc.cfi', code: errors.WRONG_TYPE_PROPERTY }),
        ])
    })
    test('loc.cfi === { cfi: "wrong type (object)" }', () => {
        copy.loc.cfi = { cfi: "wrong type (object)" }
        expect(validateBookmark(copy)).toEqual([
            expect.objectContaining({ key: 'loc.cfi', code: errors.WRONG_TYPE_PROPERTY }),
        ])
    })
    test('loc.cfi === [ "wrong type (array)"]', () => {
        copy.loc.cfi = [ "wrong type (array) "]
        expect(validateBookmark(copy)).toEqual([
            expect.objectContaining({ key: 'loc.cfi', code: errors.WRONG_TYPE_PROPERTY }),
        ])
    })
    test('loc.tocLabel (optional field) non existent', () => {
        delete copy.loc.tocLabel
        expect(validateBookmark(copy)).toEqual([])
    })
    test('loc.tocLabel (optional field) === { label: "wrong type (object)" }', () => {
        copy.loc.tocLabel = { label: "wrong type" }
        expect(validateBookmark(copy)).toEqual([
            expect.objectContaining({ key: 'loc.tocLabel', code: errors.WRONG_TYPE_PROPERTY })
        ])
    })
    test('loc.tocLabel (optional field) === [ "wrong type (array)" ]', () => {
        copy.loc.tocLabel = [ "wrong type" ]
        expect(validateBookmark(copy)).toEqual([
            expect.objectContaining({ key: 'loc.tocLabel', code: errors.WRONG_TYPE_PROPERTY })
        ])
    })
    test('loc.tocLabel (optional field) === null', () => {
        copy.loc.tocLabel = null
        expect(validateBookmark(copy)).toEqual([])
    })
    test('loc.tocLabel (optional field) === undefined', () => {
        copy.loc.tocLabel = undefined
        expect(validateBookmark(copy)).toEqual([])
    })
    test('loc.section === "a string" (wrong type)', () => {
        copy.loc.section = 'a string'
        expect(validateBookmark(copy)).toEqual([
            expect.objectContaining({ key: 'loc.section', code: errors.WRONG_TYPE_PROPERTY })
        ])
    })
    test('loc.section === null (wrong type)', () => {
        copy.loc.section = null
        expect(validateBookmark(copy)).toEqual([
            expect.objectContaining({ key: 'loc.section', code: errors.WRONG_TYPE_PROPERTY })
        ])
    })
    test("type === ''", () => {
        copy.loc.type = ''
        expect(validateBookmark(copy)).toEqual(expect.arrayContaining([
            expect.objectContaining({ key: 'loc.type', code: errors.EMPTY_PROPERTY }),
            expect.objectContaining({ key: 'loc.type', code: errors.NOT_IN_ALLOWED_CHOICES }),
        ]))
    })
    test('bookmark === null', () => {
        copy = null
        expect(validateBookmark(copy)).toEqual([
            expect.objectContaining({ code: errors.NOT_AN_OBJECT })
        ])
    })
    test('inBook non existent', () => {
        delete copy.inBook
        expect(validateBookmark(copy)).toEqual([
            expect.objectContaining({ key: 'inBook', code: errors.MISSING_PROPERTY })
        ])
    })
    test('inBook === null (wrong type)', () => {
        copy.inBook = null
        expect(validateBookmark(copy)).toEqual([
            expect.objectContaining({ key: 'inBook', code: errors.WRONG_TYPE_PROPERTY })
        ])
    })
    test('inBook === "a string" (wrong type)', () => {
        copy.inBook = "a string"
        expect(validateBookmark(copy)).toEqual([
            expect.objectContaining({ key: 'inBook', code: errors.WRONG_TYPE_PROPERTY })
        ])
    })
})
