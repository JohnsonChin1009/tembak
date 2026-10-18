// The `window.tembak` runtime injected into every generated app, for preview
// and for published pages. Pure string building so it works on client and server.

import { UI_KIT_CSS, UI_KIT_JS } from "./ui-kit";

/** `token` is the member's app token (src/lib/app-token.ts); without it data and kv calls get 401. */
export type RuntimeOptions = { appId: string; version: number; apiBase: string; token?: string };

export function runtimeScript({ appId, version, apiBase, token }: RuntimeOptions): string {
  const cfg = JSON.stringify({ appId, version, api: apiBase.replace(/\/$/, ""), token: token ?? null }).replace(/</g, "\\u003c");
  return `<script>(function(){
var C=${cfg};
function req(path, init){
  init = Object.assign({ credentials: "omit" }, init);
  if (C.token) init.headers = Object.assign({ authorization: "Bearer " + C.token }, init.headers);
  return fetch(C.api + path, init).then(function(r){
    if (!r.ok) return r.json().catch(function(){return {};}).then(function(b){ throw new Error(b.error || ("Request failed (" + r.status + ")")); });
    return r.status === 204 ? null : r.json();
  });
}
var enc = encodeURIComponent;
// Identity-aware endpoints (src/app/api/runtime/[appId]/*).
function rt(path, init){ return req("/api/runtime/" + enc(C.appId) + path, init); }
function once(fn){ var p = null; return function(){ return p || (p = fn().catch(function(e){ p = null; throw e; })); }; }
window.tembak = {
  appId: C.appId,
  version: C.version,
  data: function(key){ return req("/api/public/data/" + enc(C.appId) + "/" + enc(key), C.wrote ? { cache: "no-store" } : undefined); },
  kv: {
    get: function(key){ return req("/api/public/kv/" + enc(C.appId) + "/" + enc(key)).then(function(b){ return b ? b.value : null; }); },
    set: function(key, value){ return req("/api/public/kv/" + enc(C.appId) + "/" + enc(key), { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: value }) }).then(function(){}); }
  },
  me: once(function(){ return rt("/me"); }),
  members: (function(){ var all = once(function(){ return rt("/members"); }); return function(){ return all().then(function(l){ return l.slice(); }); }; })()
};
window.tembak.post = function(text, opts){
  return rt("/post", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: String(text == null ? "" : text), thread: !!(opts && opts.thread) }) }).then(function(){});
};
// tembak.ask(prompt, { data?, json?, schema? }) -> string, or parsed JSON when json is true.
window.tembak.ask = function(prompt, o){
  o = o || {};
  return rt("/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: prompt, data: o.data, json: !!o.json, schema: o.schema }) }).then(function(b){ return b.answer; });
};
// Writes to connected tools (src/lib/actions). After one, data() skips the
// browser's HTTP cache so the app sees its own change.
window.tembak.action = function(name, input){
  return rt("/action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name, input: input || {} }) }).then(function(r){ C.wrote = true; return r; });
};
})();</script><style>${UI_KIT_CSS}</style><script>${UI_KIT_JS}</script>`;
}

/** Inserts the runtime as the first thing in <head> so app code can rely on it. */
export function injectRuntime(html: string, opts: RuntimeOptions): string {
  const script = runtimeScript(opts);
  const head = /<head[^>]*>/i.exec(html);
  if (head) {
    const at = head.index + head[0].length;
    return html.slice(0, at) + script + html.slice(at);
  }
  const htmlTag = /<html[^>]*>/i.exec(html);
  if (htmlTag) {
    const at = htmlTag.index + htmlTag[0].length;
    return `${html.slice(0, at)}<head>${script}</head>${html.slice(at)}`;
  }
  return script + html;
}
