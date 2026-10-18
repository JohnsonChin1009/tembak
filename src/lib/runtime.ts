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
window.tembak = {
  appId: C.appId,
  version: C.version,
  data: function(key){ return req("/api/public/data/" + enc(C.appId) + "/" + enc(key)); },
  kv: {
    get: function(key){ return req("/api/public/kv/" + enc(C.appId) + "/" + enc(key)).then(function(b){ return b ? b.value : null; }); },
    set: function(key, value){ return req("/api/public/kv/" + enc(C.appId) + "/" + enc(key), { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: value }) }).then(function(){}); }
  }
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
