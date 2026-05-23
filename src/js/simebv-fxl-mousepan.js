let drag = false
let pos
let renderer

const onMouseDown = e => {
    const el = e.currentTarget.elementFromPoint(e.clientX, e.clientY)
    if (!el || Array.from(el.childNodes)
            .some(node => node.nodeType === Node.TEXT_NODE && node.data.trim().length > 0)) {
        return
    }
    drag = true
    pos = { x: e.screenX, y: e.screenY }
}

const onMouseMove = e => {
    if (drag) {
        const deltaX = pos.x - e.screenX
        const deltaY = pos.y - e.screenY
        renderer.scrollBy(deltaX, deltaY)
        pos = { x: e.screenX, y: e.screenY }
        e.currentTarget.getSelection()?.removeAllRanges()
    }
}

const onMouseUp = e => drag = false

export const setMousePanEvents = renderer_ => {
    renderer = renderer_
    for (const { doc } of renderer.getContents({ onlyVisible: false })) {
        doc.addEventListener('mousedown', onMouseDown)
        doc.addEventListener('mousemove', onMouseMove)
        doc.addEventListener('mouseup', onMouseUp)
        document?.addEventListener('mouseup', onMouseUp)
    }
}
