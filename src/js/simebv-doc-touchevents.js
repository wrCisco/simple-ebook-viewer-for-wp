/**
 * Allow users to select text and to horizontally scroll
 * overflowing elements on touch devices. To do that,
 * intercept the event in the capturing phase and stop
 * its propagation to the paginator or the fixed layout renderer.
 */
const onSelectAndScroll = doc => {
    let hScrolling = false
    let selectionExistedAtStart = false
    doc.addEventListener('touchstart', e => {
        let elem
        const touch = e.changedTouches[0]
        for (const el of doc.elementsFromPoint(touch.clientX, touch.clientY)) {
            if (el === doc.body) {
                break
            }
            if (el.scrollWidth && el.scrollWidth > el.clientWidth) {
                const before = el.scrollLeft
                el.scrollLeft += 1
                if (el.scrollLeft === before) {
                    el.scrollLeft -= 1
                }
                if (el.scrollLeft !== before) {
                    el.scrollLeft = before
                    elem = el
                    break
                }
            }
        }
        if (elem) {
            hScrolling = elem
        }
        const sel = doc.getSelection()
        selectionExistedAtStart = sel && !sel.isCollapsed
        if (hScrolling || selectionExistedAtStart) {
            e.stopPropagation()
        }
    }, {capture: true})
    doc.addEventListener('touchmove', e => {
        if (hScrolling && e.touches.length === 1) {
            e.stopPropagation()
        }
        const sel = doc.getSelection()
        if (selectionExistedAtStart || (sel && !sel.isCollapsed)) {
            e.stopPropagation()
        }
    }, {capture: true})
    doc.addEventListener('touchend', e => {
        const sel = doc.getSelection()
        if (hScrolling || selectionExistedAtStart || (sel && !sel.isCollapsed)) {
            e.stopPropagation()
        }
        hScrolling = false
        selectionExistedAtStart = false
    }, {capture: true})
}

/**
 * Make hidden bars appear after a tap on touch devices
 * (actually, this is demanded to the reader: this function
 * only dispatches the CustomEvent 'tap-on-document'
 * to reader.container)
 */
const onTap = (doc, reader) => {
    const tap = {}
    doc.addEventListener('touchstart', e => {
        if (e.touches.length > 1) {
            tap.pos = undefined
            tap.time = undefined
            return
        }
        const touch = e.touches[0]
        tap.pos = { x: touch.screenX, y: touch.screenY }
        tap.time = performance.now()
    })
    doc.addEventListener('touchend', e => {
        if (e.touches.length === 0
                && tap.pos
                && performance.now() - tap.time < 1000) {
            const touch = e.changedTouches[0]
            if (Math.abs(tap.pos.x - touch.screenX) < 10
                    && Math.abs(tap.pos.y - touch.screenY) < 10) {
                reader.container.dispatchEvent(new CustomEvent('tap-on-document'))
            }
        }
        tap.pos = undefined
        tap.time = undefined
    })
}

/**
 * Turn pages by swiping left or right. This is only meant for
 * fixed layout: it's already implemented by foliate-js in the paginator.
 */
const onSwipe = (doc, reader) => {
    const renderer = reader.view.renderer
    const swipe = {}
    doc.addEventListener('touchstart', e => {
        if (renderer.scrollWidth - renderer.clientWidth > 0) return
        const touch = e.changedTouches[0]
        swipe.id = touch.identifier
        swipe.pos = { client: touch.clientX, screen: touch.screenX }
    })
    doc.addEventListener('touchend', e => {
        if (swipe.pos) {
            let touch
            for (const t of Array.from(e.changedTouches)) {
                if (t.identifier === swipe.id) {
                    touch = t
                    break
                }
            }
            if (touch && Math.abs(swipe.pos.client - touch.clientX) > 10) {
                const delta = swipe.pos.screen - touch.screenX
                if (delta > 100) reader.view.goRight()
                else if (delta < -100) reader.view.goLeft()
            }
        }
        swipe.id = undefined
        swipe.pos = undefined
    })
}

export const setTouchEvents = (doc, reader) => {
    onSelectAndScroll(doc)
    onTap(doc, reader)
    if (reader.view.isFixedLayout) {
        onSwipe(doc, reader)
    }
}
