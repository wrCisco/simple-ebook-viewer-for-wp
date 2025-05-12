import '../css/simebv-viewer.css';

import '../../vendor/foliate-js/view.js'
import { createTOCView } from '../../vendor/foliate-js/ui/tree.js'
import { createMenu } from '../../vendor/foliate-js/ui/menu.js'
import { Overlayer } from '../../vendor/foliate-js/overlayer.js'

const getCSS = ({ spacing, justify, hyphenate }) => `
    @namespace epub "http://www.idpf.org/2007/ops";
    html {
        color-scheme: light dark;
    }
    /* https://github.com/whatwg/html/issues/5426 */
    @media (prefers-color-scheme: dark) {
        a:link {
            color: lightblue;
        }
    }
    p, li, blockquote, dd {
        line-height: ${spacing};
        text-align: ${justify ? 'justify' : 'start'};
        -webkit-hyphens: ${hyphenate ? 'auto' : 'manual'};
        hyphens: ${hyphenate ? 'auto' : 'manual'};
        -webkit-hyphenate-limit-before: 3;
        -webkit-hyphenate-limit-after: 2;
        -webkit-hyphenate-limit-lines: 2;
        hanging-punctuation: allow-end last;
        widows: 2;
    }
    /* prevent the above from overriding the align attribute */
    [align="left"] { text-align: left; }
    [align="right"] { text-align: right; }
    [align="center"] { text-align: center; }
    [align="justify"] { text-align: justify; }

    pre {
        white-space: pre-wrap !important;
    }
    aside[epub|type~="endnote"],
    aside[epub|type~="footnote"],
    aside[epub|type~="note"],
    aside[epub|type~="rearnote"] {
        display: none;
    }
`

const $ = document.querySelector.bind(document)

const locales = 'en'
const percentFormat = new Intl.NumberFormat(locales, { style: 'percent' })
const listFormat = new Intl.ListFormat(locales, { style: 'short', type: 'conjunction' })

const formatLanguageMap = x => {
    if (!x) return ''
    if (typeof x === 'string') return x
    const keys = Object.keys(x)
    return x[keys[0]]
}

const formatOneContributor = contributor => typeof contributor === 'string'
    ? contributor : formatLanguageMap(contributor?.name)

const formatContributor = contributor => Array.isArray(contributor)
    ? listFormat.format(contributor.map(formatOneContributor))
    : formatOneContributor(contributor)

class Reader {
    #tocView
    style = {
        spacing: 1.4,
        justify: true,
        hyphenate: true,
    }
    annotations = new Map()
    annotationsByValue = new Map()
    container = document.body
    closeSideBar() {
        $('#simebv-dimming-overlay').classList.remove('simebv-show')
        $('#simebv-side-bar').classList.remove('simebv-show')
        this.container.focus()
    }
    constructor(container) {
        $('#simebv-side-bar-button').addEventListener('click', () => {
            $('#simebv-side-bar').style.display = null;
            setTimeout(() => {
                $('#simebv-dimming-overlay').classList.add('simebv-show')
                $('#simebv-side-bar').classList.add('simebv-show')
            }, 20)
        })
        $('#simebv-dimming-overlay').addEventListener('click', () => this.closeSideBar())

        const menu = createMenu([
            {
                name: 'layout',
                label: 'Layout',
                type: 'radio',
                items: [
                    ['Paginated', 'paginated'],
                    ['Scrolled', 'scrolled'],
                ],
                onclick: value => {
                    this.view?.renderer.setAttribute('flow', value)
                },
            },
        ])
        menu.element.classList.add('simebv-menu')

        $('#simebv-menu-button').append(menu.element)
        $('#simebv-menu-button > button').addEventListener('click', () =>
            menu.element.classList.toggle('simebv-show'))
        menu.groups.layout.select('paginated')
        if (container) {
            this.container = container
        }
        $('#full-screen-button').addEventListener('click', this.#toggleFullViewport.bind(this))
    }
    async open(file) {
        this.view = document.createElement('foliate-view')
        this.container.append(this.view)
        await this.view.open(file)
        this.view.addEventListener('load', this.#onLoad.bind(this))
        this.view.addEventListener('relocate', this.#onRelocate.bind(this))

        const { book } = this.view
        book.transformTarget?.addEventListener('data', ({ detail }) => {
            detail.data = Promise.resolve(detail.data).catch(e => {
                console.error(new Error(`Failed to load ${detail.name}`, { cause: e }))
                return ''
            })
        })
        this.view.renderer.setStyles?.(getCSS(this.style))
        this.view.renderer.next()

        $('#simebv-header-bar').style.visibility = 'visible'
        $('#simebv-nav-bar').style.visibility = 'visible'
        $('#simebv-left-button').addEventListener('click', () => this.view.goLeft())
        $('#simebv-right-button').addEventListener('click', () => this.view.goRight())

        const slider = $('#simebv-progress-slider')
        slider.dir = book.dir
        slider.addEventListener('input', e =>
            this.view.goToFraction(parseFloat(e.target.value)))
        for (const fraction of this.view.getSectionFractions()) {
            const option = document.createElement('option')
            option.value = fraction
            $('#simebv-tick-marks').append(option)
        }

        this.container.addEventListener('keydown', this.#handleKeydown.bind(this))

        const title = formatLanguageMap(book.metadata?.title) || 'Untitled Book'
        document.title = title
        $('#simebv-book-header').innerText = title
        $('#simebv-side-bar-title').innerText = title
        $('#simebv-side-bar-author').innerText = formatContributor(book.metadata?.author)
        Promise.resolve(book.getCover?.())?.then(blob =>
            blob ? $('#simebv-side-bar-cover').src = URL.createObjectURL(blob) : null)

        const toc = book.toc
        if (toc) {
            this.#tocView = createTOCView(toc, href => {
                this.view.goTo(href).catch(e => console.error(e))
                this.closeSideBar()
            })
            $('#simebv-toc-view').append(this.#tocView.element)
        }

        // load and show highlights embedded in the file by Calibre
        const bookmarks = await book.getCalibreBookmarks?.()
        if (bookmarks) {
            const { fromCalibreHighlight } = await import('../../vendor/foliate-js/epubcfi.js')
            for (const obj of bookmarks) {
                if (obj.type === 'highlight') {
                    const value = fromCalibreHighlight(obj)
                    const color = obj.style.which
                    const note = obj.notes
                    const annotation = { value, color, note }
                    const list = this.annotations.get(obj.spine_index)
                    if (list) list.push(annotation)
                    else this.annotations.set(obj.spine_index, [annotation])
                    this.annotationsByValue.set(value, annotation)
                }
            }
            this.view.addEventListener('create-overlay', e => {
                const { index } = e.detail
                const list = this.annotations.get(index)
                if (list) for (const annotation of list)
                    this.view.addAnnotation(annotation)
            })
            this.view.addEventListener('draw-annotation', e => {
                const { draw, annotation } = e.detail
                const { color } = annotation
                draw(Overlayer.highlight, { color })
            })
            this.view.addEventListener('show-annotation', e => {
                const annotation = this.annotationsByValue.get(e.detail.value)
                if (annotation.note) alert(annotation.note)
            })
        }
    }

    #toggleFullScreen() {
        if (this.view && this.view.requestFullscreen) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
            else {
                this.view.requestFullscreen();
            }
        }
    }

    #toggleFullViewport() {
        if (this.container) {
            this.container.classList.toggle('simebv-view-fullscreen');
        }
    }

    #handleKeydown(e) {
        const k = e.key
        switch (k) {
            case 'ArrowLeft':
            case 'h':
                this.view.goLeft()
                break;
            case 'ArrowRight':
            case 'l':
                this.view.goRight()
                break;
            case 'Escape':
                if (this.container.classList.contains('simebv-view-fullscreen')) {
                    this.container.classList.remove('simebv-view-fullscreen')
                }
                break;
        }
    }
    #onLoad({ detail: { doc } }) {
        const loadingOverlay = document.getElementById('simebv-loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('simebv-show');
        }
        doc.addEventListener('keydown', this.#handleKeydown.bind(this))
    }
    #onRelocate({ detail }) {
        const { fraction, location, tocItem, pageItem } = detail
        const percent = percentFormat.format(fraction)
        const loc = pageItem
            ? `Page ${pageItem.label}`
            : `Loc ${location.current}`
        const slider = $('#simebv-progress-slider')
        slider.style.visibility = 'visible'
        slider.value = fraction
        slider.title = `${percent} · ${loc}`
        const writtenPercent = $('#simebv-progress-percent')
        writtenPercent.innerText = percent
        if (tocItem?.href) this.#tocView?.setCurrentHref?.(tocItem.href)
    }
}

const open = async file => {
    const container = document.getElementById('simebv-reader-container') ?? document.body
    const reader = new Reader(container)
    globalThis.reader = reader
    await reader.open(file)
}

const dragOverHandler = e => e.preventDefault()
const dropHandler = e => {
    e.preventDefault()
    const item = Array.from(e.dataTransfer.items)
        .find(item => item.kind === 'file')
    if (item) {
        const entry = item.webkitGetAsEntry()
        open(entry.isFile ? item.getAsFile() : entry).catch(e => console.error(e))
    }
}

const ebook_path_el = document.getElementById('simebv-reader-container');
if (ebook_path_el) {
    const ebook_path = ebook_path_el.getAttribute('data-ebook-path');
    if (ebook_path) {
        let url;
        try {
            url = new URL(ebook_path);
        }
        catch (e) {
            url = new URL(window.location.href).origin + '/' + ebook_path.replace(/^\//, '');
        }
        open(url.href).catch(e => console.error(e));
    }
}