let drag = false
let pos
let renderer

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

const onMouseDown = e => {
    const el = e.target
    // Let the user select text or interact with interactive elements
    if (isPointOverText(el, e.clientX, e.clientY)
            || el.closest('a, button, input, textarea, select, [contenteditable], [draggable="true"]')) {
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

const onMouseUp = e => {
    drag = false
}

const onDragStart = e => {
    // Avoid that automatic drag events (on images, selections...) disrupt the panning
    if (!e.target.closest('[draggable="true"]')) {
        e.preventDefault()
    }
}

export const setMousePanEvents = renderer_ => {
    renderer = renderer_
    for (const { doc } of renderer.getContents({ onlyVisible: false })) {
        doc.addEventListener('mousedown', onMouseDown)
        doc.addEventListener('mousemove', onMouseMove)
        doc.addEventListener('mouseup', onMouseUp)
        doc.addEventListener('dragstart', onDragStart)
    }
}
