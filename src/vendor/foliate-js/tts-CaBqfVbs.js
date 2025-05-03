var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
const NS = {
  XML: "http://www.w3.org/XML/1998/namespace",
  SSML: "http://www.w3.org/2001/10/synthesis"
};
const blockTags = /* @__PURE__ */ new Set([
  "article",
  "aside",
  "audio",
  "blockquote",
  "caption",
  "details",
  "dialog",
  "div",
  "dl",
  "dt",
  "dd",
  "figure",
  "footer",
  "form",
  "figcaption",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hgroup",
  "hr",
  "li",
  "main",
  "math",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "tr"
]);
const getLang = (el) => {
  var _a;
  const x = el.lang || ((_a = el == null ? void 0 : el.getAttributeNS) == null ? void 0 : _a.call(el, NS.XML, "lang"));
  return x ? x : el.parentElement ? getLang(el.parentElement) : null;
};
const getAlphabet = (el) => {
  var _a;
  const x = (_a = el == null ? void 0 : el.getAttributeNS) == null ? void 0 : _a.call(el, NS.XML, "lang");
  return x ? x : el.parentElement ? getAlphabet(el.parentElement) : null;
};
const getSegmenter = (lang = "en", granularity = "word") => {
  const segmenter = new Intl.Segmenter(lang, { granularity });
  const granularityIsWord = granularity === "word";
  return function* (strs, makeRange) {
    const str = strs.join("");
    let name = 0;
    let strIndex = -1;
    let sum = 0;
    for (const { index, segment, isWordLike } of segmenter.segment(str)) {
      if (granularityIsWord && !isWordLike) continue;
      while (sum <= index) sum += strs[++strIndex].length;
      const startIndex = strIndex;
      const startOffset = index - (sum - strs[strIndex].length);
      const end = index + segment.length - 1;
      if (end < str.length) while (sum <= end) sum += strs[++strIndex].length;
      const endIndex = strIndex;
      const endOffset = end - (sum - strs[strIndex].length) + 1;
      yield [
        (name++).toString(),
        makeRange(startIndex, startOffset, endIndex, endOffset)
      ];
    }
  };
};
const fragmentToSSML = (fragment, inherited) => {
  const ssml = document.implementation.createDocument(NS.SSML, "speak");
  const { lang } = inherited;
  if (lang) ssml.documentElement.setAttributeNS(NS.XML, "lang", lang);
  const convert = (node, parent, inheritedAlphabet) => {
    if (!node) return;
    if (node.nodeType === 3) return ssml.createTextNode(node.textContent);
    if (node.nodeType === 4) return ssml.createCDATASection(node.textContent);
    if (node.nodeType !== 1) return;
    let el;
    const nodeName = node.nodeName.toLowerCase();
    if (nodeName === "foliate-mark") {
      el = ssml.createElementNS(NS.SSML, "mark");
      el.setAttribute("name", node.dataset.name);
    } else if (nodeName === "br")
      el = ssml.createElementNS(NS.SSML, "break");
    else if (nodeName === "em" || nodeName === "strong")
      el = ssml.createElementNS(NS.SSML, "emphasis");
    const lang2 = node.lang || node.getAttributeNS(NS.XML, "lang");
    if (lang2) {
      if (!el) el = ssml.createElementNS(NS.SSML, "lang");
      el.setAttributeNS(NS.XML, "lang", lang2);
    }
    const alphabet = node.getAttributeNS(NS.SSML, "alphabet") || inheritedAlphabet;
    if (!el) {
      const ph = node.getAttributeNS(NS.SSML, "ph");
      if (ph) {
        el = ssml.createElementNS(NS.SSML, "phoneme");
        if (alphabet) el.setAttribute("alphabet", alphabet);
        el.setAttribute("ph", ph);
      }
    }
    if (!el) el = parent;
    let child = node.firstChild;
    while (child) {
      const childEl = convert(child, el, alphabet);
      if (childEl && el !== childEl) el.append(childEl);
      child = child.nextSibling;
    }
    return el;
  };
  convert(fragment.firstChild, ssml.documentElement, inherited.alphabet);
  return ssml;
};
const getFragmentWithMarks = (range, textWalker, granularity) => {
  const lang = getLang(range.commonAncestorContainer);
  const alphabet = getAlphabet(range.commonAncestorContainer);
  const segmenter = getSegmenter(lang, granularity);
  const fragment = range.cloneContents();
  const entries = [...textWalker(range, segmenter)];
  const fragmentEntries = [...textWalker(fragment, segmenter)];
  for (const [name, range2] of fragmentEntries) {
    const mark = document.createElement("foliate-mark");
    mark.dataset.name = name;
    range2.insertNode(mark);
  }
  const ssml = fragmentToSSML(fragment, { lang, alphabet });
  return { entries, ssml };
};
const rangeIsEmpty = (range) => !range.toString().trim();
function* getBlocks(doc) {
  let last;
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const name = node.tagName.toLowerCase();
    if (blockTags.has(name)) {
      if (last) {
        last.setEndBefore(node);
        if (!rangeIsEmpty(last)) yield last;
      }
      last = doc.createRange();
      last.setStart(node, 0);
    }
  }
  if (!last) {
    last = doc.createRange();
    last.setStart(doc.body.firstChild ?? doc.body, 0);
  }
  last.setEndAfter(doc.body.lastChild ?? doc.body);
  if (!rangeIsEmpty(last)) yield last;
}
var _arr, _iter, _index, _f;
class ListIterator {
  constructor(iter, f = (x) => x) {
    __privateAdd(this, _arr, []);
    __privateAdd(this, _iter);
    __privateAdd(this, _index, -1);
    __privateAdd(this, _f);
    __privateSet(this, _iter, iter);
    __privateSet(this, _f, f);
  }
  current() {
    if (__privateGet(this, _arr)[__privateGet(this, _index)]) return __privateGet(this, _f).call(this, __privateGet(this, _arr)[__privateGet(this, _index)]);
  }
  first() {
    const newIndex = 0;
    if (__privateGet(this, _arr)[newIndex]) {
      __privateSet(this, _index, newIndex);
      return __privateGet(this, _f).call(this, __privateGet(this, _arr)[newIndex]);
    }
  }
  prev() {
    const newIndex = __privateGet(this, _index) - 1;
    if (__privateGet(this, _arr)[newIndex]) {
      __privateSet(this, _index, newIndex);
      return __privateGet(this, _f).call(this, __privateGet(this, _arr)[newIndex]);
    }
  }
  next() {
    const newIndex = __privateGet(this, _index) + 1;
    if (__privateGet(this, _arr)[newIndex]) {
      __privateSet(this, _index, newIndex);
      return __privateGet(this, _f).call(this, __privateGet(this, _arr)[newIndex]);
    }
    while (true) {
      const { done, value } = __privateGet(this, _iter).next();
      if (done) break;
      __privateGet(this, _arr).push(value);
      if (__privateGet(this, _arr)[newIndex]) {
        __privateSet(this, _index, newIndex);
        return __privateGet(this, _f).call(this, __privateGet(this, _arr)[newIndex]);
      }
    }
  }
  find(f) {
    const index = __privateGet(this, _arr).findIndex((x) => f(x));
    if (index > -1) {
      __privateSet(this, _index, index);
      return __privateGet(this, _f).call(this, __privateGet(this, _arr)[index]);
    }
    while (true) {
      const { done, value } = __privateGet(this, _iter).next();
      if (done) break;
      __privateGet(this, _arr).push(value);
      if (f(value)) {
        __privateSet(this, _index, __privateGet(this, _arr).length - 1);
        return __privateGet(this, _f).call(this, value);
      }
    }
  }
}
_arr = new WeakMap();
_iter = new WeakMap();
_index = new WeakMap();
_f = new WeakMap();
var _list, _ranges, _lastMark, _serializer, _TTS_instances, getMarkElement_fn, speak_fn;
class TTS {
  constructor(doc, textWalker, highlight, granularity) {
    __privateAdd(this, _TTS_instances);
    __privateAdd(this, _list);
    __privateAdd(this, _ranges);
    __privateAdd(this, _lastMark);
    __privateAdd(this, _serializer, new XMLSerializer());
    this.doc = doc;
    this.highlight = highlight;
    __privateSet(this, _list, new ListIterator(getBlocks(doc), (range) => {
      const { entries, ssml } = getFragmentWithMarks(range, textWalker, granularity);
      __privateSet(this, _ranges, new Map(entries));
      return [ssml, range];
    }));
  }
  start() {
    __privateSet(this, _lastMark, null);
    const [doc] = __privateGet(this, _list).first() ?? [];
    if (!doc) return this.next();
    return __privateMethod(this, _TTS_instances, speak_fn).call(this, doc, (ssml) => __privateMethod(this, _TTS_instances, getMarkElement_fn).call(this, ssml, __privateGet(this, _lastMark)));
  }
  resume() {
    const [doc] = __privateGet(this, _list).current() ?? [];
    if (!doc) return this.next();
    return __privateMethod(this, _TTS_instances, speak_fn).call(this, doc, (ssml) => __privateMethod(this, _TTS_instances, getMarkElement_fn).call(this, ssml, __privateGet(this, _lastMark)));
  }
  prev(paused) {
    __privateSet(this, _lastMark, null);
    const [doc, range] = __privateGet(this, _list).prev() ?? [];
    if (paused && range) this.highlight(range.cloneRange());
    return __privateMethod(this, _TTS_instances, speak_fn).call(this, doc);
  }
  next(paused) {
    __privateSet(this, _lastMark, null);
    const [doc, range] = __privateGet(this, _list).next() ?? [];
    if (paused && range) this.highlight(range.cloneRange());
    return __privateMethod(this, _TTS_instances, speak_fn).call(this, doc);
  }
  from(range) {
    __privateSet(this, _lastMark, null);
    const [doc] = __privateGet(this, _list).find((range_) => range.compareBoundaryPoints(Range.END_TO_START, range_) <= 0);
    let mark;
    for (const [name, range_] of __privateGet(this, _ranges).entries())
      if (range.compareBoundaryPoints(Range.START_TO_START, range_) <= 0) {
        mark = name;
        break;
      }
    return __privateMethod(this, _TTS_instances, speak_fn).call(this, doc, (ssml) => __privateMethod(this, _TTS_instances, getMarkElement_fn).call(this, ssml, mark));
  }
  setMark(mark) {
    const range = __privateGet(this, _ranges).get(mark);
    if (range) {
      __privateSet(this, _lastMark, mark);
      this.highlight(range.cloneRange());
    }
  }
}
_list = new WeakMap();
_ranges = new WeakMap();
_lastMark = new WeakMap();
_serializer = new WeakMap();
_TTS_instances = new WeakSet();
getMarkElement_fn = function(doc, mark) {
  if (!mark) return null;
  return doc.querySelector(`mark[name="${CSS.escape(mark)}"`);
};
speak_fn = function(doc, getNode) {
  var _a, _b;
  if (!doc) return;
  if (!getNode) return __privateGet(this, _serializer).serializeToString(doc);
  const ssml = document.implementation.createDocument(NS.SSML, "speak");
  ssml.documentElement.replaceWith(ssml.importNode(doc.documentElement, true));
  let node = (_a = getNode(ssml)) == null ? void 0 : _a.previousSibling;
  while (node) {
    const next = node.previousSibling ?? ((_b = node.parentNode) == null ? void 0 : _b.previousSibling);
    node.parentNode.removeChild(node);
    node = next;
  }
  return __privateGet(this, _serializer).serializeToString(ssml);
};
export {
  TTS
};
