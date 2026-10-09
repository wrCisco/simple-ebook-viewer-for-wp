const NS = {
    SVG: 'http://www.w3.org/2000/svg',
    XHTML: 'http://www.w3.org/1999/xhtml'
}

export function pageListOutline(rects, options = {}) {
    const { color = 'red', width: strokeWidth = 2, radius = 3, label = '', fontSize = 16 } = options
    const g = document.createElementNS(NS.SVG, 'g')
    g.setAttribute('fill', 'none')
    g.setAttribute('stroke', color)
    g.setAttribute('stroke-width', strokeWidth)
    let rect
    for (let i = 0; i < rects.length; i++) {
        if (rects[i].height) {
            rect = rects[i]
            break
        }
    }
    if (rect) {
        const { left, top, height, width } = rect
        const pathHeight = Math.min(height, fontSize * 1.7)
        const el = document.createElementNS(NS.SVG, 'path')
        el.setAttribute('d', `M ${Math.max(0, left - 1)},${top + pathHeight} v ${-pathHeight}`)// l 6 -3`)
        el.style.opacity = 'var(--overlayer-outline-opacity, .8)'
        el.style.mixBlendMode = 'var(--overlayer-outline-blend-mode, normal)'
        g.append(el)
        g.onclick = () => {}  // for single tap opening on iOS
    }
    return g
}

export function pageBookmarkHighlight(rects, options = {}) {
    const { color = 'red', fontSize = 16 } = options
    const g = document.createElementNS(NS.SVG, 'g')
    g.setAttribute('fill', color)
    g.style.opacity = 'var(--overlayer-highlight-opacity, .4)'
    g.style.mixBlendMode = 'var(--overlayer-highlight-blend-mode, normal)'
    let rect
    for (let i = 0; i < rects.length; i++) {
        if (rects[i].height) {
            rect = rects[i]
            break
        }
    }
    if (rect) {
        const { left, right, top, bottom, height, width } = rect
        const pathLength = Math.min(height, fontSize * 1.7)
        const el = document.createElementNS(NS.SVG, 'rect')
        el.setAttribute('x', left)
        el.setAttribute('y', top)
        el.setAttribute('height', pathLength)
        el.setAttribute('width', pathLength * 0.8)
        g.append(el)
        g.onclick = () => {}  // for single tap opening on iOS
    }
    return g
}

export function pageBookmarkOutline(rects, options = {}) {
    const { color = 'red', width: strokeWidth = 2, fontSize = 16 } = options
    const g = document.createElementNS(NS.SVG, 'g')
    g.setAttribute('fill', 'none')
    g.setAttribute('stroke', color)
    g.setAttribute('stroke-width', strokeWidth)
    g.style.opacity = 'var(--overlayer-outline-opacity, .6)'
    const block = strokeWidth * 1.5
    let rect
    for (let i = 0; i < rects.length; i++) {
        if (rects[i].height) {
            rect = rects[i]
            break
        }
    }
    if (rect) {
        const { left, right, top, bottom, height, width } = rect
        const pathLength = Math.min(height, fontSize * 1.7)
        const el = document.createElementNS(NS.SVG, 'path')
        const n = Math.round(pathLength / block / 1.5)
        const inline = pathLength / n
        const ls = Array.from({ length: n },
            (_, i) => `l${i % 2 ? -block : block} ${inline}`).join('')
        el.setAttribute('d', `M${left} ${top}${ls}`)
        g.append(el)
        g.onclick = () => {}  // for single tap opening on iOS
    }
    return g
}

export function searchResultsHighlight(rects, options = {}) {
    const { color = 'red', opacity = .3, mixBlendMode = 'normal', invert = false } = options
    const g = document.createElementNS(NS.SVG, 'g')
    g.setAttribute('fill', color)
    g.style.opacity = opacity
    g.style.mixBlendMode = mixBlendMode
    const foreigns = []
    for (const { left, top, height, width } of rects) {
        const el = document.createElementNS(NS.SVG, 'rect')
        el.setAttribute('x', left)
        el.setAttribute('y', top)
        el.setAttribute('height', height)
        el.setAttribute('width', width)
        if (invert) {
            const foreign = document.createElementNS(NS.SVG, 'foreignObject')
            foreign.setAttribute('x', left)
            foreign.setAttribute('y', top)
            foreign.setAttribute('width', width)
            foreign.setAttribute('height', height)
            const foreignDiv = document.createElementNS(NS.XHTML, 'div')
            foreignDiv.style.cssText=`width:${width}px;height:${height}px;backdrop-filter:invert(1) hue-rotate(180deg);`
            foreign.append(foreignDiv)
            foreigns.push(foreign)
        }
        g.append(el)
    }
    foreigns.forEach(f => g.append(f))
    return g
}

export function currentSearchOutline(rects, options = {}) {
    const { color = 'red', width: strokeWidth = 3, radius = 3, opacity = 1 } = options
    const g = document.createElementNS(NS.SVG, 'g')
    g.setAttribute('fill', 'none')
    g.setAttribute('stroke', color)
    g.setAttribute('stroke-width', strokeWidth)
    g.style.opacity = opacity
    for (const { left, top, height, width } of rects) {
        const el = document.createElementNS(NS.SVG, 'rect')
        el.setAttribute('x', left)
        el.setAttribute('y', top)
        el.setAttribute('height', height)
        el.setAttribute('width', width)
        el.setAttribute('rx', radius)
        g.append(el)
    }
    return g
}

export function thinRectHitTester(obj, {x, y}) {
    if (!obj.rects?.length) return
    let rect
    for (let j = 0; j < obj.rects.length; j++) {
        if (obj.rects[j].height) {
            rect = obj.rects[j]
            break
        }
    }
    if (!rect) rect = obj.rects[0]
    let { left, top, right, bottom, width, height } = rect
    const offsetH = 10
    const offsetV = 10
    if (top - offsetV <= y && left - offsetH <= x && top + offsetV * 3 > y && left + offsetH * 3 > x) {
        return obj.range
    }
}
