import { r as requireUrl, g as getDefaultExportFromCjs } from "./url-ruE0h9F9.js";
import { r as requireStreamHttp } from "./index-B4vYHl1s.js";
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
var httpsBrowserify = { exports: {} };
var hasRequiredHttpsBrowserify;
function requireHttpsBrowserify() {
  if (hasRequiredHttpsBrowserify) return httpsBrowserify.exports;
  hasRequiredHttpsBrowserify = 1;
  (function(module) {
    var http = requireStreamHttp();
    var url = requireUrl();
    var https = module.exports;
    for (var key in http) {
      if (http.hasOwnProperty(key)) https[key] = http[key];
    }
    https.request = function(params, cb) {
      params = validateParams(params);
      return http.request.call(this, params, cb);
    };
    https.get = function(params, cb) {
      params = validateParams(params);
      return http.get.call(this, params, cb);
    };
    function validateParams(params) {
      if (typeof params === "string") {
        params = url.parse(params);
      }
      if (!params.protocol) {
        params.protocol = "https:";
      }
      if (params.protocol !== "https:") {
        throw new Error('Protocol "' + params.protocol + '" not supported. Expected "https:"');
      }
      return params;
    }
  })(httpsBrowserify);
  return httpsBrowserify.exports;
}
var httpsBrowserifyExports = requireHttpsBrowserify();
const index = /* @__PURE__ */ getDefaultExportFromCjs(httpsBrowserifyExports);
const index$1 = /* @__PURE__ */ _mergeNamespaces({
  __proto__: null,
  default: index
}, [httpsBrowserifyExports]);
export {
  index$1 as i
};
