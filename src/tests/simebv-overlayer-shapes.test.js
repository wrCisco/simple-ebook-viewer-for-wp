import { expect, test, describe } from 'vitest'
import {
    rectsUnionOutlines, rectsUnionPath, rectsUnionTiles, searchResultsHighlight, currentSearchOutline
} from '../js/simebv-overlayer-shapes.js'

const SVG_NS = 'http://www.w3.org/2000/svg'

// deterministic pseudo-random rects with small integer coordinates, to have many
// coincident sides, overlaps, holes and cells touching only at a corner
function randomRects(seed, count) {
    let s = seed
    const rnd = n => Math.floor((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648 * n)
    return Array.from({ length: count }, () => ({ left: rnd(12), top: rnd(12), width: rnd(7), height: rnd(7) }))
}

const isInside = (r, x, y) => r.width > 0 && r.height > 0
    && r.left < x && x < r.left + r.width && r.top < y && y < r.top + r.height
const inUnion = (rects, x, y) => rects.some(r => isInside(r, x, y))

// area of the union computed without the code under test
function unionArea(rects) {
    const rs = rects.filter(r => r.width > 0 && r.height > 0)
    const xs = [...new Set(rs.flatMap(r => [r.left, r.left + r.width]))].sort((a, b) => a - b)
    const ys = [...new Set(rs.flatMap(r => [r.top, r.top + r.height]))].sort((a, b) => a - b)
    let area = 0
    for (let i = 0; i + 1 < xs.length; i++) {
        for (let j = 0; j + 1 < ys.length; j++) {
            if (inUnion(rs, (xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2)) {
                area += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j])
            }
        }
    }
    return area
}

// signed area, positive for clockwise polygons (the y axis points down)
const signedArea = corners => corners.reduce((sum, p, k) => {
    const q = corners[(k + 1) % corners.length]
    return sum + p.x * q.y - q.x * p.y
}, 0) / 2

const cases = Array.from({ length: 300 }, (_, k) => randomRects(k + 1, 1 + k % 8))

describe('Outlines of the union of rects (unit test for rectsUnionOutlines)', () => {
    test('the outlines enclose the area of the union', () => {
        for (const rects of cases) {
            const area = rectsUnionOutlines(rects).reduce((sum, o) => sum + signedArea(o), 0)
            expect(area).toBeCloseTo(unionArea(rects), 9)
        }
    })
    test('the outlines have the union on the right of each side, and only corners where they turn', () => {
        for (const rects of cases) {
            for (const corners of rectsUnionOutlines(rects)) {
                corners.forEach((a, k) => {
                    const b = corners[(k + 1) % corners.length]
                    const c = corners[(k + 2) % corners.length]
                    expect(a.x === b.x || a.y === b.y).toBe(true)  // horizontal or vertical
                    expect((a.x === b.x) !== (b.x === c.x)).toBe(true)  // b is a turn
                    // a point near the side, not at its middle, which can be on a side of a rect
                    const x = a.x + (b.x - a.x) * .37, y = a.y + (b.y - a.y) * .37
                    const dx = Math.sign(b.x - a.x) * .25, dy = Math.sign(b.y - a.y) * .25
                    expect(inUnion(rects, x - dy, y + dx)).toBe(true)
                    expect(inUnion(rects, x + dy, y - dx)).toBe(false)
                })
            }
        }
    })
    test('a hole is a counter-clockwise outline', () => {
        const frame = [
            { left: 0, top: 0, width: 10, height: 2 }, { left: 0, top: 8, width: 10, height: 2 },
            { left: 0, top: 0, width: 2, height: 10 }, { left: 8, top: 0, width: 2, height: 10 },
        ]
        expect(rectsUnionOutlines(frame).map(signedArea)).toEqual([100, -36])
    })
    test('rects touching only at a corner have separate outlines', () => {
        const rects = [{ left: 0, top: 0, width: 5, height: 5 }, { left: 5, top: 5, width: 5, height: 5 }]
        expect(rectsUnionOutlines(rects)).toEqual([
            [{ x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }, { x: 0, y: 0 }],
            [{ x: 10, y: 5 }, { x: 10, y: 10 }, { x: 5, y: 10 }, { x: 5, y: 5 }],
        ])
    })
    test('coordinates closer than epsilon are merged', () => {
        const rects = [
            { left: 10, top: 20, width: 100.0000001, height: 18 },
            { left: 10.000000002, top: 38.0000000004, width: 50, height: 18 },
        ]
        expect(rectsUnionOutlines(rects)).toHaveLength(1)
        expect(rectsUnionOutlines(rects)[0]).toHaveLength(6)
        // a gap of 4e-10 between the two lines
        expect(rectsUnionOutlines(rects, { epsilon: 0 })).toHaveLength(2)
    })
    test('empty rects are ignored', () => {
        expect(rectsUnionOutlines([])).toEqual([])
        expect(rectsUnionOutlines([{ left: 1, top: 1, width: 0, height: 5 }, { left: 1, top: 1, width: 5, height: NaN }])).toEqual([])
        expect(rectsUnionPath([])).toBe('')
    })
})

describe('Tiling of the union of rects (unit test for rectsUnionTiles)', () => {
    test('the tiles cover the union and don\'t overlap', () => {
        for (const rects of cases) {
            const tiles = rectsUnionTiles(rects)
            const area = tiles.reduce((sum, t) => sum + t.width * t.height, 0)
            expect(area).toBeCloseTo(unionArea(rects), 9)
            tiles.forEach((a, k) => {
                expect(a.width > 0 && a.height > 0).toBe(true)
                for (let x = a.left + .5; x < a.left + a.width; x++) {
                    for (let y = a.top + .5; y < a.top + a.height; y++) expect(inUnion(rects, x, y)).toBe(true)
                }
                for (const b of tiles.slice(k + 1)) {
                    const overlapX = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)
                    const overlapY = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top)
                    expect(overlapX > 0 && overlapY > 0).toBe(false)
                }
            })
        }
    })
    test('lines of horizontal text give one tile per line', () => {
        const rects = [
            { left: 40, top: 30, width: 210, height: 22 },
            { left: 12, top: 50, width: 120, height: 22 },
            { left: 60, top: 31, width: 50, height: 19 },
        ]
        expect(rectsUnionTiles(rects)).toEqual([
            { left: 40, top: 30, width: 210, height: 20 },
            { left: 12, top: 50, width: 238, height: 2 },
            { left: 12, top: 52, width: 120, height: 20 },
        ])
    })
    test('columns of vertical text give one tile per column', () => {
        const rects = [{ left: 100, top: 50, width: 20, height: 300 }, { left: 78, top: 0, width: 20, height: 120 }]
        expect(rectsUnionTiles(rects)).toEqual([
            { left: 78, top: 0, width: 20, height: 120 },
            { left: 100, top: 50, width: 20, height: 300 },
        ])
    })
})

describe('Drawing of search results (searchResultsHighlight, currentSearchOutline)', () => {
    const rects = [
        new DOMRect(40.3, 30.7, 210.6, 21.4),
        new DOMRect(12.1, 49.9, 120.45, 21.4),
        new DOMRect(60.2, 31.5, 50.3, 19.6),
        new DOMRect(250.9, 30.7, 30, 21.4),
    ]
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.style.cssText = 'position:absolute;left:0;top:0;width:400px;height:200px'
    document.body.append(svg)
    const point = (x, y) => Object.assign(svg.createSVGPoint(), { x, y })
    const samples = []
    for (let x = 5; x < 300; x += 1.7) for (let y = 25; y < 80; y += 1.3) samples.push([x, y])
    const nearSide = (x, y) => [[.1, 0], [-.1, 0], [0, .1], [0, -.1]].some(([dx, dy]) => inUnion(rects, x + dx, y + dy) !== inUnion(rects, x, y))

    test('the highlight is a single path that fills the union', () => {
        const g = searchResultsHighlight(rects, { color: 'blue' })
        svg.append(g)
        expect(g.children).toHaveLength(1)
        const path = g.querySelector('path')
        for (const [x, y] of samples) {
            if (!nearSide(x, y)) expect(path.isPointInFill(point(x, y))).toBe(inUnion(rects, x, y))
        }
        g.remove()
    })
    test('the inverted highlight has a single foreignObject clipped to the union', () => {
        const g = searchResultsHighlight(rects, { color: 'transparent', invert: true })
        svg.append(g)
        const foreigns = g.querySelectorAll('foreignObject')
        expect(foreigns).toHaveLength(1)
        expect(foreigns[0].getAttribute('x')).toBe('12.1')
        expect(foreigns[0].getAttribute('y')).toBe('30.7')
        const div = foreigns[0].firstElementChild
        expect(div.style.clipPath).toMatch(/^path\(/)
        g.remove()
    })
    test('the current search outline is a single path along the sides of the union', () => {
        for (const radius of [0, 3]) {
            const g = currentSearchOutline(rects, { width: 2, radius })
            svg.append(g)
            expect(g.children).toHaveLength(1)
            const path = g.querySelector('path')
            // the side of the second rect that is inside the first one isn't drawn
            expect(path.isPointInStroke(point(80, 50))).toBe(false)
            expect(path.isPointInStroke(point(80, 49.9))).toBe(false)
            expect(path.isPointInStroke(point(80, 30.7))).toBe(true)
            expect(path.isPointInStroke(point(12.1, 60))).toBe(true)
            g.remove()
        }
    })
    test('no rects draw an empty group', () => {
        expect(searchResultsHighlight([], { invert: true }).children).toHaveLength(0)
        expect(currentSearchOutline([]).children).toHaveLength(0)
    })
})
