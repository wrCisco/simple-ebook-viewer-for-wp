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
    // The union of the rects: where they overlap or touch, there are neither darker areas,
    // nor antialiasing lines, nor areas inverted twice by two backdrop filters
    const outlines = rectsUnionOutlines(rects)
    if (!outlines.length) return g
    const el = document.createElementNS(NS.SVG, 'path')
    el.setAttribute('d', outlinesToPath(outlines))
    g.append(el)
    if (invert) {
        // A single element with the backdrop filter, clipped to the union. Non-overlapping
        // tiles are the fallback: they leave visible seams where they touch, when their
        // sides aren't aligned to device pixels (e.g. when the overlayer is scaled).
        const foreignRect = (left, top, width, height, clipPath) => {
            const foreign = document.createElementNS(NS.SVG, 'foreignObject')
            foreign.setAttribute('x', left)
            foreign.setAttribute('y', top)
            foreign.setAttribute('width', width)
            foreign.setAttribute('height', height)
            const foreignDiv = document.createElementNS(NS.XHTML, 'div')
            foreignDiv.style.cssText = `width:${width}px;height:${height}px;backdrop-filter:invert(1) hue-rotate(180deg);`
            if (clipPath) foreignDiv.style.clipPath = clipPath
            foreign.append(foreignDiv)
            g.append(foreign)
        }
        if (supportsClipPathPath()) {
            const { left, top, width, height } = outlinesBounds(outlines)
            foreignRect(left, top, width, height,
                `path('${outlinesToPath(outlines, { dx: -left, dy: -top })}')`)
        }
        else for (const { left, top, width, height } of rectsUnionTiles(rects)) {
            foreignRect(left, top, width, height)
        }
    }
    return g
}

let clipPathPathSupport
function supportsClipPathPath() {
    clipPathPathSupport ??= globalThis.CSS?.supports?.('clip-path', "path('M0 0H1V1Z')") ?? false
    console.log('supports clip path?', clipPathPathSupport)
    return clipPathPathSupport
}

export function currentSearchOutline(rects, options = {}) {
    const { color = 'red', width: strokeWidth = 3, radius = 3, opacity = 1 } = options
    const g = document.createElementNS(NS.SVG, 'g')
    g.setAttribute('fill', 'none')
    g.setAttribute('stroke', color)
    g.setAttribute('stroke-width', strokeWidth)
    g.style.opacity = opacity
    // the outline of the union of the rects, without the sides of a rect inside another one
    const d = rectsUnionPath(rects, { radius })
    if (d) {
        const el = document.createElementNS(NS.SVG, 'path')
        el.setAttribute('d', d)
        g.append(el)
    }
    return g
}

/*
 * Union of rectangles
 *
 * The rects are placed on a grid made by all their distinct x and y coordinates: a cell
 * of the grid is covered if it's inside at least one rect, so the covered cells are
 * exactly the union of the rects, however they overlap. The outline of the union and
 * a tiling of it are then computed from the grid.
 * Coordinates closer than `epsilon` are merged, so that rounding errors of the layout
 * don't leave slivers between rects that touch, or steps where their edges are aligned.
 */

function coverageGrid(rects, epsilon = 0.01) {
    const boxes = []
    for (const { left, top, width, height } of rects ?? []) {
        // also excludes NaN
        if (width > 0 && height > 0) boxes.push([left, top, left + width, top + height])
    }
    if (!boxes.length) return null
    const [xs, xIndex] = snapCoords(boxes, 0, 2, epsilon)
    const [ys, yIndex] = snapCoords(boxes, 1, 3, epsilon)
    const nx = xs.length - 1
    const ny = ys.length - 1
    const cells = new Uint8Array(nx * ny)
    for (const [left, top, right, bottom] of boxes) {
        const i0 = xIndex.get(left), i1 = xIndex.get(right)
        for (let j = yIndex.get(top); j < yIndex.get(bottom); j++) {
            cells.fill(1, j * nx + i0, j * nx + i1)
        }
    }
    return { xs, ys, nx, ny, cells }
}

// Sorted distinct values of the coordinates a and b of the boxes, where each cluster
// of values not wider than epsilon becomes its first value, and the map from
// the original values to their indices in the sorted array
function snapCoords(boxes, a, b, epsilon) {
    const values = boxes.flatMap(box => [box[a], box[b]]).sort((m, n) => m - n)
    const coords = []
    const index = new Map()
    for (const v of values) {
        if (!coords.length || v - coords[coords.length - 1] > epsilon) coords.push(v)
        index.set(v, coords.length - 1)
    }
    return [coords, index]
}

// Directions: 0 → +x, 1 → +y, 2 → -x, 3 → -y. The y axis points down, so turning
// from d to d + 1 is a clockwise turn (a right turn for whoever walks along the path).
function gridOutlines({ xs, ys, nx, ny, cells }) {
    const vx = nx + 1  // vertices in a row of the grid
    const covered = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && cells[j * nx + i] === 1
    // edges[v * 4 + d] is 1 if an edge of the outline leaves the vertex v in the direction d.
    // The edges have the union on their right, so outer outlines are clockwise and holes
    // counter-clockwise: the path is filled correctly with both fill rules.
    const edges = new Uint8Array(vx * (ny + 1) * 4)
    for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
            if (!covered(i, j)) continue
            const v = j * vx + i  // top left corner of the cell
            if (!covered(i, j - 1)) edges[v * 4] = 1                // top side, left to right
            if (!covered(i + 1, j)) edges[(v + 1) * 4 + 1] = 1      // right side, top to bottom
            if (!covered(i, j + 1)) edges[(v + vx + 1) * 4 + 2] = 1 // bottom side, right to left
            if (!covered(i - 1, j)) edges[(v + vx) * 4 + 3] = 1     // left side, bottom to top
        }
    }
    const step = [1, vx, -1, -vx]
    const outlines = []
    for (let start = 0; start < edges.length; start++) {
        if (edges[start] !== 1) continue
        const corners = []
        let e = start
        do {
            edges[e] = 2
            const d = e & 3
            const v = (e >> 2) + step[d]
            // Two edges leave a vertex only where two cells touch at their corners and
            // the other two cells around it are empty: turning right separates the outlines
            // of the two cells. Each arriving edge has its own leaving edge, so the walk
            // always gets back to the start.
            let next = v * 4 + ((d + 1) & 3)
            if (!edges[next]) next = v * 4 + d
            if (!edges[next]) next = v * 4 + ((d + 3) & 3)
            if ((next & 3) !== d) corners.push({ x: xs[v % vx], y: ys[Math.floor(v / vx)] })
            e = next
        } while (e !== start)
        outlines.push(corners)
    }
    return outlines
}

// Partition of the covered cells in rectangles: runs of cells in a row (or in a column,
// if `columns` is true) are merged with the identical runs of the next rows (columns)
function gridTiles({ xs, ys, nx, ny, cells }, columns = false) {
    const [nOuter, nInner] = columns ? [nx, ny] : [ny, nx]
    const isCovered = columns ? (o, i) => cells[i * nx + o] : (o, i) => cells[o * nx + i]
    const tiles = []
    let open = new Map()
    for (let o = 0; o <= nOuter; o++) {
        const next = new Map()
        for (let i = 0; o < nOuter && i < nInner; i++) {
            if (!isCovered(o, i)) continue
            const i0 = i
            while (i + 1 < nInner && isCovered(o, i + 1)) i++
            const key = i0 * nInner + i
            const tile = open.get(key) ?? { i0, i1: i + 1, o0: o }
            open.delete(key)
            tile.o1 = o + 1
            next.set(key, tile)
        }
        tiles.push(...open.values())
        open = next
    }
    return tiles.map(({ i0, i1, o0, o1 }) => {
        const [x0, x1, y0, y1] = columns ? [xs[o0], xs[o1], ys[i0], ys[i1]] : [xs[i0], xs[i1], ys[o0], ys[o1]]
        return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 }
    })
}

// Outlines of the union of the rects: an array of closed polygons, each one an array
// of its corners ({ x, y }). Outer outlines are clockwise, holes counter-clockwise.
export function rectsUnionOutlines(rects, { epsilon } = {}) {
    const grid = coverageGrid(rects, epsilon)
    return grid ? gridOutlines(grid) : []
}

// SVG path data (also valid for CSS path()) of the outline of the union of the rects,
// with the corners rounded by `radius` and translated by (dx, dy)
export function rectsUnionPath(rects, { radius = 0, dx = 0, dy = 0, epsilon } = {}) {
    return outlinesToPath(rectsUnionOutlines(rects, { epsilon }), { radius, dx, dy })
}

function outlinesToPath(outlines, { radius = 0, dx = 0, dy = 0 } = {}) {
    let d = ''
    for (const corners of outlines) {
        const n = corners.length
        if (radius <= 0) {
            d += 'M' + corners.map(({ x, y }) => `${x + dx} ${y + dy}`).join('L') + 'Z'
            continue
        }
        // each corner is replaced by an arc, from its incoming edge to its outgoing edge,
        // whose radius is at most half of the shorter of the two edges
        const arcs = corners.map(({ x, y }, k) => {
            const prev = corners[(k + n - 1) % n]
            const next = corners[(k + 1) % n]
            const inX = Math.sign(x - prev.x), inY = Math.sign(y - prev.y)
            const outX = Math.sign(next.x - x), outY = Math.sign(next.y - y)
            const r = Math.min(radius,
                (Math.abs(x - prev.x) + Math.abs(y - prev.y)) / 2,
                (Math.abs(next.x - x) + Math.abs(next.y - y)) / 2)
            const sweep = inX * outY - inY * outX > 0 ? 1 : 0
            return { r, sweep,
                from: `${x + dx - r * inX} ${y + dy - r * inY}`,
                to: `${x + dx + r * outX} ${y + dy + r * outY}` }
        })
        d += `M${arcs[n - 1].to}`
        for (const { r, sweep, from, to } of arcs) {
            d += `L${from}A${r} ${r} 0 0 ${sweep} ${to}`
        }
        d += 'Z'
    }
    return d
}

function outlinesBounds(outlines) {
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
    for (const corners of outlines) {
        for (const { x, y } of corners) {
            left = Math.min(left, x)
            top = Math.min(top, y)
            right = Math.max(right, x)
            bottom = Math.max(bottom, y)
        }
    }
    return { left, top, width: right - left, height: bottom - top }
}

// Non-overlapping rectangles ({ left, top, width, height }) whose union is the union
// of the rects. Rows of cells are merged, or columns if they give fewer rectangles
// (e.g. for vertical writing modes).
export function rectsUnionTiles(rects, { epsilon } = {}) {
    const grid = coverageGrid(rects, epsilon)
    if (!grid) return []
    const rows = gridTiles(grid)
    if (rows.length === 1) return rows
    const columns = gridTiles(grid, true)
    return columns.length < rows.length ? columns : rows
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
