import { isNumeric } from './simebv-utils.js'
import { __, _x, _n, sprintf } from './simebv-i18n.js'

export function createMenuItemsStd(reader, injectCSS) {
    return new Map([
        ['search', {
            name: 'search',
            label: __('Search...', 'simple-ebook-viewer'),
            shortcut: __('Ctrl+F', 'simple-ebook-viewer'),
            type: 'action',
            onclick: () => reader._textSearch?.openDialog(reader.container),
            attrs: [
                ['aria-haspopup', 'dialog'],
            ],
        }],

        ['history', {
            name: 'history',
            label: __('History', 'simple-ebook-viewer'),
            type: 'group',
            items: [
                {
                    name: 'previous',
                    label: __('Previous', 'simple-ebook-viewer'),
                    classList: ['simebv-action-menu-item'],
                    onclick: () => {
                        reader.view?.history?.back()
                    }
                },
                {
                    name: 'next',
                    label: __('Next', 'simple-ebook-viewer'),
                    classList: ['simebv-action-menu-item'],
                    onclick: () => {
                        reader.view?.history?.forward()
                    }
                }
            ]
        }],

        ['layout', {
            name: 'layout',
            label: __('Layout', 'simple-ebook-viewer'),
            type: 'radio',
            items: [
                [__('Paginated', 'simple-ebook-viewer'), 'paginated'],
                [__('Scrolled', 'simple-ebook-viewer'), 'scrolled'],
            ],
            onclick: value => {
                if (value === 'scrolled') {
                    reader.menu.groups.maxPages?.enable(false)
                    reader.menu.groups.margins?.enable(false)
                }
                else {
                    reader.menu.groups.maxPages?.enable(true)
                    reader.menu.groups.margins?.enable(true)
                }
                reader.view?.renderer.setAttribute('flow', value)
                reader._savePreference('layout', value)
            },
            horizontal: false,
        }],

        ['oddPages', {
            name: 'oddPages',
            label: __('First page', 'simple-ebook-viewer'),
            type: 'radio',
            items: [
                [__('Left', 'simple-ebook-viewer'), 'left'],
                [__('Right', 'simple-ebook-viewer'), 'right'],
            ],
            onclick: value => {
                // meant only for fixed layout ebooks
                const { book, renderer } = reader.view
                const assign = i => i % 2 === 0 ^ value === 'left' ? 'right' : 'left'
                book.sections.forEach((section, i) => {
                    section.pageSpread = assign(i)
                })
                renderer.respread().catch(e => console.error(e))
                reader._savePreference('oddPages', value)
            },
            horizontal: false,
        }],

        ['pageProgression', {
            name: 'pageProgression',
            label: __('Page direction', 'simple-ebook-viewer'),
            type: 'radio',
            items: [
                [__('Auto', 'simple-ebook-viewer'), 'auto'],
                [__('Left To Right', 'simple-ebook-viewer'), 'ltr'],
                [__('Right To Left', 'simple-ebook-viewer'), 'rtl'],
            ],
            onclick: value => {
                const { book, renderer } = reader.view
                const dir = value === 'auto' ? book._defaultDir : value
                if (dir !== book.dir) {
                    book.dir = dir
                    renderer.respread?.().catch(e => console.error(e))
                    reader._navBar.dispatchEvent(new CustomEvent('new-book', { detail: {
                        fractions: reader.view.getSectionFractions(),
                        dir: book.dir
                    }}))
                }
                reader._savePreference('pageProgression', value)
            },
            horizontal: false,
        }],

        ['maxPages', {
            name: 'maxPages',
            label: __('Max pages per view', 'simple-ebook-viewer'),
            type: 'radio',
            items: [
                ['1', 1], ['2', 2], ['3', 3], ['4', 4],
            ],
            onclick: value => {
                reader.view?.renderer.setAttribute('max-column-count', value)
                if (value === 1) reader.menu.groups.oddPages?.enable(false)
                else reader.menu.groups.oddPages?.enable(true)
                reader._savePreference('maxPages', value)
            },
            horizontal: true,
        }],

        ['fontSize', {
            name: 'fontSize',
            label: __('Font Size', 'simple-ebook-viewer'),
            type: 'radio',
            items: [
                [_x('Small', 'Font Size', 'simple-ebook-viewer'), 14],
                [_x('Medium', 'Font Size', 'simple-ebook-viewer'), 18],
                [_x('Large', 'Font Size', 'simple-ebook-viewer'), 22],
                [_x('X-Large', 'Font Size', 'simple-ebook-viewer'), 26],
            ],
            onclick: value => {
                reader.style.fontSize = value
                reader.view?.renderer.setStyles?.(injectCSS(reader.style))
                reader._savePreference('fontSize', value)
            },
            horizontal: false,
        }],

        ['margins', {
            name: 'margins',
            label: __('Page Margins', 'simple-ebook-viewer'),
            type: 'radio',
            items: [
                [_x('Small', 'Margins', 'simple-ebook-viewer'), '4%'],
                [_x('Medium', 'Margins', 'simple-ebook-viewer'), '8%'],
                [_x('Large', 'Margins', 'simple-ebook-viewer'), '12%'],
            ],
            onclick: value => {
                reader.view?.renderer.setAttribute('gap', value)
                reader.view?.renderer.setAttribute('max-block-size', `calc(100% - ${value.slice(0, -1) * 2}%)`)
                reader._savePreference('margins', value)
            },
            horizontal: false,
        }],

        ['positionViewer', {
            name: 'positionViewer',
            label: __('Show position', 'simple-ebook-viewer'),
            type: 'radio',
            items: [
                [__('Slider', 'simple-ebook-viewer'), 'slider'],
                [__('Percentage', 'simple-ebook-viewer'), 'percent'],
                [__('Pages', 'simple-ebook-viewer'), 'pages'],
            ],
            onclick: value => {
                reader._navBar.setAttribute('position-view-type', value)
                reader._savePreference('positionViewer', value)
            },
            horizontal: false,
        }],

        ['textAlign', {
            name: 'textAlign',
            label: __('Text Alignment', 'simple-ebook-viewer'),
            type: 'radio',
            items: [
                [__('Auto', 'simple-ebook-viewer'), 'auto'],
                [_x('Left', 'Text alignment', 'simple-ebook-viewer'), 'left'],
                [_x('Center', 'Text alignment', 'simple-ebook-viewer'), 'center'],
                [_x('Right', 'Text alignment', 'simple-ebook-viewer'), 'right'],
                [_x('Justified', 'Text alignment', 'simple-ebook-viewer'), 'justify'],
            ],
            onclick: value => {
                reader.style.textAlign = value
                reader.view?.renderer.setStyles?.(injectCSS(reader.style))
                reader._savePreference('textAlign', value)
            },
            horizontal: false,
        }],

        ['lineSpacing', {
            name: 'lineSpacing',
            label: __('Line Spacing', 'simple-ebook-viewer'),
            type: 'radio',
            items: [
                [__('Auto', 'simple-ebook-viewer'), 0],
                [_x('Tight', 'Line spacing', 'simple-ebook-viewer'), 1],
                [_x('Normal', 'Line spacing', 'simple-ebook-viewer'), 1.4],
                [_x('Loose', 'Line spacing', 'simple-ebook-viewer'), 2.3],
            ],
            onclick: value => {
                reader.style.spacing = value
                reader.view?.renderer.setStyles?.(injectCSS(reader.style))
                reader._savePreference('lineSpacing', value)
            },
            horizontal: false,
        }],

        ['hyphenation', {
            name: 'hyphenation',
            label: __('Hyphenation', 'simple-ebook-viewer'),
            type: 'radio',
            items: [
                [__('Auto', 'simple-ebook-viewer'), 'auto'],
                [__('Yes', 'simple-ebook-viewer'), 'yes'],
                [__('No', 'simple-ebook-viewer'), 'no'],
            ],
            onclick: value => {
                reader.style.hyphenate = value
                reader.view?.renderer.setStyles?.(injectCSS(reader.style))
                reader._savePreference('hyphenation', value)
            },
            horizontal: false,
        }],

        ['colors', {
            name: 'colors',
            label: __('Colors', 'simple-ebook-viewer'),
            type: 'radio',
            items: [
                [_x('Auto', 'Theme color', 'simple-ebook-viewer'), 'auto'],
                [_x('Sepia', 'Theme color', 'simple-ebook-viewer'), 'simebv-sepia'],
                [_x('Light', 'Theme color', 'simple-ebook-viewer'), 'simebv-light'],
                [_x('Dark', 'Theme color', 'simple-ebook-viewer'), 'simebv-dark'],
                [_x('Light (forced)', 'Theme color', 'simple-ebook-viewer'), 'simebv-light-forced'],
                [_x('Dark (forced)', 'Theme color', 'simple-ebook-viewer'), 'simebv-dark-forced'],
            ],
            onclick: value => {
                switch (value) {
                    case 'simebv-sepia':
                        reader._rootDiv.classList.add(value)
                        reader._rootDiv.classList.remove(
                            'simebv-supports-dark', 'simebv-light', 'simebv-dark'
                        )
                        reader.style.colorScheme = 'only light'
                        reader.style.bgColor = '#f9f1cc'
                        reader.style.forcedColorScheme = ''
                        reader.view?.renderer.setStyles?.(injectCSS(reader.style))
                        break
                    case 'simebv-light':
                        reader._rootDiv.classList.add(value)
                        reader._rootDiv.classList.remove(
                            'simebv-supports-dark', 'simebv-sepia', 'simebv-dark'
                        )
                        reader.style.colorScheme = 'only light'
                        reader.style.bgColor = '#ffffff'
                        reader.style.forcedColorScheme = ''
                        reader.view?.renderer.setStyles?.(injectCSS(reader.style))
                        break
                    case 'simebv-light-forced':
                        reader._rootDiv.classList.add('simebv-light')
                        reader._rootDiv.classList.remove(
                            'simebv-supports-dark', 'simebv-sepia', 'simebv-dark'
                        )
                        reader.style.colorScheme = 'only light'
                        reader.style.bgColor = '#ffffff'
                        reader.style.forcedColorScheme = 'light'
                        reader.view?.renderer.setStyles?.(injectCSS(reader.style))
                        break
                    case 'simebv-dark':
                        reader._rootDiv.classList.add(value)
                        reader._rootDiv.classList.remove(
                            'simebv-supports-dark', 'simebv-sepia', 'simebv-light'
                        )
                        reader.style.colorScheme = 'only dark'
                        reader.style.bgColor = '#090909'
                        reader.style.forcedColorScheme = ''
                        reader.view?.renderer.setStyles?.(injectCSS(reader.style))
                        break
                    case 'simebv-dark-forced':
                        reader._rootDiv.classList.add('simebv-dark')
                        reader._rootDiv.classList.remove(
                            'simebv-supports-dark', 'simebv-sepia', 'simebv-light'
                        )
                        reader.style.colorScheme = 'only dark'
                        reader.style.bgColor = '#090909'
                        reader.style.forcedColorScheme = 'dark'
                        reader.view?.renderer.setStyles?.(injectCSS(reader.style))
                        break
                    case 'auto':
                    default:
                        reader._rootDiv.classList.add('simebv-supports-dark')
                        reader._rootDiv.classList.remove(
                            'simebv-sepia', 'simebv-light', 'simebv-dark'
                        )
                        reader.style.colorScheme = 'light dark'
                        reader.style.bgColor = 'transparent'
                        reader.style.forcedColorScheme = ''
                        reader.view?.renderer.setStyles?.(injectCSS(reader.style))
                }
                reader._savePreference('colors', value)
            },
            horizontal: false,
        }],

        ['fontFamily', {
            name: 'fontFamily',
            label: __('Font style...', 'simple-ebook-viewer'),
            type: 'action',
            onclick: () => reader.openFontsDialog(),
            attrs: [
                ['aria-haspopup', 'dialog'],
            ],
        }],

        ['showAnnotations', {
            name: 'showAnnotations',
            label: __('Show/hide annotations...', 'simple-ebook-viewer'),
            type: 'action',
            onclick: () => reader.openAnnotationsDialog(),
            attrs: [
                ['aria-haspopup', 'dialog'],
            ],
        }],

        ['speechSynthesis', {
            name: 'speechSynthesis',
            label: __('Read aloud...', 'simple-ebook-viewer'),
            type: 'action',
            shortcut: __('Shift+P', 'simple-ebook-viewer'),
            onclick: () => reader._speechManager.open(),
            attrs: [
                ['aria-haspopup', 'dialog'],
            ],
        }],

        ['colorFilter', {
            name: 'colorFilter',
            label: __('Color filter...', 'simple-ebook-viewer'),
            type: 'action',
            onclick: () => reader.openFilterDialog(reader._bookContainer),
            attrs: [
                ['aria-haspopup', 'dialog'],
            ],
        }],

        ['zoom', {
            name: 'zoom',
            label: __('Zoom', 'simple-ebook-viewer'),
            type: 'radio',
            items: [
                [__('Fit page', 'simple-ebook-viewer'), 'fit-page'],
                [__('Fit width', 'simple-ebook-viewer'), 'fit-width'],
                [__('Custom', 'simple-ebook-viewer'), {
                    val: 'custom',
                    type: 'number',
                    attrs: {
                        id: 'simebv-zoom-numeric',
                        max: 400,
                        min: 10,
                        step: 10,
                        value: 100,
                    },
                    events: {
                        onchange: () => {
                            reader.menu.groups.zoom.select('custom')
                        },
                    },
                    suffix: '%',
                    prefix: '',
                    labelID: 'simebv-zoom-label',
                    labelsSmall: [
                        __('Zoom out', 'simple-ebook-viewer'),
                        __('Zoom in', 'simple-ebook-viewer'),
                    ],
                }],
            ],
            onclick: (value) => {
                switch (value) {
                    case 'fit-page':
                    case 'fit-width':
                        reader.view?.renderer?.setAttribute('zoom', value)
                        reader._savePreference('zoom', value)
                        break
                    case 'custom':
                        let val = reader.menu.element.querySelector('#simebv-zoom-numeric').value
                        if (!isNumeric(val) || val < 10 || val > 400 ) {
                            val = 100
                        }
                        reader.view?.renderer?.setAttribute('zoom', val / 100)
                        reader._savePreference('custom-zoom', val)
                        reader._savePreference('zoom', value)
                        break
                    default:
                        if (!isNumeric(value)) {
                            break
                        }
                        value = Number(value)
                        if (value >= 10 && value <= 400) {
                            const inputElem = reader.menu.element.querySelector('#simebv-zoom-numeric')
                            inputElem.value = value
                            inputElem.dispatchEvent(new Event('change'))
                        }
                }
            },
            onvalidate: (value) => {
                return (
                    ['fit-page', 'fit-width', 'custom'].includes(value)
                    || (isNumeric(value) && Number(value) >= 10 && Number(value) <= 400)
                )
            }
        }],
    ])
}


export function getInitialMenuStatusStd() {
    return {
        bothBefore: [
            ['colors', 'auto'],
            ['positionViewer', 'slider'],
            ['maxPages', 2],
        ],
        fixedLayout: [
            ['zoom', 'fit-page'],
            ['oddPages', 'right'],  // this is meant only for pdf and comic-books
            ['pageProgression', 'auto'],
        ],
        reflowable: [
            ['fontSize', 18],
            ['margins', '8%'],
            ['textAlign', 'auto'],
            ['lineSpacing', 0],
            ['hyphenation', 'auto'],
            ['layout', 'paginated'],  // the 'scrolled' layout disables other preferences, so this is at the end
        ],
        bothAfter: [],
    }
}
