const INTERACTIVE = 'a, button, input, textarea, select, [contenteditable], [draggable="true"]'

const isPointOverText = (el, x, y) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    const range = document.createRange()
    let node
    while ((node = walker.nextNode())) {
        if (!node.data.trim()) continue
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
            if (x >= rect.left - 10 && x <= rect.right + 10 &&
                    y >= rect.top - 5 && y <= rect.bottom + 5) {
                return true
            }
        }
    }
}

const pressAction = (el, x, y) => {
    if (el.closest(INTERACTIVE)) return 'native'
    if (isPointOverText(el, x, y)) return 'select'
    return 'pan'
}

const cursorFor = { pan: 'grab', select: 'text', native: '' }

const setCursor = (doc, cursor) => {
    if (doc.body && doc.body.style.cursor !== cursor) doc.body.style.cursor = cursor
}

const panningSheets = new WeakMap()

const setPanningCursor = (doc, on) => {
    let sheet = panningSheets.get(doc)
    if (!sheet) {
        if (!on) return
        sheet = new doc.defaultView.CSSStyleSheet()
        sheet.replaceSync('* { cursor: grabbing !important; }')
        doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet]
        panningSheets.set(doc, sheet)
    }
    sheet.disabled = !on
}

export class MousePanManager {
    #renderer
    #drag = false
    #pos
    #pendingHover = null
    #pannableDocs = new WeakSet()

    constructor(renderer) {
        this.#renderer = renderer
    }

    reset(renderer) {
        this.#renderer = renderer
        this.#drag = false
        this.#pos = undefined
        this.#pendingHover = null
        this.#pannableDocs = new WeakSet()
    }

    refreshCursor(doc, el, x, y) {
        if (this.#pannableDocs.has(doc)) {
            setCursor(doc, cursorFor[pressAction(el, x, y)])
        }
    }

    setPannable(doc, pannable) {
        if (pannable) this.#pannableDocs.add(doc)
        else this.#pannableDocs.delete(doc)
        setCursor(doc, pannable ? 'grab' : '')
    }

    onMouseDown = e => {
        if (e.button !== 0) return
        const el = e.target
        if (pressAction(el, e.clientX, e.clientY) !== 'pan') return
        this.#drag = true
        this.#pos = { x: e.screenX, y: e.screenY }
        if (this.#pannableDocs.has(e.currentTarget)) setPanningCursor(e.currentTarget, true)
    }

    onMouseMove = e => {
        if (this.#drag) {
            // in case of a release outside the window or while a menu is open
            if (!(e.buttons & 1)) return this.onMouseUp(e)
            const deltaX = this.#pos.x - e.screenX
            const deltaY = this.#pos.y - e.screenY
            this.#renderer.scrollBy(deltaX, deltaY)
            this.#pos = { x: e.screenX, y: e.screenY }
            e.currentTarget.getSelection()?.removeAllRanges()
            return
        }
        if (e.buttons || !this.#pannableDocs.has(e.currentTarget)) return
        if (!this.#pendingHover) {
            requestAnimationFrame(() => {
                if (!this.#pendingHover) return  // guard for race condition with reset
                const { doc, el, x, y } = this.#pendingHover
                this.#pendingHover = null
                if (!this.#drag) this.refreshCursor(doc, el, x, y)
            })
        }
        this.#pendingHover = {
            doc: e.currentTarget, el: e.target, x: e.clientX, y: e.clientY
        }
    }

    onMouseUp = e => {
        const doc = e.currentTarget
        this.#drag = false
        setPanningCursor(doc, false)
        const el = doc.elementFromPoint(e.clientX, e.clientY) ?? e.target
        this.refreshCursor(doc, el, e.clientX, e.clientY)
    }

    onDragStart = e => {
        // Avoid that automatic drag events (on images, selections...) disrupt the panning
        if (!e.target.closest('[draggable="true"]')) {
            e.preventDefault()
        }
    }

    setEvents() {
        for (const { doc } of this.#renderer.getContents({ onlyVisible: false })) {
            doc.addEventListener('mousedown', this.onMouseDown)
            doc.addEventListener('mousemove', this.onMouseMove)
            doc.addEventListener('mouseup', this.onMouseUp)
            doc.addEventListener('dragstart', this.onDragStart)
        }
    }

}
