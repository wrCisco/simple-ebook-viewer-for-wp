var __defProp = Object.defineProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const debounce = (f, wait2, immediate) => {
  let timeout;
  return (...args) => {
    const later = () => {
      timeout = null;
      f(...args);
    };
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait2);
  };
};
const lerp = (min, max, x) => x * (max - min) + min;
const easeOutQuad = (x) => 1 - (1 - x) * (1 - x);
const animate = (a, b, duration, ease, render) => new Promise((resolve) => {
  let start;
  const step = (now) => {
    start ?? (start = now);
    const fraction = Math.min(1, (now - start) / duration);
    render(lerp(a, b, ease(fraction)));
    if (fraction < 1) requestAnimationFrame(step);
    else resolve();
  };
  requestAnimationFrame(step);
});
const uncollapse = (range) => {
  if (!(range == null ? void 0 : range.collapsed)) return range;
  const { endOffset, endContainer } = range;
  if (endContainer.nodeType === 1) {
    const node = endContainer.childNodes[endOffset];
    if ((node == null ? void 0 : node.nodeType) === 1) return node;
    return endContainer;
  }
  if (endOffset + 1 < endContainer.length) range.setEnd(endContainer, endOffset + 1);
  else if (endOffset > 1) range.setStart(endContainer, endOffset - 1);
  else return endContainer.parentNode;
  return range;
};
const makeRange = (doc, node, start, end = start) => {
  const range = doc.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  return range;
};
const bisectNode = (doc, node, cb, start = 0, end = node.nodeValue.length) => {
  if (end - start === 1) {
    const result2 = cb(makeRange(doc, node, start), makeRange(doc, node, end));
    return result2 < 0 ? start : end;
  }
  const mid = Math.floor(start + (end - start) / 2);
  const result = cb(makeRange(doc, node, start, mid), makeRange(doc, node, mid, end));
  return result < 0 ? bisectNode(doc, node, cb, start, mid) : result > 0 ? bisectNode(doc, node, cb, mid, end) : mid;
};
const {
  SHOW_ELEMENT,
  SHOW_TEXT,
  SHOW_CDATA_SECTION,
  FILTER_ACCEPT,
  FILTER_REJECT,
  FILTER_SKIP
} = NodeFilter;
const filter = SHOW_ELEMENT | SHOW_TEXT | SHOW_CDATA_SECTION;
const getBoundingClientRect = (target) => {
  let top = Infinity, right = -Infinity, left = Infinity, bottom = -Infinity;
  for (const rect of target.getClientRects()) {
    left = Math.min(left, rect.left);
    top = Math.min(top, rect.top);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  }
  return new DOMRect(left, top, right - left, bottom - top);
};
const getVisibleRange = (doc, start, end, mapRect) => {
  const acceptNode = (node) => {
    var _a, _b;
    const name = (_a = node.localName) == null ? void 0 : _a.toLowerCase();
    if (name === "script" || name === "style") return FILTER_REJECT;
    if (node.nodeType === 1) {
      const { left, right } = mapRect(node.getBoundingClientRect());
      if (right < start || left > end) return FILTER_REJECT;
      if (left >= start && right <= end) return FILTER_ACCEPT;
    } else {
      if (!((_b = node.nodeValue) == null ? void 0 : _b.trim())) return FILTER_SKIP;
      const range2 = doc.createRange();
      range2.selectNodeContents(node);
      const { left, right } = mapRect(range2.getBoundingClientRect());
      if (right >= start && left <= end) return FILTER_ACCEPT;
    }
    return FILTER_SKIP;
  };
  const walker = doc.createTreeWalker(doc.body, filter, { acceptNode });
  const nodes = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode())
    nodes.push(node);
  const from = nodes[0] ?? doc.body;
  const to = nodes[nodes.length - 1] ?? from;
  const startOffset = from.nodeType === 1 ? 0 : bisectNode(doc, from, (a, b) => {
    const p = mapRect(getBoundingClientRect(a));
    const q = mapRect(getBoundingClientRect(b));
    if (p.right < start && q.left > start) return 0;
    return q.left > start ? -1 : 1;
  });
  const endOffset = to.nodeType === 1 ? 0 : bisectNode(doc, to, (a, b) => {
    const p = mapRect(getBoundingClientRect(a));
    const q = mapRect(getBoundingClientRect(b));
    if (p.right < end && q.left > end) return 0;
    return q.left > end ? -1 : 1;
  });
  const range = doc.createRange();
  range.setStart(from, startOffset);
  range.setEnd(to, endOffset);
  return range;
};
const selectionIsBackward = (sel) => {
  const range = document.createRange();
  range.setStart(sel.anchorNode, sel.anchorOffset);
  range.setEnd(sel.focusNode, sel.focusOffset);
  return range.collapsed;
};
const setSelectionTo = (target, collapse) => {
  let range;
  if (target.startContainer) range = target.cloneRange();
  else if (target.nodeType) {
    range = document.createRange();
    range.selectNode(target);
  }
  if (range) {
    const sel = range.startContainer.ownerDocument.defaultView.getSelection();
    sel.removeAllRanges();
    if (collapse === -1) range.collapse(true);
    else if (collapse === 1) range.collapse();
    sel.addRange(range);
  }
};
const getDirection = (doc) => {
  const { defaultView } = doc;
  const { writingMode, direction } = defaultView.getComputedStyle(doc.body);
  const vertical = writingMode === "vertical-rl" || writingMode === "vertical-lr";
  const rtl = doc.body.dir === "rtl" || direction === "rtl" || doc.documentElement.dir === "rtl";
  return { vertical, rtl };
};
const getBackground = (doc) => {
  const bodyStyle = doc.defaultView.getComputedStyle(doc.body);
  return bodyStyle.backgroundColor === "rgba(0, 0, 0, 0)" && bodyStyle.backgroundImage === "none" ? doc.defaultView.getComputedStyle(doc.documentElement).background : bodyStyle.background;
};
const makeMarginals = (length, part) => Array.from({ length }, () => {
  const div = document.createElement("div");
  const child = document.createElement("div");
  div.append(child);
  child.setAttribute("part", part);
  return div;
});
const setStylesImportant = (el, styles) => {
  const { style } = el;
  for (const [k, v] of Object.entries(styles)) style.setProperty(k, v, "important");
};
var _observer, _element, _iframe, _contentRange, _overlayer, _vertical, _rtl, _column, _size, _layout;
class View {
  constructor({ container, onExpand }) {
    __privateAdd(this, _observer, new ResizeObserver(() => this.expand()));
    __privateAdd(this, _element, document.createElement("div"));
    __privateAdd(this, _iframe, document.createElement("iframe"));
    __privateAdd(this, _contentRange, document.createRange());
    __privateAdd(this, _overlayer);
    __privateAdd(this, _vertical, false);
    __privateAdd(this, _rtl, false);
    __privateAdd(this, _column, true);
    __privateAdd(this, _size);
    __privateAdd(this, _layout, {});
    this.container = container;
    this.onExpand = onExpand;
    __privateGet(this, _iframe).setAttribute("part", "filter");
    __privateGet(this, _element).append(__privateGet(this, _iframe));
    Object.assign(__privateGet(this, _element).style, {
      boxSizing: "content-box",
      position: "relative",
      overflow: "hidden",
      flex: "0 0 auto",
      width: "100%",
      height: "100%",
      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    });
    Object.assign(__privateGet(this, _iframe).style, {
      overflow: "hidden",
      border: "0",
      display: "none",
      width: "100%",
      height: "100%"
    });
    __privateGet(this, _iframe).setAttribute("sandbox", "allow-same-origin allow-scripts");
    __privateGet(this, _iframe).setAttribute("scrolling", "no");
  }
  get element() {
    return __privateGet(this, _element);
  }
  get document() {
    return __privateGet(this, _iframe).contentDocument;
  }
  async load(src, afterLoad, beforeRender) {
    if (typeof src !== "string") throw new Error(`${src} is not string`);
    return new Promise((resolve) => {
      __privateGet(this, _iframe).addEventListener("load", () => {
        const doc = this.document;
        afterLoad == null ? void 0 : afterLoad(doc);
        __privateGet(this, _iframe).style.display = "block";
        const { vertical, rtl } = getDirection(doc);
        const background = getBackground(doc);
        __privateGet(this, _iframe).style.display = "none";
        __privateSet(this, _vertical, vertical);
        __privateSet(this, _rtl, rtl);
        __privateGet(this, _contentRange).selectNodeContents(doc.body);
        const layout = beforeRender == null ? void 0 : beforeRender({ vertical, rtl, background });
        __privateGet(this, _iframe).style.display = "block";
        this.render(layout);
        __privateGet(this, _observer).observe(doc.body);
        doc.fonts.ready.then(() => this.expand());
        resolve();
      }, { once: true });
      __privateGet(this, _iframe).src = src;
    });
  }
  render(layout) {
    if (!layout) return;
    __privateSet(this, _column, layout.flow !== "scrolled");
    __privateSet(this, _layout, layout);
    if (__privateGet(this, _column)) this.columnize(layout);
    else this.scrolled(layout);
  }
  scrolled({ gap, columnWidth }) {
    const vertical = __privateGet(this, _vertical);
    const doc = this.document;
    setStylesImportant(doc.documentElement, {
      "box-sizing": "border-box",
      "padding": vertical ? `${gap}px 0` : `0 ${gap}px`,
      "column-width": "auto",
      "height": "auto",
      "width": "auto"
    });
    setStylesImportant(doc.body, {
      [vertical ? "max-height" : "max-width"]: `${columnWidth}px`,
      "margin": "auto"
    });
    this.setImageSize();
    this.expand();
  }
  columnize({ width, height, gap, columnWidth }) {
    const vertical = __privateGet(this, _vertical);
    __privateSet(this, _size, vertical ? height : width);
    const doc = this.document;
    setStylesImportant(doc.documentElement, {
      "box-sizing": "border-box",
      "column-width": `${Math.trunc(columnWidth)}px`,
      "column-gap": `${gap}px`,
      "column-fill": "auto",
      ...vertical ? { "width": `${width}px` } : { "height": `${height}px` },
      "padding": vertical ? `${gap / 2}px 0` : `0 ${gap / 2}px`,
      "overflow": "hidden",
      // force wrap long words
      "overflow-wrap": "break-word",
      // reset some potentially problematic props
      "position": "static",
      "border": "0",
      "margin": "0",
      "max-height": "none",
      "max-width": "none",
      "min-height": "none",
      "min-width": "none",
      // fix glyph clipping in WebKit
      "-webkit-line-box-contain": "block glyphs replaced"
    });
    setStylesImportant(doc.body, {
      "max-height": "none",
      "max-width": "none",
      "margin": "0"
    });
    this.setImageSize();
    this.expand();
  }
  setImageSize() {
    const { width, height, margin } = __privateGet(this, _layout);
    const vertical = __privateGet(this, _vertical);
    const doc = this.document;
    for (const el of doc.body.querySelectorAll("img, svg, video")) {
      const { maxHeight, maxWidth } = doc.defaultView.getComputedStyle(el);
      setStylesImportant(el, {
        "max-height": vertical ? maxHeight !== "none" && maxHeight !== "0px" ? maxHeight : "100%" : `${height - margin * 2}px`,
        "max-width": vertical ? `${width - margin * 2}px` : maxWidth !== "none" && maxWidth !== "0px" ? maxWidth : "100%",
        "object-fit": "contain",
        "page-break-inside": "avoid",
        "break-inside": "avoid",
        "box-sizing": "border-box"
      });
    }
  }
  expand() {
    const { documentElement } = this.document;
    if (__privateGet(this, _column)) {
      const side = __privateGet(this, _vertical) ? "height" : "width";
      const otherSide = __privateGet(this, _vertical) ? "width" : "height";
      const contentRect = __privateGet(this, _contentRange).getBoundingClientRect();
      const rootRect = documentElement.getBoundingClientRect();
      const contentStart = __privateGet(this, _vertical) ? 0 : __privateGet(this, _rtl) ? rootRect.right - contentRect.right : contentRect.left - rootRect.left;
      const contentSize = contentStart + contentRect[side];
      const pageCount = Math.ceil(contentSize / __privateGet(this, _size));
      const expandedSize = pageCount * __privateGet(this, _size);
      __privateGet(this, _element).style.padding = "0";
      __privateGet(this, _iframe).style[side] = `${expandedSize}px`;
      __privateGet(this, _element).style[side] = `${expandedSize + __privateGet(this, _size) * 2}px`;
      __privateGet(this, _iframe).style[otherSide] = "100%";
      __privateGet(this, _element).style[otherSide] = "100%";
      documentElement.style[side] = `${__privateGet(this, _size)}px`;
      if (__privateGet(this, _overlayer)) {
        __privateGet(this, _overlayer).element.style.margin = "0";
        __privateGet(this, _overlayer).element.style.left = __privateGet(this, _vertical) ? "0" : `${__privateGet(this, _size)}px`;
        __privateGet(this, _overlayer).element.style.top = __privateGet(this, _vertical) ? `${__privateGet(this, _size)}px` : "0";
        __privateGet(this, _overlayer).element.style[side] = `${expandedSize}px`;
        __privateGet(this, _overlayer).redraw();
      }
    } else {
      const side = __privateGet(this, _vertical) ? "width" : "height";
      const otherSide = __privateGet(this, _vertical) ? "height" : "width";
      const contentSize = documentElement.getBoundingClientRect()[side];
      const expandedSize = contentSize;
      const { margin } = __privateGet(this, _layout);
      const padding = __privateGet(this, _vertical) ? `0 ${margin}px` : `${margin}px 0`;
      __privateGet(this, _iframe).style[side] = `${expandedSize}px`;
      __privateGet(this, _element).style[side] = `${expandedSize}px`;
      __privateGet(this, _iframe).style[otherSide] = "100%";
      __privateGet(this, _element).style[otherSide] = "100%";
      if (__privateGet(this, _overlayer)) {
        __privateGet(this, _overlayer).element.style.margin = padding;
        __privateGet(this, _overlayer).element.style.left = "0";
        __privateGet(this, _overlayer).element.style.top = "0";
        __privateGet(this, _overlayer).element.style[side] = `${expandedSize}px`;
        __privateGet(this, _overlayer).redraw();
      }
    }
    this.onExpand();
  }
  set overlayer(overlayer) {
    __privateSet(this, _overlayer, overlayer);
    __privateGet(this, _element).append(overlayer.element);
  }
  get overlayer() {
    return __privateGet(this, _overlayer);
  }
  destroy() {
    if (this.document) __privateGet(this, _observer).unobserve(this.document.body);
  }
}
_observer = new WeakMap();
_element = new WeakMap();
_iframe = new WeakMap();
_contentRange = new WeakMap();
_overlayer = new WeakMap();
_vertical = new WeakMap();
_rtl = new WeakMap();
_column = new WeakMap();
_size = new WeakMap();
_layout = new WeakMap();
var _root, _observer2, _top, _background, _container, _header, _footer, _view, _vertical2, _rtl2, _margin, _index, _anchor, _justAnchored, _locked, _styles, _styleMap, _mediaQuery, _mediaQueryListener, _scrollBounds, _touchState, _touchScrolled, _lastVisibleRange, _Paginator_instances, createView_fn, beforeRender_fn, onTouchStart_fn, onTouchMove_fn, onTouchEnd_fn, getRectMapper_fn, scrollToRect_fn, scrollTo_fn, scrollToPage_fn, scrollToAnchor_fn, getVisibleRange_fn, afterScroll_fn, display_fn, canGoToIndex_fn, goTo_fn, scrollPrev_fn, scrollNext_fn, adjacentIndex_fn, turnPage_fn;
class Paginator extends HTMLElement {
  constructor() {
    super();
    __privateAdd(this, _Paginator_instances);
    __privateAdd(this, _root, this.attachShadow({ mode: "closed" }));
    __privateAdd(this, _observer2, new ResizeObserver(() => this.render()));
    __privateAdd(this, _top);
    __privateAdd(this, _background);
    __privateAdd(this, _container);
    __privateAdd(this, _header);
    __privateAdd(this, _footer);
    __privateAdd(this, _view);
    __privateAdd(this, _vertical2, false);
    __privateAdd(this, _rtl2, false);
    __privateAdd(this, _margin, 0);
    __privateAdd(this, _index, -1);
    __privateAdd(this, _anchor, 0);
    // anchor view to a fraction (0-1), Range, or Element
    __privateAdd(this, _justAnchored, false);
    __privateAdd(this, _locked, false);
    // while true, prevent any further navigation
    __privateAdd(this, _styles);
    __privateAdd(this, _styleMap, /* @__PURE__ */ new WeakMap());
    __privateAdd(this, _mediaQuery, matchMedia("(prefers-color-scheme: dark)"));
    __privateAdd(this, _mediaQueryListener);
    __privateAdd(this, _scrollBounds);
    __privateAdd(this, _touchState);
    __privateAdd(this, _touchScrolled);
    __privateAdd(this, _lastVisibleRange);
    __privateGet(this, _root).innerHTML = `<style>
        :host {
            display: block;
            container-type: size;
        }
        :host, #top {
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
            width: 100%;
            height: 100%;
        }
        #top {
            --_gap: 7%;
            --_margin: 48px;
            --_max-inline-size: 720px;
            --_max-block-size: 1440px;
            --_max-column-count: 2;
            --_max-column-count-portrait: 1;
            --_max-column-count-spread: var(--_max-column-count);
            --_half-gap: calc(var(--_gap) / 2);
            --_max-width: calc(var(--_max-inline-size) * var(--_max-column-count-spread));
            --_max-height: var(--_max-block-size);
            display: grid;
            grid-template-columns:
                minmax(var(--_half-gap), 1fr)
                var(--_half-gap)
                minmax(0, calc(var(--_max-width) - var(--_gap)))
                var(--_half-gap)
                minmax(var(--_half-gap), 1fr);
            grid-template-rows:
                minmax(var(--_margin), 1fr)
                minmax(0, var(--_max-height))
                minmax(var(--_margin), 1fr);
            &.vertical {
                --_max-column-count-spread: var(--_max-column-count-portrait);
                --_max-width: var(--_max-block-size);
                --_max-height: calc(var(--_max-inline-size) * var(--_max-column-count-spread));
            }
            @container (orientation: portrait) {
                & {
                    --_max-column-count-spread: var(--_max-column-count-portrait);
                }
                &.vertical {
                    --_max-column-count-spread: var(--_max-column-count);
                }
            }
        }
        #background {
            grid-column: 1 / -1;
            grid-row: 1 / -1;
        }
        #container {
            grid-column: 2 / 5;
            grid-row: 2;
            overflow: hidden;
        }
        :host([flow="scrolled"]) #container {
            grid-column: 1 / -1;
            grid-row: 1 / -1;
            overflow: auto;
            margin-block: 2em;
        }
        #header {
            grid-column: 3 / 4;
            grid-row: 1;
        }
        #footer {
            grid-column: 3 / 4;
            grid-row: 3;
            align-self: end;
        }
        #header, #footer {
            display: grid;
            height: var(--_margin);
        }
        :is(#header, #footer) > * {
            display: flex;
            align-items: center;
            min-width: 0;
        }
        :is(#header, #footer) > * > * {
            width: 100%;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            text-align: center;
            font-size: .75em;
            opacity: .6;
        }
        </style>
        <div id="top">
            <div id="background" part="filter"></div>
            <div id="header"></div>
            <div id="container"></div>
            <div id="footer"></div>
        </div>
        `;
    __privateSet(this, _top, __privateGet(this, _root).getElementById("top"));
    __privateSet(this, _background, __privateGet(this, _root).getElementById("background"));
    __privateSet(this, _container, __privateGet(this, _root).getElementById("container"));
    __privateSet(this, _header, __privateGet(this, _root).getElementById("header"));
    __privateSet(this, _footer, __privateGet(this, _root).getElementById("footer"));
    __privateGet(this, _observer2).observe(__privateGet(this, _container));
    __privateGet(this, _container).addEventListener("scroll", () => this.dispatchEvent(new Event("scroll")));
    __privateGet(this, _container).addEventListener("scroll", debounce(() => {
      if (this.scrolled) {
        if (__privateGet(this, _justAnchored)) __privateSet(this, _justAnchored, false);
        else __privateMethod(this, _Paginator_instances, afterScroll_fn).call(this, "scroll");
      }
    }, 250));
    const opts = { passive: false };
    this.addEventListener("touchstart", __privateMethod(this, _Paginator_instances, onTouchStart_fn).bind(this), { passive: true });
    this.addEventListener("touchmove", __privateMethod(this, _Paginator_instances, onTouchMove_fn).bind(this), opts);
    this.addEventListener("touchend", __privateMethod(this, _Paginator_instances, onTouchEnd_fn).bind(this));
    this.addEventListener("load", ({ detail: { doc } }) => {
      doc.addEventListener("touchstart", __privateMethod(this, _Paginator_instances, onTouchStart_fn).bind(this), { passive: true });
      doc.addEventListener("touchmove", __privateMethod(this, _Paginator_instances, onTouchMove_fn).bind(this), opts);
      doc.addEventListener("touchend", __privateMethod(this, _Paginator_instances, onTouchEnd_fn).bind(this));
    });
    this.addEventListener("relocate", ({ detail }) => {
      if (detail.reason === "selection") setSelectionTo(__privateGet(this, _anchor), 0);
      else if (detail.reason === "navigation") {
        if (__privateGet(this, _anchor) === 1) setSelectionTo(detail.range, 1);
        else if (typeof __privateGet(this, _anchor) === "number")
          setSelectionTo(detail.range, -1);
        else setSelectionTo(__privateGet(this, _anchor), -1);
      }
    });
    const checkPointerSelection = debounce((range, sel) => {
      if (!sel.rangeCount) return;
      const selRange = sel.getRangeAt(0);
      const backward = selectionIsBackward(sel);
      if (backward && selRange.compareBoundaryPoints(Range.START_TO_START, range) < 0)
        this.prev();
      else if (!backward && selRange.compareBoundaryPoints(Range.END_TO_END, range) > 0)
        this.next();
    }, 700);
    this.addEventListener("load", ({ detail: { doc } }) => {
      let isPointerSelecting = false;
      doc.addEventListener("pointerdown", () => isPointerSelecting = true);
      doc.addEventListener("pointerup", () => isPointerSelecting = false);
      let isKeyboardSelecting = false;
      doc.addEventListener("keydown", () => isKeyboardSelecting = true);
      doc.addEventListener("keyup", () => isKeyboardSelecting = false);
      doc.addEventListener("selectionchange", () => {
        if (this.scrolled) return;
        const range = __privateGet(this, _lastVisibleRange);
        if (!range) return;
        const sel = doc.getSelection();
        if (!sel.rangeCount) return;
        if (isPointerSelecting && sel.type === "Range")
          checkPointerSelection(range, sel);
        else if (isKeyboardSelecting) {
          const selRange = sel.getRangeAt(0).cloneRange();
          const backward = selectionIsBackward(sel);
          if (!backward) selRange.collapse();
          __privateMethod(this, _Paginator_instances, scrollToAnchor_fn).call(this, selRange);
        }
      });
      doc.addEventListener("focusin", (e) => this.scrolled ? null : (
        // NOTE: `requestAnimationFrame` is needed in WebKit
        requestAnimationFrame(() => __privateMethod(this, _Paginator_instances, scrollToAnchor_fn).call(this, e.target))
      ));
    });
    __privateSet(this, _mediaQueryListener, () => {
      if (!__privateGet(this, _view)) return;
      __privateGet(this, _background).style.background = getBackground(__privateGet(this, _view).document);
    });
    __privateGet(this, _mediaQuery).addEventListener("change", __privateGet(this, _mediaQueryListener));
  }
  attributeChangedCallback(name, _, value) {
    switch (name) {
      case "flow":
        this.render();
        break;
      case "gap":
      case "margin":
      case "max-block-size":
      case "max-column-count":
        __privateGet(this, _top).style.setProperty("--_" + name, value);
        break;
      case "max-inline-size":
        __privateGet(this, _top).style.setProperty("--_" + name, value);
        this.render();
        break;
    }
  }
  open(book) {
    var _a;
    this.bookDir = book.dir;
    this.sections = book.sections;
    (_a = book.transformTarget) == null ? void 0 : _a.addEventListener("data", ({ detail }) => {
      if (detail.type !== "text/css") return;
      const w = innerWidth;
      const h = innerHeight;
      detail.data = Promise.resolve(detail.data).then((data) => data.replace(new RegExp("(?<=[{\\s;])-epub-", "gi"), "").replace(/(\d*\.?\d+)vw/gi, (_, d) => parseFloat(d) * w / 100 + "px").replace(/(\d*\.?\d+)vh/gi, (_, d) => parseFloat(d) * h / 100 + "px").replace(/page-break-(after|before|inside)\s*:/gi, (_, x) => `-webkit-column-break-${x}:`).replace(/break-(after|before|inside)\s*:\s*(avoid-)?page/gi, (_, x, y) => `break-${x}: ${y ?? ""}column`));
    });
  }
  render() {
    if (!__privateGet(this, _view)) return;
    __privateGet(this, _view).render(__privateMethod(this, _Paginator_instances, beforeRender_fn).call(this, {
      vertical: __privateGet(this, _vertical2),
      rtl: __privateGet(this, _rtl2)
    }));
    __privateMethod(this, _Paginator_instances, scrollToAnchor_fn).call(this, __privateGet(this, _anchor));
  }
  get scrolled() {
    return this.getAttribute("flow") === "scrolled";
  }
  get scrollProp() {
    const { scrolled } = this;
    return __privateGet(this, _vertical2) ? scrolled ? "scrollLeft" : "scrollTop" : scrolled ? "scrollTop" : "scrollLeft";
  }
  get sideProp() {
    const { scrolled } = this;
    return __privateGet(this, _vertical2) ? scrolled ? "width" : "height" : scrolled ? "height" : "width";
  }
  get size() {
    return __privateGet(this, _container).getBoundingClientRect()[this.sideProp];
  }
  get viewSize() {
    return __privateGet(this, _view).element.getBoundingClientRect()[this.sideProp];
  }
  get start() {
    return Math.abs(__privateGet(this, _container)[this.scrollProp]);
  }
  get end() {
    return this.start + this.size;
  }
  get page() {
    return Math.floor((this.start + this.end) / 2 / this.size);
  }
  get pages() {
    return Math.round(this.viewSize / this.size);
  }
  scrollBy(dx, dy) {
    const delta = __privateGet(this, _vertical2) ? dy : dx;
    const element = __privateGet(this, _container);
    const { scrollProp } = this;
    const [offset, a, b] = __privateGet(this, _scrollBounds);
    const rtl = __privateGet(this, _rtl2);
    const min = rtl ? offset - b : offset - a;
    const max = rtl ? offset + a : offset + b;
    element[scrollProp] = Math.max(min, Math.min(
      max,
      element[scrollProp] + delta
    ));
  }
  snap(vx, vy) {
    const velocity = __privateGet(this, _vertical2) ? vy : vx;
    const [offset, a, b] = __privateGet(this, _scrollBounds);
    const { start, end, pages, size } = this;
    const min = Math.abs(offset) - a;
    const max = Math.abs(offset) + b;
    const d = velocity * (__privateGet(this, _rtl2) ? -size : size);
    const page = Math.floor(
      Math.max(min, Math.min(max, (start + end) / 2 + (isNaN(d) ? 0 : d))) / size
    );
    __privateMethod(this, _Paginator_instances, scrollToPage_fn).call(this, page, "snap").then(() => {
      const dir = page <= 0 ? -1 : page >= pages - 1 ? 1 : null;
      if (dir) return __privateMethod(this, _Paginator_instances, goTo_fn).call(this, {
        index: __privateMethod(this, _Paginator_instances, adjacentIndex_fn).call(this, dir),
        anchor: dir < 0 ? () => 1 : () => 0
      });
    });
  }
  async scrollToAnchor(anchor, select) {
    return __privateMethod(this, _Paginator_instances, scrollToAnchor_fn).call(this, anchor, select ? "selection" : "navigation");
  }
  async goTo(target) {
    if (__privateGet(this, _locked)) return;
    const resolved = await target;
    if (__privateMethod(this, _Paginator_instances, canGoToIndex_fn).call(this, resolved.index)) return __privateMethod(this, _Paginator_instances, goTo_fn).call(this, resolved);
  }
  get atStart() {
    return __privateMethod(this, _Paginator_instances, adjacentIndex_fn).call(this, -1) == null && this.page <= 1;
  }
  get atEnd() {
    return __privateMethod(this, _Paginator_instances, adjacentIndex_fn).call(this, 1) == null && this.page >= this.pages - 2;
  }
  prev(distance) {
    return __privateMethod(this, _Paginator_instances, turnPage_fn).call(this, -1, distance);
  }
  next(distance) {
    return __privateMethod(this, _Paginator_instances, turnPage_fn).call(this, 1, distance);
  }
  prevSection() {
    return this.goTo({ index: __privateMethod(this, _Paginator_instances, adjacentIndex_fn).call(this, -1) });
  }
  nextSection() {
    return this.goTo({ index: __privateMethod(this, _Paginator_instances, adjacentIndex_fn).call(this, 1) });
  }
  firstSection() {
    const index = this.sections.findIndex((section) => section.linear !== "no");
    return this.goTo({ index });
  }
  lastSection() {
    const index = this.sections.findLastIndex((section) => section.linear !== "no");
    return this.goTo({ index });
  }
  getContents() {
    if (__privateGet(this, _view)) return [{
      index: __privateGet(this, _index),
      overlayer: __privateGet(this, _view).overlayer,
      doc: __privateGet(this, _view).document
    }];
    return [];
  }
  setStyles(styles) {
    var _a, _b, _c, _d, _e;
    __privateSet(this, _styles, styles);
    const $$styles = __privateGet(this, _styleMap).get((_a = __privateGet(this, _view)) == null ? void 0 : _a.document);
    if (!$$styles) return;
    const [$beforeStyle, $style] = $$styles;
    if (Array.isArray(styles)) {
      const [beforeStyle, style] = styles;
      $beforeStyle.textContent = beforeStyle;
      $style.textContent = style;
    } else $style.textContent = styles;
    requestAnimationFrame(() => __privateGet(this, _background).style.background = getBackground(__privateGet(this, _view).document));
    (_e = (_d = (_c = (_b = __privateGet(this, _view)) == null ? void 0 : _b.document) == null ? void 0 : _c.fonts) == null ? void 0 : _d.ready) == null ? void 0 : _e.then(() => __privateGet(this, _view).expand());
  }
  focusView() {
    __privateGet(this, _view).document.defaultView.focus();
  }
  destroy() {
    var _a, _b;
    __privateGet(this, _observer2).unobserve(this);
    __privateGet(this, _view).destroy();
    __privateSet(this, _view, null);
    (_b = (_a = this.sections[__privateGet(this, _index)]) == null ? void 0 : _a.unload) == null ? void 0 : _b.call(_a);
    __privateGet(this, _mediaQuery).removeEventListener("change", __privateGet(this, _mediaQueryListener));
  }
}
_root = new WeakMap();
_observer2 = new WeakMap();
_top = new WeakMap();
_background = new WeakMap();
_container = new WeakMap();
_header = new WeakMap();
_footer = new WeakMap();
_view = new WeakMap();
_vertical2 = new WeakMap();
_rtl2 = new WeakMap();
_margin = new WeakMap();
_index = new WeakMap();
_anchor = new WeakMap();
_justAnchored = new WeakMap();
_locked = new WeakMap();
_styles = new WeakMap();
_styleMap = new WeakMap();
_mediaQuery = new WeakMap();
_mediaQueryListener = new WeakMap();
_scrollBounds = new WeakMap();
_touchState = new WeakMap();
_touchScrolled = new WeakMap();
_lastVisibleRange = new WeakMap();
_Paginator_instances = new WeakSet();
createView_fn = function() {
  if (__privateGet(this, _view)) {
    __privateGet(this, _view).destroy();
    __privateGet(this, _container).removeChild(__privateGet(this, _view).element);
  }
  __privateSet(this, _view, new View({
    container: this,
    onExpand: () => __privateMethod(this, _Paginator_instances, scrollToAnchor_fn).call(this, __privateGet(this, _anchor))
  }));
  __privateGet(this, _container).append(__privateGet(this, _view).element);
  return __privateGet(this, _view);
};
beforeRender_fn = function({ vertical, rtl, background }) {
  __privateSet(this, _vertical2, vertical);
  __privateSet(this, _rtl2, rtl);
  __privateGet(this, _top).classList.toggle("vertical", vertical);
  __privateGet(this, _background).style.background = background;
  const { width, height } = __privateGet(this, _container).getBoundingClientRect();
  const size = vertical ? height : width;
  const style = getComputedStyle(__privateGet(this, _top));
  const maxInlineSize = parseFloat(style.getPropertyValue("--_max-inline-size"));
  const maxColumnCount = parseInt(style.getPropertyValue("--_max-column-count-spread"));
  const margin = parseFloat(style.getPropertyValue("--_margin"));
  __privateSet(this, _margin, margin);
  const g = parseFloat(style.getPropertyValue("--_gap")) / 100;
  const gap = -g / (g - 1) * size;
  const flow = this.getAttribute("flow");
  if (flow === "scrolled") {
    this.setAttribute("dir", vertical ? "rtl" : "ltr");
    __privateGet(this, _top).style.padding = "0";
    const columnWidth2 = maxInlineSize;
    this.heads = null;
    this.feet = null;
    __privateGet(this, _header).replaceChildren();
    __privateGet(this, _footer).replaceChildren();
    return { flow, margin, gap, columnWidth: columnWidth2 };
  }
  const divisor = Math.min(maxColumnCount, Math.ceil(size / maxInlineSize));
  const columnWidth = size / divisor - gap;
  this.setAttribute("dir", rtl ? "rtl" : "ltr");
  const marginalDivisor = vertical ? Math.min(2, Math.ceil(width / maxInlineSize)) : divisor;
  const marginalStyle = {
    gridTemplateColumns: `repeat(${marginalDivisor}, 1fr)`,
    gap: `${gap}px`,
    direction: this.bookDir === "rtl" ? "rtl" : "ltr"
  };
  Object.assign(__privateGet(this, _header).style, marginalStyle);
  Object.assign(__privateGet(this, _footer).style, marginalStyle);
  const heads = makeMarginals(marginalDivisor, "head");
  const feet = makeMarginals(marginalDivisor, "foot");
  this.heads = heads.map((el) => el.children[0]);
  this.feet = feet.map((el) => el.children[0]);
  __privateGet(this, _header).replaceChildren(...heads);
  __privateGet(this, _footer).replaceChildren(...feet);
  return { height, width, margin, gap, columnWidth };
};
onTouchStart_fn = function(e) {
  const touch = e.changedTouches[0];
  __privateSet(this, _touchState, {
    x: touch == null ? void 0 : touch.screenX,
    y: touch == null ? void 0 : touch.screenY,
    t: e.timeStamp,
    vx: 0,
    xy: 0
  });
};
onTouchMove_fn = function(e) {
  const state = __privateGet(this, _touchState);
  if (state.pinched) return;
  state.pinched = globalThis.visualViewport.scale > 1;
  if (this.scrolled || state.pinched) return;
  if (e.touches.length > 1) {
    if (__privateGet(this, _touchScrolled)) e.preventDefault();
    return;
  }
  e.preventDefault();
  const touch = e.changedTouches[0];
  const x = touch.screenX, y = touch.screenY;
  const dx = state.x - x, dy = state.y - y;
  const dt = e.timeStamp - state.t;
  state.x = x;
  state.y = y;
  state.t = e.timeStamp;
  state.vx = dx / dt;
  state.vy = dy / dt;
  __privateSet(this, _touchScrolled, true);
  this.scrollBy(dx, dy);
};
onTouchEnd_fn = function() {
  __privateSet(this, _touchScrolled, false);
  if (this.scrolled) return;
  requestAnimationFrame(() => {
    if (globalThis.visualViewport.scale === 1)
      this.snap(__privateGet(this, _touchState).vx, __privateGet(this, _touchState).vy);
  });
};
// allows one to process rects as if they were LTR and horizontal
getRectMapper_fn = function() {
  if (this.scrolled) {
    const size = this.viewSize;
    const margin = __privateGet(this, _margin);
    return __privateGet(this, _vertical2) ? ({ left, right }) => ({ left: size - right - margin, right: size - left - margin }) : ({ top, bottom }) => ({ left: top + margin, right: bottom + margin });
  }
  const pxSize = this.pages * this.size;
  return __privateGet(this, _rtl2) ? ({ left, right }) => ({ left: pxSize - right, right: pxSize - left }) : __privateGet(this, _vertical2) ? ({ top, bottom }) => ({ left: top, right: bottom }) : (f) => f;
};
scrollToRect_fn = async function(rect, reason) {
  if (this.scrolled) {
    const offset2 = __privateMethod(this, _Paginator_instances, getRectMapper_fn).call(this)(rect).left - __privateGet(this, _margin);
    return __privateMethod(this, _Paginator_instances, scrollTo_fn).call(this, offset2, reason);
  }
  const offset = __privateMethod(this, _Paginator_instances, getRectMapper_fn).call(this)(rect).left;
  return __privateMethod(this, _Paginator_instances, scrollToPage_fn).call(this, Math.floor(offset / this.size) + (__privateGet(this, _rtl2) ? -1 : 1), reason);
};
scrollTo_fn = async function(offset, reason, smooth) {
  const element = __privateGet(this, _container);
  const { scrollProp, size } = this;
  if (element[scrollProp] === offset) {
    __privateSet(this, _scrollBounds, [offset, this.atStart ? 0 : size, this.atEnd ? 0 : size]);
    __privateMethod(this, _Paginator_instances, afterScroll_fn).call(this, reason);
    return;
  }
  if (this.scrolled && __privateGet(this, _vertical2)) offset = -offset;
  if ((reason === "snap" || smooth) && this.hasAttribute("animated")) return animate(
    element[scrollProp],
    offset,
    300,
    easeOutQuad,
    (x) => element[scrollProp] = x
  ).then(() => {
    __privateSet(this, _scrollBounds, [offset, this.atStart ? 0 : size, this.atEnd ? 0 : size]);
    __privateMethod(this, _Paginator_instances, afterScroll_fn).call(this, reason);
  });
  else {
    element[scrollProp] = offset;
    __privateSet(this, _scrollBounds, [offset, this.atStart ? 0 : size, this.atEnd ? 0 : size]);
    __privateMethod(this, _Paginator_instances, afterScroll_fn).call(this, reason);
  }
};
scrollToPage_fn = async function(page, reason, smooth) {
  const offset = this.size * (__privateGet(this, _rtl2) ? -page : page);
  return __privateMethod(this, _Paginator_instances, scrollTo_fn).call(this, offset, reason, smooth);
};
scrollToAnchor_fn = async function(anchor, reason = "anchor") {
  var _a, _b;
  __privateSet(this, _anchor, anchor);
  const rects = (_b = (_a = uncollapse(anchor)) == null ? void 0 : _a.getClientRects) == null ? void 0 : _b.call(_a);
  if (rects) {
    const rect = Array.from(rects).find((r) => r.width > 0 && r.height > 0) || rects[0];
    if (!rect) return;
    await __privateMethod(this, _Paginator_instances, scrollToRect_fn).call(this, rect, reason);
    return;
  }
  if (this.scrolled) {
    await __privateMethod(this, _Paginator_instances, scrollTo_fn).call(this, anchor * this.viewSize, reason);
    return;
  }
  const { pages } = this;
  if (!pages) return;
  const textPages = pages - 2;
  const newPage = Math.round(anchor * (textPages - 1));
  await __privateMethod(this, _Paginator_instances, scrollToPage_fn).call(this, newPage + 1, reason);
};
getVisibleRange_fn = function() {
  if (this.scrolled) return getVisibleRange(
    __privateGet(this, _view).document,
    this.start + __privateGet(this, _margin),
    this.end - __privateGet(this, _margin),
    __privateMethod(this, _Paginator_instances, getRectMapper_fn).call(this)
  );
  const size = __privateGet(this, _rtl2) ? -this.size : this.size;
  return getVisibleRange(
    __privateGet(this, _view).document,
    this.start - size,
    this.end - size,
    __privateMethod(this, _Paginator_instances, getRectMapper_fn).call(this)
  );
};
afterScroll_fn = function(reason) {
  const range = __privateMethod(this, _Paginator_instances, getVisibleRange_fn).call(this);
  __privateSet(this, _lastVisibleRange, range);
  if (reason !== "selection" && reason !== "navigation" && reason !== "anchor")
    __privateSet(this, _anchor, range);
  else __privateSet(this, _justAnchored, true);
  const index = __privateGet(this, _index);
  const detail = { reason, range, index };
  if (this.scrolled) detail.fraction = this.start / this.viewSize;
  else if (this.pages > 0) {
    const { page, pages } = this;
    __privateGet(this, _header).style.visibility = page > 1 ? "visible" : "hidden";
    detail.fraction = (page - 1) / (pages - 2);
    detail.size = 1 / (pages - 2);
  }
  this.dispatchEvent(new CustomEvent("relocate", { detail }));
};
display_fn = async function(promise) {
  var _a, _b;
  const { index, src, anchor, onLoad, select } = await promise;
  __privateSet(this, _index, index);
  const hasFocus = (_b = (_a = __privateGet(this, _view)) == null ? void 0 : _a.document) == null ? void 0 : _b.hasFocus();
  if (src) {
    const view = __privateMethod(this, _Paginator_instances, createView_fn).call(this);
    const afterLoad = (doc) => {
      if (doc.head) {
        const $styleBefore = doc.createElement("style");
        doc.head.prepend($styleBefore);
        const $style = doc.createElement("style");
        doc.head.append($style);
        __privateGet(this, _styleMap).set(doc, [$styleBefore, $style]);
      }
      onLoad == null ? void 0 : onLoad({ doc, index });
    };
    const beforeRender = __privateMethod(this, _Paginator_instances, beforeRender_fn).bind(this);
    await view.load(src, afterLoad, beforeRender);
    this.dispatchEvent(new CustomEvent("create-overlayer", {
      detail: {
        doc: view.document,
        index,
        attach: (overlayer) => view.overlayer = overlayer
      }
    }));
    __privateSet(this, _view, view);
  }
  await this.scrollToAnchor((typeof anchor === "function" ? anchor(__privateGet(this, _view).document) : anchor) ?? 0, select);
  if (hasFocus) this.focusView();
};
canGoToIndex_fn = function(index) {
  return index >= 0 && index <= this.sections.length - 1;
};
goTo_fn = async function({ index, anchor, select }) {
  if (index === __privateGet(this, _index)) await __privateMethod(this, _Paginator_instances, display_fn).call(this, { index, anchor, select });
  else {
    const oldIndex = __privateGet(this, _index);
    const onLoad = (detail) => {
      var _a, _b;
      (_b = (_a = this.sections[oldIndex]) == null ? void 0 : _a.unload) == null ? void 0 : _b.call(_a);
      this.setStyles(__privateGet(this, _styles));
      this.dispatchEvent(new CustomEvent("load", { detail }));
    };
    await __privateMethod(this, _Paginator_instances, display_fn).call(this, Promise.resolve(this.sections[index].load()).then((src) => ({ index, src, anchor, onLoad, select })).catch((e) => {
      console.warn(e);
      console.warn(new Error(`Failed to load section ${index}`));
      return {};
    }));
  }
};
scrollPrev_fn = function(distance) {
  if (!__privateGet(this, _view)) return true;
  if (this.scrolled) {
    if (this.start > 0) return __privateMethod(this, _Paginator_instances, scrollTo_fn).call(this, Math.max(0, this.start - (distance ?? this.size)), null, true);
    return true;
  }
  if (this.atStart) return;
  const page = this.page - 1;
  return __privateMethod(this, _Paginator_instances, scrollToPage_fn).call(this, page, "page", true).then(() => page <= 0);
};
scrollNext_fn = function(distance) {
  if (!__privateGet(this, _view)) return true;
  if (this.scrolled) {
    if (this.viewSize - this.end > 2) return __privateMethod(this, _Paginator_instances, scrollTo_fn).call(this, Math.min(this.viewSize, distance ? this.start + distance : this.end), null, true);
    return true;
  }
  if (this.atEnd) return;
  const page = this.page + 1;
  const pages = this.pages;
  return __privateMethod(this, _Paginator_instances, scrollToPage_fn).call(this, page, "page", true).then(() => page >= pages - 1);
};
adjacentIndex_fn = function(dir) {
  var _a;
  for (let index = __privateGet(this, _index) + dir; __privateMethod(this, _Paginator_instances, canGoToIndex_fn).call(this, index); index += dir)
    if (((_a = this.sections[index]) == null ? void 0 : _a.linear) !== "no") return index;
};
turnPage_fn = async function(dir, distance) {
  if (__privateGet(this, _locked)) return;
  __privateSet(this, _locked, true);
  const prev = dir === -1;
  const shouldGo = await (prev ? __privateMethod(this, _Paginator_instances, scrollPrev_fn).call(this, distance) : __privateMethod(this, _Paginator_instances, scrollNext_fn).call(this, distance));
  if (shouldGo) await __privateMethod(this, _Paginator_instances, goTo_fn).call(this, {
    index: __privateMethod(this, _Paginator_instances, adjacentIndex_fn).call(this, dir),
    anchor: prev ? () => 1 : () => 0
  });
  if (shouldGo || !this.hasAttribute("animated")) await wait(100);
  __privateSet(this, _locked, false);
};
__publicField(Paginator, "observedAttributes", [
  "flow",
  "gap",
  "margin",
  "max-inline-size",
  "max-block-size",
  "max-column-count"
]);
customElements.define("foliate-paginator", Paginator);
export {
  Paginator
};
