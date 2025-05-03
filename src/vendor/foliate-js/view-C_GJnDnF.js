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
var __privateWrapper = (obj, member, setter, getter) => ({
  set _(value) {
    __privateSet(obj, member, value, setter);
  },
  get _() {
    return __privateGet(obj, member, getter);
  }
});
const findIndices = (arr, f) => arr.map((x, i, a) => f(x, i, a) ? i : null).filter((x) => x != null);
const splitAt = (arr, is) => [-1, ...is, arr.length].reduce(({ xs, a }, b) => ({ xs: (xs == null ? void 0 : xs.concat([arr.slice(a + 1, b)])) ?? [], a: b }), {}).xs;
const concatArrays = (a, b) => a.slice(0, -1).concat([a[a.length - 1].concat(b[0])]).concat(b.slice(1));
const isNumber = /\d/;
const isCFI = /^epubcfi\((.*)\)$/;
const escapeCFI = (str) => str.replace(/[\^[\](),;=]/g, "^$&");
const wrap = (x) => isCFI.test(x) ? x : `epubcfi(${x})`;
const unwrap = (x) => {
  var _a;
  return ((_a = x.match(isCFI)) == null ? void 0 : _a[1]) ?? x;
};
const lift = (f) => (...xs) => `epubcfi(${f(...xs.map((x) => {
  var _a;
  return ((_a = x.match(isCFI)) == null ? void 0 : _a[1]) ?? x;
}))})`;
const joinIndir = lift((...xs) => xs.join("!"));
const tokenizer = (str) => {
  const tokens = [];
  let state, escape, value = "";
  const push = (x) => (tokens.push(x), state = null, value = "");
  const cat = (x) => (value += x, escape = false);
  for (const char of Array.from(str.trim()).concat("")) {
    if (char === "^" && !escape) {
      escape = true;
      continue;
    }
    if (state === "!") push(["!"]);
    else if (state === ",") push([","]);
    else if (state === "/" || state === ":") {
      if (isNumber.test(char)) {
        cat(char);
        continue;
      } else push([state, parseInt(value)]);
    } else if (state === "~") {
      if (isNumber.test(char) || char === ".") {
        cat(char);
        continue;
      } else push(["~", parseFloat(value)]);
    } else if (state === "@") {
      if (char === ":") {
        push(["@", parseFloat(value)]);
        state = "@";
        continue;
      }
      if (isNumber.test(char) || char === ".") {
        cat(char);
        continue;
      } else push(["@", parseFloat(value)]);
    } else if (state === "[") {
      if (char === ";" && !escape) {
        push(["[", value]);
        state = ";";
      } else if (char === "," && !escape) {
        push(["[", value]);
        state = "[";
      } else if (char === "]" && !escape) push(["[", value]);
      else cat(char);
      continue;
    } else if (state == null ? void 0 : state.startsWith(";")) {
      if (char === "=" && !escape) {
        state = `;${value}`;
        value = "";
      } else if (char === ";" && !escape) {
        push([state, value]);
        state = ";";
      } else if (char === "]" && !escape) push([state, value]);
      else cat(char);
      continue;
    }
    if (char === "/" || char === ":" || char === "~" || char === "@" || char === "[" || char === "!" || char === ",") state = char;
  }
  return tokens;
};
const findTokens = (tokens, x) => findIndices(tokens, ([t]) => t === x);
const parser = (tokens) => {
  const parts = [];
  let state;
  for (const [type, val] of tokens) {
    if (type === "/") parts.push({ index: val });
    else {
      const last = parts[parts.length - 1];
      if (type === ":") last.offset = val;
      else if (type === "~") last.temporal = val;
      else if (type === "@") last.spatial = (last.spatial ?? []).concat(val);
      else if (type === ";s") last.side = val;
      else if (type === "[") {
        if (state === "/" && val) last.id = val;
        else {
          last.text = (last.text ?? []).concat(val);
          continue;
        }
      }
    }
    state = type;
  }
  return parts;
};
const parserIndir = (tokens) => splitAt(tokens, findTokens(tokens, "!")).map(parser);
const parse = (cfi) => {
  const tokens = tokenizer(unwrap(cfi));
  const commas = findTokens(tokens, ",");
  if (!commas.length) return parserIndir(tokens);
  const [parent, start, end] = splitAt(tokens, commas).map(parserIndir);
  return { parent, start, end };
};
const partToString = ({ index, id, offset, temporal, spatial, text, side }) => {
  var _a;
  const param = side ? `;s=${side}` : "";
  return `/${index}` + (id ? `[${escapeCFI(id)}${param}]` : "") + (offset != null && index % 2 ? `:${offset}` : "") + (temporal ? `~${temporal}` : "") + (spatial ? `@${spatial.join(":")}` : "") + (text || !id && side ? "[" + (((_a = text == null ? void 0 : text.map(escapeCFI)) == null ? void 0 : _a.join(",")) ?? "") + param + "]" : "");
};
const toInnerString = (parsed) => parsed.parent ? [parsed.parent, parsed.start, parsed.end].map(toInnerString).join(",") : parsed.map((parts) => parts.map(partToString).join("")).join("!");
const toString = (parsed) => wrap(toInnerString(parsed));
const collapse = (x, toEnd) => typeof x === "string" ? toString(collapse(parse(x), toEnd)) : x.parent ? concatArrays(x.parent, x[toEnd ? "end" : "start"]) : x;
const buildRange = (from, to) => {
  if (typeof from === "string") from = parse(from);
  if (typeof to === "string") to = parse(to);
  from = collapse(from);
  to = collapse(to, true);
  const localFrom = from[from.length - 1], localTo = to[to.length - 1];
  const localParent = [], localStart = [], localEnd = [];
  let pushToParent = true;
  const len = Math.max(localFrom.length, localTo.length);
  for (let i = 0; i < len; i++) {
    const a = localFrom[i], b = localTo[i];
    pushToParent && (pushToParent = (a == null ? void 0 : a.index) === (b == null ? void 0 : b.index) && !(a == null ? void 0 : a.offset) && !(b == null ? void 0 : b.offset));
    if (pushToParent) localParent.push(a);
    else {
      if (a) localStart.push(a);
      if (b) localEnd.push(b);
    }
  }
  const parent = from.slice(0, -1).concat([localParent]);
  return toString({ parent, start: [localStart], end: [localEnd] });
};
const compare = (a, b) => {
  if (typeof a === "string") a = parse(a);
  if (typeof b === "string") b = parse(b);
  if (a.start || b.start) return compare(collapse(a), collapse(b)) || compare(collapse(a, true), collapse(b, true));
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const p = a[i] ?? [], q = b[i] ?? [];
    const maxIndex = Math.max(p.length, q.length) - 1;
    for (let i2 = 0; i2 <= maxIndex; i2++) {
      const x = p[i2], y = q[i2];
      if (!x) return -1;
      if (!y) return 1;
      if (x.index > y.index) return 1;
      if (x.index < y.index) return -1;
      if (i2 === maxIndex) {
        if (x.offset > y.offset) return 1;
        if (x.offset < y.offset) return -1;
      }
    }
  }
  return 0;
};
const isTextNode = ({ nodeType }) => nodeType === 3 || nodeType === 4;
const isElementNode = ({ nodeType }) => nodeType === 1;
const getChildNodes = (node, filter2) => {
  const nodes = Array.from(node.childNodes).filter((node2) => isTextNode(node2) || isElementNode(node2));
  return filter2 ? nodes.map((node2) => {
    const accept = filter2(node2);
    if (accept === NodeFilter.FILTER_REJECT) return null;
    else if (accept === NodeFilter.FILTER_SKIP) return getChildNodes(node2, filter2);
    else return node2;
  }).flat().filter((x) => x) : nodes;
};
const indexChildNodes = (node, filter2) => {
  const nodes = getChildNodes(node, filter2).reduce((arr, node2) => {
    let last = arr[arr.length - 1];
    if (!last) arr.push(node2);
    else if (isTextNode(node2)) {
      if (Array.isArray(last)) last.push(node2);
      else if (isTextNode(last)) arr[arr.length - 1] = [last, node2];
      else arr.push(node2);
    } else {
      if (isElementNode(last)) arr.push(null, node2);
      else arr.push(node2);
    }
    return arr;
  }, []);
  if (isElementNode(nodes[0])) nodes.unshift("first");
  if (isElementNode(nodes[nodes.length - 1])) nodes.push("last");
  nodes.unshift("before");
  nodes.push("after");
  return nodes;
};
const partsToNode = (node, parts, filter2) => {
  const { id } = parts[parts.length - 1];
  if (id) {
    const el = node.ownerDocument.getElementById(id);
    if (el) return { node: el, offset: 0 };
  }
  for (const { index } of parts) {
    const newNode = node ? indexChildNodes(node, filter2)[index] : null;
    if (newNode === "first") return { node: node.firstChild ?? node };
    if (newNode === "last") return { node: node.lastChild ?? node };
    if (newNode === "before") return { node, before: true };
    if (newNode === "after") return { node, after: true };
    node = newNode;
  }
  const { offset } = parts[parts.length - 1];
  if (!Array.isArray(node)) return { node, offset };
  let sum = 0;
  for (const n of node) {
    const { length } = n.nodeValue;
    if (sum + length >= offset) return { node: n, offset: offset - sum };
    sum += length;
  }
};
const nodeToParts = (node, offset, filter2) => {
  const { parentNode, id } = node;
  const indexed = indexChildNodes(parentNode, filter2);
  const index = indexed.findIndex((x) => Array.isArray(x) ? x.some((x2) => x2 === node) : x === node);
  const chunk = indexed[index];
  if (Array.isArray(chunk)) {
    let sum = 0;
    for (const x of chunk) {
      if (x === node) {
        sum += offset;
        break;
      } else sum += x.nodeValue.length;
    }
    offset = sum;
  }
  const part = { id, index, offset };
  return (parentNode !== node.ownerDocument.documentElement ? nodeToParts(parentNode, null, filter2).concat(part) : [part]).filter((x) => x.index !== -1);
};
const fromRange = (range, filter2) => {
  const { startContainer, startOffset, endContainer, endOffset } = range;
  const start = nodeToParts(startContainer, startOffset, filter2);
  if (range.collapsed) return toString([start]);
  const end = nodeToParts(endContainer, endOffset, filter2);
  return buildRange([start], [end]);
};
const toRange = (doc, parts, filter2) => {
  const startParts = collapse(parts);
  const endParts = collapse(parts, true);
  const root = doc.documentElement;
  const start = partsToNode(root, startParts[0], filter2);
  const end = partsToNode(root, endParts[0], filter2);
  const range = doc.createRange();
  if (start.before) range.setStartBefore(start.node);
  else if (start.after) range.setStartAfter(start.node);
  else range.setStart(start.node, start.offset);
  if (end.before) range.setEndBefore(end.node);
  else if (end.after) range.setEndAfter(end.node);
  else range.setEnd(end.node, end.offset);
  return range;
};
const fromElements = (elements) => {
  const results = [];
  const { parentNode } = elements[0];
  const parts = nodeToParts(parentNode);
  for (const [index, node] of indexChildNodes(parentNode).entries()) {
    const el = elements[results.length];
    if (node === el)
      results.push(toString([parts.concat({ id: el.id, index })]));
  }
  return results;
};
const toElement = (doc, parts) => partsToNode(doc.documentElement, collapse(parts)).node;
const fake = {
  fromIndex: (index) => wrap(`/6/${(index + 1) * 2}`),
  toIndex: (parts) => (parts == null ? void 0 : parts.at(-1).index) / 2 - 1
};
const fromCalibrePos = (pos) => {
  const [parts] = parse(pos);
  const item = parts.shift();
  parts.shift();
  return toString([[{ index: 6 }, item], parts]);
};
const fromCalibreHighlight = ({ spine_index, start_cfi, end_cfi }) => {
  const pre = fake.fromIndex(spine_index) + "!";
  return buildRange(pre + start_cfi.slice(2), pre + end_cfi.slice(2));
};
const epubcfi = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  collapse,
  compare,
  fake,
  fromCalibreHighlight,
  fromCalibrePos,
  fromElements,
  fromRange,
  isCFI,
  joinIndir,
  parse,
  toElement,
  toRange
}, Symbol.toStringTag, { value: "Module" }));
const assignIDs = (toc) => {
  let id = 0;
  const assignID = (item) => {
    item.id = id++;
    if (item.subitems) for (const subitem of item.subitems) assignID(subitem);
  };
  for (const item of toc) assignID(item);
  return toc;
};
const flatten = (items) => items.map((item) => {
  var _a;
  return ((_a = item.subitems) == null ? void 0 : _a.length) ? [item, flatten(item.subitems)].flat() : item;
}).flat();
class TOCProgress {
  async init({ toc, ids, splitHref, getFragment }) {
    assignIDs(toc);
    const items = flatten(toc);
    const grouped = /* @__PURE__ */ new Map();
    for (const [i, item] of items.entries()) {
      const [id, fragment] = await splitHref(item == null ? void 0 : item.href) ?? [];
      const value = { fragment, item };
      if (grouped.has(id)) grouped.get(id).items.push(value);
      else grouped.set(id, { prev: items[i - 1], items: [value] });
    }
    const map = /* @__PURE__ */ new Map();
    for (const [i, id] of ids.entries()) {
      if (grouped.has(id)) map.set(id, grouped.get(id));
      else map.set(id, map.get(ids[i - 1]));
    }
    this.ids = ids;
    this.map = map;
    this.getFragment = getFragment;
  }
  getProgress(index, range) {
    var _a;
    if (!this.ids) return;
    const id = this.ids[index];
    const obj = this.map.get(id);
    if (!obj) return null;
    const { prev, items } = obj;
    if (!items) return prev;
    if (!range || items.length === 1 && !items[0].fragment) return items[0].item;
    const doc = range.startContainer.getRootNode();
    for (const [i, { fragment }] of items.entries()) {
      const el = this.getFragment(doc, fragment);
      if (!el) continue;
      if (range.comparePoint(el, 0) > 0)
        return ((_a = items[i - 1]) == null ? void 0 : _a.item) ?? prev;
    }
    return items[items.length - 1].item;
  }
}
var _SectionProgress_instances, getSectionFractions_fn;
class SectionProgress {
  constructor(sections, sizePerLoc, sizePerTimeUnit) {
    __privateAdd(this, _SectionProgress_instances);
    this.sizes = sections.map((s) => s.linear != "no" && s.size > 0 ? s.size : 0);
    this.sizePerLoc = sizePerLoc;
    this.sizePerTimeUnit = sizePerTimeUnit;
    this.sizeTotal = this.sizes.reduce((a, b) => a + b, 0);
    this.sectionFractions = __privateMethod(this, _SectionProgress_instances, getSectionFractions_fn).call(this);
  }
  // get progress given index of and fractions within a section
  getProgress(index, fractionInSection, pageFraction = 0) {
    const { sizes, sizePerLoc, sizePerTimeUnit, sizeTotal } = this;
    const sizeInSection = sizes[index] ?? 0;
    const sizeBefore = sizes.slice(0, index).reduce((a, b) => a + b, 0);
    const size = sizeBefore + fractionInSection * sizeInSection;
    const nextSize = size + pageFraction * sizeInSection;
    const remainingTotal = sizeTotal - size;
    const remainingSection = (1 - fractionInSection) * sizeInSection;
    return {
      fraction: nextSize / sizeTotal,
      section: {
        current: index,
        total: sizes.length
      },
      location: {
        current: Math.floor(size / sizePerLoc),
        next: Math.floor(nextSize / sizePerLoc),
        total: Math.ceil(sizeTotal / sizePerLoc)
      },
      time: {
        section: remainingSection / sizePerTimeUnit,
        total: remainingTotal / sizePerTimeUnit
      }
    };
  }
  // the inverse of `getProgress`
  // get index of and fraction in section based on total fraction
  getSection(fraction) {
    if (fraction <= 0) return [0, 0];
    if (fraction >= 1) return [this.sizes.length - 1, 1];
    fraction = fraction + Number.EPSILON;
    const { sizeTotal } = this;
    let index = this.sectionFractions.findIndex((x) => x > fraction) - 1;
    if (index < 0) return [0, 0];
    while (!this.sizes[index]) index++;
    const fractionInSection = (fraction - this.sectionFractions[index]) / (this.sizes[index] / sizeTotal);
    return [index, fractionInSection];
  }
}
_SectionProgress_instances = new WeakSet();
getSectionFractions_fn = function() {
  const { sizeTotal } = this;
  const results = [0];
  let sum = 0;
  for (const size of this.sizes) results.push((sum += size) / sizeTotal);
  return results;
};
const createSVGElement = (tag) => document.createElementNS("http://www.w3.org/2000/svg", tag);
var _svg, _map;
class Overlayer {
  constructor() {
    __privateAdd(this, _svg, createSVGElement("svg"));
    __privateAdd(this, _map, /* @__PURE__ */ new Map());
    Object.assign(__privateGet(this, _svg).style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none"
    });
  }
  get element() {
    return __privateGet(this, _svg);
  }
  add(key, range, draw, options) {
    if (__privateGet(this, _map).has(key)) this.remove(key);
    if (typeof range === "function") range = range(__privateGet(this, _svg).getRootNode());
    const rects = range.getClientRects();
    const element = draw(rects, options);
    __privateGet(this, _svg).append(element);
    __privateGet(this, _map).set(key, { range, draw, options, element, rects });
  }
  remove(key) {
    if (!__privateGet(this, _map).has(key)) return;
    __privateGet(this, _svg).removeChild(__privateGet(this, _map).get(key).element);
    __privateGet(this, _map).delete(key);
  }
  redraw() {
    for (const obj of __privateGet(this, _map).values()) {
      const { range, draw, options, element } = obj;
      __privateGet(this, _svg).removeChild(element);
      const rects = range.getClientRects();
      const el = draw(rects, options);
      __privateGet(this, _svg).append(el);
      obj.element = el;
      obj.rects = rects;
    }
  }
  hitTest({ x, y }) {
    const arr = Array.from(__privateGet(this, _map).entries());
    for (let i = arr.length - 1; i >= 0; i--) {
      const [key, obj] = arr[i];
      for (const { left, top, right, bottom } of obj.rects)
        if (top <= y && left <= x && bottom > y && right > x)
          return [key, obj.range];
    }
    return [];
  }
  static underline(rects, options = {}) {
    const { color = "red", width: strokeWidth = 2, writingMode } = options;
    const g = createSVGElement("g");
    g.setAttribute("fill", color);
    if (writingMode === "vertical-rl" || writingMode === "vertical-lr")
      for (const { right, top, height } of rects) {
        const el = createSVGElement("rect");
        el.setAttribute("x", right - strokeWidth);
        el.setAttribute("y", top);
        el.setAttribute("height", height);
        el.setAttribute("width", strokeWidth);
        g.append(el);
      }
    else for (const { left, bottom, width } of rects) {
      const el = createSVGElement("rect");
      el.setAttribute("x", left);
      el.setAttribute("y", bottom - strokeWidth);
      el.setAttribute("height", strokeWidth);
      el.setAttribute("width", width);
      g.append(el);
    }
    return g;
  }
  static strikethrough(rects, options = {}) {
    const { color = "red", width: strokeWidth = 2, writingMode } = options;
    const g = createSVGElement("g");
    g.setAttribute("fill", color);
    if (writingMode === "vertical-rl" || writingMode === "vertical-lr")
      for (const { right, left, top, height } of rects) {
        const el = createSVGElement("rect");
        el.setAttribute("x", (right + left) / 2);
        el.setAttribute("y", top);
        el.setAttribute("height", height);
        el.setAttribute("width", strokeWidth);
        g.append(el);
      }
    else for (const { left, top, bottom, width } of rects) {
      const el = createSVGElement("rect");
      el.setAttribute("x", left);
      el.setAttribute("y", (top + bottom) / 2);
      el.setAttribute("height", strokeWidth);
      el.setAttribute("width", width);
      g.append(el);
    }
    return g;
  }
  static squiggly(rects, options = {}) {
    const { color = "red", width: strokeWidth = 2, writingMode } = options;
    const g = createSVGElement("g");
    g.setAttribute("fill", "none");
    g.setAttribute("stroke", color);
    g.setAttribute("stroke-width", strokeWidth);
    const block = strokeWidth * 1.5;
    if (writingMode === "vertical-rl" || writingMode === "vertical-lr")
      for (const { right, top, height } of rects) {
        const el = createSVGElement("path");
        const n = Math.round(height / block / 1.5);
        const inline = height / n;
        const ls = Array.from(
          { length: n },
          (_, i) => `l${i % 2 ? -block : block} ${inline}`
        ).join("");
        el.setAttribute("d", `M${right} ${top}${ls}`);
        g.append(el);
      }
    else for (const { left, bottom, width } of rects) {
      const el = createSVGElement("path");
      const n = Math.round(width / block / 1.5);
      const inline = width / n;
      const ls = Array.from(
        { length: n },
        (_, i) => `l${inline} ${i % 2 ? block : -block}`
      ).join("");
      el.setAttribute("d", `M${left} ${bottom}${ls}`);
      g.append(el);
    }
    return g;
  }
  static highlight(rects, options = {}) {
    const { color = "red" } = options;
    const g = createSVGElement("g");
    g.setAttribute("fill", color);
    g.style.opacity = "var(--overlayer-highlight-opacity, .3)";
    g.style.mixBlendMode = "var(--overlayer-highlight-blend-mode, normal)";
    for (const { left, top, height, width } of rects) {
      const el = createSVGElement("rect");
      el.setAttribute("x", left);
      el.setAttribute("y", top);
      el.setAttribute("height", height);
      el.setAttribute("width", width);
      g.append(el);
    }
    return g;
  }
  static outline(rects, options = {}) {
    const { color = "red", width: strokeWidth = 3, radius = 3 } = options;
    const g = createSVGElement("g");
    g.setAttribute("fill", "none");
    g.setAttribute("stroke", color);
    g.setAttribute("stroke-width", strokeWidth);
    for (const { left, top, height, width } of rects) {
      const el = createSVGElement("rect");
      el.setAttribute("x", left);
      el.setAttribute("y", top);
      el.setAttribute("height", height);
      el.setAttribute("width", width);
      el.setAttribute("rx", radius);
      g.append(el);
    }
    return g;
  }
  // make an exact copy of an image in the overlay
  // one can then apply filters to the entire element, without affecting them;
  // it's a bit silly and probably better to just invert images twice
  // (though the color will be off in that case if you do heu-rotate)
  static copyImage([rect], options = {}) {
    const { src } = options;
    const image = createSVGElement("image");
    const { left, top, height, width } = rect;
    image.setAttribute("href", src);
    image.setAttribute("x", left);
    image.setAttribute("y", top);
    image.setAttribute("height", height);
    image.setAttribute("width", width);
    return image;
  }
}
_svg = new WeakMap();
_map = new WeakMap();
const walkRange = (range, walker) => {
  const nodes = [];
  for (let node = walker.currentNode; node; node = walker.nextNode()) {
    const compare2 = range.comparePoint(node, 0);
    if (compare2 === 0) nodes.push(node);
    else if (compare2 > 0) break;
  }
  return nodes;
};
const walkDocument = (_, walker) => {
  const nodes = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode())
    nodes.push(node);
  return nodes;
};
const filter = NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_CDATA_SECTION;
const acceptNode = (node) => {
  if (node.nodeType === 1) {
    const name = node.tagName.toLowerCase();
    if (name === "script" || name === "style") return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_SKIP;
  }
  return NodeFilter.FILTER_ACCEPT;
};
const textWalker = function* (x, func) {
  const root = x.commonAncestorContainer ?? x.body ?? x;
  const walker = document.createTreeWalker(root, filter, { acceptNode });
  const walk = x.commonAncestorContainer ? walkRange : walkDocument;
  const nodes = walk(x, walker);
  const strs = nodes.map((node) => node.nodeValue);
  const makeRange = (startIndex, startOffset, endIndex, endOffset) => {
    const range = document.createRange();
    range.setStart(nodes[startIndex], startOffset);
    range.setEnd(nodes[endIndex], endOffset);
    return range;
  };
  for (const match of func(strs, makeRange)) yield match;
};
const SEARCH_PREFIX = "foliate-search:";
const isZip = async (file) => {
  const arr = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return arr[0] === 80 && arr[1] === 75 && arr[2] === 3 && arr[3] === 4;
};
const isPDF = async (file) => {
  const arr = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return arr[0] === 37 && arr[1] === 80 && arr[2] === 68 && arr[3] === 70 && arr[4] === 45;
};
const isCBZ = ({ name, type }) => type === "application/vnd.comicbook+zip" || name.endsWith(".cbz");
const isFB2 = ({ name, type }) => type === "application/x-fictionbook+xml" || name.endsWith(".fb2");
const isFBZ = ({ name, type }) => type === "application/x-zip-compressed-fb2" || name.endsWith(".fb2.zip") || name.endsWith(".fbz");
const makeZipLoader = async (file) => {
  const { configure, ZipReader, BlobReader, TextWriter, BlobWriter } = await import("./zip-B0nO2xi-.js");
  configure({ useWebWorkers: false });
  const reader = new ZipReader(new BlobReader(file));
  const entries = await reader.getEntries();
  const map = new Map(entries.map((entry) => [entry.filename, entry]));
  const load = (f) => (name, ...args) => map.has(name) ? f(map.get(name), ...args) : null;
  const loadText = load((entry) => entry.getData(new TextWriter()));
  const loadBlob = load((entry, type) => entry.getData(new BlobWriter(type)));
  const getSize = (name) => {
    var _a;
    return ((_a = map.get(name)) == null ? void 0 : _a.uncompressedSize) ?? 0;
  };
  return { entries, loadText, loadBlob, getSize };
};
const getFileEntries = async (entry) => entry.isFile ? entry : (await Promise.all(Array.from(
  await new Promise((resolve, reject) => entry.createReader().readEntries((entries) => resolve(entries), (error) => reject(error))),
  getFileEntries
))).flat();
const makeDirectoryLoader = async (entry) => {
  const entries = await getFileEntries(entry);
  const files = await Promise.all(
    entries.map((entry2) => new Promise((resolve, reject) => entry2.file(
      (file) => resolve([file, entry2.fullPath]),
      (error) => reject(error)
    )))
  );
  const map = new Map(files.map(([file, path]) => [path.replace(entry.fullPath + "/", ""), file]));
  const decoder = new TextDecoder();
  const decode = (x) => x ? decoder.decode(x) : null;
  const getBuffer = (name) => {
    var _a;
    return ((_a = map.get(name)) == null ? void 0 : _a.arrayBuffer()) ?? null;
  };
  const loadText = async (name) => decode(await getBuffer(name));
  const loadBlob = (name) => map.get(name);
  const getSize = (name) => {
    var _a;
    return ((_a = map.get(name)) == null ? void 0 : _a.size) ?? 0;
  };
  return { loadText, loadBlob, getSize };
};
class ResponseError extends Error {
}
class NotFoundError extends Error {
}
class UnsupportedTypeError extends Error {
}
const fetchFile = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new ResponseError(
    `${res.status} ${res.statusText}`,
    { cause: res }
  );
  return new File([await res.blob()], new URL(res.url).pathname);
};
const makeBook = async (file) => {
  if (typeof file === "string") file = await fetchFile(file);
  let book;
  if (file.isDirectory) {
    const loader = await makeDirectoryLoader(file);
    const { EPUB } = await import("./epub-BS0lqq7J.js");
    book = await new EPUB(loader).init();
  } else if (!file.size) throw new NotFoundError("File not found");
  else if (await isZip(file)) {
    const loader = await makeZipLoader(file);
    if (isCBZ(file)) {
      const { makeComicBook } = await import("./comic-book-C2zZwt3m.js");
      book = makeComicBook(loader, file);
    } else if (isFBZ(file)) {
      const { makeFB2 } = await import("./fb2-BZ-PbCUN.js");
      const { entries } = loader;
      const entry = entries.find((entry2) => entry2.filename.endsWith(".fb2"));
      const blob = await loader.loadBlob((entry ?? entries[0]).filename);
      book = await makeFB2(blob);
    } else {
      const { EPUB } = await import("./epub-BS0lqq7J.js");
      book = await new EPUB(loader).init();
    }
  } else if (await isPDF(file)) {
    const { makePDF } = await import("./pdf-mq8eyRvm.js").then((n) => n.a);
    book = await makePDF(file);
  } else {
    const { isMOBI, MOBI } = await import("./mobi-Dk3uVLgX.js");
    if (await isMOBI(file)) {
      const fflate = await import("./fflate-CGQy9J7g.js");
      book = await new MOBI({ unzlib: fflate.unzlibSync }).open(file);
    } else if (isFB2(file)) {
      const { makeFB2 } = await import("./fb2-BZ-PbCUN.js");
      book = await makeFB2(file);
    }
  }
  if (!book) throw new UnsupportedTypeError("File type not supported");
  return book;
};
var _timeout, _el, _check, _state;
const _CursorAutohider = class _CursorAutohider {
  constructor(el, check, state = {}) {
    __privateAdd(this, _timeout);
    __privateAdd(this, _el);
    __privateAdd(this, _check);
    __privateAdd(this, _state);
    __privateSet(this, _el, el);
    __privateSet(this, _check, check);
    __privateSet(this, _state, state);
    if (__privateGet(this, _state).hidden) this.hide();
    __privateGet(this, _el).addEventListener("mousemove", ({ screenX, screenY }) => {
      if (screenX === __privateGet(this, _state).x && screenY === __privateGet(this, _state).y) return;
      __privateGet(this, _state).x = screenX, __privateGet(this, _state).y = screenY;
      this.show();
      if (__privateGet(this, _timeout)) clearTimeout(__privateGet(this, _timeout));
      if (check()) __privateSet(this, _timeout, setTimeout(this.hide.bind(this), 1e3));
    }, false);
  }
  cloneFor(el) {
    return new _CursorAutohider(el, __privateGet(this, _check), __privateGet(this, _state));
  }
  hide() {
    __privateGet(this, _el).style.cursor = "none";
    __privateGet(this, _state).hidden = true;
  }
  show() {
    __privateGet(this, _el).style.removeProperty("cursor");
    __privateGet(this, _state).hidden = false;
  }
};
_timeout = new WeakMap();
_el = new WeakMap();
_check = new WeakMap();
_state = new WeakMap();
let CursorAutohider = _CursorAutohider;
var _arr, _index;
class History extends EventTarget {
  constructor() {
    super(...arguments);
    __privateAdd(this, _arr, []);
    __privateAdd(this, _index, -1);
  }
  pushState(x) {
    const last = __privateGet(this, _arr)[__privateGet(this, _index)];
    if (last === x || (last == null ? void 0 : last.fraction) && last.fraction === x.fraction) return;
    __privateGet(this, _arr)[++__privateWrapper(this, _index)._] = x;
    __privateGet(this, _arr).length = __privateGet(this, _index) + 1;
    this.dispatchEvent(new Event("index-change"));
  }
  replaceState(x) {
    const index = __privateGet(this, _index);
    __privateGet(this, _arr)[index] = x;
  }
  back() {
    const index = __privateGet(this, _index);
    if (index <= 0) return;
    const detail = { state: __privateGet(this, _arr)[index - 1] };
    __privateSet(this, _index, index - 1);
    this.dispatchEvent(new CustomEvent("popstate", { detail }));
    this.dispatchEvent(new Event("index-change"));
  }
  forward() {
    const index = __privateGet(this, _index);
    if (index >= __privateGet(this, _arr).length - 1) return;
    const detail = { state: __privateGet(this, _arr)[index + 1] };
    __privateSet(this, _index, index + 1);
    this.dispatchEvent(new CustomEvent("popstate", { detail }));
    this.dispatchEvent(new Event("index-change"));
  }
  get canGoBack() {
    return __privateGet(this, _index) > 0;
  }
  get canGoForward() {
    return __privateGet(this, _index) < __privateGet(this, _arr).length - 1;
  }
  clear() {
    __privateSet(this, _arr, []);
    __privateSet(this, _index, -1);
  }
}
_arr = new WeakMap();
_index = new WeakMap();
const languageInfo = (lang) => {
  var _a, _b;
  if (!lang) return {};
  try {
    const canonical = Intl.getCanonicalLocales(lang)[0];
    const locale = new Intl.Locale(canonical);
    const isCJK = ["zh", "ja", "kr"].includes(locale.language);
    const direction = (_b = ((_a = locale.getTextInfo) == null ? void 0 : _a.call(locale)) ?? locale.textInfo) == null ? void 0 : _b.direction;
    return { canonical, locale, isCJK, direction };
  } catch (e) {
    console.warn(e);
    return {};
  }
};
var _root, _sectionProgress, _tocProgress, _pageProgress, _searchResults, _cursorAutohider, _View_instances, emit_fn, onRelocate_fn, onLoad_fn, handleLinks_fn, getOverlayer_fn, createOverlayer_fn, searchSection_fn, searchBook_fn;
class View extends HTMLElement {
  constructor() {
    super();
    __privateAdd(this, _View_instances);
    __privateAdd(this, _root, this.attachShadow({ mode: "closed" }));
    __privateAdd(this, _sectionProgress);
    __privateAdd(this, _tocProgress);
    __privateAdd(this, _pageProgress);
    __privateAdd(this, _searchResults, /* @__PURE__ */ new Map());
    __privateAdd(this, _cursorAutohider, new CursorAutohider(this, () => this.hasAttribute("autohide-cursor")));
    __publicField(this, "isFixedLayout", false);
    __publicField(this, "lastLocation");
    __publicField(this, "history", new History());
    this.history.addEventListener("popstate", ({ detail }) => {
      const resolved = this.resolveNavigation(detail.state);
      this.renderer.goTo(resolved);
    });
  }
  async open(book) {
    var _a, _b;
    if (typeof book === "string" || typeof book.arrayBuffer === "function" || book.isDirectory) book = await makeBook(book);
    this.book = book;
    this.language = languageInfo((_a = book.metadata) == null ? void 0 : _a.language);
    if (book.splitTOCHref && book.getTOCFragment) {
      const ids = book.sections.map((s) => s.id);
      __privateSet(this, _sectionProgress, new SectionProgress(book.sections, 1500, 1600));
      const splitHref = book.splitTOCHref.bind(book);
      const getFragment = book.getTOCFragment.bind(book);
      __privateSet(this, _tocProgress, new TOCProgress());
      await __privateGet(this, _tocProgress).init({
        toc: book.toc ?? [],
        ids,
        splitHref,
        getFragment
      });
      __privateSet(this, _pageProgress, new TOCProgress());
      await __privateGet(this, _pageProgress).init({
        toc: book.pageList ?? [],
        ids,
        splitHref,
        getFragment
      });
    }
    this.isFixedLayout = ((_b = this.book.rendition) == null ? void 0 : _b.layout) === "pre-paginated";
    if (this.isFixedLayout) {
      await import("./fixed-layout-CDjCNJ9A.js");
      this.renderer = document.createElement("foliate-fxl");
    } else {
      await import("./paginator-CTCHaZVZ.js");
      this.renderer = document.createElement("foliate-paginator");
    }
    this.renderer.setAttribute("exportparts", "head,foot,filter");
    this.renderer.addEventListener("load", (e) => __privateMethod(this, _View_instances, onLoad_fn).call(this, e.detail));
    this.renderer.addEventListener("relocate", (e) => __privateMethod(this, _View_instances, onRelocate_fn).call(this, e.detail));
    this.renderer.addEventListener("create-overlayer", (e) => e.detail.attach(__privateMethod(this, _View_instances, createOverlayer_fn).call(this, e.detail)));
    this.renderer.open(book);
    __privateGet(this, _root).append(this.renderer);
    if (book.sections.some((section) => section.mediaOverlay)) {
      const activeClass = book.media.activeClass;
      const playbackActiveClass = book.media.playbackActiveClass;
      this.mediaOverlay = book.getMediaOverlay();
      let lastActive;
      this.mediaOverlay.addEventListener("highlight", (e) => {
        const resolved = this.resolveNavigation(e.detail.text);
        this.renderer.goTo(resolved).then(() => {
          const { doc } = this.renderer.getContents().find((x) => x.index = resolved.index);
          const el = resolved.anchor(doc);
          el.classList.add(activeClass);
          if (playbackActiveClass) el.ownerDocument.documentElement.classList.add(playbackActiveClass);
          lastActive = new WeakRef(el);
        });
      });
      this.mediaOverlay.addEventListener("unhighlight", () => {
        const el = lastActive == null ? void 0 : lastActive.deref();
        if (el) {
          el.classList.remove(activeClass);
          if (playbackActiveClass) el.ownerDocument.documentElement.classList.remove(playbackActiveClass);
        }
      });
    }
  }
  close() {
    var _a, _b;
    (_a = this.renderer) == null ? void 0 : _a.destroy();
    (_b = this.renderer) == null ? void 0 : _b.remove();
    __privateSet(this, _sectionProgress, null);
    __privateSet(this, _tocProgress, null);
    __privateSet(this, _pageProgress, null);
    __privateSet(this, _searchResults, /* @__PURE__ */ new Map());
    this.lastLocation = null;
    this.history.clear();
    this.tts = null;
    this.mediaOverlay = null;
  }
  goToTextStart() {
    var _a, _b;
    return this.goTo(((_b = (_a = this.book.landmarks) == null ? void 0 : _a.find((m) => m.type.includes("bodymatter") || m.type.includes("text"))) == null ? void 0 : _b.href) ?? this.book.sections.findIndex((s) => s.linear !== "no"));
  }
  async init({ lastLocation, showTextStart }) {
    const resolved = lastLocation ? this.resolveNavigation(lastLocation) : null;
    if (resolved) {
      await this.renderer.goTo(resolved);
      this.history.pushState(lastLocation);
    } else if (showTextStart) await this.goToTextStart();
    else {
      this.history.pushState(0);
      await this.next();
    }
  }
  async addAnnotation(annotation, remove) {
    var _a;
    const { value } = annotation;
    if (value.startsWith(SEARCH_PREFIX)) {
      const cfi = value.replace(SEARCH_PREFIX, "");
      const { index: index2, anchor: anchor2 } = await this.resolveNavigation(cfi);
      const obj2 = __privateMethod(this, _View_instances, getOverlayer_fn).call(this, index2);
      if (obj2) {
        const { overlayer, doc } = obj2;
        if (remove) {
          overlayer.remove(value);
          return;
        }
        const range = doc ? anchor2(doc) : anchor2;
        overlayer.add(value, range, Overlayer.outline);
      }
      return;
    }
    const { index, anchor } = await this.resolveNavigation(value);
    const obj = __privateMethod(this, _View_instances, getOverlayer_fn).call(this, index);
    if (obj) {
      const { overlayer, doc } = obj;
      overlayer.remove(value);
      if (!remove) {
        const range = doc ? anchor(doc) : anchor;
        const draw = (func, opts) => overlayer.add(value, range, func, opts);
        __privateMethod(this, _View_instances, emit_fn).call(this, "draw-annotation", { draw, annotation, doc, range });
      }
    }
    const label = ((_a = __privateGet(this, _tocProgress).getProgress(index)) == null ? void 0 : _a.label) ?? "";
    return { index, label };
  }
  deleteAnnotation(annotation) {
    return this.addAnnotation(annotation, true);
  }
  async showAnnotation(annotation) {
    const { value } = annotation;
    const resolved = await this.goTo(value);
    if (resolved) {
      const { index, anchor } = resolved;
      const { doc } = __privateMethod(this, _View_instances, getOverlayer_fn).call(this, index);
      const range = anchor(doc);
      __privateMethod(this, _View_instances, emit_fn).call(this, "show-annotation", { value, index, range });
    }
  }
  getCFI(index, range) {
    const baseCFI = this.book.sections[index].cfi ?? fake.fromIndex(index);
    if (!range) return baseCFI;
    return joinIndir(baseCFI, fromRange(range));
  }
  resolveCFI(cfi) {
    if (this.book.resolveCFI)
      return this.book.resolveCFI(cfi);
    else {
      const parts = parse(cfi);
      const index = fake.toIndex((parts.parent ?? parts).shift());
      const anchor = (doc) => toRange(doc, parts);
      return { index, anchor };
    }
  }
  resolveNavigation(target) {
    try {
      if (typeof target === "number") return { index: target };
      if (typeof target.fraction === "number") {
        const [index, anchor] = __privateGet(this, _sectionProgress).getSection(target.fraction);
        return { index, anchor };
      }
      if (isCFI.test(target)) return this.resolveCFI(target);
      return this.book.resolveHref(target);
    } catch (e) {
      console.error(e);
      console.error(`Could not resolve target ${target}`);
    }
  }
  async goTo(target) {
    const resolved = this.resolveNavigation(target);
    try {
      await this.renderer.goTo(resolved);
      this.history.pushState(target);
      return resolved;
    } catch (e) {
      console.error(e);
      console.error(`Could not go to ${target}`);
    }
  }
  async goToFraction(frac) {
    const [index, anchor] = __privateGet(this, _sectionProgress).getSection(frac);
    await this.renderer.goTo({ index, anchor });
    this.history.pushState({ fraction: frac });
  }
  async select(target) {
    try {
      const obj = await this.resolveNavigation(target);
      await this.renderer.goTo({ ...obj, select: true });
      this.history.pushState(target);
    } catch (e) {
      console.error(e);
      console.error(`Could not go to ${target}`);
    }
  }
  deselect() {
    for (const { doc } of this.renderer.getContents())
      doc.defaultView.getSelection().removeAllRanges();
  }
  getSectionFractions() {
    var _a;
    return (((_a = __privateGet(this, _sectionProgress)) == null ? void 0 : _a.sectionFractions) ?? []).map((x) => x + Number.EPSILON);
  }
  getProgressOf(index, range) {
    var _a, _b;
    const tocItem = (_a = __privateGet(this, _tocProgress)) == null ? void 0 : _a.getProgress(index, range);
    const pageItem = (_b = __privateGet(this, _pageProgress)) == null ? void 0 : _b.getProgress(index, range);
    return { tocItem, pageItem };
  }
  async getTOCItemOf(target) {
    try {
      const { index, anchor } = await this.resolveNavigation(target);
      const doc = await this.book.sections[index].createDocument();
      const frag = anchor(doc);
      const isRange = frag instanceof Range;
      const range = isRange ? frag : doc.createRange();
      if (!isRange) range.selectNodeContents(frag);
      return __privateGet(this, _tocProgress).getProgress(index, range);
    } catch (e) {
      console.error(e);
      console.error(`Could not get ${target}`);
    }
  }
  async prev(distance) {
    await this.renderer.prev(distance);
  }
  async next(distance) {
    await this.renderer.next(distance);
  }
  goLeft() {
    return this.book.dir === "rtl" ? this.next() : this.prev();
  }
  goRight() {
    return this.book.dir === "rtl" ? this.prev() : this.next();
  }
  async *search(opts) {
    var _a;
    this.clearSearch();
    const { searchMatcher } = await import("./search-Drhtbipf.js");
    const { query, index } = opts;
    const matcher = searchMatcher(
      textWalker,
      { defaultLocale: this.language, ...opts }
    );
    const iter = index != null ? __privateMethod(this, _View_instances, searchSection_fn).call(this, matcher, query, index) : __privateMethod(this, _View_instances, searchBook_fn).call(this, matcher, query);
    const list = [];
    __privateGet(this, _searchResults).set(index, list);
    for await (const result of iter) {
      if (result.subitems) {
        const list2 = result.subitems.map(({ cfi }) => ({ value: SEARCH_PREFIX + cfi }));
        __privateGet(this, _searchResults).set(result.index, list2);
        for (const item of list2) this.addAnnotation(item);
        yield {
          label: ((_a = __privateGet(this, _tocProgress).getProgress(result.index)) == null ? void 0 : _a.label) ?? "",
          subitems: result.subitems
        };
      } else {
        if (result.cfi) {
          const item = { value: SEARCH_PREFIX + result.cfi };
          list.push(item);
          this.addAnnotation(item);
        }
        yield result;
      }
    }
    yield "done";
  }
  clearSearch() {
    for (const list of __privateGet(this, _searchResults).values())
      for (const item of list) this.deleteAnnotation(item);
    __privateGet(this, _searchResults).clear();
  }
  async initTTS(granularity = "word") {
    const doc = this.renderer.getContents()[0].doc;
    if (this.tts && this.tts.doc === doc) return;
    const { TTS } = await import("./tts-CaBqfVbs.js");
    this.tts = new TTS(doc, textWalker, (range) => this.renderer.scrollToAnchor(range, true), granularity);
  }
  startMediaOverlay() {
    const { index } = this.renderer.getContents()[0];
    return this.mediaOverlay.start(index);
  }
}
_root = new WeakMap();
_sectionProgress = new WeakMap();
_tocProgress = new WeakMap();
_pageProgress = new WeakMap();
_searchResults = new WeakMap();
_cursorAutohider = new WeakMap();
_View_instances = new WeakSet();
emit_fn = function(name, detail, cancelable) {
  return this.dispatchEvent(new CustomEvent(name, { detail, cancelable }));
};
onRelocate_fn = function({ reason, range, index, fraction, size }) {
  var _a, _b, _c;
  const progress = ((_a = __privateGet(this, _sectionProgress)) == null ? void 0 : _a.getProgress(index, fraction, size)) ?? {};
  const tocItem = (_b = __privateGet(this, _tocProgress)) == null ? void 0 : _b.getProgress(index, range);
  const pageItem = (_c = __privateGet(this, _pageProgress)) == null ? void 0 : _c.getProgress(index, range);
  const cfi = this.getCFI(index, range);
  this.lastLocation = { ...progress, tocItem, pageItem, cfi, range };
  if (reason === "snap" || reason === "page" || reason === "scroll")
    this.history.replaceState(cfi);
  __privateMethod(this, _View_instances, emit_fn).call(this, "relocate", this.lastLocation);
};
onLoad_fn = function({ doc, index }) {
  var _a, _b;
  (_a = doc.documentElement).lang || (_a.lang = this.language.canonical ?? "");
  if (!this.language.isCJK)
    (_b = doc.documentElement).dir || (_b.dir = this.language.direction ?? "");
  __privateMethod(this, _View_instances, handleLinks_fn).call(this, doc, index);
  __privateGet(this, _cursorAutohider).cloneFor(doc.documentElement);
  __privateMethod(this, _View_instances, emit_fn).call(this, "load", { doc, index });
};
handleLinks_fn = function(doc, index) {
  const { book } = this;
  const section = book.sections[index];
  doc.addEventListener("click", (e) => {
    var _a, _b;
    const a = e.target.closest("a[href]");
    if (!a) return;
    e.preventDefault();
    const href_ = a.getAttribute("href");
    const href = ((_a = section == null ? void 0 : section.resolveHref) == null ? void 0 : _a.call(section, href_)) ?? href_;
    if ((_b = book == null ? void 0 : book.isExternal) == null ? void 0 : _b.call(book, href))
      Promise.resolve(__privateMethod(this, _View_instances, emit_fn).call(this, "external-link", { a, href }, true)).then((x) => x ? globalThis.open(href, "_blank") : null).catch((e2) => console.error(e2));
    else Promise.resolve(__privateMethod(this, _View_instances, emit_fn).call(this, "link", { a, href }, true)).then((x) => x ? this.goTo(href) : null).catch((e2) => console.error(e2));
  });
};
getOverlayer_fn = function(index) {
  return this.renderer.getContents().find((x) => x.index === index && x.overlayer);
};
createOverlayer_fn = function({ doc, index }) {
  const overlayer = new Overlayer();
  doc.addEventListener("click", (e) => {
    const [value, range] = overlayer.hitTest(e);
    if (value && !value.startsWith(SEARCH_PREFIX)) {
      __privateMethod(this, _View_instances, emit_fn).call(this, "show-annotation", { value, index, range });
    }
  }, false);
  const list = __privateGet(this, _searchResults).get(index);
  if (list) for (const item of list) this.addAnnotation(item);
  __privateMethod(this, _View_instances, emit_fn).call(this, "create-overlay", { index });
  return overlayer;
};
searchSection_fn = async function* (matcher, query, index) {
  const doc = await this.book.sections[index].createDocument();
  for (const { range, excerpt } of matcher(doc, query))
    yield { cfi: this.getCFI(index, range), excerpt };
};
searchBook_fn = async function* (matcher, query) {
  const { sections } = this.book;
  for (const [index, { createDocument }] of sections.entries()) {
    if (!createDocument) continue;
    const doc = await createDocument();
    const subitems = Array.from(matcher(doc, query), ({ range, excerpt }) => ({ cfi: this.getCFI(index, range), excerpt }));
    const progress = (index + 1) / sections.length;
    yield { progress };
    if (subitems.length) yield { index, subitems };
  }
};
customElements.define("foliate-view", View);
export {
  NotFoundError as N,
  Overlayer as O,
  ResponseError as R,
  UnsupportedTypeError as U,
  View as V,
  toRange as a,
  epubcfi as e,
  fromElements as f,
  makeBook as m,
  parse as p,
  toElement as t
};
