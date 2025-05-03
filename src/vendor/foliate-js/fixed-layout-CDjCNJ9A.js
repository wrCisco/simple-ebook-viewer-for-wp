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
const parseViewport = (str) => {
  var _a, _b;
  return (_b = (_a = str == null ? void 0 : str.split(/[,;\s]/)) == null ? void 0 : _a.filter((x) => x)) == null ? void 0 : _b.map((x) => x.split("=").map((x2) => x2.trim()));
};
const getViewport = (doc, viewport) => {
  var _a, _b;
  if (doc.documentElement.localName === "svg") {
    const [, , width, height] = ((_a = doc.documentElement.getAttribute("viewBox")) == null ? void 0 : _a.split(/\s/)) ?? [];
    return { width, height };
  }
  const meta = parseViewport((_b = doc.querySelector('meta[name="viewport"]')) == null ? void 0 : _b.getAttribute("content"));
  if (meta) return Object.fromEntries(meta);
  if (typeof viewport === "string") return parseViewport(viewport);
  if (viewport) return viewport;
  const img = doc.querySelector("img");
  if (img) return { width: img.naturalWidth, height: img.naturalHeight };
  console.warn(new Error("Missing viewport properties"));
  return { width: 1e3, height: 2e3 };
};
var _root, _observer, _spreads, _index, _portrait, _left, _right, _center, _side, _zoom, _FixedLayout_instances, createFrame_fn, render_fn, showSpread_fn, goLeft_fn, goRight_fn, reportLocation_fn;
class FixedLayout extends HTMLElement {
  constructor() {
    super();
    __privateAdd(this, _FixedLayout_instances);
    __privateAdd(this, _root, this.attachShadow({ mode: "closed" }));
    __privateAdd(this, _observer, new ResizeObserver(() => __privateMethod(this, _FixedLayout_instances, render_fn).call(this)));
    __privateAdd(this, _spreads);
    __privateAdd(this, _index, -1);
    __publicField(this, "defaultViewport");
    __publicField(this, "spread");
    __privateAdd(this, _portrait, false);
    __privateAdd(this, _left);
    __privateAdd(this, _right);
    __privateAdd(this, _center);
    __privateAdd(this, _side);
    __privateAdd(this, _zoom);
    const sheet = new CSSStyleSheet();
    __privateGet(this, _root).adoptedStyleSheets = [sheet];
    sheet.replaceSync(`:host {
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: auto;
        }`);
    __privateGet(this, _observer).observe(this);
  }
  attributeChangedCallback(name, _, value) {
    switch (name) {
      case "zoom":
        __privateSet(this, _zoom, value !== "fit-width" && value !== "fit-page" ? parseFloat(value) : value);
        __privateMethod(this, _FixedLayout_instances, render_fn).call(this);
        break;
    }
  }
  open(book) {
    this.book = book;
    const { rendition } = book;
    this.spread = rendition == null ? void 0 : rendition.spread;
    this.defaultViewport = rendition == null ? void 0 : rendition.viewport;
    const rtl = book.dir === "rtl";
    const ltr = !rtl;
    this.rtl = rtl;
    if ((rendition == null ? void 0 : rendition.spread) === "none")
      __privateSet(this, _spreads, book.sections.map((section) => ({ center: section })));
    else __privateSet(this, _spreads, book.sections.reduce((arr, section, i) => {
      const last = arr[arr.length - 1];
      const { pageSpread } = section;
      const newSpread = () => {
        const spread = {};
        arr.push(spread);
        return spread;
      };
      if (pageSpread === "center") {
        const spread = last.left || last.right ? newSpread() : last;
        spread.center = section;
      } else if (pageSpread === "left") {
        const spread = last.center || last.left || ltr && i ? newSpread() : last;
        spread.left = section;
      } else if (pageSpread === "right") {
        const spread = last.center || last.right || rtl && i ? newSpread() : last;
        spread.right = section;
      } else if (ltr) {
        if (last.center || last.right) newSpread().left = section;
        else if (last.left || !i) last.right = section;
        else last.left = section;
      } else {
        if (last.center || last.left) newSpread().right = section;
        else if (last.right || !i) last.left = section;
        else last.right = section;
      }
      return arr;
    }, [{}]));
  }
  get index() {
    const spread = __privateGet(this, _spreads)[__privateGet(this, _index)];
    const section = (spread == null ? void 0 : spread.center) ?? (this.side === "left" ? spread.left ?? spread.right : spread.right ?? spread.left);
    return this.book.sections.indexOf(section);
  }
  getSpreadOf(section) {
    const spreads = __privateGet(this, _spreads);
    for (let index = 0; index < spreads.length; index++) {
      const { left, right, center } = spreads[index];
      if (left === section) return { index, side: "left" };
      if (right === section) return { index, side: "right" };
      if (center === section) return { index, side: "center" };
    }
  }
  async goToSpread(index, side, reason) {
    var _a, _b, _c, _d, _e, _f;
    if (index < 0 || index > __privateGet(this, _spreads).length - 1) return;
    if (index === __privateGet(this, _index)) {
      __privateMethod(this, _FixedLayout_instances, render_fn).call(this, side);
      return;
    }
    __privateSet(this, _index, index);
    const spread = __privateGet(this, _spreads)[index];
    if (spread.center) {
      const index2 = this.book.sections.indexOf(spread.center);
      const src = await ((_b = (_a = spread.center) == null ? void 0 : _a.load) == null ? void 0 : _b.call(_a));
      await __privateMethod(this, _FixedLayout_instances, showSpread_fn).call(this, { center: { index: index2, src } });
    } else {
      const indexL = this.book.sections.indexOf(spread.left);
      const indexR = this.book.sections.indexOf(spread.right);
      const srcL = await ((_d = (_c = spread.left) == null ? void 0 : _c.load) == null ? void 0 : _d.call(_c));
      const srcR = await ((_f = (_e = spread.right) == null ? void 0 : _e.load) == null ? void 0 : _f.call(_e));
      const left = { index: indexL, src: srcL };
      const right = { index: indexR, src: srcR };
      await __privateMethod(this, _FixedLayout_instances, showSpread_fn).call(this, { left, right, side });
    }
    __privateMethod(this, _FixedLayout_instances, reportLocation_fn).call(this, reason);
  }
  async select(target) {
    await this.goTo(target);
  }
  async goTo(target) {
    const { book } = this;
    const resolved = await target;
    const section = book.sections[resolved.index];
    if (!section) return;
    const { index, side } = this.getSpreadOf(section);
    await this.goToSpread(index, side);
  }
  async next() {
    const s = this.rtl ? __privateMethod(this, _FixedLayout_instances, goLeft_fn).call(this) : __privateMethod(this, _FixedLayout_instances, goRight_fn).call(this);
    if (s) __privateMethod(this, _FixedLayout_instances, reportLocation_fn).call(this, "page");
    else return this.goToSpread(__privateGet(this, _index) + 1, this.rtl ? "right" : "left", "page");
  }
  async prev() {
    const s = this.rtl ? __privateMethod(this, _FixedLayout_instances, goRight_fn).call(this) : __privateMethod(this, _FixedLayout_instances, goLeft_fn).call(this);
    if (s) __privateMethod(this, _FixedLayout_instances, reportLocation_fn).call(this, "page");
    else return this.goToSpread(__privateGet(this, _index) - 1, this.rtl ? "left" : "right", "page");
  }
  getContents() {
    return Array.from(__privateGet(this, _root).querySelectorAll("iframe"), (frame) => ({
      doc: frame.contentDocument
      // TODO: index, overlayer
    }));
  }
  destroy() {
    __privateGet(this, _observer).unobserve(this);
  }
}
_root = new WeakMap();
_observer = new WeakMap();
_spreads = new WeakMap();
_index = new WeakMap();
_portrait = new WeakMap();
_left = new WeakMap();
_right = new WeakMap();
_center = new WeakMap();
_side = new WeakMap();
_zoom = new WeakMap();
_FixedLayout_instances = new WeakSet();
createFrame_fn = async function({ index, src: srcOption }) {
  const srcOptionIsString = typeof srcOption === "string";
  const src = srcOptionIsString ? srcOption : srcOption == null ? void 0 : srcOption.src;
  const onZoom = srcOptionIsString ? null : srcOption == null ? void 0 : srcOption.onZoom;
  const element = document.createElement("div");
  const iframe = document.createElement("iframe");
  element.append(iframe);
  Object.assign(iframe.style, {
    border: "0",
    display: "none",
    overflow: "hidden"
  });
  iframe.setAttribute("sandbox", "allow-same-origin allow-scripts");
  iframe.setAttribute("scrolling", "no");
  iframe.setAttribute("part", "filter");
  __privateGet(this, _root).append(element);
  if (!src) return { blank: true, element, iframe };
  return new Promise((resolve) => {
    iframe.addEventListener("load", () => {
      const doc = iframe.contentDocument;
      this.dispatchEvent(new CustomEvent("load", { detail: { doc, index } }));
      const { width, height } = getViewport(doc, this.defaultViewport);
      resolve({
        element,
        iframe,
        width: parseFloat(width),
        height: parseFloat(height),
        onZoom
      });
    }, { once: true });
    iframe.src = src;
  });
};
render_fn = function(side = __privateGet(this, _side)) {
  if (!side) return;
  const left = __privateGet(this, _left) ?? {};
  const right = __privateGet(this, _center) ?? __privateGet(this, _right);
  const target = side === "left" ? left : right;
  const { width, height } = this.getBoundingClientRect();
  const portrait = this.spread !== "both" && this.spread !== "portrait" && height > width;
  __privateSet(this, _portrait, portrait);
  const blankWidth = left.width ?? right.width;
  const blankHeight = left.height ?? right.height;
  const scale = typeof __privateGet(this, _zoom) === "number" && !isNaN(__privateGet(this, _zoom)) ? __privateGet(this, _zoom) : __privateGet(this, _zoom) === "fit-width" ? portrait || __privateGet(this, _center) ? width / (target.width ?? blankWidth) : width / ((left.width ?? blankWidth) + (right.width ?? blankWidth)) : portrait || __privateGet(this, _center) ? Math.min(
    width / (target.width ?? blankWidth),
    height / (target.height ?? blankHeight)
  ) : Math.min(
    width / ((left.width ?? blankWidth) + (right.width ?? blankWidth)),
    height / Math.max(
      left.height ?? blankHeight,
      right.height ?? blankHeight
    )
  );
  const transform = (frame) => {
    let { element, iframe, width: width2, height: height2, blank, onZoom } = frame;
    if (onZoom) onZoom({ doc: frame.iframe.contentDocument, scale });
    const iframeScale = onZoom ? scale : 1;
    Object.assign(iframe.style, {
      width: `${width2 * iframeScale}px`,
      height: `${height2 * iframeScale}px`,
      transform: onZoom ? "none" : `scale(${scale})`,
      transformOrigin: "top left",
      display: blank ? "none" : "block"
    });
    Object.assign(element.style, {
      width: `${(width2 ?? blankWidth) * scale}px`,
      height: `${(height2 ?? blankHeight) * scale}px`,
      overflow: "hidden",
      display: "block",
      flexShrink: "0",
      marginBlock: "auto"
    });
    if (portrait && frame !== target) {
      element.style.display = "none";
    }
  };
  if (__privateGet(this, _center)) {
    transform(__privateGet(this, _center));
  } else {
    transform(left);
    transform(right);
  }
};
showSpread_fn = async function({ left, right, center, side }) {
  __privateGet(this, _root).replaceChildren();
  __privateSet(this, _left, null);
  __privateSet(this, _right, null);
  __privateSet(this, _center, null);
  if (center) {
    __privateSet(this, _center, await __privateMethod(this, _FixedLayout_instances, createFrame_fn).call(this, center));
    __privateSet(this, _side, "center");
    __privateMethod(this, _FixedLayout_instances, render_fn).call(this);
  } else {
    __privateSet(this, _left, await __privateMethod(this, _FixedLayout_instances, createFrame_fn).call(this, left));
    __privateSet(this, _right, await __privateMethod(this, _FixedLayout_instances, createFrame_fn).call(this, right));
    __privateSet(this, _side, __privateGet(this, _left).blank ? "right" : __privateGet(this, _right).blank ? "left" : side);
    __privateMethod(this, _FixedLayout_instances, render_fn).call(this);
  }
};
goLeft_fn = function() {
  var _a, _b, _c, _d;
  if (__privateGet(this, _center) || ((_a = __privateGet(this, _left)) == null ? void 0 : _a.blank)) return;
  if (__privateGet(this, _portrait) && ((_d = (_c = (_b = __privateGet(this, _left)) == null ? void 0 : _b.element) == null ? void 0 : _c.style) == null ? void 0 : _d.display) === "none") {
    __privateGet(this, _right).element.style.display = "none";
    __privateGet(this, _left).element.style.display = "block";
    __privateSet(this, _side, "left");
    return true;
  }
};
goRight_fn = function() {
  var _a, _b, _c, _d;
  if (__privateGet(this, _center) || ((_a = __privateGet(this, _right)) == null ? void 0 : _a.blank)) return;
  if (__privateGet(this, _portrait) && ((_d = (_c = (_b = __privateGet(this, _right)) == null ? void 0 : _b.element) == null ? void 0 : _c.style) == null ? void 0 : _d.display) === "none") {
    __privateGet(this, _left).element.style.display = "none";
    __privateGet(this, _right).element.style.display = "block";
    __privateSet(this, _side, "right");
    return true;
  }
};
reportLocation_fn = function(reason) {
  this.dispatchEvent(new CustomEvent("relocate", { detail: { reason, range: null, index: this.index, fraction: 0, size: 1 } }));
};
__publicField(FixedLayout, "observedAttributes", ["zoom"]);
customElements.define("foliate-fxl", FixedLayout);
export {
  FixedLayout
};
