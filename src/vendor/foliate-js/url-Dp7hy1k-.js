import { r as requireUrl, g as getDefaultExportFromCjs } from "./url-ruE0h9F9.js";
function _mergeNamespaces(n, m) {
  for (var i = 0; i < m.length; i++) {
    const e = m[i];
    if (typeof e !== "string" && !Array.isArray(e)) {
      for (const k in e) {
        if (k !== "default" && !(k in n)) {
          const d = Object.getOwnPropertyDescriptor(e, k);
          if (d) {
            Object.defineProperty(n, k, d.get ? d : {
              enumerable: true,
              get: () => e[k]
            });
          }
        }
      }
    }
  }
  return Object.freeze(Object.defineProperty(n, Symbol.toStringTag, { value: "Module" }));
}
var urlExports = requireUrl();
const url = /* @__PURE__ */ getDefaultExportFromCjs(urlExports);
const url$1 = /* @__PURE__ */ _mergeNamespaces({
  __proto__: null,
  default: url
}, [urlExports]);
export {
  url$1 as u
};
